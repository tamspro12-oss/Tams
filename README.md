# TAMS Pro - Travel Agency Management System

Complete travel agency management system with offline support, local-first data storage, and comprehensive booking management.

---

## 🎯 Project Info

**URL**: https://lovable.dev/projects/d2bb4ab1-7e42-4613-9e84-e486d2afa3a5

---

## ✨ Features Overview

### 1. **Login System**
- ✅ Admin-controlled access with email approval
- ✅ Single-device login enforcement
- ✅ Secure session management with auto-timeout (30 min)
- ✅ Password-based authentication
- ✅ Session warning with countdown (5 min before timeout)
- ✅ Clear error messages ("Incorrect password", "Contact admin")

### 2. **Dashboard Overview**
- ✅ Real-time statistics (total bookings, pending payments, tomorrow's flights)
- ✅ Upcoming flights separated by type (Tickets, Umrah, Other services)
- ✅ Offline detection with sync status
- ✅ Agency branding with custom name display
- ✅ Pull-to-refresh support
- ✅ Loading indicators

### 3. **Client Booking Management**
- ✅ Complete CRUD operations (Add, Edit, Delete)
- ✅ Service types: Ticket, Umrah, Custom services
- ✅ Dual pricing: Purchase price & Selling price for profit tracking
- ✅ PNR, flight details, and passenger information
- ✅ Payment status tracking (Paid, Partial, Pending)
- ✅ Search by name, passport, or PNR
- ✅ Input validation and duplicate prevention
- ✅ WhatsApp sharing integration
- ✅ Copy to clipboard functionality

### 4. **Vendor Management**
- ✅ Track vendor bookings and payments
- ✅ Service type categorization
- ✅ Payment status tracking
- ✅ Contact information management
- ✅ Real-time updates

### 5. **Invoice Generation**
- ✅ PDF invoice generation
- ✅ Search by client name or passport number
- ✅ Professional invoice template
- ✅ Agency branding on invoices
- ✅ Shows selling price only (not purchase price)

### 6. **Local Storage & Persistence**
- ✅ IndexedDB for robust local data storage
- ✅ Works fully offline
- ✅ Optional cloud storage (Supabase)
- ✅ Switchable between local and cloud storage
- ✅ Browser storage monitoring
- ✅ No automatic data deletion

### 7. **WhatsApp Sharing**
- ✅ Share booking details via WhatsApp
- ✅ Copy booking information to clipboard
- ✅ Formatted message with all booking details
- ✅ Phone number integration

### 8. **PWA (Progressive Web App)**
- ✅ Service worker for offline functionality
- ✅ Installable on devices
- ✅ Background sync support
- ✅ Cached assets for fast loading
- ✅ App manifest

### 9. **Session Management**
- ✅ Auto-logout after 30 minutes of inactivity
- ✅ 5-minute warning before timeout
- ✅ Activity tracking (mouse, keyboard, touch)
- ✅ Secure session cleanup on logout
- ✅ Unique device ID per session

### 10. **Offline Support**
- ✅ Network status detection
- ✅ Visual offline indicator
- ✅ Action queue for offline operations
- ✅ Automatic sync when back online
- ✅ Clear status messages

### 11. **Data Export**
- ✅ PDF export for client bookings
- ✅ PDF export for expenses
- ✅ Date range filtering
- ✅ Vendor reports
- ✅ Progress indicators

### 12. **Admin Panel**
- ✅ User approval system
- ✅ Email-based registration approval
- ✅ Admin-only backend access
- ✅ User management
- ✅ Role-based access control

### 13. **Agency Branding**
- ✅ Custom agency name
- ✅ License status display
- ✅ Agency information throughout the app
- ✅ Save and update branding

### 14. **Google Drive Backup** (Optional - Coming Soon)
- ⏳ Automatic backup to Google Drive
- ⏳ Last 3 months retention
- ⏳ OAuth2 integration

---

## 📊 Data Model

### Clients (Bookings)
```typescript
{
  id: uuid
  name: string
  phone: string
  email: string
  passport_number: string
  pnr: string
  airline: string
  flight_date: date
  destination: string
  travel_type: "Ticket" | "Umrah" | "Custom"
  purchasing_price: number
  selling_price: number
  payment_status: "Paid" | "Partial" | "Pending"
  payment_amount: number
  notes: text
  created_at: timestamp
  updated_at: timestamp
}
```

### Vendors
```typescript
{
  id: uuid
  name: string
  contact_person: string
  contact_number: string
  email: string
  service_type: string
  booking_date: date
  payment_amount: number
  payment_status: "Paid" | "Partial" | "Pending"
  notes: text
  created_at: timestamp
  updated_at: timestamp
}
```

### Expenses
```typescript
{
  id: uuid
  expense_type: string
  amount: number
  expense_date: date
  notes: text
  created_at: timestamp
}
```

### Agencies
```typescript
{
  id: uuid
  name: string
  license_key: string
  license_active: boolean
  license_status: string
  license_expiry: timestamp
  contact_info: text
}
```

---

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Local Storage**: IndexedDB (via idb library)
- **Backend**: Supabase (optional cloud storage)
- **Authentication**: Supabase Auth with RLS
- **PDF Generation**: jsPDF, jsPDF-AutoTable
- **PWA**: Service Worker, Web App Manifest
- **Icons**: Lucide React

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
npm install

# Step 4: Start development server
npm run dev
```

### Environment Setup (for cloud storage)
Create a `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

---

## 📱 Usage Guide

### For Agents

1. **Login**
   - Enter approved email and password
   - System validates credentials
   - Session starts with 30-min timeout

2. **Add Client Booking**
   - Click "Add Booking" on Clients page
   - Fill in all required fields
   - Select service type (Ticket/Umrah/Custom)
   - Enter purchase and selling prices
   - Save booking

3. **Manage Bookings**
   - Search by name, passport, or PNR
   - View profit calculations
   - Track payment status
   - Share via WhatsApp
   - Delete bookings

4. **Generate Invoices**
   - Click "Generate Invoice"
   - Search for client
   - Download PDF invoice

5. **Export Reports**
   - Go to Settings
   - Select date range (optional)
   - Export client bookings or expenses as PDF

### For Admins

1. **Approve Users**
   - Access Admin Panel from dashboard footer
   - View pending registrations
   - Approve or reject users

2. **Configure Agency**
   - Go to Settings
   - Update agency name
   - Name appears throughout the app

3. **Manage Backend**
   - Click "View Backend" in Admin Panel
   - Access database and settings

---

## 🔒 Security Features

- ✅ Server-side role validation (RLS policies)
- ✅ No client-side role storage
- ✅ Single-device login enforcement
- ✅ Secure session management
- ✅ Auto-logout on inactivity
- ✅ Password-based authentication
- ✅ Input validation
- ✅ SQL injection prevention

---

## 🌐 Offline Capabilities

- All data stored locally on device (IndexedDB)
- Works without internet connection
- Queued actions sync when online
- Service worker caching
- Background sync support
- Visual offline indicator

---

## 🌍 Browser Support

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Any modern browser with IndexedDB support

---

## ⚠️ Known Limitations

- Google Drive backup requires OAuth setup
- Single-device login per account
- Local storage subject to browser limits (~1GB recommended)
- PWA features vary by browser
- Service worker requires HTTPS in production

---

## 🔮 Future Enhancements

- [ ] Google Drive OAuth integration
- [ ] Multi-language support
- [ ] Advanced reporting and analytics
- [ ] Email notifications
- [ ] SMS integration
- [ ] Payment gateway integration
- [ ] Multi-currency support
- [ ] Mobile app versions

---

## 📝 Development

### Available Scripts

```sh
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Project Structure

```
src/
├── components/       # Reusable UI components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helpers
│   ├── storage/     # Storage providers (local/cloud)
│   ├── sessionManager.ts
│   ├── offlineManager.ts
│   ├── whatsappShare.ts
│   └── googleDriveBackup.ts
├── pages/           # Page components
├── integrations/    # Supabase integration
└── main.tsx         # App entry point

public/
├── manifest.json    # PWA manifest
└── sw.js           # Service worker
```

---

## 🤝 How to Edit This Project

### Use Lovable
Visit the [Lovable Project](https://lovable.dev/projects/d2bb4ab1-7e42-4613-9e84-e486d2afa3a5) and start prompting. Changes are committed automatically.

### Use Your IDE
Clone the repo and push changes. Pushed changes are reflected in Lovable.

### Edit in GitHub
Navigate to files and click the "Edit" button (pencil icon).

### Use GitHub Codespaces
Click "Code" → "Codespaces" → "New codespace" to launch a cloud IDE.

---

## 🚢 Deployment

### Via Lovable
1. Open [Lovable Project](https://lovable.dev/projects/d2bb4ab1-7e42-4613-9e84-e486d2afa3a5)
2. Click Share → Publish

### Custom Domain
Navigate to Project > Settings > Domains and click Connect Domain.
[Learn more](https://docs.lovable.dev/features/custom-domain)

---

## 📞 Support

For issues or questions, contact your administrator or refer to the [Lovable Documentation](https://docs.lovable.dev).

---

## 📄 License

Proprietary - All rights reserved

---

**Built with ❤️ using Lovable**
