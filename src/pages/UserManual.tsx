import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  Settings, 
  LayoutDashboard, 
  Users, 
  Building2, 
  HelpCircle, 
  Receipt, 
  Mail, 
  FileText, 
  BarChart3, 
  Calculator, 
  Shield, 
  CreditCard,
  AlertTriangle,
  Lightbulb,
  ArrowLeft,
  Ticket,
  Bell,
  Eye,
  Compass,
  Scale,
  MessageSquare,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const WarningBox = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg my-4">
    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
    <div className="text-sm text-destructive">{children}</div>
  </div>
);

const TipBox = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-3 p-4 bg-primary/10 border border-primary/30 rounded-lg my-4">
    <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
    <div className="text-sm text-foreground">{children}</div>
  </div>
);

const StepList = ({ steps }: { steps: string[] }) => (
  <ol className="list-decimal list-inside space-y-2 my-4">
    {steps.map((step, index) => (
      <li key={index} className="text-sm text-muted-foreground pl-2">{step}</li>
    ))}
  </ol>
);

const sections: Section[] = [
  {
    id: "first-time-setup",
    title: "First-Time Setup (MANDATORY)",
    icon: Settings,
    content: (
      <div className="space-y-6">
        <WarningBox>
          Complete these setup steps BEFORE using any other features. Skipping this will result in incomplete invoices, failed emails, and missing branding.
        </WarningBox>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">A. Agency Branding Setup</h4>
          <p className="text-sm text-muted-foreground">Your agency branding appears on all invoices, booking confirmations, and emails.</p>
          <StepList steps={[
            "Click Settings in the sidebar menu",
            "Select the Agency Branding tab",
            "Upload your agency logo (PNG or JPG recommended)",
            "Enter your Agency Name, Contact Number, and Support Email",
            "Add Invoice Footer Text and Terms & Conditions",
            "Click Save Branding button"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">B. Gmail SMTP Configuration</h4>
          <p className="text-sm text-muted-foreground">TAMS uses your Gmail account to send invoices and reminders. You need a Gmail App Password.</p>
          <StepList steps={[
            "Go to https://myaccount.google.com and enable 2-Step Verification",
            "Visit https://myaccount.google.com/apppasswords",
            "Create a new App Password with name 'TAMS'",
            "Copy the 16-character password (remove spaces)",
            "In TAMS Settings → Agency Branding, paste it in Email Password field",
            "Click Save Branding"
          ]} />
          <WarningBox>Never share your App Password. If compromised, delete it from Google and create a new one.</WarningBox>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">C. Storage & Backup Setup</h4>
          <p className="text-sm text-muted-foreground">All data is saved to secure cloud servers. Create local backups for extra safety.</p>
          <StepList steps={[
            "Go to Settings → Account tab",
            "Scroll to Storage & Backup section",
            "Click Manual Backup to download your data",
            "Enable Auto-Backup and select frequency (Daily/Weekly/Monthly)",
            "Store backup files in a safe location"
          ]} />
        </div>
      </div>
    )
  },
  {
    id: "dashboard",
    title: "Dashboard Overview",
    icon: LayoutDashboard,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">The Dashboard is your command center showing real-time business insights at a glance.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Dashboard Widgets</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Revenue & Profit Stats:</strong> Total bookings, revenue, profit, and pending payments</li>
            <li><strong>Month Selector:</strong> Filter all stats by month</li>
            <li><strong>Upcoming Flights:</strong> Flights in next 7 days with reminder option</li>
            <li><strong>Name Update Reminders:</strong> Bookings requiring name corrections</li>
            <li><strong>Active Queries:</strong> Pending client inquiries</li>
          </ul>
        </div>

        <TipBox>Pull down on mobile or click the refresh icon to refresh dashboard data.</TipBox>
      </div>
    )
  },
  {
    id: "client-booking",
    title: "Client Booking Module",
    icon: Users,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">The Client Booking module is the heart of TAMS. Manage all bookings, payments, and client information.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Adding a New Booking</h4>
          <StepList steps={[
            "Click + Add Booking button (top right)",
            "Select Service Type: Ticket Only, Umrah, or Custom Package",
            "Enter Client Contact: Name, Phone, Email, Contact Person",
            "Enter Travel Details: PNR, Airline, Destination, Flight Date",
            "Add Passenger Documents: Passport, CNIC, DOB, Gender for each passenger",
            "Enter Pricing: Purchasing Price, Selling Price (profit auto-calculated)",
            "Track Payment: Amount Paid, Payment Status, Remaining Date",
            "Link Vendor (optional): Select existing or create new",
            "Add Notes (optional)",
            "Click Save Booking"
          ]} />
        </div>

        <WarningBox>Passenger info is separate from client contact. The client may be booking for family members.</WarningBox>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Other Actions</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Edit Booking:</strong> Click pencil icon, modify fields, click Update</li>
            <li><strong>Delete Booking:</strong> Click trash icon, confirm deletion</li>
            <li><strong>Record Payment:</strong> Click payment icon, enter amount and details</li>
            <li><strong>Share via WhatsApp:</strong> Click WhatsApp icon</li>
            <li><strong>Generate Invoice:</strong> Click invoice button, download or email</li>
            <li><strong>Search:</strong> Use search bar to find by name, passport, PNR, or phone</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: "b2b-agents",
    title: "B2B Agents Module",
    icon: Building2,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Manage business-to-business agents who sell tickets on your behalf. Each agent has a running account with automatic balance tracking using professional double-entry accounting.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">A. Adding a New B2B Agent</h4>
          <StepList steps={[
            "Go to B2B Agents from the sidebar menu",
            "Click '+ Add New Agent' button",
            "Enter Agent Name (required) and Business Name",
            "Enter Phone number and Email",
            "Select Country and City",
            "Set Commission Type: Percentage or Fixed Amount",
            "Enter Commission Value",
            "Set Status: Active or Inactive",
            "Add Notes (optional)",
            "Click Add Agent to save"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">B. Unified Agent & Booking Search</h4>
          <p className="text-sm text-muted-foreground">The search bar on the B2B Agents page searches both agents AND their individual bookings simultaneously:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Search by <strong>Agent Name, Business Name, or City</strong> to locate agent records.</li>
            <li>Search by <strong>Passenger Name, Passport Number, PNR, or Voucher Code</strong> to instantly locate specific B2B bookings.</li>
            <li>Use the category chips (<strong>All, Agents, Bookings</strong>) to quickly focus your search results.</li>
            <li>Tap any booking card in the results to view or edit full booking and passenger details.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">C. Agent Dashboard Overview</h4>
          <p className="text-sm text-muted-foreground">Click "View" button on any agent card to access their dashboard with 5 tabs:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Summary:</strong> Financial overview with debit, credit, balance, and profit stats</li>
            <li><strong>Bookings:</strong> All bookings for this agent with payment tracking</li>
            <li><strong>Ledger:</strong> Complete account statement with running balance</li>
            <li><strong>Vouchers:</strong> Generate branded vouchers and configure agent voucher permissions</li>
            <li><strong>Reports:</strong> Export sales, commission, and ledger reports</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">C. Summary Tab Stats</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Total Debit (Owed):</strong> Sum of all booking service amounts agent owes you</li>
            <li><strong>Total Credit (Paid):</strong> Sum of all payments received from agent</li>
            <li><strong>Total Receivable:</strong> Sum of all service amounts from bookings</li>
            <li><strong>Balance Due/Advance:</strong> Outstanding amount (positive = agent owes, negative = advance)</li>
            <li><strong>Agent Commission:</strong> Total commission earned by the agent</li>
            <li><strong>Net Profit:</strong> Your agency's profit from this agent</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">D. Adding B2B Bookings</h4>
          <StepList steps={[
            "In agent dashboard, click '+ Add Booking' button",
            "Enter Passenger Name, Passport Number, and Contact",
            "Enter PNR, Destination, Airline, and Flight Date",
            "Select Vendor (optional)",
            "Enter Purchasing Price (your cost) and Selling Price (agent pays)",
            "Commission auto-calculates based on agent's rate",
            "Enter Amount Received at booking time (optional, for advance payments)",
            "System shows Accounting Summary with Outstanding Balance",
            "Click Save Booking"
          ]} />
          <WarningBox>Payment status is auto-calculated based on actual payments. Do NOT manually select payment status - the system determines it from ledger entries.</WarningBox>
          <TipBox>Leave "Amount Received" at 0 for full credit bookings. Enter partial amount if agent pays advance.</TipBox>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">E. Recording Payments (Ledger)</h4>
          <p className="text-sm text-muted-foreground">Two ways to record payments:</p>
          <StepList steps={[
            "Option 1: In Bookings tab, click credit card icon on any booking with balance",
            "Option 2: Click 'Add Payment Entry' button in Ledger tab",
            "Select Entry Type: Credit (payment received) or Debit (adjustment)",
            "Enter Amount - cannot exceed outstanding balance for linked bookings",
            "Link to specific booking (optional but recommended)",
            "System shows booking balance before payment",
            "Enter Date and Remarks",
            "Click Submit"
          ]} />
          <TipBox>Payments linked to bookings automatically update the booking's status to Paid/Partial.</TipBox>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">F. Understanding the Ledger</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Debit Entry:</strong> Agent owes you (created automatically when booking added)</li>
            <li><strong>Credit Entry:</strong> Agent paid you (payment received)</li>
            <li><strong>Running Balance:</strong> Positive = Agent owes you, Negative = Advance payment</li>
            <li><strong>Service Amt / Paid / Balance:</strong> Shown per booking in Bookings tab</li>
          </ul>
          <TipBox>The ledger is the single source of truth for all financial calculations. All Summary stats derive from ledger entries.</TipBox>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">G. Reports & Exports</h4>
          <p className="text-sm text-muted-foreground">Available exports from Reports tab:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Sales Report:</strong> All bookings with purchase/selling prices (CSV/PDF)</li>
            <li><strong>Commission Report:</strong> Commission breakdown per booking (CSV/PDF)</li>
            <li><strong>Ledger Statement:</strong> Complete account statement (CSV/PDF)</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">Date filters: Current Month, Last Month, Last 3 Months, Year to Date, All Time, or Custom Range</p>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">H. Important Accounting Rules</h4>
          <WarningBox>
            <ul className="list-disc list-inside space-y-1">
              <li>Ledger is the single source of truth for all balances</li>
              <li>Deleting a booking creates automatic reversal entry (history preserved)</li>
              <li>Payment amount cannot exceed outstanding balance</li>
              <li>All calculations (Summary, Reports) derive from ledger, not bookings</li>
              <li>Do not manually change payment status - it's auto-calculated</li>
            </ul>
          </WarningBox>
        </div>
      </div>
    )
  },
  {
    id: "vendor-management",
    title: "Vendor Management",
    icon: Receipt,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Track your suppliers, their payments, and link them to client bookings.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Adding a New Vendor</h4>
          <StepList steps={[
            "Click + Add Vendor button",
            "Enter Vendor Name, Service Type (Airlines, Hotels, etc.)",
            "Enter Contact Person and Contact Number",
            "Enter Total Amount owed and Amount Paid",
            "Click Add Vendor"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Recording Vendor Payments</h4>
          <StepList steps={[
            "Find the vendor in the list",
            "Click Record Payment button",
            "Enter Amount (positive or negative for corrections)",
            "Enter Date and Notes",
            "Click Record Payment"
          ]} />
        </div>

        <TipBox>Use negative amounts for payment corrections or refunds.</TipBox>
      </div>
    )
  },
  {
    id: "queries-management",
    title: "Queries Management",
    icon: HelpCircle,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Track and manage all client inquiries from initial contact to conversion.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Adding a New Query</h4>
          <StepList steps={[
            "Click + Add Query button",
            "Enter Client Name and Contact Number",
            "Enter Query Details (what they're asking about)",
            "Set Priority: High, Medium, or Low",
            "Set Due Date for follow-up",
            "Assign to team member (optional)",
            "Click Save Query"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Query Statuses</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Pending:</strong> New inquiry, not yet addressed</li>
            <li><strong>In Progress:</strong> Being worked on</li>
            <li><strong>Completed:</strong> Query resolved or converted</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: "expenses-tracking",
    title: "Expenses Tracking",
    icon: Receipt,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Track all business expenses for accurate profit calculations.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Adding an Expense</h4>
          <StepList steps={[
            "Click + Add Expense button",
            "Select Expense Type: Office Rent, Utilities, Travel, etc.",
            "Enter Amount",
            "Select Expense Date",
            "Add Notes (optional)",
            "Click Add Expense"
          ]} />
        </div>

        <TipBox>Expenses are included in the Reports module for accurate profit calculation.</TipBox>
      </div>
    )
  },
  {
    id: "email-system",
    title: "Email System",
    icon: Mail,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Send professional emails directly from TAMS using your Gmail account.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Email Types</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Booking Confirmation:</strong> Send booking details with PDF attachment</li>
            <li><strong>Invoice Email:</strong> Send invoice PDF to client</li>
            <li><strong>Flight Reminder:</strong> Remind client of upcoming flight</li>
            <li><strong>Payment Reminder:</strong> Remind client of pending payment</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Sending an Email</h4>
          <StepList steps={[
            "Ensure client has a valid email address",
            "Click the appropriate email button (envelope icon)",
            "Email is sent automatically using your configured Gmail",
            "Check Email History to verify delivery status"
          ]} />
        </div>

        <WarningBox>Gmail SMTP must be configured in Settings before sending emails.</WarningBox>
      </div>
    )
  },
  {
    id: "pdf-generation",
    title: "PDF Generation",
    icon: FileText,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Generate professional PDFs for invoices and booking confirmations.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Invoice PDF</h4>
          <StepList steps={[
            "Open any client booking",
            "Click Generate Invoice button",
            "Preview the invoice",
            "Click Download PDF or Send Email"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Booking Confirmation PDF</h4>
          <StepList steps={[
            "Open any client booking",
            "Click Download/Export button",
            "Select Booking Confirmation",
            "PDF downloads automatically"
          ]} />
        </div>

        <TipBox>PDFs include your agency branding. Make sure Agency Branding is configured first!</TipBox>
      </div>
    )
  },
  {
    id: "reports-module",
    title: "Reports Module",
    icon: BarChart3,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Comprehensive business reports with charts and export options.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Available Reports</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Revenue Report:</strong> Total income over time</li>
            <li><strong>Profit Report:</strong> Revenue minus expenses</li>
            <li><strong>Booking Report:</strong> Booking trends and statistics</li>
            <li><strong>Payment Report:</strong> Payment status breakdown</li>
            <li><strong>Vendor Report:</strong> Vendor payments and balances</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Exporting Reports</h4>
          <StepList steps={[
            "Go to Reports page",
            "Select date range using the filter",
            "Click Export button",
            "Choose format: PDF or Excel",
            "File downloads automatically"
          ]} />
        </div>
      </div>
    )
  },
  {
    id: "vouchers-module",
    title: "Vouchers & Itineraries",
    icon: Ticket,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Generate, print, and share branded service vouchers for Umrah packages, hotel reservations, and airline tickets.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">A. Supported Voucher Types</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Umrah Package Voucher (UV-xxxx):</strong> Full package details including dual hotels (Makkah & Madinah), check-in/out dates, nights, room configuration, meal plan, transport/transfer arrangements, ziyarat services, and visa status.</li>
            <li><strong>Hotel Accommodation Voucher (HV-xxxx):</strong> Hotel name, destination city, check-in, check-out, room category, meal plan, and supplier confirmation code.</li>
            <li><strong>Flight / Ticket Voucher (TV-xxxx):</strong> Airline, flight number, sector route, departure & arrival timings, cabin class, PNR, e-ticket number, and baggage allowance.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">B. Generating a Voucher</h4>
          <StepList steps={[
            "Go to Vouchers from the sidebar menu, or click 'Create Voucher' directly from any open client booking",
            "Choose your voucher type: Umrah Package, Hotel Only, or Flight / Ticket",
            "Select an existing booking from the 'Auto-fill from Booking' dropdown to populate passenger details, passport, airline, and dates instantly",
            "Add additional traveling passengers (adults, children, infants) as needed",
            "Verify hotel confirmation numbers, meal plans, or transport notes",
            "Click 'Issue Voucher' to generate a unique sequential voucher number"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">C. Sharing & Exporting Vouchers</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Download PDF:</strong> Generates a high-resolution, agency-branded PDF complete with your logo, contact numbers, detailed itinerary, terms, and signature block.</li>
            <li><strong>WhatsApp Share:</strong> Pre-formats a formatted summary with dates, hotel names, confirmation numbers, and emergency contact details ready to send with 1 click.</li>
            <li><strong>Print Voucher:</strong> Opens your browser's native print preview dialog for physical copy generation.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">D. B2B Agent Voucher Permissions</h4>
          <p className="text-sm text-muted-foreground">Admins can control which B2B agents are permitted to issue branded vouchers directly by opening the agent's profile and toggling the <strong>'Agent Voucher Privileges'</strong> switch.</p>
        </div>

        <TipBox>Vouchers auto-calculate hotel nights based on check-in and check-out dates, eliminating manual calculation errors.</TipBox>
      </div>
    )
  },
  {
    id: "reminders-module",
    title: "Smart Reminders & Operational Alerts",
    icon: Bell,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Never miss a passenger departure, Umrah group flight, or end-of-day ledger reconciliation with automated operational reminders.</p>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">A. Automated Departure Alerts (Today & Tomorrow)</h4>
          <p className="text-sm text-muted-foreground">TAMS automatically scans all active bookings and alerts you to:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Flights Departing Today:</strong> Highlighted in red with passenger name, PNR, and airline.</li>
            <li><strong>Flights Departing Tomorrow:</strong> Highlighted in amber to give you advance notice to issue tickets, verify visas, or re-confirm timings.</li>
            <li><strong>Umrah Departures:</strong> Group departures flagged with Umrah icons and direct 1-tap links to open the booking.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">B. Daily Operational Prompts</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Morning Review (09:00):</strong> Prompts the agency team to check today's scheduled departures, passenger queries, and pending tasks.</li>
            <li><strong>Evening Closing (20:00):</strong> Prompts you to record daily expenses and balance cash/bank ledger before closing for the night.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">C. Header Notification Bell</h4>
          <p className="text-sm text-muted-foreground">A live notification bell sits in the top header on both desktop and mobile:</p>
          <StepList steps={[
            "The red counter badge reflects your total active departures and due reminders",
            "Clicking the bell opens a compact 3-tab drawer: Departures, Daily Tasks, and Reminders",
            "Mark tasks completed with 1 click, or click 'Manage' to visit the full Reminders dashboard"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">D. Custom Reminders & Settings</h4>
          <p className="text-sm text-muted-foreground">Create custom reminders with specific dates, times, notes, and daily recurring options. Use Reminder Settings to configure morning/evening prompt hours or toggle alert categories.</p>
        </div>
      </div>
    )
  },
  {
    id: "smart-calculators",
    title: "Umrah Package Calculator",
    icon: Calculator,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Professional per-person cost calculator with live currency conversion and automatic passenger multiplication.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Umrah Package Calculator Features</h4>
          <StepList steps={[
            "Select a Quick Preset (e.g. 15-day Economy, 21-day Premium) or enter custom costs",
            "Set the SAR to PKR exchange rate (e.g. 1 SAR = 74.50 PKR) to convert hotel and ground service costs instantly",
            "Enter flight cost per person, Makkah hotel, Madinah hotel, transport, and visa fees",
            "Enter passenger count: all costs automatically multiply across the entire family/group",
            "View net package cost, profit margin, and grand total per person and for the whole group"
          ]} />
        </div>

        <TipBox>Save your frequently used package setups as Quick Presets to quote Umrah packages to prospective clients in under 30 seconds.</TipBox>
      </div>
    )
  },
  {
    id: "authentication-security",
    title: "Authentication & Security",
    icon: Shield,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">TAMS implements robust enterprise-grade security to protect your agency records and user accounts.</p>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">A. Instant Trial Signup</h4>
          <p className="text-sm text-muted-foreground">Creating a new account takes seconds. Upon submitting your name, agency name, email, and password, you are immediately logged in and taken directly to your active dashboard with a 14-day free trial without frustrating email confirmation blocks.</p>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">B. Password Visibility Toggle</h4>
          <p className="text-sm text-muted-foreground">An interactive eye icon toggle is available across all password input fields (Sign In, Create Account, Reset Password, and Change Password) allowing you to verify what you typed and prevent accidental lockouts.</p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Login System</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Accounts are created by admin only (no public signup)</li>
            <li>Login with email and password</li>
            <li>Sessions automatically expire after inactivity</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Device Management</h4>
          <StepList steps={[
            "Go to Settings → Account tab",
            "View Active Devices section",
            "See all logged-in devices with details",
            "Click Logout to terminate individual sessions",
            "Click Logout All Devices for security"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Sub-User System</h4>
          <p className="text-sm text-muted-foreground">Main accounts can create up to 2 Sub-IDs with limited permissions.</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Each Sub-ID has granular module permissions</li>
            <li>Sub-IDs can only access their main account's data</li>
            <li>Manage Sub-IDs from Settings → Team tab</li>
          </ul>
        </div>

        <WarningBox>If you suspect unauthorized access, immediately logout all devices from Settings.</WarningBox>
      </div>
    )
  },
  {
    id: "subscription-license",
    title: "Subscription & License",
    icon: CreditCard,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">TAMS operates on a subscription model with multiple plans.</p>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Subscription Plans</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Free Trial:</strong> 14 days full access</li>
            <li><strong>Monthly:</strong> 32 days access</li>
            <li><strong>Yearly:</strong> 370 days access (best value)</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Checking Your Subscription</h4>
          <StepList steps={[
            "Go to Settings → Account tab",
            "View your current plan and expiry date",
            "Contact support to renew before expiry"
          ]} />
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Subscription Expired?</h4>
          <p className="text-sm text-muted-foreground">If your subscription expires:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>You'll be redirected to the expiry page</li>
            <li>Your data remains safe and intact</li>
            <li>Contact support at <strong>tamspro12@gmail.com</strong> to renew</li>
          </ul>
        </div>

        <TipBox>Renew before expiry to avoid any interruption in service.</TipBox>
      </div>
    )
  },
  {
    id: "7-hub-navigation",
    title: "The 7-Hub Navigation & Workspace Map",
    icon: Compass,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          To provide a clutter-free, fast desktop and mobile workspace, TAMS Pro consolidates all agency tools into exactly <strong>7 Clean Hubs</strong> with instant-switching horizontal tabs:
        </p>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Hub-by-Hub Navigation Map</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>1. Dashboard (`/app/dashboard`):</strong> Executive overview of daily sales, live booking counts, pending queries, cash/bank totals, and top notification bell.</li>
            <li><strong>2. Bookings Hub (`/app/bookings`):</strong> Consolidated travel bookings under 4 instant tabs:
              <ul className="list-circle list-inside ml-5 mt-1 space-y-1">
                <li><em>Direct Clients:</em> Retail customer passenger files, e-tickets, invoices, and payments.</li>
                <li><em>B2B Agents:</em> Partner agency accounts, wholesale passenger bookings, and agent ledgers.</li>
                <li><em>Vendors:</em> Service suppliers (airlines, Umrah operators, hotels) and payable ledgers.</li>
                <li><em>Vouchers:</em> Service vouchers (UV Umrah, HV Hotel, TV Transport) with PDF, Print, and WhatsApp sharing.</li>
              </ul>
            </li>
            <li><strong>3. Queries & Quotes Hub (`/app/leads-quotes`):</strong> Lead pipeline with <em>Client Queries</em> and <em>Quotations</em> tabs, equipped with 1-click booking approval.</li>
            <li><strong>4. Accounts Hub (`/app/accounts`):</strong> Complete financial ledger featuring <em>Bank & Cash Manager</em>, <em>Expenses</em>, <em>Refunds</em>, <em>Financial Reports</em>, and <em>Opening Balances</em>.</li>
            <li><strong>5. Notifications Hub (`/app/notifications`):</strong> Unified alert center combining upcoming flight and Umrah departures, daily closing expense prompts, and system notifications.</li>
            <li><strong>6. Umrah Calculator (`/app/umrah-calculator`):</strong> Real-time dynamic Umrah package cost estimation with 1-click Quotation and Booking generation.</li>
            <li><strong>7. Settings Hub (`/app/settings`):</strong> Agency profile branding, Meta WhatsApp Business configuration, notification rules, email dispatch history, and system user manual.</li>
          </ul>
        </div>

        <TipBox>All your bookmarks and previous links (e.g. `/app/expenses`, `/app/vendors`, `/app/vouchers`) automatically and smoothly redirect to the correct hub and active tab without page reloads.</TipBox>
      </div>
    )
  },
  {
    id: "1-click-conversions",
    title: "1-Click Approvals & Automated Booking Conversion",
    icon: CheckCircle2,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Eliminate manual re-typing. TAMS Pro provides instantaneous 1-click pipelines from inquiries and quotes directly into confirmed client bookings:
        </p>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">How to Convert Inquiries & Quotes</h4>
          <StepList steps={[
            "From Client Queries: On any active query card, click 'Convert to Booking'. The booking dialog opens with the client name, phone number, destination, and budget automatically pre-filled.",
            "From Quotations: On any sent or accepted quotation, click 'Convert to Booking'. All quoted line items, client details, and total selling amounts are pre-filled instantly.",
            "From Umrah Calculator: After calculating group or individual passenger costs, click 'Create Booking'. Group size, travel dates, package cost, and selling price pre-populate immediately.",
            "Save Booking: Review the pre-filled fields, assign a vendor if needed, and click 'Add Booking'. The source query is automatically marked Completed, and the quotation is marked Accepted."
          ]} />
        </div>

        <TipBox>Built-in idempotency ensures you never create duplicate bookings accidentally from the same query or quote.</TipBox>
      </div>
    )
  },
  {
    id: "opening-balances",
    title: "Opening Balances & Accounting Engine",
    icon: Scale,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Migrating existing customer or supplier balances into TAMS Pro is simple and safe:
        </p>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Key Accounting Principles</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Brought-Forward Only:</strong> Opening balances represent historical debt or credit prior to using the software. They <em>never</em> count as sales revenue, income, or operational expense in your P&L reports.</li>
            <li><strong>Modal Integration:</strong> When creating a new Bank Account, setting your Cash Drawer Float, or adding a new Direct Client, B2B Agent, or Vendor, an optional 'Opening Balance' section lets you enter brought-forward amounts with 1 step.</li>
            <li><strong>Opening Balances Hub:</strong> View, reconcile, export to Excel/PDF, and audit all agency opening balances anytime under Accounts Hub → Opening Balances tab.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: "whatsapp-integration",
    title: "Meta WhatsApp Business API Integration",
    icon: MessageSquare,
    content: (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Send automated service vouchers, booking confirmations, e-tickets, and payment receipts directly to client WhatsApp numbers using your own Meta WhatsApp Business Cloud credentials:
        </p>

        <div className="space-y-4">
          <h4 className="font-semibold text-base">Step-by-Step WhatsApp Setup</h4>
          <StepList steps={[
            "Create a Meta Developer account at developers.facebook.com and configure a WhatsApp Business app.",
            "Navigate to Settings Hub → WhatsApp Integration tab.",
            "Toggle 'Enable WhatsApp Automated Messaging' to active.",
            "Enter your Meta Phone Number ID, WhatsApp Business Account ID (WABA ID), and System User Permanent Access Token.",
            "Click 'Save WhatsApp Configuration'. Your credentials are encrypted and stored with strict multi-tenant row-level security."
          ]} />
        </div>

        <TipBox>Once configured, you can share vouchers and payment receipts with one click via official Meta cloud channels.</TipBox>
      </div>
    )
  }
];

export default function UserManual() {
  const [openSections, setOpenSections] = useState<string[]>(["first-time-setup"]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">User Manual</h1>
            <p className="text-sm text-muted-foreground">Complete guide to TAMS features</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/settings">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Quick Navigation */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Navigation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <Button
                key={section.id}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setOpenSections(prev => 
                    prev.includes(section.id) ? prev : [...prev, section.id]
                  );
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <section.icon className="w-3 h-3 mr-1.5" />
                {section.title.replace(" (MANDATORY)", "")}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manual Sections */}
      <div className="space-y-3">
        {sections.map((section) => (
          <Card key={section.id} id={section.id} className="overflow-hidden">
            <Collapsible
              open={openSections.includes(section.id)}
              onOpenChange={() => toggleSection(section.id)}
            >
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center gap-3 py-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
                  </div>
                  {openSections.includes(section.id) ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-6">
                  {section.content}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div>
              <p className="font-semibold text-sm">Need more help?</p>
              <p className="text-xs text-muted-foreground">Contact support at support@tamspro.online</p>
            </div>
            <p className="text-xs text-muted-foreground">
              TAMS Pro v1.0 • Developed by TAMS Pro
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}