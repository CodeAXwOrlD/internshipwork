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
  headerFormat?: "image" | "video" | "document" | "audio";
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

    const cleanTo = params.to.replace(/[+\s-]/g, "");
    const messageType = params.type || "text";
    const requestBody: any = {
      to: cleanTo,
      phoneNoId: params.phoneNoId,
      application_id: params.application_id,
      client_id: params.client_id,
      type: messageType,
    };

    if (messageType === "template") {
      const components: any[] = [];

      // Add media header component if mediaUrl is provided
      if (params.mediaUrl) {
        const mediaParamType = params.headerFormat || "image";
        components.push({
          type: "header",
          parameters: [
            {
              type: mediaParamType,
              [mediaParamType]: {
                link: params.mediaUrl,
                ...(mediaParamType === "document" && params.attachment?.fileName
                  ? { filename: params.attachment.fileName }
                  : {}),
              },
            },
          ],
        });
      }

      // Add body parameters component
      components.push({
        type: "body",
        parameters: (params.bodyParams || []).map((value) => ({
          type: "text",
          text: value,
        })),
      });

      requestBody.template = {
        name: params.name,
        language: { code: params.language || "en_US" },
        components,
      };
    } else if (["image", "video", "document", "audio"].includes(messageType)) {
      requestBody.mediaUrl = params.mediaUrl;
      requestBody.caption =
        params.body || params.text || params.attachment?.caption;
      requestBody.fileName = params.attachment?.fileName;
    } else {
      requestBody.text = params.body || params.text || "";
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
            application_id:
              !params.application_id || params.application_id === "00000000-0000-0000-0000-000000000000"
                ? null
                : params.application_id,
            client_id: params.client_id,
            phone_number: cleanTo,
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
  const isFallback = applicationId === "00000000-0000-0000-0000-000000000000";
  
  let query = (supabase.from("whatsapp_templates" as any) as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (isFallback) {
    query = query.is("application_id", null);
  } else {
    query = query.eq("application_id", applicationId);
  }

  const { data, error } = await query;

  if (error) {
    // Try singular fallback
    let singularQuery = (supabase.from("whatsapp_template" as any) as any)
      .select("*")
      .order("created_at", { ascending: false });
    
    if (isFallback) {
      singularQuery = singularQuery.is("application_id", null);
    } else {
      singularQuery = singularQuery.eq("application_id", applicationId);
    }

    const { data: singularData, error: singularError } = await singularQuery;
    if (singularError) {
      console.error("Failed to fetch templates:", singularError);
      throw new Error(singularError.message || "Failed to fetch templates");
    }
    return singularData || [];
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
  // 1. Fetch bot details to get API config (Bypass for Env bot)
  let bot: any;
  if (applicationId === "00000000-0000-0000-0000-000000000000") {
    bot = {
      id: applicationId,
      name: "WhapiHub (Env)",
      provider_type: "api",
    };
  } else {
    // Try plural first, then singular as fallback if needed
    const { data, error: botError } = await (
      supabase.from("whatsapp_applications" as any) as any
    )
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (botError || !data) {
      // Fallback check for singular table name which appeared in console logs
      const { data: singularData, error: singularError } = await (
        supabase.from("whatsapp_application" as any) as any
      )
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();
      
      if (singularError || !singularData) throw new Error("WhatsApp bot not found");
      bot = singularData;
    } else {
      bot = data;
    }
  }

  // ... (rest of the function)
  console.log(
    "📝 Saving template locally — create on Meta Business Manager for WhatsApp approval",
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: client } = await (supabase.from("clients" as any) as any)
    .select("id")
    .eq("user_id", user?.id)
    .maybeSingle();

  // Try to save to whatsapp_templates (plural)
  const { data, error } = await (
    supabase.from("whatsapp_templates" as any) as any
  )
    .insert({
      application_id: applicationId === "00000000-0000-0000-0000-000000000000" ? null : applicationId,
      client_id: client?.id || null,
      name: templateData.name.trim().toLowerCase().replace(/\s+/g, "_"),
      category: templateData.category || "MARKETING",
      language: templateData.language || "en_US",
      components: templateData.components || [],
      status: "pending",
      created_by: user?.id,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to create template:", error);
    throw new Error(error.message || "Failed to save template to database");
  }

  return data;
}

/**
 * Fetches templates from Meta's Graph API and syncs them to local DB.
 * WhapiHub has no template listing endpoint — templates come from Meta directly.
 * Requires waba_id + meta_access_token in the bot's api_config.
 */
export async function syncWhatsAppTemplates(applicationId: string) {
  if (applicationId === "00000000-0000-0000-0000-000000000000") {
    return [];
  }
  const { data: botData, error: botError } = await (
    supabase.from("whatsapp_applications" as any) as any
  )
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  let bot = botData;
  if (botError || !bot) {
    const { data: singularData, error: singularError } = await (
      supabase.from("whatsapp_application" as any) as any
    )
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    
    if (singularError || !singularData) throw new Error("Bot API configuration missing or invalid");
    bot = singularData;
  }

  if (!bot || !bot.api_config) {
    throw new Error("Bot API configuration missing or invalid");
  }

  const { waba_id, meta_access_token, api_key } = bot.api_config;
  const token = meta_access_token || (api_key?.startsWith("EAA") ? api_key : null);

  if (!waba_id || !token) {
    throw new Error(
      "META_CONFIG_MISSING: To import templates, configure your Meta Access Token and WABA ID in the Admin WhatsApp Bot Config panel (Admin → WhatsApp Bots → Config → Meta Access Token & Meta WABA ID)."
    );
  }

  try {
    const metaUrl = `https://graph.facebook.com/v20.0/${waba_id}/message_templates?limit=200&fields=name,status,category,language,components`;
    const response = await fetch(metaUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const responseText = await response.text();
    console.log("📋 Meta Graph API templates response:", responseText.slice(0, 600));

    if (!response.ok) {
      console.warn("Failed to fetch templates from Meta (status", response.status, "):", responseText);
      return [];
    }

    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      console.warn("Meta template response is not JSON:", responseText);
      return [];
    }

    // Meta returns templates under result.data
    let externalTemplates: any[] = [];
    if (Array.isArray(result)) {
      externalTemplates = result;
    } else if (Array.isArray(result.waba_templates)) {
      externalTemplates = result.waba_templates;
    } else if (Array.isArray(result.templates)) {
      externalTemplates = result.templates;
    } else if (Array.isArray(result.data)) {
      externalTemplates = result.data;
    } else if (Array.isArray(result.items)) {
      externalTemplates = result.items;
    } else {
      // Last resort: look for any array value in the response object
      const firstArray = Object.values(result).find((v) => Array.isArray(v));
      if (firstArray) externalTemplates = firstArray as any[];
    }

    console.log(`📋 Found ${externalTemplates.length} templates from Meta`);

    if (externalTemplates.length === 0) return [];

    // Get current user for attribution
    const { data: { user } } = await supabase.auth.getUser();

    // Find linked client
    const { data: client } = await (supabase
      .from("clients" as any) as any)
      .select("id")
      .eq("user_id", user?.id)
      .maybeSingle();

    // Upsert all templates into local DB (sync all statuses)
    for (const tpl of externalTemplates) {
      const rawStatus = (tpl.status || "approved");
      const status = rawStatus.toLowerCase();

      const tplName = (tpl.name || tpl.template_name || tpl.elementName || "").trim();
      if (!tplName) continue;

      const tplLang = (
        tpl.language ||
        tpl.language_code ||
        tpl.languageCode ||
        (Array.isArray(tpl.components) ? undefined : undefined) ||
        "en_US"
      ).trim();

      const tplCategory = (tpl.category || tpl.templateType || "MARKETING").toUpperCase();

      const { error: upsertError } = await (supabase.from("whatsapp_templates" as any) as any).upsert({
        application_id: applicationId,
        client_id: client?.id || null,
        name: tplName,
        category: tplCategory,
        language: tplLang,
        components: tpl.components || [],
        status: status,
        created_by: user?.id,
      }, { onConflict: 'application_id,name' });

      if (upsertError) console.warn(`Failed to sync template "${tplName}":`, upsertError);
    }

    return externalTemplates;
  } catch (err) {
    console.error("syncWhatsAppTemplates error:", err);
    return [];
  }
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
