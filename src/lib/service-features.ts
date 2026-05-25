/**
 * Static feature lists for each service, keyed by route slug.
 * These are displayed on service cards and detail modals.
 */

export const SERVICE_FEATURES: Record<string, string[]> = {
  "voice-telecaller": [
    "Bulk CSV Upload (1000+ contacts)",
    "AI Lead Scoring (0-100)",
    "Real-time Call Monitoring",
    "Kanban Lead Board",
    "Campaign Analytics & Reports",
    "Retry & Schedule Logic",
    "Call Recording & Transcripts",
  ],
  "voice-receptionist": [
    "24/7 AI Receptionist",
    "Intelligent Call Routing",
    "Voicemail Transcription",
    "Custom Greeting Scripts",
    "Call Transfer to Team",
    "Missed Call Notifications",
  ],
  "voice-agent": [
    "Conversational AI Agent",
    "Custom Knowledge Base",
    "Multi-language Support",
    "Real-time Sentiment Analysis",
    "Call Summary & Action Items",
    "CRM Integration Ready",
  ],
  "whatsapp": [
    "Bulk WhatsApp Campaigns",
    "Template Message Library",
    "Delivery & Read Analytics",
    "Contact Segmentation",
    "Schedule Messages",
    "Media Attachments (Image/Video/Doc)",
  ],
  "social-media": [
    "Multi-platform Posting",
    "Content Calendar",
    "Analytics Dashboard",
    "Image & Video Support",
    "Hashtag Generator",
    "Post Scheduling",
  ],
  "first-voice": [
    "24/7 AI Receptionist",
    "Intelligent Call Routing",
    "Voicemail Transcription",
    "Custom Greeting Scripts",
    "Call Transfer to Team",
    "Missed Call Notifications",
  ],
};

/** Get features for a service by its DB slug or route slug */
export function getServiceFeatures(slug: string): string[] {
  // Try direct match first
  if (SERVICE_FEATURES[slug]) return SERVICE_FEATURES[slug];
  // Try stripping "ai-" prefix
  const stripped = slug.replace(/^ai-/, "");
  return SERVICE_FEATURES[stripped] || [];
}
