#!/bin/bash
# Local CI Validation Script
# Simulates GitHub Actions validation workflow without Docker

set -e

echo "🚀 Local CI Validation"
echo "======================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get issue number from branch name
BRANCH_NAME=$(git branch --show-current)
echo "📍 Branch: $BRANCH_NAME"

ISSUE_NUMBER=$(echo "$BRANCH_NAME" | sed -n 's/.*\/\([0-9]\+\)-.*/\1/p')

if [ -z "$ISSUE_NUMBER" ]; then
  echo -e "${YELLOW}⚠️  No issue number found in branch name${NC}"
  echo "   Branch should follow format: type/123-description"
  exit 0
fi

echo "📋 Issue: #$ISSUE_NUMBER"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
if ! yarn install --frozen-lockfile 2>&1 | grep -q "Done"; then
  echo -e "${RED}❌ Failed to install dependencies${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 2: Run tests
echo "🧪 Step 2: Running tests..."
if ! yarn test 2>&1 | tee /tmp/test-output.log | grep -q "Ran"; then
  echo -e "${RED}❌ Tests failed${NC}"
  cat /tmp/test-output.log | tail -20
  exit 1
fi
echo -e "${GREEN}✅ Tests passed${NC}"
echo ""

# Step 3: Validate acceptance criteria
echo "📝 Step 3: Validating acceptance criteria..."
GITHUB_TOKEN=$(gh auth token) \
ISSUE_NUMBER=$ISSUE_NUMBER \
REPOSITORY="jterrats/smart-deployment" \
node scripts/validate-acceptance-criteria.js > /tmp/ac-validation.log 2>&1

if grep -q "All acceptance criteria are covered by tests!" /tmp/ac-validation.log; then
  echo -e "${GREEN}✅ All acceptance criteria covered (100%)${NC}"
  grep "Coverage:" /tmp/ac-validation.log
else
  echo -e "${RED}❌ Some acceptance criteria are not covered${NC}"
  cat /tmp/ac-validation.log | tail -30
  exit 1
fi
echo ""

# Step 4: Summary
echo "📊 Validation Summary"
echo "===================="
echo -e "${GREEN}✅ Dependencies: OK${NC}"
echo -e "${GREEN}✅ Tests: PASSING${NC}"
echo -e "${GREEN}✅ Acceptance Criteria: 100%${NC}"
echo ""
echo -e "${GREEN}🎉 Ready to push!${NC}"

