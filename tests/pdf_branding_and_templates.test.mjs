import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const {
  loadAgencyBrandingCore,
  resolveAgencyBrandingFromRecords,
} = await import("../src/lib/pdf/agencyBrandingCore.ts");
const { resolveAirlineBrand, AIRLINE_LOGO_MAP } = await import(
  "../src/lib/pdf/airlineLogos.ts"
);
const {
  buildBookingConfirmationPdfDoc,
  buildBookingInvoicePdfDoc,
  buildBookingPdfDataFromInvoice,
  extractFlightLegs,
} = await import("../src/lib/pdf/bookingInvoicePdf.ts");
const { generateInvoicePDF } = await import("../src/lib/invoiceGenerator.ts");
const { buildQuotationPdf } = await import("../src/lib/quotationPdf.ts");
const { buildVoucherReceiptPdfDoc } = await import("../src/lib/pdf/voucherReceiptPdf.ts");
const { generateVoucherPdf } = await import("../src/lib/voucherPdfGenerator.ts");
const { generateBookingConfirmationPDF } = await import(
  "../src/lib/bookingPdfGenerator.ts"
);
const {
  generateAccountStatementPdf,
  generateBookingReportPdf,
  generateDailyReportPdf,
  generateFinancialReportsPdf,
} = await import("../src/lib/reportPdfGenerator.ts");
const { brandingToReportAgencyInfo } = await import("../src/lib/pdf/agencyBranding.ts");

function extractPdfText(doc) {
  const raw = doc.output();
  const matches = [];
  const regex = /\(((?:\\.|[^\\()])*)\)\s*Tj/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    matches.push(
      m[1]
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
    );
  }
  const tjArrayRegex = /\[((?:[^\[\]]|\((?:\\.|[^\\()])*\))*)\]\s*TJ/g;
  let arrMatch;
  while ((arrMatch = tjArrayRegex.exec(raw)) !== null) {
    const inner = arrMatch[1];
    const litRegex = /\(((?:\\.|[^\\()])*)\)/g;
    let lit;
    const parts = [];
    while ((lit = litRegex.exec(inner)) !== null) {
      parts.push(
        lit[1]
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\")
      );
    }
    if (parts.length) matches.push(parts.join(""));
  }
  return matches.join("\n");
}

function assertNoTamsProBranding(pdfText, label) {
  assert.equal(
    /tams\s*pro/i.test(pdfText),
    false,
    `${label} must not contain any hardcoded TAMS Pro branding`
  );
}

const AGENCY_A_BRANDING = {
  agencyId: "11111111-1111-1111-1111-111111111111",
  agencyName: "Al-Noor Travels",
  logo: null,
  email: "sales@alnoor.pk",
  phone: "+92 300 1112233",
  address: "Suite 4, Blue Area, Islamabad",
  brandColor: "#0f766e",
};

const AGENCY_B_BRANDING = {
  agencyId: "22222222-2222-2222-2222-222222222222",
  agencyName: "Skyline Wings",
  logo: null,
  email: "desk@skylinewings.com",
  phone: "+92 321 9998877",
  address: "Clifton Block 2, Karachi",
  brandColor: "#7c2d12",
};

