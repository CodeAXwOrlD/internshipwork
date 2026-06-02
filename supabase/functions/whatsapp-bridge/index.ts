import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Parse the path to figure out what to forward
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const bridgeIndex = pathParts.findIndex((p) => p === "whatsapp-bridge");
  const targetPath = pathParts.slice(bridgeIndex + 1).filter(Boolean).join("/");

  // Health check: only for bare GET with no sub-path
  if (req.method === "GET" && !targetPath) {
    return new Response(
      JSON.stringify({ ok: true, message: "whatsapp-bridge is running" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Parse payload for POST/PUT requests
    let payload: any = {};
    if (req.method === "POST" || req.method === "PUT") {
      try {
        const rawBody = await req.text();
        if (rawBody && rawBody.trim().length > 0) {
          payload = JSON.parse(rawBody);
        }
      } catch {
        payload = {};
      }
    }

    const appId = payload.application_id || payload.phoneNoId;
    let botConfig: any = null;
    let phoneNoId = payload.phoneNoId || payload.phone_id || payload.phoneNumberId;

    // Fetch bot config from database if appId is present
    if (appId && appId !== "00000000-0000-0000-0000-000000000000") {
      const { data: bot, error: botError } = await supabaseClient
        .from("whatsapp_applications")
        .select("*")
        .eq("id", appId)
        .maybeSingle();

      let finalBot = bot;
      if (botError || !bot) {
        const { data: singularBot } = await supabaseClient
          .from("whatsapp_application")
          .select("*")
          .eq("id", appId)
          .maybeSingle();
        finalBot = singularBot;
      }

      if (finalBot && finalBot.api_config) {
        botConfig = finalBot.api_config;
        if (!phoneNoId) {
          phoneNoId = botConfig.phone_id;
        }
      }
    }

    // Resolve API token / authorization
    const token =
      botConfig?.meta_access_token ||
      (botConfig?.api_key?.startsWith("EAA") ? botConfig.api_key : null) ||
      req.headers.get("Authorization")?.split(" ")[1] ||
      botConfig?.api_key ||
      Deno.env.get("WHATSAPP_API_KEY");

    const baseUrl =
      Deno.env.get("WHATSAPP_API_BASE_URL") || "https://app.whapihub.com/api";

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing API Key or Token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect if we should use Meta Graph API
    const isMeta =
      !!botConfig?.waba_id ||
      !!botConfig?.meta_access_token ||
      token?.startsWith("EAA");

    // ── Meta Graph API POST/PUT handler ──
    if (isMeta && (req.method === "POST" || req.method === "PUT")) {
      const to = payload.to?.replace(/[+\s-]/g, "");
      if (!to) {
        return new Response(JSON.stringify({ error: "Missing recipient 'to' parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const finalPhoneId = phoneNoId || botConfig?.phone_id;
      if (!finalPhoneId) {
        return new Response(JSON.stringify({ error: "Missing phoneNoId/phone_id for Meta API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawText = payload.text;
      const messageText =
        typeof rawText === "object" && rawText !== null
          ? rawText.body || ""
          : rawText || payload.body || "";
      const messageType = payload.type || "text";

      const metaPayload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: messageType,
      };

      if (messageType === "text") {
        metaPayload.text = {
          body: messageText,
        };
      } else if (["image", "video", "document", "audio"].includes(messageType)) {
        const mediaUrl = payload.mediaUrl || payload.url;
        const caption = payload.caption || payload.body || "";
        const filename = payload.fileName || payload.filename;

        metaPayload[messageType] = {
          link: mediaUrl,
          ...(caption ? { caption } : {}),
          ...(messageType === "document" && filename ? { filename } : {}),
        };
      } else if (messageType === "template") {
        const templateName = payload.name || payload.template?.name || payload.template_name;
        const templateLang = typeof payload.language === "object" && payload.language !== null
          ? payload.language.code
          : payload.language || payload.template?.language?.code || "en_US";
        const templateComponents = payload.components || payload.template?.components || [];

        metaPayload.template = {
          name: templateName,
          language: { code: templateLang },
          components: templateComponents,
        };
      }

      const metaEndpoint = `https://graph.facebook.com/v20.0/${finalPhoneId}/messages`;
      console.log(`Bridge [Meta] forwarding to: ${metaEndpoint}`);

      const response = await fetch(metaEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify(metaPayload),
      });

      const responseText = await response.text();
      console.log("Meta Graph API response status:", response.status, "body:", responseText);

      let result: any = {};
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { raw: responseText };
      }

      if (response.ok && result.messages && result.messages[0]) {
        return new Response(
          JSON.stringify({
            success: true,
            id: result.messages[0].id,
            wamid: result.messages[0].id,
            ...result,
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error?.message || "Failed to send message via Meta Graph API",
            ...result,
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // ── WhapiHub GET Requests (e.g. templates, contacts) ──
    if (req.method === "GET") {
      const resolvedPath = targetPath || "v2/whatsapp-business/templates";
      const queryString = url.search || "";
      const whapiEndpoint = `${baseUrl}/${resolvedPath}${queryString}`;
      console.log(`Bridge [GET] forwarding to: ${whapiEndpoint}`);

      const whapiResponse = await fetch(whapiEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      let whapiResult: any = {};
      const ct = whapiResponse.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        whapiResult = await whapiResponse.json().catch(() => ({}));
      } else {
        whapiResult = { raw: await whapiResponse.text().catch(() => "") };
      }

      console.log(
        `Bridge [GET] ${resolvedPath} →`,
        whapiResponse.status,
        JSON.stringify(whapiResult).slice(0, 300),
      );

      return new Response(JSON.stringify(whapiResult), {
        status: whapiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── WhapiHub POST/PUT Requests ──
    const resolvedPath = targetPath || "v2/whatsapp-business/messages";
    console.log(
      `Bridge [${req.method}] ${resolvedPath} (WhapiHub):`,
      JSON.stringify(payload, null, 2),
    );

    const to = payload.to?.replace(/[+\s-]/g, "");
    const rawText = payload.text;
    const messageText =
      typeof rawText === "object" && rawText !== null
        ? rawText.body || ""
        : rawText || payload.body || "";
    const messageType = payload.type || "text";

    const whapiPayload: any = {
      to: to,
      phoneNoId: phoneNoId,
      type: messageType,
    };

    if (messageType === "text") {
      whapiPayload.text = messageText;
    } else if (["image", "video", "document", "audio"].includes(messageType)) {
      whapiPayload.url = payload.mediaUrl || payload.url;
      whapiPayload.caption = payload.caption || payload.body || "";
      if (messageType === "document" && payload.fileName) {
        whapiPayload.filename = payload.fileName;
      }
    } else if (messageType === "template") {
      const templateName = payload.name || payload.template?.name || payload.template_name;
      const templateLang = typeof payload.language === "object" && payload.language !== null
        ? payload.language.code
        : payload.language || payload.template?.language?.code || "en_US";
      const templateComponents = payload.components || payload.template?.components || [];

      whapiPayload.name = templateName;
      whapiPayload.language = templateLang;
      whapiPayload.components = templateComponents;

      whapiPayload.template = {
        name: templateName,
        language: { code: templateLang },
        components: templateComponents,
      };
    }

    const whapiEndpoint = `${baseUrl}/${resolvedPath}`;
    console.log(`Forwarding to WhapiHub: ${whapiEndpoint}`, JSON.stringify(whapiPayload));

    const whapiResponse = await fetch(whapiEndpoint, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify(whapiPayload),
    });

    let whapiResult: any = {};
    const whapiContentType = whapiResponse.headers.get("content-type") || "";
    if (whapiContentType.includes("application/json")) {
      whapiResult = await whapiResponse.json().catch(() => ({}));
    } else {
      whapiResult = { raw: await whapiResponse.text().catch(() => "") };
    }

    return new Response(JSON.stringify(whapiResult), {
      status: whapiResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Bridge Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
