-- Migration: Create period_configuration table
-- Purpose: Store universal period generation rules instead of managing 18 individual periods
-- Date: 2025-10-12

-- Create period_configuration table
CREATE TABLE IF NOT EXISTS period_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
  period_length_days INTEGER NOT NULL DEFAULT 30 CHECK (period_length_days > 0 AND period_length_days <= 60),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure only one configuration per restaurant
  UNIQUE(restaurant_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_period_configuration_restaurant
  ON period_configuration(restaurant_id);

-- Add comment
COMMENT ON TABLE period_configuration IS 'Universal period generation rules. One configuration applies to all periods in the restaurant.';
COMMENT ON COLUMN period_configuration.start_day IS 'Day of month when periods start (1-31). Applied universally to all periods.';
COMMENT ON COLUMN period_configuration.period_length_days IS 'Length of each period in days. Currently fixed at 30 days.';

-- Insert default configuration for existing restaurant
-- Default: start_day = 21 (current system), period_length = 30 days
INSERT INTO period_configuration (restaurant_id, start_day, period_length_days)
SELECT id, 21, 30
FROM restaurants
WHERE NOT EXISTS (
  SELECT 1 FROM period_configuration WHERE restaurant_id = restaurants.id
)
ON CONFLICT (restaurant_id) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_period_configuration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_period_configuration_timestamp
  BEFORE UPDATE ON period_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_period_configuration_updated_at();
