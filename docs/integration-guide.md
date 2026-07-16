markdown
# 11 Avatar Digital Hub - Integration Guide

## 📋 Document Information

| Property | Value |
|----------|-------|
| **Document Version** | 2.0.0 |
| **Last Updated** | July 16, 2026 |
| **Author** | Ananya Patel (CTO), Priya Singh (VP Engineering) |
| **Contact** | support@11avatardigitalhub.cloud |

---

## 🎯 Overview

This guide provides comprehensive instructions for integrating third-party services with **11 Avatar Digital Hub**. The platform supports 16 native integrations across communication, payments, calendar, storage, ERP, CRM, and automation categories.

---

## 📋 Integration Catalog

| Integration | Category | Setup Time | Complexity |
|-------------|----------|------------|------------|
| **WhatsApp (CloudWA)** | Communication | 10 min | Easy |
| **Email (SMTP/SendGrid/Mailgun)** | Communication | 15 min | Easy |
| **SMS (MSG91/Twilio/TextLocal)** | Communication | 10 min | Easy |
| **Slack** | Communication | 5 min | Easy |
| **Razorpay** | Payments | 20 min | Medium |
| **Stripe** | Payments | 15 min | Medium |
| **PayPal** | Payments | 10 min | Easy |
| **Google Calendar** | Calendar | 5 min | Easy |
| **Outlook Calendar** | Calendar | 5 min | Easy |
| **Google Drive** | Storage | 5 min | Easy |
| **Dropbox** | Storage | 5 min | Easy |
| **Tally Prime/ERP 9** | ERP | 30 min | Advanced |
| **Zoho (CRM + Books)** | CRM | 20 min | Medium |
| **HubSpot** | CRM | 15 min | Medium |
| **Salesforce** | CRM | 25 min | Advanced |
| **Zapier** | Automation | 10 min | Easy |

---

## 💬 WhatsApp Integration (CloudWA)

### Prerequisites
- Active WhatsApp Business Account (via Meta)
- CloudWA account credentials
- Admin access to 11 Avatar Digital Hub

### Step-by-Step Setup

**Step 1: Access Integration Settings**
1. Navigate to **Settings → Integrations**
2. Click on **"WhatsApp (CloudWA)"**
3. You'll see the CloudWA configuration panel

**Step 2: Configure CloudWA Connection**
1. Enter your CloudWA instance URL:
https://cloudwa.11avatardigitalhub.cloud

text
2. Enter your CloudWA API credentials:
- API Key (from CloudWA dashboard)
- Phone Number ID (from Meta Business Suite)
- Business Account ID

**Step 3: Authenticate**
1. Click **"Connect"**
2. You'll be redirected to CloudWA login
3. Authenticate using your credentials
4. Grant requested permissions

**Step 4: Scan QR Code**
1. After authentication, a QR code will appear
2. Open WhatsApp on your phone
3. Go to **Settings → Linked Devices → Link a Device**
4. Scan the QR code
5. Wait for connection confirmation

**Step 5: Configure Templates**
1. Navigate to **WhatsApp → Templates**
2. Create message templates:
- Template Name
- Category (Marketing, Utility, Authentication)
- Language
- Header (optional: Text, Image, Video, Document)
- Body (with variable placeholders `{{1}}`, `{{2}}`)
- Footer (optional)
- Buttons (optional: Quick Reply, Call to Action, URL)
3. Submit for Meta approval
4. Once approved, templates are ready to use

**Step 6: Set Up Automation**
1. Navigate to **WhatsApp → Automation**
2. Create automation rules:

| Rule Type | Trigger | Action |
|-----------|---------|--------|
| **Welcome Message** | First message from new contact | Send greeting template |
| **Keyword Reply** | Message contains specific keyword | Send response template |
| **Business Hours** | Message received outside hours | Send away message |
| **Lead Creation** | Message from unknown number | Create lead in CRM |

### Testing the Integration
1. Navigate to **WhatsApp → Chat**
2. Select a test contact
3. Send a test message
4. Verify delivery status (Sent → Delivered → Read)
5. Test template sending
6. Verify webhook reception

