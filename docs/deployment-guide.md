markdown
# 11 Avatar Digital Hub - Deployment Guide

## 📋 Document Information

| Property | Value |
|----------|-------|
| **Document Version** | 2.0.0 |
| **Last Updated** | July 16, 2026 |
| **Author** | Ananya Patel (CTO), Priya Singh (VP Engineering) |
| **Contact** | admin@11avatardigitalhub.cloud |

---

## 🎯 Overview

This guide covers the complete deployment process for **11 Avatar Digital Hub** across all environments. The project uses a multi-platform deployment strategy:

| Component | Platform | URL |
|-----------|----------|-----|
<<<<<<< HEAD
| **Frontend (SPA)** | Firebase Hosting + GitHub Pages | `https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/` |
=======
| **Frontend (SPA)** | Firebase Hosting + GitHub Pages | `https://11avatardigitalhub.github.io/lead2revenue/` |
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
| **API Gateway** | Cloudflare Workers | `https://11avatar-api.11avatardigitalhub.workers.dev` |
| **Backend Functions** | Firebase Cloud Functions | `avatar-wa-dual-crm` |
| **Database** | Firestore + Cloud SQL | `avatar-wa-dual-crm` |
| **Storage** | Firebase Cloud Storage | `avatar-wa-dual-crm.appspot.com` |
| **WhatsApp** | CloudWA | `https://cloudwa.11avatardigitalhub.cloud` |

---

## 📋 Prerequisites

### Required Accounts & Access
<<<<<<< HEAD
- [ ] GitHub repository admin access (`11-Avatar-SMEs-CRM`)
=======
- [ ] GitHub repository admin access (`lead2revenue`)
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
- [ ] Firebase project owner access (`avatar-wa-dual-crm`)
- [ ] Cloudflare account with Workers enabled
- [ ] CloudWA admin access
- [ ] Google Cloud Platform access (for Cloud SQL)

### Required Tools Installed
| Tool | Version | Installation |
|------|---------|-------------|
| Node.js | 18.x+ | `https://nodejs.org` |
| npm | 9.x+ | Bundled with Node.js |
| Firebase CLI | 12.x+ | `npm install -g firebase-tools` |
| Wrangler CLI | 3.x+ | `npm install -g wrangler` |
| Git | 2.40+ | `https://git-scm.com` |
| jq | 1.6+ | `apt-get install jq` (Linux) / `brew install jq` (macOS) |

