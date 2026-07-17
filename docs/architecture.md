markdown
# 11 Avatar Digital Hub - System Architecture

## 📋 Document Information

| Property | Value |
|----------|-------|
| **Document Version** | 2.0.0 |
| **Last Updated** | July 16, 2026 |
| **Author** | Ananya Patel (CTO), Priya Singh (VP Engineering) |
| **Status** | Approved |
| **Classification** | Internal - Confidential |

---

## 🎯 Executive Summary

11 Avatar Digital Hub is a comprehensive, multi-tenant Customer Relationship Management (CRM) platform built for Indian businesses. The system follows a **serverless microservices architecture** leveraging Firebase/GCP for backend services and a modern SPA (Single Page Application) frontend.

**Key Architectural Decisions:**
- **Firebase-first approach** for rapid development and auto-scaling
- **SPA with client-side routing** for native-like user experience
- **Multi-tenant isolation** at the Firestore document level
- **Event-driven architecture** for loose coupling between modules
- **PWA-enabled** for offline capability and mobile installation
- **Edge computing** via Cloudflare Workers for API handling

---

## 🏗️ High-Level Architecture
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ Web App │ │ PWA App │ │ Mobile Web │ │ Admin Panel │ │
│ │ (SPA/ESM) │ │ (Offline) │ │ (Responsive)│ │ (Internal) │ │
│ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ │
│ │ │ │ │ │
│ └────────────────┴────────┬───────┴────────────────┘ │
│ │ │
└───────────────────────────────────┼─────────────────────────────────────┘
│
┌───────────────┴───────────────┐
│ EDGE LAYER │
│ ┌─────────────────────────┐ │
│ │ Cloudflare Workers API │ │
│ │ (REST + WebSocket) │ │
│ └─────────────────────────┘ │
└───────────────┬───────────────┘
│
┌───────────────────────────────────┼─────────────────────────────────────┐
│ BACKEND LAYER │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│ │ Firebase Auth │ │ Cloud Functions │ │ Firestore Database │ │
│ │ (Authentication)│ │ (Serverless) │ │ (NoSQL Document DB) │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│ │ Cloud Storage │ │ Cloud Scheduler │ │ Pub/Sub Messaging │ │
│ │ (Files/Backups) │ │ (Cron Jobs) │ │ (Event Bus) │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
│
┌───────────────────────────────────┼─────────────────────────────────────┐
│ INTEGRATION LAYER │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│ │ WhatsApp │ │ Razorpay │ │ Google │ │ Tally │ │ Zapier │ │
│ │ (CloudWA) │ │ Stripe │ │ Calendar │ │ ERP │ │ Webhook │ │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

text

---

