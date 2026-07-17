#!/bin/bash
# ============================================================
# 11 AVATAR DIGITAL HUB - Universal Build Script
# Enterprise-grade build system for all environments
# Version: 2.0.0
# Author: 11 Avatar Digital Hub
# License: GPL-3.0
# ============================================================
# Usage: ./build.sh [dev|staging|production] [--watch] [--analyze]
# ============================================================

set -euo pipefail

# ============================================================
# BUILD CONFIGURATION
# ============================================================

PROJECT_NAME="11-avatar-digital-hub"
BUILD_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BUILD_ID="${BUILD_TIMESTAMP}-$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"

# Default environment
BUILD_ENV="${1:-development}"
VALID_ENVS=("development" "staging" "production")

# Directories
SRC_DIR="./src"
PUBLIC_DIR="./public"
BUILD_DIR="./dist"
TEMP_DIR="./.build-temp"
CACHE_DIR="./.build-cache"
LOG_DIR="./logs"
LOG_FILE="${LOG_DIR}/build-${BUILD_TIMESTAMP}.log"

# Bundle Configuration
BUNDLE_NAME="app"
CSS_BUNDLE_NAME="styles"
VENDOR_BUNDLE_NAME="vendor"

# Entry Points
JS_ENTRY="${SRC_DIR}/js/index.js"
CSS_ENTRY="${SRC_DIR}/css/main.css"

# Output Configuration
OUTPUT_JS_DIR="${BUILD_DIR}/js"
OUTPUT_CSS_DIR="${BUILD_DIR}/css"
OUTPUT_ASSETS_DIR="${BUILD_DIR}/assets"
OUTPUT_FONTS_DIR="${BUILD_DIR}/fonts"
OUTPUT_ICONS_DIR="${BUILD_DIR}/icons"

# Environment-specific Configuration
declare -A ENV_CONFIG
ENV_CONFIG[development]="{
    \"minify\": false,
    \"sourcemaps\": true,
    \"hotReload\": true,
    \"debugMode\": true,
    \"logLevel\": \"debug\",
    \"apiBaseURL\": \"http://localhost:8787\",
    \"firebaseProject\": \"avatar-wa-dual-crm-dev\"
}"
ENV_CONFIG[staging]="{
    \"minify\": false,
    \"sourcemaps\": true,
    \"hotReload\": false,
    \"debugMode\": true,
    \"logLevel\": \"info\",
    \"apiBaseURL\": \"https://staging-api.11avatardigitalhub.cloud\",
    \"firebaseProject\": \"avatar-wa-dual-crm\"
}"
ENV_CONFIG[production]="{
    \"minify\": true,
    \"sourcemaps\": false,
    \"hotReload\": false,
    \"debugMode\": false,
    \"logLevel\": \"error\",
    \"apiBaseURL\": \"https://11avatar-api.11avatardigitalhub.workers.dev\",
    \"firebaseProject\": \"avatar-wa-dual-crm\"
}"

# Color Codes
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; PURPLE='\033[0;35m'; CYAN='\033[0;36m'
NC='\033[0m'; BOLD='\033[1m'

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

log() {
    local level=$1; local message=$2
    local timestamp=$(date +"%H:%M:%S")
    local color=""
    case $level in
        INFO) color=$BLUE ;; SUCCESS) color=$GREEN ;;
        WARNING) color=$YELLOW ;; ERROR) color=$RED ;;
        STEP) color=$PURPLE ;; BUILD) color=$CYAN ;;
    esac
    echo -e "${color}[${timestamp}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE"
}

section() {
    echo -e "\n${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  🔨 $1${NC}"
    echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}\n"
    log "STEP" "$1"
}

