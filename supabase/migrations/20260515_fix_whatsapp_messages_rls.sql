-- Fix WhatsApp Inbox persistence issues by aligning RLS for read/write/delete.
-- Symptoms fixed by these policies:
-- 1) Attachments/messages disappear after refresh (message logging blocked)
-- 2) Clear chat appears to work but comes back on refresh (delete blocked)
-- 3) Delete contacts appears to work but comes back on refresh (delete blocked)

-- Ensure RLS is enabled.
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Accessed users can also SELECT messages for applications they can access.
DROP POLICY IF EXISTS "Accessed users can view messages for their bots" ON public.whatsapp_messages;
CREATE POLICY "Accessed users can view messages for their bots"
ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.whatsapp_user_access wua
    WHERE wua.application_id = public.whatsapp_messages.application_id
      AND wua.user_id = auth.uid()
  )
);

-- Allow clients/admins/accessed users to delete messages they are authorized to manage.
DROP POLICY IF EXISTS "Authorized users can delete whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Authorized users can delete whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (
  -- client owner
  client_id IN (
    SELECT c.id
    FROM public.clients c
    WHERE c.user_id = auth.uid()
  )
  OR
  -- admins / super admins
  public.has_role(auth.uid(), 'admin')
  OR public.is_super_admin()
  OR
  -- users with explicit application access
  EXISTS (
    SELECT 1
    FROM public.whatsapp_user_access wua
    WHERE wua.application_id = public.whatsapp_messages.application_id
      AND wua.user_id = auth.uid()
  )
);

-- Optional: If attachment table exists, align its RLS to prevent orphan behavior.
DO $$
BEGIN
  IF to_regclass('public.whatsapp_message_attachments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.whatsapp_message_attachments ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Authorized users can view whatsapp attachments" ON public.whatsapp_message_attachments';
    EXECUTE 'CREATE POLICY "Authorized users can view whatsapp attachments" ON public.whatsapp_message_attachments FOR SELECT TO authenticated USING (
      client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN (''admin'', ''super_admin''))
    )';

    EXECUTE 'DROP POLICY IF EXISTS "Authorized users can insert whatsapp attachments" ON public.whatsapp_message_attachments';
    EXECUTE 'CREATE POLICY "Authorized users can insert whatsapp attachments" ON public.whatsapp_message_attachments FOR INSERT TO authenticated WITH CHECK (
      client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN (''admin'', ''super_admin''))
    )';

    EXECUTE 'DROP POLICY IF EXISTS "Authorized users can delete whatsapp attachments" ON public.whatsapp_message_attachments';
    EXECUTE 'CREATE POLICY "Authorized users can delete whatsapp attachments" ON public.whatsapp_message_attachments FOR DELETE TO authenticated USING (
      client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN (''admin'', ''super_admin''))
    )';
  END IF;
END$$;