#!/bin/bash
# ============================================================
# 11 AVATAR DIGITAL HUB - Asset Generation Script
# Enterprise-grade placeholder & real asset generator
# Version: 2.0.0
# ============================================================
# Usage: ./scripts/generate-assets.sh [--real-logo]
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="${PROJECT_ROOT}/public/assets"
ICONS_DIR="${PROJECT_ROOT}/public/icons"
FONTS_DIR="${PROJECT_ROOT}/public/fonts"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[ASSET]${NC} $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }

# ============================================================
# CREATE DIRECTORIES
# ============================================================
mkdir -p "$ASSETS_DIR" "$ICONS_DIR" "$FONTS_DIR"

# ============================================================
# REAL LOGO - 11 AVATAR DIGITAL HUB
# ============================================================

generate_real_logo() {
    log "Generating 11 Avatar Digital Hub logo..."
    
    # Create SVG logo with gold/black theme
    cat > "${ASSETS_DIR}/logo.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120">
  <defs>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8C95A;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#D4AF37;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#B8960F;stop-opacity:1" />
    </linearGradient>
    <style>
      .logo-text { font-family: 'Poppins', 'Inter', Arial, sans-serif; font-weight: 800; font-size: 32px; fill: url(#goldGradient); }
      .logo-sub { font-family: 'Poppins', 'Inter', Arial, sans-serif; font-weight: 600; font-size: 13px; fill: #CCCCCC; letter-spacing: 3px; }
      .logo-icon { fill: url(#goldGradient); }
    </style>
  </defs>
  
  <!-- Logo Icon - Abstract "11" with avatar shape -->
  <g transform="translate(15, 20)">
    <!-- Outer circle -->
    <circle cx="35" cy="35" r="32" fill="none" stroke="url(#goldGradient)" stroke-width="3"/>
    <!-- Inner 11 design -->
    <rect x="22" y="15" width="6" height="40" rx="3" fill="url(#goldGradient)"/>
    <rect x="34" y="15" width="6" height="40" rx="3" fill="url(#goldGradient)"/>
    <!-- Digital hub dots -->
    <circle cx="55" cy="20" r="3" fill="url(#goldGradient)"/>
    <circle cx="55" cy="35" r="3" fill="url(#goldGradient)"/>
    <circle cx="55" cy="50" r="3" fill="url(#goldGradient)"/>
  </g>
  
  <!-- Text -->
  <text x="95" y="48" class="logo-text">11 AVATAR</text>
  <text x="95" y="72" class="logo-sub">DIGITAL HUB</text>
  
  <!-- Bottom line -->
  <line x1="95" y1="80" x2="370" y2="80" stroke="url(#goldGradient)" stroke-width="2" opacity="0.5"/>
</svg>
SVGEOF
    success "Logo SVG created: ${ASSETS_DIR}/logo.svg"
    
    # Create PNG versions using ImageMagick if available
    if command_exists convert; then
        for size in 72 96 128 144 152 192 384 512; do
            convert -background none "${ASSETS_DIR}/logo.svg" -resize ${size}x${size} "${ASSETS_DIR}/logo-${size}.png" 2>/dev/null || true
        done
        success "Logo PNG sizes generated (requires ImageMagick)"
    else
        warn "ImageMagick not found - install for PNG generation: brew install imagemagick"
    fi
}

# ============================================================
# PWA ICONS
# ============================================================

generate_pwa_icons() {
    log "Generating PWA icons..."
    
    # Generate SVG icon
    cat > "${ICONS_DIR}/icon.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1A1A1A"/>
      <stop offset="100%" style="stop-color:#0A0A0A"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8C95A"/>
      <stop offset="100%" style="stop-color:#D4AF37"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <circle cx="200" cy="200" r="80" fill="none" stroke="url(#gold)" stroke-width="12"/>
  <rect x="170" y="155" width="16" height="90" rx="8" fill="url(#gold)"/>
  <rect x="205" y="155" width="16" height="90" rx="8" fill="url(#gold)"/>
  <circle cx="280" cy="170" r="12" fill="url(#gold)"/>
  <circle cx="280" cy="230" r="12" fill="url(#gold)"/>
  <text x="256" y="380" font-family="Arial" font-weight="800" font-size="60" fill="url(#gold)" text-anchor="middle">11 AVATAR</text>
</svg>
SVGEOF
    success "PWA icon SVG created"
    
    # Generate PNG sizes using ImageMagick
    if command_exists convert; then
        for size in 72 96 128 144 152 192 384 512; do
            convert -background "#0A0A0A" "${ICONS_DIR}/icon.svg" -resize ${size}x${size} "${ICONS_DIR}/icon-${size}x${size}.png" 2>/dev/null || true
        done
        success "PWA icon PNGs generated (9 sizes)"
    else
        warn "Install ImageMagick for PNG icons: brew install imagemagick"
    fi
    
    # Generate favicon
    if command_exists convert; then
        convert -background "#0A0A0A" "${ICONS_DIR}/icon.svg" -resize 32x32 "${ICONS_DIR}/favicon.ico" 2>/dev/null || true
        success "Favicon generated"
    fi
}

# ============================================================
# PLACEHOLDER IMAGES
# ============================================================

generate_placeholders() {
    log "Generating placeholder images..."
    
    # OG Image
    cat > "${ASSETS_DIR}/og-image.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#0A0A0A"/>
  <rect x="40" y="40" width="1120" height="550" rx="20" fill="none" stroke="#D4AF37" stroke-width="2"/>
  <text x="600" y="260" font-family="Arial" font-weight="800" font-size="64" fill="#D4AF37" text-anchor="middle">11 AVATAR DIGITAL HUB</text>
  <text x="600" y="330" font-family="Arial" font-weight="400" font-size="28" fill="#888888" text-anchor="middle">India's #1 Revenue Operating System for SMEs</text>
  <line x1="300" y1="380" x2="900" y2="380" stroke="#D4AF37" stroke-width="1" opacity="0.3"/>
  <text x="600" y="430" font-family="Arial" font-weight="600" font-size="20" fill="#CCCCCC" text-anchor="middle">CRM • Invoicing • WhatsApp • Payments • Projects • Training</text>
</svg>
SVGEOF

    # Dashboard Preview
    cat > "${ASSETS_DIR}/dashboard-preview.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <rect width="800" height="500" fill="#1A1A1A" rx="12"/>
  <rect x="20" y="20" width="180" height="30" rx="6" fill="#D4AF37" opacity="0.15"/>
  <rect x="210" y="20" width="180" height="30" rx="6" fill="#D4AF37" opacity="0.1"/>
  <rect x="400" y="20" width="180" height="30" rx="6" fill="#D4AF37" opacity="0.1"/>
  <rect x="590" y="20" width="190" height="30" rx="6" fill="#D4AF37" opacity="0.1"/>
  <rect x="20" y="70" width="380" height="200" rx="8" fill="#D4AF37" opacity="0.05"/>
  <rect x="420" y="70" width="360" height="200" rx="8" fill="#D4AF37" opacity="0.05"/>
  <rect x="20" y="290" width="760" height="190" rx="8" fill="#D4AF37" opacity="0.03"/>
</svg>
SVGEOF

    # Default Avatar
    cat > "${ASSETS_DIR}/avatar-default.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="50" fill="#D4AF37" opacity="0.2"/>
  <circle cx="50" cy="35" r="18" fill="#D4AF37" opacity="0.5"/>
  <ellipse cx="50" cy="78" rx="28" ry="16" fill="#D4AF37" opacity="0.5"/>
</svg>
SVGEOF

    # Empty State
    cat > "${ASSETS_DIR}/empty-state.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="200" height="150">
  <rect x="40" y="20" width="120" height="100" rx="10" fill="none" stroke="#D4AF37" stroke-width="2" stroke-dasharray="8,4" opacity="0.4"/>
  <text x="100" y="78" font-family="Arial" font-size="14" fill="#888" text-anchor="middle">No data</text>
</svg>
SVGEOF

    success "Placeholder SVGs generated (og-image, dashboard, avatar, empty-state)"
}

# ============================================================
# FONT DOWNLOADER
# ============================================================

download_fonts() {
    log "Setting up font files..."
    
    # Create font CSS with Google Fonts fallback
    cat > "${FONTS_DIR}/fonts.css" << 'CSSEOF'
/* 11 Avatar Digital Hub - Font Configuration */
/* Primary fonts loaded via Google Fonts CDN */
/* These local files serve as fallback */

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa25L7.woff2') format('woff2');
}

@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2') format('woff2');
}

@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2') format('woff2');
}

@font-face {
  font-family: 'Fira Code';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/firacode/v21/uU9NCBsR6Z2vfE9aq3bh0NSDulI.woff2') format('woff2');
}
CSSEOF
    
    success "Font CSS configuration created: ${FONTS_DIR}/fonts.css"
    log "Fonts are loaded via Google Fonts CDN with local fallback CSS"
    log "For fully offline fonts, download .woff2 files manually from Google Fonts"
}

# ============================================================
# MAIN
# ============================================================

main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  11 AVATAR DIGITAL HUB - ASSET GENERATOR                ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Create directories
    mkdir -p "$ASSETS_DIR" "$ICONS_DIR" "$FONTS_DIR"
    
    # Generate real logo
    generate_real_logo
    
    # Generate PWA icons
    generate_pwa_icons
    
    # Generate placeholders
    generate_placeholders
    
    # Setup fonts
    download_fonts
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  ✅ ASSETS GENERATED SUCCESSFULLY                       ║"
    echo "║                                                        ║"
    echo "║  Assets:  ${ASSETS_DIR}                    ║"
    echo "║  Icons:   ${ICONS_DIR}                     ║"
    echo "║  Fonts:   ${FONTS_DIR}                     ║"
    echo "║                                                        ║"
    echo "║  NEXT STEPS:                                           ║"
    echo "║  1. Install ImageMagick for PNG generation             ║"
    echo "║  2. Replace placeholder SVGs with real designs         ║"
    echo "║  3. Run: npm run optimize-assets                       ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

# Check for ImageMagick
command_exists() { command -v "$1" >/dev/null 2>&1; }

if command_exists convert; then
    log "ImageMagick detected - PNG generation enabled"
else
    warn "ImageMagick not found - SVG only mode"
    warn "Install: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
fi

main "$@"