## 📁 Project Structure
11-Avatar-SMEs-CRM/
├── public/ # Public-facing static pages (Dark Theme)
│ ├── index.html # Landing page
│ ├── login.html # Login page
│ ├── register.html # Registration page
│ ├── pricing.html # Pricing plans
│ ├── features.html # Feature showcase
│ ├── about.html # About company
│ ├── careers.html # Job listings
│ ├── contact.html # Contact form
│ ├── demo.html # Demo request
│ ├── partners.html # Partner program
│ ├── integrations.html # Integration catalog
│ ├── security.html # Security information
│ ├── terms.html # Terms of service
│ ├── privacy.html # Privacy policy
│ ├── refund.html # Refund policy
│ ├── 404.html # Error page
│ ├── offline.html # Offline fallback
│ ├── manifest.json # PWA manifest
│ ├── sw.js # Service Worker
│ ├── robots.txt # SEO robots
│ ├── sitemap.xml # XML sitemap
│ ├── assets/ # Brand images
│ ├── icons/ # PWA icons
│ └── fonts/ # Font files
│
├── src/ # Application source code
│ ├── css/ # Stylesheets
│ │ ├── main.css # Core styles & design system
│ │ ├── components.css # Reusable component styles
│ │ ├── dashboard.css # Dashboard layout
│ │ ├── auth.css # Authentication pages
│ │ ├── landing.css # Landing page styles
│ │ └── mobile.css # Mobile responsive
│ │
│ ├── js/ # JavaScript modules
│ │ ├── index.js # Application entry point
│ │ ├── config/ # Configuration
│ │ │ ├── firebase.js # Firebase initialization
│ │ │ ├── constants.js # App constants
│ │ │ └── routes.js # Route definitions
│ │ ├── core/ # Core system
│ │ │ ├── app.js # Main application
│ │ │ ├── router.js # SPA Router
│ │ │ ├── state.js # State management
│ │ │ ├── eventBus.js # Event system
│ │ │ ├── api.js # API handler
│ │ │ ├── cache.js # Cache manager
│ │ │ └── offline.js # Offline support
│ │ ├── auth/ # Authentication
│ │ │ ├── auth.js # Auth manager
│ │ │ ├── login.js # Login controller
│ │ │ ├── register.js # Register controller
│ │ │ ├── permissions.js # RBAC permissions
│ │ │ ├── roles.js # Role management
│ │ │ ├── session.js # Session management
│ │ │ └── middleware.js # Auth middleware
│ │ ├── components/ # Reusable UI components (20+)
│ │ │ ├── modal.js # Dialog windows
│ │ │ ├── toast.js # Notification toasts
│ │ │ ├── navbar.js # Navigation bar
│ │ │ ├── kanban.js # Kanban board
│ │ │ ├── chart.js # Chart/graph
│ │ │ ├── dataTable.js # Data table
│ │ │ ├── tabs.js # Tab navigation
│ │ │ ├── treeView.js # Hierarchical tree
│ │ │ ├── datePicker.js # Date picker
│ │ │ ├── colorPicker.js # Color picker
│ │ │ ├── fileUpload.js # File upload
│ │ │ ├── searchBar.js # Search bar
│ │ │ ├── richTextEditor.js # Rich text editor
│ │ │ ├── stepper.js # Step wizard
│ │ │ ├── timeline.js # Timeline display
│ │ │ ├── carousel.js # Image carousel
│ │ │ ├── drawer.js # Slide panel
│ │ │ ├── contextMenu.js # Right-click menu
│ │ │ ├── commandPalette.js # Command palette
│ │ │ ├── tagInput.js # Tag input
│ │ │ ├── avatarStack.js # Avatar grouping
│ │ │ ├── breadcrumb.js # Breadcrumb nav
│ │ │ ├── progressBar.js # Progress bar
│ │ │ ├── skeleton.js # Loading skeleton
│ │ │ ├── rating.js # Star rating
│ │ │ ├── infiniteScroll.js # Infinite scroll
│ │ │ └── signaturePad.js # Digital signature
│ │ ├── modules/ # Business modules (15)
│ │ │ ├── dashboard.js # Dashboard
│ │ │ ├── leads.js # Lead management
│ │ │ ├── clients.js # Client management
│ │ │ ├── pipeline.js # Sales pipeline
│ │ │ ├── invoices.js # GST invoicing
│ │ │ ├── payments.js # Payment processing
│ │ │ ├── revenue.js # Revenue tracking
│ │ │ ├── tasks.js # Task management
│ │ │ ├── projects.js # Project management
│ │ │ ├── retainers.js # Retainer management
│ │ │ ├── training.js # Training LMS
│ │ │ ├── referrals.js # Referral engine
│ │ │ ├── reports.js # Reports & analytics
│ │ │ ├── notifications.js # Notifications
│ │ │ ├── settings.js # Settings management
│ │ │ └── whatsapp.js # WhatsApp integration
│ │ ├── integrations/ # Third-party integrations (14)
│ │ │ ├── calendar.js # Google/Outlook Calendar
│ │ │ ├── maps.js # Google Maps
│ │ │ ├── payment.js # Payment gateways
│ │ │ ├── email.js # Email (SMTP/SendGrid)
│ │ │ ├── sms.js # SMS (MSG91/Twilio)
│ │ │ ├── gst.js # GST compliance
│ │ │ ├── social.js # Social media
│ │ │ ├── webhook.js # Webhook manager
│ │ │ ├── slack.js # Slack integration
│ │ │ ├── zapier.js # Zapier integration
│ │ │ ├── googleDrive.js # Google Drive
│ │ │ ├── dropbox.js # Dropbox
│ │ │ ├── tally.js # Tally ERP
│ │ │ ├── zoho.js # Zoho suite
│ │ │ ├── hubspot.js # HubSpot CRM
│ │ │ └── salesforce.js # Salesforce
│ │ └── utils/ # Utility modules
│ │ ├── helpers.js # Helper functions
│ │ ├── formatters.js # Data formatters
│ │ ├── validators.js # Input validators
│ │ ├── exporters.js # Data export
│ │ ├── importers.js # Data import
│ │ └── backup.js # Backup & restore
│ │
│ └── pages/ # Internal app pages (Light Theme)
│ ├── dashboard.html # Main dashboard
│ ├── leads.html # Lead management
│ ├── clients.html # Client management
│ ├── pipeline.html # Pipeline view
│ ├── invoices.html # Invoice management
│ ├── payments.html # Payment tracking
│ ├── revenue.html # Revenue analytics
│ ├── tasks.html # Task board
│ ├── projects.html # Project management
│ ├── retainers.html # Retainer tracking
│ ├── training.html # Training LMS
│ ├── referrals.html # Referral management
│ ├── reports.html # Reports dashboard
│ ├── settings.html # System settings
│ ├── whatsapp.html # WhatsApp interface
│ ├── inbox.html # Unified inbox
│ ├── chat.html # Chat interface
│ ├── contacts.html # Contact management
│ ├── appointments.html # Appointment calendar
│ ├── campaigns.html # Campaign management
│ ├── proposals.html # Proposal builder
│ ├── audit.html # Audit logs
│ ├── history.html # Activity history
│ ├── profile.html # User profile
│ ├── customers.html # Customer portal
│ ├── api-docs.html # API documentation
│ ├── changelog.html # Release notes
│ ├── support.html # Support center
│ ├── admin.html # Admin panel
│ └── error.html # Error page
│
├── functions/ # Firebase Cloud Functions
│ ├── index.js # Functions entry point
│ ├── payment-webhook.js # Payment webhook handler
│ ├── email-sender.js # Email delivery service
│ ├── sms-sender.js # SMS delivery service
│ ├── backup-scheduler.js # Automated backup cron
│ └── data-cleanup.js # Data maintenance cron
│
├── workers/ # Cloudflare Workers
│ └── 11avatar-api/ # Main API worker
│
├── database/ # Database schemas
│ ├── schema.sql # PostgreSQL schema
│ ├── firestore.rules # Firestore security rules
│ ├── firestore.indexes.json # Firestore indexes
│ └── migrations/ # Database migrations
│ ├── v1.sql # Initial schema
│ └── v2.sql # Module enhancements
│
├── tests/ # Test suites
│ ├── unit/ # Unit tests
│ │ ├── core.test.js # Core module tests
│ │ ├── auth.test.js # Auth module tests
│ │ ├── modules.test.js # Business module tests
│ │ ├── components.test.js # UI component tests
│ │ └── integrations.test.js # Integration tests
│ └── e2e/ # End-to-end tests
│ └── app.test.js # Full application E2E
│
├── scripts/ # Automation scripts
│ ├── deploy-production.sh # Production deployment
│ ├── deploy-staging.sh # Staging deployment
│ ├── build.sh # Build system
│ └── seed-data.js # Database seeding
│
├── docs/ # Documentation
│ ├── architecture.md # This document
│ ├── api-reference.md # API reference
│ ├── deployment-guide.md # Deployment instructions
│ ├── development-setup.md # Dev environment setup
│ ├── contributing.md # Contribution guidelines
│ ├── security-policy.md # Security policies
│ ├── user-guide.md # End-user guide
│ ├── integration-guide.md # Integration setup
│ └── faq.md # Frequently asked questions
│
├── .github/ # GitHub configuration
│ ├── workflows/ # CI/CD workflows
│ │ └── deploy.yml # Deployment workflow
│ ├── ISSUE_TEMPLATE/ # Issue templates
│ │ ├── bug_report.md # Bug report form
│ │ └── feature_request.md # Feature request form
│ ├── PULL_REQUEST_TEMPLATE.md # PR template
│ ├── CODEOWNERS # Code ownership
│ └── FUNDING.yml # Sponsorship config
│
├── config/ # Configuration files
│ └── security.xml # Security headers
│
├── firebase.json # Firebase configuration
├── .firebaserc # Firebase project alias
├── wrangler.toml # Cloudflare Worker config
├── package.json # NPM configuration
├── .gitignore # Git ignore rules
├── LICENSE # GPL-3.0 license
└── README.md # Project readme

