markdown
# 11 Avatar Digital Hub - API Reference

## 📋 Document Information

| Property | Value |
|----------|-------|
| **Document Version** | 2.0.0 |
| **Last Updated** | July 16, 2026 |
| **Author** | Ananya Patel (CTO) |
| **API Version** | v2 |
| **Base URL** | `https://11avatar-api.11avatardigitalhub.workers.dev` |
| **Status** | Production |

---

## 🔑 Authentication

All API requests require authentication via one of two methods:

### Method 1: Bearer Token (JWT)
```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Method 2: API Key
http
X-API-Key: adk_live_8f7a9b3c2d1e4f5a6b7c8d9e0f1a2b3c
Obtaining Tokens
Endpoint	Method	Description
/api/auth/login	POST	Login with email/password
/api/auth/register	POST	Register new account
/api/auth/api-key	POST	Generate API key
/api/auth/refresh	POST	Refresh JWT token
/api/auth/logout	POST	Invalidate session
📊 Response Format
Success Response
json
{
    "success": true,
    "data": { ... },
    "pagination": {
        "page": 1,
        "limit": 25,
        "total": 150,
        "totalPages": 6
    },
    "meta": {
        "requestId": "req_abc123",
        "timestamp": "2026-07-16T10:30:00.000Z",
        "version": "2.0.0"
    }
}
Error Response
json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Email is required",
        "details": [
            {
                "field": "email",
                "message": "Invalid email format",
                "value": "invalid-email"
            }
        ]
    },
    "meta": {
        "requestId": "req_abc123",
        "timestamp": "2026-07-16T10:30:00.000Z"
    }
}
📚 API Endpoints
🏢 Clients API
List Clients
http
GET /api/clients
Query Parameters:

Parameter	Type	Default	Description
page	integer	1	Page number
limit	integer	25	Items per page (max 100)
status	string	-	Filter: active, inactive, lead, churned
search	string	-	Search name, email, phone
sortBy	string	createdAt	Sort field
sortOrder	string	desc	asc or desc
assignedTo	string	-	Filter by assigned user ID
industry	string	-	Filter by industry
Response:

json
{
    "success": true,
    "data": {
        "clients": [
            {
                "id": "cl_abc123",
                "clientCode": "CL-26-0001",
                "companyName": "Acme Corporation",
                "displayName": "Acme Corp",
                "email": "contact@acme.com",
                "phone": "+91 98765 43210",
                "gstin": "27AABCG2194N1Z1",
                "industry": "Technology",
                "status": "active",
                "totalRevenue": 1500000.00,
                "totalDeals": 12,
                "assignedTo": {
                    "id": "user_001",
                    "name": "John Doe"
                },
                "createdAt": "2026-01-15T10:30:00.000Z",
                "updatedAt": "2026-07-16T10:30:00.000Z"
            }
        ]
    },
    "pagination": {
        "page": 1,
        "limit": 25,
        "total": 1,
        "totalPages": 1
    }
}
Create Client
http
POST /api/clients
Request Body:

json
{
    "companyName": "New Client Ltd",
    "displayName": "New Client",
    "email": "info@newclient.com",
    "phone": "9876543210",
    "alternatePhone": "9876543211",
    "website": "https://newclient.com",
    "gstin": "27AABCG2194N1Z1",
    "pan": "AABCG2194N",
    "industry": "Technology",
    "companySize": "11-50",
    "address": {
        "line1": "123 Business Park",
        "line2": "Near Metro Station",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "country": "India"
    },
    "paymentTerms": "net_30",
    "creditLimit": 500000,
    "notes": "Key enterprise client",
    "tags": ["enterprise", "priority"],
    "assignedTo": "user_001"
}
Response: 201 Created

json
{
    "success": true,
    "data": {
        "id": "cl_xyz789",
        "clientCode": "CL-26-0151",
        "companyName": "New Client Ltd",
        "status": "active",
        "createdAt": "2026-07-16T10:30:00.000Z"
    }
}
Get Client
http
GET /api/clients/:id
Response:

json
{
    "success": true,
    "data": {
        "id": "cl_abc123",
        "companyName": "Acme Corporation",
        "contacts": [
            {
                "id": "ct_001",
                "name": "Jane Smith",
                "designation": "CEO",
                "isPrimary": true
            }
        ],
        "deals": [
            {
                "id": "dl_001",
                "title": "Enterprise Deal",
                "value": 500000,
                "stage": "negotiation"
            }
        ],
        "invoices": [
            {
                "id": "inv_001",
                "invoiceNumber": "INV-2026-0101",
                "total": 118000,
                "status": "paid"
            }
        ],
        "totalRevenue": 1500000,
        "outstandingBalance": 236000,
        "lastContactedAt": "2026-07-15T14:00:00.000Z"
    }
}
Update Client
http
PUT /api/clients/:id
Delete Client
http
DELETE /api/clients/:id
Response:

json
{
    "success": true,
    "data": {
        "id": "cl_abc123",
        "deleted": true,
        "deletedAt": "2026-07-16T10:30:00.000Z"
    }
}
📋 Leads API
List Leads
http
GET /api/leads
Query Parameters:

Parameter	Type	Default	Description
page	integer	1	Page number
limit	integer	25	Items per page
status	string	-	Filter by status
source	string	-	Filter by source
assignedTo	string	-	Filter by assignee
search	string	-	Search name, email, phone
minScore	integer	-	Minimum lead score
createdFrom	date	-	Filter from date
createdTo	date	-	Filter to date
Create Lead
http
POST /api/leads
Request Body:

json
{
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Prospect Corp",
    "email": "john@prospect.com",
    "phone": "9876543210",
    "source": "website",
    "sourceDetail": "Contact Form",
    "requirement": "CRM for sales team of 25",
    "budgetRange": "50000-100000",
    "timeline": "within_30_days",
    "notes": "Hot lead - needs quick follow-up",
    "tags": ["hot", "website"],
    "assignedTo": "user_001",
    "customFields": {
        "utm_source": "google",
        "utm_campaign": "summer_sale"
    }
}
Convert Lead to Client
http
POST /api/leads/:id/convert
Request Body:

json
{
    "createDeal": true,
    "dealValue": 100000,
    "dealStage": "qualified"
}
Bulk Import Leads
http
POST /api/leads/import
Request Body: multipart/form-data

text
file: leads.csv
mappings: { "name": "Name", "email": "Email", "phone": "Phone" }
skipDuplicates: true
💰 Invoices API
List Invoices
http
GET /api/invoices
Query Parameters:

Parameter	Type	Default	Description
page	integer	1	Page number
limit	integer	25	Items per page
status	string	-	Filter: draft, sent, paid, overdue
clientId	string	-	Filter by client
dateFrom	date	-	Invoice date from
dateTo	date	-	Invoice date to
minAmount	number	-	Minimum amount
maxAmount	number	-	Maximum amount
search	string	-	Search invoice number
Create Invoice
http
POST /api/invoices
Request Body:

json
{
    "clientId": "cl_abc123",
    "invoiceType": "B2B",
    "invoiceDate": "2026-07-16",
    "dueDate": "2026-08-15",
    "referenceNumber": "PO-2026-001",
    "currency": "INR",
    "items": [
        {
            "description": "Web Development Services",
            "hsnSac": "998313",
            "quantity": 1,
            "unit": "NOS",
            "rate": 50000,
            "gstRate": "18%",
            "discountPercent": 0
        },
        {
            "description": "Annual Maintenance",
            "hsnSac": "998314",
            "quantity": 1,
            "unit": "NOS",
            "rate": 25000,
            "gstRate": "18%",
            "discountPercent": 10
        }
    ],
    "discountType": "flat",
    "discountValue": 5000,
    "notes": "Payment due within 30 days",
    "termsConditions": "Late payment penalty: 2% per month",
    "tags": ["priority"],
    "generateEInvoice": true,
    "generateEWayBill": false
}
Send Invoice
http
POST /api/invoices/:id/send
Request Body:

json
{
    "channels": ["email"],
    "emailTo": ["client@example.com"],
    "emailCc": ["manager@example.com"],
    "emailSubject": "Invoice INV-2026-0101 from 11 Avatar",
    "emailMessage": "Dear Client, please find attached invoice.",
    "sendCopy": true
}
Record Payment
http
POST /api/invoices/:id/payments
Request Body:

json
{
    "amount": 59000,
    "method": "upi",
    "paymentDate": "2026-07-16",
    "transactionId": "UPI123456789",
    "notes": "Partial payment"
}
Generate E-Invoice
http
POST /api/invoices/:id/e-invoice
Generate E-Way Bill
http
POST /api/invoices/:id/e-way-bill
Request Body:

json
{
    "transporterId": "TRANS001",
    "transporterName": "Fast Logistics",
    "vehicleNumber": "MH01AB1234",
    "distance": 450
}
💳 Payments API
List Payments
http
GET /api/payments
Record Payment
http
POST /api/payments/record
Request Body:

json
{
    "invoiceId": "inv_001",
    "amount": 50000,
    "method": "upi",
    "gateway": "razorpay",
    "paymentDate": "2026-07-16",
    "transactionId": "pay_ABC123XYZ",
    "utrNumber": "UTR123456",
    "notes": "Payment for July invoice",
    "sendReceipt": true
}
Process Refund
http
POST /api/payments/:id/refund
Request Body:

json
{
    "amount": 25000,
    "reason": "Duplicate payment",
    "notes": "Refund processed by admin"
}
Reconcile Payments
http
POST /api/payments/reconcile
Request Body:

json
{
    "dateFrom": "2026-07-01",
    "dateTo": "2026-07-16",
    "gateway": "razorpay"
}
📊 Deals/Pipeline API
List Deals
http
GET /api/deals
Query Parameters:

Parameter	Type	Default	Description
stage	string	-	Filter by pipeline stage
clientId	string	-	Filter by client
assignedTo	string	-	Filter by owner
minValue	number	-	Minimum deal value
maxValue	number	-	Maximum deal value
probability	number	-	Minimum probability %
expectedCloseFrom	date	-	Expected close date from
expectedCloseTo	date	-	Expected close date to
Create Deal
http
POST /api/deals
Update Deal Stage
http
PUT /api/deals/:id/stage
Request Body:

json
{
    "stage": "negotiation",
    "notes": "Client requested discount",
    "probability": 75
}
📱 WhatsApp API
Send Message
http
POST /api/whatsapp/send
Request Body:

json
{
    "to": "919876543210",
    "type": "template",
    "templateName": "payment_reminder",
    "templateLanguage": "en",
    "templateData": {
        "name": "John",
        "amount": "₹50,000",
        "dueDate": "15 Aug 2026",
        "invoiceNumber": "INV-2026-0101"
    }
}
Send Bulk Messages
http
POST /api/whatsapp/bulk-send
Request Body:

json
{
    "recipients": ["919876543210", "919876543211"],
    "templateName": "promotional_offer",
    "templateData": {
        "offer": "20% discount"
    },
    "batchSize": 50
}
Get Conversation History
http
GET /api/whatsapp/conversations/:phone
🔔 Notifications API
List Notifications
http
GET /api/notifications
Mark as Read
http
PUT /api/notifications/:id/read
Mark All as Read
http
POST /api/notifications/mark-all-read
Update Preferences
http
PUT /api/notifications/preferences
Request Body:

json
{
    "channels": {
        "in_app": true,
        "email": true,
        "sms": false,
        "push": true,
        "whatsapp": false
    },
    "quietHours": {
        "enabled": true,
        "start": "22:00",
        "end": "08:00"
    }
}
📈 Reports API
Generate Report
http
POST /api/reports/generate
Request Body:

json
{
    "type": "sales",
    "period": "this_month",
    "chartType": "bar",
    "groupBy": "day",
    "metrics": ["total_revenue", "total_deals"],
    "filters": {
        "clientId": "cl_abc123"
    },
    "comparison": true
}
Export Report
http
GET /api/reports/:id/export?format=pdf
Schedule Report
http
POST /api/reports/:id/schedule
Request Body:

json
{
    "frequency": "weekly",
    "recipients": ["manager@example.com"],
    "format": "pdf",
    "includeSummary": true,
    "attachData": false
}
📊 Rate Limits
Plan	Requests/Min	Requests/Hour	Requests/Day
Free	30	500	5,000
Starter	60	2,000	20,000
Business	120	5,000	50,000
Enterprise	300	10,000	100,000
Rate limit headers:

http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1690000000
🔐 Error Codes
Code	Description
AUTH_REQUIRED	Authentication required
AUTH_INVALID	Invalid credentials
AUTH_EXPIRED	Token expired
AUTH_INSUFFICIENT	Insufficient permissions
VALIDATION_ERROR	Request validation failed
RESOURCE_NOT_FOUND	Requested resource not found
RESOURCE_CONFLICT	Resource already exists
RATE_LIMIT_EXCEEDED	Too many requests
TENANT_REQUIRED	Organization context required
FEATURE_DISABLED	Feature not available on plan
INTEGRATION_ERROR	Third-party integration failed
INTERNAL_ERROR	Internal server error
📞 Support
API Documentation: https://11avatardigitalhub.cloud/api-docs

Support Email: support@11avatardigitalhub.cloud

Status Page: https://status.11avatardigitalhub.cloud

SDK & Examples: https://github.com/11avatardigitalhub/api-examples

