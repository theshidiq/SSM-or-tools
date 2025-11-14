#!/bin/bash

# Research Web Application - Quick Setup Script
# This script helps you set up the research application

echo "🚀 Research Web Application - Setup Script"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Creating .env file from template..."

    cat > .env << EOF
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here

# Add your actual Supabase credentials above
EOF

    echo "✅ .env file created!"
    echo "⚠️  Please update it with your actual Supabase credentials"
    echo ""
fi

# Check Node modules
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed!"
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "📊 Setup Checklist:"
echo "==================="
echo ""

# Check Supabase credentials
if grep -q "your-project.supabase.co" .env 2>/dev/null; then
    echo "⚠️  [ ] Update Supabase credentials in .env file"
else
    echo "✅ [✓] Supabase credentials configured"
fi

# Check if migration file exists
if [ -f "supabase/migrations/20251031000000_create_survey_responses.sql" ]; then
    echo "✅ [✓] Database migration file exists"
    echo "⚠️  [ ] Apply migration in Supabase Dashboard"
else
    echo "❌ [ ] Database migration file not found"
fi

# Check if research components exist
if [ -f "src/components/research/ResearchPage.jsx" ]; then
    echo "✅ [✓] Research components installed"
else
    echo "❌ [ ] Research components not found"
fi

# Check if React Router is installed
if grep -q "react-router-dom" package.json; then
    echo "✅ [✓] React Router installed"
else
    echo "❌ [ ] React Router not installed"
fi

# Check if Recharts is installed
if grep -q "recharts" package.json; then
    echo "✅ [✓] Recharts installed"
else
    echo "❌ [ ] Recharts not installed"
fi

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo ""
echo "1. Update .env with your Supabase credentials:"
echo "   - REACT_APP_SUPABASE_URL"
echo "   - REACT_APP_SUPABASE_ANON_KEY"
echo ""
echo "2. Apply database migration:"
echo "   - Open Supabase Dashboard"
echo "   - Go to SQL Editor"
echo "   - Copy contents of: supabase/migrations/20251031000000_create_survey_responses.sql"
echo "   - Paste and run the SQL"
echo ""
echo "3. Start the development server:"
echo "   npm start"
echo ""
echo "4. Access the research page:"
echo "   http://localhost:3000/research"
echo ""
echo "📚 Documentation:"
echo "================="
echo "- Complete Guide: research/IMPLEMENTATION-GUIDE.md"
echo "- Overview: RESEARCH-APP-COMPLETE.md"
echo "- Survey Questions: research/questionnaire.md"
echo "- Visual Comparisons: research/visual-comparison.md"
echo "- Analysis Methods: research/analysis-framework.md"
echo ""
echo "✨ Happy researching! ✨"
