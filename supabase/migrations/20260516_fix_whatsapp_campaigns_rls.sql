-- Fix RLS policies for whatsapp_campaigns to allow clients to insert and delete their campaigns
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can insert own wa campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Clients can insert own wa campaigns" ON public.whatsapp_campaigns 
FOR INSERT TO authenticated 
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Clients can update own wa campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Clients can update own wa campaigns" ON public.whatsapp_campaigns 
FOR UPDATE TO authenticated 
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Clients can delete own wa campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Clients can delete own wa campaigns" ON public.whatsapp_campaigns 
FOR DELETE TO authenticated 
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
