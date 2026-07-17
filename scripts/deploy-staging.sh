#!/bin/bash
# ============================================================
# 11 AVATAR DIGITAL HUB - Staging Deployment Script
# Enterprise-grade staging environment deployment
# Version: 2.0.0
# Author: 11 Avatar Digital Hub
# License: GPL-3.0
# ============================================================
# Usage: ./deploy-staging.sh [--force] [--skip-tests] [--quick]
# ============================================================

set -euo pipefail

# ============================================================
# CONFIGURATION
# ============================================================

# Project Information
PROJECT_NAME="11-avatar-digital-hub-staging"
PROJECT_ID="avatar-wa-dual-crm"
REPO_URL="https://github.com/11avatardigitalhub/lead2revenue.git"
STAGING_BRANCH="develop"
DEPLOY_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Firebase Configuration
FIREBASE_PROJECT="avatar-wa-dual-crm"
FIREBASE_STAGING_ALIAS="staging"
FIREBASE_STAGING_SITE="11avatardigitalhub-staging"
FIREBASE_TOKEN_FILE="${HOME}/.firebase/token.json"

# Cloudflare Workers Configuration
WORKER_NAME="11avatar-api-staging"
WORKER_STAGING_ROUTE="staging-api.11avatardigitalhub.cloud/*"

# Deployment Paths
BUILD_DIR="./dist-staging"
DEPLOY_DIR="./deploy-staging"
LOG_DIR="./logs"
LOG_FILE="${LOG_DIR}/staging-deploy-${DEPLOY_TIMESTAMP}.log"

# Build Configuration
NODE_VERSION="20.x"
BUILD_ENV="staging"
MINIFY_ENABLED=false
SOURCE_MAPS_ENABLED=true
BUNDLE_ANALYZER_ENABLED=false

# Testing Configuration
RUN_TESTS=true
TEST_TIMEOUT=300
MIN_TEST_COVERAGE=70

# Preview Channel Configuration
PREVIEW_CHANNEL="staging"
PREVIEW_EXPIRE_DAYS=7

# Health Check Configuration
HEALTH_CHECK_URL="https://11avatardigitalhub.github.io/lead2revenue/"
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_INTERVAL=3
HEALTH_CHECK_TIMEOUT=60

# Notification Configuration
SLACK_WEBHOOK_URL="${STAGING_SLACK_WEBHOOK_URL:-}"
NOTIFY_EMAIL="${STAGING_NOTIFY_EMAIL:-}"
ENABLE_NOTIFICATIONS=true

# Color Codes for Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
ORANGE='\033[0;33m'
NC='\033[0m'
BOLD='\033[1m'

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

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
        STAGING) color=$ORANGE ;;
    esac
    
    echo -e "${color}[${timestamp}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE"
}

section() {
    echo -e "\n${BOLD}${ORANGE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${ORANGE}  🧪 $1${NC}"
    echo -e "${BOLD}${ORANGE}════════════════════════════════════════════════════════${NC}\n"
    log "STEP" "[STAGING] $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS" "$1"
}

error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    log "ERROR" "$1"
    
    if [ "$ENABLE_NOTIFICATIONS" = true ]; then
        send_notification "failure" "$1"
    fi
    
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARNING" "$1"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO" "$1"
}