### Troubleshooting

| Issue | Solution |
|-------|----------|
| QR code not appearing | Refresh CloudWA connection |
| Messages not sending | Check WhatsApp Business account status |
| Templates rejected | Review Meta's template guidelines |
| Webhook not receiving | Verify webhook URL in CloudWA settings |
| Connection lost | Re-authenticate and re-scan QR code |

---

## 📧 Email Integration

### SMTP Configuration

**Step 1: Gather SMTP Credentials**
You'll need from your email provider:
- SMTP Host (e.g., `smtp.gmail.com`)
- SMTP Port (e.g., `587` for TLS, `465` for SSL)
- Username (your email address)
- Password (app-specific password for Gmail)
- Encryption (TLS or SSL)

**Step 2: Configure in Settings**
1. Navigate to **Settings → Integrations → Email**
2. Select **"SMTP"** as provider
3. Enter your SMTP credentials
4. Set From Name and From Email
5. Click **"Test Connection"**
6. If successful, click **"Save"**

### SendGrid Configuration

**Step 1: Get SendGrid API Key**
1. Log in to SendGrid dashboard
2. Go to **Settings → API Keys**
3. Create a new API key with "Mail Send" permissions
4. Copy the API key

**Step 2: Configure**
1. Navigate to **Settings → Integrations → Email**
2. Select **"SendGrid"** as provider
3. Paste your API key
4. Click **"Verify & Save"**

### Mailgun Configuration

**Step 1: Get Mailgun Credentials**
1. Log in to Mailgun dashboard
2. Note your domain (e.g., `mg.yourdomain.com`)
3. Go to **Settings → API Keys**
4. Copy your private API key

**Step 2: Configure**
1. Navigate to **Settings → Integrations → Email**
2. Select **"Mailgun"** as provider
3. Enter domain and API key
4. Click **"Verify & Save"**

### Email Tracking Setup
After configuring email, enable tracking:
1. Go to **Settings → Email → Tracking**
2. Enable:
- **Open Tracking:** Tracks when emails are opened
- **Click Tracking:** Tracks link clicks
3. View tracking data in email logs

---

## 📱 SMS Integration

### MSG91 Configuration

**Step 1: Get MSG91 Credentials**
1. Log in to MSG91 dashboard
2. Go to **Settings → API Keys**
3. Copy your Auth Key
4. Note your approved Sender ID

**Step 2: Configure**
1. Navigate to **Settings → Integrations → SMS**
2. Select **"MSG91"** as provider
3. Enter Auth Key
4. Enter Sender ID
5. Select route (Transactional or Promotional)
6. Click **"Verify & Save"**

### Twilio Configuration

**Step 1: Get Twilio Credentials**
1. Log in to Twilio Console
2. Note your Account SID
3. Note your Auth Token
4. Get a Twilio phone number

**Step 2: Configure**
1. Navigate to **Settings → Integrations → SMS**
2. Select **"Twilio"** as provider
3. Enter Account SID and Auth Token
4. Enter From Number
5. Click **"Verify & Save"**

### DLT Compliance Setup (India)
For Indian businesses sending SMS:
1. Register on the respective operator's DLT platform
2. Get Entity ID and Header ID
3. Register message templates
4. Enter DLT credentials in SMS settings
5. All promotional SMS will be DLT-compliant

---

## 💳 Payment Gateway Integration

### Razorpay Configuration

**Step 1: Get Razorpay API Keys**
1. Log in to Razorpay Dashboard
2. Go to **Settings → API Keys**
3. Generate or copy:
- Key ID (`rzp_test_xxx` or `rzp_live_xxx`)
- Key Secret

**Step 2: Configure**
1. Navigate to **Settings → Integrations → Payments**
2. Select **"Razorpay"** as gateway
3. Enter Key ID and Key Secret
4. Select mode (Test or Live)
5. Click **"Save"**

**Step 3: Set Up Webhook**
1. In Razorpay Dashboard, go to **Settings → Webhooks**
2. Add webhook URL:
https://11avatar-api.11avatardigitalhub.workers.dev/webhooks/payment?gateway=razorpay