text

---

## 🔄 Data Flow Architecture

### Authentication Flow
User → Login Page → Firebase Auth → JWT Token → Firestore (User Doc)
↓
Session Management
↓
RBAC Permission Check
↓
Route Guard (Middleware)

text

### CRUD Operation Flow
User Action → Component → Module → EventBus → API Handler → Cloudflare Worker
↓
Firebase Functions
↓
Firestore
↓
Response to Client

text

### Real-Time Data Flow
Firestore Change → onSnapshot Listener → State Update → UI Re-render
↓
EventBus Emit
↓
Other Modules Notified

text

### Payment Flow
Invoice Created → Payment Gateway (Razorpay/Stripe) → Webhook → Cloud Function
↓
Payment Verified
↓
Invoice Updated
↓
Notification Sent

text

### WhatsApp Flow
CRM → CloudWA API → WhatsApp Business API → End User Phone
↓
Incoming Message
↓
Webhook → CloudWA → CRM

text

---

## 🗄️ Database Design

### Firestore Collections (NoSQL)

| Collection | Purpose | Multi-Tenant Key |
|------------|---------|------------------|
| `organizations` | Tenant/company profiles | `id` |
| `users` | User accounts with RBAC | `organizationId` |
| `clients` | Client/company master data | `organizationId` |
| `contacts` | Contact persons | `organizationId` |
| `leads` | Lead/prospect tracking | `organizationId` |
| `deals` | Sales pipeline | `organizationId` |
| `invoices` | GST-compliant invoices | `organizationId` |
| `payments` | Payment transactions | `organizationId` |
| `tasks` | Task management | `organizationId` |
| `projects` | Project management | `organizationId` |
| `retainers` | Retainer agreements | `organizationId` |
| `courses` | Training courses | `organizationId` |
| `enrollments` | Course enrollments | `organizationId` |
| `referrals` | Referral tracking | `organizationId` |
| `partners` | Partner/affiliate data | `organizationId` |
| `notifications` | Multi-channel notifications | `organizationId` |
| `calendar_events` | Calendar integration | `organizationId` |
| `whatsapp_messages` | WhatsApp chat history | `organizationId` |
| `email_queue` | Email delivery queue | `organizationId` |
| `sms_queue` | SMS delivery queue | `organizationId` |
| `webhook_events` | Webhook event log | `organizationId` |
| `audit_logs` | Audit trail (partitioned) | `organizationId` |
| `settings` | Organization settings | `organizationId` |
| `backup_history` | Backup records | `organizationId` |