### Authentication Setup
```bash
# Firebase Authentication
firebase login
firebase use avatar-wa-dual-crm

# Cloudflare Authentication
wrangler login

# GitHub CLI (optional)
gh auth login
🌍 Environment Overview
Environment	Branch	URL	Purpose
<<<<<<< HEAD
Production	main	https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/	Live customer-facing
=======
Production	main	https://11avatardigitalhub.github.io/lead2revenue/	Live customer-facing
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
Staging	develop	Firebase Preview Channel	Pre-production testing
Development	feature/*	Local (localhost:5000)	Active development
🚀 Production Deployment
Step 1: Pre-Deployment Checklist
Before deploying to production, verify:

bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Verify working directory is clean
git status

# Run all tests
npm test
npm run test:e2e

# Verify build succeeds
npm run build:production
Step 2: Automated Deployment (Recommended)
bash
# Full production deployment with all checks
./scripts/deploy-production.sh

# With force flag (skip branch check - emergency only)
./scripts/deploy-production.sh --force

# Skip tests (use with caution)
./scripts/deploy-production.sh --skip-tests

# Dry run (verify without deploying)
./scripts/deploy-production.sh --dry-run
Step 3: Manual Deployment (Step by Step)
bash
# 1. Build the application
export NODE_ENV=production
npm run build:production

# 2. Deploy Firebase Hosting
firebase deploy --only hosting --project avatar-wa-dual-crm

# 3. Deploy Firebase Functions
cd functions
npm install --production
firebase deploy --only functions --project avatar-wa-dual-crm
cd ..

# 4. Deploy Firestore Rules
firebase deploy --only firestore:rules --project avatar-wa-dual-crm

# 5. Deploy Firestore Indexes
firebase deploy --only firestore:indexes --project avatar-wa-dual-crm

# 6. Deploy Cloudflare Worker
wrangler deploy --env production

# 7. Run database migrations
# Execute SQL files from database/migrations/ against Cloud SQL instance
Step 4: Post-Deployment Verification
bash
# 1. Health check
<<<<<<< HEAD
curl -I https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/
=======
curl -I https://11avatardigitalhub.github.io/lead2revenue/
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a

# 2. API health check
curl https://11avatar-api.11avatardigitalhub.workers.dev/api/health

# 3. Verify Firebase Functions
firebase functions:list --project avatar-wa-dual-crm

# 4. Check Cloudflare Worker status
wrangler tail --env production
🧪 Staging Deployment
Automated Staging Deployment
bash
# Full staging deployment
./scripts/deploy-staging.sh

# Quick deploy (skip tests for urgent changes)
./scripts/deploy-staging.sh --quick

# Force from non-develop branch
./scripts/deploy-staging.sh --force
Manual Staging Deployment
bash
# 1. Switch to develop branch
git checkout develop
git pull origin develop

# 2. Build for staging
export NODE_ENV=staging
npm run build:staging

# 3. Deploy to Firebase preview channel
firebase hosting:channel:deploy staging \
    --project avatar-wa-dual-crm \
    --expires 7d

# 4. Get preview URL
firebase hosting:channel:open staging --project avatar-wa-dual-crm

# 5. Deploy Functions (staging)
firebase deploy --only functions --project avatar-wa-dual-crm --force

# 6. Deploy Worker (staging)
wrangler deploy --env staging
💻 Development Environment
Local Development Setup
bash
# 1. Clone repository
<<<<<<< HEAD
git clone https://github.com/11avatardigitalhub/11-Avatar-SMEs-CRM.git
cd 11-Avatar-SMEs-CRM
=======
git clone https://github.com/11avatardigitalhub/lead2revenue.git
cd lead2revenue
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a

# 2. Install all dependencies
npm install
cd functions && npm install && cd ..

# 3. Start Firebase emulators
firebase emulators:start

# 4. Start development server (separate terminal)
npm run dev

# 5. Start watch mode for auto-rebuild
./scripts/build.sh development --watch
Firebase Emulators
The Firebase emulator suite provides local versions of:

Authentication (port 9099)

Firestore (port 8080)

Functions (port 5001)

Hosting (port 5000)

Storage (port 9199)

Pub/Sub (port 8085)

Access the emulator UI at: http://localhost:4000

🔄 CI/CD Pipeline
GitHub Actions Workflow
The CI/CD pipeline is defined in .github/workflows/deploy.yml:

yaml
Triggers:
  - Push to 'develop' branch → Staging deployment
  - Push to 'main' branch → Production deployment
  - Pull Request opened → Run tests + Build check

Pipeline Stages:
  1. Checkout Code
  2. Setup Node.js
  3. Install Dependencies
  4. Run Linting (ESLint + Prettier)
  5. Run Unit Tests
  6. Run Integration Tests
  7. Run E2E Tests
  8. Build Application
  9. Deploy to Firebase (Staging/Production)
  10. Deploy Cloudflare Worker
  11. Health Check Verification
  12. Notify (Slack/Email)
Environment Variables (GitHub Secrets)
Secret Name	Description
FIREBASE_TOKEN	Firebase CI token for deployment
CLOUDFLARE_API_TOKEN	Cloudflare API token for Workers
SLACK_WEBHOOK_URL	Slack notification webhook
NOTIFY_EMAIL	Deployment notification email
📊 Database Migrations
Running Migrations
bash
# For Cloud SQL (PostgreSQL)
# 1. Connect to Cloud SQL instance
gcloud sql connect avatar-db --user=postgres

# 2. Run migration files in order
\i database/migrations/v1.sql
\i database/migrations/v2.sql

# 3. Verify migration status
SELECT * FROM core.migrations ORDER BY applied_at DESC;
Migration Best Practices
Always backup before running migrations

Test migrations on staging first

Run migrations during low-traffic periods

Have a rollback plan ready

Verify data integrity after migration

🔒 Security Deployment Checklist
Firestore security rules deployed and tested

API authentication working correctly

CORS headers properly configured

HTTPS enforced (HSTS headers set)

API keys rotated if compromised

Service account permissions reviewed

Environment variables verified (no hardcoded secrets)

Dependencies scanned for vulnerabilities (npm audit)

🔧 Troubleshooting
Common Issues
Issue	Solution
Firebase deploy fails	Run firebase login to re-authenticate
Build errors	Clear node_modules and dist, run npm install
Functions deploy timeout	Deploy functions individually: firebase deploy --only functions:functionName
Worker deploy fails	Check wrangler.toml configuration
Database migration fails	Restore from backup and retry
Preview channel expired	Re-deploy to create new preview channel
Rollback Procedure
bash
# 1. Identify last working deployment
git log --oneline -10

# 2. Revert to previous commit
git revert <commit-hash>

# 3. Deploy the reverted version
./scripts/deploy-production.sh --force

# 4. Or restore from backup
# The deployment script automatically creates backups in ./backups/
📊 Monitoring & Alerts
Health Check Endpoints
bash
# Frontend
<<<<<<< HEAD
curl -I https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/
=======
curl -I https://11avatardigitalhub.github.io/lead2revenue/
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a

# API
curl https://11avatar-api.11avatardigitalhub.workers.dev/api/health

# Functions
firebase functions:list --project avatar-wa-dual-crm
Logging
Frontend: Firebase Crashlytics

Functions: Google Cloud Logging

Workers: Cloudflare Logs (wrangler tail)

Database: Cloud SQL logs in GCP Console

Alert Configuration
Alerts should be configured for:

API error rate > 1%

Function execution time > 10s

Database connection failures

Storage quota > 80%

SSL certificate expiry (30 days notice)

📞 Support
For deployment issues or questions:

Email: admin@11avatardigitalhub.cloud

Emergency: +91 98765 43210

Document Version: 2.0.0 | Last Updated: July 16, 2026
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
