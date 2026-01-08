#!/bin/bash

################################################################################
# PromoFinder Docker Build Test Script
################################################################################
# Tests that all Docker images build successfully
# Usage: ./scripts/test-docker-build.sh
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         PromoFinder Docker Build Test                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    echo "Install from: https://docker.com"
    exit 1
fi

if ! docker info &> /dev/null; then
    log_error "Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

log_success "Docker is available and running"
echo ""

# Test 1: Build backend image
log_info "Building backend Docker image..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker build -f infrastructure/docker/Dockerfile.backend -t promo-finder-backend:test . 2>&1 | tail -20; then
    log_success "Backend image built successfully"

    # Get image size
    IMAGE_SIZE=$(docker images promo-finder-backend:test --format "{{.Size}}")
    log_info "Backend image size: $IMAGE_SIZE"
else
    log_error "Backend image build failed"
    exit 1
fi

echo ""

# Test 2: Build frontend image
log_info "Building frontend Docker image..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker build -f infrastructure/docker/Dockerfile.frontend -t promo-finder-frontend:test . 2>&1 | tail -20; then
    log_success "Frontend image built successfully"

    # Get image size
    IMAGE_SIZE=$(docker images promo-finder-frontend:test --format "{{.Size}}")
    log_info "Frontend image size: $IMAGE_SIZE"
else
    log_error "Frontend image build failed"
    exit 1
fi

echo ""

# Test 3: List built images
log_info "Docker images built:"
docker images | grep "promo-finder"

echo ""

# Test 4: Test docker-compose config
log_info "Validating docker-compose configuration..."

if docker-compose -f infrastructure/docker/docker-compose.yml config > /dev/null 2>&1; then
    log_success "docker-compose.yml is valid"
else
    log_error "docker-compose.yml has errors"
    exit 1
fi

echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Docker Build Test Complete                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "All Docker images built successfully"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Start full stack with Docker Compose:"
echo "  $ docker-compose -f infrastructure/docker/docker-compose.yml up"
echo ""
echo "  Or start individual services:"
echo "  $ docker-compose -f infrastructure/docker/docker-compose.yml up backend"
echo "  $ docker-compose -f infrastructure/docker/docker-compose.yml up frontend"
echo ""
echo "  Clean up test images:"
echo "  $ docker rmi promo-finder-backend:test promo-finder-frontend:test"
echo ""