### PostgreSQL Tables (SQL - for reporting)

Used for complex queries, aggregations, and business intelligence:
- `core.organizations`, `core.users`, `core.sessions`, `core.api_keys`
- `crm.clients`, `crm.contacts`, `crm.leads`, `crm.deals`, `crm.activities`
- `finance.invoices`, `finance.invoice_items`, `finance.payments`, `finance.retainers`
- `projects.tasks`, `projects.time_logs`
- `training.courses`, `training.modules`, `training.lessons`, `training.enrollments`
- `crm.referrals`, `crm.partners`, `finance.commissions`
- `calendar.events`, `calendar.event_attendees`
- `communication.whatsapp_messages`, `communication.whatsapp_conversations`

---

## 🔐 Security Architecture

### Authentication
- **Firebase Authentication** with email/password and OAuth providers
- JWT token-based session management
- Two-Factor Authentication (2FA) support via TOTP/SMS/Email
- API Key authentication for server-to-server access
- Session timeout and concurrent session limits

### Authorization (RBAC)
8-level Role-Based Access Control:
1. **Super Admin** - Full system access
2. **Admin** - Organization management
3. **Manager** - Team and module management
4. **Team Lead** - Team oversight
5. **Sales Rep** - Sales operations
6. **Support Agent** - Customer support
7. **Trainer** - Training management
8. **Partner** - Limited partner access
9. **Client** - Client portal access
10. **Viewer** - Read-only access

