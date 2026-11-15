import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Settings,
  LayoutDashboard,
  Users,
  HelpCircle,
  Receipt,
  Mail,
  FileText,
  BarChart3,
  Calculator,
  Shield,
  AlertTriangle,
  Lightbulb,
  ArrowLeft,
  Bell,
  Compass,
  Scale,
  MessageSquare,
  Keyboard,
  Wallet,
  RotateCcw,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="list-disc list-inside space-y-1.5 my-3">
    {items.map((item, index) => (
      <li key={index} className="text-sm text-muted-foreground pl-2">{item}</li>
    ))}
  </ul>
);

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="font-semibold text-base">{children}</h4>
);

const Intro = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

const KeyRow = ({ keys, action }: { keys: string; action: string }) => (
  <tr className="border-b last:border-0">
    <td className="py-2 pr-4 align-top">
      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">{keys}</code>
    </td>
    <td className="py-2 text-sm text-muted-foreground">{action}</td>
  </tr>
);

const KeyTable = ({ rows }: { rows: { keys: string; action: string }[] }) => (
  <div className="overflow-x-auto my-3">
    <table className="w-full text-left">
      <tbody>
        {rows.map((row) => (
          <KeyRow key={row.keys + row.action} keys={row.keys} action={row.action} />
        ))}
      </tbody>
    </table>
  </div>
);

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Compass,
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <SubHeading>A. Create Your Account</SubHeading>
          <StepList steps={[
            "Open the TAMS Pro website and click Sign Up Free.",
            "Enter your agency name, phone number, email and password.",
            "Click to create the account. Your 14-day free trial starts right away.",
            "The email you sign up with is saved as your agency email. It shows on your invoices, vouchers and receipts.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Log In</SubHeading>
          <StepList steps={[
            "Click Login and enter your email and password.",
            "Click the eye icon to show or hide the password.",
            "Forgot it? Click Forgot Password and follow the email link.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>C. The Side Menu</SubHeading>
          <Intro>Every screen is in the left menu. On a phone, tap the menu button at the top.</Intro>
          <BulletList items={[
            "Dashboard — today's numbers and quick buttons.",
            "Sales & Expenses — Booking Invoice, Payment Vouchers, Refunds / Voids, Expenses.",
            "Clients & Vendors — all parties and your bank accounts.",
            "Reports — day book, statements, profit and financial reports.",
            "Queries & Quotes — customer enquiries and quotations.",
            "Umrah Calculator — package costing from SAR to PKR.",
            "Notifications — alerts and your reminders.",
            "Settings — account, branding, email, backup and this manual.",
          ]} />
          <TipBox>Admins also see Admin Panel at the top of the menu.</TipBox>
        </div>
      </div>
    ),
  },
  {
    id: "first-time-setup",
    title: "First-Time Setup (MANDATORY)",
    icon: Settings,
    content: (
      <div className="space-y-4">
        <Intro>Do these three steps once, before you create your first invoice.</Intro>
        <div className="space-y-2">
          <SubHeading>A. Branding</SubHeading>
          <StepList steps={[
            "Go to Settings → Branding.",
            "Open Invoice Template. Add your logo, agency details and colours. Save.",
            "Open Booking Template and set up your booking confirmation the same way.",
            "Open Reminder Messages to edit the text used in client reminders.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Email Integration (Gmail)</SubHeading>
          <Intro>TAMS Pro sends invoices and reminders from your own Gmail. You need a Google App Password for this. It is not your normal Gmail password.</Intro>
          <StepList steps={[
            "Go to Settings → Email Integration → Email Configuration.",
            "Agency Gmail Email is already filled with your sign-up email. Change it if needed.",
            "Click How to Create App Password? and follow the steps in your Google account.",
            "Type the 16-character App Password into 16-Character Gmail App Password. Spaces are fine.",
            "Click Save Configuration. The badge changes from Not Configured to Configured.",
          ]} />
          <TipBox>You can save the agency email alone, without a password. Emails will only send once the badge says Configured.</TipBox>
          <WarningBox>The App Password field is always empty when you open the page, even after saving. This is for safety. It shows "Saved · type a new one to replace". Type a new one only if you want to change it.</WarningBox>
        </div>
        <div className="space-y-2">
          <SubHeading>C. Storage & Backup</SubHeading>
          <StepList steps={[
            "Go to Settings → Storage & Backup.",
            "Check your storage use in the quota meter.",
            "Click Choose Folder and pick a folder on your computer.",
            "Click Backup Now to save a backup straight away.",
            "Optional: tick Enable Auto Backup and choose a Backup Frequency (Daily, Weekly or Monthly).",
          ]} />
          <TipBox>Next Backup and Last Backup show you when backups run.</TipBox>
        </div>
      </div>
    ),
  },
  {
    id: "keyboard",
    title: "Working with the Keyboard",
    icon: Keyboard,
    content: (
      <div className="space-y-4">
        <Intro>Every form in TAMS Pro can be filled with the keyboard only. The mouse still works the same as before.</Intro>
        <div className="space-y-2">
          <SubHeading>A. Moving Between Fields</SubHeading>
          <KeyTable rows={[
            { keys: "Enter", action: "Go to the next field." },
            { keys: "Shift + Enter", action: "Go back one field." },
            { keys: "Tab / Shift + Tab", action: "Next / previous field, including buttons like Quick Add." },
            { keys: "Ctrl + S (Cmd + S on Mac)", action: "Save the form." },
            { keys: "Esc", action: "Close the form. If you typed something, it asks you first." },
          ]} />
          <TipBox>The field you are on has a clear coloured ring around it.</TipBox>
          <BulletList items={[
            "Locked, read-only and auto fields are skipped. Examples: Date, Remaining (auto), Profit.",
            "If a required field is empty, Enter does not move on. You see an error and stay on that field.",
            "When you change Service Type or Trip Type, the order updates by itself.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Dropdowns (Client, Vendor, Service Type, Payment Mode…)</SubHeading>
          <StepList steps={[
            "Press Enter to open the list.",
            "Type to search. Use the Up and Down arrows to pick.",
            "Press Enter to select. The list closes and you move to the next field in one press.",
            "Press Esc to close the list without moving.",
          ]} />
          <Intro>If nothing matches your search, Enter does nothing. Quick Add buttons are skipped by Enter. Reach them with Tab or the mouse.</Intro>
        </div>
        <div className="space-y-2">
          <SubHeading>C. Passengers (Booking Invoice)</SubHeading>
          <BulletList items={[
            "Enter moves: Name → Passport # → Type → Gender → DOB.",
            "Enter on DOB goes to the next passenger's Name.",
            "Enter on the last passenger's DOB goes to Purchasing Cost. It never adds a row.",
            "Ctrl + Enter (Cmd + Enter) inside a passenger row adds a new passenger.",
            "You can also press Enter on the + Add Passenger button.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>D. Line Items (Quotation)</SubHeading>
          <BulletList items={[
            "Enter moves: Description → Qty → Unit Price → next line.",
            "On the last line, Enter moves on to the totals. It never adds a line.",
            "Ctrl + Enter (Cmd + Enter) adds a new line.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>E. Remarks and Notes Boxes</SubHeading>
          <BulletList items={[
            "Enter starts a new line inside the box.",
            "Ctrl + Enter (Cmd + Enter) jumps to the Save button.",
            "Enter on the Save button saves the form.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>F. Page Shortcuts</SubHeading>
          <KeyTable rows={[
            { keys: "Ctrl + 1", action: "Queries & Quotes → Quotations tab." },
            { keys: "Ctrl + 2", action: "Queries & Quotes → Queries tab." },
          ]} />
        </div>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    content: (
      <div className="space-y-4">
        <Intro>The Dashboard shows how your agency is doing this month. Use the month button at the top right to see another month.</Intro>
        <div className="space-y-2">
          <SubHeading>A. The Six Cards</SubHeading>
          <Intro>Click any card to open the full details.</Intro>
          <BulletList items={[
            "Cash & Bank — money in cash and all banks. Opens Payment Vouchers.",
            "Client Dues — what clients still owe you. Opens Clients & Vendors.",
            "Vendor Dues — what you still owe vendors.",
            "Profit (Month) — profit for the selected month. Opens the Booking Report.",
            "Today's Bookings — invoices made today.",
            "Overdue Invoices — unpaid invoices past their due date.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Quick Buttons</SubHeading>
          <BulletList items={[
            "Create Booking — opens a new Booking Invoice.",
            "Umrah Calculator — opens the calculator.",
            "Add Payment — opens a new Payment Voucher.",
            "Add Quotation — opens a new Quotation.",
            "New Client Query — opens a new Query.",
            "Add Expense / Bill — opens a new Expense.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>C. Notifications Panel</SubHeading>
          <Intro>Shows the latest alerts. Click the action button to deal with it, or Mark Done to clear it.</Intro>
        </div>
      </div>
    ),
  },
  {
    id: "clients-vendors",
    title: "Clients & Vendors",
    icon: Users,
    content: (
      <div className="space-y-4">
        <Intro>All clients, B2B agents and vendors are called parties. They live in one list. Your bank accounts are here too.</Intro>
        <div className="space-y-2">
          <SubHeading>A. Parties Tab</SubHeading>
          <Intro>Columns: Party Code, Name, Type, Current Balance, Actions.</Intro>
          <StepList steps={[
            "Click Add New Party.",
            "Choose the Type (client, vendor or both).",
            "Fill in Name (required), Phone, Email, Opening Balance (PKR), Credit Limit (PKR), City, Address and Notes.",
            "Save.",
          ]} />
          <TipBox>Use the search box and the type and balance filters to find a party fast.</TipBox>
        </div>
        <div className="space-y-2">
          <SubHeading>B. Party Profile</SubHeading>
          <Intro>Click a party to open its profile. It has four tabs:</Intro>
          <BulletList items={[
            "Overview — contact details and balance.",
            "Bookings — all invoices for this party.",
            "Payments — all money received or paid.",
            "Statement — full ledger with running balance. You can print or export it.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>C. Banks Tab</SubHeading>
          <Intro>Columns: Bank Name, Account Title, Account No, Branch, Current Balance, Actions.</Intro>
          <StepList steps={[
            "Click Add New Bank.",
            "Fill in Bank Name and Account Title (both required).",
            "Optional: Account Number, Branch Name / City, Opening Balance (PKR).",
            "Save. The bank now appears in every Payment Mode list.",
          ]} />
        </div>
        <TipBox>In any form, the Quick Add button next to Client or Vendor adds a new party without leaving the form.</TipBox>
      </div>
    ),
  },
  {
    id: "booking-invoice",
    title: "Booking Invoice",
    icon: Plane,
    content: (
      <div className="space-y-4">
        <Intro>Go to Sales & Expenses → Booking Invoice. Click New Booking Invoice to create an invoice.</Intro>
        <div className="space-y-2">
          <SubHeading>A. Fill in the Invoice</SubHeading>
          <StepList steps={[
            "Date is locked to today. You cannot change it.",
            "Choose the Service Type: Air Ticket, Umrah Package, Visa Services, Hotel Booking, Travel Insurance or Other Services.",
            "Choose the Client (required) and the Vendor.",
            "Fill in the fields for that service (see below).",
            "Add the passengers.",
            "Enter Purchasing Cost, Total Amount (required) and Amount Paid.",
            "Remaining (auto) and Profit are worked out for you.",
            "Set the Due Date and Payment Mode, and add Remarks if needed.",
            "Click Save.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Fields for Each Service</SubHeading>
          <BulletList items={[
            "Air Ticket — Trip Type, Flight Date, Flight Time, Sector, Airline, PNR, Ticket No. For Return trips: Return Flight Date and Return Flight Time.",
            "Umrah Package — Ziyarat, Departure City, Arrival City, Flight Date, Return Date, Transport, Makkah Hotel, Makkah Nights, Madinah Hotel, Madinah Nights.",
            "Visa Services — Country, Visa Type, Validity.",
            "Hotel Booking — Hotel Name, City, Check-In, Check-Out, Room Type.",
            "Travel Insurance — Insurance Provider / Plan, Duration (Days).",
            "Other Services — Service Description.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>C. Passengers</SubHeading>
          <Intro>Each row has Name, Passport #, Type, Gender and DOB. Click + Add Passenger for another row, or press Ctrl + Enter.</Intro>
        </div>
        <div className="space-y-2">
          <SubHeading>D. The Invoice List</SubHeading>
          <Intro>Columns: Invoice #, Date, Service, Client, PDF, Status, Remaining Amount (PKR), Paid Amount (PKR), Total Amount (PKR).</Intro>
          <BulletList items={[
            "Search by invoice #, client, PNR, ticket #, service or status.",
            "Use the date filter to choose a period.",
            "Click a row to see the full details.",
            "Use the PDF column to print the invoice or booking confirmation.",
          ]} />
        </div>
        <TipBox>Saving an invoice posts it to the accounts by itself. You do not need to make any ledger entry.</TipBox>
      </div>
    ),
  },
  {
    id: "payment-vouchers",
    title: "Payment Vouchers",
    icon: Wallet,
    content: (
      <div className="space-y-4">
        <Intro>Use a Payment Voucher every time money comes in or goes out. Go to Sales & Expenses → Payment Vouchers.</Intro>
        <StepList steps={[
          "Click New Payment Voucher.",
          "Date is locked to today.",
          "Choose the Direction: Received (CRV) for money in, Paid (CPV) for money out.",
          "Choose the party.",
          "Choose the Payment Mode (cash or one of your banks).",
          "Enter Amount (PKR).",
          "Optional: Cheque / Reference No, Link to Invoice, Remarks.",
          "Save.",
        ]} />
        <Intro>List columns: Voucher #, Date, Type, Party / Particulars, Mode, Amount (PKR), Print.</Intro>
        <TipBox>Link the voucher to an invoice so that invoice's remaining amount goes down.</TipBox>
      </div>
    ),
  },
  {
    id: "refunds-voids",
    title: "Refunds / Voids",
    icon: RotateCcw,
    content: (
      <div className="space-y-4">
        <Intro>Go to Sales & Expenses → Refunds / Voids. Use this when a client cancels.</Intro>
        <StepList steps={[
          "Click New Refund / Void.",
          "Choose the Type: Refund (give money back) or Void (cancel the invoice).",
          "Enter the Original Invoice / PNR / Ticket No. The Party Name fills in.",
          "Enter Supplier Refund (PKR) and Deductions (PKR).",
          "Add Notes / Deductions Breakdown and the reason.",
          "Tick Pending Vendor if the vendor has not paid you back yet.",
          "Save.",
        ]} />
        <Intro>List columns: Date, Refund #, Invoice / Ticket / PNR, Party Name, Reason, Mode, Amount (PKR).</Intro>
      </div>
    ),
  },
  {
    id: "expenses",
    title: "Expenses",
    icon: Receipt,
    content: (
      <div className="space-y-4">
        <Intro>Go to Sales & Expenses → Expenses for office costs like rent, salaries and bills.</Intro>
        <StepList steps={[
          "Click New Expense.",
          "Choose the Category. Use Quick Add for a new one.",
          "Enter Amount (PKR).",
          "Choose Paid From (cash or a bank).",
          "Optional: Bill / Receipt / Ref No and Particulars & Notes.",
          "For a repeating bill, set the Frequency, Start Date, End Date (Optional) and Next Due Date.",
          "Save.",
        ]} />
        <Intro>List columns: Date, Expense #, Category, Type, Paid From, Ref / Receipt #, Particulars, Amount (PKR).</Intro>
      </div>
    ),
  },
  {
    id: "queries-quotes",
    title: "Queries & Quotes",
    icon: MessageSquare,
    content: (
      <div className="space-y-4">
        <Intro>This screen has two tabs: Quotations (Ctrl + 1) and Queries (Ctrl + 2).</Intro>
        <div className="space-y-2">
          <SubHeading>A. Add a Query</SubHeading>
          <StepList steps={[
            "Open the Queries tab and click Add Query.",
            "Fill in Client Name and Query / Request Details (both required).",
            "Add Contact Number, Assigned To, Priority, Status and Due Date.",
            "Add Internal Follow-up Notes if needed.",
            "Save.",
          ]} />
          <Intro>List columns: Client, Contact, Query / Request, Priority, Status, Assigned To, Due Date, Actions.</Intro>
          <TipBox>From a query, use Create Quotation to start a quote with the client already filled in.</TipBox>
        </div>
        <div className="space-y-2">
          <SubHeading>B. Make a Quotation</SubHeading>
          <StepList steps={[
            "Open the Quotations tab and click New Quotation.",
            "Quotation # is made for you. Date is locked to today.",
            "Choose the Service Type. The service name is used as the quotation title.",
            "Choose the Client / Recipient Name. Phone Number fills in from the client record. You can change it.",
            "Set Valid Until. Use the +7, +15 or +30 day buttons for speed.",
            "Choose the Status.",
            "Fill in the service fields. These are the same as on the Booking Invoice.",
            "Add line items: Description, Qty, Unit Price. Amount is worked out. Use Add line for more.",
            "On the right, check Currency, Subtotal, Discount (−), Tax / Fee (+) and Total.",
            "On the left, write Notes / Terms.",
            "Click Save Quotation, or Save & PDF to also download it.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>C. The Quotation List</SubHeading>
          <Intro>Columns: Quotation #, Date, Client, Service Type, Total, Status, Actions.</Intro>
          <BulletList items={[
            "Convert — turn the quotation into a booking.",
            "Eye icon — preview.",
            "Pencil icon — edit.",
            "Download icon — download the PDF.",
            "Mail icon — email the PDF to the client (Email Integration must be Configured).",
          ]} />
        </div>
      </div>
    ),
  },
  {
    id: "umrah-calculator",
    title: "Umrah Calculator",
    icon: Calculator,
    content: (
      <div className="space-y-4">
        <Intro>Work out the full cost of an Umrah package. Enter prices in SAR and see them in PKR.</Intro>
        <StepList steps={[
          "Go to Umrah Calculator in the side menu.",
          "Enter the exchange rate, number of people, nights, hotels, visa, transport and flight costs.",
          "Click Calculate.",
          "Check the cost per person and the total.",
        ]} />
        <SubHeading>What You Can Do Next</SubHeading>
        <BulletList items={[
          "Download Summary — save the costing as a file.",
          "Save Draft — keep it to finish later.",
          "Copy Quote — copy the price text to send on WhatsApp.",
          "Create Quotation — open a new quotation with these prices.",
          "Save Preset — save your usual rates to reuse.",
        ]} />
        <TipBox>Use Unlock to change locked rate fields.</TipBox>
      </div>
    ),
  },
  {
    id: "reports",
    title: "Reports",
    icon: BarChart3,
    content: (
      <div className="space-y-4">
        <Intro>Go to Reports in the side menu. Choose a date range with the date filter at the top.</Intro>
        <BulletList items={[
          "1. Daily Report (Day Book) — every entry for the day: Date, Voucher / Bill #, Description / Particulars, Entry, Debit (DR), Credit (CR), Running Balance.",
          "2. Account Statement — the ledger for one party, with overdue items.",
          "3. Booking Report (Profit) — Bill No, Date, Client, Vendor, Service, Ticket / PNR, Invoice Total, Payable, Profit (PKR).",
          "4. Financial Reports — Profit & Loss Report, Accounts Summary, Assets & Dues, Monthly Income, Monthly Expenses.",
        ]} />
        <TipBox>Click Drill down → on any figure to see the entries behind it. Use the Export button to save a report.</TipBox>
      </div>
    ),
  },
  {
    id: "notifications",
    title: "Notifications & Reminders",
    icon: Bell,
    content: (
      <div className="space-y-4">
        <Intro>Go to Notifications. The bell in the menu shows how many alerts are unread.</Intro>
        <div className="space-y-2">
          <SubHeading>A. Tabs</SubHeading>
          <BulletList items={[
            "All Activity — every alert.",
            "Flights & Umrah — departures today and tomorrow.",
            "Accounts & Operations — payments due, expenses and refunds.",
            "My Reminders — reminders you created.",
            "Preferences — choose which alerts you want.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Add a Reminder</SubHeading>
          <StepList steps={[
            "Click New Reminder.",
            "Fill in Date and Title (both required).",
            "Add Time, Type, Priority and Link To (a client or booking).",
            "Choose Repeat and Remind Me Before.",
            "Add Remarks and Save.",
          ]} />
        </div>
      </div>
    ),
  },
  {
    id: "emails-pdfs",
    title: "Emails & PDFs",
    icon: Mail,
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <SubHeading>A. PDFs</SubHeading>
          <BulletList items={[
            "Booking invoices and booking confirmations — from the PDF column in Booking Invoice.",
            "Payment vouchers — from the Print column in Payment Vouchers.",
            "Quotations — from the Download icon or Save & PDF.",
            "All PDFs use your logo and details from Settings → Branding.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Sending Emails</SubHeading>
          <StepList steps={[
            "Make sure the client has an email address.",
            "Click the email button on the invoice, reminder or quotation.",
            "The PDF is attached and sent from your agency Gmail.",
          ]} />
          <WarningBox>If you see "Add your Gmail App Password in Settings → Email Integration to send emails.", finish Email Integration in First-Time Setup.</WarningBox>
          <TipBox>See every sent email in Settings → Email Integration → Email History. Use Email Log Cleanup to delete old logs automatically.</TipBox>
        </div>
      </div>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    icon: Shield,
    content: (
      <div className="space-y-4">
        <Intro>Settings has five tabs: Account, Branding, Email Integration, Storage & Backup and User Manual.</Intro>
        <div className="space-y-2">
          <SubHeading>A. Account</SubHeading>
          <BulletList items={[
            "Admin & Subscription — your plan, trial days and expiry date.",
            "Sub-Users — add staff and choose what each person can see and do.",
            "Security & Password — change your password.",
            "Legal & Support — privacy policy, terms and how to contact support.",
          ]} />
        </div>
        <div className="space-y-2">
          <SubHeading>B. Branding</SubHeading>
          <Intro>Invoice Template, Booking Template and Reminder Messages. See First-Time Setup.</Intro>
        </div>
        <div className="space-y-2">
          <SubHeading>C. Email Integration</SubHeading>
          <Intro>Email Configuration, Email History and Email Log Cleanup.</Intro>
        </div>
        <div className="space-y-2">
          <SubHeading>D. Storage & Backup</SubHeading>
          <Intro>Storage meter, Choose Folder, Backup Now and Auto Backup.</Intro>
        </div>
        <WarningBox>Sub-users cannot edit money records such as ledger, bank and refund entries. Only the main account can.</WarningBox>
      </div>
    ),
  },
  {
    id: "accounting-rules",
    title: "How the Accounts Work",
    icon: Scale,
    content: (
      <div className="space-y-4">
        <BulletList items={[
          "Every invoice, voucher, refund and expense posts to the accounts by itself.",
          "The main date on these forms is locked to today. This keeps your books honest.",
          "Client balance goes up with an invoice and down with a Received (CRV) voucher.",
          "Vendor balance goes up with a purchase and down with a Paid (CPV) voucher.",
          "Opening balances for parties and banks are set when you add them.",
          "Each agency's data is private. No other agency can see it.",
        ]} />
        <TipBox>To fix a wrong invoice, use Refunds / Voids. Do not delete it. This keeps a clear record.</TipBox>
      </div>
    ),
  },
  {
    id: "common-problems",
    title: "Common Problems",
    icon: HelpCircle,
    content: (
      <div className="space-y-4">
        <BulletList items={[
          "Emails do not send → Check Settings → Email Integration shows Configured.",
          "\"Gmail authentication failed\" → Create a new App Password in Google and save it again.",
          "Enter does not move to the next field → A required field is empty. Fill it in first.",
          "Cannot change the date → The date is locked to today on purpose.",
          "A client is missing from the list → Add them with Quick Add or in Clients & Vendors.",
          "Trial expired → Go to Settings → Account → Admin & Subscription.",
        ]} />
      </div>
    ),
  },
  {
    id: "documents",
    title: "Quick Reference",
    icon: FileText,
    content: (
      <div className="space-y-4">
        <BulletList items={[
          "New invoice: Sales & Expenses → New Booking Invoice.",
          "Money in or out: Sales & Expenses → New Payment Voucher.",
          "Client cancels: Sales & Expenses → New Refund / Void.",
          "Office bill: Sales & Expenses → New Expense.",
          "New client: Clients & Vendors → Add New Party.",
          "New bank: Clients & Vendors → Banks → Add New Bank.",
          "Price quote: Queries & Quotes → Quotations → New Quotation.",
          "Today's entries: Reports → 1. Daily Report (Day Book).",
        ]} />
      </div>
    ),
  },
];

export default function UserManual() {
  const [openSections, setOpenSections] = useState<string[]>(["getting-started"]);

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
