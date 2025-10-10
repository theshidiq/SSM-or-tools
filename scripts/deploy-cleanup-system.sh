#!/bin/bash
#
# Deploy Soft-Delete Cleanup System
# Usage: ./scripts/deploy-cleanup-system.sh [--dry-run]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Soft-Delete Cleanup System Deployment Script          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if dry-run mode
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Step 1: Check prerequisites
echo -e "${GREEN}Step 1: Checking prerequisites...${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✓ Supabase CLI installed${NC}"

# Check if PostgreSQL client is available (optional)
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL client installed${NC}"
    PSQL_AVAILABLE=true
else
    echo -e "${YELLOW}⚠ PostgreSQL client not found (will use Supabase SQL Editor)${NC}"
    PSQL_AVAILABLE=false
fi

# Check environment variables
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    source "$PROJECT_ROOT/.env"
    echo -e "${GREEN}✓ Environment variables loaded${NC}"
else
    echo -e "${YELLOW}⚠ .env file not found${NC}"
fi

echo ""

# Step 2: Deploy database migration
echo -e "${GREEN}Step 2: Deploying database migration...${NC}"

MIGRATION_FILE="$PROJECT_ROOT/database/migrations/utilities/011_soft_delete_cleanup_system.sql"

if [[ ! -f "$MIGRATION_FILE" ]]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo "Migration file: $MIGRATION_FILE"

if [[ "$DRY_RUN" == false ]]; then
    if [[ "$PSQL_AVAILABLE" == true ]] && [[ ! -z "$DATABASE_URL" ]]; then
        echo "Applying migration via psql..."
        psql "$DATABASE_URL" -f "$MIGRATION_FILE"
        echo -e "${GREEN}✓ Database migration applied${NC}"
    else
        echo -e "${YELLOW}Please apply the migration manually:${NC}"
        echo "1. Open Supabase Dashboard → SQL Editor"
        echo "2. Copy contents of: $MIGRATION_FILE"
        echo "3. Execute the SQL"
        echo ""
        read -p "Press Enter when migration is applied..."
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would apply: $MIGRATION_FILE${NC}"
fi

echo ""

# Step 3: Deploy Edge Function
echo -e "${GREEN}Step 3: Deploying Edge Function...${NC}"

EDGE_FUNCTION_DIR="$PROJECT_ROOT/supabase/functions/cleanup-soft-deleted-groups"

if [[ ! -d "$EDGE_FUNCTION_DIR" ]]; then
    echo -e "${RED}❌ Edge Function directory not found: $EDGE_FUNCTION_DIR${NC}"
    exit 1
fi

if [[ "$DRY_RUN" == false ]]; then
    echo "Deploying cleanup-soft-deleted-groups function..."
    cd "$PROJECT_ROOT"
    supabase functions deploy cleanup-soft-deleted-groups
    echo -e "${GREEN}✓ Edge Function deployed${NC}"
else
    echo -e "${YELLOW}[DRY RUN] Would deploy: cleanup-soft-deleted-groups${NC}"
fi

echo ""

# Step 4: Configure cron schedule
echo -e "${GREEN}Step 4: Configuring cron schedule...${NC}"

echo "Recommended cron schedule: 0 2 * * * (2:00 AM UTC daily)"
echo ""
echo -e "${YELLOW}Manual configuration required:${NC}"
echo "1. Open Supabase Dashboard → Edge Functions"
echo "2. Select: cleanup-soft-deleted-groups"
echo "3. Enable 'Cron Triggers'"
echo "4. Set schedule: 0 2 * * *"
echo ""

if [[ "$DRY_RUN" == false ]]; then
    read -p "Press Enter when cron is configured..."
    echo -e "${GREEN}✓ Cron schedule configured${NC}"
else
    echo -e "${YELLOW}[DRY RUN] Would prompt for cron configuration${NC}"
fi

echo ""

# Step 5: Verify deployment
echo -e "${GREEN}Step 5: Verifying deployment...${NC}"

if [[ "$DRY_RUN" == false ]]; then
    echo "Testing Edge Function with dry-run..."

    if [[ ! -z "$SUPABASE_URL" ]] && [[ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        FUNCTION_URL="${SUPABASE_URL}/functions/v1/cleanup-soft-deleted-groups"

        RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d '{"dry_run": true}')

        echo "Response: $RESPONSE"

        if echo "$RESPONSE" | grep -q '"success":true'; then
            echo -e "${GREEN}✓ Edge Function test successful${NC}"
        else
            echo -e "${RED}❌ Edge Function test failed${NC}"
            echo "Response: $RESPONSE"
        fi
    else
        echo -e "${YELLOW}⚠ Cannot test - SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would test Edge Function${NC}"
fi

echo ""

# Step 6: Summary
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Deployment Complete!                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ "$DRY_RUN" == false ]]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify database functions:"
    echo "   SELECT * FROM preview_groups_for_cleanup();"
    echo ""
    echo "2. Test dry-run cleanup:"
    echo "   SELECT * FROM cleanup_soft_deleted_staff_groups(true, 30);"
    echo ""
    echo "3. Monitor Edge Function logs:"
    echo "   supabase functions logs cleanup-soft-deleted-groups --tail"
    echo ""
    echo "4. Review documentation:"
    echo "   docs/SOFT_DELETE_CLEANUP_GUIDE.md"
else
    echo -e "${YELLOW}This was a dry run. Run without --dry-run to deploy.${NC}"
fi

echo ""
echo "Documentation: $PROJECT_ROOT/docs/SOFT_DELETE_CLEANUP_GUIDE.md"
echo ""
