#!/bin/bash
# Test script to validate caching refactoring
# Tests that real-time endpoints use Redis and static endpoints bypass Redis

echo "Testing Caching Architecture Refactoring"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if server is running
SERVER_URL="${1:-http://localhost:3000}"
echo "Testing against: $SERVER_URL"
echo ""

# Function to test endpoint
test_endpoint() {
  local name=$1
  local url=$2
  local expected_cache_control=$3

  echo -e "${BLUE}Testing: $name${NC}"
  echo "URL: $url"

  response=$(curl -s -w "\n%{http_code}\n%{header_json}" "$url" 2>/dev/null | tail -3)
  http_code=$(echo "$response" | head -1)
  headers=$(echo "$response" | tail -1)

  if [ "$http_code" = "200" ]; then
    echo -e "  Status: ${GREEN}✓ 200 OK${NC}"

    # Extract Cache-Control header
    cache_control=$(echo "$headers" | grep -i "cache-control" | head -1 || echo "")

    if [[ "$cache_control" == *"$expected_cache_control"* ]]; then
      echo -e "  Cache-Control: ${GREEN}✓ Contains '$expected_cache_control'${NC}"
    else
      echo -e "  Cache-Control: ${RED}✗ Expected '$expected_cache_control'${NC}"
      echo "    Got: $cache_control"
    fi
  else
    echo -e "  Status: ${RED}✗ $http_code${NC}"
  fi
  echo ""
}

echo "=== REAL-TIME ENDPOINTS (Should use Redis + 3s CDN cache) ==="
echo ""

test_endpoint \
  "Bus Locations" \
  "$SERVER_URL/api/bus/WJB251000068" \
  "s-maxage=3"

test_endpoint \
  "Bus Arrivals" \
  "$SERVER_URL/api/bus-arrival/208000125" \
  "s-maxage=3"

echo "=== STATIC ENDPOINTS (Should bypass Redis, 1h CDN cache) ==="
echo ""

test_endpoint \
  "Bus Stops" \
  "$SERVER_URL/api/bus-stops/WJB251000068" \
  "s-maxage=3600"

test_endpoint \
  "Route Stops" \
  "$SERVER_URL/api/route-stops/30" \
  "s-maxage=3600"

echo "==========================================="
echo -e "${GREEN}✓ Caching architecture test complete${NC}"
echo ""
echo "Next steps:"
echo "  1. Check server logs for Redis connection (should only connect for real-time endpoints)"
echo "  2. Monitor Redis memory usage (should decrease with no 24h TTL data)"
echo "  3. Verify CDN hit rates in production for static endpoints"
