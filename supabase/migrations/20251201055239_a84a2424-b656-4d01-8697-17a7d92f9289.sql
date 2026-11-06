-- Create email_logs table to track all sent emails
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  sent_by UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'booking', 'invoice', 'flight_reminder', 'payment_reminder'
  status TEXT NOT NULL DEFAULT 'pending', -- 'success', 'failed', 'queued'
  error_message TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  retry_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view email logs in their agency"
  ON public.email_logs
  FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert email logs in their agency"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (
    agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    AND sent_by = auth.uid()
  );

-- Index for performance
CREATE INDEX idx_email_logs_agency_id ON public.email_logs(agency_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);