import * as XLSX from 'xlsx';

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  data: any[];
}

export interface ImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  validateRequired?: string[];
}

export async function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (error) {
        reject(new Error('Failed to parse Excel file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

export async function parseCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const workbook = XLSX.read(text, { type: 'string' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (error) {
        reject(new Error('Failed to parse CSV file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function validateClientData(row: any, rowIndex: number): { valid: boolean; error?: string } {
  if (!row.Name || String(row.Name).trim() === '') {
    return { valid: false, error: `Row ${rowIndex + 1}: Name is required` };
  }
  
  if (row.Email && !isValidEmail(String(row.Email))) {
    return { valid: false, error: `Row ${rowIndex + 1}: Invalid email format` };
  }
  
  if (row.Phone && !isValidPhone(String(row.Phone))) {
    return { valid: false, error: `Row ${rowIndex + 1}: Invalid phone format` };
  }
  
  return { valid: true };
}

export function validateVendorData(row: any, rowIndex: number): { valid: boolean; error?: string } {
  if (!row.Name || String(row.Name).trim() === '') {
    return { valid: false, error: `Row ${rowIndex + 1}: Name is required` };
  }
  
  if (!row['Service Type'] || String(row['Service Type']).trim() === '') {
    return { valid: false, error: `Row ${rowIndex + 1}: Service Type is required` };
  }
  
  return { valid: true };
}

export function validateBookingData(row: any, rowIndex: number): { valid: boolean; error?: string } {
  if (!row['Client Name'] || String(row['Client Name']).trim() === '') {
    return { valid: false, error: `Row ${rowIndex + 1}: Client Name is required` };
  }
  
  if (!row.Package || String(row.Package).trim() === '') {
    return { valid: false, error: `Row ${rowIndex + 1}: Package is required` };
  }
  
  if (!row['Booking Date']) {
    return { valid: false, error: `Row ${rowIndex + 1}: Booking Date is required` };
  }
  
  return { valid: true };
}

export function validateExpenseData(row: any, rowIndex: number): { valid: boolean; error?: string } {
  if (!row.Date) {
    return { valid: false, error: `Row ${rowIndex + 1}: Date is required` };
  }
  
  if (!row.Category || String(row.Category).trim() === '') {
    return { valid: false, error: `Row ${rowIndex + 1}: Category is required` };
  }
  
  if (!row.Amount || isNaN(Number(row.Amount)) || Number(row.Amount) <= 0) {
    return { valid: false, error: `Row ${rowIndex + 1}: Valid amount is required` };
  }
  
  return { valid: true };
}

export function mapClientData(row: any): any {
  return {
    id: crypto.randomUUID(),
    name: String(row.Name || '').trim(),
    phone: String(row.Phone || '').trim(),
    email: String(row.Email || '').trim(),
    address: String(row.Address || '').trim(),
    totalAmount: Number(row['Total Amount'] || 0),
    amountPaid: Number(row['Amount Paid'] || 0),
    createdAt: new Date().toISOString(),
  };
}

export function mapVendorData(row: any): any {
  return {
    id: crypto.randomUUID(),
    name: String(row.Name || '').trim(),
    serviceType: String(row['Service Type'] || '').trim(),
    phone: String(row.Phone || '').trim(),
    email: String(row.Email || '').trim(),
    totalAmount: Number(row['Total Amount'] || 0),
    amountPaid: Number(row['Amount Paid'] || 0),
    createdAt: new Date().toISOString(),
  };
}

export function mapBookingData(row: any): any {
  return {
    id: crypto.randomUUID(),
    clientName: String(row['Client Name'] || '').trim(),
    package: String(row.Package || '').trim(),
    bookingDate: row['Booking Date'] ? new Date(row['Booking Date']).toISOString() : new Date().toISOString(),
    travelDate: row['Travel Date'] ? new Date(row['Travel Date']).toISOString() : undefined,
    amount: Number(row.Amount || 0),
    status: String(row.Status || 'pending').toLowerCase(),
    notes: String(row.Notes || '').trim(),
  };
}

export function mapExpenseData(row: any): any {
  return {
    id: crypto.randomUUID(),
    date: row.Date ? new Date(row.Date).toISOString() : new Date().toISOString(),
    category: String(row.Category || '').trim(),
    description: String(row.Description || '').trim(),
    amount: Number(row.Amount || 0),
    paymentMethod: String(row['Payment Method'] || 'cash').toLowerCase(),
    notes: String(row.Notes || '').trim(),
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}
