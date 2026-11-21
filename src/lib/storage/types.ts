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
  getClients(agencyId?: string): Promise<any[]>;
  addClient(client: any, agencyId?: string): Promise<any>;
  updateClient(id: string, client: any): Promise<void>;
  deleteClient(id: string): Promise<void>;
  
  // Bookings
  getBookings(agencyId?: string): Promise<any[]>;
  addBooking(booking: any, agencyId?: string): Promise<void>;
  updateBooking(id: string, booking: any): Promise<void>;
  deleteBooking(id: string): Promise<void>;
  
  // Expenses
  getExpenses(agencyId?: string): Promise<any[]>;
  addExpense(expense: any, agencyId?: string): Promise<void>;
  updateExpense(id: string, expense: any): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  
  // Vendors
  getVendors(agencyId?: string): Promise<any[]>;
  addVendor(vendor: any, agencyId?: string): Promise<any>;
  updateVendor(id: string, vendor: any): Promise<void>;
  deleteVendor(id: string): Promise<void>;
  
  // Queries
  getQueries(agencyId?: string): Promise<any[]>;
  addQuery(query: any, agencyId?: string): Promise<any>;
  updateQuery(id: string, query: any): Promise<void>;
  deleteQuery(id: string): Promise<void>;
  
  // Client Payment History
  getClientPaymentHistory(clientId: string): Promise<any[]>;
  addClientPaymentHistory(payment: any, agencyId?: string): Promise<void>;
  
  // Vendor Payment History
  getVendorPaymentHistory(vendorId: string): Promise<any[]>;
  addVendorPaymentHistory(payment: any, agencyId?: string): Promise<void>;
  
  // Cleanup
  cleanupOldData(agencyId?: string): Promise<void>;
}
