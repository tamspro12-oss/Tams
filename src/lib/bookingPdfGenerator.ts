import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface InvoiceTemplate {
  logo?: string;
  agencyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  themeColor?: string;
}

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

export async function generateBookingConfirmationPDF(client: any, vendor: any | null, template: InvoiceTemplate) {
  const doc = new jsPDF();
  
  let y = 14;
  
  // ═══════════════════════════════════════════════════════════════
  // HEADER - Clean professional design
  // ═══════════════════════════════════════════════════════════════
  
  // Top accent line
  doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.setLineWidth(2);
  doc.line(14, y, 196, y);
  
  y += 10;
  
  // Agency Logo (if available)
  const logoX = 14;
  let textStartX = 14;
  
  if (template.logo) {
    try {
      doc.addImage(template.logo, 'PNG', logoX, y, 18, 18);
      textStartX = 36;
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }
  
  // Agency Name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.text(template.agencyName || 'Travel Agency', textStartX, y + 6);
  
  // Agency contact (right aligned)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  let contactY = y + 2;
  if (template.phone) {
    doc.text(template.phone, 196, contactY, { align: 'right' });
    contactY += 4;
  }
  if (template.email) {
    doc.text(template.email, 196, contactY, { align: 'right' });
    contactY += 4;
  }
  if (template.address) {
    const addressLines = doc.splitTextToSize(template.address, 60);
    addressLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, 196, contactY, { align: 'right' });
      contactY += 4;
    });
  }
  
  y += 24;
  
  // ═══════════════════════════════════════════════════════════════
  // TITLE BAR
  // ═══════════════════════════════════════════════════════════════
  
  // Title background
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(14, y, 182, 12, 'F');
  
  // Title text
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  doc.text('BOOKING CONFIRMATION', 18, y + 8);
  
  // Reference number
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`REF: ${client.id?.slice(0, 8).toUpperCase() || 'N/A'}`, 192, y + 8, { align: 'right' });
  
  y += 18;
  
  // Check if this is a Custom Service
  const isCustomService = client.travel_type && 
    !['Ticket', 'Ticket – One Way', 'Ticket – Return', 'Umrah'].includes(client.travel_type);
  
  // Get custom service data from passengers_data if available
  const customServiceData = client.passengers_data?.[0]?.custom_service;

  // Booking Type Badge
  const bookingType = client.group_booking_type === 'group' ? 'GROUP BOOKING' :
                      client.travel_type === 'Umrah' ? 'UMRAH PACKAGE' : 
                      isCustomService ? 'CUSTOM SERVICE' : 'INDIVIDUAL BOOKING';
  
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.setLineWidth(0.3);
  const badgeWidth = doc.getTextWidth(bookingType) * 0.5 + 12;
  doc.roundedRect(14, y, badgeWidth, 7, 1, 1, 'FD');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.text(bookingType, 18, y + 5);
  
  // Date issued (right side)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text(`Issued: ${format(new Date(), 'dd MMM yyyy')}`, 196, y + 5, { align: 'right' });
  
  y += 14;
  
  // ═══════════════════════════════════════════════════════════════
  // CLIENT INFORMATION CARD
  // ═══════════════════════════════════════════════════════════════
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text('CLIENT INFORMATION', 14, y);
  
  y += 4;
  
  // Client card
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, 182, 22, 2, 2, 'S');
  
  // Client details
  doc.setFontSize(8);
  let infoY = y + 6;
  
  // Row 1: Name and Phone
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('Contact Name:', 18, infoY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(client.name, 46, infoY);
  
  if (client.contact_number) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('Phone:', 110, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(client.contact_number, 126, infoY);
  }
  
  infoY += 6;
  
  // Row 2: Email
  if (client.email) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('Email:', 18, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(client.email, 34, infoY);
  }
  
  infoY += 6;
  
  // Row 3: Contact Person (if group)
  if (client.contact_person) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('Contact Person:', 18, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(client.contact_person, 50, infoY);
  }
  
  y += 28;
  
  // ═══════════════════════════════════════════════════════════════
  // PASSENGER DETAILS
  // ═══════════════════════════════════════════════════════════════
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text('PASSENGER DETAILS', 14, y);
  
  y += 4;
  
  // Parse passengers data
  let passengers: any[] = [];
  if (client.passengers_data) {
    try {
      passengers = typeof client.passengers_data === 'string' 
        ? JSON.parse(client.passengers_data) 
        : client.passengers_data;
    } catch (e) {
      passengers = [];
    }
  }
  
  if (passengers.length > 0) {
    // Table header
    doc.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
    doc.rect(14, y, 182, 7, 'F');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('#', 18, y + 5);
    doc.text('PASSENGER NAME', 26, y + 5);
    doc.text('PASSPORT/CNIC', 90, y + 5);
    doc.text('GENDER', 140, y + 5);
    doc.text('NATIONALITY', 165, y + 5);
    
    y += 7;
    
    // Table rows
    passengers.forEach((passenger: any, index: number) => {
      if (y > 240) return; // Prevent overflow
      
      // Alternating row background
      if (index % 2 === 1) {
        doc.setFillColor(252, 252, 253);
        doc.rect(14, y, 182, 7, 'F');
      }
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      
      doc.text(`${index + 1}`, 18, y + 5);
      doc.text(passenger.name || '-', 26, y + 5);
      doc.text(passenger.passport_number || passenger.cnic || '-', 90, y + 5);
      doc.text(passenger.gender || '-', 140, y + 5);
      doc.text(passenger.nationality || '-', 165, y + 5);
      
      y += 7;
    });
    
    // Table border
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
  } else {
    // Single passenger fallback
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, 182, 16, 2, 2, 'S');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(`Passenger: ${client.name}`, 18, y + 6);
    
    if (client.passport_number) {
      doc.text(`Passport: ${client.passport_number}`, 18, y + 12);
    }
    
    y += 16;
  }
  
  y += 8;
  
  // ═══════════════════════════════════════════════════════════════
  // SERVICE/TRAVEL DETAILS - Two column layout
  // ═══════════════════════════════════════════════════════════════
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(isCustomService ? 'SERVICE DETAILS' : 'TRAVEL DETAILS', 14, y);
  
  y += 4;
  
  // Two column boxes
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, 88, 36, 2, 2, 'S');
  doc.roundedRect(108, y, 88, 36, 2, 2, 'S');
  
  // Left column
  let leftY = y + 7;
  
  if (isCustomService) {
    // Custom Service specific labels
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('START DATE', 18, leftY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    const startDate = customServiceData?.start_date || client.flight_date;
    doc.text(startDate ? format(new Date(startDate), 'dd MMM yyyy') : 'TBA', 18, leftY + 5);
    
    leftY += 14;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('SERVICE LOCATION', 18, leftY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(customServiceData?.location || client.destination || 'N/A', 18, leftY + 5);
  } else {
    // Standard travel labels
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('DEPARTURE DATE', 18, leftY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(client.flight_date ? format(new Date(client.flight_date), 'dd MMM yyyy') : 'TBA', 18, leftY + 5);
    
    leftY += 14;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('DESTINATION', 18, leftY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(client.destination || 'N/A', 18, leftY + 5);
  }
  
  // Right column
  let rightY = y + 7;
  
  if (isCustomService) {
    // Custom Service specific labels
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('REFERENCE NUMBER', 112, rightY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.text(customServiceData?.reference || client.pnr || 'N/A', 112, rightY + 5);
    
    rightY += 14;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('END DATE', 112, rightY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(customServiceData?.end_date ? format(new Date(customServiceData.end_date), 'dd MMM yyyy') : 'N/A', 112, rightY + 5);
  } else {
    // Standard travel labels
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('PNR / BOOKING CODE', 112, rightY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.text(client.pnr || 'N/A', 112, rightY + 5);
    
    rightY += 14;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text('AIRLINE', 112, rightY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(client.airline || 'N/A', 112, rightY + 5);
  }
  
  y += 42;
  
  // ═══════════════════════════════════════════════════════════════
  // PAYMENT SUMMARY
  // ═══════════════════════════════════════════════════════════════
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text('PAYMENT SUMMARY', 14, y);
  
  y += 4;
  
  const totalAmount = Number(client.selling_price || client.payment_amount) || 0;
  const amountPaid = Number(client.amount_paid) || 0;
  const balance = totalAmount - amountPaid;
  
  // Payment box
  doc.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
  doc.roundedRect(14, y, 182, 24, 2, 2, 'F');
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, 182, 24, 2, 2, 'S');
  
  // Payment details
  doc.setFontSize(9);
  
  // Total
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('Total Amount', 18, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text(formatCurrency(totalAmount), 75, y + 7);
  
  // Paid
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('Amount Paid', 18, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.success.r, colors.success.g, colors.success.b);
  doc.text(formatCurrency(amountPaid), 75, y + 14);
  
  // Balance
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('Balance Due', 18, y + 21);
  doc.setFont('helvetica', 'bold');
  if (balance > 0) {
    doc.setTextColor(colors.warning.r, colors.warning.g, colors.warning.b);
  } else {
    doc.setTextColor(colors.success.r, colors.success.g, colors.success.b);
  }
  doc.text(formatCurrency(balance), 75, y + 21);
  
  // Payment Status (right side)
  const paymentStatus = client.payment_status || 'Pending';
  const statusBg = paymentStatus === 'Paid' ? colors.success : 
                   paymentStatus === 'Partial' ? { r: 245, g: 158, b: 11 } : colors.warning;
  
  doc.setFillColor(statusBg.r, statusBg.g, statusBg.b);
  doc.roundedRect(145, y + 8, 45, 10, 2, 2, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  doc.text(paymentStatus.toUpperCase(), 167.5, y + 14.5, { align: 'center' });
  
  y += 30;
  
  // ═══════════════════════════════════════════════════════════════
  // NOTES (if any)
  // ═══════════════════════════════════════════════════════════════
  
  if (client.notes && y < 245) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text('IMPORTANT NOTES', 14, y);
    
    y += 4;
    
    doc.setFillColor(254, 249, 195); // Light yellow
    doc.setDrawColor(250, 204, 21);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, 182, 14, 2, 2, 'FD');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    const notesLines = doc.splitTextToSize(client.notes, 170);
    doc.text(notesLines.slice(0, 2), 18, y + 5);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════
  
  // Footer line
  doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.setLineWidth(0.5);
  doc.line(14, 274, 196, 274);
  
  // Footer text
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text('This document serves as confirmation of your booking. Please retain for your records.', 105, 279, { align: 'center' });
  
  const footerContact = [template.phone, template.email].filter(Boolean).join(' | ');
  if (footerContact) {
    doc.text(`For inquiries: ${footerContact}`, 105, 284, { align: 'center' });
  }
  
  // Generate output
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const filename = `Booking_${client.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  
  return { blobUrl, filename, doc };
}
