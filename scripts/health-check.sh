#!/bin/bash

################################################################################
# PromoFinder Health Check Script
################################################################################
# Verifies that all services are running correctly
# Usage: ./scripts/health-check.sh [environment]
# Example: ./scripts/health-check.sh production
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-local}
BACKEND_URL=${BACKEND_URL:-http://localhost:3001}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}

# Override for different environments
case $ENVIRONMENT in
    "staging")
        BACKEND_URL=${RAILWAY_STAGING_URL:-https://staging-api.promofinder.app}
        FRONTEND_URL=${FRONTEND_STAGING_URL:-https://staging.promofinder.app}
        ;;
    "production")
        BACKEND_URL=${RAILWAY_PRODUCTION_URL:-https://api.promofinder.app}
        FRONTEND_URL=${FRONTEND_PRODUCTION_URL:-https://promofinder.app}
        ;;
esac

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

check_http_endpoint() {
    local url=$1
    local name=$2
    local max_time=${3:-5}

    log_info "Checking $name at $url..."

    if response=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" --max-time "$max_time" "$url" 2>&1); then
        http_code=$(echo "$response" | cut -d'|' -f1)
        time_total=$(echo "$response" | cut -d'|' -f2)

        if [ "$http_code" -eq 200 ]; then
            time_ms=$(echo "$time_total * 1000" | bc)
            log_success "$name is healthy (HTTP $http_code, ${time_ms}ms)"
            return 0
        else
            log_error "$name returned HTTP $http_code"
            return 1
        fi
    else
        log_error "$name is unreachable"
        return 1
    fi
}

check_json_endpoint() {
    local url=$1
    local name=$2

    log_info "Checking $name endpoint..."

    if response=$(curl -s --max-time 10 "$url" 2>&1); then
        if echo "$response" | jq . &> /dev/null; then
            log_success "$name returned valid JSON"

            # Extract and display relevant info
            if status=$(echo "$response" | jq -r '.status' 2>/dev/null); then
                if [ "$status" != "null" ]; then
                    log_info "  Status: $status"
                fi
            fi

            if count=$(echo "$response" | jq -r '.dealsCount // .count' 2>/dev/null); then
                if [ "$count" != "null" ]; then
                    log_info "  Deals count: $count"
                fi
            fi

            return 0
        else
            log_error "$name returned invalid JSON"
            echo "$response" | head -n 3
            return 1
        fi
    else
        log_error "$name request failed"
        return 1
    fi
}

check_docker_service() {
    local service=$1

    if command -v docker &> /dev/null; then
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            log_success "Docker service '$service' is running"
            return 0
        else
            log_warning "Docker service '$service' is not running"
            return 1
        fi
    else
        log_info "Docker not available, skipping service check"
        return 0
    fi
}

################################################################################
# Main Health Checks
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         PromoFinder Health Check ($ENVIRONMENT)                "
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

OVERALL_STATUS=0

# Check 1: Backend Health Endpoint
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! check_http_endpoint "$BACKEND_URL/health" "Backend health endpoint" 10; then
    OVERALL_STATUS=1
fi

if ! check_json_endpoint "$BACKEND_URL/health" "Backend health details"; then
    OVERALL_STATUS=1
fi

echo ""

# Check 2: Backend API Endpoints
if ! check_http_endpoint "$BACKEND_URL/api/deals" "Deals API" 10; then
    OVERALL_STATUS=1
fi

if ! check_http_endpoint "$BACKEND_URL/api/stats" "Stats API" 10; then
    OVERALL_STATUS=1
fi

echo ""

# Check 3: Frontend (if not in CI)
if [ "$ENVIRONMENT" = "local" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Frontend Service"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if ! check_http_endpoint "$FRONTEND_URL" "Frontend" 5; then
        log_warning "Frontend might not be running (this is okay if testing backend only)"
    fi
    echo ""
fi

# Check 4: Docker Services (local only)
if [ "$ENVIRONMENT" = "local" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Docker Services"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    check_docker_service "promo-finder-db" || true
    check_docker_service "promo-finder-redis" || true
    check_docker_service "promo-finder-backend" || true

    echo ""
fi

# Check 5: Response Time Test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Performance Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log_info "Testing API response times..."

for i in {1..3}; do
    if time_total=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$BACKEND_URL/health" 2>&1); then
        time_ms=$(echo "$time_total * 1000" | bc)

        if (( $(echo "$time_total < 0.1" | bc -l) )); then
            log_success "Request $i: ${time_ms}ms (excellent)"
        elif (( $(echo "$time_total < 0.5" | bc -l) )); then
            log_success "Request $i: ${time_ms}ms (good)"
        elif (( $(echo "$time_total < 2.0" | bc -l) )); then
            log_warning "Request $i: ${time_ms}ms (acceptable)"
        else
            log_error "Request $i: ${time_ms}ms (slow)"
            OVERALL_STATUS=1
        fi
    else
        log_error "Request $i: failed"
        OVERALL_STATUS=1
    fi
done

echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
if [ $OVERALL_STATUS -eq 0 ]; then
    echo "║                 ✓ All Health Checks Passed                    ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    log_success "System is healthy and operational"
else
    echo "║                 ✗ Some Health Checks Failed                   ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    log_error "System has issues that need attention"
fi

echo ""

# Exit with status
exit $OVERALL_STATUS
