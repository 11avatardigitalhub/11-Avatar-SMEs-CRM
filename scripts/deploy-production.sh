#!/bin/bash
# ============================================================
# 11 AVATAR DIGITAL HUB - Production Deployment Script
# Enterprise-grade deployment automation with rollback capability
# Version: 2.0.0
# Author: 11 Avatar Digital Hub
# License: GPL-3.0
# ============================================================
# Usage: ./deploy-production.sh [--force] [--skip-tests] [--skip-backup] [--dry-run]
# ============================================================

set -euo pipefail

# ============================================================
# CONFIGURATION
# ============================================================

# Project Information
PROJECT_NAME="11-avatar-digital-hub"
PROJECT_ID="avatar-wa-dual-crm"
REPO_URL="https://github.com/11avatardigitalhub/lead2revenue.git"
PRODUCTION_BRANCH="main"
DEPLOY_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Firebase Configuration
FIREBASE_PROJECT="avatar-wa-dual-crm"
FIREBASE_PROJECT_ALIAS="production"
FIREBASE_TOKEN_FILE="${HOME}/.firebase/token.json"

# Cloudflare Workers Configuration
WORKER_NAME="11avatar-api"
WORKER_ROUTE="11avatar-api.11avatardigitalhub.cloud/*"
WORKERS_DIR="./workers"

# Deployment Paths
BUILD_DIR="./dist"
DEPLOY_DIR="./deploy"
BACKUP_DIR="./backups"
LOG_DIR="./logs"
LOG_FILE="${LOG_DIR}/deploy-${DEPLOY_TIMESTAMP}.log"
ROLLBACK_MANIFEST="${BACKUP_DIR}/rollback-manifest.json"

# Build Configuration
NODE_VERSION="20.x"
BUILD_ENV="production"
MINIFY_ENABLED=true
SOURCE_MAPS_ENABLED=false
BUNDLE_ANALYZER_ENABLED=false

# Testing Configuration
RUN_TESTS=true
TEST_TIMEOUT=300
MIN_TEST_COVERAGE=80

# Health Check Configuration
HEALTH_CHECK_URL="https://11avatardigitalhub.github.io/lead2revenue/"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=5
HEALTH_CHECK_TIMEOUT=120

# Notification Configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"
ENABLE_NOTIFICATIONS=true

# Color Codes for Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

# Print colored log messages with timestamp
log() {
    local level=$1
    local message=$2
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    local color=""
    
    case $level in
        INFO)    color=$BLUE ;;
        SUCCESS) color=$GREEN ;;
        WARNING) color=$YELLOW ;;
        ERROR)   color=$RED ;;
        STEP)    color=$PURPLE ;;
    esac
    
    echo -e "${color}[${timestamp}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE"
}

# Print section header
section() {
    echo -e "\n${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}\n"
    log "STEP" "$1"
}

# Print success message
success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS" "$1"
}

# Print error message and exit
error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    log "ERROR" "$1"
    
    # Send failure notification
    if [ "$ENABLE_NOTIFICATIONS" = true ]; then
        send_notification "failure" "$1"
    fi
    
    # Attempt rollback on critical errors
    if [ "${2:-false}" = "critical" ]; then
        log "WARNING" "Attempting rollback due to critical error..."
        perform_rollback
    fi
    
    exit 1
}

# Print warning message
warn() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    log "WARNING" "$1"
}