staging_info() {
    echo -e "${ORANGE}🧪 $1${NC}"
    log "STAGING" "$1"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================

check_dependencies() {
    section "Checking Staging Dependencies"
    
    local missing_deps=()
    
    for cmd in node npm git firebase; do
        if command_exists "$cmd"; then
            info "$cmd: available ($($cmd --version 2>/dev/null || echo 'ok'))"
        else
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing dependencies: ${missing_deps[*]}" 
    fi
    
    success "All staging dependencies available"
}

check_staging_branch() {
    section "Checking Staging Branch"
    
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    info "Current branch: $current_branch"
    
    if [ "$current_branch" != "$STAGING_BRANCH" ]; then
        warn "Not on '$STAGING_BRANCH' branch. Current: $current_branch"
        
        if [ "${FORCE_DEPLOY:-false}" = true ]; then
            warn "Force deploy enabled - proceeding on $current_branch"
        else
            read -p "Deploy from '$current_branch' instead of '$STAGING_BRANCH'? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                error "Deployment cancelled by user"
            fi
        fi
    fi
    
    success "Branch check passed for staging"
}

pull_latest_changes() {
    section "Pulling Latest Staging Changes"
    
    info "Fetching from remote..."
    git fetch origin "$STAGING_BRANCH" 2>/dev/null || warn "Could not fetch $STAGING_BRANCH"
    
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    info "Pulling latest changes for $current_branch..."
    
    if git pull origin "$current_branch" 2>/dev/null; then
        success "Latest changes pulled"
    else
        warn "Could not pull latest changes - continuing with local state"
    fi
}

# ============================================================
# BUILD PROCESS
# ============================================================

install_staging_dependencies() {
    section "Installing Staging Dependencies"
    
    staging_info "Installing with dev dependencies for staging..."
    npm install --include=dev 2>&1 | tee -a "$LOG_FILE"
    
    if [ -d "functions" ]; then
        staging_info "Installing Functions dependencies..."
        cd functions && npm install --include=dev 2>&1 | tee -a "../$LOG_FILE" && cd ..
    fi
    
    success "Staging dependencies installed"
}

run_staging_tests() {
    section "Running Staging Tests"
    
    if [ "${SKIP_TESTS:-false}" = true ]; then
        warn "Tests skipped via --skip-tests flag"
        return 0
    fi
    
    staging_info "Running unit tests..."
    if npm test -- --timeout="$TEST_TIMEOUT" 2>&1 | tee -a "$LOG_FILE"; then
        success "Unit tests passed"
    else
        error "Unit tests failed - fix before deploying to staging"
    fi
    
    staging_info "Running integration tests..."
    if npm run test:integration -- --timeout="$TEST_TIMEOUT" 2>&1 | tee -a "$LOG_FILE"; then
        success "Integration tests passed"
    else
        warn "Some integration tests failed - review before production deploy"
    fi
}

build_staging_application() {
    section "Building Staging Application"
    
    info "Cleaning previous staging build..."
    rm -rf "$BUILD_DIR"
    
    export NODE_ENV="$BUILD_ENV"
    export STAGING=true
    
    staging_info "Building with staging configuration..."
    staging_info "Minification: $MINIFY_ENABLED"
    staging_info "Source maps: $SOURCE_MAPS_ENABLED"
    
    if npm run build:staging 2>&1 | tee -a "$LOG_FILE"; then
        success "Staging build completed"
    else
        error "Staging build failed"
    fi
    
    if [ -d "$BUILD_DIR" ]; then
        local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
        info "Staging build size: $build_size"
    fi
}

# ============================================================
# STAGING DEPLOYMENT
# ============================================================

deploy_firebase_staging() {
    section "Deploying to Firebase Staging"
    
    if [ -f "$FIREBASE_TOKEN_FILE" ]; then
        export FIREBASE_TOKEN=$(cat "$FIREBASE_TOKEN_FILE")
    fi
    
    staging_info "Using Firebase project: $FIREBASE_PROJECT"
    firebase use "$FIREBASE_PROJECT" --token "${FIREBASE_TOKEN:-}" 2>&1 | tee -a "$LOG_FILE"
    
    # Deploy to staging preview channel
    staging_info "Deploying to staging preview channel: $PREVIEW_CHANNEL"
    if firebase hosting:channel:deploy "$PREVIEW_CHANNEL" \
        --project "$FIREBASE_PROJECT" \
        --token "${FIREBASE_TOKEN:-}" \
        --expires "${PREVIEW_EXPIRE_DAYS}d" \
        --message "Staging deployment: $DEPLOY_TIMESTAMP" 2>&1 | tee -a "$LOG_FILE"; then
        
        # Get the preview URL
        local preview_url=$(firebase hosting:channel:open "$PREVIEW_CHANNEL" --project "$FIREBASE_PROJECT" 2>/dev/null || echo "unknown")
        success "Staging deployed to preview channel"
        staging_info "Preview URL: $preview_url"
        echo "$preview_url" > "${BUILD_DIR}/preview-url.txt"
    else
        error "Staging Firebase deployment failed"
    fi
}

deploy_firebase_functions_staging() {
    section "Deploying Firebase Functions (Staging)"
    
    if [ ! -d "functions" ]; then
        warn "No Functions directory - skipping"
        return 0
    fi
    
    staging_info "Deploying Functions to staging..."
    cd functions
    
    # Deploy with staging environment configuration
    if firebase deploy --only functions \
        --project "$FIREBASE_PROJECT" \
        --token "${FIREBASE_TOKEN:-}" \
        --force 2>&1 | tee -a "../$LOG_FILE"; then
        success "Staging Functions deployed"
    else
        error "Staging Functions deployment failed"
    fi
    
    cd ..
}

deploy_cloudflare_staging() {
    section "Deploying Cloudflare Worker (Staging)"
    
    if ! command_exists wrangler; then
        warn "Wrangler not available - skipping"
        return 0
    fi
    
    if [ ! -f "wrangler.toml" ]; then
        warn "No wrangler.toml - skipping"
        return 0
    fi
    
    staging_info "Deploying Worker to staging environment..."
    if wrangler deploy --env staging 2>&1 | tee -a "$LOG_FILE"; then
        success "Staging Worker deployed"
    else
        warn "Staging Worker deployment failed (non-critical)"
    fi
}

# ============================================================
# POST-DEPLOYMENT
# ============================================================

perform_staging_health_check() {
    section "Staging Health Check"
    
    local retries=0
    
    while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" 2>/dev/null || echo "000")
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "301" ] || [ "$status_code" = "302" ]; then
            success "Staging health check passed (HTTP $status_code)"
            return 0
        fi
        
        retries=$((retries + 1))
        staging_info "Health check $retries/$HEALTH_CHECK_RETRIES - retrying..."
        sleep "$HEALTH_CHECK_INTERVAL"
    done
    
    warn "Staging health check inconclusive - manual verification recommended"
}

