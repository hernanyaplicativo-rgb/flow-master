
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('normal','priority')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','called','serving','done','hold','transferred')),
  counter INTEGER,
  customer_name TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Demo: public access (kiosk/TV/staff are unauthenticated terminals)
CREATE POLICY "Public read tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Public insert tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tickets" ON public.tickets FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Sequence helper for daily ticket numbers
CREATE TABLE public.ticket_counter (
  day DATE PRIMARY KEY,
  normal_count INTEGER NOT NULL DEFAULT 0,
  priority_count INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.ticket_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public all counter" ON public.ticket_counter FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_ticket_code(p_category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  n INTEGER;
  prefix TEXT;
BEGIN
  INSERT INTO public.ticket_counter(day) VALUES (today) ON CONFLICT (day) DO NOTHING;
  IF p_category = 'priority' THEN
    UPDATE public.ticket_counter SET priority_count = priority_count + 1 WHERE day = today RETURNING priority_count INTO n;
    prefix := 'P';
  ELSE
    UPDATE public.ticket_counter SET normal_count = normal_count + 1 WHERE day = today RETURNING normal_count INTO n;
    prefix := 'N';
  END IF;
  RETURN prefix || LPAD(n::TEXT, 3, '0');
END;
$$;
