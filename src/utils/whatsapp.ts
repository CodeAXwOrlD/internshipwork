import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadFile, getSignedUrl } from "@/lib/storage";

export const WHATSAPP_API_URL =
  import.meta.env.VITE_WHATSAPP_API_BASE_URL || "https://app.whapihub.com/api";
export const LEADNEST_BRIDGE_URL =
  import.meta.env.VITE_LEADNEST_SEND_MESSAGE ||
  "https://ukxoyojiztuvaqgslegw.supabase.co/functions/v1/whatsapp-bridge";
const DEFAULT_API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY;
export const WHATSAPP_ATTACHMENTS_BUCKET = "whatsapp-attachments";

export interface SendWhatsAppMessageParams {
  to: string;
  text?: string;
  body?: string;
  type?: "text" | "template" | "image" | "video" | "document" | "audio";
  name?: string;
  language?: string;
  bodyParams?: string[];
  mediaUrl?: string;
  attachment?: {
    storagePath: string;
    fileName: string;
    mimeType: string;
    fileSize?: number;
    bucket?: string;
    caption?: string;
  };
  phoneNoId?: string;
  application_id: string;
  client_id?: string; // Optional for admin tests
  baseUrl?: string;
}

export type WhatsAppMediaType = "image" | "video" | "document" | "audio";