# Print info message
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO" "$1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required dependencies
check_dependencies() {
    section "Checking Dependencies"
    
    local missing_deps=()
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node -v)
        info "Node.js: $node_version"
    else
        missing_deps+=("node")
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=$(npm -v)
        info "npm: v$npm_version"
    else
        missing_deps+=("npm")
    fi
    
    # Check git
    if command_exists git; then
        local git_version=$(git --version)
        info "Git: $git_version"
    else
        missing_deps+=("git")
    fi
    
    # Check Firebase CLI
    if command_exists firebase; then
        local firebase_version=$(firebase --version)
        info "Firebase CLI: $firebase_version"
    else
        missing_deps+=("firebase-tools")
    fi
    
    # Check Wrangler (Cloudflare Workers)
    if command_exists wrangler; then
        local wrangler_version=$(wrangler --version)
        info "Wrangler: $wrangler_version"
    else
        warn "Wrangler not found - Cloudflare Workers deployment will be skipped"
    fi
    
    # Check jq for JSON processing
    if command_exists jq; then
        info "jq: available"
    else
        missing_deps+=("jq")
    fi
    
    # Report missing dependencies
    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing dependencies: ${missing_deps[*]}. Please install them first." "critical"
    fi
    
    success "All required dependencies are available"
}

# Create required directories
create_directories() {
    section "Creating Directory Structure"
    
    local dirs=("$BUILD_DIR" "$DEPLOY_DIR" "$BACKUP_DIR" "$LOG_DIR")
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            info "Created directory: $dir"
        fi
    done
    
    success "Directory structure ready"
}

# Initialize log file
init_logging() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
    fi
    
    touch "$LOG_FILE"
    info "Log file: $LOG_FILE"
}

# ============================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================

# Check if running on correct branch
check_branch() {
    section "Checking Git Branch"
    
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    info "Current branch: $current_branch"
    
    if [ "$current_branch" != "$PRODUCTION_BRANCH" ]; then
        warn "Not on $PRODUCTION_BRANCH branch. Current: $current_branch"
        
        # Check if force flag is set
        if [ "${FORCE_DEPLOY:-false}" = true ]; then
            warn "Force deploy enabled - proceeding anyway"
        else
            error "Deployment must be from '$PRODUCTION_BRANCH' branch. Use --force to override." "critical"
        fi
    fi
    
    success "Branch check passed"
}

# Check for uncommitted changes
check_uncommitted_changes() {
    section "Checking Working Directory"
    
    if [ -n "$(git status --porcelain)" ]; then
        warn "Uncommitted changes detected:"
        git status --short | while read line; do
            echo -e "  ${YELLOW}$line${NC}"
        done
        
        if [ "${FORCE_DEPLOY:-false}" = true ]; then
            warn "Force deploy enabled - proceeding with uncommitted changes"
        else
            error "Working directory is not clean. Commit or stash changes first." "critical"
        fi
    else
        success "Working directory is clean"
    fi
}

# Pull latest changes from remote
pull_latest_changes() {
    section "Pulling Latest Changes"
    
    info "Fetching from remote..."
    git fetch origin "$PRODUCTION_BRANCH"
    
    info "Pulling latest changes..."
    if git pull origin "$PRODUCTION_BRANCH"; then
        success "Latest changes pulled successfully"
    else
        error "Failed to pull latest changes from origin/$PRODUCTION_BRANCH" "critical"
    fi
}

# ============================================================
# BUILD PROCESS
# ============================================================

# Install dependencies
install_dependencies() {
    section "Installing Dependencies"
    
    if [ -f "package-lock.json" ]; then
        info "Running npm ci for clean install..."
        npm ci --production=false
    else
        info "Running npm install..."
        npm install
    fi
    
    # Install Firebase Functions dependencies
    if [ -d "functions" ]; then
        info "Installing Firebase Functions dependencies..."
        cd functions && npm ci --production=false && cd ..
    fi
    
    success "Dependencies installed successfully"
}

