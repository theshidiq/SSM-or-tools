-- Migration: Create regenerate_periods RPC function
-- Purpose: Smart function to recalculate all 18 periods based on configuration rules
-- Date: 2025-10-12

-- Helper function: Calculate period start date
-- Given a base date, start_day, and period index, calculate when that period starts
CREATE OR REPLACE FUNCTION calculate_period_start(
  p_base_date DATE,
  p_start_day INTEGER,
  p_period_index INTEGER,
  p_period_length_days INTEGER
) RETURNS DATE AS $$
DECLARE
  v_start_date DATE;
  v_months_offset INTEGER;
  v_target_month INTEGER;
  v_target_year INTEGER;
BEGIN
  -- Calculate how many months to offset from base date
  -- Each period is roughly 1 month, so period_index ≈ months_offset
  v_months_offset := p_period_index;

  -- Calculate target month and year
  v_target_month := EXTRACT(MONTH FROM p_base_date) + v_months_offset;
  v_target_year := EXTRACT(YEAR FROM p_base_date);

  -- Handle year overflow
  WHILE v_target_month > 12 LOOP
    v_target_month := v_target_month - 12;
    v_target_year := v_target_year + 1;
  END LOOP;

  -- Create date with target year, month, and start_day
  -- Handle edge case: if start_day > days in month, use last day of month
  v_start_date := MAKE_DATE(v_target_year, v_target_month, 1);

  -- Adjust to start_day, handling months with fewer days
  v_start_date := v_start_date + (LEAST(p_start_day,
    EXTRACT(DAY FROM (DATE_TRUNC('MONTH', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER
  ) - 1);

  RETURN v_start_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: Format period label (e.g., "1月・2月" for Jan-Feb)
CREATE OR REPLACE FUNCTION format_period_label(
  p_start_date DATE,
  p_end_date DATE
) RETURNS TEXT AS $$
DECLARE
  v_start_month INTEGER;
  v_end_month INTEGER;
  v_month_names TEXT[] := ARRAY['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
BEGIN
  v_start_month := EXTRACT(MONTH FROM p_start_date);
  v_end_month := EXTRACT(MONTH FROM p_end_date);

  -- If same month, just show once (e.g., "1月")
  IF v_start_month = v_end_month THEN
    RETURN v_month_names[v_start_month];
  ELSE
    -- Show both months (e.g., "1月・2月")
    RETURN v_month_names[v_start_month] || '・' || v_month_names[v_end_month];
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function: Regenerate all periods based on configuration
CREATE OR REPLACE FUNCTION regenerate_periods(
  p_restaurant_id UUID DEFAULT NULL
) RETURNS TABLE(
  period_index INTEGER,
  period_id UUID,
  start_date DATE,
  end_date DATE,
  label TEXT,
  days_count INTEGER
) AS $$
DECLARE
  v_config RECORD;
  v_base_date DATE := '2025-01-21'; -- Current system base date
  v_start_date DATE;
  v_end_date DATE;
  v_label TEXT;
  v_restaurant_id UUID;
  v_period_ids UUID[];
  v_period_id UUID;
BEGIN
  -- Get restaurant_id (use parameter or get default)
  IF p_restaurant_id IS NULL THEN
    SELECT id INTO v_restaurant_id FROM restaurants LIMIT 1;
  ELSE
    v_restaurant_id := p_restaurant_id;
  END IF;

  -- Get configuration
  SELECT start_day, period_length_days
  INTO v_config
  FROM period_configuration
  WHERE restaurant_id = v_restaurant_id;

  -- If no config exists, use defaults
  IF v_config IS NULL THEN
    v_config.start_day := 21;
    v_config.period_length_days := 30;
  END IF;

  -- Get all period IDs in order by start_date (this gives us the period_index mapping)
  -- Fix: Qualify column name with table alias to avoid ambiguity
  SELECT ARRAY_AGG(p.id ORDER BY p.start_date)
  INTO v_period_ids
  FROM periods p
  LIMIT 18;

  -- Ensure we have exactly 18 periods
  IF ARRAY_LENGTH(v_period_ids, 1) IS NULL OR ARRAY_LENGTH(v_period_ids, 1) < 18 THEN
    RAISE EXCEPTION 'Expected 18 periods in database, found %', COALESCE(ARRAY_LENGTH(v_period_ids, 1), 0);
  END IF;

  -- Loop through all 18 periods and regenerate
  FOR i IN 0..17 LOOP
    -- Calculate start date for this period
    v_start_date := calculate_period_start(
      v_base_date,
      v_config.start_day,
      i,
      v_config.period_length_days
    );

    -- Calculate end date (start + length - 1)
    v_end_date := v_start_date + (v_config.period_length_days - 1);

    -- Format label
    v_label := format_period_label(v_start_date, v_end_date);

    -- Get the period ID for this index (array is 1-indexed, so i+1)
    v_period_id := v_period_ids[i + 1];

    -- Update the period in database by its UUID
    UPDATE periods
    SET
      start_date = v_start_date,
      end_date = v_end_date,
      label = v_label,
      updated_at = NOW()
    WHERE id = v_period_id;

    -- Return the updated period info
    RETURN QUERY SELECT
      i,
      v_period_id,
      v_start_date,
      v_end_date,
      v_label,
      (v_end_date - v_start_date + 1)::INTEGER;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Update period configuration and regenerate periods
CREATE OR REPLACE FUNCTION update_period_configuration(
  p_restaurant_id UUID,
  p_start_day INTEGER,
  p_period_length_days INTEGER DEFAULT 30
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_affected_periods INTEGER;
BEGIN
  -- Validate inputs
  IF p_start_day < 1 OR p_start_day > 31 THEN
    RAISE EXCEPTION 'start_day must be between 1 and 31';
  END IF;

  IF p_period_length_days < 1 OR p_period_length_days > 60 THEN
    RAISE EXCEPTION 'period_length_days must be between 1 and 60';
  END IF;

  -- Update configuration
  UPDATE period_configuration
  SET
    start_day = p_start_day,
    period_length_days = p_period_length_days,
    updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;

  -- If no config exists, insert it
  IF NOT FOUND THEN
    INSERT INTO period_configuration (restaurant_id, start_day, period_length_days)
    VALUES (p_restaurant_id, p_start_day, p_period_length_days);
  END IF;

  -- Regenerate all periods
  SELECT COUNT(*) INTO v_affected_periods
  FROM regenerate_periods(p_restaurant_id);

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'start_day', p_start_day,
    'period_length_days', p_period_length_days,
    'periods_regenerated', v_affected_periods,
    'updated_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION calculate_period_start IS 'Calculate start date for a period given base date, start day, and period index';
COMMENT ON FUNCTION format_period_label IS 'Format period label in Japanese (e.g., "1月・2月")';
COMMENT ON FUNCTION regenerate_periods IS 'Regenerate all 18 periods based on period_configuration rules';
COMMENT ON FUNCTION update_period_configuration IS 'Update configuration and automatically regenerate all periods';
