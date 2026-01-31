-- ==========================================
-- AI RECEPTIONIST ALLERGEN DATABASE SCHEMA
-- Migration: 016_allergen_schema_for_ai_receptionist.sql
-- Purpose: Add allergen management tables for AI Receptionist feature
-- Project: ai-receptionist-allergen (separate repository)
-- Database: EXISTING Supabase from shift-schedule-manager-ortools
-- Date: 2025-01-31
-- ==========================================

-- IMPORTANT: This migration adds NEW tables for the AI Receptionist feature
-- These tables are INDEPENDENT from shift scheduler tables (no foreign keys)
-- Safe to run without affecting existing shift-schedule-manager application

-- ==========================================
-- 1. Allergen Types (Standardized list)
-- ==========================================

CREATE TABLE IF NOT EXISTS allergen_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- "gluten", "dairy", "shellfish", etc.
  name_ja TEXT NOT NULL, -- "グルテン", "乳製品", "甲殻類"
  icon TEXT, -- Emoji icon: "🌾", "🥛", "🦐"
  severity TEXT CHECK (severity IN ('severe', 'moderate', 'mild')),
  description TEXT,
  description_ja TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE allergen_types IS 'Standard allergen types for AI Receptionist feature';
COMMENT ON COLUMN allergen_types.name IS 'English allergen name (lowercase)';
COMMENT ON COLUMN allergen_types.name_ja IS 'Japanese allergen name';
COMMENT ON COLUMN allergen_types.severity IS 'Allergen severity level for UI prioritization';

-- ==========================================
-- 2. Menu Categories
-- ==========================================

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE menu_categories IS 'Menu categories (Appetizers, Main Course, etc.)';

-- ==========================================
-- 3. Menu Items
-- ==========================================

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  description TEXT,
  description_ja TEXT,
  price_jpy DECIMAL(10, 2),
  is_available BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE menu_items IS 'Hotel menu items with multilingual support';
COMMENT ON COLUMN menu_items.is_available IS 'Whether item is currently available for order';

-- ==========================================
-- 4. Ingredients (Shared library)
-- ==========================================

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  name_ja TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ingredients IS 'Shared ingredient library for menu items';

-- ==========================================
-- 5. Ingredient Allergens (Many-to-many)
-- ==========================================

