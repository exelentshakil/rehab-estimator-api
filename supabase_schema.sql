-- Run this in your Supabase SQL editor:

-- First create the traffic_events table for tracking
CREATE TABLE IF NOT EXISTS public.traffic_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  path text NOT NULL,
  ip_address text,
  city text,
  region text,
  country text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.traffic_events ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service Role Full Access" 
ON public.traffic_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
