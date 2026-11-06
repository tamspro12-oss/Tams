export type StorageType = 'local' | 'cloud';

export interface StorageConfig {
  type: StorageType;
  lastSync?: Date;
}

export interface DataRecord {
  id: string;
  createdAt: Date;
  [key: string]: any;
}

export interface StorageProvider {
  // Clients
  getClients(): Promise<any[]>;
  addClient(client: any): Promise<any>;
  updateClient(id: string, client: any): Promise<void>;
  deleteClient(id: string): Promise<void>;
  
  // Bookings
  getBookings(): Promise<any[]>;
  addBooking(booking: any): Promise<void>;
  updateBooking(id: string, booking: any): Promise<void>;
  deleteBooking(id: string): Promise<void>;
  
  // Expenses
  getExpenses(): Promise<any[]>;
  addExpense(expense: any): Promise<void>;
  updateExpense(id: string, expense: any): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  
  // Vendors
  getVendors(): Promise<any[]>;
  addVendor(vendor: any): Promise<any>;
  updateVendor(id: string, vendor: any): Promise<void>;
  deleteVendor(id: string): Promise<void>;
  
  // Queries
  getQueries(): Promise<any[]>;
  addQuery(query: any): Promise<any>;
  updateQuery(id: string, query: any): Promise<void>;
  deleteQuery(id: string): Promise<void>;
  
  // Client Payment History
  getClientPaymentHistory(clientId: string): Promise<any[]>;
  addClientPaymentHistory(payment: any): Promise<void>;
  
  // Vendor Payment History
  getVendorPaymentHistory(vendorId: string): Promise<any[]>;
  addVendorPaymentHistory(payment: any): Promise<void>;
  
  // Cleanup
  cleanupOldData(): Promise<void>;
}
