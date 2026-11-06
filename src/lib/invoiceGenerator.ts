import jsPDF from 'jspdf';
import { format } from 'date-fns';

// Professional Enterprise Color Palette
const colors = {
  primary: { r: 15, g: 23, b: 42 },      // Deep slate #0f172a
  accent: { r: 59, g: 130, b: 246 },     // Professional blue #3b82f6
  text: { r: 30, g: 41, b: 59 },         // Main text #1e293b
  textMuted: { r: 100, g: 116, b: 139 }, // Secondary text #64748b
  lightBg: { r: 248, g: 250, b: 252 },   // Card backgrounds #f8fafc
  border: { r: 226, g: 232, b: 240 },    // Subtle borders #e2e8f0
  success: { r: 22, g: 163, b: 74 },     // Green #16a34a
  warning: { r: 220, g: 38, b: 38 },     // Red #dc2626
  white: { r: 255, g: 255, b: 255 },
};

function formatCurrency(amount: number): string {
  return `PKR ${Number(amount || 0).toLocaleString('en-PK')}`;
}

export async function generateInvoicePDF(client: any, agency: any) {
  const doc = new jsPDF();
  
  let y = 20;
  
  // ═══════════════════════════════════════════════════════════════
  // HEADER - Clean minimal design with accent line
  // ═══════════════════════════════════════════════════════════════
  
  // Top accent line
  doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.setLineWidth(2);
  doc.line(14, 12, 196, 12);
  
  // Agency Name (left)
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.text(agency.name || 'Travel Agency', 14, y);
  
  // INVOICE title (right)
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.text('INVOICE', 196, y, { align: 'right' });
  
  y += 12;
  
  // Agency contact info (subtle, left side)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  if (agency.contact_info) {
    const contactLines = doc.splitTextToSize(agency.contact_info, 80);
    contactLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, 14, y);
      y += 4;
    });
  }
  
  y = 32;
  
  // ═══════════════════════════════════════════════════════════════
  // INVOICE INFO BAR
  // ═══════════════════════════════════════════════════════════════
  
  y += 16;
  
  // Light background bar for invoice details
  doc.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
  doc.rect(14, y, 182, 14, 'F');
  
  // Invoice Number
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('INVOICE NO.', 18, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.setFontSize(9);
  doc.text(`INV-${client.id?.slice(0, 8).toUpperCase() || 'DRAFT'}`, 18, y + 10);
  
  // Invoice Date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('DATE', 80, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.setFontSize(9);
  doc.text(format(new Date(), 'dd MMM yyyy'), 80, y + 10);
  
  // Due Date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('DUE DATE', 130, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.setFontSize(9);
  const dueDate = client.remaining_payment_date 
    ? format(new Date(client.remaining_payment_date), 'dd MMM yyyy')
    : 'On Receipt';
  doc.text(dueDate, 130, y + 10);
  
  y += 22;
  
  // ═══════════════════════════════════════════════════════════════
  // FROM / TO SECTION - Two elegant cards
  // ═══════════════════════════════════════════════════════════════
  
  // FROM Card (Agency)
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, 88, 40, 2, 2, 'S');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.text('FROM', 18, y + 7);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(agency.name || 'Travel Agency', 18, y + 15);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  let agencyY = y + 21;
  if (agency.phone_number) {
    doc.text(agency.phone_number, 18, agencyY);
    agencyY += 5;
  }
  if (agency.contact_email) {
    doc.text(agency.contact_email, 18, agencyY);
  }
  
  // TO Card (Client)
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(108, y, 88, 40, 2, 2, 'S');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.text('BILL TO', 112, y + 7);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(client.name, 112, y + 15);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  let clientY = y + 21;
  if (client.contact_number) {
    doc.text(client.contact_number, 112, clientY);
    clientY += 5;
  }
  if (client.email) {
    doc.text(client.email, 112, clientY);
    clientY += 5;
  }
  const primaryPassenger = client.passengers_data?.[0];
  if (primaryPassenger?.passport_number) {
    doc.text(`Passport: ${primaryPassenger.passport_number}`, 112, clientY);
  }
  
  y += 48;
  
  // ═══════════════════════════════════════════════════════════════
  // ITEMS TABLE - Modern professional design
  // ═══════════════════════════════════════════════════════════════
  
  // Table Header
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(14, y, 182, 10, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  doc.text('DESCRIPTION', 18, y + 7);
  doc.text('DETAILS', 100, y + 7);
  doc.text('AMOUNT', 192, y + 7, { align: 'right' });
  
  y += 10;
  
  // Table Row - Service
  doc.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
  doc.rect(14, y, 182, 28, 'F');
  
  // Service Name
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(client.travel_type || 'Travel Service', 18, y + 8);
  
  // Service Details (clean, no emojis)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  let detailY = y + 8;
  
  const details: string[] = [];
  
  // Check if this is a Custom Service (not Ticket, Umrah, or standard travel types)
  const isCustomService = client.travel_type && 
    !['Ticket', 'Ticket – One Way', 'Ticket – Return', 'Umrah'].includes(client.travel_type);
  
  // Get custom service data from passengers_data if available
  const customServiceData = client.passengers_data?.[0]?.custom_service;
  
  if (isCustomService) {
    // Custom Service specific labels
    if (customServiceData?.location || client.destination) {
      details.push(`Service Location: ${customServiceData?.location || client.destination}`);
    }
    if (customServiceData?.start_date || client.flight_date) {
      details.push(`Start Date: ${format(new Date(customServiceData?.start_date || client.flight_date), 'dd MMM yyyy')}`);
    }
    if (customServiceData?.end_date) {
      details.push(`End Date: ${format(new Date(customServiceData.end_date), 'dd MMM yyyy')}`);
    }
    if (customServiceData?.reference || client.pnr) {
      details.push(`Reference: ${customServiceData?.reference || client.pnr}`);
    }
  } else {
    // Standard travel service labels
    if (client.destination) details.push(`Destination: ${client.destination}`);
    if (client.flight_date) details.push(`Date: ${format(new Date(client.flight_date), 'dd MMM yyyy')}`);
    if (client.airline) details.push(`Airline: ${client.airline}`);
    if (client.pnr) details.push(`PNR: ${client.pnr}`);
  }
  
  details.slice(0, 3).forEach((detail, index) => {
    doc.text(detail, 100, detailY + (index * 5));
  });
  
  // Amount
  const sellingPrice = client.selling_price || client.payment_amount || 0;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(formatCurrency(sellingPrice), 192, y + 14, { align: 'right' });
  
  y += 28;
  
  // Table bottom border
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  
  y += 8;
  
  // ═══════════════════════════════════════════════════════════════
  // SUMMARY BOX - Right aligned, elegant
  // ═══════════════════════════════════════════════════════════════
  
  const amountPaid = Number(client.amount_paid) || 0;
  const balance = sellingPrice - amountPaid;
  
  // Summary box
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(120, y, 76, 42, 2, 2, 'S');
  
  // Subtotal
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('Subtotal', 124, y + 9);
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(formatCurrency(sellingPrice), 192, y + 9, { align: 'right' });
  
  // Amount Paid
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('Paid', 124, y + 18);
  doc.setTextColor(colors.success.r, colors.success.g, colors.success.b);
  doc.text(formatCurrency(amountPaid), 192, y + 18, { align: 'right' });
  
  // Divider line
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.3);
  doc.line(124, y + 23, 192, y + 23);
  
  // Balance Due / Total
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.roundedRect(120, y + 26, 76, 14, 0, 0, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  doc.text(balance > 0 ? 'BALANCE DUE' : 'TOTAL', 124, y + 35);
  doc.text(formatCurrency(balance > 0 ? balance : sellingPrice), 192, y + 35, { align: 'right' });
  
  y += 50;
  
  // Payment Status Badge
  const paymentStatus = client.payment_status || 'Pending';
  const statusColor = paymentStatus === 'Paid' ? colors.success : 
                      paymentStatus === 'Partial' ? { r: 245, g: 158, b: 11 } : colors.warning;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
  doc.text(`Status: ${paymentStatus.toUpperCase()}`, 192, y, { align: 'right' });
  
  y += 10;
  
  // ═══════════════════════════════════════════════════════════════
  // NOTES SECTION
  // ═══════════════════════════════════════════════════════════════
  
  if (client.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text('Notes', 14, y);
    
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    const notesLines = doc.splitTextToSize(client.notes, 175);
    doc.text(notesLines.slice(0, 3), 14, y);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FOOTER - Professional and clean
  // ═══════════════════════════════════════════════════════════════
  
  // Footer line
  doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.setLineWidth(0.5);
  doc.line(14, 272, 196, 272);
  
  // Thank you message
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('Thank you for your business!', 105, 279, { align: 'center' });
  
  // Contact info
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const footerContact = [agency.phone_number, agency.contact_email].filter(Boolean).join(' | ');
  if (footerContact) {
    doc.text(footerContact, 105, 285, { align: 'center' });
  }
  
  // Return blob URL and filename
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const filename = `Invoice_${client.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  
  return { blobUrl, filename, doc };
}
