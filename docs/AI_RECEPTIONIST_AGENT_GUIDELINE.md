# AI Receptionist Feature - Initial Project Setup Guideline

## 📋 Executive Summary

**Project**: Allergen Management System (Phase 1: Foundation)
**Target**: NextBeat Job Application Portfolio (https://hrmos.co/pages/nextbeat/jobs/1928055294849511742)
**Tech Stack**: SvelteKit + NestJS + PostgreSQL (NextBeat-aligned)
**Database**: Use EXISTING Supabase from shift-schedule-manager-ortools
**Timeline**: 1 week (Initial setup only)
**Strategy**: Separate repository, shared database

**Important**: This guideline covers **Phase 1: Initial Project Setup** only.
AI integration (Claude API) will be added in Phase 2 after foundation is solid.

---

## 🎯 Project Goals (Phase 1)

### Primary Objectives
1. ✅ Setup database schema for allergen management
2. ✅ Create basic CRUD API with NestJS
3. ✅ Build simple menu display UI with SvelteKit
4. ✅ Demonstrate NextBeat tech stack proficiency (SvelteKit + TypeScript + NestJS)
5. ✅ Curate quality data (20-30 menu items with accurate allergen info)

### Phase 1 Scope
**What's Included**:
- ✅ Database schema and migration
- ✅ NestJS REST API (CRUD operations)
- ✅ SvelteKit UI (menu display, allergen filtering)
- ✅ Manual data entry interface
- ✅ Basic search and filter functionality

**What's NOT Included** (Phase 2):
- ❌ Claude API integration (conversational AI)
- ❌ Natural language processing
- ❌ Chat interface
- ❌ Session management
- ❌ Conversation logging

### Strategic Positioning
**Interview Narrative**:
> "I have 2 hospitality tech projects:
> 1. **Shift Scheduler** (6-month thesis) - React + Go + OR-Tools
> 2. **Allergen Management System** (1-week sprint) - SvelteKit + NestJS + PostgreSQL
>
> The second project demonstrates I researched NextBeat's tech stack and learned SvelteKit + NestJS specifically to be immediately productive on day 1."

---

## 🏗️ Architecture Decision

### Option Chosen: Separate Repository, Shared Database ✅

**Repository Structure**:
```
GitHub Profile:
├── shift-schedule-manager-ortools/    (Existing, React + Go + OR-Tools)
│   └── Database: Supabase PostgreSQL
│
└── ai-receptionist-allergen/          (NEW, SvelteKit + NestJS)
    └── Database: SAME Supabase (new tables added)
```

**Why This Architecture**:
1. ✅ **Separate Codebases** - Different tech stacks don't conflict
2. ✅ **Shared Database** - Cost efficient (1 Supabase instance)
3. ✅ **Portfolio Richness** - 2 repositories = 2 case studies
4. ✅ **Deployment Independence** - AI Receptionist → Vercel FREE tier
5. ✅ **Clean Git History** - No confusion between React and SvelteKit code

---

## 📊 Database Architecture

### Existing Supabase Schema (DO NOT MODIFY)

**Tables in shift-schedule-manager-ortools**:
```sql
-- Core tables (existing, DO NOT MODIFY)
- restaurants
- staff_members
- schedules
- periods
- config_versions
- ml_model_configs
- period_configuration
- staff_groups
- priority_rules
- daily_limits
```

### New Tables to Add (AI Receptionist Feature)

**Schema Design for Allergen Management**:

```sql
-- ==========================================
-- AI RECEPTIONIST ALLERGEN DATABASE SCHEMA
-- Designed for: ai-receptionist-allergen project
-- Database: EXISTING Supabase from shift-schedule-manager-ortools
-- Migration: Add these tables WITHOUT affecting existing shift scheduler
-- ==========================================

-- 1. Allergen Types (Standardized list)
CREATE TABLE allergen_types (
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

-- 2. Menu Categories
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Menu Items
CREATE TABLE menu_items (
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

-- 4. Ingredients (Shared library)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  name_ja TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Ingredient Allergens (Many-to-many)
CREATE TABLE ingredient_allergens (
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  allergen_type_id UUID REFERENCES allergen_types(id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, allergen_type_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Menu Item Ingredients (Many-to-many with quantity)
CREATE TABLE menu_item_ingredients (
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity TEXT, -- "100g", "2 pieces", "to taste"
  is_optional BOOLEAN DEFAULT FALSE, -- Can be removed by request
  PRIMARY KEY (menu_item_id, ingredient_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Conversation Logs (For analytics and improvement)
CREATE TABLE allergen_conversations (
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

-- 8. User Sessions (Track conversation context)
CREATE TABLE allergen_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  user_allergens TEXT[], -- Allergens mentioned in this session
  metadata JSONB -- Store additional context
);

-- ==========================================
-- INDEXES for Performance
-- ==========================================

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);
CREATE INDEX idx_ingredient_allergens_ingredient ON ingredient_allergens(ingredient_id);
CREATE INDEX idx_ingredient_allergens_allergen ON ingredient_allergens(allergen_type_id);
CREATE INDEX idx_menu_item_ingredients_menu ON menu_item_ingredients(menu_item_id);
CREATE INDEX idx_menu_item_ingredients_ingredient ON menu_item_ingredients(ingredient_id);
CREATE INDEX idx_conversations_session ON allergen_conversations(session_id);
CREATE INDEX idx_conversations_created ON allergen_conversations(created_at);
CREATE INDEX idx_sessions_last_activity ON allergen_sessions(last_activity_at);

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
  ('alcohol', 'アルコール', '🍷', 'mild', 'Alcoholic beverages and extracts', 'アルコール飲料およびエキス');

-- Insert menu categories
INSERT INTO menu_categories (name, name_ja, display_order) VALUES
  ('Appetizers', '前菜', 1),
  ('Main Course', 'メインディッシュ', 2),
  ('Desserts', 'デザート', 3),
  ('Beverages', '飲み物', 4);

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
  ('white wine', '白ワイン', 'Dry white wine');

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
   OR (i.name = 'white wine' AND a.name = 'alcohol');

-- Insert sample menu items
INSERT INTO menu_items (name, name_ja, category_id, description, description_ja, price_jpy, is_available)
SELECT
  'Caesar Salad',
  'シーザーサラダ',
  c.id,
  'Fresh romaine lettuce with parmesan and croutons',
  '新鮮なロメインレタスとパルメザンチーズ、クルトン',
  1200,
  true
FROM menu_categories c WHERE c.name = 'Appetizers';

INSERT INTO menu_items (name, name_ja, category_id, description, description_ja, price_jpy, is_available)
SELECT
  'Grilled Salmon',
  '焼きサーモン',
  c.id,
  'Fresh salmon with lemon butter sauce',
  'レモンバターソースの焼きサーモン',
  2800,
  true
FROM menu_categories c WHERE c.name = 'Main Course';

INSERT INTO menu_items (name, name_ja, category_id, description, description_ja, price_jpy, is_available)
SELECT
  'Shrimp Pasta',
  'エビパスタ',
  c.id,
  'Linguine with garlic shrimp in white wine sauce',
  'ガーリックシュリンプの白ワインソースパスタ',
  2400,
  true
FROM menu_categories c WHERE c.name = 'Main Course';

-- Link menu items to ingredients (simplified for sample)
-- Note: In production, manually curate 20-30 menu items with accurate ingredients

-- ==========================================
-- ROW LEVEL SECURITY (RLS) - OPTIONAL
-- ==========================================

-- Enable RLS if you want public read access but restricted write access
-- ALTER TABLE allergen_types ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Public read access (for AI receptionist queries)
-- CREATE POLICY "Allow public read access" ON menu_items FOR SELECT USING (true);
-- CREATE POLICY "Allow public read access" ON allergen_types FOR SELECT USING (true);

-- Restrict write to authenticated users only
-- CREATE POLICY "Allow authenticated write" ON menu_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- NOTES FOR AGENT
-- ==========================================

-- 1. Database Connection:
--    - Use EXISTING Supabase credentials from shift-schedule-manager-ortools
--    - Environment variables: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY
--    - Service key (for admin operations): SUPABASE_SERVICE_KEY

-- 2. Migration Strategy:
--    - Run this schema AFTER shift-schedule-manager tables are created
--    - These tables are INDEPENDENT (no foreign keys to shift scheduler tables)
--    - Safe to add without affecting existing application

-- 3. Data Curation:
--    - Start with 20-30 hotel-specific menu items
--    - Focus on dishes with clear allergen information
--    - Include Japanese names for authenticity
--    - Prioritize common allergens: gluten, dairy, shellfish, nuts

-- 4. Testing:
--    - Test queries with multiple allergens: "I'm allergic to shellfish and gluten"
--    - Test edge cases: "no allergens", "all allergens", "unlisted allergen"
--    - Verify Japanese text displays correctly

-- 5. Performance:
--    - Indexes are optimized for allergen queries
--    - Expected query time: <50ms for 20-30 items
--    - Scales to 100-200 items without performance issues
```

---

## 🛠️ Tech Stack Details

### Frontend: SvelteKit + TypeScript

**Why SvelteKit**:
1. ✅ **Exact NextBeat Match** - They use SvelteKit in production
2. ✅ **75% Smaller Bundle** - vs React (25KB vs 140KB)
3. ✅ **Compiler-based Reactivity** - No virtual DOM overhead
4. ✅ **Built-in TypeScript** - First-class TypeScript support
5. ✅ **Learning Demonstration** - "I learned their stack in 1 week"

**SvelteKit Learning Resources**:
- Official Tutorial: https://learn.svelte.dev/ (2-3 days)
- SvelteKit Docs: https://kit.svelte.dev/docs
- TypeScript + Svelte: https://svelte.dev/docs/typescript

**Project Structure** (Phase 1):
```
allergen-management-system/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Main menu display page
│   │   ├── +page.ts                  # Page load function
│   │   ├── admin/
│   │   │   └── +page.svelte          # Admin data entry form
│   │   └── api/
│   │       ├── menu-items/
│   │       │   └── +server.ts        # Menu items API proxy
│   │       └── allergens/
│   │           └── +server.ts        # Allergen filter API proxy
│   ├── lib/
│   │   ├── components/
│   │   │   ├── MenuItemCard.svelte   # Menu item display
│   │   │   ├── AllergenFilter.svelte # Filter UI component
│   │   │   └── MenuItemForm.svelte   # Data entry form
│   │   ├── stores/
│   │   │   └── menu.ts               # Menu state store
│   │   └── types/
│   │       └── allergen.ts           # TypeScript types
│   └── app.html
├── static/
├── svelte.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

### Backend: NestJS (TypeScript) - RECOMMENDED ✅

**Why NestJS over Scala**:
1. ✅ **Faster Development** - 3-5 days learning curve (vs 2-3 weeks for Scala)
2. ✅ **TypeScript Consistency** - Same language as frontend
3. ✅ **Still NextBeat Stack** - They list NestJS as desired skill
4. ✅ **Rich Ecosystem** - TypeORM, Swagger, testing built-in
5. ✅ **Interview Flexibility** - Can discuss both NestJS and Scala interest

**Alternative: Scala 3 + http4s** (Only if you want to invest 2-3 weeks):
- Shows functional programming skills
- Exact match with NextBeat backend
- More impressive but slower to implement

**NestJS Project Structure** (Phase 1):
```
allergen-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── menu/
│   │   ├── menu.module.ts
│   │   ├── menu.controller.ts
│   │   ├── menu.service.ts
│   │   └── dto/
│   │       ├── create-menu-item.dto.ts
│   │       ├── update-menu-item.dto.ts
│   │       └── filter-menu.dto.ts
│   ├── allergen/
│   │   ├── allergen.module.ts
│   │   ├── allergen.controller.ts
│   │   └── allergen.service.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   └── database.service.ts
│   └── entities/
│       ├── menu-item.entity.ts
│       ├── ingredient.entity.ts
│       ├── allergen-type.entity.ts
│       ├── menu-category.entity.ts
│       └── menu-item-ingredient.entity.ts
├── test/
├── nest-cli.json
├── tsconfig.json
└── package.json
```

**Key API Endpoints** (Phase 1):
```typescript
// Menu Management
GET    /api/menu-items              # Get all menu items
GET    /api/menu-items/:id          # Get single menu item
POST   /api/menu-items              # Create menu item
PUT    /api/menu-items/:id          # Update menu item
DELETE /api/menu-items/:id          # Delete menu item

// Allergen Filtering
GET    /api/menu-items/filter       # Filter by allergens
  Query params: ?exclude=shellfish,gluten

// Allergen Types
GET    /api/allergens               # Get all allergen types

// Categories
GET    /api/categories              # Get all menu categories
```

---

### Database: PostgreSQL (Existing Supabase)

**Connection Strategy**:
```typescript
// Use EXISTING Supabase instance
const supabaseUrl = process.env.SUPABASE_URL; // From shift-schedule-manager
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// NestJS configuration
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: `${supabaseUrl}/rest/v1/`, // Supabase REST API
      // OR direct PostgreSQL connection:
      // host: 'db.xxx.supabase.co',
      // port: 5432,
      // database: 'postgres',
      // username: 'postgres',
      // password: process.env.SUPABASE_DB_PASSWORD,
      entities: [MenuItem, Ingredient, AllergenType],
      synchronize: false, // Use migrations instead
    }),
  ],
})
```

**Migration Files**:
Create `database/migrations/001_allergen_schema.sql` with the schema above.


---

## 📝 Implementation Checklist (Phase 1: 1 Week)

### Day 1-2: Setup & Learning

**SvelteKit Learning**
- [ ] Complete Svelte tutorial (https://learn.svelte.dev/) - 4 hours
- [ ] Build simple todo app with Svelte - 2 hours
- [ ] Understand Svelte stores and reactivity - 1 hour
- [ ] Learn SvelteKit routing - 1 hour

**Database Setup**
- [ ] Copy Supabase credentials from shift-schedule-manager
- [ ] Run allergen schema migration (016_allergen_schema_for_ai_receptionist.sql)
- [ ] Verify tables created in Supabase dashboard
- [ ] Review sample data (10 allergens, 4 menu items)
- [ ] Test basic queries in Supabase SQL editor

---

### Day 3-4: Backend Development (NestJS)

**NestJS Setup**
- [ ] Initialize NestJS project: `nest new allergen-backend`
- [ ] Install dependencies: TypeORM, @supabase/supabase-js, class-validator
- [ ] Setup Supabase connection with TypeORM
- [ ] Create entities (MenuItem, Ingredient, AllergenType, MenuCategory)

**API Development**
- [ ] Create MenuModule with CRUD operations
- [ ] Create AllergenModule for filtering
- [ ] Implement GET /api/menu-items (list all)
- [ ] Implement GET /api/menu-items/filter?exclude=allergens
- [ ] Implement POST /api/menu-items (create)
- [ ] Implement PUT /api/menu-items/:id (update)
- [ ] Implement DELETE /api/menu-items/:id (delete)
- [ ] Implement GET /api/allergens (list allergen types)
- [ ] Test all endpoints with Postman/Thunder Client

---

### Day 5-6: Frontend Development (SvelteKit)

**SvelteKit Setup**
- [ ] Initialize SvelteKit project: `npm create svelte@latest allergen-management`
- [ ] Setup Tailwind CSS: `npx svelte-add@latest tailwindcss`
- [ ] Configure API proxy to NestJS backend

**UI Components**
- [ ] Create MenuItemCard component (display menu item with allergen icons)
- [ ] Create AllergenFilter component (checkbox filters)
- [ ] Create MenuItemList component (grid/list view)
- [ ] Create MenuItemForm component (add/edit menu items)

**Pages**
- [ ] Create main page (/) - Menu display with filters
- [ ] Create admin page (/admin) - Data entry form
- [ ] Implement state management with Svelte stores
- [ ] Connect to NestJS API

---

### Day 7: Testing & Polish

**Testing**
- [ ] Test allergen filtering (single allergen)
- [ ] Test allergen filtering (multiple allergens)
- [ ] Test data entry form (create menu item)
- [ ] Test edit/delete operations
- [ ] Test Japanese text display
- [ ] Test responsive design (mobile/desktop)

**Polish**
- [ ] Add loading states
- [ ] Add error handling and user feedback
- [ ] Improve UI styling with Tailwind
- [ ] Add allergen icons and colors
- [ ] Write README with setup instructions

---

### Optional (If Time Permits)

**Data Curation**
- [ ] Add 16-26 more menu items (target: 20-30 total)
- [ ] Verify allergen mappings accuracy
- [ ] Add ingredient details for all menu items

**Deployment** (Can be done later)
- [ ] Deploy backend to Fly.io/Railway
- [ ] Deploy frontend to Vercel
- [ ] Setup environment variables
- [ ] Test production deployment

---

## 🚀 Deployment Strategy

### Frontend: Vercel (FREE) ✅ RECOMMENDED

**Why Vercel**:
- ✅ FREE tier (Hobby plan)
- ✅ Optimized for SvelteKit
- ✅ Automatic deployments from GitHub
- ✅ Global CDN
- ✅ Zero configuration

**Deployment**:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd ai-receptionist-allergen
vercel --prod

# Or: Connect GitHub repository in Vercel dashboard
```

