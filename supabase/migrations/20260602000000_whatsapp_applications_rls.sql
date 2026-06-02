-- Add INSERT, UPDATE, and DELETE RLS policies for whatsapp_applications to allow admins and super_admins to manage them

-- Explicitly enable Row Level Security
ALTER TABLE public.whatsapp_applications ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies to avoid conflict
DROP POLICY IF EXISTS "Admins can insert whatsapp applications" ON public.whatsapp_applications;
DROP POLICY IF EXISTS "Admins can update whatsapp applications" ON public.whatsapp_applications;
DROP POLICY IF EXISTS "Admins can delete whatsapp applications" ON public.whatsapp_applications;

-- 1. INSERT policy for admins and super_admins
CREATE POLICY "Admins can insert whatsapp applications" ON public.whatsapp_applications
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
);

-- 2. UPDATE policy for admins and super_admins
CREATE POLICY "Admins can update whatsapp applications" ON public.whatsapp_applications
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
);

-- 3. DELETE policy for admins and super_admins
CREATE POLICY "Admins can delete whatsapp applications" ON public.whatsapp_applications
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
);

