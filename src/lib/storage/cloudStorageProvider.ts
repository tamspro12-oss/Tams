import { supabase } from '@/integrations/supabase/client';
import { StorageProvider } from './types';

export class CloudStorageProvider implements StorageProvider {
  private async getAgencyId(): Promise<string> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('agency_id')
      .single();
    
    if (error) throw new Error(`Failed to get agency ID: ${error.message}`);
    if (!profile?.agency_id) throw new Error('Agency ID not found in profile');
    
    return profile.agency_id;
  }

  // Clients
  async getClients(): Promise<any[]> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch clients: ${error.message}`);
    return data || [];
  }

  async addClient(client: any): Promise<any> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...client, agency_id: agencyId })
      .select()
      .single();
    if (error) throw new Error(`Failed to add client: ${error.message}`);
    return data;
  }

  async updateClient(id: string, client: any): Promise<void> {
    const { error } = await supabase.from('clients').update(client).eq('id', id);
    if (error) throw new Error(`Failed to update client: ${error.message}`);
  }

  async deleteClient(id: string): Promise<void> {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete client: ${error.message}`);
  }

  // Bookings
  async getBookings(): Promise<any[]> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch bookings: ${error.message}`);
    return data || [];
  }

  async addBooking(booking: any): Promise<void> {
    const agencyId = await this.getAgencyId();
    const { error } = await supabase.from('bookings').insert({ ...booking, agency_id: agencyId });
    if (error) throw new Error(`Failed to add booking: ${error.message}`);
  }

  async updateBooking(id: string, booking: any): Promise<void> {
    const { error } = await supabase.from('bookings').update(booking).eq('id', id);
    if (error) throw new Error(`Failed to update booking: ${error.message}`);
  }

  async deleteBooking(id: string): Promise<void> {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete booking: ${error.message}`);
  }

  // Expenses
  async getExpenses(): Promise<any[]> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
    return data || [];
  }

  async addExpense(expense: any): Promise<void> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase.from('expenses').insert({ ...expense, agency_id: agencyId }).select().single();
    if (error) throw new Error(`Failed to add expense: ${error.message}`);

    // Sync into master transactions table
    try {
      await supabase.from('transactions').insert({
        agency_id: agencyId,
        date: expense.expense_date,
        type: 'expense',
        debit: 0,
        credit: expense.amount,
        method: expense.payment_mode || 'cash',
        category: expense.expense_type,
        notes: expense.notes,
        legacy_source: 'expenses',
        legacy_id: data?.id,
      });
    } catch (e) {
      console.warn('Transactions sync note:', e);
    }
  }

  async updateExpense(id: string, expense: any): Promise<void> {
    const { error } = await supabase.from('expenses').update(expense).eq('id', id);
    if (error) throw new Error(`Failed to update expense: ${error.message}`);
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete expense: ${error.message}`);
  }

  // Vendors
  async getVendors(): Promise<any[]> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch vendors: ${error.message}`);
    return data || [];
  }

  async addVendor(vendor: any): Promise<any> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase
      .from('vendors')
      .insert({ ...vendor, agency_id: agencyId })
      .select()
      .single();
    if (error) throw new Error(`Failed to add vendor: ${error.message}`);
    return data;
  }

  async updateVendor(id: string, vendor: any): Promise<void> {
    const { error } = await supabase.from('vendors').update(vendor).eq('id', id);
    if (error) throw new Error(`Failed to update vendor: ${error.message}`);
  }

  async deleteVendor(id: string): Promise<void> {
    const { error } = await supabase.from('vendors').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete vendor: ${error.message}`);
  }

  // Queries
  async getQueries(): Promise<any[]> {
    const agencyId = await this.getAgencyId();
    const { data, error } = await supabase
      .from('queries')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to get queries: ${error.message}`);
    return data || [];
  }

  async addQuery(query: any): Promise<any> {
    console.log('CloudStorageProvider: addQuery called', query);
    const agencyId = await this.getAgencyId();
    console.log('CloudStorageProvider: Agency ID retrieved', agencyId);
    
    const queryWithAgency = { ...query, agency_id: agencyId };
    console.log('CloudStorageProvider: Inserting query', queryWithAgency);
    
    const { data, error } = await supabase
      .from('queries')
      .insert(queryWithAgency)
      .select()
      .single();
    
    if (error) {
      console.error('CloudStorageProvider: Error inserting query', error);
      throw new Error(`Failed to add query: ${error.message}`);
    }
    
    console.log('CloudStorageProvider: Query added successfully', data);
    return data;
  }

  async updateQuery(id: string, query: any): Promise<void> {
    const { error } = await supabase
      .from('queries')
      .update(query)
      .eq('id', id);
    if (error) throw new Error(`Failed to update query: ${error.message}`);
  }

  async deleteQuery(id: string): Promise<void> {
    const { error } = await supabase.from('queries').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete query: ${error.message}`);
  }

  // Client Payment History
  async getClientPaymentHistory(clientId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('client_payment_history')
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch client payment history: ${error.message}`);
    return data || [];
  }

  async addClientPaymentHistory(payment: any): Promise<void> {
    const agencyId = await this.getAgencyId();
    const { error } = await supabase
      .from('client_payment_history')
      .insert({ ...payment, agency_id: agencyId });
    
    if (error) throw new Error(`Failed to add client payment history: ${error.message}`);
  }

  // Vendor Payment History
  async getVendorPaymentHistory(vendorId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('vendor_payment_history')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('payment_date', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch vendor payment history: ${error.message}`);
    return data || [];
  }

  async addVendorPaymentHistory(payment: any): Promise<void> {
    const agencyId = await this.getAgencyId();
    const { error } = await supabase
      .from('vendor_payment_history')
      .insert({ ...payment, agency_id: agencyId });
    
    if (error) throw new Error(`Failed to add vendor payment history: ${error.message}`);
  }

  // Cleanup old data (older than 1 year)
  async cleanupOldData(): Promise<void> {
    const agencyId = await this.getAgencyId();
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const dateStr = oneYearAgo.toISOString();

    await supabase.from('clients').delete().eq('agency_id', agencyId).lt('created_at', dateStr);
    await supabase.from('bookings').delete().eq('agency_id', agencyId).lt('created_at', dateStr);
    await supabase.from('expenses').delete().eq('agency_id', agencyId).lt('created_at', dateStr);
    await supabase.from('vendors').delete().eq('agency_id', agencyId).lt('created_at', dateStr);
    await supabase.from('queries').delete().eq('agency_id', agencyId).lt('created_at', dateStr);
  }
}

export const cloudStorage = new CloudStorageProvider();