CREATE TABLE IF NOT EXISTS ingredient_allergens (
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  allergen_type_id UUID REFERENCES allergen_types(id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, allergen_type_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ingredient_allergens IS 'Maps ingredients to their allergen types';

-- ==========================================
-- 6. Menu Item Ingredients (Many-to-many with quantity)
-- ==========================================

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity TEXT, -- "100g", "2 pieces", "to taste"
  is_optional BOOLEAN DEFAULT FALSE, -- Can be removed by request
  PRIMARY KEY (menu_item_id, ingredient_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE menu_item_ingredients IS 'Maps menu items to ingredients with quantities';
COMMENT ON COLUMN menu_item_ingredients.is_optional IS 'Whether ingredient can be omitted on request';

-- ==========================================
-- 7. Conversation Logs (For analytics and improvement)
-- ==========================================

CREATE TABLE IF NOT EXISTS allergen_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  detected_allergens TEXT[], -- Array of allergen names
  safe_items_count INTEGER DEFAULT 0,
  unsafe_items_count INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE allergen_conversations IS 'Logs all AI Receptionist conversations for analytics';
COMMENT ON COLUMN allergen_conversations.detected_allergens IS 'Array of allergen names extracted from user message';

-- ==========================================
-- 8. User Sessions (Track conversation context)
-- ==========================================

CREATE TABLE IF NOT EXISTS allergen_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  user_allergens TEXT[], -- Allergens mentioned in this session
  metadata JSONB -- Store additional context
);

COMMENT ON TABLE allergen_sessions IS 'User sessions for conversation context tracking';
COMMENT ON COLUMN allergen_sessions.user_allergens IS 'Accumulated allergens mentioned by user in this session';

-- ==========================================
-- INDEXES for Performance
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_ingredient_allergens_ingredient ON ingredient_allergens(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_allergens_allergen ON ingredient_allergens(allergen_type_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_menu ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_ingredient ON menu_item_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON allergen_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON allergen_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON allergen_sessions(last_activity_at);

-- ==========================================
-- AUTO-UPDATE TRIGGERS
-- ==========================================

-- Auto-update updated_at for allergen_types
CREATE OR REPLACE FUNCTION update_allergen_types_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_allergen_types_updated_at
  BEFORE UPDATE ON allergen_types
  FOR EACH ROW
  EXECUTE FUNCTION update_allergen_types_timestamp();

-- Auto-update updated_at for menu_items
CREATE OR REPLACE FUNCTION update_menu_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_items_timestamp();

-- Auto-update session activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE allergen_sessions
  SET
    last_activity_at = NOW(),
    message_count = message_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_on_message
  AFTER INSERT ON allergen_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- ==========================================
-- SAMPLE DATA (For development and demo)
-- ==========================================

-- Insert standard allergen types
INSERT INTO allergen_types (name, name_ja, icon, severity, description, description_ja) VALUES
  ('gluten', 'グルテン', '🌾', 'severe', 'Found in wheat, barley, rye', '小麦、大麦、ライ麦に含まれる'),
  ('dairy', '乳製品', '🥛', 'moderate', 'Milk and milk products', '牛乳および乳製品'),
  ('eggs', '卵', '🥚', 'moderate', 'Chicken eggs and egg products', '鶏卵および卵製品'),
  ('shellfish', '甲殻類', '🦐', 'severe', 'Shrimp, crab, lobster', 'エビ、カニ、ロブスター'),
  ('fish', '魚', '🐟', 'moderate', 'All types of fish', 'すべての種類の魚'),
  ('nuts', 'ナッツ類', '🌰', 'severe', 'Tree nuts (almonds, walnuts, cashews)', 'アーモンド、クルミ、カシューナッツなど'),
  ('peanuts', 'ピーナッツ', '🥜', 'severe', 'Peanuts and peanut products', 'ピーナッツおよびピーナッツ製品'),
  ('soy', '大豆', '🫘', 'mild', 'Soybeans and soy products', '大豆および大豆製品'),
  ('sesame', 'ゴマ', '🌱', 'moderate', 'Sesame seeds and sesame oil', 'ゴマおよびゴマ油'),
  ('alcohol', 'アルコール', '🍷', 'mild', 'Alcoholic beverages and extracts', 'アルコール飲料およびエキス')
ON CONFLICT (name) DO NOTHING;

-- Insert menu categories
INSERT INTO menu_categories (name, name_ja, display_order) VALUES
  ('Appetizers', '前菜', 1),
  ('Main Course', 'メインディッシュ', 2),
  ('Desserts', 'デザート', 3),
  ('Beverages', '飲み物', 4)
ON CONFLICT DO NOTHING;

-- Insert sample ingredients
INSERT INTO ingredients (name, name_ja, description) VALUES
  ('wheat flour', '小麦粉', 'All-purpose wheat flour'),
  ('milk', '牛乳', 'Whole milk'),
  ('butter', 'バター', 'Unsalted butter'),
  ('eggs', '卵', 'Chicken eggs'),
  ('shrimp', 'エビ', 'Fresh shrimp'),
  ('salmon', 'サーモン', 'Fresh salmon fillet'),
  ('soy sauce', '醤油', 'Japanese soy sauce'),
  ('sesame oil', 'ごま油', 'Toasted sesame oil'),
  ('peanut oil', 'ピーナッツ油', 'Refined peanut oil'),
  ('almonds', 'アーモンド', 'Sliced almonds'),
  ('rice', '米', 'White rice'),
  ('chicken breast', '鶏胸肉', 'Boneless chicken breast'),
  ('tomato', 'トマト', 'Fresh tomatoes'),
  ('olive oil', 'オリーブオイル', 'Extra virgin olive oil'),
  ('garlic', 'にんにく', 'Fresh garlic'),
  ('white wine', '白ワイン', 'Dry white wine'),
  ('parmesan cheese', 'パルメザンチーズ', 'Aged parmesan'),
  ('romaine lettuce', 'ロメインレタス', 'Fresh romaine lettuce'),
  ('croutons', 'クルトン', 'Toasted bread cubes'),
  ('lemon', 'レモン', 'Fresh lemon')
ON CONFLICT (name) DO NOTHING;

-- Link ingredients to allergens
INSERT INTO ingredient_allergens (ingredient_id, allergen_type_id)
SELECT i.id, a.id FROM ingredients i, allergen_types a
WHERE (i.name = 'wheat flour' AND a.name = 'gluten')
   OR (i.name = 'milk' AND a.name = 'dairy')
   OR (i.name = 'butter' AND a.name = 'dairy')
   OR (i.name = 'eggs' AND a.name = 'eggs')
   OR (i.name = 'shrimp' AND a.name = 'shellfish')
   OR (i.name = 'salmon' AND a.name = 'fish')
   OR (i.name = 'soy sauce' AND a.name = 'soy')
   OR (i.name = 'sesame oil' AND a.name = 'sesame')
   OR (i.name = 'peanut oil' AND a.name = 'peanuts')
   OR (i.name = 'almonds' AND a.name = 'nuts')
   OR (i.name = 'white wine' AND a.name = 'alcohol')
   OR (i.name = 'parmesan cheese' AND a.name = 'dairy')
   OR (i.name = 'croutons' AND a.name = 'gluten')
ON CONFLICT DO NOTHING;

-- Insert sample menu items
INSERT INTO menu_items (name, name_ja, category_id, description, description_ja, price_jpy, is_available)
SELECT
  'Caesar Salad',
  'シーザーサラダ',
  c.id,
  'Fresh romaine lettuce with parmesan cheese and croutons',
  '新鮮なロメインレタスとパルメザンチーズ、クルトン',
  1200,
  true
FROM menu_categories c WHERE c.name = 'Appetizers'
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (name, name_ja, category_id, description, description_ja, price_jpy, is_available)
SELECT
  'Grilled Salmon',
  '焼きサーモン',
  c.id,
  'Fresh salmon with lemon butter sauce',
  'レモンバターソースの焼きサーモン',
  2800,
  true
FROM menu_categories c WHERE c.name = 'Main Course'
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (name, name_ja, category_id, description, description_ja, price_jpy, is_available)
SELECT
  'Shrimp Pasta',
  'エビパスタ',
  c.id,
  'Linguine with garlic shrimp in white wine sauce',
  'ガーリックシュリンプの白ワインソースパスタ',
  2400,
  true
FROM menu_categories c WHERE c.name = 'Main Course'
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (name, name_ja, category_id, description, description_ja, price_jpy, is_available)
SELECT
  'Grilled Chicken Rice Bowl',
  '焼き鶏丼',
  c.id,
  'Grilled chicken breast over white rice',
  '白米の上の焼き鶏胸肉',
  1800,
  true
FROM menu_categories c WHERE c.name = 'Main Course'
ON CONFLICT DO NOTHING;

-- Link menu items to ingredients (Caesar Salad)
INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity, is_optional)
SELECT
  mi.id,
  i.id,
  CASE
    WHEN i.name = 'romaine lettuce' THEN '150g'
    WHEN i.name = 'parmesan cheese' THEN '30g'
    WHEN i.name = 'croutons' THEN '50g'
    WHEN i.name = 'olive oil' THEN '2 tbsp'
  END,
  CASE
    WHEN i.name = 'croutons' THEN true
    ELSE false
  END
FROM menu_items mi, ingredients i
WHERE mi.name = 'Caesar Salad'
  AND i.name IN ('romaine lettuce', 'parmesan cheese', 'croutons', 'olive oil')
ON CONFLICT DO NOTHING;

-- Link menu items to ingredients (Grilled Salmon)
INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity, is_optional)
SELECT
  mi.id,
  i.id,
  CASE
    WHEN i.name = 'salmon' THEN '200g'
    WHEN i.name = 'butter' THEN '20g'
    WHEN i.name = 'lemon' THEN '1 slice'
  END,
  false
FROM menu_items mi, ingredients i
WHERE mi.name = 'Grilled Salmon'
  AND i.name IN ('salmon', 'butter', 'lemon')
ON CONFLICT DO NOTHING;

-- Link menu items to ingredients (Shrimp Pasta)
INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity, is_optional)
SELECT
  mi.id,
  i.id,
  CASE
    WHEN i.name = 'shrimp' THEN '150g'
    WHEN i.name = 'wheat flour' THEN '100g'
    WHEN i.name = 'garlic' THEN '2 cloves'
    WHEN i.name = 'olive oil' THEN '2 tbsp'
    WHEN i.name = 'white wine' THEN '50ml'
  END,
  CASE
    WHEN i.name = 'white wine' THEN true
    ELSE false
  END
FROM menu_items mi, ingredients i
WHERE mi.name = 'Shrimp Pasta'
  AND i.name IN ('shrimp', 'wheat flour', 'garlic', 'olive oil', 'white wine')
ON CONFLICT DO NOTHING;

-- Link menu items to ingredients (Grilled Chicken Rice Bowl)
INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity, is_optional)
SELECT
  mi.id,
  i.id,
  CASE
    WHEN i.name = 'chicken breast' THEN '200g'
    WHEN i.name = 'rice' THEN '250g'
    WHEN i.name = 'soy sauce' THEN '1 tbsp'
  END,
  false
