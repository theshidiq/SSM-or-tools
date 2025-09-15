#!/bin/bash

# Phase 2.6: Testing Suite - Test runner script

echo "=== Phase 2 Real-time State Synchronization Test Suite ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
TIMEOUT=60s
VERBOSE=${VERBOSE:-false}

# Function to run a test with timeout and capture output
run_test() {
    local test_name=$1
    local test_file=$2

    echo -e "${YELLOW}Running $test_name...${NC}"

    if [ "$VERBOSE" = "true" ]; then
        timeout $TIMEOUT go test -v ./$test_file
    else
        timeout $TIMEOUT go test ./$test_file
    fi

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name PASSED${NC}"
        return 0
    elif [ $exit_code -eq 124 ]; then
        echo -e "${RED}✗ $test_name TIMEOUT (exceeded $TIMEOUT)${NC}"
        return 1
    else
        echo -e "${RED}✗ $test_name FAILED (exit code: $exit_code)${NC}"
        return 1
    fi
}

# Change to the test directory
cd "$(dirname "$0")"

# Initialize module if needed (for Go modules)
if [ ! -f "../go.mod" ]; then
    echo "Initializing Go module..."
    cd ..
    go mod init shift-schedule-manager/go-server
    go mod tidy
    cd tests
fi

echo "=== Unit Tests ==="
echo ""

# Track test results
passed_tests=0
total_tests=0

# Run StateManager tests
total_tests=$((total_tests + 1))
if run_test "StateManager Tests" "state_manager_test.go"; then
    passed_tests=$((passed_tests + 1))
fi
echo ""

# Run ConflictResolver tests
total_tests=$((total_tests + 1))
if run_test "ConflictResolver Tests" "conflict_resolver_test.go"; then
    passed_tests=$((passed_tests + 1))
fi
echo ""

# Run ClientManager tests
total_tests=$((total_tests + 1))
if run_test "ClientManager Tests" "client_manager_test.go"; then
    passed_tests=$((passed_tests + 1))
fi
echo ""

echo "=== Integration Tests ==="
echo ""

# Run Integration tests
total_tests=$((total_tests + 1))
if run_test "Integration Tests" "integration_test.go"; then
    passed_tests=$((passed_tests + 1))
fi
echo ""

# Summary
echo "=== Test Summary ==="
echo "Tests passed: $passed_tests/$total_tests"
echo ""

if [ $passed_tests -eq $total_tests ]; then
    echo -e "${GREEN}🎉 All tests passed! Phase 2 implementation is ready.${NC}"
    exit 0
else
    failed_tests=$((total_tests - passed_tests))
    echo -e "${RED}❌ $failed_tests test(s) failed. Please review and fix issues.${NC}"
    exit 1
fi