# Run tests before deployment
run_predeploy_tests() {
    section "Running Pre-Deployment Tests"
    
    if [ "${SKIP_TESTS:-false}" = true ]; then
        warn "Tests skipped via --skip-tests flag"
        return 0
    fi
    
    info "Running unit tests..."
    if npm test -- --timeout="$TEST_TIMEOUT" 2>&1 | tee -a "$LOG_FILE"; then
        success "All unit tests passed"
    else
        error "Unit tests failed. Fix failing tests before deploying." "critical"
    fi
    
    # Run E2E tests
    info "Running E2E tests..."
    if npm run test:e2e -- --timeout="$TEST_TIMEOUT" 2>&1 | tee -a "$LOG_FILE"; then
        success "All E2E tests passed"
    else
        error "E2E tests failed. Fix failing tests before deploying." "critical"
    fi
    
    # Check test coverage
    if [ -f "coverage/coverage-summary.json" ]; then
        local coverage=$(jq '.total.lines.pct' coverage/coverage-summary.json)
        info "Code coverage: ${coverage}%"
        
        if (( $(echo "$coverage < $MIN_TEST_COVERAGE" | bc -l) )); then
            warn "Coverage ${coverage}% is below minimum ${MIN_TEST_COVERAGE}%"
        fi
    fi
    
    success "All pre-deployment tests passed"
}

# Build the application
build_application() {
    section "Building Application"
    
    info "Cleaning previous build..."
    rm -rf "$BUILD_DIR"
    
    info "Setting environment to $BUILD_ENV..."
    export NODE_ENV="$BUILD_ENV"
    
    info "Building application bundles..."
    if npm run build 2>&1 | tee -a "$LOG_FILE"; then
        success "Application built successfully"
    else
        error "Build failed. Check logs for details." "critical"
    fi
    
    # Verify build output
    if [ -d "$BUILD_DIR" ]; then
        local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
        info "Build size: $build_size"
        
        local file_count=$(find "$BUILD_DIR" -type f | wc -l)
        info "Build files: $file_count"
    else
        error "Build directory not found after build" "critical"
    fi
    
    success "Build completed and verified"
}

# Run bundle analyzer (optional)
run_bundle_analyzer() {
    if [ "$BUNDLE_ANALYZER_ENABLED" = true ]; then
        section "Bundle Analysis"
        info "Generating bundle analysis report..."
        npm run analyze 2>&1 | tee -a "$LOG_FILE" || warn "Bundle analysis failed (non-critical)"
    fi
}

# ============================================================
# BACKUP PROCESS
# ============================================================

# Create backup of current deployment
create_backup() {
    section "Creating Backup"
    
    if [ "${SKIP_BACKUP:-false}" = true ]; then
        warn "Backup skipped via --skip-backup flag"
        return 0
    fi
    
    local backup_name="backup-${DEPLOY_TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    info "Creating backup: $backup_name"
    mkdir -p "$backup_path"
    
    # Backup current build if exists
    if [ -d "$DEPLOY_DIR" ]; then
        cp -r "$DEPLOY_DIR" "$backup_path/deploy" 2>/dev/null || true
    fi
    
    # Backup Firebase config
    if [ -f "firebase.json" ]; then
        cp firebase.json "$backup_path/"
    fi
    if [ -f ".firebaserc" ]; then
        cp .firebaserc "$backup_path/"
    fi
    
    # Backup Cloudflare Worker config
    if [ -f "wrangler.toml" ]; then
        cp wrangler.toml "$backup_path/"
    fi
    
    # Create rollback manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "backup_name": "$backup_name",
    "timestamp": "$DEPLOY_TIMESTAMP",
    "branch": "$(git rev-parse --abbrev-ref HEAD)",
    "commit": "$(git rev-parse HEAD)",
    "commit_message": "$(git log -1 --pretty=%B | head -1)",
    "build_env": "$BUILD_ENV",
    "node_version": "$(node -v)",
    "created_by": "${USER:-unknown}"
}
EOF

    # Update rollback manifest
    echo "$backup_name" > "$ROLLBACK_MANIFEST"
    
    # Clean old backups (keep last 5)
    local backup_count=$(ls -1 "$BACKUP_DIR" | wc -l)
    if [ "$backup_count" -gt 5 ]; then
        info "Cleaning old backups (keeping last 5)..."
        ls -1t "$BACKUP_DIR" | tail -n +6 | while read old_backup; do
            rm -rf "${BACKUP_DIR}/${old_backup}"
            info "Removed old backup: $old_backup"
        done
    fi
    
    success "Backup created: $backup_name"
}