text
3. Select events: `payment.authorized`, `payment.captured`, `payment.failed`, `refund.created`
4. Generate webhook secret
5. Enter webhook secret in CRM settings

**Step 4: Test**
1. Create a test invoice for ₹1
2. Click "Pay Now"
3. Complete test payment
4. Verify payment recorded in CRM

### Stripe Configuration

**Step 1: Get Stripe API Keys**
1. Log in to Stripe Dashboard
2. Go to **Developers → API Keys**
3. Copy Publishable Key and Secret Key

**Step 2: Configure**
1. Navigate to **Settings → Integrations → Payments**
2. Select **"Stripe"** as gateway
3. Enter Publishable Key and Secret Key
4. Click **"Save"**

**Step 3: Set Up Webhook**
1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Add endpoint:
https://11avatar-api.11avatardigitalhub.workers.dev/webhooks/payment?gateway=stripe

text
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copy webhook signing secret
5. Enter in CRM settings

---

## 📅 Calendar Integration

### Google Calendar

**Step 1: Connect**
1. Navigate to **Settings → Integrations → Calendar**
2. Click **"Connect Google Calendar"**
3. You'll be redirected to Google OAuth
4. Select your Google account
5. Grant calendar permissions
6. You'll be redirected back to CRM

**Step 2: Configure Sync**
1. Select which calendars to sync
2. Choose sync direction:
- **Two-way:** Changes sync both ways
- **CRM → Google:** CRM events push to Google
- **Google → CRM:** Google events pull to CRM
3. Set sync frequency (real-time or every 5/15/30 minutes)
4. Click **"Save"**

### Outlook Calendar

**Step 1: Connect**
1. Navigate to **Settings → Integrations → Calendar**
2. Click **"Connect Outlook Calendar"**
3. Sign in with Microsoft account
4. Grant calendar permissions
5. Return to CRM

**Step 2: Configure**
Same as Google Calendar configuration above.

---

## 🗄️ Storage Integration

### Google Drive

**Step 1: Connect**
1. Navigate to **Settings → Integrations → Storage**
2. Click **"Connect Google Drive"**
3. Authenticate with Google
4. Grant Drive access permissions

**Step 2: Usage**
1. Navigate to **Drive** from sidebar
2. Browse files and folders
3. Upload files directly to Drive
4. Attach Drive files to:
- Client records
- Invoices
- Tasks
- Projects

### Dropbox

Follow same steps as Google Drive, authenticating with Dropbox OAuth.

---

## 🏢 ERP Integration

### Tally Prime/ERP 9

**Step 1: Enable Tally Gateway**
1. Open Tally Prime
2. Go to **Gateway of Tally → F11: Features**
3. Enable **"Tally Prime acts as Server"**
4. Note the port number (default: 9000)

**Step 2: Configure in CRM**
1. Navigate to **Settings → Integrations → Tally**
2. Select connection mode:
- **XML API:** HTTP-based (recommended)
- **ODBC:** Direct database connection
- **TDL:** Custom plugin
- **File Export/Import:** Manual sync

**Step 3: XML API Configuration**
1. Enter Tally server host (e.g., `192.168.1.100` or `localhost`)
2. Enter port (default: `9000`)
3. Enter company name (as in Tally)
4. Click **"Test Connection"**
5. If successful, click **"Save"**

**Step 4: Configure Sync Mappings**
1. Go to **Tally → Sync Mappings**
2. Create mappings for:
- Sales Invoices → Tally Sales Vouchers
- Payments → Tally Receipts
- Credit Notes → Tally Credit Notes
- Ledgers → Tally Ledgers
3. Map fields between CRM and Tally
4. Set sync direction (CRM→Tally, Tally→CRM, Bidirectional)

**Step 5: Initial Sync**
1. Click **"Sync All"**
2. Choose initial sync direction
3. Review synced data
4. Resolve any conflicts

