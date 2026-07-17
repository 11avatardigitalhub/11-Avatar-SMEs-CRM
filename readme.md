# 🚀 11 Avatar Digital Hub - Master Revenue CRM

<div align="center">

![Version](https://img.shields.io/badge/version-3.0.0-gold)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)
![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

**India's #1 Revenue Operating System for SMEs**

[Live Demo](https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/) · [Documentation](https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/docs/) · [Report Bug](https://github.com/11avatardigitalhub/11-Avatar-SMEs-CRM/issues) · [Request Feature](https://github.com/11avatardigitalhub/11-Avatar-SMEs-CRM/issues)

</div>

---

## 📊 Overview

**11 Avatar Digital Hub** is a complete Revenue Operating System that transforms how Indian SMEs acquire, manage, and retain customers. From lead capture to GST invoices — everything in one platform, starting from ₹0.

### 🎯 The Complete Revenue Lifecycle
Leads → Conversations → Deals → Revenue → Retention
📋 💬 🔄 💰 🔁

text

---

## ✨ Features

### 🏢 Core CRM Modules (15+)
| Module | Description |
|--------|-------------|
| 📋 **Lead Management** | Capture leads from WhatsApp, forms, ads, referrals. Auto-score & prioritize |
| 🔄 **Sales Pipeline** | 12-stage Kanban pipeline with drag-drop, revenue predictions |
| 👥 **Client Management** | 360° client view, auto-convert won deals, track renewals |
| 💰 **Revenue Tracking** | Track collections, set goals, real-time revenue monitoring |
| 🧾 **GST Invoices** | GST-compliant invoices, E-Invoice & E-Way Bill ready |
| 💳 **Payments** | Razorpay, Stripe, UPI, bank transfers with auto-reconciliation |
| 💬 **WhatsApp Integration** | CloudWA API - send messages, templates, broadcasts |
| 📅 **Calendar Sync** | Google Calendar & Outlook two-way sync |
| ✅ **Tasks** | Daily tasks, reminders, Kanban board |
| 🚀 **Projects** | Gantt charts, milestones, time tracking |
| 📈 **Reports** | 12+ chart types, KPI dashboards, scheduled reports |
| 🎓 **Training LMS** | Courses, quizzes, certifications |
| 🔗 **Referral Engine** | Multi-level referral tracking with commissions |
| 📢 **Campaigns** | Email, SMS, WhatsApp campaigns |
| 📥 **Omnichannel Inbox** | Unified inbox for all communication channels |

### 🔐 Enterprise Security
- **AES-256** encryption at rest
- **TLS 1.3** encryption in transit
- **8-Level RBAC** (Super Admin → Viewer)
- **Multi-Tenant** data isolation
- **Mumbai Data Center** (asia-south1)
- **GDPR, DPDP Act, CCPA** compliant

### 📱 PWA Ready
- Install on Android/iOS/Desktop
- Full offline support
- Push notifications
- Background sync

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS (ES6+), HTML5, CSS3 |
| **Backend** | Firebase Firestore, Cloud Functions (Node.js 20) |
| **Auth** | Firebase Auth (Email/Password, Google OAuth) |
| **API** | Cloudflare Workers |
| **Storage** | Firebase Storage + Cloud Storage |
| **PWA** | Service Worker, Web App Manifest |
| **Payments** | Razorpay, Stripe, UPI |
| **Messaging** | CloudWA (WhatsApp Business API) |
| **Hosting** | GitHub Pages + Firebase Hosting |
| **CI/CD** | GitHub Actions |

---

## 📁 Project Structure
11-Avatar-SMEs-CRM/
├── 📄 index.html # Landing page
├── 📄 login.html # Authentication
├── 📄 register.html # Registration
├── 📄 dashboard.html # Main dashboard (internal)
├── 📄 demo.html # Demo request page
├── 📄 about.html # About us
├── 📄 contact.html # Contact page
├── 📄 features.html # Features overview
├── 📄 integrations.html # Integrations listing
├── 📄 pricing.html # Pricing plans
├── 📄 privacy.html # Privacy policy
├── 📄 terms.html # Terms of service
├── 📄 refund.html # Refund policy
├── 📄 security.html # Security page
├── 📄 careers.html # Careers page
├── 📄 partners.html # Partner programs
├── 📄 404.html # Not found page
├── 📄 offline.html # Offline fallback
├── 📄 manifest.json # PWA manifest
├── 📄 sw.js # Service Worker
├── 📄 robots.txt # SEO crawler rules
├── 📄 sitemap.xml # Search engine sitemap
├── 📄 package.json # NPM configuration
├── 📄 firebase.json # Firebase configuration
├── 📄 .gitignore # Git ignore rules
├── 📄 .nojekyll # GitHub Pages config
├── 📄 LICENSE # GPL-3.0 License
│
├── 📁 src/
│ ├── 📁 css/
│ │ ├── main.css # Master stylesheet (1400+ lines)
│ │ ├── auth.css # Authentication styles
│ │ ├── landing.css # Landing page styles
│ │ └── dashboard.css # Dashboard styles
│ │
│ └── 📁 js/
│ ├── index.js # Landing page controller
│ ├── 📁 config/
│ │ ├── constants.js # App constants & enums
│ │ ├── firebase.js # Firebase service layer
│ │ └── routes.js # Route configuration
│ ├── 📁 auth/
│ │ ├── auth.js # Authentication manager
│ │ ├── login.js # Login controller
│ │ └── register.js # Registration controller
│ ├── 📁 core/
│ │ ├── app.js # Core application bootstrap
│ │ ├── router.js # Page navigation helper
│ │ ├── offline.js # Offline support manager
│ │ └── cache.js # Multi-layer caching
│ ├── 📁 components/ # 27 reusable UI components
│ ├── 📁 modules/ # 15 business modules
│ └── 📁 integrations/ # 16 third-party integrations
│
├── 📁 functions/ # Firebase Cloud Functions
├── 📁 database/ # Firestore rules & indexes
├── 📁 tests/ # 6 test suites
├── 📁 scripts/ # Build & deploy scripts
├── 📁 assets/ # Static assets (SVG)
├── 📁 icons/ # PWA icons (10 sizes)
└── 📁 docs/ # Documentation

text

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/11avatardigitalhub/11-Avatar-SMEs-CRM.git
cd 11-Avatar-SMEs-CRM

# Install dependencies
npm install

# Start local dev server
npm run dev

# Open in browser
open http://localhost:3000
Firebase Setup
bash
# Login to Firebase
firebase login

# Select project
firebase use avatar-wa-dual-crm

# Deploy Firestore rules
npm run deploy:rules

# Deploy Firestore indexes
npm run deploy:indexes

# Deploy Cloud Functions
npm run deploy:functions

# Deploy hosting
firebase deploy --only hosting
🔧 Available Scripts
Command	Description
npm start	Start local server
npm run dev	Start dev server on port 3000
npm test	Run all test suites
npm run test:watch	Run tests in watch mode
npm run test:coverage	Run tests with coverage report
npm run lint	Check code formatting
npm run lint:fix	Fix code formatting
npm run deploy	Deploy to GitHub Pages
npm run deploy:firebase	Deploy to Firebase (hosting + rules + functions)
npm run seed	Generate sample data
npm run audit	Run Lighthouse audit
🔒 Security
Encryption: AES-256 at rest, TLS 1.3 in transit

Authentication: Firebase Auth with 2FA support

Authorization: 8-level RBAC with granular permissions

Data Residency: Mumbai, India (asia-south1)

Compliance: GDPR, DPDP Act 2023, CCPA, IT Act 2000

Audit: Comprehensive audit logging for all operations

Backup: Automated daily backups with 30-day retention

For security concerns, contact: support@11avatardigitalhub.cloud

🎨 Design System
Element	Specification
Primary Color	#D4AF37 (Gold)
Background (Public)	#0A0A0A (Dark)
Background (Internal)	#F8F6F0 (Light)
Font Family	Inter + Poppins
Body Font Size	14px minimum
Touch Targets	44px minimum
Border Radius	12-24px
Breakpoints	320, 375, 425, 600, 768, 1024, 1280, 1440, 1920px
Theme	White/Gold/Black
📊 Project Stats
Metric	Value
Total Files	42+
HTML Pages	18
CSS Files	4 (2500+ lines)
JS Modules	50+
Components	27 reusable
Integrations	16 supported
Test Suites	6
PWA Icons	10 sizes
Breakpoints	8 responsive
🤝 Contributing
We welcome contributions! Please see our Contributing Guidelines.

Fork the repository

Create your feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

📝 License
This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

text
11 Avatar Digital Hub - Master Revenue CRM
Copyright (C) 2024-2026  11 Avatar Digital Hub
📞 Contact
Channel	Details
Email	info@11avatardigitalhub.cloud
Support	support@11avatardigitalhub.cloud
Website	11avatardigitalhub.cloud
GitHub	github.com/11avatardigitalhub
Live Demo	11-Avatar-SMEs-CRM
<div align="center">
🇮🇳 Made with ❤️ in India
Leads → Revenue → Retention — All in One Platform