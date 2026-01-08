#!/bin/bash

################################################################################
# PromoFinder Development Environment Setup Script
################################################################################
# This script sets up the complete development environment in one command
# Usage: ./scripts/setup-dev.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track setup time
START_TIME=$(date +%s)

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

check_command() {
    if command -v "$1" &> /dev/null; then
        log_success "$1 is installed"
        return 0
    else
        log_error "$1 is not installed"
        return 1
    fi
}

################################################################################
# Main Setup
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         PromoFinder Development Environment Setup              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check prerequisites
log_info "Checking prerequisites..."

PREREQUISITES_OK=true

if ! check_command "node"; then
    log_error "Node.js is required. Install from: https://nodejs.org/"
    PREREQUISITES_OK=false
fi

if ! check_command "npm"; then
    log_error "npm is required (usually comes with Node.js)"
    PREREQUISITES_OK=false
fi

if ! check_command "docker"; then
    log_warning "Docker is recommended for full setup. Install from: https://docker.com/"
    log_info "Continuing without Docker (database services won't be available)"
else
    if ! docker info &> /dev/null; then
        log_warning "Docker is installed but not running. Please start Docker Desktop."
    else
        log_success "Docker is running"
    fi
fi

if ! check_command "git"; then
    log_error "Git is required"
    PREREQUISITES_OK=false
fi

if [ "$PREREQUISITES_OK" = false ]; then
    log_error "Please install missing prerequisites and try again"
    exit 1
fi

echo ""

# Step 2: Create .env file if it doesn't exist
log_info "Setting up environment variables..."

if [ ! -f ".env" ]; then
    log_info "Creating .env file from .env.example..."
    cp .env.example .env
    log_success "Created .env file"
    log_warning "Please edit .env and add your API keys"
else
    log_success ".env file already exists"
fi

if [ ! -f ".env.development" ]; then
    log_warning ".env.development not found - using defaults"
fi

echo ""

# Step 3: Install backend dependencies
log_info "Installing backend dependencies..."
cd backend

if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

log_success "Backend dependencies installed"
cd ..

echo ""

# Step 4: Install frontend dependencies
log_info "Installing frontend dependencies..."
cd frontend

if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

log_success "Frontend dependencies installed"
cd ..

echo ""

# Step 5: Set up Docker services (if Docker is available)
if command -v docker &> /dev/null && docker info &> /dev/null; then
    log_info "Setting up Docker services (PostgreSQL + Redis)..."

    # Check if docker-compose file exists
    if [ -f "infrastructure/docker/docker-compose.yml" ]; then
        log_info "Starting Docker services..."
        docker-compose -f infrastructure/docker/docker-compose.yml up -d postgres redis

        log_info "Waiting for services to be ready..."
        sleep 10

        # Check if PostgreSQL is ready
        if docker-compose -f infrastructure/docker/docker-compose.yml exec -T postgres pg_isready -U promofinder &> /dev/null; then
            log_success "PostgreSQL is ready"
        else
            log_warning "PostgreSQL might not be ready yet. Give it a few more seconds."
        fi

        # Check if Redis is ready
        if docker-compose -f infrastructure/docker/docker-compose.yml exec -T redis redis-cli ping &> /dev/null; then
            log_success "Redis is ready"
        else
            log_warning "Redis might not be ready yet. Give it a few more seconds."
        fi
    else
        log_warning "docker-compose.yml not found at infrastructure/docker/docker-compose.yml"
        log_info "You can start services manually with: docker-compose up"
    fi
else
    log_warning "Skipping Docker setup (Docker not available)"
    log_info "You'll need to set up PostgreSQL and Redis manually"
fi

echo ""

# Step 6: Create necessary directories
log_info "Creating necessary directories..."

mkdir -p backend/cache
mkdir -p backend/data
mkdir -p backend/logs

log_success "Directories created"

echo ""

# Step 7: Verify setup
log_info "Verifying setup..."

# Check backend
if [ -d "backend/node_modules" ]; then
    log_success "Backend dependencies verified"
else
    log_error "Backend dependencies missing"
fi

# Check frontend
if [ -d "frontend/node_modules" ]; then
    log_success "Frontend dependencies verified"
else
    log_error "Frontend dependencies missing"
fi

# Check .env
if [ -f ".env" ]; then
    log_success "Environment configuration verified"
else
    log_error ".env file missing"
fi

echo ""

# Step 8: Display next steps
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "Development environment setup completed in ${DURATION} seconds"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. Edit .env and add your API keys (if not done already)"
echo ""
echo "  2. Start the development servers:"
echo ""
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "     Option A - With Docker (Full stack):"
    echo "     $ docker-compose -f infrastructure/docker/docker-compose.yml up"
    echo ""
    echo "     Option B - Manual (Backend + Frontend separately):"
fi
echo "     Backend:  cd backend && npm run dev"
echo "     Frontend: cd frontend && npm run dev"
echo ""
echo "  3. Access the application:"
echo "     Frontend: http://localhost:3000"
echo "     Backend:  http://localhost:3001"
echo "     Health:   http://localhost:3001/health"
echo ""
echo "  4. Run health check:"
echo "     $ ./scripts/health-check.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "For production deployment, see: README-deployment.md"
echo ""
