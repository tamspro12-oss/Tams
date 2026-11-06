import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportData {
  clients: any[];
  bookings: any[];
  vendors: any[];
  expenses: any[];
}

export interface ExportOptions {
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeClients?: boolean;
  includeBookings?: boolean;
  includeVendors?: boolean;
  includeExpenses?: boolean;
}

export async function exportToExcel(
  data: ExportData,
  options: ExportOptions = {}
): Promise<Blob> {
  const {
    dateRange,
    includeClients = true,
    includeBookings = true,
    includeVendors = true,
    includeExpenses = true,
  } = options;

  const workbook = XLSX.utils.book_new();

  // Filter data by date range if specified
  const filterByDate = (items: any[], dateField: string) => {
    if (!dateRange) return items;
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= dateRange.start && itemDate <= dateRange.end;
    });
  };

  // Clients Sheet
  if (includeClients && data.clients.length > 0) {
    const clientsData = data.clients.map(client => ({
      'Client ID': client.id,
      'Name': client.name,
      'Phone': client.phone || '',
      'Email': client.email || '',
      'Address': client.address || '',
      'Total Amount': client.totalAmount || 0,
      'Amount Paid': client.amountPaid || 0,
      'Balance': (client.totalAmount || 0) - (client.amountPaid || 0),
      'Created Date': client.createdAt ? format(new Date(client.createdAt), 'yyyy-MM-dd') : '',
    }));
    const clientsSheet = XLSX.utils.json_to_sheet(clientsData);
    XLSX.utils.book_append_sheet(workbook, clientsSheet, 'Clients');
  }

  // Bookings Sheet
  if (includeBookings && data.bookings.length > 0) {
    const filteredBookings = filterByDate(data.bookings, 'bookingDate');
    const bookingsData = filteredBookings.map(booking => ({
      'Booking ID': booking.id,
      'Client Name': booking.clientName || '',
      'Package': booking.package || '',
      'Booking Date': booking.bookingDate ? format(new Date(booking.bookingDate), 'yyyy-MM-dd') : '',
      'Travel Date': booking.travelDate ? format(new Date(booking.travelDate), 'yyyy-MM-dd') : '',
      'Amount': booking.amount || 0,
      'Status': booking.status || '',
      'Notes': booking.notes || '',
    }));
    const bookingsSheet = XLSX.utils.json_to_sheet(bookingsData);
    XLSX.utils.book_append_sheet(workbook, bookingsSheet, 'Bookings');
  }

  // Vendors Sheet
  if (includeVendors && data.vendors.length > 0) {
    const vendorsData = data.vendors.map(vendor => ({
      'Vendor ID': vendor.id,
      'Name': vendor.name,
      'Service Type': vendor.serviceType || '',
      'Phone': vendor.phone || '',
      'Email': vendor.email || '',
      'Total Amount': vendor.totalAmount || 0,
      'Amount Paid': vendor.amountPaid || 0,
      'Balance': (vendor.totalAmount || 0) - (vendor.amountPaid || 0),
      'Created Date': vendor.createdAt ? format(new Date(vendor.createdAt), 'yyyy-MM-dd') : '',
    }));
    const vendorsSheet = XLSX.utils.json_to_sheet(vendorsData);
    XLSX.utils.book_append_sheet(workbook, vendorsSheet, 'Vendors');
  }

  // Expenses Sheet
  if (includeExpenses && data.expenses.length > 0) {
    const filteredExpenses = filterByDate(data.expenses, 'date');
    const expensesData = filteredExpenses.map(expense => ({
      'Expense ID': expense.id,
      'Date': expense.date ? format(new Date(expense.date), 'yyyy-MM-dd') : '',
      'Category': expense.category || '',
      'Description': expense.description || '',
      'Amount': expense.amount || 0,
      'Payment Method': expense.paymentMethod || '',
      'Notes': expense.notes || '',
    }));
    const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses');
  }

  // Summary Sheet
  const summary = {
    'Total Clients': data.clients.length,
    'Total Bookings': includeBookings ? filterByDate(data.bookings, 'bookingDate').length : data.bookings.length,
    'Total Vendors': data.vendors.length,
    'Total Expenses': includeExpenses ? filterByDate(data.expenses, 'date').length : data.expenses.length,
    'Export Date': format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    'Date Range': dateRange ? `${format(dateRange.start, 'yyyy-MM-dd')} to ${format(dateRange.end, 'yyyy-MM-dd')}` : 'All Data',
  };
  const summarySheet = XLSX.utils.json_to_sheet([summary]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportToCSV(
  data: any[],
  filename: string,
  headers?: string[]
): Promise<Blob> {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