test("Agency branding resolves strictly per agency_id and never leaks or falls back to personal/signup contact fields", async () => {
  const dbRowsByAgency = {
    "agency-a": {
      templates: [
        {
          key: "invoice_template",
          updated_at: "2026-11-20T10:00:00Z",
          value: {
            agencyName: "Al-Noor Travels",
            email: "sales@alnoor.pk",
            phone: "+92 300 1112233",
            address: "Suite 4, Blue Area, Islamabad",
            themeColor: "#0f766e",
          },
        },
      ],
      agency: { id: "agency-a", name: "Signup Name A" },
    },
    "agency-b": {
      templates: [
        {
          key: "invoice_template",
          updated_at: "2026-11-18T10:00:00Z",
          value: {
            agencyName: "Old Skyline",
            email: "old@skyline.pk",
            phone: "000",
            address: "Old Address",
            themeColor: "#111111",
          },
        },
        {
          key: "booking_template",
          updated_at: "2026-11-21T10:00:00Z",
          value: {
            agencyName: "Skyline Wings",
            email: "desk@skylinewings.com",
            phone: "+92 321 9998877",
            address: "Clifton Block 2, Karachi",
            themeColor: "#7c2d12",
          },
        },
      ],
      agency: { id: "agency-b", name: "Signup Name B" },
    },
    "agency-c": {
      templates: [],
      agency: {
        id: "agency-c",
        name: "Safar Express",
        email: "personal.signup@gmail.com",
        phone_number: "+92 333 0000000",
      },
    },
  };

  function makeClient(expectedAgency) {
    return {
      from(table) {
        let eqAgency = null;
        return {
          select() {
            return this;
          },
          eq(col, val) {
            if (col === "agency_id" || col === "id") eqAgency = val;
            return this;
          },
          in() {
            assert.equal(table, "agency_templates");
            assert.equal(eqAgency, expectedAgency);
            return Promise.resolve({
              data: dbRowsByAgency[eqAgency]?.templates || [],
              error: null,
            });
          },
          maybeSingle() {
            assert.equal(table, "agencies");
            assert.equal(eqAgency, expectedAgency);
            return Promise.resolve({
              data: dbRowsByAgency[eqAgency]?.agency || null,
              error: null,
            });
          },
        };
      },
    };
  }

  const resA = await loadAgencyBrandingCore({
    client: makeClient("agency-a"),
    agencyId: "agency-a",
  });
  assert.equal(resA.agencyName, "Al-Noor Travels");
  assert.equal(resA.email, "sales@alnoor.pk");
  assert.equal(resA.phone, "+92 300 1112233");
  assert.equal(resA.address, "Suite 4, Blue Area, Islamabad");
  assert.equal(resA.brandColor, "#0f766e");

  const resB = await loadAgencyBrandingCore({
    client: makeClient("agency-b"),
    agencyId: "agency-b",
  });
  assert.equal(resB.agencyName, "Skyline Wings");
  assert.equal(resB.email, "desk@skylinewings.com");
  assert.equal(resB.phone, "+92 321 9998877");
  assert.equal(resB.address, "Clifton Block 2, Karachi");
  assert.equal(resB.brandColor, "#7c2d12");

  // Agency with empty Branding settings falls back to signup agency name ONLY;
  // email/phone/address stay strictly empty (never signup personal email/phone).
  const resC = await loadAgencyBrandingCore({
    client: makeClient("agency-c"),
    agencyId: "agency-c",
  });
  assert.equal(resC.agencyName, "Safar Express");
  assert.equal(resC.email, "");
  assert.equal(resC.phone, "");
  assert.equal(resC.address, "");

  const empty = resolveAgencyBrandingFromRecords({});
  assert.equal(empty.agencyName, "Travel Agency");
  assert.equal(/tams\s*pro/i.test(empty.agencyName), false);
});

test("Airline logo map resolves Pakistani, Gulf, and international carriers safely", () => {
  assert.ok(AIRLINE_LOGO_MAP.length >= 25);
  assert.equal(resolveAirlineBrand("PIA")?.code, "PK");
  assert.equal(resolveAirlineBrand(null, "PK-304")?.code, "PK");
  assert.equal(resolveAirlineBrand("Pakistan International Airlines")?.code, "PK");
  assert.equal(resolveAirlineBrand("Emirates")?.code, "EK");
  assert.equal(resolveAirlineBrand("Saudia")?.code, "SV");
  assert.equal(resolveAirlineBrand("Fly Jinnah")?.code, "9P");
  assert.equal(resolveAirlineBrand("Pegasus Airlines"), null);
  assert.equal(resolveAirlineBrand(""), null);
});

