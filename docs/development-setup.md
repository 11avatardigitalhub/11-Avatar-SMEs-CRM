markdown
# 11 Avatar Digital Hub - Development Setup Guide

## 📋 Document Information

| Property | Value |
|----------|-------|
| **Document Version** | 2.0.0 |
| **Last Updated** | July 16, 2026 |
| **Author** | Ananya Patel (CTO), Priya Singh (VP Engineering) |
| **Contact** | admin@11avatardigitalhub.cloud |

---

## 🎯 Overview

This guide provides comprehensive instructions for setting up a local development environment for **11 Avatar Digital Hub**. Follow these steps to get the project running on your machine and start contributing.

---

## 📋 System Requirements

### Minimum Hardware
| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 cores (8 recommended) |
| **RAM** | 8 GB (16 GB recommended) |
| **Disk Space** | 10 GB free (SSD recommended) |
| **Network** | Broadband internet for emulators and API access |

### Operating System
| OS | Supported Versions |
|----|-------------------|
| **Windows** | Windows 10/11 (64-bit) with WSL2 recommended |
| **macOS** | macOS 12 Monterey or later |
| **Linux** | Ubuntu 22.04 LTS or later, Debian 12, Fedora 38+ |

---

## 🛠️ Required Software Installation

### 1. Node.js & npm