# ============================================================
# DEPLOYMENT PROCESS
# ============================================================

# Deploy to Firebase Hosting
deploy_firebase_hosting() {
    section "Deploying Firebase Hosting"
    
    info "Authenticating with Firebase..."
    if [ -f "$FIREBASE_TOKEN_FILE" ]; then
        export FIREBASE_TOKEN=$(cat "$FIREBASE_TOKEN_FILE")
        info "Using Firebase token from file"
    fi
    
    # Verify Firebase project
    info "Verifying Firebase project: $FIREBASE_PROJECT"
    firebase use "$FIREBASE_PROJECT" --token "${FIREBASE_TOKEN:-}" 2>&1 | tee -a "$LOG_FILE"
    
    # Deploy hosting
    info "Deploying to Firebase Hosting..."
    if firebase deploy --only hosting --project "$FIREBASE_PROJECT" \
        --token "${FIREBASE_TOKEN:-}" \
        --message "Production deployment: $DEPLOY_TIMESTAMP" 2>&1 | tee -a "$LOG_FILE"; then
        success "Firebase Hosting deployed successfully"
    else
        error "Firebase Hosting deployment failed" "critical"
    fi
}

# Deploy Firebase Functions
deploy_firebase_functions() {
    section "Deploying Firebase Functions"
    
    if [ ! -d "functions" ]; then
        warn "No Firebase Functions directory found - skipping"
        return 0
    fi
    
    info "Deploying Firebase Cloud Functions..."
    if firebase deploy --only functions --project "$FIREBASE_PROJECT" \
        --token "${FIREBASE_TOKEN:-}" \
        --force 2>&1 | tee -a "$LOG_FILE"; then
        success "Firebase Functions deployed successfully"
    else
        error "Firebase Functions deployment failed" "critical"
    fi
}

# Deploy Firestore Rules
deploy_firestore_rules() {
    section "Deploying Firestore Rules"
    
    if [ -f "firestore.rules" ]; then
        info "Deploying Firestore security rules..."
        if firebase deploy --only firestore:rules --project "$FIREBASE_PROJECT" \
            --token "${FIREBASE_TOKEN:-}" 2>&1 | tee -a "$LOG_FILE"; then
            success "Firestore rules deployed successfully"
        else
            error "Firestore rules deployment failed" "critical"
        fi
    else
        warn "No firestore.rules file found - skipping"
    fi
}

# Deploy Firestore Indexes
deploy_firestore_indexes() {
    section "Deploying Firestore Indexes"
    
    if [ -f "firestore.indexes.json" ]; then
        info "Deploying Firestore indexes..."
        if firebase deploy --only firestore:indexes --project "$FIREBASE_PROJECT" \
            --token "${FIREBASE_TOKEN:-}" 2>&1 | tee -a "$LOG_FILE"; then
            success "Firestore indexes deployed successfully"
        else
            error "Firestore indexes deployment failed" "critical"
        fi
    else
        warn "No firestore.indexes.json file found - skipping"
    fi
}

# Deploy Cloudflare Worker
deploy_cloudflare_worker() {
    section "Deploying Cloudflare Worker"
    
    if ! command_exists wrangler; then
        warn "Wrangler not available - skipping Cloudflare Worker deployment"
        return 0
    fi
    
    if [ ! -f "wrangler.toml" ]; then
        warn "No wrangler.toml found - skipping Worker deployment"
        return 0
    fi
    
    info "Deploying Cloudflare Worker: $WORKER_NAME"
    if wrangler deploy --env production 2>&1 | tee -a "$LOG_FILE"; then
        success "Cloudflare Worker deployed successfully"
    else
        error "Cloudflare Worker deployment failed" "critical"
    fi
}

