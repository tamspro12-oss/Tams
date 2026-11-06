-- Add email fields to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS email_password text,
ADD COLUMN IF NOT EXISTS contact_email text;

-- Add email field to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS contact_person text;

-- Add comment for email_password security note
COMMENT ON COLUMN public.agencies.email_password IS 'Gmail App Password (16 characters) - stored encrypted';

-- Create index for better email lookups
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_agencies_email ON public.agencies(email);