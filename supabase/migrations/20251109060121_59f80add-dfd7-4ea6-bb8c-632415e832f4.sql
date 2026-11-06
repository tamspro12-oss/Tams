-- Create queries table for client inquiries and to-do items
CREATE TABLE public.queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  contact_number TEXT,
  query_text TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  assigned_to TEXT,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view queries in their agency" 
ON public.queries 
FOR SELECT 
USING (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

CREATE POLICY "Users can insert queries in their agency" 
ON public.queries 
FOR INSERT 
WITH CHECK (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

CREATE POLICY "Users can update queries in their agency" 
ON public.queries 
FOR UPDATE 
USING (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

CREATE POLICY "Users can delete queries in their agency" 
ON public.queries 
FOR DELETE 
USING (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_queries_updated_at
BEFORE UPDATE ON public.queries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_queries_agency_id ON public.queries(agency_id);
CREATE INDEX idx_queries_status ON public.queries(status);
CREATE INDEX idx_queries_priority ON public.queries(priority);
CREATE INDEX idx_queries_due_date ON public.queries(due_date);