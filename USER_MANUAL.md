# 📘 TAMS Pro User Manual
## TAMS Pro - Travel Agency Management System - Complete User Guide

**Version:** 1.0  
**Last Updated:** December 2024  
**Developed by:** TAMS Pro

---

## 📑 Table of Contents

1. [First-Time Setup (MANDATORY)](#1️⃣-first-time-setup-mandatory)
   - [Agency Branding Setup](#a-agency-branding-setup)
   - [Gmail SMTP Configuration](#b-gmail-smtp-configuration)
   - [Storage & Backup Setup](#c-storage--backup-setup)
2. [Dashboard Overview](#2️⃣-dashboard-overview)
3. [Client Booking Module](#3️⃣-client-booking-module)
4. [Vendor Management](#4️⃣-vendor-management)
5. [Queries Management](#5️⃣-queries-management)
6. [Expenses Tracking](#6️⃣-expenses-tracking)
7. [Email System](#7️⃣-email-system)
8. [PDF Generation](#8️⃣-pdf-generation)
9. [Reports Module](#9️⃣-reports-module)
10. [Smart Calculators](#🔟-smart-calculators)
11. [Authentication & Security](#1️⃣1️⃣-authentication--security)
12. [Subscription & License](#1️⃣2️⃣-subscription--license)
13. [Support & Help](#1️⃣3️⃣-support--help)

---

# 1️⃣ First-Time Setup (MANDATORY)

> ⚠️ **IMPORTANT:** Complete these setup steps BEFORE using any other features. Skipping this will result in incomplete invoices, failed emails, and missing branding.

---

## A. Agency Branding Setup

Your agency branding appears on all invoices, booking confirmations, and emails. Complete this first!

### Steps to Complete Agency Branding:

1. **Open Settings**
   - Click **Settings** in the sidebar menu
   - Select the **Agency Branding** tab

2. **Upload Your Logo**
   - Click the **Upload Logo** button
   - Select your agency logo image (PNG or JPG recommended)
   - Logo will appear on all invoices and PDFs

3. **Enter Business Details**
   - **Agency Name:** Your official business name
   - **License Number:** Your travel agency license (if applicable)
   - **Office Address:** Complete business address
   - **Contact Number:** Primary phone/WhatsApp number
   - **Support Email:** Email for customer inquiries

4. **Configure Invoice Settings**
   - **Invoice Footer Text:** Custom message for invoice bottom (e.g., "Thank you for choosing us!")
   - **Terms & Conditions:** Add your booking terms

5. **Save Changes**
   - Click **Save Branding** button
   - Wait for confirmation message

🖼️ [Screenshot: Agency Branding Settings Page]

🖼️ [Screenshot: Logo Upload Section]

> ⚠️ **WARNING:** Without Agency Branding, your invoices and emails will appear unprofessional and incomplete. Always complete this step first!

### ✅ Do's:
- Use a high-quality logo (minimum 200x200 pixels)
- Keep agency name consistent across all documents
- Add a professional support email

### ❌ Don'ts:
- Don't skip any required fields
- Don't use blurry or low-resolution logos
- Don't leave contact information empty

---

## B. Gmail SMTP Configuration

TAMS uses your Gmail account to send invoices, booking confirmations, and reminders. You need to create a Gmail App Password.

### Why App Password?

Gmail requires a special "App Password" for third-party apps like TAMS. Your regular Gmail password will NOT work.

### Step-by-Step Gmail App Password Setup:

#### Step 1: Enable 2-Step Verification on Gmail

1. Open your browser and go to: **https://myaccount.google.com**
2. Click **Security** in the left menu
3. Under "How you sign in to Google," click **2-Step Verification**
4. Follow the prompts to enable it (you'll need your phone)
5. Complete the verification process

🖼️ [Screenshot: Google Account Security Page]

> ⚠️ **NOTE:** 2-Step Verification MUST be enabled before you can create App Passwords.

#### Step 2: Create App Password

1. Go to: **https://myaccount.google.com/apppasswords**
2. Sign in if prompted
3. In the "App name" field, type: **TAMS**
4. Click **Create**
5. Google will show a **16-character password** (like: `abcd efgh ijkl mnop`)
6. **Copy this password immediately!** (It won't be shown again)

🖼️ [Screenshot: Google App Password Creation]

🖼️ [Screenshot: 16-Character App Password Display]

#### Step 3: Configure TAMS Email Settings

1. In TAMS, go to **Settings** → **Agency Branding**
2. Scroll to **Email Configuration** section
3. Enter your **Gmail Address** (e.g., youragency@gmail.com)
4. Paste the **16-character App Password** (remove spaces)
5. Click **Save Branding**

🖼️ [Screenshot: TAMS Email Configuration Section]

#### Step 4: Test Email (Optional but Recommended)

1. Go to any client booking
2. Click **Send Email** or **Send Invoice**
3. Check if the email is delivered successfully
4. Check your Gmail "Sent" folder to confirm

### Common Email Errors & Solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Authentication Failed" | Wrong password | Re-copy App Password (no spaces) |
| "SMTP Connection Error" | 2FA not enabled | Enable 2-Step Verification first |
| "Email Not Sent" | Missing email address | Check client has valid email |
| "Invalid Credentials" | Using regular password | Create App Password instead |

> ⚠️ **WARNING:** Never share your App Password. If compromised, delete it from Google and create a new one.

### ✅ Do's:
- Use a dedicated agency Gmail account
- Keep the App Password saved securely
- Test email sending before going live

### ❌ Don'ts:
- Don't use your personal Gmail password
- Don't share App Password with others
- Don't skip 2-Step Verification setup

---

## C. Storage & Backup Setup

TAMS stores all your data securely in the cloud. You can also create local backups for extra safety.

### Understanding Storage in TAMS:

- **Cloud Storage:** All data is automatically saved to secure cloud servers
- **Local Backup:** Download a copy of your data to your computer
- **Auto-Backup:** Schedule automatic backups daily, weekly, or monthly

### Manual Backup (Recommended Weekly):

1. Go to **Settings** → **Account** tab
2. Scroll to **Storage & Backup** section
3. Click **Manual Backup** button
4. Choose a folder on your computer
5. A JSON file will be saved with your data

🖼️ [Screenshot: Storage & Backup Section]

🖼️ [Screenshot: Manual Backup Button]

### Auto-Backup Configuration:

1. In **Settings** → **Account**
2. Find **Automatic Backup** section
3. Toggle **Enable Auto-Backup** ON
4. Select frequency:
   - **Daily:** For high-volume agencies
   - **Weekly:** Recommended for most users
   - **Monthly:** For low-volume agencies
5. Click **Save Settings**

### Restoring from Backup:

1. Go to **Settings** → **Account**
2. Click **Import Data**
3. Select your backup JSON file
4. Confirm the import
5. Wait for data to load

> ⚠️ **WARNING:** Importing data will merge with existing data. Always verify the backup file before importing.

### ✅ Do's:
- Create manual backups before major changes
- Store backup files in a safe location
- Test backup restoration periodically

### ❌ Don'ts:
- Don't edit backup JSON files manually
- Don't import backups from unknown sources
- Don't rely only on cloud storage

---

# 2️⃣ Dashboard Overview

The Dashboard is your command center showing real-time business insights at a glance.

🖼️ [Screenshot: Full Dashboard View]

### Dashboard Widgets:

#### 1. Revenue & Profit Stats
- **Total Bookings:** Count of all client bookings
- **Total Revenue:** Sum of all selling prices
- **Total Profit:** Revenue minus purchasing costs
- **Pending Payments:** Amount still to be collected

🖼️ [Screenshot: Revenue Stats Cards]

#### 2. Month Selector
- Click the **month dropdown** at the top
- Select any month to filter all stats
- Dashboard updates to show selected month's data

#### 3. Upcoming Flights Widget
- Shows flights scheduled in the next 7 days
- Displays client name, destination, and date
- Click **Send Reminder** to email the client

🖼️ [Screenshot: Upcoming Flights Widget]

#### 4. Name Update Reminders
- Shows bookings requiring name corrections
- Displays deadline for name changes
- Helps avoid airline penalties

#### 5. Active Queries
- Shows pending client inquiries
- Quick access to follow up on leads
- Click to view full query details

### Dashboard Actions:

| Action | How to Do It |
|--------|--------------|
| Refresh Data | Pull down on mobile / Click refresh icon |
| View Month Stats | Use month selector dropdown |
| Send Flight Reminder | Click envelope icon on upcoming flight |
| View Query | Click on any active query card |

> 💡 **TIP:** The dashboard shows skeleton loading animations while data loads - this is normal!

---

# 3️⃣ Client Booking Module

The Client Booking module is the heart of TAMS. Here you manage all bookings, payments, and client information.

### Accessing Client Bookings:

1. Click **Clients** in the sidebar menu
2. View all bookings in a searchable table
3. Use search bar to find by name, passport, or PNR

🖼️ [Screenshot: Clients Page Overview]

---

### A. Adding a New Booking

#### Step 1: Open Add Booking Form

1. Click the **+ Add Booking** button (top right)
2. The booking form will open

🖼️ [Screenshot: Add Booking Button]

#### Step 2: Select Service Type

Choose the booking type:
- **Ticket Only:** Flight bookings
- **Umrah:** Religious travel packages
- **Custom Package:** Custom travel arrangements

🖼️ [Screenshot: Service Type Selection]

#### Step 3: Enter Client Contact Information

1. **Client Name:** Full name as per passport
2. **Contact Number:** Phone with country code
3. **Client Email:** For sending invoices and reminders
4. **Contact Person:** If booking for someone else

🖼️ [Screenshot: Contact Information Section]

> 💡 **TIP:** Email is required for sending invoices and reminders. Always collect it!

#### Step 4: Enter Travel Details

1. **PNR Number:** Airline booking reference
2. **Airline:** Select from dropdown
3. **Destination:** Travel destination
4. **Flight Date:** Departure date
5. **Name Update Date:** Deadline for name corrections (if applicable)

🖼️ [Screenshot: Travel Details Section]

#### Step 5: Add Passenger Documents

For each passenger:
1. Click **+ Add Passenger**
2. Enter:
   - Passenger Name (as per passport)
   - Passport Number
   - CNIC Number
   - Date of Birth
   - Gender
   - Nationality

🖼️ [Screenshot: Passenger Documents Section]

> ⚠️ **IMPORTANT:** Passenger info is separate from client contact. The client may be booking for family members.

#### Step 6: Enter Pricing Information

1. **Purchasing Price:** Your cost from supplier
2. **Selling Price:** Amount charged to client
3. **Profit:** Automatically calculated (Selling - Purchasing)

🖼️ [Screenshot: Pricing Section]

#### Step 7: Payment Tracking

1. **Amount Paid:** Enter amount received from client
2. **Payment Status:** Automatically updates:
   - **Paid:** Full amount received
   - **Partial:** Partial payment received
   - **Unpaid:** No payment received
3. **Remaining Payment Date:** When balance is due

🖼️ [Screenshot: Payment Section]

#### Step 8: Link Vendor (Optional)

1. Click **Select from List** to link existing vendor
2. Or click **+ Add New Vendor** to create new
3. Vendor payment tracking will be linked

🖼️ [Screenshot: Vendor Linking Section]

#### Step 9: Add Notes (Optional)

- Enter any special instructions or notes
- These appear on invoices and confirmations

#### Step 10: Save Booking

1. Click **Save Booking** button
2. Wait for confirmation message
3. Booking appears in client list

---

### B. Editing a Booking

1. Find the booking in the client list
2. Click the **Edit** icon (pencil)
3. Modify any fields
4. Click **Update Booking**

🖼️ [Screenshot: Edit Booking Button]

---

### C. Deleting a Booking

1. Find the booking in the client list
2. Click the **Delete** icon (trash)
3. Confirm deletion in popup
4. Booking is permanently removed

> ⚠️ **WARNING:** Deleted bookings cannot be recovered. Create a backup first if unsure.

---

### D. Recording Client Payments

1. Click the **Payment** icon on any booking
2. Enter payment details:
   - Amount
   - Payment Date
   - Payment Method
   - Notes
3. Click **Record Payment**
4. Payment history is saved automatically

🖼️ [Screenshot: Payment Recording Dialog]

---

### E. Sharing via WhatsApp

1. Click the **WhatsApp** icon on any booking
2. A message with booking details is generated
3. Select contact in WhatsApp
4. Send the message

🖼️ [Screenshot: WhatsApp Share Button]

---

### F. Generating Invoice

1. Click **Generate Invoice** button on booking
2. Invoice opens in preview
3. Click **Download PDF** to save
4. Or click **Send Email** to email client

🖼️ [Screenshot: Invoice Generation]

---

### G. Searching Bookings

Use the search bar to find bookings by:
- Client name
- Passport number
- PNR number
- Contact number

🖼️ [Screenshot: Search Bar]

---

# 4️⃣ Vendor Management

Track your suppliers, their payments, and link them to client bookings.

### Accessing Vendors:

1. Click **Vendors** in the sidebar
2. View all vendors in a list
3. Use search to find specific vendors

🖼️ [Screenshot: Vendors Page]

---

### A. Adding a New Vendor

1. Click **+ Add Vendor** button
2. Enter vendor details:
   - **Vendor Name:** Company or person name
   - **Service Type:** Airlines, Hotels, Transport, etc.
   - **Contact Person:** Primary contact name
   - **Contact Number:** Phone number
   - **Email:** Vendor email address
3. Enter payment information:
   - **Total Amount:** Amount owed to vendor
   - **Amount Paid:** Amount already paid
4. Click **Add Vendor**

🖼️ [Screenshot: Add Vendor Form]

---

### B. Recording Vendor Payments

1. Find the vendor in the list
2. Click the **Record Payment** button
3. Enter payment details:
   - **Amount:** Payment amount (positive or negative)
   - **Date:** Payment date
   - **Notes:** Transaction reference or notes
4. Click **Record Payment**

🖼️ [Screenshot: Vendor Payment Dialog]

> 💡 **TIP:** Use negative amounts for payment corrections or refunds.

---

### C. Viewing Vendor Ledger

1. Click on any vendor row
2. View complete payment history
3. See running balance and status

🖼️ [Screenshot: Vendor Ledger View]

---

### D. Linking Vendors to Bookings

When creating a client booking:
1. In the **Vendor Association** section
2. Click **Select from List**
3. Choose the vendor
4. Vendor is now linked to the booking

---

# 5️⃣ Queries Management

Track client inquiries and convert them to bookings.

### Accessing Queries:

1. Click **Queries** in the sidebar
2. View all inquiries with status indicators

🖼️ [Screenshot: Queries Page]

---

### A. Adding a Query

1. Click **+ Add Query** button
2. Enter inquiry details:
   - **Client Name:** Who made the inquiry
   - **Contact Number:** Phone number
   - **Query Details:** What they're asking about
   - **Priority:** Low, Medium, or High
   - **Due Date:** Follow-up deadline
   - **Status:** Pending, In Progress, Completed
3. Click **Add Query**

🖼️ [Screenshot: Add Query Form]

---

### B. Managing Query Status

1. Find the query in the list
2. Click to edit
3. Update status:
   - **Pending:** New inquiry
   - **In Progress:** Being handled
   - **Completed:** Resolved or converted

🖼️ [Screenshot: Query Status Update]

---

### C. Converting to Booking

When a query converts to a booking:
1. Update query status to **Completed**
2. Add notes indicating conversion
3. Create a new client booking with details

---

# 6️⃣ Expenses Tracking

Track all business expenses for accurate profit calculation.

### Accessing Expenses:

1. Click **Expenses** in the sidebar
2. View all expense entries

🖼️ [Screenshot: Expenses Page]

---

### A. Adding an Expense

1. Click **+ Add Expense** button
2. Enter expense details:
   - **Date:** When expense occurred
   - **Category:** Office, Travel, Marketing, etc.
   - **Amount:** Expense amount
   - **Notes:** Description or receipt reference
3. Click **Add Expense**

🖼️ [Screenshot: Add Expense Form]

---

### B. Filtering Expenses

1. Use the date range picker at the top
2. Select start and end dates
3. Expenses filter automatically

---

### C. Expense Categories

Available categories:
- Office Supplies
- Rent
- Utilities
- Travel
- Marketing
- Salaries
- Miscellaneous

---

# 7️⃣ Email System

Send professional emails to clients directly from TAMS.

> ⚠️ **PREREQUISITE:** Complete Gmail SMTP setup in First-Time Setup before using email features.

---

### A. Sending Invoice Email

1. Go to any client booking
2. Click **Send Invoice** button
3. Invoice PDF is automatically attached
4. Confirm sending
5. Check email delivery in Email History

🖼️ [Screenshot: Send Invoice Button]

---

### B. Sending Booking Confirmation

1. Go to any client booking
2. Click **Send Booking Email** button
3. Booking details PDF is attached
4. Email is sent to client

🖼️ [Screenshot: Send Booking Email Button]

---

### C. Sending Payment Reminder

1. Find booking with pending payment
2. Click **Send Payment Reminder** button
3. Reminder email is sent with amount due

🖼️ [Screenshot: Payment Reminder Button]

---

### D. Sending Flight Reminder

1. From Dashboard or Client page
2. Click **Send Flight Reminder** button
3. Client receives flight details and checklist

---

### E. Viewing Email History

1. Click **Email History** in the sidebar
2. View all sent emails with status
3. See delivery status:
   - **Sent:** Successfully delivered
   - **Failed:** Delivery failed
   - **Queued:** Waiting to send

🖼️ [Screenshot: Email History Page]

---

### F. Email Log Cleanup

To prevent database bloat:
1. Go to **Settings** → **Account**
2. Find **Email Log Cleanup** section
3. Enable auto-cleanup
4. Set retention period (7-90 days)
5. Old logs are automatically deleted

🖼️ [Screenshot: Email Cleanup Settings]

---

# 8️⃣ PDF Generation

Generate professional PDFs for invoices and booking confirmations.

---

### A. Invoice PDF

Invoice includes:
- Your agency branding and logo
- Client and passenger details
- Service description
- Pricing breakdown
- Payment status
- Terms and conditions

#### Generating Invoice PDF:

1. Go to client booking
2. Click **Generate Invoice** button
3. Preview opens automatically
4. Click **Download** to save PDF
5. Or click **Email** to send directly

🖼️ [Screenshot: Invoice PDF Preview]

---

### B. Booking Confirmation PDF

Confirmation includes:
- Agency header with contact info
- Booking reference number
- Client details
- Passenger list with documents
- Flight/travel information
- Payment summary

#### Generating Booking PDF:

1. Go to client booking
2. Click **Download Booking** button
3. PDF downloads automatically

🖼️ [Screenshot: Booking Confirmation PDF]

---

# 9️⃣ Reports Module

Analyze your business performance with detailed reports.

### Accessing Reports:

1. Click **Reports** in the sidebar
2. View comprehensive business analytics

🖼️ [Screenshot: Reports Page]

---

### A. Revenue Overview

- Total revenue for selected period
- Comparison with previous periods
- Revenue by service type

---

### B. Booking Statistics

- Total bookings count
- Booking status breakdown:
  - Paid bookings
  - Partial payments
  - Unpaid bookings

🖼️ [Screenshot: Booking Statistics]

---

### C. Payment Overview

- Total collected amount
- Pending receivables
- Payment trends

---

### D. Date Range Filtering

1. Use the date picker at the top
2. Select custom date range
3. All reports update automatically

---

### E. Exporting Reports

1. Click **Export** button in Settings
2. Choose format (PDF or Excel)
3. Select data to export:
   - Client Bookings
   - Expenses
   - Payment History
4. Download file

🖼️ [Screenshot: Export Manager]

---

# 🔟 Smart Calculators

TAMS includes calculators to help with pricing decisions.

### Accessing Calculators:

1. Click **Calculators** in the sidebar
2. Choose calculator type

🖼️ [Screenshot: Smart Calculator Page]

---

### A. Ticket Payable Calculator

Calculate net amounts for airline tickets:

1. Enter **Basic Fare**
2. Enter **Tax Amount**
3. Select **Vendor Share Type:**
   - Fixed Amount
   - Percentage (positive or negative)
4. Enter vendor share value
5. View calculations:
   - Net Payable to Vendor
   - Total Ticket Fare
   - Your Commission

🖼️ [Screenshot: Ticket Payable Calculator]

#### How Percentage Works:
- **Positive %:** Added to both vendor payable and total fare
- **Negative %:** Reduces vendor payment only, total fare unchanged

---

### B. Basic Calculator

Simple calculator for quick math:
1. Click **Basic Calculator** tab
2. Use on-screen buttons or keyboard
3. Perform standard calculations

🖼️ [Screenshot: Basic Calculator]

---

# 1️⃣1️⃣ Authentication & Security

TAMS implements enterprise-grade security to protect your data.

---

### A. Account Access

- Accounts are created by administrator only
- No public signup available
- Contact support for new account requests

---

### B. Login Process

1. Go to login page
2. Enter your **Email** address
3. Enter your **Password**
4. Click **Sign In**
5. Accept Terms of Service (first login only)

🖼️ [Screenshot: Login Page]

---

### C. Session Management

#### Auto-Logout:
- Sessions expire after **30 minutes** of inactivity
- A **5-minute warning** appears before logout
- Click **Stay Logged In** to extend session

🖼️ [Screenshot: Session Warning]

#### Single-Device Login:
- Only one device can be logged in at a time
- New login will log out other devices

---

### D. Managing Active Sessions

To view and control your sessions:

1. Go to **Settings** → **Account**
2. View **Active Sessions** section
3. See all logged-in devices:
   - Browser type
   - Operating system
   - IP address
   - Login time
4. Click **Logout** next to any device to end that session
5. Or click **Logout All Devices** to end all sessions

🖼️ [Screenshot: Active Sessions Management]

---

### E. Sub-User System

Main account holders can create up to 2 Sub IDs:

1. Go to **Settings** → **Sub-User Management**
2. Click **Create Sub-User**
3. Enter email and temporary password
4. Assign permissions for each module:
   - Dashboard (view only)
   - Bookings (read/write/delete)
   - Vendors (read/write/delete)
   - Clients (read/write/delete)
   - Queries (read/write/delete)
   - Expenses (read/write/delete)
   - Reports (read only)
   - Settings (limited access)
5. Click **Create**

🖼️ [Screenshot: Sub-User Creation]

#### Sub-User Permissions:

| Permission | What It Allows |
|------------|----------------|
| Read | View data only |
| Write | Add and edit data |
| Delete | Remove data |

> ⚠️ **NOTE:** Sub-users are limited to their assigned permissions. They cannot access features not granted to them.

---

### F. Password Security

Best practices:
- Use strong passwords (8+ characters)
- Never share login credentials
- Log out from shared computers
- Report suspicious activity immediately

---

# 1️⃣2️⃣ Subscription & License

TAMS operates on a subscription model to ensure continued service.

---

### A. Subscription Plans

| Plan | Duration | Features |
|------|----------|----------|
| Free | 14 days | Full features for trial |
| Monthly | 32 days | All features included |
| Yearly | 370 days | All features + priority support |

---

### B. Checking Subscription Status

1. Go to **Settings** → **Account**
2. View subscription information:
   - Current plan
   - Expiry date
   - Days remaining

🖼️ [Screenshot: Subscription Status]

---

### C. When Subscription Expires

If your subscription expires:
1. You'll be automatically logged out
2. Redirected to expiry notification page
3. Contact support to renew
4. Once renewed, login will work again

🖼️ [Screenshot: Subscription Expired Page]

---

### D. Renewing Subscription

To renew your subscription:
1. Contact support at: **tamspro12@gmail.com**
2. Provide your agency email
3. Select renewal plan
4. Complete payment
5. Access is restored within 24 hours

---

# 1️⃣3️⃣ Support & Help

---

### Contact Information

- **Support Email:** tamspro12@gmail.com
- **Response Time:** Within 24-48 hours

---

### Getting Help

For technical issues:
1. Note the exact error message
2. Describe steps that caused the issue
3. Include screenshots if possible
4. Send details to support email

---

### App Updates

TAMS automatically updates when new features are deployed:
- PWA apps refresh automatically
- No manual update required
- Check Settings for current version

---

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Can't login | Check email/password, contact support if locked |
| Email not sending | Verify Gmail App Password setup |
| Data not loading | Check internet connection, try refresh |
| Session expired | Login again, this is normal security feature |
| Invoice looks blank | Complete Agency Branding setup first |

---

## 📋 Quick Reference Card

### Keyboard Shortcuts (Desktop)

| Action | Shortcut |
|--------|----------|
| Search | Ctrl/Cmd + K |
| Save | Ctrl/Cmd + S |
| Refresh | F5 or Ctrl/Cmd + R |

### Mobile Gestures

| Action | Gesture |
|--------|---------|
| Refresh data | Pull down on screen |
| Close sidebar | Swipe left or tap backdrop |
| Open sidebar | Tap hamburger menu |

---

## ✅ Setup Checklist

Use this checklist to ensure TAMS is fully configured:

- [ ] Agency branding completed (logo, name, contact)
- [ ] Gmail App Password created and saved
- [ ] Email SMTP configured and tested
- [ ] First backup created
- [ ] Auto-backup enabled (optional)
- [ ] Sub-users created (if needed)
- [ ] Terms of Service accepted

---

**© 2024 TAMS Pro - All Rights Reserved**

*This manual is for TAMS users only. Do not distribute without permission.*