success() { echo -e "${GREEN}✅ $1${NC}"; log "SUCCESS" "$1"; }
error() { echo -e "${RED}❌ ERROR: $1${NC}"; log "ERROR" "$1"; exit 1; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; log "WARNING" "$1"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; log "INFO" "$1"; }
build_info() { echo -e "${CYAN}🔨 $1${NC}"; log "BUILD" "$1"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

# ============================================================
# PRE-BUILD CHECKS
# ============================================================

validate_environment() {
    section "Validating Build Environment"
    
    # Check for valid environment
    if [[ ! " ${VALID_ENVS[*]} " =~ " ${BUILD_ENV} " ]]; then
        warn "Invalid environment: '$BUILD_ENV'. Defaulting to 'development'"
        BUILD_ENV="development"
    fi
    
    info "Build Environment: ${BUILD_ENV}"
    info "Build ID: ${BUILD_ID}"
    info "Node.js: $(node -v)"
    info "npm: v$(npm -v)"
    
    # Check Node.js version
    local node_major=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_major" -lt 18 ]; then
        error "Node.js 18+ required. Current: $(node -v)"
    fi
    
    success "Environment validated: ${BUILD_ENV}"
}

check_entry_points() {
    section "Checking Entry Points"
    
    local missing_files=()
    
    if [ ! -f "$JS_ENTRY" ]; then
        warn "JS entry point not found: $JS_ENTRY"
        info "Searching for alternative entry points..."
        local alt_entry=$(find "$SRC_DIR/js" -name "index.js" -o -name "main.js" | head -1)
        if [ -n "$alt_entry" ]; then
            JS_ENTRY="$alt_entry"
            info "Using alternative entry: $JS_ENTRY"
        else
            missing_files+=("JS entry point")
        fi
    fi
    
    if [ ! -f "$CSS_ENTRY" ]; then
        warn "CSS entry point not found: $CSS_ENTRY"
        local alt_css=$(find "$SRC_DIR/css" -name "main.css" -o -name "style.css" | head -1)
        if [ -n "$alt_css" ]; then
            CSS_ENTRY="$alt_css"
            info "Using alternative CSS entry: $CSS_ENTRY"
        else
            missing_files+=("CSS entry point")
        fi
    fi
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        warn "Missing entry points: ${missing_files[*]}"
        warn "Build may be incomplete"
    else
        success "All entry points verified"
    fi
}

check_dependencies() {
    section "Checking Dependencies"
    
    if [ ! -d "node_modules" ]; then
        warn "node_modules not found - installing dependencies..."
        npm install
    fi
    
    # Check for outdated packages
    local outdated_count=$(npm outdated --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
    if [ "$outdated_count" -gt 0 ]; then
        warn "$outdated_count packages are outdated"
        info "Run 'npm update' to update packages"
    fi
    
    success "Dependencies verified"
}

# ============================================================
# BUILD PROCESS
# ============================================================

clean_build_directory() {
    section "Cleaning Build Directory"
    
    if [ -d "$BUILD_DIR" ]; then
        info "Removing previous build: $BUILD_DIR"
        rm -rf "$BUILD_DIR"
    fi
    
    # Create output directories
    mkdir -p "$BUILD_DIR" "$OUTPUT_JS_DIR" "$OUTPUT_CSS_DIR"
    mkdir -p "$OUTPUT_ASSETS_DIR" "$OUTPUT_FONTS_DIR" "$OUTPUT_ICONS_DIR"
    mkdir -p "$TEMP_DIR" "$CACHE_DIR" "$LOG_DIR"
    
    success "Build directory prepared"
}

generate_env_config() {
    section "Generating Environment Configuration"
    
    local config="${ENV_CONFIG[$BUILD_ENV]}"
    local config_file="${OUTPUT_JS_DIR}/env.js"
    
    build_info "Writing environment config for: ${BUILD_ENV}"
    
    cat > "$config_file" << EOF
/**
 * 11 Avatar Digital Hub - Environment Configuration
 * Environment: ${BUILD_ENV}
 * Build ID: ${BUILD_ID}
 * Generated: ${BUILD_TIMESTAMP}
 */
window.__APP_ENV__ = ${config};
window.__APP_BUILD_ID__ = '${BUILD_ID}';
window.__APP_BUILD_TIME__ = '${BUILD_TIMESTAMP}';
EOF
    
    success "Environment config generated: ${BUILD_ENV}"
}

copy_static_assets() {
    section "Copying Static Assets"
    
    # Copy public directory contents
    if [ -d "$PUBLIC_DIR" ]; then
        build_info "Copying public assets..."
        cp -r "$PUBLIC_DIR"/* "$BUILD_DIR/" 2>/dev/null || warn "No public assets to copy"
    fi
    
    # Copy HTML files
    if [ -d "${SRC_DIR}/pages" ]; then
        build_info "Copying HTML pages..."
        mkdir -p "${BUILD_DIR}/pages"
        cp -r "${SRC_DIR}/pages"/*.html "${BUILD_DIR}/pages/" 2>/dev/null || true
    fi
    
    # Copy icons
    if [ -d "${PUBLIC_DIR}/icons" ]; then
        build_info "Copying PWA icons..."
        cp -r "${PUBLIC_DIR}/icons"/* "$OUTPUT_ICONS_DIR/" 2>/dev/null || true
    fi
    
    # Copy fonts if they exist locally
    if [ -d "${PUBLIC_DIR}/fonts" ]; then
        build_info "Copying font files..."
        cp -r "${PUBLIC_DIR}/fonts"/* "$OUTPUT_FONTS_DIR/" 2>/dev/null || true
    fi
    
    # Copy manifest and service worker
    for file in manifest.json sw.js robots.txt sitemap.xml; do
        if [ -f "${PUBLIC_DIR}/${file}" ]; then
            cp "${PUBLIC_DIR}/${file}" "$BUILD_DIR/" 2>/dev/null || true
        fi
    done
    
    # Copy configuration files
    for file in .htaccess _headers _redirects; do
        if [ -f "${file}" ]; then
            cp "${file}" "$BUILD_DIR/" 2>/dev/null || true
        fi
    done
    
    success "Static assets copied"
}

bundle_javascript() {
    section "Bundling JavaScript"
    
    if [ ! -f "$JS_ENTRY" ]; then
        warn "No JavaScript entry point found - skipping JS bundle"
        return 0
    fi
    
    build_info "Entry: $JS_ENTRY"
    build_info "Output: $OUTPUT_JS_DIR"
    
    local minify_flag=""
    local sourcemap_flag=""
    
    if [ "${ENV_CONFIG[$BUILD_ENV]}" = "true" ] || echo "${ENV_CONFIG[$BUILD_ENV]}" | grep -q '"minify": true'; then
        minify_flag="--minify"
        build_info "Minification: enabled"
    fi
    
    if echo "${ENV_CONFIG[$BUILD_ENV]}" | grep -q '"sourcemaps": true'; then
        sourcemap_flag="--sourcemap"
        build_info "Source maps: enabled"
    fi
    
    # Bundle using esbuild (fastest bundler available)
    if command_exists npx; then
        build_info "Bundling with esbuild..."
        
        npx esbuild "$JS_ENTRY" \
            --bundle \
            --outfile="${OUTPUT_JS_DIR}/${BUNDLE_NAME}.js" \
            --format=esm \
            --platform=browser \
            --target=es2020 \
            --loader:.js=jsx \
            --loader:.ts=tsx \
            --define:process.env.NODE_ENV=\"${BUILD_ENV}\" \
            ${minify_flag:-} \
            ${sourcemap_flag:-} \
            --metafile="${TEMP_DIR}/bundle-meta.json" \
            2>&1 | tee -a "$LOG_FILE"
        
        local bundle_size=$(du -sh "${OUTPUT_JS_DIR}/${BUNDLE_NAME}.js" | cut -f1)
        success "JavaScript bundled: $bundle_size"
    else
        warn "esbuild not available - using basic concatenation"
        cat "$JS_ENTRY" > "${OUTPUT_JS_DIR}/${BUNDLE_NAME}.js"
        warn "Basic JS concatenation completed (no optimization)"
    fi
}

bundle_css() {
    section "Bundling CSS"
    
    if [ ! -f "$CSS_ENTRY" ]; then
        warn "No CSS entry point found - skipping CSS bundle"
        return 0
    fi
    
    build_info "Entry: $CSS_ENTRY"
    build_info "Output: $OUTPUT_CSS_DIR"
    
    if command_exists npx; then
        build_info "Bundling CSS with esbuild..."
        
        npx esbuild "$CSS_ENTRY" \
            --bundle \
            --outfile="${OUTPUT_CSS_DIR}/${CSS_BUNDLE_NAME}.css" \
            --loader:.css=css \
            --loader:.svg=file \
            --loader:.png=file \
            --loader:.woff2=file \
            --minify \
            --sourcemap \
            2>&1 | tee -a "$LOG_FILE"
        
        local css_size=$(du -sh "${OUTPUT_CSS_DIR}/${CSS_BUNDLE_NAME}.css" | cut -f1)
        success "CSS bundled: $css_size"
    else
        warn "esbuild not available - using basic CSS copy"
        cp "$CSS_ENTRY" "${OUTPUT_CSS_DIR}/${CSS_BUNDLE_NAME}.css"
    fi
}

optimize_assets() {
    section "Optimizing Assets"
    
    local total_saved=0
    
    # Optimize PNG images
    if command_exists pngquant; then
        build_info "Optimizing PNG images..."
        find "$OUTPUT_ASSETS_DIR" -name "*.png" -exec pngquant --ext .png --force --quality=65-80 {} \; 2>/dev/null || true
        success "PNG optimization complete"
    fi
    
    # Optimize JPG images
    if command_exists jpegoptim; then
        build_info "Optimizing JPG images..."
        find "$OUTPUT_ASSETS_DIR" -name "*.jpg" -exec jpegoptim --strip-all --max=85 {} \; 2>/dev/null || true
        success "JPG optimization complete"
    fi
    
    # Optimize SVGs
    if command_exists svgo; then
        build_info "Optimizing SVG files..."
        find "$OUTPUT_ASSETS_DIR" -name "*.svg" -exec svgo --quiet {} \; 2>/dev/null || true
        success "SVG optimization complete"
    fi
    
    success "Asset optimization complete"
}

generate_service_worker() {
    section "Generating Service Worker"
    
    local sw_file="${BUILD_DIR}/sw.js"
    
    if [ -f "${PUBLIC_DIR}/sw.js" ]; then
        build_info "Using existing service worker"
        return 0
    fi
    
    build_info "Generating basic service worker..."
    
    cat > "$sw_file" << 'SWEOF'
const CACHE_NAME = '11avatar-v2.0.0';
const ASSETS_TO_CACHE = [
    '/', '/index.html', '/offline.html', '/manifest.json',
    '/css/styles.css', '/js/app.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                return caches.match('/offline.html');
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
});
SWEOF
    
    success "Service worker generated"
}

generate_build_manifest() {
    section "Generating Build Manifest"
    
    local manifest_file="${BUILD_DIR}/build-manifest.json"
    
    cat > "$manifest_file" << EOF
{
    "project": "$PROJECT_NAME",
    "buildId": "$BUILD_ID",
    "timestamp": "$BUILD_TIMESTAMP",
    "environment": "$BUILD_ENV",
    "nodeVersion": "$(node -v)",
    "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'local')",
    "gitBranch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'local')",
    "files": {
        "js": "$(find $OUTPUT_JS_DIR -type f 2>/dev/null | wc -l) files",
        "css": "$(find $OUTPUT_CSS_DIR -type f 2>/dev/null | wc -l) files",
        "assets": "$(find $OUTPUT_ASSETS_DIR -type f 2>/dev/null | wc -l) files"
    },
    "totalSize": "$(du -sh $BUILD_DIR 2>/dev/null | cut -f1)",
    "buildDuration": "0s"
}
EOF
    
    success "Build manifest generated: $manifest_file"
}

# ============================================================
# POST-BUILD
# ============================================================

calculate_build_stats() {
    section "Build Statistics"
    
    local total_files=$(find "$BUILD_DIR" -type f 2>/dev/null | wc -l)
    local total_size=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1)
    
    info "Total files: $total_files"
    info "Total size: $total_size"
    
    if [ -f "${OUTPUT_JS_DIR}/${BUNDLE_NAME}.js" ]; then
        local js_size=$(du -sh "${OUTPUT_JS_DIR}/${BUNDLE_NAME}.js" | cut -f1)
        info "JS bundle: $js_size"
    fi
    
    if [ -f "${OUTPUT_CSS_DIR}/${CSS_BUNDLE_NAME}.css" ]; then
        local css_size=$(du -sh "${OUTPUT_CSS_DIR}/${CSS_BUNDLE_NAME}.css" | cut -f1)
        info "CSS bundle: $css_size"
    fi
    
    success "Build statistics calculated"
}

verify_build_output() {
    section "Verifying Build Output"
    
    local required_files=(
        "${BUILD_DIR}/index.html"
        "${OUTPUT_JS_DIR}/${BUNDLE_NAME}.js"
    )
    
    local missing_count=0
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            info "✓ Found: $(basename $file)"
        else
            warn "✗ Missing: $(basename $file)"
            missing_count=$((missing_count + 1))
        fi
    done
    
    if [ $missing_count -gt 0 ]; then
        warn "$missing_count required files are missing"
    else
        success "All required build outputs verified"
    fi
}

# ============================================================
# WATCH MODE
# ============================================================

start_watch_mode() {
    section "Starting Watch Mode"
    
    build_info "Watching for changes in: $SRC_DIR"
    
    if command_exists npx; then
        npx chokidar "$SRC_DIR/**/*" "$PUBLIC_DIR/**/*" \
            -c "./build.sh $BUILD_ENV" \
            --initial=false \
            --debounce=300 \
            --silent &
        
        local watch_pid=$!
        echo $watch_pid > "${TEMP_DIR}/watch.pid"
        
        success "Watch mode started (PID: $watch_pid)"
        info "Press Ctrl+C to stop watching"
        
        # Keep running until interrupted
        trap "kill $watch_pid 2>/dev/null; rm -f ${TEMP_DIR}/watch.pid; exit 0" INT TERM
        wait $watch_pid
    else
        warn "chokidar not available - watch mode disabled"
        info "Install: npm install -g chokidar-cli"
    fi
}

# ============================================================
# CLEANUP
# ============================================================

cleanup_temp_files() {
    section "Cleaning Temporary Files"
    
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        info "Temporary files removed"
    fi
    
    # Clean old build artifacts (keep last 5)
    if [ -d "$BUILD_DIR" ]; then
        local old_builds=$(ls -1d "${BUILD_DIR}"-* 2>/dev/null | wc -l)
        if [ "$old_builds" -gt 5 ]; then
            ls -1dt "${BUILD_DIR}"-* | tail -n +6 | while read old; do
                rm -rf "$old"
                info "Removed old build: $old"
            done
        fi
    fi
    
    success "Cleanup complete"
}

# ============================================================
# MAIN BUILD FLOW
# ============================================================

main() {
    local WATCH_MODE=false
    local ANALYZE_MODE=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|development) BUILD_ENV="development"; shift ;;
            staging) BUILD_ENV="staging"; shift ;;
            prod|production) BUILD_ENV="production"; shift ;;
            --watch|-w) WATCH_MODE=true; shift ;;
            --analyze|-a) ANALYZE_MODE=true; shift ;;
            *) shift ;;
        esac
    done
    
    # Initialize
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE"
    
    echo -e "${BOLD}${CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  🔨 11 AVATAR DIGITAL HUB - BUILD SYSTEM                ║"
    echo "║  Environment: ${BUILD_ENV}                              ║"
    echo "║  Build ID: ${BUILD_ID}                                  ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "INFO" "Build started - Environment: $BUILD_ENV"
    
    local build_start=$(date +%s)
    
    # Pre-build
    validate_environment
    check_entry_points
    check_dependencies
    
    # Build
    clean_build_directory
    generate_env_config
    copy_static_assets
    bundle_javascript
    bundle_css
    optimize_assets
    generate_service_worker
    
    # Post-build
    calculate_build_stats
    verify_build_output
    generate_build_manifest
    cleanup_temp_files
    
    local build_end=$(date +%s)
    local build_duration=$((build_end - build_start))
    
    echo -e "\n${GREEN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  ✅ BUILD COMPLETED SUCCESSFULLY                        ║"
    echo "║  Environment: ${BUILD_ENV}                              ║"
    echo "║  Duration: ${build_duration}s                           ║"
    echo "║  Output: ${BUILD_DIR}                                   ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "SUCCESS" "Build completed in ${build_duration}s"
    
    # Start watch mode if requested
    if [ "$WATCH_MODE" = true ]; then
        start_watch_mode
    fi
}

main "$@"
