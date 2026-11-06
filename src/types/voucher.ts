export type VoucherType = 'Umrah' | 'Hotel' | 'Ticket';
export type VoucherStatus = 'Draft' | 'Issued' | 'Cancelled';

export interface VoucherPassenger {
  name: string;
  passport?: string;
  type?: 'Adult' | 'Child' | 'Infant';
  ticket_number?: string;
}

export interface Voucher {
  id: string;
  agency_id: string;
  agent_id?: string | null;
  booking_id?: string | null;
  voucher_number: string;
  voucher_type: VoucherType;
  status: VoucherStatus;
  passenger_name: string;
  passenger_passport?: string | null;
  passengers?: VoucherPassenger[];
  contact_number?: string | null;

  // Umrah & Hotel fields
  package_name?: string | null;
  hotel_name?: string | null;
  city?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  nights?: number | null;
  room_type?: string | null;
  number_of_rooms?: number | null;
  meal_plan?: string | null;
  hotel_confirmation_code?: string | null;
  transport_details?: string | null;
  visa_status?: string | null;
  ziyarat_details?: string | null;
  makkah_hotel?: string | null;
  makkah_check_in?: string | null;
  makkah_check_out?: string | null;
  makkah_nights?: number | null;
  madinah_hotel?: string | null;
  madinah_check_in?: string | null;
  madinah_check_out?: string | null;
  madinah_nights?: number | null;

  // Ticket fields
  airline?: string | null;
  flight_number?: string | null;
  sector?: string | null;
  departure_date?: string | null;
  arrival_date?: string | null;
  flight_class?: string | null;
  baggage?: string | null;
  pnr?: string | null;
  ticket_number?: string | null;

  remarks?: string | null;
  terms_and_conditions?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined fields
  b2b_agents?: {
    agency_name: string;
    contact_person: string;
  } | null;
}

