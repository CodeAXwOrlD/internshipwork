/**
 * Maps database service slugs to client-side route paths.
 * DB slugs (e.g. "ai-voice-telecaller") differ from route paths (e.g. "voice-telecaller").
 */

import { Phone, PhoneIncoming, Headphones, MessageCircle, Share2, Mail } from "lucide-react";

export const SERVICE_ROUTE_MAP: Record<string, string> = {
  "ai-voice-telecaller": "voice-telecaller",
  "ai-voice-receptionist": "voice-receptionist",
  "ai-voice-agent": "voice-agent",
  "whatsapp-automation": "whatsapp",
  "social-media-automation": "social-media",
  "ai-inbound": "first-voice",
  "email-marketing": "email-marketing",
  // Legacy slugs (if DB already uses short slugs)
  "voice-telecaller": "voice-telecaller",
  "voice-receptionist": "voice-receptionist",
  "voice-agent": "voice-agent",
  "whatsapp": "whatsapp",
  "social-media": "social-media",
  "socialium": "social-media",
  "inbound": "first-voice",
};

export const SERVICE_ICON_MAP: Record<string, React.ElementType> = {
  "voice-telecaller": Phone,
  "voice-receptionist": PhoneIncoming,
  "voice-agent": Headphones,
  "whatsapp": MessageCircle,
  "social-media": Share2,
  "first-voice": PhoneIncoming,
  "email-marketing": Mail,
};

export const SERVICE_LABEL_MAP: Record<string, string> = {
  "voice-telecaller": "Call Orbitor",
  "voice-receptionist": "AI Voice Receptionist",
  "voice-agent": "EcoAssist",
  "whatsapp": "LeadNest",
  "social-media": "Socialium",
  "first-voice": "First Voice",
  "email-marketing": "Email Marketing",
};

/**
 * Services that are in "Coming Soon" mode.
 * When a slug is removed from this list, the Coming Soon overlay
 * and catalog restrictions disappear dynamically across the app.
 */
export const COMING_SOON_SLUGS: string[] = [
  "voice-agent",
  "social-media",
];

/** Check if a service (by DB slug or route slug) is in Coming Soon mode */
export function isComingSoon(dbSlug: string, isUnlocked?: boolean): boolean {
  if (isUnlocked) return false;
  const routeSlug = getRouteSlug(dbSlug);
  return COMING_SOON_SLUGS.includes(routeSlug) || COMING_SOON_SLUGS.includes(dbSlug);
}

/** Convert a DB service slug to the client route segment */
export function getRouteSlug(dbSlug: string): string {
  return SERVICE_ROUTE_MAP[dbSlug] ?? dbSlug;
}

/** Get full client path for a service */
export function getServicePath(dbSlug: string): string {
  return `/client/${getRouteSlug(dbSlug)}`;
}

/** Get full admin path for a service */
export function getAdminServicePath(dbSlug: string): string {
  return `/admin/${getRouteSlug(dbSlug)}`;
}

/** Get icon component for a service (using route slug) */
export function getServiceIcon(dbSlug: string): React.ElementType | undefined {
  return SERVICE_ICON_MAP[getRouteSlug(dbSlug)];
}

/** Get display label for a service */
export function getServiceLabel(dbSlug: string): string | undefined {
  return SERVICE_LABEL_MAP[getRouteSlug(dbSlug)];
}
