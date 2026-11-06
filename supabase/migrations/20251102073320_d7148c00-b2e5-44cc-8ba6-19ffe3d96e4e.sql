-- Add purchasing and selling price fields to clients table
ALTER TABLE clients 
ADD COLUMN purchasing_price numeric,
ADD COLUMN selling_price numeric;

-- Update travel_type to allow custom service names (it's already TEXT so supports any value)
-- Add a comment for clarity
COMMENT ON COLUMN clients.travel_type IS 'Service type: Ticket, Umrah, or custom service name';

-- Add profit calculation as a computed column would be ideal, but we'll calculate in the app instead
-- This keeps it flexible for different currencies and business rules