**Step 6: Schedule Auto-Sync**
1. Go to **Tally → Schedule**
2. Enable auto-sync
3. Set frequency (Every 15/30/60 minutes)
4. Select entities to auto-sync
5. Save schedule

---

## 🔄 CRM Integration

### Zoho (CRM + Books)

**Step 1: Connect Zoho**
1. Navigate to **Settings → Integrations → Zoho**
2. Click **"Connect Zoho"**
3. Authenticate with Zoho OAuth
4. Select Zoho services to connect (CRM, Books, Desk)

**Step 2: Create Sync Mappings**
1. Go to **Zoho → Mappings**
2. Create mappings:
- Zoho Leads ↔ CRM Leads
- Zoho Contacts ↔ CRM Contacts
- Zoho Accounts ↔ CRM Clients
- Zoho Deals ↔ CRM Deals
- Zoho Invoices ↔ CRM Invoices
3. Configure sync direction per mapping

**Step 3: Field Mapping**
1. Click on a mapping
2. Map Zoho fields to CRM fields
3. Set default values for unmapped fields
4. Configure conflict resolution (CRM wins / Zoho wins)

### HubSpot

**Step 1: Connect**
1. Navigate to **Settings → Integrations → HubSpot**
2. Click **"Connect HubSpot"**
3. Authenticate with HubSpot OAuth

**Step 2: Configure Object Sync**
1. Select HubSpot objects to sync:
- Contacts
- Companies
- Deals
- Tickets
2. Create mappings per object

### Salesforce

**Step 1: Connect**
1. Navigate to **Settings → Integrations → Salesforce**
2. Click **"Connect Salesforce"**
3. Choose Production or Sandbox
4. Authenticate with Salesforce OAuth

**Step 2: Configure**
1. Select Salesforce objects to sync
2. Choose sync mode (REST API, Bulk API, Streaming API)
3. Map fields
4. Set sync schedule

---

## ⚡ Automation Integration

### Zapier

**Step 1: Connect**
1. Navigate to **Settings → Integrations → Zapier**
2. Click **"Generate Webhook URL"**
3. Copy the generated webhook URL

**Step 2: Create Zaps in Zapier**
1. Go to Zapier dashboard
2. Create a new Zap
3. Choose trigger app (any of 5000+ apps)
4. Choose action: **"Webhook"** → **"POST"**
5. Paste the webhook URL from CRM
6. Map data fields
7. Test and activate

**Pre-built Automation Recipes:**
1. Go to **Zapier → Recipes** in CRM
2. Browse available recipes:
- New Lead → Slack Notification
- Deal Won → WhatsApp Celebration
- Invoice Created → Email Client
- Payment Received → SMS Receipt
- Task Created → Google Calendar Event
- New Lead → Google Sheets Row
- WhatsApp Message → Create Lead
- New Client → Mailchimp List

---

## 🔌 Webhook Configuration

### Incoming Webhooks

**Step 1: Generate Webhook Endpoint**
1. Navigate to **Settings → Integrations → Webhooks**
2. Click **"Add Webhook"**
3. Configure:
- Name
- Events to subscribe to
- Secret key (auto-generated)
4. Copy the webhook URL

**Step 2: Verify Webhook Signature**
Webhooks include a signature header for verification:
```http
X-Webhook-Signature: sha256=abc123...
Verify using the shared secret:

javascript
const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const computed = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
);
🔒 Security Best Practices
API Key Management
Rotate API keys every 90 days

Use least-privilege principle for API key permissions

Never commit API keys to version control

Store secrets in environment variables or secret manager

Webhook Security
Always verify webhook signatures

Use HTTPS for all webhook endpoints

Implement webhook retry with exponential backoff

Log all webhook events for audit trail

Data Privacy
Review data being shared with each integration

Ensure GDPR/DPDP compliance for data transfers

Configure data retention policies per integration

Regular audit of integration access

📞 Support
For integration setup assistance:

Email: support@11avatardigitalhub.cloud

Documentation: https://docs.11avatardigitalhub.cloud

API Reference: /docs/api-reference.md

Document Version: 2.0.0 | Last Updated: July 16, 2026
