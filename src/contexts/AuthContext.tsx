import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "admin" | "client";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  // Fetch profile
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profileData) return null;

  // Fetch role from user_roles
  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError || !roleData) return null;

  return {
    ...profileData,
    role: roleData.role as AppRole,
  };
}

export function getRedirectPath(role: AppRole): string {
  switch (role) {
    case "super_admin":
      return "/super-admin";
    case "admin":
      return "/admin";
    case "client":
      return "/client";
    default:
      return "/login";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(prev => prev?.id === newSession?.user?.id ? prev : (newSession?.user ?? null));

        if (newSession?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(async () => {
            const userProfile = await fetchUserProfile(newSession.user.id);
            setProfile(userProfile);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(prev => prev?.id === existingSession?.user?.id ? prev : (existingSession?.user ?? null));

      if (existingSession?.user) {
        const userProfile = await fetchUserProfile(existingSession.user.id);
        setProfile(userProfile);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