# Deploy database migrations
deploy_database_migrations() {
    section "Running Database Migrations"
    
    if [ -d "database/migrations" ]; then
        info "Running database migrations..."
        for migration in database/migrations/*.sql; do
            if [ -f "$migration" ]; then
                info "Applying migration: $(basename $migration)"
                # Execute migration via Cloud SQL proxy or similar
                # This should be customized based on actual database setup
                warn "Database migration execution needs configuration"
            fi
        done
    else
        info "No database migrations found"
    fi
}

# ============================================================
# POST-DEPLOYMENT
# ============================================================

# Health check after deployment
perform_health_check() {
    section "Performing Health Check"
    
    info "Checking deployed application health..."
    
    local retries=0
    
    while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" | grep -q "200\|301\|302"; then
            success "Health check passed (HTTP 200/301/302)"
            return 0
        fi
        
        retries=$((retries + 1))
        info "Health check attempt $retries/$HEALTH_CHECK_RETRIES failed - retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep "$HEALTH_CHECK_INTERVAL"
    done
    
    error "Health check failed after $HEALTH_CHECK_RETRIES attempts" "critical"
}

# Verify critical API endpoints
verify_api_endpoints() {
    section "Verifying API Endpoints"
    
    local api_base="https://11avatar-api.11avatardigitalhub.workers.dev"
    local endpoints=(
        "/api/health"
        "/api/auth/status"
        "/api/clients?limit=1"
    )
    
    for endpoint in "${endpoints[@]}"; do
        info "Verifying: $endpoint"
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "${api_base}${endpoint}" 2>/dev/null || echo "000")
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "401" ]; then
            info "  Endpoint ${endpoint}: ${status_code} OK"
        else
            warn "  Endpoint ${endpoint}: ${status_code} - may need attention"
        fi
    done
}

# Clear CDN cache if applicable
clear_cdn_cache() {
    section "Clearing CDN Cache"
    
    # Firebase Hosting auto-deploys with cache busting
    # Additional CDN cache clearing can be added here
    info "Firebase Hosting handles cache automatically"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2
    local commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local commit_msg=$(git log -1 --pretty=%B 2>/dev/null | head -1 || echo "unknown")
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local slack_color="good"
        local slack_emoji="✅"
        
        if [ "$status" = "failure" ]; then
            slack_color="danger"
            slack_emoji="❌"
        fi
        
        local slack_payload=$(cat << EOF
{
    "attachments": [{
        "color": "$slack_color",
        "title": "${slack_emoji} Production Deployment: ${status^^}",
        "fields": [
            { "title": "Project", "value": "$PROJECT_NAME", "short": true },
            { "title": "Commit", "value": "$commit_hash", "short": true },
            { "title": "Message", "value": "$commit_msg", "short": false },
            { "title": "Timestamp", "value": "$DEPLOY_TIMESTAMP", "short": true },
            { "title": "Details", "value": "$message", "short": false }
        ],
        "footer": "11 Avatar Digital Hub - Automated Deployment"
    }]
}
EOF
)
        curl -s -X POST -H 'Content-Type: application/json' \
            -d "$slack_payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    
    # Email notification
    if [ -n "$NOTIFY_EMAIL" ]; then
        echo "Deployment $status: $message" | \
            mail -s "[${status^^}] $PROJECT_NAME Deployment - $DEPLOY_TIMESTAMP" \
            "$NOTIFY_EMAIL" 2>/dev/null || true
    fi
}

# ============================================================
# ROLLBACK
# ============================================================

perform_rollback() {
    section "Performing Rollback"
    
    if [ ! -f "$ROLLBACK_MANIFEST" ]; then
        error "No rollback manifest found - cannot rollback" "critical"
    fi
    
    local last_backup=$(cat "$ROLLBACK_MANIFEST")
    local rollback_path="${BACKUP_DIR}/${last_backup}"
    
    if [ ! -d "$rollback_path" ]; then
        error "Rollback backup not found: $rollback_path" "critical"
    fi
    
    warn "Rolling back to: $last_backup"
    
    # Restore deploy directory
    if [ -d "$rollback_path/deploy" ]; then
        rm -rf "$DEPLOY_DIR"
        cp -r "$rollback_path/deploy" "$DEPLOY_DIR"
        info "Restored deploy directory"
    fi
    
    # Restore Firebase config
    if [ -f "$rollback_path/firebase.json" ]; then
        cp "$rollback_path/firebase.json" ./
        info "Restored firebase.json"
    fi
    
    # Re-deploy from rollback
    warn "Re-deploying from rollback state..."
    deploy_firebase_hosting
    deploy_firebase_functions
    
    success "Rollback completed to: $last_backup"
}

# ============================================================
# CLEANUP
# ============================================================

cleanup() {
    section "Cleanup"
    
    info "Cleaning up temporary files..."
    rm -rf /tmp/deploy-* 2>/dev/null || true
    
    # Rotate logs (keep last 30)
    local log_count=$(ls -1 "$LOG_DIR" | wc -l)
    if [ "$log_count" -gt 30 ]; then
        ls -1t "$LOG_DIR" | tail -n +31 | while read old_log; do
            rm -f "${LOG_DIR}/${old_log}"
        done
        info "Rotated old log files"
    fi
    
    success "Cleanup completed"
}

# ============================================================
# MAIN DEPLOYMENT FLOW
# ============================================================

main() {
    # Parse command line arguments
    FORCE_DEPLOY=false
    SKIP_TESTS=false
    SKIP_BACKUP=false
    DRY_RUN=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force) FORCE_DEPLOY=true; shift ;;
            --skip-tests) SKIP_TESTS=true; shift ;;
            --skip-backup) SKIP_BACKUP=true; shift ;;
            --dry-run) DRY_RUN=true; shift ;;
            *) error "Unknown argument: $1"; exit 1 ;;
        esac
    done
    
    # Initialize
    init_logging
    create_directories
    
    echo -e "${BOLD}${CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  11 AVATAR DIGITAL HUB - PRODUCTION DEPLOYMENT          ║"
    echo "║  Version: 2.0.0                                         ║"
    echo "║  Timestamp: $DEPLOY_TIMESTAMP                           ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "INFO" "Starting production deployment"
    log "INFO" "Force deploy: $FORCE_DEPLOY"
    log "INFO" "Skip tests: $SKIP_TESTS"
    log "INFO" "Skip backup: $SKIP_BACKUP"
    log "INFO" "Dry run: $DRY_RUN"
    
    # Pre-deployment phase
    check_dependencies
    check_branch
    check_uncommitted_changes
    pull_latest_changes
    
    # Build phase
    install_dependencies
    run_predeploy_tests
    build_application
    run_bundle_analyzer
    
    # Backup phase
    create_backup
    
    # If dry run, stop here
    if [ "$DRY_RUN" = true ]; then
        section "DRY RUN COMPLETE"
        info "Dry run completed successfully - no changes were deployed"
        info "Build artifacts are in: $BUILD_DIR"
        exit 0
    fi
    
    # Deployment phase
    deploy_firebase_hosting
    deploy_firebase_functions
    deploy_firestore_rules
    deploy_firestore_indexes
    deploy_cloudflare_worker
    deploy_database_migrations
    
    # Post-deployment phase
    perform_health_check
    verify_api_endpoints
    clear_cdn_cache
    
    # Success notification
    if [ "$ENABLE_NOTIFICATIONS" = true ]; then
        send_notification "success" "Deployment completed successfully at $DEPLOY_TIMESTAMP"
    fi
    
    # Cleanup
    cleanup
    
    # Final success message
    echo -e "\n${GREEN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  ✅ PRODUCTION DEPLOYMENT SUCCESSFUL                    ║"
    echo "║  Timestamp: $DEPLOY_TIMESTAMP                           ║"
    echo "║  Project: $PROJECT_NAME                                 ║"
    echo "║  Environment: PRODUCTION                                ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "SUCCESS" "Production deployment completed successfully"
}

# Run main function with all arguments
main "$@"