### Data Isolation
- Multi-tenant isolation via `organizationId` field on all documents
- Firestore security rules enforce organization-level access
- API-level tenant verification on every request

### Encryption
- **At Rest:** AES-256 encryption (Firestore/Cloud Storage default)
- **In Transit:** TLS 1.3 with HSTS preloading
- **Backups:** Encrypted with customer-managed keys (CMEK) option

---

## 🚀 Deployment Architecture

### Production Environment
- **Frontend:** Firebase Hosting (CDN-backed, global edge caching)
- **API:** Cloudflare Workers (edge computing, 200+ global PoPs)
- **Backend:** Firebase Cloud Functions (serverless, auto-scaling)
- **Database:** Firestore (NoSQL) + Cloud SQL (PostgreSQL for reporting)
- **Storage:** Firebase Cloud Storage (GCS backend)
- **Scheduled Tasks:** Cloud Scheduler → Pub/Sub → Cloud Functions
- **Monitoring:** Firebase Crashlytics + Google Cloud Monitoring
- **CI/CD:** GitHub Actions → Automated testing → Firebase Deploy

### Staging Environment
- Firebase preview channels for branch deployments
- Separate Cloudflare Worker staging environment
- Source maps enabled for debugging
- Extended logging and monitoring

### Development Environment
- Firebase emulator suite for local development
- Hot module replacement via watch mode
- Mock API server for offline development
- ESLint + Prettier for code quality

---

## 📊 Performance Considerations

### Frontend Performance
- **Code Splitting:** ESM dynamic imports for lazy loading
- **Bundle Optimization:** esbuild with tree-shaking and minification
- **Caching:** Service Worker with Cache API for offline access
- **Image Optimization:** WebP format with lazy loading
- **Font Loading:** `font-display: swap` for perceived performance

### Backend Performance
- **Edge Computing:** API requests served from nearest Cloudflare PoP
- **Database Indexing:** Composite indexes for common query patterns
- **Caching:** In-memory cache for frequently accessed data
- **Batching:** Batched writes for bulk operations (500 docs/batch)
- **Pagination:** Cursor-based pagination for large datasets
- **Rate Limiting:** Per-user, per-endpoint rate limiting

---

## 🔄 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Vanilla JavaScript (ES2020+) | SPA application logic |
| **Bundler** | esbuild | JavaScript/CSS bundling |
| **Styling** | CSS3 with Custom Properties | Design system & theming |
| **Icons** | Font Awesome 6 | Icon library |
| **Fonts** | Inter, Poppins, Fira Code | Typography |
| **Auth** | Firebase Authentication | User authentication |
| **Database** | Firestore + Cloud SQL | Primary + Reporting DB |
| **Functions** | Firebase Cloud Functions | Serverless backend |
| **Edge API** | Cloudflare Workers | API gateway |
| **Storage** | Firebase Cloud Storage | File storage |
| **Messaging** | Firebase Cloud Messaging | Push notifications |
| **CI/CD** | GitHub Actions | Automated deployment |
| **Hosting** | Firebase Hosting + GitHub Pages | Static hosting |
| **Monitoring** | Firebase Crashlytics + GCP | Error tracking |
| **Testing** | Custom test framework | Unit + Integration + E2E |

---

## 📐 Design Patterns

| Pattern | Implementation |
|---------|---------------|
| **Module Pattern** | ES Modules with singleton exports |
| **Observer Pattern** | EventBus for inter-module communication |
| **Factory Pattern** | Static `create()` methods on components |
| **Command Pattern** | Command palette with action registry |
| **State Pattern** | Centralized state management |
| **Strategy Pattern** | Payment gateway abstraction |
| **Decorator Pattern** | Middleware chain for auth |
| **Proxy Pattern** | API handler with caching layer |
| **MVC Pattern** | Module (Controller) + State (Model) + Component (View) |

---

## 📞 Contact

For architecture questions or suggestions:
- **CTO:** Hina - info@11avatardigitalhub.cloud
- **VP Engineering:** Pooja - support@11avatardigitalhub.cloud
- **Documentation:** info@11avatardigitalhub.cloud