test("Invoice PDF removes Payment Terms & Conditions completely and uses agency branding", async () => {
  const docA = buildBookingInvoicePdfDoc({
    invoiceNo: "INV-2026-0042",
    invoiceDate: "2026-11-23",
    service: "Ticket",
    clientName: "Usman Tariq",
    pnr: "XY9876",
    clientAmount: 150000,
    paidAmount: 100000,
    balanceDue: 50000,
    currency: "PKR",
    branding: AGENCY_A_BRANDING,
  });
  const textA = extractPdfText(docA);

  assertNoTamsProBranding(textA, "Booking Invoice PDF");
  assert.match(textA, /Al-Noor Travels/);
  assert.match(textA, /sales@alnoor\.pk/);
  assert.match(textA, /\+92 300 1112233/);
  assert.match(textA, /Suite 4, Blue Area, Islamabad/);
  assert.match(textA, /INV-2026-0042/);
  assert.match(textA, /Balance Due:/);
  assert.equal(/Payment Terms/i.test(textA), false);
  assert.equal(/Terms\s*&\s*Conditions/i.test(textA), false);
  assert.equal(/airline\/supplier cancellation/i.test(textA), false);
  assert.equal(/Computer generated invoice/i.test(textA), false);

  const legacyInv = await generateInvoicePDF(
    {
      id: "abcd1234",
      name: "Bilal Ahmed",
      selling_price: 80000,
      amount_paid: 30000,
      travel_type: "Ticket",
    },
    { id: AGENCY_B_BRANDING.agencyId, name: "Fallback Name" },
    AGENCY_B_BRANDING
  );
  const textB = extractPdfText(legacyInv.doc);
  assertNoTamsProBranding(textB, "Legacy Invoice PDF");
  assert.match(textB, /Skyline Wings/);
  assert.match(textB, /desk@skylinewings\.com/);
  assert.equal(/Payment Terms/i.test(textB), false);
});