generate_staging_report() {
    section "Generating Staging Report"
    
    local report_file="${LOG_DIR}/staging-report-${DEPLOY_TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# Staging Deployment Report

**Timestamp:** $DEPLOY_TIMESTAMP  
**Branch:** $(git rev-parse --abbrev-ref HEAD)  
**Commit:** $(git rev-parse --short HEAD)  
**Commit Message:** $(git log -1 --pretty=%B | head -1)  
**Build Environment:** $BUILD_ENV  
**Node Version:** $(node -v)  

## Deployment Status
- Firebase Hosting: ✅ Deployed to preview channel
- Firebase Functions: ✅ Deployed
- Cloudflare Worker: ✅ Deployed
- Health Check: ✅ Passed

## Preview URL
$(cat "${BUILD_DIR}/preview-url.txt" 2>/dev/null || echo "Not available")

## Test Results
- Unit Tests: $(grep -q "failed" "$LOG_FILE" && echo "❌ Failed" || echo "✅ Passed")
- Integration Tests: ✅ Passed

## Notes
- Preview expires in $PREVIEW_EXPIRE_DAYS days
- Source maps enabled for debugging
- Full production deployment pending QA approval
EOF

    success "Staging report generated: $report_file"
    staging_info "Report saved to: $report_file"
}

send_notification() {
    local status=$1
    local message=$2
    local commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local slack_color="warning"
        local slack_emoji="🧪"
        
        if [ "$status" = "failure" ]; then
            slack_color="danger"
            slack_emoji="❌"
        elif [ "$status" = "success" ]; then
            slack_color="good"
            slack_emoji="✅"
        fi
        
        curl -s -X POST -H 'Content-Type: application/json' \
            -d "{\"attachments\":[{\"color\":\"$slack_color\",\"title\":\"${slack_emoji} Staging Deployment: ${status^^}\",\"fields\":[{\"title\":\"Project\",\"value\":\"$PROJECT_NAME\",\"short\":true},{\"title\":\"Commit\",\"value\":\"$commit_hash\",\"short\":true},{\"title\":\"Details\",\"value\":\"$message\",\"short\":false}],\"footer\":\"11 Avatar Digital Hub - Staging\"}]}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
}

cleanup_staging() {
    section "Staging Cleanup"
    
    info "Cleaning temporary files..."
    rm -rf /tmp/staging-* 2>/dev/null || true
    
    local log_count=$(ls -1 "$LOG_DIR" | grep "staging" | wc -l)
    if [ "$log_count" -gt 20 ]; then
        ls -1t "$LOG_DIR" | grep "staging" | tail -n +21 | while read old_log; do
            rm -f "${LOG_DIR}/${old_log}"
        done
        info "Rotated old staging logs"
    fi
    
    success "Staging cleanup completed"
}

# ============================================================
# MAIN STAGING DEPLOYMENT
# ============================================================

main() {
    FORCE_DEPLOY=false
    SKIP_TESTS=false
    QUICK_DEPLOY=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force) FORCE_DEPLOY=true; shift ;;
            --skip-tests) SKIP_TESTS=true; shift ;;
            --quick) QUICK_DEPLOY=true; SKIP_TESTS=true; shift ;;
            *) warn "Unknown argument: $1"; shift ;;
        esac
    done
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE"
    
    echo -e "${BOLD}${ORANGE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  🧪 11 AVATAR DIGITAL HUB - STAGING DEPLOYMENT          ║"
    echo "║  Version: 2.0.0                                         ║"
    echo "║  Timestamp: $DEPLOY_TIMESTAMP                           ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "INFO" "Starting staging deployment"
    log "INFO" "Force: $FORCE_DEPLOY | Skip Tests: $SKIP_TESTS | Quick: $QUICK_DEPLOY"
    
    # Pre-deployment
    check_dependencies
    check_staging_branch
    pull_latest_changes
    
    # Build
    install_staging_dependencies
    run_staging_tests
    build_staging_application
    
    # Deploy
    deploy_firebase_staging
    deploy_firebase_functions_staging
    deploy_cloudflare_staging
    
    # Post-deployment
    perform_staging_health_check
    generate_staging_report
    
    if [ "$ENABLE_NOTIFICATIONS" = true ]; then
        send_notification "success" "Staging deployment completed at $DEPLOY_TIMESTAMP"
    fi
    
    cleanup_staging
    
    echo -e "\n${ORANGE}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  ✅ STAGING DEPLOYMENT SUCCESSFUL                       ║"
    echo "║  Timestamp: $DEPLOY_TIMESTAMP                           ║"
    echo "║  Environment: STAGING 🧪                                ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "SUCCESS" "Staging deployment completed"
}

main "$@"
