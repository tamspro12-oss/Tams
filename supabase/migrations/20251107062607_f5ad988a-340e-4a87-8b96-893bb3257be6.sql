-- Add remaining payment date column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS remaining_payment_date DATE;

-- Create index for faster queries on remaining payment date
CREATE INDEX IF NOT EXISTS idx_clients_remaining_payment_date ON clients(remaining_payment_date);

COMMENT ON COLUMN clients.remaining_payment_date IS 'Date when the remaining payment is expected from the client';