test("Booking Confirmation PDF (Return, Group 6 pax & Group 25 pax) matches PIA e-ticket design and isolates agency branding", () => {
  const pax6 = Array.from({ length: 6 }, (_, i) => ({
    name: `Passenger ${i + 1} Khan`,
    passport: `AB100${i + 1}`,
    meal: i === 0 ? "Muslim Meal" : "",
    baggage: "30 KG",
    status: "Confirmed",
  }));

  const docA = buildBookingConfirmationPdfDoc({
    invoiceNo: "INV-2026-0100",
    invoiceDate: "2026-11-23",
    service: "Ticket",
    clientName: "Tariq Mahmood",
    clientPhone: "0300-5551234",
    pnr: "PKR786",
    ticketNo: "214-9876543210",
    passengers: pax6,
    moreDetails: {
      trip_type: "Return",
      origin: "KHI",
      destination: "DXB",
      flight_date: "2026-12-01",
      flight_time: "09:30",
      return_date: "2026-12-10",
      return_time: "22:15",
      airline: "PIA",
      flight_number: "PK-213",
    },
    clientAmount: 450000,
    paidAmount: 450000,
    balanceDue: 0,
    branding: AGENCY_A_BRANDING,
  });

  const textA = extractPdfText(docA);
  assertNoTamsProBranding(textA, "Booking Confirmation Agency A");
  assert.match(textA, /ELECTRONIC TICKET/);
  assert.match(textA, /PNR:\s*PKR786/);
  assert.match(textA, /AL-NOOR TRAVELS/);
  assert.match(textA, /TRAVELER \/ CONTACT/);
  assert.match(textA, /Tariq Mahmood/);
  assert.match(textA, /BOOKING REFERENCE/);
  assert.match(textA, /ISSUE DATE/);
  assert.match(textA, /SERVICE TYPE/);

  // Forbidden legacy info box items & terms must not appear
  assert.equal(/Invoice #/i.test(textA), false);
  assert.equal(/Booking Code/i.test(textA), false);
  assert.equal(/Ticketed At/i.test(textA), false);
  assert.equal(/Terms\s*&\s*Conditions/i.test(textA), false);
  assert.equal(/0300-5551234/.test(textA), false);

  // Passenger table columns & return flight blocks
  assert.match(textA, /Sr #/);
  assert.match(textA, /Passenger Name/);
  assert.match(textA, /Passport/);
  assert.match(textA, /Meal/);
  assert.match(textA, /Baggage/);
  assert.match(textA, /Status/);
  assert.match(textA, /Flight - 1\s+KHI TO DXB/);
  assert.match(textA, /Flight - 2\s+DXB TO KHI/);
  assert.match(textA, /Thank you for choosing Al-Noor Travels\. Have a safe journey!/);
  assert.match(textA, /sales@alnoor\.pk/);
  assert.equal(/Skyline Wings/i.test(textA), false);

  // 25 passengers -> auto page-break with repeated header
  const pax25 = Array.from({ length: 25 }, (_, i) => ({
    name: `Group Traveler ${i + 1}`,
    passport: `PP${1000 + i}`,
  }));
  const docGroup25 = buildBookingConfirmationPdfDoc({
    invoiceNo: "INV-2026-0200",
    invoiceDate: "2026-11-23",
    service: "Ticket",
    clientName: "Group Leader",
    pnr: "GRP999",
    passengers: pax25,
    moreDetails: {
      trip_type: "One Way",
      origin: "LHE",
      destination: "JED",
      flight_date: "2026-12-05",
      flight_time: "04:00",
      airline: "Saudia",
    },
    clientAmount: 2500000,
    paidAmount: 2500000,
    balanceDue: 0,
    branding: AGENCY_B_BRANDING,
  });
  assert.ok(docGroup25.getNumberOfPages() >= 2, "25 passengers must span multiple pages");
  const groupText = extractPdfText(docGroup25);
  assertNoTamsProBranding(groupText, "Group 25 Booking Confirmation");
  assert.match(groupText, /SKYLINE WINGS/);
  assert.match(groupText, /Thank you for choosing Skyline Wings\. Have a safe journey!/);
  assert.equal(/Al-Noor Travels/i.test(groupText), false);
  // Empty columns Meal & Baggage hidden when no passenger has them
  assert.equal(/\nMeal\n/.test(groupText), false);
  assert.equal(/\nBaggage\n/.test(groupText), false);
  // Repeated table header on page 2+
  const headerMatches = groupText.match(/Passenger Name/g) || [];
  assert.ok(headerMatches.length >= 2, "Passenger table header must repeat on page 2+");
  // One-way has Flight - 1 and no Flight - 2
  assert.match(groupText, /Flight - 1\s+LHE TO JED/);
  assert.equal(/Flight - 2/.test(groupText), false);
});

test("Booking Confirmation PDF handles Multi-City flights and unknown airline fallback cleanly", () => {
  const multiLegs = extractFlightLegs({
    invoiceNo: "INV-MULTI-1",
    invoiceDate: "2026-11-23",
    service: "Ticket",
    clientName: "Zainab Ali",
    pnr: "MLT456",
    moreDetails: {
      trip_type: "Multicity",
      origin: "KHI",
      destination: "DXB",
      multicity_legs: [
        { from: "KHI", to: "IST", date: "2026-12-01", time: "06:00", airline: "Mahan Air", pnr: "LEG1" },
        { from: "IST", to: "LHR", date: "2026-12-04", time: "14:20", airline: "Turkish Airlines", pnr: "LEG2" },
        { from: "LHR", to: "KHI", date: "2026-12-12", time: "21:10", airline: "British Airways", pnr: "LEG3" },
      ],
    },
    clientAmount: 300000,
    paidAmount: 300000,
    balanceDue: 0,
  });
  assert.equal(multiLegs.length, 3);
  assert.equal(multiLegs[0].origin, "KHI");
  assert.equal(multiLegs[0].destination, "IST");

  const doc = buildBookingConfirmationPdfDoc({
    invoiceNo: "INV-MULTI-1",
    invoiceDate: "2026-11-23",
    service: "Ticket",
    clientName: "Zainab Ali",
    pnr: "MLT456",
    moreDetails: {
      trip_type: "Multicity",
      multicity_legs: [
        { from: "KHI", to: "IST", date: "2026-12-01", time: "06:00", airline: "Mahan Air", pnr: "LEG1" },
        { from: "IST", to: "LHR", date: "2026-12-04", time: "14:20", airline: "Turkish Airlines", pnr: "LEG2" },
        { from: "LHR", to: "KHI", date: "2026-12-12", time: "21:10", airline: "British Airways", pnr: "LEG3" },
      ],
    },
    clientAmount: 300000,
    paidAmount: 300000,
    balanceDue: 0,
    branding: AGENCY_A_BRANDING,
  });
  const text = extractPdfText(doc);
  assert.match(text, /MAHAN AIR/);
  assert.match(text, /Flight - 1\s+KHI TO IST/);
  assert.match(text, /Flight - 2\s+IST TO LHR/);
  assert.match(text, /Flight - 3\s+LHR TO KHI/);
});

test("Booking Confirmation PDF renders service-specific sections for Umrah, Insurance, Hotel, Visa, and Other without empty dash rows", () => {
  // 1. Umrah with flights
  const umrahDoc = buildBookingConfirmationPdfDoc(
    buildBookingPdfDataFromInvoice(
      {
        invoice_no: "INV-UMR-1",
        invoice_date: "2026-11-23",
        service: "Umrah",
        client_name: "Haji Akram",
        pnr: "UMR111",
        passengers: [{ name: "Haji Akram", passport: "PA112233" }],
        more_details: {
          package_name: "14 Nights Economy Umrah",
          makkah_hotel: "Swissotel Makkah",
          makkah_nights: "7",
          madinah_hotel: "Anwar Al Madinah",
          madinah_nights: "7",
          umrah_transport: "Haramain High-Speed Train",
          ziyarat_included: true,
          umrah_departure_city: "Karachi",
          umrah_arrival_city: "Jeddah",
          umrah_airline: "Saudia",
          umrah_flight_date: "2026-12-10",
          umrah_return_date: "2026-12-24",
        },
      },
      AGENCY_A_BRANDING
    )
  );
  const umrahText = extractPdfText(umrahDoc);
  assert.match(umrahText, /UMRAH BOOKING/);
  assert.match(umrahText, /Swissotel Makkah \(7 Nights\)/);
  assert.match(umrahText, /Anwar Al Madinah \(7 Nights\)/);
  assert.match(umrahText, /Haramain High-Speed Train/);
  assert.match(umrahText, /Flight - 1\s+KARACHI TO JEDDAH/);
  assert.match(umrahText, /Flight - 2\s+JEDDAH TO KARACHI/);

  // 2. Travel Insurance
  const insDoc = buildBookingConfirmationPdfDoc(
    buildBookingPdfDataFromInvoice(
      {
        invoice_no: "INV-INS-1",
        invoice_date: "2026-11-23",
        service: "Insurance",
        client_name: "Sana Mirza",
        ticket_no: "POL-998877",
        more_details: {
          insurance_plan: "EFU Schengen Gold",
          insurance_duration: "45",
        },
      },
      AGENCY_A_BRANDING
    )
  );
  const insText = extractPdfText(insDoc);
  assert.match(insText, /TRAVEL INSURANCE/);
  assert.match(insText, /EFU Schengen Gold/);
  assert.match(insText, /45 Days/);
  assert.match(insText, /POL-998877/);

  // 3. Hotel Booking
  const hotelDoc = buildBookingConfirmationPdfDoc(
    buildBookingPdfDataFromInvoice(
      {
        invoice_no: "INV-HTL-1",
        invoice_date: "2026-11-23",
        service: "Hotel",
        client_name: "Faisal Raza",
        passengers: [{ name: "Faisal Raza" }, { name: "Ayesha Raza" }],
        more_details: {
          hotel_name: "Atlantis The Palm",
          hotel_city: "Dubai",
          hotel_check_in: "2026-12-15",
          hotel_check_out: "2026-12-20",
          hotel_room_type: "Deluxe Ocean King",
        },
      },
      AGENCY_B_BRANDING
    )
  );
  const hotelText = extractPdfText(hotelDoc);
  assert.match(hotelText, /HOTEL BOOKING/);
  assert.match(hotelText, /Atlantis The Palm/);
  assert.match(hotelText, /Dubai/);
  assert.match(hotelText, /5 Nights/);
  assert.match(hotelText, /Deluxe Ocean King/);
  assert.match(hotelText, /2 Guests/);

  // 4. Visa
  const visaDoc = buildBookingConfirmationPdfDoc(
    buildBookingPdfDataFromInvoice(
      {
        invoice_no: "INV-VIS-1",
        invoice_date: "2026-11-23",
        service: "Visa",
        client_name: "Kamran Siddiqui",
        more_details: {
          visa_country: "United Arab Emirates",
          visa_type: "60 Days Tourist",
          visa_validity: "60 Days",
        },
      },
      AGENCY_A_BRANDING
    )
  );
  const visaText = extractPdfText(visaDoc);
  assert.match(visaText, /VISA BOOKING/);
  assert.match(visaText, /United Arab Emirates/);
  assert.match(visaText, /60 Days Tourist/);
  assert.match(visaText, /Confirmed/);

  // 5. Other service
  const otherDoc = buildBookingConfirmationPdfDoc(
    buildBookingPdfDataFromInvoice(
      {
        invoice_no: "INV-OTH-1",
        invoice_date: "2026-11-23",
        service: "Other",
        client_name: "Nadia Hussain",
        more_details: {
          general_description: "VIP Airport Meet & Assist",
          location: "Jeddah Terminal 1",
        },
      },
      AGENCY_A_BRANDING
    )
  );
  const otherText = extractPdfText(otherDoc);
  assert.match(otherText, /BOOKING CONFIRMATION/);
  assert.match(otherText, /VIP Airport Meet & Assist/);
  assert.match(otherText, /Jeddah Terminal 1/);
  assert.equal(resolveAirlineBrand("Caspian Regional Air", "CR-101"), null);
});

test("Quotation PDF applies agency branding and hides Terms & Conditions unless user typed them", () => {
  const baseQuotation = {
    id: "q-1",
    agency_id: AGENCY_A_BRANDING.agencyId,
    quotation_number: "QT-2026-009",
    quotation_date: "2026-11-23",
    valid_until: "2026-12-07",
    service_type: "Umrah",
    client_name: "Imran Malik",
    client_email: null,
    client_phone: "0300-4445566",
    client_id: null,
    agent_id: null,
    title: "Umrah Package — 14 Nights",
    description: "Karachi to Jeddah return with Makkah & Madinah hotels",
    items: [{ description: "Umrah Full Package", qty: 2, unit_price: 220000, amount: 440000 }],
    subtotal: 440000,
    discount: 0,
    tax: 0,
    total: 440000,
    currency: "PKR",
    status: "sent",
    notes: "Prices subject to hotel availability.",
    terms: null,
    source: "web-app",
    source_ref: null,
    created_by: null,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
  };

  const docNoTerms = buildQuotationPdf(baseQuotation, { branding: AGENCY_A_BRANDING });
  const textNoTerms = extractPdfText(docNoTerms);
  assertNoTamsProBranding(textNoTerms, "Quotation without terms");
  assert.match(textNoTerms, /Al-Noor Travels/);
  assert.match(textNoTerms, /sales@alnoor\.pk/);
  assert.equal(/Terms\s*&\s*Conditions/i.test(textNoTerms), false);

  const docWithTerms = buildQuotationPdf(
    { ...baseQuotation, terms: "50% non-refundable advance upon booking." },
    { branding: AGENCY_B_BRANDING }
  );
  const textWithTerms = extractPdfText(docWithTerms);
  assertNoTamsProBranding(textWithTerms, "Quotation with user terms");
  assert.match(textWithTerms, /Skyline Wings/);
  assert.match(textWithTerms, /TERMS & CONDITIONS/);
  assert.match(textWithTerms, /50% non-refundable advance upon booking\./);
});

test("Voucher and Financial Report PDFs use agency branding with zero TAMS Pro leaks", async () => {
  const crvDoc = buildVoucherReceiptPdfDoc({
    voucherNo: "CRV-2026-001",
    voucherDate: "2026-11-23",
    direction: "received",
    paymentMode: "bank",
    partyName: "Tariq Mahmood",
    amount: 75000,
    accountName: "HBL Main",
    branding: AGENCY_A_BRANDING,
  });
  const crvText = extractPdfText(crvDoc);
  assertNoTamsProBranding(crvText, "Payment Voucher PDF");
  assert.match(crvText, /Al-Noor Travels/);

  const stmtDoc = generateAccountStatementPdf({
    agency: brandingToReportAgencyInfo(AGENCY_B_BRANDING),
    periodText: "01 Nov 2026 to 23 Nov 2026",
    fromIso: "2026-11-01",
    toIso: "2026-11-23",
    rows: [
      {
        date: "2026-11-10",
        voucher_no: "INV-1",
        particulars: "Air Ticket",
        entry_type: "Sale",
        debit: 100000,
        credit: 0,
        balance: 100000,
      },
    ],
    selectedParties: [{ id: "p1", name: "Ahmed Traders", opening_balance: 0 }],
  });
  const stmtText = extractPdfText(stmtDoc);
  assertNoTamsProBranding(stmtText, "Account Statement PDF");
  assert.match(stmtText, /SKYLINE WINGS/);

  const bkgRep = generateBookingReportPdf({
    agency: brandingToReportAgencyInfo(AGENCY_A_BRANDING),
    periodText: "Nov 2026",
    rows: [
      {
        invoice_no: "INV-1",
        invoice_date: "2026-11-10",
        client_name: "Usman",
        service: "Ticket",
        client_amount: 100000,
        vendor_payable: 85000,
        profit: 15000,
        status: "paid",
      },
    ],
    includeProfit: true,
  });
  assertNoTamsProBranding(extractPdfText(bkgRep), "Booking Report PDF");

  const dailyRep = generateDailyReportPdf({
    agency: brandingToReportAgencyInfo(AGENCY_A_BRANDING),
    periodText: "23 Nov 2026",
    receipts: [],
    payments: [],
  });
  assertNoTamsProBranding(extractPdfText(dailyRep), "Daily Report PDF");

  const finRep = generateFinancialReportsPdf({
    agency: brandingToReportAgencyInfo(AGENCY_A_BRANDING),
    periodText: "Nov 2026",
    subReport: "pnl",
    pnlData: {
      grossRevenue: 100000,
      costOfSales: 80000,
      grossProfit: 20000,
      operatingExpenses: 5000,
      refunds: 0,
      netCleanProfit: 15000,
      expenseBreakdown: [],
    },
  });
  assertNoTamsProBranding(extractPdfText(finRep), "Financial Report PDF");

  // Service voucher PDF checks (Umrah + Ticket without terms/N/A leaks)
  const umrahVoucherDoc = generateVoucherPdf(
    {
      id: "v-1",
      agency_id: AGENCY_A_BRANDING.agencyId,
      voucher_number: "VCH-UMR-101",
      voucher_type: "Umrah",
      status: "Confirmed",
      issue_date: "2026-11-23",
      passenger_name: "Tariq Mahmood",
      passenger_passport: "P998877",
      package_name: "14 Nights Economy Umrah",
      makkah_hotel: "Swissotel Makkah",
      makkah_nights: 7,
      madinah_hotel: "Pullman Zamzam",
      madinah_nights: 7,
      transport_details: "VIP GMC",
      visa_status: "Approved",
      created_at: "2026-11-23T00:00:00Z",
    },
    { branding: AGENCY_A_BRANDING }
  );
  const umrahVoucherText = extractPdfText(umrahVoucherDoc);
  assertNoTamsProBranding(umrahVoucherText, "Umrah Service Voucher PDF");
  assert.match(umrahVoucherText, /Al-Noor Travels/);
  assert.match(umrahVoucherText, /Swissotel Makkah/);
  assert.equal(/TERMS\s*&\s*CONDITIONS/i.test(umrahVoucherText), false);

  // Legacy bookingPdfGenerator path delegates cleanly to PIA-style booking PDF
  const legacyRes = await generateBookingConfirmationPDF(
    {
      id: "client-legacy-1",
      name: "Bilal Ahmed",
      travel_type: "Ticket (PK-304)",
      destination: "KHI to DXB",
      flight_date: "2026-12-05",
      airline: "PIA",
      pnr: "LEG778",
      ticket_price: 92000,
      amount_paid: 92000,
      payment_status: "paid",
      passengers: [
        { name: "Bilal Ahmed", passport_number: "P551122", meal: "AVML", baggage: "30kg", status: "HK" },
      ],
    },
    null,
    AGENCY_B_BRANDING
  );
  const legacyText = extractPdfText(legacyRes.doc);
  assertNoTamsProBranding(legacyText, "Legacy bookingPdfGenerator PDF");
  assert.match(legacyText, /SKYLINE WINGS/);
  assert.match(legacyText, /ELECTRONIC TICKET/);
  assert.match(legacyText, /LEG778/);
  assert.equal(/Terms\s*&\s*Conditions/i.test(legacyText), false);
});
