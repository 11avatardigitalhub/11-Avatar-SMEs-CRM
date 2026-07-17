# 11 Avatar Digital Hub - Frequently Asked Questions

## 📋 Document Information

| Property | Value |
|----------|-------|
| **Document Version** | 2.0.0 |
| **Last Updated** | July 16, 2026 |
| **Author** | Rahul Sharma (CEO), Neha Kapoor (Head of Design) |
| **Contact** | support@11avatardigitalhub.cloud |

---

## 📚 FAQ Categories

1. [General Questions](#general-questions)
2. [Pricing & Billing](#pricing--billing)
3. [Account & Security](#account--security)
4. [Features & Functionality](#features--functionality)
5. [GST & Invoicing](#gst--invoicing)
6. [Payments](#payments)
7. [WhatsApp Integration](#whatsapp-integration)
8. [Integrations](#integrations)
9. [Technical Questions](#technical-questions)
10. [Mobile & PWA](#mobile--pwa)
11. [Data & Privacy](#data--privacy)
12. [Support & Training](#support--training)

---

## General Questions

### Q1: What is 11 Avatar Digital Hub?
**A:** 11 Avatar Digital Hub is a comprehensive, all-in-one Customer Relationship Management (CRM) platform designed specifically for Indian businesses. It combines lead management, GST invoicing, payment collection, WhatsApp integration, project management, training LMS, and advanced analytics into a single unified platform.

### Q2: Who is this platform for?
**A:** The platform is designed for:
- **Small and Medium Businesses (SMBs)** looking for affordable CRM
- **Sales Teams** managing leads and deals
- **Service Businesses** needing invoicing and payments
- **Educational Institutes** offering training and courses
- **Agencies** managing multiple clients and projects
- **Freelancers** tracking clients and income
- **Enterprises** needing multi-tenant architecture

### Q3: How is this different from other CRMs?
**A:** Key differentiators:
- **India-First Design:** Built for Indian GST, invoicing, and compliance
- **All-in-One Platform:** CRM + Invoicing + Payments + WhatsApp + Training
- **WhatsApp Native:** Deep WhatsApp Business API integration via CloudWA
- **Multi-Tenant:** One installation serves multiple organizations
- **PWA Enabled:** Works offline, installable on mobile
- **Open Source:** GPL-3.0 licensed, self-hostable
- **No Per-User Pricing:** Simple flat-rate plans

### Q4: Is there a free version?
**A:** Yes! We offer a **Free plan** with:
- Up to 5 users
- Lead and client management
- Basic pipeline (Kanban)
- 50 GST invoices per month
- Payment collection
- Task management
- Email support

No credit card required. Upgrade anytime for more features.

### Q5: Can I self-host 11 Avatar Digital Hub?
**A:** Yes! The platform is open-source under GPL-3.0 license. You can:
- Clone the repository from GitHub
- Deploy to your own Firebase project
- Customize and extend as needed
- See our deployment guide for instructions

---

## Pricing & Billing

### Q6: How does pricing work?
**A:** We offer three paid plans plus a free plan:

| Plan | Price (Monthly) | Users | Key Features |
|------|-----------------|-------|--------------|
| **Free** | ₹0 | 5 | Basic CRM, 50 invoices |
| **Starter** | ₹999/user | 5 | Full CRM, invoicing, payments |
| **Business** | ₹2,499/user | 25 | WhatsApp, projects, training, reports |
| **Enterprise** | ₹4,999/user | Unlimited | API, white-label, custom integrations |

Annual billing saves 20%. All plans include a 14-day free trial.

### Q7: What payment methods do you accept?
**A:** We accept:
- **Indian Customers:** UPI, Credit/Debit Cards, Net Banking, Bank Transfer
- **International Customers:** Stripe, PayPal
- All payments are processed securely via Razorpay or Stripe

### Q8: Do you offer discounts?
**A:** Yes! We offer:
- **Startup Discount:** 30% off for first 12 months (registered startups)
- **Non-Profit Discount:** 50% off for registered NGOs
- **Educational Discount:** 40% off for educational institutions
- **Annual Billing:** 20% off compared to monthly
- **Volume Discount:** Custom pricing for 50+ users

Contact **support@11avatardigitalhub.cloud** to apply.

### Q9: Can I change plans later?
**A:** Absolutely! You can upgrade or downgrade anytime:
- **Upgrade:** Immediate access to new features, prorated billing
- **Downgrade:** Changes apply at next billing cycle
- Data is preserved when downgrading (may become inaccessible but not deleted)

### Q10: What is your refund policy?
**A:** See our full refund policy at `/refund.html`. Summary:
- **Monthly plans:** Non-refundable (cancel anytime, no further charges)
- **Annual plans:** Prorated refund within first 30 days
- **Service Credits:** For downtime exceeding 0.5% in a month
- **Billing Errors:** Full refund of incorrect charges

---

## Account & Security

### Q11: How do I create an account?
**A:** 

1. Visit **https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/**

2. Click **"Get Started Free"**
3. Enter your name, email, phone, company name, and password
4. Verify your email address
5. Complete your profile setup
6. Start using the platform

### Q12: I forgot my password. What do I do?
**A:**
1. Go to the login page
2. Click **"Forgot Password?"**
3. Enter your registered email address
4. Check your email for a password reset link
5. Click the link and set a new password
6. Log in with your new password

### Q13: How do I enable Two-Factor Authentication (2FA)?
**A:**
1. Go to **Settings → Security**
2. Click **"Enable Two-Factor Authentication"**
3. Choose your preferred method:
   - **Authenticator App:** Scan QR code with Google Authenticator, Authy, or similar
   - **SMS:** Receive codes via text message
   - **Email:** Receive codes via email
4. Enter the verification code to confirm
5. Save backup recovery codes in a safe place
6. 2FA is now active

### Q14: How secure is my data?
**A:** Security is our top priority:
- **Encryption:** AES-256 at rest, TLS 1.3 in transit
- **Infrastructure:** Google Cloud Platform (Mumbai data center)
- **Authentication:** Firebase Auth with 2FA support
- **Authorization:** 10-level RBAC with granular permissions
- **Audit Logging:** All data access and changes logged
- **Backups:** Daily automated backups with encryption
- **Compliance:** GDPR, DPDP Act 2023, IT Act 2000, CCPA

See our full security policy at `/security.html` or `/docs/security-policy.md`.

### Q15: Can multiple team members use the same account?
**A:** No. Each team member should have their own user account. You can:
- Add team members from **Settings → Users**
- Assign specific roles and permissions
- Each user gets their own login credentials
- Activity is tracked per user for accountability

---

## Features & Functionality

### Q16: How does lead management work?
**A:** The lead management system allows you to:
1. **Capture leads** from multiple sources (website, WhatsApp, manual entry, CSV import)
2. **Qualify leads** using scoring based on engagement and profile completeness
3. **Assign leads** to team members
4. **Track communication** history automatically
5. **Convert leads** to clients when ready
6. **Analyze conversion rates** with built-in reports

### Q17: Can I import existing data?
**A:** Yes! We support bulk import for:
- **Leads:** CSV, Excel (.xlsx), JSON formats
- **Clients:** CSV with company details, GSTIN, contacts
- **Contacts:** CSV with name, email, phone, designation
- **Products/Services:** CSV with name, price, HSN/SAC codes

The import wizard guides you through:
1. Upload file
2. Map columns to CRM fields
3. Validate data
4. Review and import

### Q18: Can I export my data?
**A:** Yes! Export is available in multiple formats:
- **CSV:** For spreadsheet applications
- **Excel (.xlsx):** Formatted with multiple sheets
- **PDF:** Professional reports with charts
- **JSON:** For programmatic access

Export options include:
- Filter data before export
- Select specific columns
- Schedule recurring exports
- Bulk export all modules

### Q19: How does the Kanban pipeline work?
**A:** The Kanban pipeline provides a visual drag-and-drop interface:
- **Columns** represent deal stages (Lead, Qualified, Proposal, etc.)
- **Cards** represent individual deals
- **Drag** cards between columns to update stage
- **Click** cards to view/edit details
- **Filter** by owner, value, probability
- **WIP Limits** prevent column overload
- **Keyboard Navigation** for power users

### Q20: Can I customize the pipeline stages?
**A:** Yes! Go to **Settings → Pipeline** to:
- Add, rename, or remove stages
- Change stage colors
- Set WIP (Work In Progress) limits per stage
- Define allowed transitions between stages
- Reorder stages

---

## GST & Invoicing

### Q21: Does the system handle GST automatically?
**A:** Yes! The GST engine automatically:
- Calculates CGST + SGST for intra-state supplies
- Calculates IGST for inter-state supplies
- Determines inter/intra state based on GSTIN codes
- Supports all GST rate slabs (0%, 5%, 12%, 18%, 28%)
- Generates GST-compliant invoice formats
- Includes HSN/SAC code library with search

### Q22: How do I generate an E-Invoice?
**A:** For B2B invoices above ₹50,000:
1. Create the invoice normally
2. Click **"Generate E-Invoice"**
3. System submits to IRP (Invoice Registration Portal)
4. IRN (Invoice Reference Number) is generated automatically
5. QR code is embedded in the invoice PDF
6. E-Invoice status can be tracked

**Requirements:**
- Valid GSTIN for both seller and buyer
- Active IRP credentials configured in settings
- Invoice amount ≥ ₹50,000 (B2B)

### Q23: How do I generate an E-Way Bill?
**A:** For goods transport above ₹50,000:
1. Open the invoice
2. Click **"Generate E-Way Bill"**
3. Enter transport details:
   - Transporter ID or Name
   - Vehicle Number (if known)
   - Approximate distance in kilometers
4. E-Way Bill number is generated
5. Valid for: 1 day per 100 km (minimum 1 day)

### Q24: What HSN/SAC codes should I use?
**A:** Common codes for IT/Digital services:

| Code | Description | GST Rate |
|------|-------------|----------|
| 998311 | IT Consulting Services | 18% |
| 998312 | Software Development | 18% |
| 998313 | Website Design & Development | 18% |
| 998314 | Digital Marketing Services | 18% |
| 998315 | Content Writing Services | 18% |
| 998316 | Graphic Design Services | 18% |
| 998317 | Video Production Services | 18% |
| 998318 | Social Media Management | 18% |

Use the HSN/SAC lookup tool in the invoice form to find correct codes.

### Q25: Can I customize the invoice template?
**A:** Yes! Go to **Settings → Invoices → Templates** to:
- Upload your company logo
- Choose color scheme
- Customize header and footer
- Add bank details for payment
- Set default payment terms
- Include custom fields

---

## Payments

### Q26: What payment methods can my clients use?
**A:** Your clients can pay via:
- **UPI:** Google Pay, PhonePe, Paytm, BHIM
- **Cards:** Credit and Debit Cards (Visa, Mastercard, RuPay)
- **Net Banking:** 50+ Indian banks
- **Bank Transfer:** NEFT, RTGS, IMPS
- **Digital Wallets:** Paytm, Mobikwik, Freecharge
- **International:** Stripe, PayPal (for global clients)

### Q27: How do payment links work?
**A:** Every invoice automatically gets a payment link:
1. Client receives invoice with **"Pay Now"** button
2. Clicks to open secure payment page
3. Chooses payment method
4. Completes payment
5. Invoice status updates automatically to "Paid"
6. Payment receipt is generated and sent

### Q28: How long do payments take to reconcile?
**A:** Reconciliation time by method:
- **UPI:** Instant (real-time webhook)
- **Cards:** Instant to 2 business days
- **Net Banking:** 1-2 business days
- **NEFT:** Same day (batches hourly)
- **RTGS:** Real-time
- **IMPS:** Real-time
- **Cheque:** 2-5 business days

### Q29: What are the payment gateway charges?
**A:** Charges vary by gateway and method:

| Gateway | UPI | Cards (Domestic) | Net Banking | International |
|---------|-----|------------------|-------------|---------------|
| **Razorpay** | 0% | 2% | 2% | 3% |
| **Stripe** | N/A | 2% | N/A | 3% |
| **PayPal** | N/A | 2.5% | N/A | 4.4% |

Note: UPI payments via Razorpay have zero processing fees.

---

## WhatsApp Integration

### Q30: How do I connect WhatsApp?
**A:** 
1. Go to **Settings → Integrations → WhatsApp**
2. Click **"Connect WhatsApp"**
3. Log in to CloudWA (cloudwa.11avatardigitalhub.cloud)
4. Scan the QR code with your phone
5. Wait for connection confirmation
6. Start messaging!

### Q31: Can I use my personal WhatsApp number?
**A:** We recommend using a **WhatsApp Business API** number for:
- Higher messaging limits
- Template messaging
- Automation rules
- Multiple agent support
- Official business profile

Personal WhatsApp numbers work for testing but have limitations.

### Q32: How do message templates work?
**A:** Templates are pre-approved message formats:
1. Create template in WhatsApp Manager or CRM
2. Submit to Meta for approval (24-48 hours)
3. Once approved, use in:
   - Manual messaging
   - Automation rules
   - Bulk broadcasts
   - Payment reminders

Templates support variables like `{{1}}`, `{{2}}` for personalization.

### Q33: What are the WhatsApp messaging limits?
**A:** Limits depend on your WhatsApp Business account status:

| Status | Messaging Limit |
|--------|----------------|
| **Trial** | 250 business-initiated conversations/24 hours |
| **Verified** | 1,000 conversations/24 hours |
| **High Quality** | 10,000 conversations/24 hours |
| **High Volume** | 100,000+ conversations/24 hours |

Limits increase as your account quality score improves.

---

## Integrations

### Q34: What integrations are available?
**A:** We offer 16 native integrations:

| Category | Integrations |
|----------|-------------|
| **Communication** | WhatsApp (CloudWA), Email (SMTP/SendGrid/Mailgun), SMS (MSG91/Twilio), Slack |
| **Payments** | Razorpay, Stripe, PayPal |
| **Calendar** | Google Calendar, Outlook Calendar |
| **Storage** | Google Drive, Dropbox |
| **ERP** | Tally Prime/ERP 9 |
| **CRM** | Zoho (CRM + Books), HubSpot, Salesforce |
| **Automation** | Zapier (5000+ apps via webhooks) |

See `/docs/integration-guide.md` for detailed setup instructions.

### Q35: Do you have a REST API?
**A:** Yes! Our REST API provides:
- 200+ endpoints across all modules
- JWT and API Key authentication
- Rate limiting with clear headers
- Comprehensive error responses
- Pagination, filtering, sorting
- Webhooks for real-time events

API documentation: `/docs/api-reference.md` or `/api-docs.html`

### Q36: Can I build custom integrations?
**A:** Absolutely! Options include:
- **REST API:** Full programmatic access to all features
- **Webhooks:** Real-time event notifications
- **Zapier:** Connect with 5000+ apps no-code
- **Custom Functions:** Extend with Firebase Cloud Functions
- **TDL Plugin:** Custom Tally integration

Contact **support@11avatardigitalhub.cloud** for enterprise integration support.

---

## Technical Questions

### Q37: What is the technology stack?
**A:** 
- **Frontend:** Vanilla JavaScript (ES2020+), CSS3, HTML5
- **Bundler:** esbuild
- **Backend:** Firebase Cloud Functions (Node.js)
- **Database:** Firestore (NoSQL) + Cloud SQL (PostgreSQL)
- **API Gateway:** Cloudflare Workers
- **Authentication:** Firebase Authentication
- **Storage:** Firebase Cloud Storage
- **Hosting:** Firebase Hosting + GitHub Pages
- **CI/CD:** GitHub Actions
- **Monitoring:** Firebase Crashlytics, Google Cloud Monitoring

### Q38: Can I access the database directly?
**A:** Direct database access is available on Enterprise plan:
- Firestore SDK access with API key
- Cloud SQL access via SSL certificate
- Read replicas for reporting
- Database exports for backup

Standard plans access data through the REST API only.

### Q39: Do you support custom domains?
**A:** Yes! Available on Business and Enterprise plans:
- Custom domain for your CRM instance
- White-label option (Enterprise only)
- Custom email domain for notifications
- SSL certificate included

Setup takes 24-48 hours after domain verification.

### Q40: What browsers are supported?
**A:** We support the latest two versions of:
- **Google Chrome** (recommended)
- **Mozilla Firefox**
- **Apple Safari**
- **Microsoft Edge**
- **Opera**

Mobile browsers:
- Chrome for Android
- Safari for iOS
- Samsung Internet

Internet Explorer 11 is **not** supported.

---

## Mobile & PWA

### Q41: Is there a mobile app?
**A:** 11 Avatar Digital Hub is a **Progressive Web App (PWA)**:
- No app store download needed
- Install directly from browser
- Works on Android and iOS
- Functions offline
- Receives push notifications
- Uses device camera for document scanning
- Access from any device with a browser

### Q42: How do I install the PWA?
**A:**
**Android (Chrome):**
1. Visit the CRM URL in Chrome
2. Tap the menu (⋮)
3. Tap **"Add to Home Screen"**
4. Tap **"Install"**

**iOS (Safari):**
1. Visit the CRM URL in Safari
2. Tap the Share button (□↑)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**

### Q43: Does it work offline?
**A:** Yes! The PWA includes offline support:
- **Cached Data:** Previously viewed pages load offline
- **Offline Actions:** Create leads, tasks (synced when online)
- **Dashboard:** Cached metrics viewable offline
- **Service Worker:** Manages caching automatically
- **Sync:** Changes queue and sync when connection returns

---

## Data & Privacy

### Q44: Where is my data stored?
**A:** Your data is stored on **Google Cloud Platform** servers in **Mumbai, India** (asia-south1 region). This ensures:
- Data residency compliance for Indian businesses
- Low latency for Indian users
- GDPR-compliant data processing agreements available

### Q45: Who owns my data?
**A:** **You own your data.** Period.
- We do not claim ownership of your business data
- You can export all your data anytime
- Data is deleted within 90 days of account termination
- We never sell or share your data with third parties

### Q46: How do I delete my account and data?
**A:**
1. Go to **Settings → Account**
2. Click **"Delete Account"**
3. Confirm by entering your password
4. Choose data export option (download before deletion)
5. Account is deactivated immediately
6. Data is permanently deleted within 90 days

### Q47: Are you GDPR compliant?
**A:** Yes. We comply with:
- **GDPR** (EU General Data Protection Regulation)
- **DPDP Act 2023** (India's Digital Personal Data Protection Act)
- **CCPA** (California Consumer Privacy Act)
- **IT Act 2000** (India)

Rights available to you:
- Right to Access (export your data)
- Right to Rectification (correct inaccurate data)
- Right to Erasure (delete your data)
- Right to Portability (receive data in machine-readable format)
- Right to Restrict Processing
- Right to Object

---

## Support & Training

### Q48: How do I get help?
**A:** Multiple support channels available:

| Channel | Response Time | Availability |
|---------|---------------|-------------|
| **Email** (support@11avatardigitalhub.cloud) | 2-4 business hours | 24/7 |
| **Live Chat** (in-app) | 5-10 minutes | Mon-Fri, 10AM-7PM IST |
| **Knowledge Base** | Instant | 24/7 |
| **Video Tutorials** | Instant | 24/7 |
| **Community Forum** | Varies | 24/7 |

### Q49: Do you provide training?
**A:** Yes! We offer:
- **Free Onboarding:** 30-minute setup call for new accounts
- **Video Tutorials:** Step-by-step guides on YouTube
- **Documentation:** Comprehensive user guide and API docs
- **Webinars:** Monthly live training sessions
- **Custom Training:** Available on Enterprise plan
- **LMS Courses:** Built-in training courses for your team

### Q50: How do I report a bug or request a feature?
**A:**
- **Bug Reports:** Create a GitHub issue using the bug report template
- **Feature Requests:** Create a GitHub issue using the feature request template
- **Security Issues:** Email admin@11avatardigitalhub.cloud (do NOT create public issue)
- **General Feedback:** Email info@11avatardigitalhub.cloud

We review all submissions and respond within 48 hours.

---

## 📞 Still Have Questions?

Contact us:
- **Email:** support@11avatardigitalhub.cloud
- **Website:** https://11avatardigitalhub.cloud

- **GitHub:** https://github.com/11avatardigitalhub/11-Avatar-SMEs-CRM


---

**Document Version:** 2.0.0 | **Last Updated:** July 16, 2026


