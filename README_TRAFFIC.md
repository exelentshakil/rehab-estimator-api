# Traffic Tracking Setup

I've added live visitor tracking to the app so you can see exactly when the Upwork client views your demo.

## Setup Instructions

To enable the database logging, you need to run this SQL in your Supabase project (the `barakahsoft` project):

1. Go to your [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
2. Run this query:

```sql
-- Create traffic logs table
CREATE TABLE IF NOT EXISTS public.traffic_logs (
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
ALTER TABLE public.traffic_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service Role Full Access" 
ON public.traffic_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

Once that is run, anyone who visits the app will have their IP, Geolocation (City/Region/Country), and device type logged. 

You can view the live traffic dashboard at: `/traffic` (or click "Traffic" in the top navbar).
