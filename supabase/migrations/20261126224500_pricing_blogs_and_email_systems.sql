-- ==============================================================================
-- TAMS PRO — ADDITIVE MIGRATION: PRICING DISPLAY, BLOG UPDATES & DUAL EMAIL SYSTEMS
-- File: supabase/migrations/20261126224500_pricing_blogs_and_email_systems.sql
--
-- STRICTLY ADDITIVE & NON-DESTRUCTIVE:
--   1. Updates public.site_settings (pricing_plans display config only; zero changes to
--      existing subscriber plans, licenses, or payment history).
--   2. Updates existing rows in public.blog_posts (PKR 1,999/mo with no monthly discount,
--      50% off yearly only, and replaces umrahcal.online with TAMS Pro Umrah Calculator guide).
--   3. Creates public.system_email_logs (super_admin-only RLS for tamspro12@gmail.com logs).
--   4. Creates public.agency_email_settings (encrypted per-agency Gmail App Passwords,
--      column-level REVOKE SELECT on encrypted_app_password, strict per-agency RLS).
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. UPDATE SITE_SETTINGS PRICING DISPLAY CONFIG (Task 0)
-- ------------------------------------------------------------------------------
INSERT INTO public.site_settings (key, value)
VALUES (
  'pricing_plans',
  jsonb_build_object(
    'eyebrow', 'PRICING',
    'heading', 'Choose your plan',
    'plans', jsonb_build_array(
      jsonb_build_object(
        'id', 'monthly',
        'name', 'Monthly',
        'popular', false,
        'priceFormatted', 'PKR 1,999',
        'originalPriceFormatted', '',
        'discountBadge', '',
        'period', '/ month',
        'bullets', jsonb_build_array(
          'All core features',
          'Up to 2 sub-users',
          'Email integration',
          'Cloud backup',
          'Mobile access',
          'Email support'
        ),
        'ctaText', 'Get Started',
        'ctaLink', '/signup'
      ),
      jsonb_build_object(
        'id', 'yearly',
        'name', 'Yearly',
        'popular', true,
        'priceFormatted', 'PKR 9,999',
        'originalPriceFormatted', '19,999',
        'discountBadge', '50% OFF',
        'period', '/ year',
        'bullets', jsonb_build_array(
          'Everything in Monthly',
          'Priority support',
          'Advanced reports',
          'Unlimited bookings',
          'Custom branding',
          '2 months free'
        ),
        'ctaText', 'Get Started',
        'ctaLink', '/signup'
      )
    )
  )
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = now();

-- ------------------------------------------------------------------------------
-- 2. UPDATE EXISTING BLOG POSTS IN SUPABASE (Tasks 0 & 3 — no rows deleted)
-- ------------------------------------------------------------------------------
UPDATE public.blog_posts
SET
  excerpt = 'Compare the best travel agency software in Pakistan for bookings, Umrah packages, PKR ledgers, visas, and invoices. Start with TAMS Pro at PKR 1,999/month.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Pakistani travel agencies lose an average of 4% to 8% of monthly revenue to unbilled extras, forgotten sub-agent dues, and manual register errors.</li><li>Generic international CRMs fail in Pakistan because they lack PKR accounting, Umrah SAR-to-PKR costing, and party-wise khata ledgers.</li><li>Evaluating travel agency software in 2026 comes down to five essentials: unified bookings, automated accounting, branded PDFs, visa tracking, and predictable PKR pricing.</li><li>TAMS Pro delivers all core modules at PKR 1,999/month, or PKR 9,999/year with a 50% discount available exclusively on the yearly plan.</li></ul></blockquote>

<p>Running a travel agency in Pakistan in 2026 looks nothing like it did five years ago. Clients in Lahore, Karachi, Islamabad, Rawalpindi, Jhelum, and Faisalabad compare flight fares and Umrah deals on WhatsApp within minutes. Meanwhile, your team still has to coordinate airline suppliers, Saudi hotel confirmations, visa biometrics, cash and bank collections, and sub-agent credit limits—often during peak Shawwal or Ramadan rushes when phones never stop ringing.</p>

<p>Yet many agencies still run a PKR 50 lakh monthly turnover on handwritten registers, scattered WhatsApp screenshots, and three disconnected Excel files. One lost sticky note or mistyped PNR balance easily wipes out the commission from an entire family booking. That is why choosing the right <strong>travel agency software in Pakistan</strong> has shifted from a "nice-to-have" upgrade to a basic survival decision.</p>

<h2>Why Generic Global Travel CRMs Fail Pakistani Agencies</h2>

<p>When agency owners search online for management tools, they often run into expensive European or American platforms built for tour operators charging credit cards in USD or EUR. Within two weeks of testing them, Pakistani teams discover frustrating gaps:</p>

<ul>
  <li><strong>No dual-party travel ledger:</strong> In Pakistan, one booking involves a receivable from a passenger or sub-agent and a payable to a consolidator or Saudi vendor. Generic invoicing tools rarely track both sides cleanly inside one transaction.</li>
  <li><strong>Zero Umrah workflow support:</strong> Managing Makkah and Madinah hotel nights, transport, visa fees, and SAR-to-PKR exchange fluctuations requires dedicated costing and voucher tools, not generic tour templates.</li>
  <li><strong>Dollar-pegged subscriptions:</strong> Paying USD 79 per user every month strains local margins, especially when currency swings hit and you have three or four counter staff.</li>
  <li><strong>Slow mobile usability:</strong> Pakistani agency owners check balances from home, airports, or bank queues on their phones. Bloated enterprise dashboards freeze on mobile connections.</li>
</ul>

<p>If your team has struggled with spreadsheets or outgrown manual notebooks, reading our breakdown of <a href="/blogs/excel-vs-travel-agency-software-pakistan">Excel vs travel agency software</a> highlights exactly where spreadsheets break down once you pass 30 bookings a month.</p>

<h2>What to Look for in Travel Agency Management Software in 2026</h2>

<p>Before committing your client records and financial history to any platform, test how it handles the actual daily workflow of a Pakistani ticketing and Umrah desk. Look for these seven non-negotiable pillars.</p>

<h3>1. Unified Ticketing, Umrah, and Visa Bookings</h3>

<p>Your staff should never enter passenger details twice. When a family walks into your office in Gulberg or Saddar for a return Dubai ticket or a 14-day Umrah package, one booking screen should record passenger names, passport numbers, sectors, vendor cost, selling price, and calculated profit immediately. Whether it is a one-way domestic flight, a multi-city international itinerary, or a group Umrah departure, every booking belongs in one searchable register.</p>

<h3>2. Automated Client, Sub-Agent, and Vendor Ledgers</h3>

<p>Accounting mistakes happen when payments sit in one book and invoices sit in another. Every saved booking should automatically update the client''s receivable balance and the airline or vendor''s payable balance. When you receive PKR 185,000 via Meezan Bank transfer or cash at the counter, a payment voucher must update the cash or bank account and print a clean receipt instantly. Dive deeper into this workflow in our <a href="/blogs/travel-agency-accounting-ledger-pakistan">travel agency accounting and ledger guide</a>.</p>

<h3>3. Fast Umrah Costing and Package Management</h3>

<p>During peak Umrah months, SAR rates and hotel availability change daily. An agency operator in Gujranwala or Rawalpindi cannot spend 45 minutes recalculating quad, triple, and double sharing rates by hand while a group leader waits on the phone. Using the Umrah Calculator built inside TAMS Pro is straightforward: open <strong>Umrah Calculator</strong> from the left sidebar, enter today''s SAR-to-PKR exchange rate, add your Makkah and Madinah hotels with nights and room sharing (Quad, Triple, Double, or Quint), enter visa, transport, and flight costs with your target margin, and generate an instant PKR summary or quotation.</p>

<h3>4. Branded PDF Invoices, Quotations, and Vouchers</h3>

<p>First impressions close high-ticket deals. Sending a plain WhatsApp text message with broken formatting tells a corporate client or overseas Pakistani family that your operation is informal. Your software should generate crisp, logo-branded PDF quotations in two minutes and convert approved quotes straight into invoices and hotel or ticket vouchers without retyping.</p>

<h3>5. Visa Application and Deadline Tracking</h3>

<p>Forgetting a Schengen embassy appointment, a UAE visa expiry window, or a Saudi Umrah biometric deadline damages your reputation permanently. Dedicated status tracking keeps pending documents, passport handovers, and expiry alerts visible to your entire team every morning.</p>

<h3>6. Role-Based Staff Access and Audit Trails</h3>

<p>As your agency grows beyond the founder, you hire ticketing clerks, accountants, and branch managers. You need sub-user accounts with granular permissions so counter staff can create quotations or view schedules without exporting your entire client database or silently deleting past payment records.</p>

<h3>7. Predictable PKR Pricing Without Per-Invoice Penalties</h3>

<p>Avoid tools that charge hidden fees per booking, limit PDF downloads, or lock you into confusing tiers. Transparent PKR pricing lets you budget confidently through both peak and off-peak months.</p>

<blockquote><p><strong>Ready to replace manual registers?</strong> Explore all modules on our <a href="/features">Features page</a> or check <a href="/pricing">TAMS Pro Pricing</a>—PKR 1,999/month, or PKR 9,999/year with 50% off exclusively on the yearly plan. <a href="/signup">Create your free agency account today</a>.</p></blockquote>

<h2>Top Travel Software Options Used in Pakistan Compared</h2>

<p>Across Pakistani cities, agencies generally choose between four categories of tools:</p>

<ul>
  <li><strong>Paper Registers &amp; Calculators:</strong> Zero monthly software fee, but high hidden cost from forgotten receivables, duplicate payments, and hours spent preparing monthly party statements.</li>
  <li><strong>Custom Excel Workbooks:</strong> Flexible at first, yet fragile when multiple staff edit formulas, search old PNRs, or track partial cash and bank installments across hundreds of clients.</li>
  <li><strong>Legacy Desktop Accounting Apps:</strong> Built for general traders and wholesalers, not travel. They lack passport fields, PNR references, Umrah vouchers, and travel-specific profit per ticket.</li>
  <li><strong>TAMS Pro (Purpose-Built Cloud Travel Platform):</strong> Engineered around Pakistani travel workflows—covering ticketing, Umrah costing, visas, dual-sided party ledgers, cash/bank books, branded PDFs, reminders, and cloud backups on desktop and mobile.</li>
</ul>

<h2>How TAMS Pro Fits Small &amp; Mid-Sized Pakistani Travel Agencies</h2>

<p>Consider a typical 3-person agency in Rawalpindi handling 80 air tickets, 25 Umrah passengers, and 15 visit visas a month. With TAMS Pro, the owner sets up agency branding, bank accounts (HBL, Meezan, JazzCash, Cash-in-Hand), and opening party balances in under 20 minutes.</p>

<p>Every morning, the dashboard displays exact cash and bank liquidity, total receivables from clients, payables owed to consolidators, and urgent overdue alerts. When a client asks for a statement on WhatsApp, one click exports an accurate date-filtered ledger PDF with brought-forward and closing balances—eliminating awkward disputes over old PKR 15,000 or PKR 40,000 adjustments.</p>

<p>Whether you operate from a busy commercial plaza in Clifton, a ticketing office in Blue Area, or a growing agency in Jhelum, having standardized systems also prepares your business to scale smoothly. Read our step-by-step playbook on <a href="/blogs/grow-travel-agency-pakistan-digital-tools">how to grow your travel agency in Pakistan with digital tools</a> for practical expansion tactics.</p>

<h2>Final Verdict: Choosing the Right System This Week</h2>

<p>You do not need a complex enterprise rollout to modernize your office. Start by listing the three biggest bottlenecks costing your agency money right now—usually uncollected client balances, slow Umrah quoting, or messy paper vouchers. Pick a system designed for local PKR accounting and mobile access so your staff actually enjoys using it daily.</p>

<p><strong>Take the next step:</strong> Compare our <a href="/pricing">PKR 1,999/month and PKR 9,999/year (50% off yearly) plans</a> or <a href="/signup">sign up free on TAMS Pro</a> in under two minutes to see how clean your agency records can look today.</p>

<h2>Frequently Asked Questions</h2>

<h3>Which is the best travel agency software in Pakistan in 2026?</h3>
<p>TAMS Pro is purpose-built for Pakistani travel and Umrah agencies, unifying bookings, PKR ledgers, visa tracking, quotations, branded vouchers, and a built-in Umrah cost calculator at PKR 1,999/month.</p>

<h3>How much does travel agency management software cost in Pakistan?</h3>
<p>While foreign CRMs charge USD 50 to 200 per month, TAMS Pro offers transparent local pricing at PKR 1,999 per month, or PKR 9,999 per year (was PKR 19,999 — 50% off exclusively on the yearly plan), including cloud backups and mobile access.</p>

<h3>Can travel agency software handle both ticketing and Umrah packages?</h3>
<p>Yes. TAMS Pro manages one-way and return air tickets alongside complete Umrah packages, hotel and transport vouchers, visa applications, and SAR-to-PKR costing inside one dashboard.</p>

<h3>Do I need technical skills or an IT team to use TAMS Pro?</h3>
<p>No technical background is required. The interface is clean and intuitive so counter staff in Lahore, Karachi, Islamabad, or regional cities can create invoices and vouchers on day one.</p>

<h3>Is cloud travel software safer than local Excel sheets or paper registers?</h3>
<p>Yes. Cloud databases prevent accidental formula overwrites, hard-drive crashes, or lost registers while keeping full agency audit trails and role-based sub-user access.</p>',
  tags = ARRAY['travel agency software Pakistan', 'travel agency management system', 'travel agency ka software', 'umrah package software', 'travel agent ledger', 'best travel software 2026', 'travel agency billing software']::TEXT[],
  secondary_keywords = ARRAY['travel agency management system Pakistan', 'best travel agent software', 'travel agency ka software']::TEXT[],
  seo_description = 'Compare the best travel agency software in Pakistan for bookings, Umrah packages, PKR ledgers, visas, and invoices. Start with TAMS Pro at PKR 1,999/month.',
  read_time_minutes = 8,
  faq_items = '[{"question":"Which is the best travel agency software in Pakistan in 2026?","answer":"TAMS Pro is built specifically for Pakistani travel and Umrah agencies, combining bookings, PKR ledgers, visa tracking, quotations, branded vouchers, and a built-in Umrah cost calculator at PKR 1,999/month (or PKR 9,999/year with 50% off on the yearly plan)."},{"question":"How much does travel agency management software cost in Pakistan?","answer":"Most enterprise ERP tools charge USD 50 to 200 per month or heavy upfront setup fees. TAMS Pro costs PKR 1,999 per month, or PKR 9,999 per year (was PKR 19,999 — 50% off exclusively on the yearly plan)."},{"question":"Can travel agency software handle both ticketing and Umrah packages?","answer":"Yes. Modern agency platforms track one-way and return airline tickets alongside multi-passenger Umrah packages, hotel vouchers, visa status, and SAR-to-PKR costing in one database."},{"question":"Do I need technical skills or an IT team to use TAMS Pro?","answer":"No. TAMS Pro runs in any desktop or mobile browser with zero installation, making it easy for counter staff in Lahore, Karachi, Islamabad, or smaller towns to learn within a single afternoon."},{"question":"Is cloud travel software safer than local Excel sheets or paper registers?","answer":"Yes. Paper registers can be damaged or lost, and desktop Excel files get corrupted or accidentally deleted. Cloud-backed software stores encrypted agency records with automatic backups and user permissions."}]'::jsonb,
  updated_at = now()
WHERE slug = 'best-travel-agency-software-pakistan-2026';

UPDATE public.blog_posts
SET
  excerpt = 'Learn how Pakistani travel agents manage Umrah packages digitally from SAR costing, hotel vouchers, and group bookings to PKR ledgers easily with TAMS Pro.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Umrah seasons in Rajab, Shaban, and Ramadan compress months of bookings into chaotic weeks—making manual folders and WhatsApp searches a major operational risk.</li><li>A digital Umrah workflow connects five stages: SAR-to-PKR costing, fast quotation, family/group booking, hotel &amp; ticket vouchers, and installment ledgers.</li><li>Calculating exact package tiers in TAMS Pro''s built-in Umrah Calculator prevents exchange-rate losses when SAR fluctuates.</li><li>TAMS Pro gives Pakistani Umrah operators complete control over pilgrims, Saudi vendors, and vouchers for PKR 1,999/month (or PKR 9,999/year with 50% off on the yearly plan).</li></ul></blockquote>

<p>Every seasoned Umrah operator in Lahore, Gujranwala, Sialkot, or Karachi knows the stress of the 15th of Shaban. Within forty-eight hours, hotel tariffs in Makkah shift, flight group seats fill up, three families ask to upgrade from quad to triple sharing, and a sub-agent from Faisalabad deposits partial cash without sending a clear breakdown. When your records live inside thick physical folders and WhatsApp chat threads, one overlooked room change can leave pilgrims waiting in a lobby at 2:00 AM.</p>

<p>Switching to dedicated <strong>umrah package management software</strong> transforms seasonal chaos into a calm, repeatable assembly line. Here is a complete digital system any Pakistani agency can adopt before the next Umrah rush.</p>

<h2>Why Manual Umrah Files Break Down During Peak Season</h2>

<p>Umrah packages are far more complex than point-to-point airline tickets. A single family of five booking a 15-day trip involves multiple moving parts:</p>

<ul>
  <li>Two or three airline legs across Saudia, PIA, Airblue, or Flynas</li>
  <li>Makkah hotel check-in, check-out, room type (Sharing, Quad, Triple, Double), and meal plans</li>
  <li>Madinah hotel dates and Haram distance preferences</li>
  <li>Jeddah–Makkah–Madinah–Airport ground transport</li>
  <li>Saudi Umrah visa issuance, insurance, and BRN verification</li>
  <li>Multi-currency supplier settlements in SAR alongside PKR collections from clients</li>
</ul>

<p>When staff track these details on paper or scattered spreadsheets, errors multiply: wrong check-in dates printed on vouchers, forgotten transport legs, or inaccurate profit calculations after SAR rises by two rupees overnight.</p>

<h2>The 5-Stage Digital Umrah Workflow</h2>

<p>Instead of juggling separate notebooks for visas, hotels, and cash, organize every Umrah group through five connected digital steps.</p>

<h3>Stage 1: Accurate SAR-to-PKR Costing Before Quoting</h3>

<p>Profitability starts before the client pays a single rupee of advance. Always calculate per-person costs across adult, child, and infant categories using current SAR rates plus a small currency cushion. Our dedicated guide on <a href="/blogs/umrah-cost-calculator-price-packages-profitably">using an Umrah cost calculator profitably</a> walks through real Makkah and Madinah room-sharing math. Inside TAMS Pro, simply open <strong>Umrah Calculator</strong> from your sidebar, enter today''s SAR-to-PKR rate, select your Makkah and Madinah hotels, nights, and room sharing (Quad, Triple, Double, or Quint), add visa, transport, ziyarat, and flight costs plus your profit margin, and convert the result straight into a branded quotation so your counter staff never underprices a group departure.</p>

<h3>Stage 2: Fast, Branded Quotations</h3>

<p>Clients rarely confirm on the first phone call. Send a clean quotation outlining 7 nights Makkah, 7 nights Madinah, airline schedule, visa inclusion, and per-person PKR pricing based on sharing type. Agencies using digital quotation templates respond in under two minutes while competitors are still typing manual WhatsApp lists—dramatically boosting conversion rates.</p>

<h3>Stage 3: Multi-Passenger Family &amp; Group Booking</h3>

<p>Once the family pays a booking advance (say PKR 150,000 per passenger), convert the quote into a formal booking invoice. Store all family members—full passport names, passport numbers, expiry dates, and relation notes—under one booking reference. Record both your Saudi hotel/ground supplier payable and your client''s total package price in PKR so expected net profit is visible right away.</p>

<h3>Stage 4: One-Click Umrah Hotel &amp; Service Vouchers</h3>

<p>Pilgrims and group leaders need clear travel documents before leaving for the airport. Instead of manually editing a Word document and risking typo-ridden hotel dates, generate standardized PDF Umrah vouchers directly from the booking record. Ensure every voucher clearly shows:</p>

<ul>
  <li>Lead pilgrim and total pax count (Adults / Children / Infants)</li>
  <li>Makkah and Madinah hotel names, room type, and exact Hijri/Gregorian check-in dates</li>
  <li>Transport provider contact and pickup route</li>
  <li>Emergency agency helpline and Saudi representative number</li>
</ul>

<p>Learn how standardized documents protect your brand in our guide on <a href="/blogs/invoice-voucher-software-travel-agents">invoice and voucher software for travel agents</a>.</p>

<h3>Stage 5: Installment Collections &amp; Saudi Vendor Reconciliation</h3>

<p>Pakistani families commonly pay in two or three installments before departure. Every cash receipt or bank transfer into your agency account should immediately reduce the client''s pending balance and generate a shareable receipt. At the same time, track what you owe your Makkah hotel supplier or Umrah company so no group closes with surprise supplier balances weeks later.</p>

<blockquote><p><strong>Run your next Umrah group stress-free:</strong> Explore TAMS Pro''s Umrah Calculator, vouchers, and party ledgers on our <a href="/features">Features page</a>, or <a href="/pricing">pick a plan at PKR 1,999/month (or PKR 9,999/year — 50% off on the yearly plan)</a>. <a href="/signup">Start your free trial now</a>.</p></blockquote>

<h2>Managing Ramadan, Shawwal &amp; Group Ticket Departures</h2>

<p>Peak Umrah months test your follow-up discipline. Imagine coordinating a 38-passenger Ramadan Ashra departure out of Allama Iqbal International Airport in Lahore alongside two smaller families departing from Islamabad. Half the group asks for triple sharing near Haram, six passengers book through a Gujranwala sub-agent, and three elders need wheelchair assistance noted on their airline records.</p>

<p>Trying to verify those details across three separate notebooks guarantees chaos on departure day. Digital reminders and unified search give small teams the speed and accuracy of a 15-person operation:</p>

<ul>
  <li><strong>Pre-departure balance alerts:</strong> Flag unpaid balances 7 days before flight departure so nobody boards a plane with PKR 90,000 still uncollected or a sub-agent deposit still pending bank clearance.</li>
  <li><strong>Passport expiry warnings:</strong> Spot passports with less than 6 months validity during initial intake before visa submission stalls the rest of a family batch.</li>
  <li><strong>Rooming &amp; transport consistency:</strong> Match Makkah and Madinah room allocations directly against booked invoice quantities so your Saudi ground operator receives exact counts without last-minute phone corrections.</li>
  <li><strong>Instant client history:</strong> When a returning pilgrim from Rawalpindi calls six months later for another family trip, pull up their past booking, passport details, and hotel preferences in two seconds.</li>
</ul>

<p>For a broader look at streamlining your back-office numbers and supplier settlements, check our <a href="/blogs/travel-agency-accounting-ledger-pakistan">travel agency accounting and ledger guide</a> and review our <a href="/blogs/create-travel-quotations-in-2-minutes">2-minute travel quotation workflow</a>.</p>

<h2>Weekly 15-Minute Umrah Operations Review</h2>

<p>Even with the best software, seasoned Pakistani operators run a brief Wednesday review before weekend walk-ins arrive. Open your active departures list, confirm every upcoming group has confirmed hotel vouchers generated, verify Saudi supplier payouts match your payment vouchers, and check that overdue family installments receive a polite WhatsApp reminder with an updated PDF statement.</p>

<h2>Start Digitizing Your Umrah Operations Today</h2>

<p>You do not need to migrate five years of old files to get started. Enter your active upcoming Umrah groups into TAMS Pro this week, issue your next five vouchers digitally, and watch how quickly phone confusion disappears across your desk. Compare plans on <a href="/pricing">TAMS Pro Pricing</a> and <a href="/signup">create your agency account</a> today.</p>

<h2>Frequently Asked Questions</h2>

<h3>How can Pakistani travel agents manage Umrah packages digitally?</h3>
<p>Agents can use TAMS Pro to handle SAR-to-PKR package costing, store pilgrim passport details, track installment payments, and issue branded hotel and transport vouchers from one cloud workspace.</p>

<h3>Can I generate custom Umrah hotel and transport vouchers in minutes?</h3>
<p>Yes. TAMS Pro turns saved Umrah booking details directly into clean, branded PDF vouchers ready to download or send via WhatsApp—saving hours of manual Word editing.</p>

<h3>How do I calculate Umrah package profit accurately in PKR?</h3>
<p>Open the Umrah Calculator inside TAMS Pro from your sidebar, enter the current SAR-to-PKR rate, add Makkah and Madinah hotel nights by room sharing alongside flight, visa, and transport costs, and set your target per-passenger margin before quoting clients.</p>

<h3>Can sub-agents or group leaders manage installments separately?</h3>
<p>Yes. Every sub-agent or family group gets a dedicated party ledger tracking package charges, partial cash or bank receipts, and remaining receivables before travel.</p>',
  tags = ARRAY['umrah package management software', 'umrah package software Pakistan', 'umrah voucher software', 'umrah ka hisab kitab', 'travel agency software Pakistan', 'umrah group management', 'umrah calculator Pakistan']::TEXT[],
  secondary_keywords = ARRAY['umrah package software Pakistan', 'umrah voucher software', 'umrah ka hisab kitab software']::TEXT[],
  seo_description = 'Learn how Pakistani travel agents manage Umrah packages digitally from SAR costing, hotel vouchers, and group bookings to PKR ledgers easily with TAMS Pro.',
  read_time_minutes = 7,
  faq_items = '[{"question":"How can Pakistani travel agents manage Umrah packages digitally?","answer":"Agents can replace paper files by using cloud software like TAMS Pro to calculate SAR-to-PKR costs, store pilgrim passport data, issue branded Makkah/Madinah hotel vouchers, and track installment payments in one place."},{"question":"Can I generate custom Umrah hotel and transport vouchers in minutes?","answer":"Yes. Once an Umrah booking is saved in TAMS Pro, you can generate branded PDF Umrah vouchers showing check-in/out dates, hotel names, room sharing, and transport legs ready for WhatsApp sharing."},{"question":"How do I calculate Umrah package profit accurately in PKR?","answer":"Open the Umrah Calculator inside TAMS Pro, enter the live SAR-to-PKR exchange rate, set Makkah and Madinah nights and room sharing (Quad, Triple, or Double), add visa, flights, transport, and contingency margins, and generate an instant PKR breakdown."},{"question":"Can sub-agents or group leaders manage installments separately?","answer":"Yes. Each family head or B2B partner gets an individual ledger account showing total package price, cash or bank installments received, and remaining balance due before departure."}]'::jsonb,
  updated_at = now()
WHERE slug = 'manage-umrah-packages-digitally-pakistan';

UPDATE public.blog_posts
SET
  excerpt = 'Stop losing PKR to paper khatas and broken Excel sheets. Learn how automated travel agency accounting and ledger software protects cash flow and profit.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>High monthly cash turnover hides thin travel margins: a PKR 40 lakh ticket sales month might only yield PKR 2.4 lakh in true profit—one uncollected PKR 65,000 ticket wipes out a week of hard work.</li><li>Paper khatas and disconnected Excel tabs create reconciliation gaps between booking desks, cash drawers, and supplier statements.</li><li>Automated double-entry travel ledgers connect bookings, payment vouchers, expenses, refunds, and cash/bank balances in real time.</li><li>TAMS Pro turns complex travel agency accounting into simple daily receipts and instant WhatsApp-ready statements for PKR 1,999/month (or PKR 9,999/year with 50% off yearly).</li></ul></blockquote>

<p>Ask any travel agency owner in Karachi, Lahore, or Islamabad what keeps them up at night and the answer is rarely finding customers—it is knowing where the money actually went. A travel agency handles huge gross cash flows on slim commissions. You might collect PKR 380,000 for four Jeddah return tickets where PKR 356,000 belongs to the consolidator and only PKR 24,000 is your true agency income.</p>

<p>When your team records bookings in one register, cash collections in another drawer notebook, and supplier transfers inside mobile banking apps, your numbers drift apart fast. Adopting dedicated <strong>travel agency accounting and ledger software</strong> eliminates guesswork and protects every rupee of hard-earned commission.</p>

<h2>The 4 Financial Leaks Hidden in Registers and Spreadsheets</h2>

<p>Before fixing your numbers, look closely at how Pakistani agencies silently lose cash every quarter:</p>

<ul>
  <li><strong>Forgotten partial balances:</strong> A known client pays PKR 120,000 cash against a PKR 145,000 ticket, promising the remaining PKR 25,000 next Tuesday. Without automated overdue aging, Tuesday comes and goes—and nobody notices until year-end.</li>
  <li><strong>Unreconciled void and refund deductions:</strong> Airlines deduct cancellation penalties or delay GDS refunds by weeks. If staff forget to debit the client or credit the vendor correctly, your cash box looks healthy while supplier payables quietly build up.</li>
  <li><strong>Mixing gross revenue with true profit:</strong> Seeing PKR 1,500,000 in the bank feels comforting until you realize PKR 1,380,000 of it is owed to two IATA consolidators and a Saudi hotel partner on Friday morning.</li>
  <li><strong>Unrecorded office expenses:</strong> Courier charges, tea/hospitality, electricity bills, staff advances, and marketing spends paid straight out of the cash drawer distort daily closing cash.</li>
</ul>

<p>To prevent these issues operationally too, review our checklist on <a href="/blogs/7-mistakes-pakistani-travel-agencies-bookings">7 booking and client record mistakes Pakistani agencies make</a>.</p>

<h2>How Automated Travel Agency Accounting Works</h2>

<p>A purpose-built system removes manual double-entry. Your staff simply enter normal business transactions—booking a ticket, receiving cash, paying a supplier, logging rent—and the accounting engine updates every balance atomically behind the scenes.</p>

<h3>1. Booking-to-Ledger Synchronization</h3>

<p>When an agent saves an invoice for Client Ali Raza at a selling price of PKR 162,000 and vendor purchase cost of PKR 151,000:</p>

<ul>
  <li>Ali Raza''s client ledger increases by <strong>PKR 162,000 (Receivable)</strong></li>
  <li>Your airline supplier''s ledger increases by <strong>PKR 151,000 (Payable)</strong></li>
  <li>Your agency profit report logs <strong>PKR 11,000 gross margin</strong></li>
</ul>

<p>If Ali pays PKR 100,000 via bank transfer at booking time, his pending balance automatically settles at PKR 62,000—zero manual calculator math required.</p>

<h3>2. Unified Payment Vouchers for Clients and Vendors</h3>

<p>Whenever cash enters or leaves your agency, a clean payment voucher links that money to both the party (client or supplier) and the exact account (Cash-in-Hand, HBL Current, Meezan Business, or JazzCash). Receiving a payment immediately lowers client dues and boosts your selected bank balance. Paying a consolidator lowers vendor payables and deducts from your bank balance.</p>

<h3>3. Multi-Account Cash &amp; Bank Books + Transfers</h3>

<p>Pakistani agencies routinely deposit drawer cash into bank accounts or shift funds between business banks before paying airline portals. Recording cash-to-bank transfers keeps both Cash-in-Hand and bank totals accurate down to the last rupee, making daily evening closing take 60 seconds instead of an hour.</p>

<h3>4. Branded Date-Range Party Statements</h3>

<p>Nothing builds trust with corporate clients and sub-agents faster than clean documentation. When a regular B2B partner in Gujranwala asks for this month''s reconciliation, you select a From and To date, click export, and send a chronological statement displaying Opening/Brought-Forward balance, every booking and receipt with DR/CR columns, and the exact Closing Balance.</p>

<blockquote><p><strong>Stop guessing your cash flow:</strong> See how unified party ledgers, cash/bank accounts, and profit reports work together on our <a href="/features">Features page</a>, or <a href="/signup">start your TAMS Pro trial</a> at <a href="/pricing">PKR 1,999/month (or PKR 9,999/year — 50% off yearly)</a>.</p></blockquote>

<h2>Managing Audited Edits and Preventing Fraud</h2>

<p>Even honest staff make typos—entering PKR 85,000 instead of PKR 58,000 on a voucher or choosing the wrong bank account. Worse, poorly controlled spreadsheets allow silent backdated edits without anyone knowing what changed. Modern accounting software enforces strict edit tracking: modifying a saved amount requires an edit reason, recalculates affected ledger balances cleanly, and records the adjustment in an immutable audit log visible to management.</p>

<p>If you are still comparing spreadsheets against dedicated tools, our detailed comparison on <a href="/blogs/excel-vs-travel-agency-software-pakistan">Excel vs travel agency software</a> breaks down the exact error and time cost for a 3-person office.</p>

<h2>Weekly 10-Minute Financial Routine for Agency Owners</h2>

<p>Once your accounting is automated, staying on top of your business takes one simple weekly habit every Saturday afternoon:</p>

<ol>
  <li>Compare physical drawer cash and live HBL, Meezan, or JazzCash balances against your software''s Cash &amp; Bank summary down to the last rupee.</li>
  <li>Review the Top Overdue Client Receivables list and send polite payment reminders via WhatsApp or email with an attached PDF statement.</li>
  <li>Check Vendor Payables aging so Monday airline portal top-ups and Saudi hotel deposits never catch your cash flow off guard.</li>
  <li>Inspect Monthly Net Profit after subtracting office rent, staff salaries, internet, and utility expenses—seeing true bottom-line earnings rather than misleading gross sales volume.</li>
</ol>

<h3>Real-World Example: Closing a Busy Week Without Overtime</h3>

<p>Take a busy Saturday at a mid-sized office in Gulberg, Lahore. Between 10:00 AM and 6:00 PM, your two counter staff issue seven international tickets totaling PKR 1,420,000, collect PKR 680,000 across cash and bank transfers, pay PKR 510,000 to an IATA consolidator, and log PKR 14,500 in courier and utility bills. On paper registers, reconciling that single day easily eats 90 minutes past closing time. In TAMS Pro, every cash receipt, bank transfer, supplier payout, and expense updates automatically—letting you verify closing drawer cash and bank balances in under two minutes before heading home.</p>

<p>Pair clean accounting with streamlined package sales by reading our <a href="/blogs/manage-umrah-packages-digitally-pakistan">complete guide to digital Umrah package management</a>.</p>

<h2>Take Control of Your Agency Khata Today</h2>

<p>Every week spent on paper notebooks costs your agency forgotten dues and stressful late-night reconciliations. Move your opening balances and active bookings into TAMS Pro today—plans are <a href="/pricing">PKR 1,999/month, or PKR 9,999/year with 50% off exclusively on the yearly plan</a>. <a href="/signup">Sign up free now</a> and check your real profit in minutes.</p>

<h2>Frequently Asked Questions</h2>

<h3>Why is general accounting software not ideal for travel agencies?</h3>
<p>General trading tools assume inventory stock rather than pass-through travel bookings. Travel software automatically tracks both client receivables and airline/vendor payables from a single invoice while computing net ticket margin accurately.</p>

<h3>How does a dual-sided travel ledger prevent revenue leakage?</h3>
<p>Every booking updates the client''s pending due and the supplier''s payable together, ensuring partial cash receipts, installment schedules, and supplier payouts stay 100% synchronized.</p>

<h3>Can TAMS Pro track multiple bank accounts and cash-in-hand separately?</h3>
<p>Yes. You can configure Cash-in-Hand plus multiple Pakistani bank or wallet accounts, record receipts, supplier payments, and transfers, and inspect balances anytime.</p>

<h3>How are refunds and ticket voids handled in the ledger?</h3>
<p>Refunds and voids adjust client and supplier balances transparently while preserving invoice history and audit trails, keeping your receivables and profit figures accurate.</p>

<h3>How much does travel agency accounting software cost in Pakistan?</h3>
<p>TAMS Pro includes complete client/vendor ledgers, cash and bank books, expense tracking, and financial reports at PKR 1,999/month, or PKR 9,999/year (50% off on the yearly plan).</p>',
  tags = ARRAY['travel agency accounting ledger', 'travel agent ledger Pakistan', 'travel agency khata software', 'travel agency accounts', 'client vendor ledger', 'cash bank book Pakistan', 'travel agency software Pakistan']::TEXT[],
  secondary_keywords = ARRAY['travel agent ledger software Pakistan', 'travel agency khata software', 'travel agency cash bank accounting']::TEXT[],
  seo_description = 'Stop losing PKR to paper khatas and broken Excel sheets. Learn how automated travel agency accounting and ledger software protects cash flow and profit.',
  read_time_minutes = 7,
  faq_items = '[{"question":"Why is general accounting software not ideal for travel agencies?","answer":"General trading software tracks inventory units, whereas travel agencies sell pass-through tickets, visas, and packages where only the markup is profit and each booking creates both a client receivable and a vendor payable."},{"question":"How does a dual-sided travel ledger prevent revenue leakage?","answer":"Every booking automatically posts selling price to the client ledger and purchase cost to the airline or supplier ledger, making unpaid balances, void adjustments, and exact net profit visible immediately."},{"question":"Can TAMS Pro track multiple bank accounts and cash-in-hand separately?","answer":"Yes. You can add unlimited agency bank accounts alongside Cash-in-Hand, record receipts, supplier payments, inter-account transfers, and generate date-filtered statements anytime."},{"question":"How are refunds and ticket voids handled in the ledger?","answer":"Proper travel accounting adjusts both client credit and supplier refund expectations with an audit trail so your cash and profit reports stay balanced without manual deletions."},{"question":"How much does travel agency accounting software cost in Pakistan?","answer":"TAMS Pro includes complete client, vendor, cash/bank, expense, and profit-loss reporting at PKR 1,999/month, or PKR 9,999/year (50% off exclusively on the yearly plan)."}]'::jsonb,
  updated_at = now()
WHERE slug = 'travel-agency-accounting-ledger-pakistan';

UPDATE public.blog_posts
SET
  excerpt = 'Win more ticket and Umrah clients in Pakistan by sending branded PDF travel quotations in 2 minutes and converting approved quotes to invoices in one click.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Pakistani travelers routinely message three agencies at once; the first agency to send a clear, trustworthy quote usually wins the advance payment.</li><li>Manual Word documents or messy copy-pasted WhatsApp text make high-value tickets and Umrah packages look unprofessional and invite disputes over inclusions.</li><li>A digital query-to-quote pipeline cuts quote creation time from 20 minutes to under 2 minutes and converts approved deals into invoices in one click.</li><li>TAMS Pro standardizes your quotes, branding, and follow-up pipeline at PKR 1,999/month (or PKR 9,999/year with 50% off yearly).</li></ul></blockquote>

<p>Picture a familiar Tuesday afternoon at any travel agency in Islamabad, Lahore, or Karachi. A prospective client messages on WhatsApp asking for three economy tickets from Lahore to London in December plus hotel options for two nights in Istanbul. Your senior ticketing agent checks fares, writes down numbers on scrap paper, opens an old Microsoft Word file, edits dates, forgets to change the validity line at the bottom, and finally exports a misaligned PDF twenty-five minutes later.</p>

<p>By the time that PDF lands in the client''s chat, another agency using modern <strong>travel quotation software in Pakistan</strong> has already sent a crisp, clean comparison ten minutes earlier—and collected the booking deposit. Speed and presentation close travel deals just as much as price.</p>

<h2>Why Messy WhatsApp Text Quotes Lose High-Margin Clients</h2>

<p>Many agents still type raw fares directly into WhatsApp like: <em>"PIA 185k Emirates 240k non refundable baggage 30kg."</em> While fast to type, text-only quotes hurt your business in three expensive ways:</p>

<ul>
  <li><strong>Zero perceived authority:</strong> When a corporate traveler or overseas family is about to transfer PKR 600,000 to your bank account, a sloppy text message triggers hesitation. Branded documentation signals reliability.</li>
  <li><strong>Costly disputes later:</strong> Did that PKR 240,000 fare include 23kg or 30kg baggage? Was airport transfer included in the Dubai package? When inclusions live inside a structured PDF quote, both sides stay aligned.</li>
  <li><strong>Lost follow-up pipeline:</strong> WhatsApp chats bury yesterday''s inquiries under fifty new messages. Without a dedicated query and quotation register, profitable warm leads slip away uncontacted.</li>
</ul>

<h2>Anatomy of a High-Converting Travel Quotation</h2>

<p>Whether you are quoting a family Umrah trip, a Baku holiday, or a return business-class ticket, keep your quotation scannable on mobile screens (where 85% of Pakistani clients read PDFs):</p>

<ul>
  <li><strong>Clear agency header:</strong> Your agency name, logo, phone, WhatsApp, and branch address cleanly displayed at the top.</li>
  <li><strong>Client &amp; trip summary:</strong> Client name, destination, travel dates, and passenger breakdown (Adults, Children, Infants).</li>
  <li><strong>Itemized options:</strong> Present Option A (Economy / 3-Star) and Option B (Direct / 4-Star) side by side with exact PKR totals.</li>
  <li><strong>Inclusions &amp; exclusions:</strong> Explicitly state visa, baggage allowance, breakfast, and transport so zero surprises arise after ticketing.</li>
  <li><strong>Fare validity warning:</strong> Airlines and hotels shift inventory hourly—clearly mark "Valid for 24 hours subject to seat availability" to encourage fast confirmation.</li>
</ul>

<h2>The 2-Minute Digital Query-to-Quote Workflow</h2>

<p>Inside a connected agency platform like TAMS Pro, creating and winning a quote follows three fast steps:</p>

<h3>Step 1: Log the Incoming Query Once</h3>

<p>When a lead arrives via phone, walk-in, or WhatsApp, capture the client''s name, phone number, destination, preferred dates, and budget in the Queries screen. Even if they do not confirm today, your database now tracks their inquiry and reminder date.</p>

<h3>Step 2: Generate a Branded PDF Quotation in Under 2 Minutes</h3>

<p>Select the query, add your fare or package line items—or price Umrah tiers directly inside TAMS Pro by opening <strong>Umrah Calculator</strong> in your sidebar, entering the SAR-to-PKR rate, setting Makkah and Madinah hotel nights and room sharing (Quad, Triple, or Double), and adding visa, transport, and flight costs—set your margin, and download a formatted PDF stamped with your agency branding. Send it straight to WhatsApp with a clear payment call to action.</p>

<h3>Step 3: One-Click Conversion to Booking Invoice</h3>

<p>The best part happens when the client replies "Book Option A." Instead of opening a separate billing sheet and re-entering names, dates, and PKR totals, click convert. Your accepted quotation turns straight into an official booking invoice, updating client receivables and supplier payables automatically.</p>

<blockquote><p><strong>Turn more inquiries into paid bookings:</strong> Check out Queries, Quotations, and Branded PDFs on our <a href="/features">Features page</a>, or <a href="/signup">create your TAMS Pro account</a> today for <a href="/pricing">PKR 1,999/month (or PKR 9,999/year — 50% off yearly)</a>.</p></blockquote>

<h2>3 Follow-Up Habits That Double Quote Conversion</h2>

<p>Even the cleanest PDF loses value if nobody follows up. Train your counter team on these three habits:</p>

<ol>
  <li><strong>Follow up at the 4-hour mark:</strong> A polite message—<em>"Assalam-o-Alaikum, fares on the Saudia sector are moving fast today; let me know if you''d like us to hold seats before tonight"</em>—recovers undecided buyers without sounding pushy.</li>
  <li><strong>Offer two structured choices:</strong> Instead of sending a single price that forces a yes/no decision, quote one value option and one comfort upgrade. Clients frequently choose the middle or premium tier when benefits are laid out clearly.</li>
  <li><strong>Track win/loss reasons weekly:</strong> Review open quotes every Thursday to spot whether your agency is losing on price, slow replies, or flight timings.</li>
</ol>

<h3>Real Scenario: Quoting a 5-Person Lahore-to-Dubai &amp; Umrah Inquiry</h3>

<p>Imagine an overseas buyer messaging from Birmingham asking for a family Umrah stopover from Lahore for five relatives. Using manual Word templates, pulling flight timings, checking two hotel star levels, calculating Quad vs. Triple room rates, and exporting clean pages eats half an hour—and any last-minute date tweak forces another round of tedious editing. With TAMS Pro''s structured quotation workflow, you pick the client query, enter Option A (Economy 3-star, PKR 292,000 per person) and Option B (Near-Haram 4-star, PKR 358,000 per person), specify 30kg baggage and transport inclusions, and send a mobile-readable PDF straight to WhatsApp while the family is still actively discussing plans together.</p>

<p>When they approve Option B two hours later, converting that single quote into a live booking invoice takes one click—keeping your sales pipeline, passenger passports, and PKR ledger 100% aligned.</p>

<h3>WhatsApp Delivery Tips That Lift Reply Rates</h3>

<p>How you send the quotation matters nearly as much as the PDF inside it. Pair every attached PDF quote with a short three-line summary right in WhatsApp: greet the client by name, mention the headline PKR rate for Option A and Option B, and remind them how long seat fares hold before supplier repricing. Busy buyers in Karachi or Dubai can scan your message in five seconds while opening the attached PDF for full hotel and baggage proof.</p>

<p>If an inquiry does not reply by the next afternoon, schedule a brief status note inside your agency pipeline instead of relying on memory. Over a single month, rescuing just four or five hesitant family inquiries adds tens of thousands in extra agency profit without spending another rupee on ads.</p>

<p>Once a quote converts, make sure your billing and travel papers stay just as sharp by reading our guide on <a href="/blogs/invoice-voucher-software-travel-agents">invoice and voucher software for travel agents</a> and ensuring your balances sync cleanly with <a href="/blogs/travel-agency-accounting-ledger-pakistan">automated travel agency accounting</a>.</p>

<h2>Upgrade How Your Agency Quotes Today</h2>

<p>Your competitors are one WhatsApp message away. Give your clients a polished, 2-minute quotation experience that earns trust before they ever step into your office. View our <a href="/pricing">PKR 1,999/month and PKR 9,999/year (50% off yearly) plans</a> or <a href="/signup">sign up free on TAMS Pro</a> to send your first branded quotation today.</p>

<h2>Frequently Asked Questions</h2>

<h3>How fast should a travel agency send a quotation to win the client?</h3>
<p>Aim to send a clean PDF quotation within 5 to 15 minutes of receiving an inquiry. Fast, organized replies win trust before competitors finish manual spreadsheets.</p>

<h3>What should a professional travel quotation include?</h3>
<p>Include agency branding, passenger count, exact travel dates, flight or hotel details, baggage or meal inclusions, total PKR cost, and a clear fare validity notice.</p>

<h3>Can I convert an accepted quotation directly into a booking invoice?</h3>
<p>Yes. TAMS Pro lets you convert approved client quotations straight into live booking invoices without retyping passenger names or pricing figures.</p>

<h3>Is sending a PDF quotation better than typing a WhatsApp text message?</h3>
<p>Yes. Branded PDFs look far more trustworthy for large PKR transactions and protect your agency against misunderstandings regarding baggage limits, room types, or refund rules.</p>',
  tags = ARRAY['travel quotation software Pakistan', 'travel quote template', 'travel agency software Pakistan', 'umrah quotation format', 'whatsapp travel quote', 'convert quote to invoice', 'travel sales leads Pakistan']::TEXT[],
  secondary_keywords = ARRAY['how to make travel quotation', 'travel agency quote template', 'convert travel quote to booking']::TEXT[],
  seo_description = 'Win more ticket and Umrah clients in Pakistan by sending branded PDF travel quotations in 2 minutes and converting approved quotes to invoices in one click.',
  read_time_minutes = 7,
  faq_items = '[{"question":"How fast should a travel agency send a quotation to win the client?","answer":"Sending a clear, branded quotation within 5 to 15 minutes dramatically improves conversion because Pakistani travelers typically ask two or three agencies on WhatsApp at the same time."},{"question":"What should a professional travel quotation include?","answer":"A winning travel quotation lists passenger count, travel dates, flight or hotel breakdown, baggage or room-sharing inclusions, total PKR price, validity expiry date, and your agency contact details."},{"question":"Can I convert an accepted quotation directly into a booking invoice?","answer":"Yes. In TAMS Pro, approved client queries and quotations convert directly into formal booking invoices without retyping passenger or pricing details."},{"question":"Is sending a PDF quotation better than typing a WhatsApp text message?","answer":"Yes. Branded PDF quotes look trustworthy, prevent misunderstandings about baggage or meal inclusions, and make families more comfortable transferring advance payments."}]'::jsonb,
  updated_at = now()
WHERE slug = 'create-travel-quotations-in-2-minutes';

UPDATE public.blog_posts
SET
  excerpt = 'Stop issuing handwritten receipts and messy Word files. Learn how invoice and voucher software helps Pakistani travel agents look credible and avoid disputes.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Handwritten carbon-copy bill books and manually edited Word templates waste hours every week and make established agencies look small.</li><li>Mistyped check-in dates, duplicate invoice numbers, or unclear payment statuses on paper receipts lead directly to costly airport and hotel disputes.</li><li>Dedicated invoice and voucher software auto-generates unique sequential numbers, custom agency branding, and real-time Paid/Due balances.</li><li>TAMS Pro unifies booking invoices, payment vouchers, and Umrah/hotel vouchers at PKR 1,999/month (or PKR 9,999/year with 50% off yearly).</li></ul></blockquote>

<p>Walk into a neighborhood travel office almost anywhere in Rawalpindi, Jhelum, or Multan and you will often still spot a tear-off paper bill book sitting next to an old desktop monitor. When a client hands over PKR 250,000 for two airline tickets or an Umrah package, the agent scribbles names on carbon paper, tears out a faint pink slip, and snaps a crooked phone photo for WhatsApp.</p>

<p>Meanwhile, corporate clients, overseas families sending money from the UK or Saudi Arabia, and younger travelers expect crisp digital records. Relying on paper bill books and manually edited Word documents is not "saving money"—it is quietly costing you repeat business and hours of administrative rework. Using dedicated <strong>invoice and voucher software for travel agents</strong> solves both credibility and accuracy in one step.</p>

<h2>The Real Cost of Paper Bill Books and Word Templates</h2>

<p>Paper receipts and static Word files create four daily headaches that grow worse as your booking volume increases:</p>

<ul>
  <li><strong>Duplicate or missing serial numbers:</strong> When three staff use different bill pads or save Word files as <code>Invoice_Final_v3.docx</code>, tracking sequential invoice numbers becomes impossible.</li>
  <li><strong>Copy-paste date errors on vouchers:</strong> Copying last week''s Makkah hotel voucher in MS Word and forgetting to update the check-out date or passenger name leads to frantic midnight phone calls from Jeddah.</li>
  <li><strong>Zero automatic balance sync:</strong> Issuing a paper receipt does not update your cash drawer, bank ledger, or client receivable balance unless someone manually posts it into an account book later that evening.</li>
  <li><strong>Weak brand authority:</strong> Blurry ink scans hurt trust when you pitch corporate travel accounts or high-value holiday families.</li>
</ul>

<h2>Three Essential Travel Documents Every Agency Must Automate</h2>

<p>A modern Pakistani agency operates smoothly when three core document types stay connected under one roof.</p>

<h3>1. Branded Booking Invoices</h3>

<p>Your booking invoice is the legal financial record of a client''s purchase. Whether billing a single domestic ticket, an international return itinerary, a visit visa, or a family Umrah package, your invoice should automatically show:</p>

<ul>
  <li>Unique sequential invoice number (e.g., <code>INV-2026-0142</code>)</li>
  <li>Agency logo, NTN/license details, and contact numbers</li>
  <li>Full passenger list, PNR/ticket references, destination, and travel dates</li>
  <li>Total selling amount, amount paid so far, and remaining PKR balance due</li>
</ul>

<h3>2. Client &amp; Vendor Payment Vouchers</h3>

<p>Payments happen in installments across cash, bank transfers, and mobile wallets. Every time a customer deposits PKR 50,000 into your HBL account or you transfer PKR 420,000 to an airline vendor, issuing a digital payment voucher records the exact date, payment mode, linked invoice, and updated balance—preventing any argument over whether an installment was received.</p>

<h3>3. Travel, Hotel &amp; Umrah Vouchers</h3>

<p>Beyond billing, travelers need operational confirmation vouchers for check-in counters and hotel receptions. Digital voucher templates pull passenger names, room sharing, hotel addresses, and check-in/out dates directly from your booking record so typos never sneak in. See how this plugs into end-to-end group operations in our guide on <a href="/blogs/manage-umrah-packages-digitally-pakistan">managing Umrah packages digitally</a>.</p>

<blockquote><p><strong>Deliver agency documents clients trust:</strong> Preview TAMS Pro''s Invoice &amp; Voucher Designer on our <a href="/features">Features page</a>, or <a href="/signup">start using branded PDFs today</a> at <a href="/pricing">PKR 1,999/month (or PKR 9,999/year — 50% off yearly)</a>.</p></blockquote>

<h2>How Automated Invoicing Syncs With Your Ledger</h2>

<p>The biggest productivity leap happens when documents and accounting become one single action. In TAMS Pro, saving a booking invoice or payment voucher automatically updates:</p>

<ol>
  <li><strong>Client Ledger Statement:</strong> Instantly reflects total invoiced, paid, and remaining PKR receivable.</li>
  <li><strong>Vendor Payable Ledger:</strong> Logs supplier cost so you know exactly how much is owed to each consolidator or Saudi partner.</li>
  <li><strong>Cash &amp; Bank Balances:</strong> Updates Cash-in-Hand or your selected bank account immediately upon voucher entry.</li>
  <li><strong>Email &amp; WhatsApp Sharing:</strong> Lets staff download the PDF or email the invoice to clients in one click without switching apps.</li>
</ol>

<h3>What to Include on Every Travel Agency Invoice in Pakistan</h3>

<p>Whether you serve walk-in families in Faisalabad or corporate travelers in Clifton, Karachi, standardizing your invoice layout prevents billing confusion and strengthens DTS/audit readiness:</p>

<ul>
  <li><strong>Clear payment status stamp:</strong> Visually highlight whether the invoice is Paid, Partial, or Unpaid so clients never mistake a quotation for a cleared receipt.</li>
  <li><strong>Itemized passenger &amp; sector rows:</strong> List exact passenger names matching passports, airline sectors or hotel check-in dates, and PNR/ticket numbers.</li>
  <li><strong>Cancellation &amp; refund terms footer:</strong> Add concise agency terms stating airline non-refundable fare rules, change penalties, and currency lock conditions so disputes never catch you unprotected.</li>
  <li><strong>Consistent sequential numbering:</strong> Automated prefixes (like <code>INV-</code> and <code>PV-</code>) keep tax filings, internal audits, and partner reconciliations clean year-round.</li>
</ul>

<h3>Customizing Templates for Umrah, Tickets &amp; Corporate Accounts</h3>

<p>Not every agency likes identical layouts. A corporate ticketing desk in Blue Area, Islamabad might prefer compact financial tables with NTN and bank IBAN details prominently displayed, while an Umrah specialist in Gujranwala wants Makkah and Madinah hotel details, room type, and emergency Saudi contact numbers highlighted on the voucher. TAMS Pro''s built-in Invoice and Booking Template Designers let you configure these preferences once—so every junior staff member produces consistent, senior-level paperwork automatically.</p>

<h3>Handling Partial Payments &amp; Audited Corrections Cleanly</h3>

<p>Clients rarely settle an entire PKR 450,000 family package in one transaction. One family pays PKR 150,000 cash upon confirmation, sends PKR 200,000 via bank transfer ten days later, and pays the remaining PKR 100,000 before collecting boarding passes. Digital invoices show each receipt against the exact invoice total so neither the client nor your accountant ever questions what remains payable. And if a ticket sector changes or a fare is adjusted later, audited edits preserve a clean paper trail rather than messy crossed-out ink on carbon paper.</p>

<p>Explore how this eliminates manual reconciliation errors in our <a href="/blogs/travel-agency-accounting-ledger-pakistan">travel agency accounting and ledger guide</a>, learn how to turn incoming inquiries straight into invoices in <a href="/blogs/create-travel-quotations-in-2-minutes">our 2-minute travel quotation workflow</a>, or compare <a href="/blogs/excel-vs-travel-agency-software-pakistan">Excel vs travel agency software</a>.</p>

<h2>Look Like a Top-Tier Agency on Every Transaction</h2>

<p>You do not need a design agency or expensive ERP system to hand clients polished, error-free documents. Customize your template once inside TAMS Pro and let every booking, receipt, and Umrah voucher carry your brand cleanly. Check <a href="/pricing">TAMS Pro Pricing (PKR 1,999/month, or PKR 9,999/year with 50% off on the yearly plan)</a> and <a href="/signup">sign up free</a> to issue your first branded PDF today.</p>

<h2>Frequently Asked Questions</h2>

<h3>What is the difference between a booking invoice and a payment voucher?</h3>
<p>A booking invoice records the sale of tickets, visas, or packages to a client and shows total charges. A payment voucher records cash or bank money received from a client or paid out to a supplier.</p>

<h3>Can travel agents customize invoices and vouchers with their own logo?</h3>
<p>Yes. TAMS Pro includes branding and template designer settings so your agency logo, footer notes, phone number, and color accents appear automatically on every PDF.</p>

<h3>Why do handwritten carbon-copy receipt books hurt travel agencies?</h3>
<p>Paper receipt books are slow, hard to search later, disconnected from cash/bank accounts, and look informal when photographed and sent to corporate or overseas clients.</p>

<h3>Can I email or WhatsApp PDF vouchers directly to travelers?</h3>
<p>Yes. Every invoice, payment receipt, and Umrah voucher exports as a lightweight PDF ready to share on WhatsApp or email directly from TAMS Pro.</p>',
  tags = ARRAY['invoice and voucher software', 'travel agency invoice Pakistan', 'umrah voucher generator', 'payment voucher software', 'travel receipt PDF', 'travel agency software Pakistan', 'branded travel documents']::TEXT[],
  secondary_keywords = ARRAY['travel agency invoice software Pakistan', 'umrah hotel voucher generator', 'travel payment receipt software']::TEXT[],
  seo_description = 'Stop issuing handwritten receipts and messy Word files. Learn how invoice and voucher software helps Pakistani travel agents look credible and avoid disputes.',
  read_time_minutes = 7,
  faq_items = '[{"question":"What is the difference between a booking invoice and a payment voucher?","answer":"A booking invoice bills the client for tickets, visas, or packages and records the sale. A payment voucher documents actual cash or bank money received from a client or paid to a vendor."},{"question":"Can travel agents customize invoices and vouchers with their own logo?","answer":"Yes. TAMS Pro includes template and branding settings so every PDF invoice, hotel voucher, and payment receipt displays your agency logo, colors, address, and terms automatically."},{"question":"Why do handwritten carbon-copy receipt books hurt travel agencies?","answer":"Paper books are unreadable in WhatsApp photos, lack automatic invoice numbering, require manual posting into ledgers, and cannot instantly prove remaining balances during client disputes."},{"question":"Can I email or WhatsApp PDF vouchers directly to travelers?","answer":"Yes. You can download crisp PDFs in one click to send on WhatsApp or email booking invoices and payment reminders directly from inside TAMS Pro."}]'::jsonb,
  updated_at = now()
WHERE slug = 'invoice-voucher-software-travel-agents';

UPDATE public.blog_posts
SET
  excerpt = 'Never miss a visa deadline, passport handover, or biometric slot. Learn how Pakistani travel consultants track visa applications cleanly with TAMS Pro.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Managing dozens of passports across UAE, Saudi, UK, Schengen, and Malaysia visa desks on sticky notes leads to missed appointments and frantic client calls.</li><li>A single missed biometric slot or passport expiry check can cost a client their job offer, family trip, or flight ticket.</li><li>Centralized visa tracking connects applicant documents, submission milestones, reminders, and embassy fee accounting in one place.</li><li>TAMS Pro helps Pakistani visa consultants and travel agencies stay ahead of every deadline at PKR 1,999/month (or PKR 9,999/year with 50% off yearly).</li></ul></blockquote>

<p>Visa consultancy has become one of the fastest-growing revenue streams for Pakistani travel agencies in Lahore, Islamabad, Mirpur, Gujrat, and Karachi. Yet unlike instant airline ticketing, a visa file moves slowly across several stages over days or weeks: document collection, bank statement verification, portal submission, biometric appointment, embassy review, passport collection, and finally ticket issuance.</p>

<p>When a single consultant juggles 40 active files at once—ranging from 30-day Dubai visit visas to Schengen tourist applications and Saudi Umrah batches—relying on desk drawers and calendar scribbles guarantees mistakes. Implementing a structured <strong>visa tracking software in Pakistan</strong> protects both your client''s passport and your agency''s reputation.</p>

<h2>Where Manual Visa Desks Break Down</h2>

<p>Even experienced visa officers run into recurring bottlenecks when files are scattered across folders:</p>

<ul>
  <li><strong>Missing passport expiry checks:</strong> Submitting a file when a passport has 5 months and 10 days remaining wastes processing fees and delays entire family trips.</li>
  <li><strong>Forgotten biometric or VFS appointments:</strong> If staff rely on personal phone alarms, one sick day or busy afternoon means nobody reminds the applicant on time.</li>
  <li><strong>Lost payment accountability:</strong> Visa portals and typing centers take upfront fees in cash or card, while clients pay in installments. Without linking visa files to party ledgers, agencies forget whether embassy fees were already billed.</li>
  <li><strong>Constant "Bhai status kya hua?" phone calls:</strong> Because records live in a locked physical cabinet, whoever answers the phone has to put the client on hold and shout across the office to find out if a passport came back.</li>
</ul>

<h2>5 Stages of an Error-Free Digital Visa Pipeline</h2>

<p>Organizing your visa desk digitally takes minimal effort once every file passes through five clear checkpoints:</p>

<h3>1. Clean Intake &amp; Passport Verification</h3>

<p>At intake, log the applicant''s full name, contact number, passport number, passport expiry date, and destination service type inside your booking record. Adding an alert for passports expiring within 6 months catches issues before you ever charge a submission fee.</p>

<h3>2. Linked Fee Billing &amp; Supplier Costing</h3>

<p>Record your selling price (for example, PKR 28,000 for a 60-day UAE visa or PKR 65,000 consultancy package) alongside your supplier or portal cost (PKR 22,500) right inside the same booking. Your client ledger and vendor payable stay accurate from day one—no unbilled portal deductions at month-end.</p>

<h3>3. Milestone Status &amp; Reference Tracking</h3>

<p>Store application reference numbers, submission dates, and status notes directly on the client''s record. Any authorized team member at the front desk can answer a status inquiry in five seconds without digging through paper files.</p>

<h3>4. Automated Deadline &amp; Follow-Up Reminders</h3>

<p>Set follow-up reminders inside your dashboard for biometric slots, pending police character certificates, visa exit deadlines, or upcoming passport pickups. Proactive WhatsApp reminders make your agency look remarkably organized—turning one-time visa applicants into lifelong ticketing clients.</p>

<h3>5. Seamless Transition to Ticketing &amp; Umrah Bookings</h3>

<p>Once the visa approves, your client''s name, phone, and passport details are already saved in your database. Issuing their return flight ticket or booking their Umrah package takes seconds instead of starting from scratch.</p>

<blockquote><p><strong>Organize every visa file and deadline:</strong> Explore Visa tracking, Notifications, and Client Ledgers on our <a href="/features">Features page</a>, or <a href="/signup">create your TAMS Pro account</a> today at <a href="/pricing">PKR 1,999/month (or PKR 9,999/year — 50% off yearly)</a>.</p></blockquote>

<h2>Handling Umrah Visas vs. Visit &amp; Schengen Files</h2>

<p>Different visa categories demand slightly different tracking discipline:</p>

<ul>
  <li><strong>Umrah &amp; Saudi Batch Visas:</strong> Track group departure dates, hotel voucher alignment, and MOFA numbers tightly alongside transport schedules. Check our <a href="/blogs/manage-umrah-packages-digitally-pakistan">digital Umrah management guide</a> for complete group coordination tips.</li>
  <li><strong>UAE &amp; Gulf Visit Visas:</strong> Track entry validity deadlines (typically 60 days from issue) and overstay risk alerts so clients never accidentally trigger fine penalties.</li>
  <li><strong>UK, Schengen &amp; North America Consultancy:</strong> Maintain detailed document logs, staged consultancy payment vouchers, and embassy appointment dates in chronological order.</li>
</ul>

<h3>Morning 10-Minute Visa Desk Checklist</h3>

<p>Top visa offices in Islamabad, Mirpur, and Lahore do not wait for clients to call asking for updates—they run a quick morning check every day at 9:30 AM:</p>

<ol>
  <li><strong>Filter pending &amp; urgent deadlines:</strong> Review every notification triggered for today''s VFS/Gerry''s biometric appointments, expiring visit visas, or incomplete bank statements.</li>
  <li><strong>Verify passport custody &amp; return dates:</strong> Confirm which passports sit inside embassy pipelines vs. your office safe, and log exact handover notes when a family collects approved documents.</li>
  <li><strong>Check partial visa fee collections:</strong> Ensure second installments (e.g., remaining PKR 35,000 upon visa approval) are collected cleanly through a payment voucher before handing over the stamped passport.</li>
  <li><strong>Send proactive WhatsApp status messages:</strong> A quick update—<em>"Your Dubai visa is under final portal review and expected by Thursday afternoon"</em>—cuts incoming stress calls by half and earns enthusiastic word-of-mouth referrals.</li>
</ol>

<h3>Why Unifying Visas, Tickets &amp; Accounts Multiplies Revenue</h3>

<p>When your visa tracker sits inside the same agency system as ticketing and Umrah, every approved visa becomes an immediate cross-sell opportunity. The moment a consultant marks a UK or UAE visit visa approved, your ticketing desk already has the traveler''s spelling, travel window, and contact details ready to send a <a href="/blogs/create-travel-quotations-in-2-minutes">2-minute flight quotation</a>—turning single-service visa clients into full-package buyers.</p>

<h3>Avoiding Common Visa Refund &amp; Re-Application Disputes</h3>

<p>Embassy and portal fees are typically non-refundable once submitted, yet clients frequently misunderstand what happens if a visit visa is delayed or refused. Keeping dated payment vouchers alongside clear status logs inside TAMS Pro protects your agency from awkward financial misunderstandings: both your staff and the applicant can verify when fees were paid to the typing portal, what service fee applied, and whether any balance carries toward a re-application or flight rebooking.</p>

<p>To ensure your consultancy fees and vendor portal payouts never fall out of sync, review our <a href="/blogs/travel-agency-accounting-ledger-pakistan">travel agency accounting guide</a> and avoid common workflow traps highlighted in <a href="/blogs/7-mistakes-pakistani-travel-agencies-bookings">7 travel agency booking mistakes</a>.</p>

<h2>Protect Every Passport and Every Deadline</h2>

<p>In visa consultancy, trust is your real product. One missed deadline costs referrals across an entire family network, while consistent, timely updates bring repeat clients all year. See <a href="/pricing">TAMS Pro plans (PKR 1,999/month, or PKR 9,999/year with 50% off on the yearly plan)</a> and <a href="/signup">get started free today</a>.</p>

<h2>Frequently Asked Questions</h2>

<h3>How do travel consultants track multiple visa applications without errors?</h3>
<p>By storing passport numbers, destination types, submission dates, payment balances, and deadline reminders inside one searchable cloud system like TAMS Pro instead of paper notebooks.</p>

<h3>Which visa types can be managed inside TAMS Pro?</h3>
<p>You can manage Umrah visas, UAE visit visas, Saudi visas, Schengen, UK, US, and custom visa consultancy services along with client invoices and vendor costs.</p>

<h3>Can I track passport handovers and document checklists per client?</h3>
<p>Yes. Every visa booking record holds passenger passport details, custom service notes, receipts, and edit history so any team member can check file status instantly.</p>

<h3>How do deadline reminders reduce visa rejections and client complaints?</h3>
<p>Built-in reminders surface approaching embassy appointments, missing document follow-ups, and expiry warnings on your dashboard before deadlines pass.</p>',
  tags = ARRAY['visa tracking software Pakistan', 'visa consultancy software', 'passport tracking system', 'visa deadline alerts', 'umrah visa tracking', 'travel agency software Pakistan', 'visa consultant tools']::TEXT[],
  secondary_keywords = ARRAY['visa consultancy management software', 'track visa applications travel agency', 'passport tracking software Pakistan']::TEXT[],
  seo_description = 'Never miss a visa deadline, passport handover, or biometric slot. Learn how Pakistani travel consultants track visa applications cleanly with TAMS Pro.',
  read_time_minutes = 7,
  faq_items = '[{"question":"How do travel consultants track multiple visa applications without errors?","answer":"Use a centralized visa tracking system that links each applicant''s passport details, destination country, submission date, fee receivable, and upcoming biometric or expiry reminders in one dashboard."},{"question":"Which visa types can be managed inside TAMS Pro?","answer":"TAMS Pro supports Umrah visas, UAE/Dubai visit visas, Saudi work/visit visas, Schengen/UK/US tourist filings, and custom consultancy services."},{"question":"Can I track passport handovers and document checklists per client?","answer":"Yes. Recording passport numbers, expiry warnings, submission notes, and payment receipts per booking prevents misplaced passports or unbilled embassy fees."},{"question":"How do deadline reminders reduce visa rejections and client complaints?","answer":"Automated notifications alert staff days before biometric appointments, ticket hold deadlines, or visa validity cutoffs so clients are updated proactively."}]'::jsonb,
  updated_at = now()
WHERE slug = 'track-visa-applications-without-missing-deadlines';

UPDATE public.blog_posts
SET
  excerpt = 'Learn how Pakistani travel agencies calculate SAR to PKR Umrah package costs across hotels, flights, visas, and room sharing without losing any margin.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Manual calculator errors and forgotten SAR exchange shifts quietly turn busy Umrah months into break-even or loss-making departures.</li><li>Always divide Makkah and Madinah room costs by actual sharing type (Quad ÷ 4, Triple ÷ 3, Double ÷ 2), never by a flat guess.</li><li>Using the built-in Umrah Calculator inside TAMS Pro produces accurate PKR quotes across Quad, Triple, and Double sharing in under 60 seconds.</li><li>Connecting costing directly to invoicing protects margins across every family and group booking.</li></ul></blockquote>

<p>During peak Umrah seasons in Pakistan, pricing speed determines who closes the deal. A group leader from Sargodha or a family of six in Lahore calls asking for a 14-day economy Umrah package—7 nights in Makkah, 7 nights in Madinah, direct Saudia flight, transport, and visa—with rates for Quad, Triple, and Double rooms.</p>

<p>If your staff punches those numbers into a handheld calculator, forgets to convert Saudi Riyal transport accurately, or mixes up child-without-bed airfare vs. infant costs, you either quote too high and lose the sale or quote too low and lose PKR 15,000 out of your own pocket. That is why every serious operator relies on a structured <strong>umrah cost calculator in Pakistan</strong>.</p>

<h2>The 6 Cost Components Inside Every Umrah Package</h2>

<p>Before quoting any PKR rate to a pilgrim, break your package into fixed per-person items and shared per-room items:</p>

<ol>
  <li><strong>Air Ticket (PKR):</strong> Direct or indirect return fare per adult, child (typically 75%–85% of base fare plus taxes), and infant.</li>
  <li><strong>Saudi Umrah Visa &amp; Insurance (SAR):</strong> Converted cleanly at your current settlement exchange rate.</li>
  <li><strong>Makkah Hotel Cost (SAR per room × nights):</strong> Divided by 4 for Quad, 3 for Triple, or 2 for Double sharing. Note weekend rate hikes (Thursday and Friday nights often cost 20%–40% more!).</li>
  <li><strong>Madinah Hotel Cost (SAR per room × nights):</strong> Calculated with the exact same room-night division rule.</li>
  <li><strong>Ground Transport &amp; Ziyarat (SAR):</strong> Bus or private GMC/Hiace split across the group or family headcount.</li>
  <li><strong>Agency Margin &amp; Currency Buffer (PKR):</strong> Your target net profit per pilgrim plus a small SAR fluctuation safeguard.</li>
</ol>

<h2>Real PKR Example: Pricing a 14-Night Family Package</h2>

<p>Let us walk through an illustrative calculation using an assumed settlement rate of <strong>1 SAR = 75 PKR</strong> for a 14-night package (7 nights Makkah + 7 nights Madinah):</p>

<ul>
  <li><strong>Return Air Ticket:</strong> PKR 165,000 per adult</li>
  <li><strong>Umrah Visa + Insurance:</strong> SAR 550 × 75 = PKR 41,250</li>
  <li><strong>Makkah Hotel (SAR 280/room/night × 7 nights):</strong> SAR 1,960 per room total (PKR 147,000 per room)</li>
  <li><strong>Madinah Hotel (SAR 240/room/night × 7 nights):</strong> SAR 1,680 per room total (PKR 126,000 per room)</li>
  <li><strong>Bus Transport Share:</strong> SAR 80 × 75 = PKR 6,000 per person</li>
  <li><strong>Total Room Cost (Makkah + Madinah):</strong> PKR 273,000 per room</li>
</ul>

<p>Now look how sharply room sharing changes the per-person cost before margin:</p>

<ul>
  <li><strong>Quad Sharing (Room ÷ 4):</strong> 165,000 + 41,250 + (273,000 ÷ 4 = 68,250) + 6,000 = <strong>PKR 280,500 net cost</strong></li>
  <li><strong>Triple Sharing (Room ÷ 3):</strong> 165,000 + 41,250 + (273,000 ÷ 3 = 91,000) + 6,000 = <strong>PKR 303,250 net cost</strong></li>
  <li><strong>Double Sharing (Room ÷ 2):</strong> 165,000 + 41,250 + (273,000 ÷ 2 = 136,500) + 6,000 = <strong>PKR 348,750 net cost</strong></li>
</ul>

<p>Add a healthy PKR 12,000 agency profit per adult (plus a PKR 2,500 SAR rate cushion) and your transparent selling prices are PKR 295,000 (Quad), PKR 317,750 (Triple), and PKR 363,250 (Double). Zero guesswork—and you can show the client exact value differences instantly.</p>

<blockquote><p><strong>How to use the Umrah Calculator inside TAMS Pro:</strong> Log in and click <strong>Umrah Calculator</strong> in the left sidebar &rarr; enter today''s SAR-to-PKR rate &rarr; add your Makkah and Madinah hotels, nights, and sharing mode (Quad &divide; 4, Triple &divide; 3, Double &divide; 2, or Quint &divide; 5) &rarr; enter visa, transport, ziyarat, and airfare with your target profit margin &rarr; export a branded PDF summary or convert directly into a quotation. View <a href="/pricing">TAMS Pro Pricing (PKR 1,999/month, or PKR 9,999/year with 50% off on the yearly plan)</a> and <a href="/signup">sign up free today</a>.</p></blockquote>

<h2>3 Costing Traps That Quietly Destroy Umrah Profits</h2>

<p>Even with a spreadsheet, watch out for these three profit killers:</p>

<ul>
  <li><strong>Ignoring Ramadan last-10-nights rate jumps:</strong> Splitting a package that crosses into peak Ashra nights using average hotel tariffs understates true room cost dramatically.</li>
  <li><strong>Using yesterday''s SAR rate:</strong> Always verify today''s remittance/exchange cost before locking group commitments, especially on 20-to-40 pax batches where a 1.5 PKR jump swings margin by PKR 60,000+.</li>
  <li><strong>Mixing private transport into standard sharing quotes:</strong> If a family of four requests a private Camry or GMC instead of group coaster transfers, update transport per-person cost immediately before issuing the quotation.</li>
</ul>

<h3>Pricing Children, Infants &amp; Senior Citizens Accurately</h3>

<p>Pakistani family inquiries almost always include grandparents, young children, and infants. Quoting a lazy "flat PKR 10,000 off" for kids often eats away your entire agency margin because Saudi visa fees remain identical across ages while airline infant and child rules differ sharply:</p>

<ul>
  <li><strong>Infants (under 2 years):</strong> Pay airline infant ticket taxes (typically 10%–15% of adult base fare) plus full Saudi Umrah visa and insurance cost, with zero separate hotel bed charge.</li>
  <li><strong>Child without bed (2–11 years):</strong> Pays discounted child airfare (around 75%–85% of adult ticket), full Saudi visa, and bus seat—saving only the shared hotel bed fraction if staying in parents'' room.</li>
  <li><strong>Child with bed (2–11 years):</strong> Receives full adult room-share calculation; only the airline fare discount separates child and adult package rates.</li>
</ul>

<h3>Converting Final Calculations Straight Into Sales</h3>

<p>Speed matters just as much as accuracy. When a client from Rawalpindi or Gujranwala accepts your Quad and Double options, record the exact supplier payable in PKR alongside your selling total inside TAMS Pro so your <a href="/blogs/travel-agency-accounting-ledger-pakistan">agency ledger</a> reflects true expected profit immediately. Check our workflow guides on <a href="/blogs/manage-umrah-packages-digitally-pakistan">managing Umrah packages digitally</a> and <a href="/blogs/create-travel-quotations-in-2-minutes">sending professional quotations in 2 minutes</a> so your pricing translates cleanly into confirmed bookings.</p>

<h3>Comparing Off-Peak vs. Peak Ramadan Package Margins</h3>

<p>A smart operator never applies identical rupee markups across the entire Hijri calendar. During quieter months like Safar or Rabi-ul-Awwal, competitive market pricing in Lahore and Karachi may leave around PKR 8,000 to PKR 12,000 net profit per adult. During peak Rajab, Shaban, and Ramadan departures, however, scarce hotel inventory, higher working-capital lockups, and stricter supplier cancellation rules justify higher risk buffers and firmer advance deposits. Using a repeatable Umrah calculator lets you test multiple hotel star ratings and airline dates in seconds so every seasonal brochure stays firmly profitable.</p>

<h3>Preparing Transparent Breakdown Quotes for Families</h3>

<p>Pakistani families appreciate clarity before paying a large advance. Instead of giving a single mysterious lump sum, present a crisp two-option comparison showing flight dates, exact hotel distance from Haram, sharing tier (Quad, Triple, or Double), and child pricing side by side. When clients see why Double sharing costs more per person than Quad sharing—backed by clean SAR-to-PKR math—they trust your guidance immediately and confirm deposits far sooner without endless bargaining.</p>

<h2>Calculate Smarter, Quote Faster, Keep Your Margin</h2>

<p>Stop losing margin to rushed mental arithmetic. Open the built-in Umrah Calculator inside TAMS Pro to price multi-tier packages, save preset 3-star, 4-star, and 5-star hotel combinations, and run your full agency bookings, vouchers, and PKR accounting in one place. Visit our <a href="/features">Features page</a>, compare <a href="/pricing">PKR 1,999/month and PKR 9,999/year (50% off yearly) plans</a>, or <a href="/signup">create your free account today</a>.</p>

<h2>Frequently Asked Questions</h2>

<h3>How do Pakistani travel agents calculate an Umrah package price in PKR?</h3>
<p>Convert Saudi hotel, visa, and transport costs from SAR to PKR, divide total hotel room cost by room occupancy (4, 3, or 2 persons), add PKR flight fare, and include your agency profit margin.</p>

<h3>What SAR to PKR buffer should agents use when quoting Umrah packages?</h3>
<p>Adding a 1% to 2% buffer above the daily exchange rate protects agency profits against rupee volatility between advance collection and Saudi vendor settlement.</p>

<h3>How do I use the Umrah Calculator inside TAMS Pro?</h3>
<p>Open Umrah Calculator from your TAMS Pro sidebar, enter the SAR-to-PKR rate, select Makkah and Madinah hotels with nights and room sharing (Quad, Triple, Double, or Quint), add visa, transport, and flight costs plus your profit margin, and export a PDF breakdown or convert directly into a client quotation.</p>

<h3>Why should Quad, Triple, and Double packages always be priced separately?</h3>
<p>Hotels charge per room per night rather than per bed. Fewer guests per room spreads the exact same SAR room tariff across fewer travelers, raising per-person cost significantly.</p>',
  tags = ARRAY['umrah cost calculator Pakistan', 'SAR to PKR umrah calculator', 'umrah package calculation', 'umrah package price Pakistan', 'umrah package calculator', 'umrah operator software', 'umrah costing sheet']::TEXT[],
  secondary_keywords = ARRAY['umrah package calculation in PKR', 'SAR to PKR umrah calculator', 'how to price umrah packages']::TEXT[],
  seo_description = 'Learn how Pakistani travel agencies calculate SAR to PKR Umrah package costs across hotels, flights, visas, and room sharing without losing any margin.',
  read_time_minutes = 7,
  faq_items = '[{"question":"How do Pakistani travel agents calculate an Umrah package price in PKR?","answer":"Add airfare (in PKR), Umrah visa, ground transport, and total Makkah plus Madinah room nights divided by room sharing capacity (4 for Quad, 3 for Triple, 2 for Double), convert SAR components at a buffered exchange rate, and add your agency profit margin."},{"question":"What SAR to PKR buffer should agents use when quoting Umrah packages?","answer":"Smart operators add a small 1% to 2% currency buffer over the daily interbank/open market SAR rate to protect profit if the rupee weakens between quote acceptance and Saudi vendor settlement."},{"question":"How do I use the Umrah Calculator inside TAMS Pro?","answer":"Open Umrah Calculator from the TAMS Pro sidebar, enter today''s SAR-to-PKR exchange rate, add Makkah and Madinah hotel nights and room sharing (Quad, Triple, Double, or Quint), enter visa, flight, transport, and ziyarat costs plus your profit margin, and download a PDF summary or create a quotation in one click."},{"question":"Why should Quad, Triple, and Double packages always be priced separately?","answer":"Hotel rooms are billed per room per night, not per person. Dividing a SAR 400 room across two people instead of four doubles the accommodation cost per pilgrim."}]'::jsonb,
  updated_at = now()
WHERE slug = 'umrah-cost-calculator-price-packages-profitably';

UPDATE public.blog_posts
SET
  excerpt = 'Avoid the 7 costly mistakes Pakistani travel agencies make with bookings, client records, partial payments, and sub-agent ledgers, and fix them fast today.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Most cash losses at Pakistani travel agencies do not come from bad sales—they come from repeatable record-keeping mistakes at the counter.</li><li>Disconnected notebooks, unrecorded cash advances, unverified sub-agent credit, and missing refund logs cost thousands of rupees every month.</li><li>Fixing these seven habits immediately boosts profit margins and saves 10+ hours of weekly staff stress.</li><li>TAMS Pro eliminates every one of these errors at PKR 1,999/month (or PKR 9,999/year with 50% off yearly).</li></ul></blockquote>

<p>Most Pakistani travel agency owners work relentlessly. You open early, stay late for urgent airport re-issues, chase airline consolidators for seat confirmations, and handle family inquiries through the weekend. Yet at the end of a busy quarter, many owners look at their bank balance and wonder why profits feel smaller than their booking volume.</p>

<p>In almost every audit we see across Lahore, Faisalabad, Sialkot, and Karachi, the gap comes down to seven quiet <strong>travel agency booking and client record mistakes</strong>. Check how many happen inside your office right now.</p>

<h2>Mistake 1: Storing Bookings in One Place and Payments in Another</h2>

<p>When your ticketing clerk records bookings in an Excel file while the owner notes cash and bank deposits inside a diary or WhatsApp self-chat, your receivables are immediately out of date. Consider a real scenario common in Faisalabad and Lahore: a regular client books three Dubai tickets for PKR 345,000, pays PKR 200,000 via bank transfer on Monday, and sends PKR 110,000 cash through a driver on Wednesday. If Wednesday''s cash slip sits on a desk without entering the booking file, your team either embarrasses a loyal client by chasing money they already paid—or forgets the remaining PKR 35,000 altogether.</p>

<p><strong>The fix:</strong> Connect every invoice directly to its payment vouchers inside <a href="/blogs/travel-agency-accounting-ledger-pakistan">unified travel agency accounting software</a> so balances update automatically.</p>

<h2>Mistake 2: Retyping Passport Details Every Time a Regular Client Travels</h2>

<p>Families and corporate executives travel repeatedly across the year. Retyping passport numbers, expiry dates, and spellings from fuzzy WhatsApp photos every six months guarantees a costly name-correction penalty on an airline ticket—often PKR 12,000 to PKR 28,000 out of agency commission—or an embarrassing rejection at visa submission.</p>

<p><strong>The fix:</strong> Keep a clean centralized party and passenger record. Once a passenger travels with you once, pull up verified passport details in seconds with zero manual retyping.</p>

<h2>Mistake 3: Giving Unmonitored Credit to Sub-Agents and Friends</h2>

<p>B2B sub-agents and personal acquaintances often request "urgent" Friday-night tickets on credit when banks are closed. Without instant visibility into their exact running balance, a sub-agent owing PKR 240,000 quietly climbs to PKR 580,000 over two weeks before anyone catches the exposure. Worse, when you finally ask for settlement, missing date-by-date receipts turn a simple collection call into a strained argument.</p>

<p><strong>The fix:</strong> Review party aging weekly and share clear, date-filtered PDF statements every Saturday morning before releasing fresh credit.</p>

<h2>Mistake 4: Quoting Without Locking Currency &amp; Vendor Cost</h2>

<p>Quoting an Umrah or Dubai package based on memory—without verifying today''s hotel tariff or SAR exchange rate—turns profitable departures into silent losses. Even a two-rupee shift on SAR across a 25-passenger group eats tens of thousands in net earnings. See exact package pricing math in our <a href="/blogs/umrah-cost-calculator-price-packages-profitably">Umrah cost calculator guide</a>, and inside TAMS Pro simply open <strong>Umrah Calculator</strong> from the sidebar, enter today''s SAR-to-PKR rate, set Makkah/Madinah hotel nights and room sharing, and lock your exact PKR margin before sending a quote.</p>

<h2>Mistake 5: Failing to Track Ticket Voids and Supplier Refunds</h2>

<p>A client cancels a trip, you promise a refund minus airline charges, and the GDS refund takes three weeks to credit your consolidator portal. Too often, agencies either refund the client before confirming vendor credit or forget to adjust vendor payables—leaving phantom dues on both sides and distorting monthly net profit reports.</p>

<p><strong>The fix:</strong> Log voids and refunds through an explicit refund workflow that adjusts client credit, vendor expectations, and net profit simultaneously with complete notes.</p>

<blockquote><p><strong>Eliminate costly counter mistakes:</strong> See how TAMS Pro automates bookings, party ledgers, reminders, and refunds on our <a href="/features">Features page</a>, or <a href="/signup">start your free account</a> at <a href="/pricing">PKR 1,999/month (or PKR 9,999/year — 50% off yearly)</a>.</p></blockquote>

<h2>Mistake 6: Sending Informal Text Quotes and Paper Receipts</h2>

<p>High-value corporate and overseas Pakistani buyers judge credibility by your paperwork. Informal WhatsApp prices lead to disputes over baggage allowances and meal plans, while torn carbon slips look amateurish. Upgrade both speed and trust with our guides on <a href="/blogs/create-travel-quotations-in-2-minutes">2-minute travel quotations</a> and <a href="/blogs/invoice-voucher-software-travel-agents">branded invoice &amp; voucher software</a>.</p>

<h2>Mistake 7: Having Zero Backup or Staff Accountability</h2>

<p>What happens if your office laptop dies during peak Umrah season? Or if an employee resigns after editing an Excel sheet or deleting past entries? Local files with zero audit trails leave your entire agency vulnerable to sudden operational paralysis.</p>

<p><strong>The fix:</strong> Move to cloud software with automatic backups, individual staff logins, permission gates, and immutable edit history so you always know who changed what and why.</p>

<h3>A 15-Minute Office Audit You Can Run Today</h3>

<p>Pick any five recent bookings from last month and trace each one end-to-end: verify the selling invoice, check every cash or bank receipt, confirm the supplier payout matches your consolidator statement, and inspect the passenger passport record. Wherever your staff spent more than three minutes hunting across WhatsApp or paper pads, you have found your highest-ROI automation win.</p>

<p>Next, ask your team which single weekly report takes the longest to prepare—usually overdue client balances or supplier payable totals—and eliminate that bottleneck first. Cleaning up even two counter habits immediately stabilizes daily cash flow and lowers staff stress before your next busy travel wave hits.</p>

<h3>Building Simple Counter SOPs for Every Staff Member</h3>

<p>Once your office adopts software, write down four clear rules for every ticketing and Umrah agent: never hold an unlogged cash receipt overnight, attach passport copies directly to saved client profiles, issue a branded PDF quotation for every WhatsApp inquiry above PKR 50,000, and reconcile cash/bank closing balances before shutting down computers at 7:00 PM. Consistent daily checklists protect agency margins even during peak Ramadan and summer rushes across Lahore, Karachi, Islamabad, and regional offices. Clear standard operating procedures turn frantic guesswork into calm, predictable execution across every shift and branch.</p>

<p>Ready to leave counter errors behind permanently? Review our <a href="/blogs/best-travel-agency-software-pakistan-2026">complete guide to travel agency software in Pakistan</a> or compare <a href="/blogs/excel-vs-travel-agency-software-pakistan">Excel vs travel agency software</a> before getting started.</p>

<h2>Fix One Habit This Week, Save Thousands Every Month</h2>

<p>You do not have to overhaul everything overnight. Pick the mistake costing your office the most sleep today—usually scattered payments or messy client balances—and move active bookings into TAMS Pro. Compare our <a href="/pricing">PKR 1,999/month and PKR 9,999/year (50% off yearly) plans</a> and <a href="/signup">sign up free now</a>.</p>

<h2>Frequently Asked Questions</h2>

<h3>What is the biggest operational mistake Pakistani travel agencies make?</h3>
<p>Separating booking records from cash and bank payment receipts. When invoices and payments live in different notebooks or files, forgotten dues and ledger arguments become unavoidable.</p>

<h3>How do agencies prevent spelling errors on airline tickets and visas?</h3>
<p>By storing verified client passport details inside a central digital database so repeat bookings reuse saved information rather than manual retyping.</p>

<h3>How should travel agencies handle credit limits for sub-agents?</h3>
<p>Keep every sub-agent in an active party ledger and send automated weekly statements showing opening balance, new tickets, receipts, and current due amounts.</p>

<h3>Can small 2-person agencies benefit from travel agency software?</h3>
<p>Yes. Small agencies gain huge leverage because saving 10 hours a week and catching even one missed PKR 15,000 balance pays for an entire year of TAMS Pro.</p>',
  tags = ARRAY['travel agency mistakes Pakistan', 'client record management', 'travel agency software Pakistan', 'sub-agent ledger errors', 'travel booking best practices', 'agency profit leakage', 'umrah operations Pakistan']::TEXT[],
  secondary_keywords = ARRAY['travel agency client record mistakes', 'travel business cash loss Pakistan', 'fix travel agency operations']::TEXT[],
  seo_description = 'Avoid the 7 costly mistakes Pakistani travel agencies make with bookings, client records, partial payments, and sub-agent ledgers, and fix them fast today.',
  read_time_minutes = 7,
  faq_items = '[{"question":"What is the biggest operational mistake Pakistani travel agencies make?","answer":"Tracking bookings, cash collections, and supplier payables in separate places—which causes forgotten client balances, inaccurate profit estimates, and awkward ledger disputes."},{"question":"How do agencies prevent spelling errors on airline tickets and visas?","answer":"Store verified passenger passport names and numbers centrally inside a digital client database so repeat trips and Umrah bookings reuse accurate records rather than manual retyping."},{"question":"How should travel agencies handle credit limits for sub-agents?","answer":"Maintain an active party ledger for every B2B sub-agent with strict balance visibility and date-filtered statements sent weekly before issuing new tickets on credit."},{"question":"Can small 2-person agencies benefit from travel agency software?","answer":"Yes. Small agencies actually save the most time because every forgotten PKR 10,000 due or wasted administrative hour hits the owner directly."}]'::jsonb,
  updated_at = now()
WHERE slug = '7-mistakes-pakistani-travel-agencies-bookings';

UPDATE public.blog_posts
SET
  excerpt = 'Comparing Excel vs travel agency software in Pakistan. Discover hidden spreadsheet costs, error risks, and why switching to TAMS Pro pays for itself fast.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Excel feels free, but broken formulas, copy-paste errors, and manual PDF formatting cost Pakistani agencies hours of labor and lost receivables every month.</li><li>Spreadsheets cannot link one booking simultaneously to a client ledger, vendor payable, cash/bank book, and branded PDF voucher.</li><li>Once an agency handles 25+ monthly bookings or employs 2+ staff, dedicated travel software scales dramatically faster than Excel.</li><li>TAMS Pro replaces messy workbooks with purpose-built workflows at PKR 1,999/month (or PKR 9,999/year with 50% off yearly).</li></ul></blockquote>

<p>Almost every travel agency in Pakistan starts on Microsoft Excel—and for good reason. When you first open a small desk in Jhelum or Karachi with ten tickets a month, Excel feels free, familiar, and flexible. You create columns for Date, Passenger Name, Sector, Cost, Sale, and Profit, and everything fits neatly on one screen.</p>

<p>Six months later, business picks up. Now you have 90 monthly tickets, 20 Umrah families paying in installments, three airlines, two B2B sub-agents, partial cash and Meezan Bank receipts, and two counter staff opening files at the same time. Suddenly, that "free" spreadsheet becomes the single biggest bottleneck slowing your growth. Let us compare <strong>Excel vs travel agency software</strong> honestly across real agency criteria.</p>

<h2>1. Speed Per Booking &amp; Daily Document Output</h2>

<p><strong>In Excel:</strong> Staff type passenger details into a sales sheet, open a second workbook for client balances, open MS Word to edit an invoice or Umrah voucher, save a PDF manually, and then type a third entry into a daily cash book. Every booking touches three or four files.</p>

<p><strong>In Travel Software:</strong> You enter the booking once. Client receivable, supplier payable, net profit, branded PDF invoice, and voucher are ready in under 60 seconds. Check how fast this works for <a href="/blogs/invoice-voucher-software-travel-agents">invoices and vouchers</a> as well as <a href="/blogs/create-travel-quotations-in-2-minutes">2-minute client quotations</a>.</p>

<h2>2. Formula Fragility vs. Atomic Accounting Accuracy</h2>

<p><strong>In Excel:</strong> One accidental drag-fill, deleted row, or overwritten <code>=SUM()</code> formula silently corrupts a client''s balance for weeks. Worse, Excel has no built-in knowledge of travel accounting—refunds, voids, and bank transfers require manual hacks.</p>

<p><strong>In Travel Software:</strong> Financial math is locked into tested database rules. Every invoice, receipt, transfer, and refund adjusts balances accurately with full audit history—detailed further in our <a href="/blogs/travel-agency-accounting-ledger-pakistan">travel agency accounting and ledger guide</a>.</p>

<h2>3. Team Collaboration &amp; Security</h2>

<p><strong>In Excel:</strong> Sharing a local file on one PC creates traffic jams, while emailing versions back and forth creates <code>Sales_Oct_FINAL_v4.xlsx</code> chaos. Even worse, any employee with file access can export your entire client contact list or change old cash receipts unnoticed.</p>

<p><strong>In Travel Software:</strong> Everyone logs in from their own desktop or phone browser in real time with role-based permissions. Only the agency owner decides who can edit, delete, or view sensitive financial summaries.</p>

<h2>4. Mobile Access When You Are Away From the Office</h2>

<p><strong>In Excel:</strong> Reading a 16-column spreadsheet on a smartphone screen while sitting in traffic or at an airport check-in counter is nearly impossible.</p>

<p><strong>In Travel Software:</strong> TAMS Pro adapts cleanly to mobile screens so you can check today''s cash position, look up a PNR, or send a client ledger statement on WhatsApp straight from your phone.</p>

<blockquote><p><strong>Ready to outgrow spreadsheets?</strong> See every tool built specifically for Pakistani agencies on our <a href="/features">Features page</a>, compare <a href="/pricing">PKR 1,999/month or PKR 9,999/year (50% off on the yearly plan)</a>, and <a href="/signup">sign up free on TAMS Pro</a>.</p></blockquote>

<h2>Side-by-Side Comparison: Excel vs. TAMS Pro</h2>

<ul>
  <li><strong>Subscription Cost:</strong> Excel (free/Office license, high hidden error cost) vs. TAMS Pro (<strong>PKR 1,999/month, or PKR 9,999/year with 50% off on the yearly plan</strong>).</li>
  <li><strong>Client &amp; Vendor Ledgers:</strong> Manual formulas vs. automatic double-sided sync.</li>
  <li><strong>Umrah Package Costing:</strong> Manual sheets vs. TAMS Pro''s built-in Umrah Calculator (set SAR-to-PKR rate, Makkah/Madinah hotel nights &amp; room sharing, visa/transport/flight costs, and export a quote in seconds).</li>
  <li><strong>Branded PDFs:</strong> Slow Word templates vs. one-click invoices, quotes, and vouchers.</li>
  <li><strong>Data Safety:</strong> Risk of laptop crash or accidental delete vs. encrypted cloud storage &amp; backups.</li>
</ul>

<h2>The Hidden PKR Cost of "Free" Spreadsheets</h2>

<p>Owners often resist spending PKR 1,999 a month because Excel feels already paid for. Yet do the simple math on a 3-person agency in Rawalpindi or Karachi. If each employee spends just 45 minutes a day formatting Word invoices, cross-checking bank screenshots against rows, and building manual party statements, your office burns nearly <strong>45 hours of skilled staff time every month</strong>. Even conservatively valued, that wasted labor costs far more than an entire year of software—before counting a single missed PKR 18,000 partial balance or formula slip-up.</p>

<h2>How to Migrate From Excel in One Weekend</h2>

<p>Switching does not require halting ticket sales or typing years of historical archives:</p>

<ol>
  <li><strong>Keep old sheets as read-only archive:</strong> Save last year''s Excel files safely in Google Drive for reference; never enter new sales there again.</li>
  <li><strong>Enter opening client &amp; vendor balances:</strong> Sum up who owes your agency and whom you owe as of Sunday evening and enter those clean opening balances into TAMS Pro.</li>
  <li><strong>Run all Monday morning sales digitally:</strong> Create your agency''s next tickets, Umrah bookings, and receipts straight inside the new workspace so ledgers stay accurate from day one.</li>
  <li><strong>Review your first weekly report on Saturday:</strong> Compare your clean software profit, overdue receivables, and cash/bank balances against your old workbook habits—your team will never want to go back to manual formulas.</li>
</ol>

<h3>Common Objections From Staff (And How They Disappear in 48 Hours)</h3>

<p>Counter staff who have spent years inside spreadsheets sometimes hesitate before trying new software, worrying it might slow them down during busy phone calls. In practice, agents love leaving Excel behind once they realize they no longer have to fix broken <code>=SUM()</code> formulas, manually type Word vouchers, or spend Friday evenings explaining missing PKR 20,000 cash adjustments. Clean keyboard navigation, fast party search, and one-click PDF downloads make daily ticketing noticeably faster from the very first afternoon.</p>

<h2>When Is the Right Moment to Switch?</h2>

<p>If you handle fewer than 10 simple cash tickets a month by yourself, Excel can hold you over briefly. The moment you start accepting installment payments, hiring counter staff, managing Umrah groups, or working with B2B sub-agents, waiting costs far more than switching.</p>

<p>Think about how quickly operational clarity compounds over twelve months: cleaner client follow-ups lift repeat family bookings, instant party statements collect receivables days faster, and accurate Umrah costing protects profit on every single group seat. Instead of wrestling with broken formulas every Friday evening, your team focuses on closing higher-margin packages.</p>

<p>Read our complete <a href="/blogs/best-travel-agency-software-pakistan-2026">2026 guide to travel agency software in Pakistan</a> to see how smoothly agencies transition over a single weekend. Ready now? <a href="/signup">Create your free TAMS Pro account</a> and experience organized growth firsthand.</p>

<h2>Frequently Asked Questions</h2>

<h3>Is Excel enough to run a travel agency in Pakistan?</h3>
<p>Excel works temporarily for very small solo operations, but once you handle 25+ bookings monthly, installment clients, or staff members, manual spreadsheets create errors and slow growth.</p>

<h3>What are the biggest risks of running a travel agency on Excel?</h3>
<p>Broken formulas, conflicting file versions, zero multi-user security, lack of instant PDF vouchers, and severe data-loss risk if a computer fails.</p>

<h3>How much time does dedicated travel agency software save compared to Excel?</h3>
<p>Most Pakistani teams save 8 to 15 hours weekly across billing, voucher preparation, cash/bank reconciliation, and sending client ledger statements.</p>

<h3>Is switching from Excel to TAMS Pro expensive?</h3>
<p>Not at all. TAMS Pro is PKR 1,999/month, or PKR 9,999/year with a 50% discount exclusively on the yearly plan, paying for itself many times over by preventing just one missed receivable.</p>',
  tags = ARRAY['Excel vs travel agency software', 'travel agency excel sheet', 'travel software Pakistan', 'travel agency automation', 'travel agency ka software', 'travel agent accounting', 'small business tools Pakistan']::TEXT[],
  secondary_keywords = ARRAY['travel agency excel sheet vs software', 'stop using excel travel agency', 'travel agency automation Pakistan']::TEXT[],
  seo_description = 'Comparing Excel vs travel agency software in Pakistan. Discover hidden spreadsheet costs, error risks, and why switching to TAMS Pro pays for itself fast.',
  read_time_minutes = 7,
  faq_items = '[{"question":"Is Excel enough to run a travel agency in Pakistan?","answer":"Excel works for a solo agent doing fewer than 15 simple bookings a month, but once you add staff, partial installments, Umrah vouchers, and multiple vendors, spreadsheets break down and cause costly errors."},{"question":"What are the biggest risks of running a travel agency on Excel?","answer":"Broken formulas, accidental row deletions, lack of multi-user sync, zero PDF voucher generation, no automatic audit trail, and total data loss if a laptop crashes or gets stolen."},{"question":"How much time does dedicated travel agency software save compared to Excel?","answer":"Agencies moving from Excel to TAMS Pro typically save 8 to 15 hours per week across invoicing, payment receipts, party statements, and Umrah voucher formatting."},{"question":"Is switching from Excel to TAMS Pro expensive?","answer":"No. At PKR 1,999/month, or PKR 9,999/year (50% off exclusively on the yearly plan), TAMS Pro costs less than a single forgotten ticket fee adjustment while supporting unlimited growth."}]'::jsonb,
  updated_at = now()
WHERE slug = 'excel-vs-travel-agency-software-pakistan';

UPDATE public.blog_posts
SET
  excerpt = 'Practical playbook to grow your travel agency in Pakistan using digital tools, financial reports, WhatsApp speed, and repeatable Umrah & ticketing systems.',
  content = '<blockquote><p><strong>Quick Takeaways</strong></p><ul><li>Growth stalls when agency owners remain trapped at the counter fixing billing mistakes instead of winning corporate clients and group bookings.</li><li>Replacing manual work with digital systems allows a 3-person agency in Pakistan to comfortably triple its monthly booking capacity.</li><li>Weekly financial reports, fast Umrah &amp; ticket quoting, and consistent follow-up reminders turn one-time buyers into lifelong repeat families.</li><li>TAMS Pro equips ambitious Pakistani agencies with enterprise-grade operational systems at PKR 1,999/month (or PKR 9,999/year with 50% off yearly).</li></ul></blockquote>

<p>Every ambitious travel agency owner in Pakistan hits the same ceiling eventually. When you start, personal hustle drives growth—you know every client by name, negotiate every fare personally, and manage cash out of one notebook. At 40 bookings a month, hustle works. By 150 bookings a month, hustle turns into daily firefighting.</p>

<p>Phones ring nonstop, staff interrupt you every ten minutes to double-check a sub-agent balance, and you spend Sunday evenings reconciling bank statements instead of planning next season''s packages. To <strong>grow your travel agency in Pakistan</strong> profitably past that ceiling, you must shift from hero-based effort to reliable digital systems.</p>

<h2>Why Systems Beat Extra Headcount Every Time</h2>

<p>When workloads spike, many agencies assume the only solution is hiring two more junior clerks. Yet adding people onto broken paper workflows only multiplies confusion. Digital automation removes repetitive friction first so each existing employee accomplishes far more without burnout:</p>

<ul>
  <li><strong>2-minute quotations</strong> instead of 25-minute manual Word formatting</li>
  <li><strong>Instant booking-to-ledger sync</strong> instead of evening diary reconciliation</li>
  <li><strong>Automated payment and passport reminders</strong> instead of relying on memory</li>
  <li><strong>One-click Umrah and hotel vouchers</strong> ready for WhatsApp delivery</li>
</ul>

<h2>4 Digital Growth Levers for Pakistani Travel Agencies</h2>

<h3>1. Win High-Intent WhatsApp Leads With Speed and Trust</h3>

<p>From overseas families in Dubai and London booking parents'' Umrah trips to local corporate travelers in Islamabad, speed wins deals. Implement our <a href="/blogs/create-travel-quotations-in-2-minutes">2-minute travel quotation workflow</a> and use the built-in <strong>Umrah Calculator</strong> inside TAMS Pro—open it from your sidebar, enter today''s SAR-to-PKR rate, add Makkah and Madinah hotels by room sharing (Quad, Triple, or Double) plus visa, transport, and airfare, and push accurate per-person PKR tiers straight into a client quotation—so your agency responds first with clean, itemized options.</p>

<h3>2. Turn Financial Reports Into Weekly Strategy</h3>

<p>Guessing which service makes money keeps agencies stuck in low-margin work. Inside TAMS Pro, review four core reports every week:</p>

<ul>
  <li><strong>Profit by Service &amp; Period:</strong> See whether air tickets, Umrah packages, or visit visas generate your strongest net margin so you can focus marketing spend there.</li>
  <li><strong>Client Aging &amp; Overdue Report:</strong> Collect cash faster to fund peak-season group deposits without borrowing.</li>
  <li><strong>Vendor Comparison &amp; Payables:</strong> Spot which airline consolidators give you the best net rates and reliability.</li>
  <li><strong>Cash &amp; Bank Flow:</strong> Maintain healthy liquidity across HBL, Meezan, and drawer cash every single day.</li>
</ul>

<p>Read our <a href="/blogs/travel-agency-accounting-ledger-pakistan">travel agency accounting and ledger guide</a> to see how clean daily tracking powers these reports automatically.</p>

<h3>3. Build a Repeat-Client Referral Engine</h3>

<p>Acquiring a brand-new customer costs far more than serving an existing client''s next trip. Keep clean client records, set polite reminders for passport renewals, Eid/Ramadan Umrah openings, and summer vacation packages, and deliver flawless <a href="/blogs/invoice-voucher-software-travel-agents">branded PDF invoices and vouchers</a> on every booking. Satisfied families refer relatives across Lahore, Karachi, Rawalpindi, and overseas communities organically.</p>

<h3>4. Empower Staff With Role-Based Sub-User Accounts</h3>

<p>True scale happens when your office runs smoothly even while you travel for supplier meetings or family events. Give counter agents sub-user accounts with clear permissions—creating quotes, logging bookings, issuing vouchers—while keeping sensitive financial controls, audit trails, and master settings protected under your owner login.</p>

<blockquote><p><strong>Scale your travel agency on solid systems:</strong> Explore all TAMS Pro capabilities on our <a href="/features">Features page</a>, compare <a href="/pricing">PKR 1,999/month and PKR 9,999/year (50% off yearly) plans</a>, and <a href="/signup">create your free agency workspace</a>.</p></blockquote>

<h2>Your 4-Week Digital Modernization Checklist</h2>

<p>Follow this straightforward sequence to transform your agency in one month without disrupting live sales:</p>

<ol>
  <li><strong>Week 1:</strong> Set up your agency profile, logo, bank accounts, and active client/vendor opening balances in TAMS Pro.</li>
  <li><strong>Week 2:</strong> Move all new ticket, visa, and Umrah bookings onto digital invoices and payment vouchers.</li>
  <li><strong>Week 3:</strong> Standardize WhatsApp quotation PDFs and enable automated deadline alerts across your desk.</li>
  <li><strong>Week 4:</strong> Hold your first 15-minute weekly review using live profit, receivable aging, and cash reports.</li>
</ol>

<h3>Winning Corporate Accounts and Overseas Pakistani Families</h3>

<p>Once your internal house is clean, use that operational speed to win higher-margin accounts that paper-based competitors cannot serve properly. Textile exporters in Faisalabad, surgical manufacturers in Sialkot, and IT firms in Islamabad routinely look for dependable travel partners who deliver tidy monthly PDF statements, reliable visa deadline tracking, and prompt WhatsApp quotations. Meanwhile, overseas Pakistani families in the UK, UAE, and Saudi Arabia willingly pay fair margins to agencies in Lahore, Jhelum, or Mirpur that send structured Umrah quotes and instant bank receipt vouchers—because digital clarity removes the fear of dealing long-distance.</p>

<p>Pair your operational backbone with consistent visibility: keep an updated Google Business Profile for local "travel agency near me" searches, share helpful Umrah and visa tips in community groups, and respond to inquiries inside ten minutes with branded proposals. Track which marketing channels bring your highest-profit clients—whether WhatsApp referrals, Facebook lead forms, or repeat family departures—so every PKR spent on promotion returns measurable bookings rather than guesswork.</p>

<h3>Preparing Ahead for Peak Travel Seasons</h3>

<p>Pakistani travel runs on predictable waves: Ramadan and Shawwal Umrah surges, summer family holidays to Turkey, Dubai, and Baku, and September student visa intakes. Agencies with clean digital systems review last year''s client database sixty days before each wave opens, send early-bird reminders to past travelers, and lock group seat inventory profitably while disorganized competitors are still scrambling to catch up on old paperwork.</p>

<h3>Measuring What Actually Drives Agency Profit</h3>

<p>Growth is not just booking more tickets—it is keeping more net PKR per booking while reducing chaos. When your agency tracks true margins across airlines, visit visas, and Umrah departures inside one reporting hub, you quickly spot surprising truths: perhaps custom family Umrah packages deliver four times higher hourly profit than razor-thin domestic tickets, or one reliable sub-agent generates 30% of steady cash flow. Acting on real numbers lets you focus staff energy where margins are strongest.</p>

<p>Explore how streamlined visa tracking supports expansion in our guide on <a href="/blogs/track-visa-applications-without-missing-deadlines">tracking visa applications without missing deadlines</a>, read our <a href="/blogs/best-travel-agency-software-pakistan-2026">2026 guide to travel agency software in Pakistan</a>, or compare <a href="/blogs/excel-vs-travel-agency-software-pakistan">Excel vs travel agency software</a>.</p>

<h2>Build an Agency That Runs Smoothly at Any Volume</h2>

<p>Great service wins clients once; great systems keep them coming back for years while protecting every rupee of profit. Join progressive Pakistani agencies moving past paper registers—check <a href="/pricing">TAMS Pro Pricing</a> and <a href="/signup">sign up free today</a>.</p>

<h2>Frequently Asked Questions</h2>

<h3>How can a small travel agency in Pakistan scale without hiring many staff?</h3>
<p>By automating repetitive paperwork like quotations, invoices, vouchers, and client ledger updates in cloud software, allowing a lean team of 2 to 4 agents to process significantly more bookings accurately.</p>

<h3>Which reports should a travel agency owner review every week?</h3>
<p>Track net profit by service type, client receivable aging, supplier payables, cash and bank balances, and upcoming visa or flight deadlines weekly.</p>

<h3>How do digital tools help win overseas Pakistani clients?</h3>
<p>Overseas buyers expect fast WhatsApp PDF quotes, professional invoices, transparent receipt vouchers, and reliable follow-up—standards automated travel software makes effortless.</p>

<h3>How much investment is needed to digitize a travel agency in Pakistan?</h3>
<p>Starting costs PKR 1,999/month, or PKR 9,999/year with 50% off exclusively on the yearly plan with TAMS Pro, requiring zero local servers or IT maintenance.</p>',
  tags = ARRAY['grow travel agency Pakistan', 'digital tools travel agency', 'scale travel business', 'travel agency reports', 'travel agency software Pakistan', 'umrah marketing Pakistan', 'small business growth Pakistan']::TEXT[],
  secondary_keywords = ARRAY['digital tools for travel agencies Pakistan', 'scale travel business Pakistan', 'travel agency reporting system']::TEXT[],
  seo_description = 'Practical playbook to grow your travel agency in Pakistan using digital tools, financial reports, WhatsApp speed, and repeatable Umrah & ticketing systems.',
  read_time_minutes = 7,
  faq_items = '[{"question":"How can a small travel agency in Pakistan scale without hiring many staff?","answer":"Automate repetitive paperwork—quotations, PDF invoices, vouchers, and party ledgers—using cloud software like TAMS Pro so a 2-to-4 person team handles triple the booking volume cleanly."},{"question":"Which reports should a travel agency owner review every week?","answer":"Monitor net profit by service type, client receivable aging, vendor payables, cash and bank balances, and top-performing routes or Umrah packages."},{"question":"How do digital tools help win overseas Pakistani clients?","answer":"Overseas buyers expect quick digital quotes, clean branded invoices, clear payment receipts, and responsive WhatsApp communication—all built into modern agency systems."},{"question":"How much investment is needed to digitize a travel agency in Pakistan?","answer":"You only need an internet connection and cloud software like TAMS Pro at PKR 1,999/month, or PKR 9,999/year (50% off on the yearly plan), with zero server hardware or IT overhead."}]'::jsonb,
  updated_at = now()
WHERE slug = 'grow-travel-agency-pakistan-digital-tools';

-- ------------------------------------------------------------------------------
-- 3. SYSTEM EMAIL LOGS TABLE (Task 4A — Admin-only System Email history)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  email_category TEXT NOT NULL DEFAULT 'admin_message'
    CHECK (email_category IN ('test', 'welcome', 'announcement', 'admin_message')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_email_logs_created_at
  ON public.system_email_logs (created_at DESC);

ALTER TABLE public.system_email_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.system_email_logs FROM PUBLIC, anon;
GRANT SELECT ON public.system_email_logs TO authenticated;

DROP POLICY IF EXISTS "system_email_logs_super_admin_select" ON public.system_email_logs;
CREATE POLICY "system_email_logs_super_admin_select"
  ON public.system_email_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

-- ------------------------------------------------------------------------------
-- 4. AGENCY EMAIL SETTINGS TABLE (Task 4B — Encrypted per-agency Gmail credentials)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_email_settings (
  agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL CHECK (lower(btrim(gmail_address)) <> 'tamspro12@gmail.com'),
  encrypted_app_password TEXT NOT NULL,
  masked_hint TEXT NOT NULL DEFAULT '•••• •••• •••• ••••',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_email_settings ENABLE ROW LEVEL SECURITY;

-- Strict column-level protection: encrypted_app_password can NEVER be read by anon/authenticated
REVOKE ALL ON public.agency_email_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT (agency_id, gmail_address, masked_hint, updated_by, updated_at)
  ON public.agency_email_settings TO authenticated;

DROP POLICY IF EXISTS "agency_email_settings_select_own_agency" ON public.agency_email_settings;
CREATE POLICY "agency_email_settings_select_own_agency"
  ON public.agency_email_settings
  FOR SELECT
  TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- Revoke legacy plaintext password reader from authenticated users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_agency_smtp_password'
  ) THEN
    REVOKE ALL ON FUNCTION public.get_agency_smtp_password() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- Internal server-side key resolver (reads Vault secret 'agency_email_encryption_key' if present,
-- otherwise derives an instance-bound key never accessible to client roles)
CREATE OR REPLACE FUNCTION public._internal_agency_email_key(p_agency_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_vault_secret TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'
  ) THEN
    EXECUTE $q$
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'agency_email_encryption_key'
      LIMIT 1
    $q$ INTO v_vault_secret;
  END IF;

  RETURN coalesce(nullif(v_vault_secret, ''), 'tams-pg-vault-v1:' || current_database())
    || ':' || p_agency_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public._internal_agency_email_key(UUID) FROM PUBLIC, anon, authenticated;

-- Service-role-only decrypt helper for Edge Function when row was saved via SQL RPC
CREATE OR REPLACE FUNCTION public.service_decrypt_agency_email_password(p_agency_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cipher TEXT;
  v_key TEXT;
BEGIN
  SELECT encrypted_app_password
  INTO v_cipher
  FROM public.agency_email_settings
  WHERE agency_id = p_agency_id;

  IF v_cipher IS NULL OR v_cipher = '' THEN
    RETURN NULL;
  END IF;

  IF v_cipher LIKE 'pgp:%' THEN
    v_key := public._internal_agency_email_key(p_agency_id);
    RETURN pgp_sym_decrypt(decode(substr(v_cipher, 5), 'base64'), v_key);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.service_decrypt_agency_email_password(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_decrypt_agency_email_password(UUID) TO service_role;

-- Owner-only encrypted save RPC (never returns password)
CREATE OR REPLACE FUNCTION public.save_agency_email_credentials(
  p_gmail_address TEXT,
  p_app_password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_agency_id UUID := public.current_user_agency_id();
  v_clean_email TEXT := lower(btrim(coalesce(p_gmail_address, '')));
  v_clean_pwd TEXT := regexp_replace(coalesce(p_app_password, ''), '\s+', '', 'g');
  v_existing_cipher TEXT;
  v_cipher TEXT;
BEGIN
  IF v_uid IS NULL OR v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_sub_user(v_uid) THEN
    RAISE EXCEPTION 'Only the agency owner can update Gmail credentials';
  END IF;

  IF v_clean_email = '' OR v_clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Please enter a valid Gmail address';
  END IF;

  IF v_clean_email = 'tamspro12@gmail.com' THEN
    RAISE EXCEPTION 'Please enter your agency own Gmail address';
  END IF;

  SELECT encrypted_app_password
  INTO v_existing_cipher
  FROM public.agency_email_settings
  WHERE agency_id = v_agency_id;

  IF v_clean_pwd = '' AND (v_existing_cipher IS NULL OR v_existing_cipher = '') THEN
    RAISE EXCEPTION 'Please enter your 16-character Gmail App Password';
  END IF;

  IF v_clean_pwd <> '' THEN
    IF v_clean_pwd !~ '^[A-Za-z0-9]{16}$' THEN
      RAISE EXCEPTION 'Gmail App Password must be 16 letters/numbers';
    END IF;
    v_cipher := 'pgp:' || encode(
      pgp_sym_encrypt(v_clean_pwd, public._internal_agency_email_key(v_agency_id)),
      'base64'
    );
  ELSE
    v_cipher := v_existing_cipher;
  END IF;

  INSERT INTO public.agency_email_settings (
    agency_id,
    gmail_address,
    encrypted_app_password,
    masked_hint,
    updated_by,
    updated_at
  )
  VALUES (
    v_agency_id,
    v_clean_email,
    v_cipher,
    '•••• •••• •••• ••••',
    v_uid,
    now()
  )
  ON CONFLICT (agency_id) DO UPDATE
  SET
    gmail_address = EXCLUDED.gmail_address,
    encrypted_app_password = EXCLUDED.encrypted_app_password,
    masked_hint = EXCLUDED.masked_hint,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  UPDATE public.agencies
  SET email = v_clean_email,
      email_password = NULL
  WHERE id = v_agency_id;

  RETURN jsonb_build_object(
    'connected', true,
    'gmailAddress', v_clean_email,
    'maskedPassword', '•••• •••• •••• ••••'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_agency_email_credentials(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_agency_email_credentials(TEXT, TEXT) TO authenticated;

-- Masked status RPC for the logged-in agency (never returns plaintext or ciphertext)
CREATE OR REPLACE FUNCTION public.get_my_agency_email_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.current_user_agency_id();
  v_gmail TEXT;
  v_masked TEXT;
  v_updated TIMESTAMPTZ;
  v_legacy_email TEXT;
  v_legacy_has_pwd BOOLEAN := false;
BEGIN
  IF v_agency_id IS NULL THEN
    RETURN jsonb_build_object('connected', false, 'gmailAddress', '', 'maskedPassword', '');
  END IF;

  SELECT gmail_address, masked_hint, updated_at
  INTO v_gmail, v_masked, v_updated
  FROM public.agency_email_settings
  WHERE agency_id = v_agency_id
    AND encrypted_app_password IS NOT NULL
    AND encrypted_app_password <> '';

  IF v_gmail IS NOT NULL AND v_gmail <> '' THEN
    RETURN jsonb_build_object(
      'connected', true,
      'gmailAddress', v_gmail,
      'maskedPassword', coalesce(v_masked, '•••• •••• •••• ••••'),
      'updatedAt', v_updated
    );
  END IF;

  SELECT btrim(coalesce(email, '')), (email_password IS NOT NULL AND email_password <> '')
  INTO v_legacy_email, v_legacy_has_pwd
  FROM public.agencies
  WHERE id = v_agency_id;

  IF v_legacy_has_pwd AND v_legacy_email <> '' AND lower(v_legacy_email) <> 'tamspro12@gmail.com' THEN
    RETURN jsonb_build_object(
      'connected', true,
      'gmailAddress', v_legacy_email,
      'maskedPassword', '•••• •••• •••• ••••',
      'updatedAt', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'connected', false,
    'gmailAddress', CASE WHEN lower(coalesce(v_legacy_email, '')) = 'tamspro12@gmail.com' THEN '' ELSE coalesce(v_legacy_email, '') END,
    'maskedPassword', ''
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_agency_email_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_agency_email_status() TO authenticated;

-- Update agency_smtp_configured() so both encrypted agency_email_settings and legacy rows work seamlessly
CREATE OR REPLACE FUNCTION public.agency_smtp_configured()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT EXISTS (
      SELECT 1
      FROM public.agency_email_settings s
      WHERE s.agency_id = public.current_user_agency_id()
        AND s.gmail_address IS NOT NULL
        AND s.gmail_address <> ''
        AND lower(btrim(s.gmail_address)) <> 'tamspro12@gmail.com'
        AND s.encrypted_app_password IS NOT NULL
        AND s.encrypted_app_password <> ''
    )
    OR EXISTS (
      SELECT 1
      FROM public.agencies a
      WHERE a.id = public.current_user_agency_id()
        AND a.email IS NOT NULL
        AND btrim(a.email) <> ''
        AND lower(btrim(a.email)) <> 'tamspro12@gmail.com'
        AND a.email_password IS NOT NULL
        AND a.email_password <> ''
    )
  ), false);
$$;

REVOKE ALL ON FUNCTION public.agency_smtp_configured() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_smtp_configured() TO authenticated;

COMMIT;
