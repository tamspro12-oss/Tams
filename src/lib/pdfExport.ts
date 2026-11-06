import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfDay, endOfDay } from 'date-fns';

export async function exportClientsReport(
  clients: any[],
  startDate: Date | null,
  endDate: Date | null,
  agencyName?: string
) {
  const doc = new jsPDF();
  
  // Filter clients by date range
  let filteredClients = clients;
  if (startDate && endDate) {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    filteredClients = clients.filter(c => {
      const date = new Date(c.flight_date || c.created_at);
      return date >= start && date <= end;
    });
  }
  
  // Header with Agency Name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  if (agencyName) {
    doc.text(agencyName, 14, 15);
  }
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const dateRange = startDate && endDate 
    ? `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`
    : 'All Time';
  doc.text('Client Bookings Report', 14, 28);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${dateRange}`, 14, 35);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 41);
  
  // Clients Table
  autoTable(doc, {
    startY: 50,
    head: [['#', 'Name', 'Passport', 'Service', 'Selling', 'Paid', 'Pending', 'Status']],
    body: filteredClients.map((c, index) => {
      const selling = Number(c.selling_price) || 0;
      const paid = Number(c.amount_paid) || 0;
      const pending = selling - paid;
      
      return [
        (index + 1).toString(),
        c.name || '-',
        c.passport_number || '-',
        c.travel_type || '-',
        selling > 0 ? `₨${selling.toLocaleString()}` : '-',
        paid > 0 ? `₨${paid.toLocaleString()}` : '-',
        pending > 0 ? `₨${pending.toLocaleString()}` : '-',
        c.payment_status || '-',
      ];
    }),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 35 },
      2: { cellWidth: 28 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 },
      7: { cellWidth: 21 },
    }
  });

  // Summary Section
  const yPos = (doc as any).lastAutoTable.finalY + 12;
  
  const totalSelling = filteredClients.reduce((sum, c) => sum + (Number(c.selling_price) || 0), 0);
  const totalPaid = filteredClients.reduce((sum, c) => sum + (Number(c.amount_paid) || 0), 0);
  const totalPending = totalSelling - totalPaid;
  const fullyPaidCount = filteredClients.filter(c => {
    const selling = Number(c.selling_price) || 0;
    const paid = Number(c.amount_paid) || 0;
    return paid >= selling;
  }).length;
  
  // Summary box
  doc.setFillColor(240, 242, 245);
  doc.rect(14, yPos - 5, 182, 35, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 20, yPos + 3);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const leftCol = 20;
  const rightCol = 110;
  
  doc.text(`Total Bookings: ${filteredClients.length}`, leftCol, yPos + 12);
  doc.text(`Total Selling Price: ₨${totalSelling.toLocaleString()}`, leftCol, yPos + 20);
  
  doc.text(`Amount Collected: ₨${totalPaid.toLocaleString()}`, rightCol, yPos + 12);
  doc.text(`Pending Payment: ₨${totalPending.toLocaleString()}`, rightCol, yPos + 20);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Fully Paid: ${fullyPaidCount} of ${filteredClients.length}`, rightCol, yPos + 28);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save
  const filename = `ClientBookings_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(filename);
}

export async function exportExpensesReport(
  expenses: any[],
  startDate: Date | null,
  endDate: Date | null
) {
  const doc = new jsPDF();
  
  // Filter expenses by date range
  let filteredExpenses = expenses;
  if (startDate && endDate) {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    filteredExpenses = expenses.filter(e => {
      const date = new Date(e.expense_date);
      return date >= start && date <= end;
    });
  }
  
  // Title
  doc.setFontSize(20);
  const dateRange = startDate && endDate 
    ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
    : 'All Time';
  doc.text(`Expenses Report - ${dateRange}`, 14, 20);
  
  // Expenses Table
  doc.setFontSize(12);
  autoTable(doc, {
    startY: 35,
    head: [['Type', 'Amount (₨)', 'Date', 'Notes']],
    body: filteredExpenses.map(e => [
      e.expense_type || '-',
      e.amount ? `₨${e.amount}` : '-',
      e.expense_date ? format(new Date(e.expense_date), 'dd/MM/yyyy') : '-',
      e.notes || '-',
    ]),
  });

  // Summary
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const yPos = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text(`Total Expenses: ₨${totalExpenses.toFixed(2)}`, 14, yPos);

  // Save
  const filename = `Expenses_${format(new Date(), 'yyyy_MM_dd_HHmmss')}.pdf`;
  doc.save(filename);
}

export async function exportMonthlyReport(
  month: Date,
  clients: any[],
  bookings: any[],
  expenses: any[]
) {
  const doc = new jsPDF();
  const monthStr = format(month, 'MMMM yyyy');
  
  // Title
  doc.setFontSize(20);
  doc.text(`TAMS Pro Monthly Report - ${monthStr}`, 14, 20);
  
  let yPos = 35;

  // Clients Section
  doc.setFontSize(16);
  doc.text('Clients', 14, yPos);
  yPos += 5;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Name', 'Contact', 'Passport', 'CNIC', 'Travel Type']],
    body: clients.map(c => [
      c.name || '-',
      c.contact_number || '-',
      c.passport_number || '-',
      c.cnic || '-',
      c.travel_type || '-',
    ]),
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Bookings Section
  doc.setFontSize(16);
  doc.text('Bookings', 14, yPos);
  yPos += 5;
  
  autoTable(doc, {
    startY: yPos,
    head: [['PNR', 'Flight Date', 'Class', 'Type', 'Payment Status']],
    body: bookings.map(b => [
      b.pnr || '-',
      b.flight_date ? format(new Date(b.flight_date), 'dd/MM/yyyy') : '-',
      b.seat_class || '-',
      b.booking_type || '-',
      b.payment_status || '-',
    ]),
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Expenses Section
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(16);
  doc.text('Expenses', 14, yPos);
  yPos += 5;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Type', 'Amount', 'Date', 'Notes']],
    body: expenses.map(e => [
      e.expense_type || '-',
      e.amount ? `₨${e.amount}` : '-',
      e.expense_date ? format(new Date(e.expense_date), 'dd/MM/yyyy') : '-',
      e.notes || '-',
    ]),
  });

  // Summary
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  if (yPos > 270) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text(`Total Clients: ${clients.length}`, 14, yPos);
  doc.text(`Total Bookings: ${bookings.length}`, 14, yPos + 8);
  doc.text(`Total Expenses: ₨${totalExpenses.toFixed(2)}`, 14, yPos + 16);

  // Save
  const filename = `TAMS_Pro_Report_${format(month, 'yyyy_MM')}.pdf`;
  doc.save(filename);
}

export async function exportAllMonthlyReports(
  clients: any[],
  bookings: any[],
  expenses: any[]
) {
  // Group by month
  const months = new Set<string>();
  
  [...clients, ...bookings, ...expenses].forEach(item => {
    const date = new Date(item.created_at || item.expense_date || item.flight_date);
    if (!isNaN(date.getTime())) {
      months.add(format(date, 'yyyy-MM'));
    }
  });

  // Export each month
  for (const monthStr of Array.from(months).sort()) {
    const [year, month] = monthStr.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    
    const monthClients = clients.filter(c => {
      const d = new Date(c.created_at);
      return format(d, 'yyyy-MM') === monthStr;
    });
    
    const monthBookings = bookings.filter(b => {
      const d = new Date(b.created_at || b.flight_date);
      return format(d, 'yyyy-MM') === monthStr;
    });
    
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.created_at || e.expense_date);
      return format(d, 'yyyy-MM') === monthStr;
    });

    await exportMonthlyReport(monthDate, monthClients, monthBookings, monthExpenses);
    
    // Small delay between exports
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
