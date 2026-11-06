import { z } from "zod";

// Common validation patterns
const phoneRegex = /^(\+92|0)?3[0-9]{9}$/;
const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]$/;
const passportRegex = /^[A-Z0-9]{6,9}$/i;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Passenger validation schema
export const passengerSchema = z.object({
  passenger_number: z.number().int().min(1),
  name: z.string()
    .trim()
    .min(2, "Passenger name must be at least 2 characters")
    .max(100, "Passenger name must be less than 100 characters"),
  
  // Optional fields - accept any format for flexibility
  passport_number: z.string()
    .trim()
    .max(20, "Passport number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  
  cnic: z.string()
    .trim()
    .max(20, "CNIC must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  
  date_of_birth: z.string()
    .optional()
    .or(z.literal("")),
  
  gender: z.enum(["M", "F", ""], {
    errorMap: () => ({ message: "Gender must be Male or Female" }),
  }).optional(),
  
  nationality: z.string()
    .trim()
    .max(50, "Nationality must be less than 50 characters")
    .optional()
    .or(z.literal("")),
});

// Client validation schema
export const clientSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Contact name must be at least 2 characters")
    .max(100, "Contact name must be less than 100 characters"),
  
  // Optional fields - accept any format for flexibility (no regex blocking saves)
  contact_number: z.string()
    .trim()
    .max(20, "Contact number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  
  email: z.string()
    .trim()
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  
  passengers_data: z.array(passengerSchema)
    .min(1, "At least one passenger is required")
    .optional(),
  
  destination: z.string()
    .trim()
    .max(100, "Destination must be less than 100 characters")
    .optional(),
  
  airline: z.string()
    .trim()
    .max(100, "Airline name must be less than 100 characters")
    .optional(),
  
  pnr: z.string()
    .trim()
    .max(50, "PNR must be less than 50 characters")
    .optional(),
  
  flight_date: z.string()
    .optional(),
  
  selling_price: z.number()
    .min(0, "Selling price must be positive")
    .max(10000000, "Selling price exceeds maximum allowed")
    .optional(),
  
  purchasing_price: z.number()
    .min(0, "Purchasing price must be positive")
    .max(10000000, "Purchasing price exceeds maximum allowed")
    .optional(),
  
  amount_paid: z.number()
    .min(0, "Amount paid must be positive")
    .max(10000000, "Amount paid exceeds maximum allowed")
    .optional(),
  
  group_size: z.number()
    .int("Group size must be a whole number")
    .min(1, "Group size must be at least 1")
    .max(500, "Group size cannot exceed 500"),
  
  notes: z.string()
    .max(5000, "Notes must be less than 5000 characters")
    .optional(),
});

// Vendor validation schema
export const vendorSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Vendor name must be at least 2 characters")
    .max(100, "Vendor name must be less than 100 characters"),
  
  contact_person: z.string()
    .trim()
    .max(100, "Contact person name must be less than 100 characters")
    .optional(),
  
  // Optional fields - accept any format for flexibility
  contact_number: z.string()
    .trim()
    .max(20, "Contact number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  
  email: z.string()
    .trim()
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  
  service_type: z.string()
    .trim()
    .max(100, "Service type must be less than 100 characters")
    .optional(),
  
  payment_amount: z.number()
    .min(0, "Payment amount must be positive")
    .max(10000000, "Payment amount exceeds maximum allowed")
    .optional(),
  
  amount_paid: z.number()
    .min(0, "Amount paid must be positive")
    .max(10000000, "Amount paid exceeds maximum allowed")
    .optional(),
  
  notes: z.string()
    .max(5000, "Notes must be less than 5000 characters")
    .optional(),
}).refine((data) => {
  // If payment_amount is set, amount_paid should not exceed it
  if (data.payment_amount && data.amount_paid) {
    return data.amount_paid <= data.payment_amount;
  }
  return true;
}, {
  message: "Amount paid cannot exceed payment amount",
  path: ["amount_paid"],
});

// Expense validation schema
export const expenseSchema = z.object({
  expense_date: z.string()
    .min(1, "Expense date is required"),
  
  expense_type: z.string()
    .trim()
    .min(2, "Expense type must be at least 2 characters")
    .max(100, "Expense type must be less than 100 characters"),
  
  amount: z.number()
    .min(0.01, "Amount must be greater than 0")
    .max(10000000, "Amount exceeds maximum allowed"),
  
  notes: z.string()
    .max(5000, "Notes must be less than 5000 characters")
    .optional(),
});

// Query validation schema
export const querySchema = z.object({
  client_name: z.string()
    .trim()
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name must be less than 100 characters"),
  
  // Optional - accept any format for flexibility
  contact_number: z.string()
    .trim()
    .max(20, "Contact number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  
  query_text: z.string()
    .trim()
    .min(5, "Query must be at least 5 characters")
    .max(2000, "Query must be less than 2000 characters"),
  
  priority: z.enum(["low", "medium", "high"], {
    errorMap: () => ({ message: "Priority must be low, medium, or high" }),
  }),
  
  status: z.enum(["pending", "in_progress", "completed", "cancelled"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
  
  assigned_to: z.string()
    .trim()
    .max(100, "Assigned to must be less than 100 characters")
    .optional(),
  
  due_date: z.string()
    .refine((date) => {
      if (!date) return true; // Optional field
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Due date cannot be in the past")
    .optional(),
  
  notes: z.string()
    .max(5000, "Notes must be less than 5000 characters")
    .optional(),
});

// Payment validation schema
export const paymentSchema = z.object({
  payment_amount: z.number()
    .min(0.01, "Payment amount must be greater than 0")
    .max(10000000, "Payment amount exceeds maximum allowed"),
  
  payment_type: z.enum(["partial", "full", "advance"], {
    errorMap: () => ({ message: "Payment type must be partial, full, or advance" }),
  }),
  
  payment_date: z.string()
    .min(1, "Payment date is required"),
  
  notes: z.string()
    .max(1000, "Notes must be less than 1000 characters")
    .optional(),
});

// Booking validation schema
export const bookingSchema = z.object({
  client_id: z.string()
    .min(1, "Client selection is required"),
  
  pnr: z.string()
    .trim()
    .min(2, "PNR must be at least 2 characters")
    .max(50, "PNR must be less than 50 characters"),
  
  flight_date: z.string()
    .min(1, "Flight date is required")
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Flight date cannot be in the past"),
  
  seat_class: z.string()
    .trim()
    .max(50, "Seat class must be less than 50 characters")
    .optional(),
  
  payment_status: z.string()
    .min(1, "Payment status is required"),
  
  booking_type: z.string()
    .min(1, "Booking type is required"),
  
  notes: z.string()
    .max(5000, "Notes must be less than 5000 characters")
    .optional(),

  discount_amount: z.number().min(0).optional(),
});

// Helper function to format validation errors for user display
export function formatValidationError(error: z.ZodError): string {
  const firstError = error.errors[0];
  return firstError.message;
}

// Helper function to validate and parse data
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatValidationError(error) };
    }
    return { success: false, error: "Validation failed" };
  }
}