export function detectWhatsAppMediaType(file: File): WhatsAppMediaType {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export async function uploadWhatsAppAttachment(file: File, folder: string) {
  const upload = await uploadFile({
    bucket: WHATSAPP_ATTACHMENTS_BUCKET,
    folder,
    file,
    signedUrl: false,
  });

  let signedUrl = upload.url;
  if (!signedUrl) {
    signedUrl = await getSignedUrl(
      WHATSAPP_ATTACHMENTS_BUCKET,
      upload.path,
      3600,
    );
  }

  return {
    ...upload,
    signedUrl,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

/**
 * Sends a message via WhatsApp and logs it to our local database history.
 */
export async function sendWhatsAppMessage(
  params: SendWhatsAppMessageParams,
  apiKey?: string,
) {
  try {
    const API_URL = params.baseUrl
      ? params.baseUrl.endsWith("/")
        ? params.baseUrl + "messages"
        : params.baseUrl + "/messages"
      : import.meta.env.VITE_LEADNEST_SEND_MESSAGE;
    const token = apiKey || DEFAULT_API_KEY;

    if (!API_URL) {
      console.error("VITE_LEADNEST_SEND_MESSAGE is not defined in .env");
      return { success: false, message: "API configuration missing" };
    }

    const messageType = params.type || "text";
    const requestBody: any = {
      to: params.to,
      phoneNoId: params.phoneNoId,
      application_id: params.application_id,
      client_id: params.client_id,
      type: messageType,
    };

    if (messageType === "template") {
      requestBody.template = {
        name: params.name,
        language: { code: params.language || "en_US" },
        components: [
          {
            type: "body",
            parameters: (params.bodyParams || []).map((value) => ({
              type: "text",
              text: value,
            })),
          },
        ],
      };
    } else if (["image", "video", "document", "audio"].includes(messageType)) {
      requestBody.mediaUrl = params.mediaUrl;
      requestBody.caption =
        params.body || params.text || params.attachment?.caption;
      requestBody.fileName = params.attachment?.fileName;
    } else {
      requestBody.text = {
        body: params.body || params.text || "",
      };
    }


    // Ensure URL has trailing slash if we are hitting the root of the bridge
    const targetUrl = API_URL.endsWith("whatsapp-bridge")
      ? `${API_URL}/`
      : API_URL;

    console.log("🚀 Sending WhatsApp Payload to Bridge:", targetUrl);
    console.log("FULL REQUEST BODY:", JSON.stringify(requestBody, null, 2));
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    // Check if the response is JSON before parsing
    const contentType = response.headers.get("content-type");
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      console.error("Non-JSON response received:", text);
      return { success: false, message: `Server error: ${response.status}` };
    }

    if (result.success || response.ok) {
      console.log("📥 LeadNest API Response:", result);
      // Log the message to our Supabase database (only if client_id is present)
      if (params.client_id) {
        const logContent =
          params.body ??
          params.text ??
          params.attachment?.caption ??
          params.attachment?.fileName ??
          "";

        const { data: messageRow, error: dbError } = await (
          supabase.from("whatsapp_messages" as any) as any
        )
          .insert({
            application_id: params.application_id,
            client_id: params.client_id,
            phone_number: params.to,
            message_content: logContent,
            message_type: params.type || "text",
            template_name: params.name || null,
            status: "sent",
            metadata: {
              whatsapp_message_id: result?.id || null,
              mediaUrl: params.mediaUrl || null,
              attachment: params.attachment || null,
            },
            sent_at: new Date().toISOString(),
            wamid: result?.wamid || null,
          })
          .select("id")
          .single();

        if (dbError) {
          console.warn("Message Sent but failed to log in history:", dbError);
          return {
            success: true,
            message: "Message sent but failed to log in history",
          };
        }

        if (params.attachment && messageRow?.id) {
          const { error: attachmentError } = await (
            supabase.from("whatsapp_message_attachments" as any) as any
          ).insert({
            client_id: params.client_id,
            message_id: messageRow.id,
            storage_bucket:
              params.attachment.bucket || WHATSAPP_ATTACHMENTS_BUCKET,
            storage_path: params.attachment.storagePath,
            file_name: params.attachment.fileName,
            mime_type: params.attachment.mimeType,
            file_size: params.attachment.fileSize || null,
            caption: params.attachment.caption || null,
          });

          if (attachmentError) {
            console.warn(
              "Message logged but attachment record failed:",
              attachmentError,
            );
          }
        }
      }
      return { success: true, message: "Message sent successfully" };
    } else {
      console.error("📥 LeadNest API Error:", result);
      return {
        success: false,
        message:
          result?.message || result?.error || "Failed to send WhatsApp message",
      };
    }
  } catch (error: any) {
    console.error("WhatsApp Send Error:", error);
    return {
      success: false,
      message: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Checks the real-time status of a message and updates our local database.
 */
export async function updateMessageStatus(
  messageId: string,
  dbMessageId: string,
  apiKey?: string,
) {
  const token = apiKey || DEFAULT_API_KEY;
  if (!token) return;

  try {
    let targetUrl = WHATSAPP_API_URL.endsWith("/")
      ? WHATSAPP_API_URL + "messages"
      : WHATSAPP_API_URL + "/messages";
    if (!targetUrl.endsWith("/")) targetUrl += "/";
    targetUrl += messageId;

    // // In development, use the local proxy to avoid CORS
    // if (import.meta.env.DEV) {
    //   targetUrl = targetUrl.replace("https://app.whapihub.com", "/whapi");
    // }

    const response = await fetch(targetUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const status = data?.status || "sent";

      // Update our local DB status (delivered, read, failed, etc.)
      await (supabase.from("whatsapp_messages" as any) as any)
        .update({ status })
        .eq("id", dbMessageId);

      return status;
    }
  } catch (error) {
    console.error("Failed to update message status:", error);
  }
}

/**
 * Fetches available message templates for a specific bot from our local database.
 */
export async function getWhatsAppTemplates(applicationId: string) {
  const { data, error } = await (
    supabase.from("whatsapp_templates" as any) as any
  )
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch templates:", error);
    throw new Error(error.message || "Failed to fetch templates from database");
  }

  return data || [];
}

/**
 * Creates a new message template on the real WhatsApp platform and saves to local database.
 */
export async function createWhatsAppTemplate(
  applicationId: string,
  templateData: any,
) {
  // 1. Fetch bot details to get API config
  const { data: bot, error: botError } = await (
    supabase.from("whatsapp_applications" as any) as any
  )
    .select("*")
    .eq("id", applicationId)
    .single();

  if (botError || !bot) throw new Error("WhatsApp bot not found");

  // ─── IMPORTANT NOTE FOR FUTURE DEVELOPERS ───────────────────────────────────
  // WhapiHub does NOT support template creation via REST API.
  // Templates must be created manually in Meta Business Manager:
  // https://business.facebook.com/wa/manage/message-templates/
  //
  // If you switch from WhapiHub to another provider (e.g. Twilio, 360Dialog):
  // → Check if new provider supports template creation API
  // → If yes, add POST call here with new provider's endpoint
  // → If no, keep this comment and continue using Meta Business Manager
  //
  // WhapiHub only supports SENDING existing approved templates via:
  // POST https://app.whapihub.com/api/v2/whatsapp-business/messages
  // with body: { type: "template", name: "template_name", language: "en_US" }
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(
    "📝 Saving template locally — create on Meta Business Manager for WhatsApp approval",
  );

  // 3. Save to local database for history/caching
  // Get current user for attribution
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: client } = await (supabase.from("clients" as any) as any)
    .select("id")
    .eq("user_id", user?.id)
    .maybeSingle();

  const { data, error } = await (
    supabase.from("whatsapp_templates" as any) as any
  )
    .insert({
      application_id: applicationId,
      client_id: client?.id || null,
      name: templateData.name.trim().toLowerCase().replace(/\s+/g, "_"),
      category: templateData.category || "MARKETING",
      language: templateData.language || "en_US",
      components: templateData.components || [],
      status: "pending", // New templates start as pending on WhatsApp
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create template:", error);
    throw new Error(error.message || "Failed to save template to database");
  }

  return data;
}

/**
 * Fetches templates from the real WhatsApp API and syncs them to our local database.
 */
export async function syncWhatsAppTemplates(applicationId: string) {
  const { data: bot, error: botError } = await (
    supabase.from("whatsapp_applications" as any) as any
  )
    .select("*")
    .eq("id", applicationId)
    .single();

  if (botError || !bot || !bot.api_config?.api_key) {
    throw new Error("Bot API configurat`ion missing or invalid");
  }

  // ─── IMPORTANT NOTE FOR FUTURE DEVELOPERS ───────────────────────────────────
  // WhapiHub does NOT have a GET templates endpoint.
  // Templates synced here come from local DB only.
  // To get approved templates, check Meta Business Manager directly.
  // If provider changes, update this function with new provider's GET endpoint.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(
    "📋 Fetching templates from local DB only — WhapiHub has no list templates endpoint",
  );
  return [];

  //   // Get current user for attribution
  //   const { data: { user } } = await supabase.auth.getUser();

  //   // Find linked client
  //   const { data: client } = await (supabase
  //     .from("clients" as any) as any)
  //     .select("id")
  //     .eq("user_id", user?.id)
  //     .maybeSingle();

  //   // Update local DB (upsert based on name)
  //   for (const tpl of externalTemplates) {
  //     // Only sync approved templates to avoid draft errors
  //     const status = (tpl.status || "approved").toLowerCase();
  //     if (status !== 'approved' && status !== 'ready') continue;

  //     const tplName = (tpl.name || tpl.template_name || "").trim();
  //     if (!tplName) continue;

  //     const tplLang = (tpl.language || tpl.language_code || "en_US").trim();

  //     const { error: upsertError } = await (supabase.from("whatsapp_templates" as any) as any).upsert({
  //       application_id: applicationId,
  //       client_id: client?.id || null,
  //       name: tplName,
  //       category: tpl.category || 'MARKETING',
  //       language: tplLang, // Store exactly what the API says
  //       components: tpl.components || [],
  //       status: status,
  //       created_by: user?.id
  //     }, { onConflict: 'application_id,name' });

  //     if (upsertError) console.warn(`Failed to sync template ${tplName}:`, upsertError);
  //   }

  //   return externalTemplates;
}

/**
 * Deletes a message from our local history.
 */
export async function deleteWhatsAppMessage(messageId: string) {
  const { error } = await (supabase.from("whatsapp_messages" as any) as any)
    .delete()
    .eq("id", messageId);

  if (error) throw error;
  return true;
}
