export type ReminderType = 'flight' | 'umrah' | 'daily_expense' | 'manual';

export interface Reminder {
  id: string;
  agency_id: string;
  user_id?: string | null;
  title: string;
  type: ReminderType;
  remind_date: string;
  remind_time?: string | null;
  booking_id?: string | null;
  is_completed: boolean;
  is_recurring_daily?: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReminderSettings {
  id?: string;
  agency_id: string;
  opening_time: string;
  closing_time: string;
  flight_alerts_enabled: boolean;
  umrah_alerts_enabled: boolean;
  daily_expense_reminder_enabled: boolean;
}

export interface DynamicTravelAlert {
  id: string;
  title: string;
  type: 'flight' | 'umrah';
  clientName: string;
  passportNumber?: string;
  travelDate: string;
  isToday: boolean;
  isTomorrow: boolean;
  bookingRef?: string;
  sectorOrDetails?: string;
  clientId: string;
}