FROM menu_items mi, ingredients i
WHERE mi.name = 'Grilled Chicken Rice Bowl'
  AND i.name IN ('chicken breast', 'rice', 'soy sauce')
ON CONFLICT DO NOTHING;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Uncomment to verify after migration:

-- SELECT COUNT(*) AS allergen_count FROM allergen_types;
-- SELECT COUNT(*) AS category_count FROM menu_categories;
-- SELECT COUNT(*) AS ingredient_count FROM ingredients;
-- SELECT COUNT(*) AS menu_item_count FROM menu_items;

-- Test allergen query (find items safe for someone allergic to shellfish):
-- SELECT
--   mi.name,
--   mi.name_ja,
--   mi.price_jpy,
--   COALESCE(
--     ARRAY_AGG(DISTINCT at.name) FILTER (WHERE at.name IS NOT NULL),
--     '{}'
--   ) AS allergens
-- FROM menu_items mi
-- LEFT JOIN menu_item_ingredients mii ON mi.id = mii.menu_item_id
-- LEFT JOIN ingredients i ON mii.ingredient_id = i.id
-- LEFT JOIN ingredient_allergens ia ON i.id = ia.ingredient_id
-- LEFT JOIN allergen_types at ON ia.allergen_type_id = at.id
-- WHERE mi.is_available = true
-- GROUP BY mi.id, mi.name, mi.name_ja, mi.price_jpy
-- HAVING 'shellfish' != ALL(COALESCE(ARRAY_AGG(DISTINCT at.name), '{}'));

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================

-- This migration adds 8 new tables for AI Receptionist feature:
-- 1. allergen_types (10 rows)
-- 2. menu_categories (4 rows)
-- 3. menu_items (4 sample items)
-- 4. ingredients (20 sample ingredients)
-- 5. ingredient_allergens (mapping)
-- 6. menu_item_ingredients (mapping)
-- 7. allergen_conversations (empty, for runtime logging)
-- 8. allergen_sessions (empty, for runtime tracking)

-- Next steps:
-- 1. Add more menu items (target: 20-30 hotel-specific dishes)
-- 2. Curate accurate ingredient lists for each menu item
-- 3. Verify allergen mappings for guest safety
-- 4. Test queries with multiple allergen combinations
-- 5. Implement NestJS backend to consume this schema