---

### Backend: Railway or Fly.io

**Option A: Railway** ($5-10/month)
- ✅ Easy NestJS deployment
- ✅ Managed PostgreSQL (not needed, using Supabase)
- ✅ Automatic HTTPS
- ✅ GitHub integration

**Option B: Fly.io** (FREE tier: 3 × 256MB VMs)
- ✅ FREE for small apps
- ✅ Docker-based deployment
- ✅ Global edge network
- ✅ CLI-based deployment

**Recommended: Fly.io (FREE)** ✅
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Initialize and deploy
cd ai-receptionist-backend
fly launch
fly deploy
```

---

### Database: Supabase (Existing, FREE tier)

**No additional cost** - Use existing Supabase instance from shift-schedule-manager.

**Connection String**:
```env
# Use these from shift-schedule-manager-ortools/.env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc... (for admin operations)
```

---

## 🎤 Interview Talking Points (Phase 1)

### 1. Tech Stack Alignment
> "I noticed NextBeat uses SvelteKit in production, so I implemented the Allergen Management System using SvelteKit + TypeScript instead of React. This demonstrates:
> - I researched your tech stack before applying
> - I can learn new frameworks quickly (learned SvelteKit in 1 week)
> - I'm immediately productive with your stack on day 1"

### 2. Data Quality Over Speed
> "I chose to manually curate allergen data instead of using a public API because:
> - Hotels serve custom recipes not found in generic databases like Open Food Facts
> - Allergen accuracy is critical for guest safety - a false negative could cause allergic reactions
> - This demonstrates my understanding that data quality matters more than implementation speed
> - It also shows I can design databases and data models from scratch"

### 3. Portfolio Breadth
> "I have 2 hospitality tech projects that showcase different skills:
>
> **Shift Scheduler** (6-month thesis, 17k LOC):
> - Mathematical optimization with Google OR-Tools
> - Hybrid Go + WebSocket + Python architecture
> - Reduced manual scheduling from 4-8 hours to 1-3 seconds
> - React + Go + Python OR-Tools
>
> **Allergen Management System** (1-week sprint):
> - Full-stack TypeScript (SvelteKit + NestJS)
> - Manual data curation for quality
> - RESTful API design with proper filtering
> - Learned SvelteKit specifically for NextBeat alignment"

### 4. Learning Agility
> "When I researched NextBeat's tech stack and saw SvelteKit, I had never used it before. Within 1 week I:
> - Completed the official Svelte tutorial
> - Built a production-ready menu management interface
> - Integrated with NestJS backend
> - Implemented complex allergen filtering logic
>
> This demonstrates I can quickly learn new technologies and be productive immediately."

### 5. Hospitality Domain Expertise
> "Both my projects solve real problems in the hospitality industry:
> - **Labor shortage** → Automated shift scheduling saves 4-8 hours/month
> - **Guest safety** → Allergen management system prevents allergic reactions
>
> This aligns perfectly with NextBeat's mission to solve Japan's demographic crisis through hospitality tech innovation."

### 6. Incremental Development
> "I built this in phases:
> - **Phase 1** (1 week): Database + CRUD API + Basic UI - Foundation for future features
> - **Phase 2** (Future): Add AI conversational interface with Claude API
>
> This shows I can deliver working software quickly while planning for future enhancements."

---

## 📊 Success Metrics (Phase 1)

### Technical Metrics
- [ ] Frontend bundle size: <100KB (SvelteKit target)
- [ ] API response time: <200ms (database query only)
- [ ] Database query time: <50ms (20-30 menu items)
- [ ] Filter accuracy: 100% (exact allergen matching)
- [ ] Test coverage: >70% (Basic CRUD tests)

### Portfolio Metrics
- [ ] 2 separate repositories on GitHub
- [ ] Clean README with setup instructions
- [ ] Working demo (local or deployed)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database schema documentation

### Learning Metrics
- [ ] SvelteKit proficiency: Build basic app in 1 week
- [ ] NestJS proficiency: Build REST API in 2-3 days
- [ ] TypeScript: Fully typed codebase
- [ ] PostgreSQL: Design normalized schema

---

## ⚠️ Common Pitfalls to Avoid (Phase 1)

### 1. Over-engineering
❌ **Don't**: Add AI chat, ML recommendations, user authentication, multi-language support
✅ **Do**: Focus on basic CRUD + filtering with clean implementation

### 2. Tech Stack Confusion
❌ **Don't**: Mix React components into SvelteKit project
✅ **Do**: Keep repositories completely separate, different tech stacks

### 3. Database Conflicts
❌ **Don't**: Modify existing shift-schedule-manager tables
✅ **Do**: Add NEW tables with clear naming (allergen_*, menu_*)

### 4. Poor Documentation
❌ **Don't**: Minimal README with just installation steps
✅ **Do**: Comprehensive docs with architecture, tech stack rationale, interview talking points

---

## 🔗 Related Documentation

### In This Repository
- `docs/AWS_COST_OPTIMIZATION_ANALYSIS.md` - Cost optimization for deployment
- `docs/NEXTBEAT_JOB_ALIGNMENT_ANALYSIS.md` - Job requirements analysis
- `docs/SVELTEKIT_IMPLEMENTATION_EXAMPLE.md` - Complete SvelteKit code examples

### External Resources
- SvelteKit Tutorial: https://learn.svelte.dev/
- NestJS Documentation: https://docs.nestjs.com/
- Claude API Docs: https://docs.anthropic.com/
- TypeORM Guide: https://typeorm.io/
- Supabase Docs: https://supabase.com/docs

---

## 📞 Agent Handoff Checklist

**Before Starting Implementation**:
- [ ] Read this entire guideline document
- [ ] Review `docs/NEXTBEAT_JOB_ALIGNMENT_ANALYSIS.md`
- [ ] Review `docs/SVELTEKIT_IMPLEMENTATION_EXAMPLE.md`
- [ ] Verify Supabase credentials from shift-schedule-manager
- [ ] Confirm separate repository strategy with user

**During Implementation**:
- [ ] Follow tech stack exactly (SvelteKit + NestJS, NOT React)
- [ ] Use existing Supabase, add new tables only
- [ ] Manually curate 20-30 menu items (quality over API)
- [ ] Write comprehensive tests
- [ ] Document all architecture decisions

**After Implementation**:
- [ ] Deploy to Vercel (frontend) + Fly.io (backend)
- [ ] Write detailed README with setup instructions
- [ ] Create architecture diagrams
- [ ] Test end-to-end user flow
- [ ] Prepare demo for interview

---

## ✅ Final Deliverables (Phase 1)

### Repository: `allergen-management-system`
1. **SvelteKit Frontend** - Menu display interface with filtering
2. **NestJS Backend** - REST API with CRUD operations
3. **Database Schema** - PostgreSQL migration (016_allergen_schema_for_ai_receptionist.sql)
4. **Documentation** - README with setup instructions, API documentation
5. **Tests** - Basic CRUD tests (NestJS)
6. **Sample Data** - 20-30 hotel menu items with accurate allergen info

### Interview Assets
1. **Portfolio URLs** - 2 projects (shift scheduler + allergen management)
2. **GitHub Repositories** - 2 separate repos with clean commit history
3. **Talking Points Document** - Emphasize learning agility and tech stack match
4. **Database Design** - Showcase normalized schema design skills
5. **NextBeat Alignment** - SvelteKit + NestJS + TypeScript

### Future Enhancements (Phase 2 - Optional)
- [ ] Add conversational AI interface (Claude API)
- [ ] Implement natural language allergen extraction
- [ ] Add chat UI components
- [ ] Add session management and conversation logging
- [ ] Deploy to production (Vercel + Fly.io)

---

**End of Guideline Document (Phase 1)**

**Version**: 2.0 (Phase 1: Initial Setup)
**Last Updated**: 2025-01-31
**Author**: Claude Code (Anthropic)
**Target Agent**: Next implementation agent for Allergen Management System
**Scope**: Phase 1 only - Database + CRUD + Basic UI (NO AI integration yet)