**Windows (using nvm-windows):**
```powershell
# Download and install nvm-windows from:
# https://github.com/coreybutler/nvm-windows/releases

nvm install 20.11.0
nvm use 20.11.0
macOS/Linux (using nvm):

bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Restart terminal or source profile
source ~/.bashrc  # or ~/.zshrc

# Install and use Node.js 20
nvm install 20.11.0
nvm use 20.11.0
nvm alias default 20.11.0
Verify Installation:

bash
node --version   # Should output: v20.11.0
npm --version    # Should output: 10.x.x
2. Git
Windows:
Download from: https://git-scm.com/download/win

macOS:

bash
# Using Homebrew
brew install git

# Or download from: https://git-scm.com/download/mac
Linux:

bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install git

# Fedora
sudo dnf install git
Configure Git:

bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global core.autocrlf input
git config --global init.defaultBranch main
Verify Installation:

bash
git --version    # Should output: git version 2.40.x or higher
3. Firebase CLI
bash
# Install globally via npm
npm install -g firebase-tools

# Verify installation
firebase --version   # Should output: 12.x.x or higher

# Login to Firebase
firebase login

# Verify login
firebase projects:list
4. Cloudflare Wrangler (Optional - for API development)
bash
# Install globally via npm
npm install -g wrangler

# Verify installation
wrangler --version   # Should output: 3.x.x or higher

# Login to Cloudflare
wrangler login
5. Visual Studio Code (Recommended IDE)
Download from: https://code.visualstudio.com/

Recommended Extensions:

Extension	Purpose
ESLint	JavaScript linting
Prettier	Code formatting
Live Server	Local development server
Firebase Explorer	Firebase integration
GitLens	Git supercharged
CSS Peek	CSS navigation
JavaScript (ES6) snippets	Code snippets
Path Intellisense	File path autocomplete
Color Highlight	CSS color preview
Markdown Preview	Documentation preview
📥 Getting the Code
Clone the Repository
bash
# Using HTTPS (recommended for most users)
git clone https://github.com/11avatardigitalhub/lead2revenue.git
cd lead2revenue

# Using SSH (if you have SSH keys configured)
git clone git@github.com:11avatardigitalhub/lead2revenue.git
cd lead2revenue

# Using GitHub CLI
gh repo clone 11avatardigitalhub/lead2revenue
cd lead2revenue
Fork the Repository (for contributors)
bash
# 1. Fork via GitHub UI: https://github.com/11avatardigitalhub/lead2revenue/fork

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/lead2revenue.git
cd lead2revenue

# 3. Add upstream remote
git remote add upstream https://github.com/11avatardigitalhub/lead2revenue.git

# 4. Verify remotes
git remote -v
# Should show:
# origin    https://github.com/YOUR_USERNAME/lead2revenue.git
# upstream  https://github.com/11avatardigitalhub/lead2revenue.git
📦 Installing Dependencies
Main Project Dependencies
bash
# Navigate to project root
cd lead2revenue

# Install all dependencies (including dev dependencies)
npm install

# This installs packages listed in package.json:
# - esbuild (bundler)
# - chokidar (file watcher)
# - Various polyfills and utilities
Firebase Functions Dependencies
bash
# Navigate to functions directory
cd functions

# Install functions dependencies
npm install

# Return to project root
cd ..
Verify Installation
bash
# Check all dependencies installed correctly
npm ls --depth=0

# Expected output should include:
# ├── esbuild@0.20.x
# ├── chokidar@3.x.x
# └── ...other packages
⚙️ Environment Configuration
Firebase Configuration
The project uses Firebase for authentication, database, and hosting.

bash
# Select the Firebase project
firebase use avatar-wa-dual-crm

# Verify project selection
firebase projects:list
Firebase Configuration Files:

firebase.json — Firebase service configuration

.firebaserc — Project aliases

src/js/config/firebase.js — Client-side Firebase initialization

Cloudflare Worker Configuration (Optional)
bash
# The wrangler.toml file contains Worker configuration
# Update if you need to change the worker name or routes

# Verify wrangler configuration
wrangler whoami
Local Environment Variables
Create a .env.local file in the project root (never commit this file):

bash
# .env.local - Local Development Environment Variables
NODE_ENV=development
FIREBASE_PROJECT_ID=avatar-wa-dual-crm
FIREBASE_API_KEY=your-firebase-api-key
API_BASE_URL=http://localhost:8787
CLOUDWA_BASE_URL=https://cloudwa.11avatardigitalhub.cloud
ENABLE_LOGGING=true
LOG_LEVEL=debug
🚀 Running the Development Environment
Option 1: Firebase Emulators (Full Stack)
bash
# Start all Firebase emulators
firebase emulators:start

# This starts:
# - Authentication Emulator (http://localhost:9099)
# - Firestore Emulator (http://localhost:8080)
# - Functions Emulator (http://localhost:5001)
# - Hosting Emulator (http://localhost:5000)
# - Storage Emulator (http://localhost:9199)
# - Emulator UI (http://localhost:4000)

# In a separate terminal, start the dev server with watch mode
npm run dev
Option 2: Development Server Only (Frontend Focus)
bash
# Start development server with hot reload
npm run dev

# Or use the build script with watch mode
./scripts/build.sh development --watch

# Access the application at:
# http://localhost:5000
Option 3: Cloudflare Worker Dev Server (API Focus)
bash
# Navigate to worker directory
cd workers/11avatar-api

# Start wrangler dev server
wrangler dev

# Or from project root
npm run dev:api

# API available at:
# http://localhost:8787
Option 4: Quick Start (Simplified)
bash
# Run everything with a single command
npm start

# This concurrently starts:
# - Firebase emulators
# - Development server
# - File watcher for auto-rebuild
📁 Project Structure for Development
text
lead2revenue/
├── public/                    # Static public files
│   ├── index.html             # Landing page
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── *.html                 # Other public pages
│   ├── assets/                # Images and brand assets
│   ├── icons/                 # PWA icons
│   └── fonts/                 # Font files (fallback)
│
├── src/                       # Source code
│   ├── css/                   # Stylesheets
│   │   ├── main.css           # Core styles & design tokens
│   │   ├── components.css     # Reusable component styles
│   │   ├── dashboard.css      # Dashboard-specific styles
│   │   ├── auth.css           # Authentication page styles
│   │   ├── landing.css        # Landing page styles
│   │   └── mobile.css         # Mobile responsive overrides
│   │
│   ├── js/                    # JavaScript modules
│   │   ├── index.js           # Application entry point
│   │   ├── config/            # Configuration files
│   │   │   ├── firebase.js    # Firebase initialization
│   │   │   ├── constants.js   # Application constants
│   │   │   └── routes.js      # Route definitions
│   │   ├── core/              # Core infrastructure
│   │   │   ├── app.js         # Main application controller
│   │   │   ├── router.js      # SPA routing engine
│   │   │   ├── state.js       # State management
│   │   │   ├── eventBus.js    # Event system
│   │   │   ├── api.js         # API communication
│   │   │   ├── cache.js       # Data caching
│   │   │   └── offline.js     # Offline support
│   │   ├── auth/              # Authentication module
│   │   ├── components/        # Reusable UI components (25+)
│   │   ├── modules/           # Business logic modules (15)
│   │   ├── integrations/      # Third-party integrations (16)
│   │   └── utils/             # Utility functions
│   │
│   └── pages/                 # Internal application pages
│       ├── dashboard.html
│       ├── clients.html
│       ├── invoices.html
│       └── ... (28 pages total)
│
├── functions/                 # Firebase Cloud Functions
│   ├── index.js               # Functions entry point
│   ├── payment-webhook.js     # Payment processing
│   ├── email-sender.js        # Email delivery
│   ├── sms-sender.js          # SMS delivery
│   ├── backup-scheduler.js    # Automated backups
│   └── data-cleanup.js        # Data maintenance
│
├── tests/                     # Test suites
│   ├── unit/                  # Unit tests
│   │   ├── core.test.js
│   │   ├── auth.test.js
│   │   ├── modules.test.js
│   │   ├── components.test.js
│   │   └── integrations.test.js
│   └── e2e/                   # End-to-end tests
│       └── app.test.js
│
├── scripts/                   # Build & deployment scripts
│   ├── deploy-production.sh
│   ├── deploy-staging.sh
│   ├── build.sh
│   └── seed-data.js
│
├── docs/                      # Documentation
│   ├── architecture.md
│   ├── api-reference.md
│   ├── deployment-guide.md
│   ├── development-setup.md   # This file
│   ├── contributing.md
│   ├── security-policy.md
│   ├── user-guide.md
│   ├── integration-guide.md
│   └── faq.md
│
├── .github/                   # GitHub configuration
├── firebase.json              # Firebase configuration
├── .firebaserc                # Firebase project aliases
├── wrangler.toml              # Cloudflare Worker config
├── package.json               # Project dependencies & scripts
└── .gitignore                 # Git ignore rules
🧪 Running Tests
Unit Tests
bash
# Run all unit tests
npm test

# Run specific test file
npm test -- tests/unit/core.test.js

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
Integration Tests
bash
# Run integration tests
npm run test:integration
End-to-End Tests
bash
# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed
🔧 Development Tools & Scripts
Available npm Scripts
Script	Description
npm run dev	Start development server
npm start	Start full dev environment
npm test	Run all unit tests
npm run test:watch	Run tests in watch mode
npm run test:coverage	Run tests with coverage
npm run test:integration	Run integration tests
npm run test:e2e	Run E2E tests
npm run build	Build for current environment
npm run build:production	Build for production
npm run build:staging	Build for staging
npm run lint	Run ESLint
npm run format	Run Prettier
npm run analyze	Run bundle analyzer
Build System
bash
# Development build (with source maps, no minification)
./scripts/build.sh development

# Staging build (with source maps, no minification)
./scripts/build.sh staging

# Production build (minified, no source maps)
./scripts/build.sh production

# Build with watch mode
./scripts/build.sh development --watch

# Build with bundle analysis
./scripts/build.sh production --analyze
🐛 Debugging
Browser DevTools
Open Chrome DevTools: F12 or Ctrl+Shift+I

Sources tab: Set breakpoints in JavaScript files

Network tab: Monitor API requests

Console tab: View logs and errors

Application tab: Inspect Service Workers, Cache, IndexedDB

Firebase Emulator UI
Access at: http://localhost:4000

View Firestore data

Monitor authentication events

Check function logs

Inspect storage files

VS Code Debugging
Create .vscode/launch.json:

json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "chrome",
            "request": "launch",
            "name": "Launch Chrome",
            "url": "http://localhost:5000",
            "webRoot": "${workspaceFolder}/src"
        },
        {
            "type": "node",
            "request": "attach",
            "name": "Attach to Functions",
            "port": 9229,
            "restart": true
        }
    ]
}
❗ Common Issues & Solutions
Issue: "Port 5000 already in use"
bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use a different port
firebase emulators:start --port=5001
Issue: "Firebase authentication failed"
bash
# Re-authenticate
firebase logout
firebase login

# Verify login
firebase projects:list
Issue: "Module not found" errors
bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
Issue: "Firestore emulator data persisting"
bash
# Clear emulator data
firebase emulators:start --export-on-exit=./emulator-data --import=./emulator-data
📞 Getting Help
For development environment issues:

Email: admin@11avatardigitalhub.cloud

Internal Docs: /docs/ directory

API Reference: /docs/api-reference.md

Document Version: 2.0.0 | Last Updated: July 16, 2026
