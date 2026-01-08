#!/bin/bash

################################################################################
# PromoFinder Database Backup Script
################################################################################
# Creates timestamped backups of the PostgreSQL database
# Usage: ./scripts/backup-db.sh [environment]
# Example: ./scripts/backup-db.sh production
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
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="promofinder_${ENVIRONMENT}_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Database URLs
case $ENVIRONMENT in
    "local")
        DATABASE_URL=${DATABASE_URL:-"postgresql://promofinder:promofinder_dev_password@localhost:5432/promofinder"}
        ;;
    "staging")
        if [ -z "$RAILWAY_STAGING_DATABASE_URL" ]; then
            echo -e "${RED}✗${NC} RAILWAY_STAGING_DATABASE_URL not set"
            echo "Set it with: export RAILWAY_STAGING_DATABASE_URL=<your_database_url>"
            exit 1
        fi
        DATABASE_URL=$RAILWAY_STAGING_DATABASE_URL
        ;;
    "production")
        if [ -z "$RAILWAY_PRODUCTION_DATABASE_URL" ]; then
            echo -e "${RED}✗${NC} RAILWAY_PRODUCTION_DATABASE_URL not set"
            echo "Set it with: export RAILWAY_PRODUCTION_DATABASE_URL=<your_database_url>"
            exit 1
        fi
        DATABASE_URL=$RAILWAY_PRODUCTION_DATABASE_URL
        ;;
    *)
        echo -e "${RED}✗${NC} Invalid environment: $ENVIRONMENT"
        echo "Valid environments: local, staging, production"
        exit 1
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

################################################################################
# Main Backup Process
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         PromoFinder Database Backup ($ENVIRONMENT)             "
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump not found. Please install PostgreSQL client tools."
    echo ""
    echo "Installation:"
    echo "  macOS:   brew install postgresql"
    echo "  Ubuntu:  sudo apt-get install postgresql-client"
    echo "  Windows: Download from https://www.postgresql.org/download/windows/"
    exit 1
fi

# Create backup directory
log_info "Creating backup directory..."
mkdir -p "$BACKUP_DIR"
log_success "Backup directory ready: $BACKUP_DIR"

# Confirm production backup
if [ "$ENVIRONMENT" = "production" ]; then
    echo ""
    log_warning "You are about to backup the PRODUCTION database"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Backup cancelled"
        exit 0
    fi
fi

# Perform backup
echo ""
log_info "Starting database backup..."
log_info "Environment: $ENVIRONMENT"
log_info "Backup file: $BACKUP_FILE"
echo ""

if pg_dump "$DATABASE_URL" > "$BACKUP_PATH" 2>&1; then
    log_success "Backup completed successfully!"

    # Get file size
    if command -v du &> /dev/null; then
        FILE_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
        log_info "Backup size: $FILE_SIZE"
    fi

    # Compress backup
    log_info "Compressing backup..."
    if gzip "$BACKUP_PATH"; then
        COMPRESSED_PATH="${BACKUP_PATH}.gz"
        COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
        log_success "Backup compressed: ${COMPRESSED_SIZE}"
        FINAL_BACKUP="$COMPRESSED_PATH"
    else
        log_warning "Compression failed, keeping uncompressed backup"
        FINAL_BACKUP="$BACKUP_PATH"
    fi
else
    log_error "Backup failed!"
    exit 1
fi

echo ""

# Backup information
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backup Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Environment:  $ENVIRONMENT"
echo "  Backup file:  $FINAL_BACKUP"
echo "  Timestamp:    $TIMESTAMP"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Restore Instructions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  To restore this backup:"
echo ""
if [[ $FINAL_BACKUP == *.gz ]]; then
    echo "    gunzip -c $FINAL_BACKUP | psql \$DATABASE_URL"
else
    echo "    psql \$DATABASE_URL < $FINAL_BACKUP"
fi
echo ""
echo "  Or using Docker:"
if [[ $FINAL_BACKUP == *.gz ]]; then
    echo "    gunzip -c $FINAL_BACKUP | docker exec -i promo-finder-db psql -U promofinder"
else
    echo "    docker exec -i promo-finder-db psql -U promofinder < $FINAL_BACKUP"
fi
echo ""

# Cleanup old backups (keep last 10)
log_info "Cleaning up old backups (keeping last 10)..."
ls -t "$BACKUP_DIR"/promofinder_${ENVIRONMENT}_*.sql* 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/promofinder_${ENVIRONMENT}_*.sql* 2>/dev/null | wc -l)
log_success "Total backups for $ENVIRONMENT: $BACKUP_COUNT"

echo ""
log_success "Backup process complete!"
echo ""
