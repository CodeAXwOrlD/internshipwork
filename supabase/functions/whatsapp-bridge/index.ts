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

  if (req.method === "GET") {
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

    // 1. Get the path after the function name
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const bridgeIndex = pathParts.findIndex((p) => p === "whatsapp-bridge");
    let targetPath =
      pathParts.slice(bridgeIndex + 1).join("/") ||
      "v2/whatsapp-business/messages";

    // If targetPath is just an empty string or nothing, default to correct WhapiHub endpoint
    if (!targetPath || targetPath === "/") {
      targetPath = "v2/whatsapp-business/messages";
    }

    let payload: any = {};
    try {
      const rawBody = await req.text();
      if (rawBody && rawBody.trim().length > 0) {
        payload = JSON.parse(rawBody);
      }
    } catch {
      payload = {};
    }
    console.log(
      `Bridge [${req.method}] ${targetPath}:`,
      JSON.stringify(payload, null, 2),
    );

    // 2. Extract common fields
    const to = payload.to?.replace(/[+\s-]/g, "");
    const messageText = payload.text || payload.body || "";
    const clientId = payload.client_id;
    const appId = payload.application_id || payload.phoneNoId;

    const whapiToken =
      Deno.env.get("WHATSAPP_API_KEY") ||
      req.headers.get("Authorization")?.split(" ")[1];
    // Prefer an environment-configured API base URL (useful for staging/prod).
    // Default to WhapiHub gateway which exposes the public message endpoints.
    const baseUrl =
      Deno.env.get("WHATSAPP_API_BASE_URL") || "https://gate.whapi.cloud";

    if (!whapiToken) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Translate payload to WhapiHub format
    const messageType = payload.type || "text";
    const whapiPayload: any = {
      to: to,
      phoneNoId: payload.phoneNoId || payload.phone_id || payload.phoneNumberId,
      type: messageType,
    };

    if (messageType === "text") {
      whapiPayload.text = payload.text || payload.body || "";
    } else if (["image", "video", "document", "audio"].includes(messageType)) {
      whapiPayload.mediaUrl = payload.mediaUrl;
      whapiPayload.caption =
        payload.caption || payload.body || payload.text || "";
      if (payload.fileName) whapiPayload.fileName = payload.fileName;
    } else if (messageType === "template") {
      whapiPayload.name = payload.name || payload.template?.name;
      whapiPayload.language =
        payload.language || payload.template?.language?.code || "en_US";
    }

    const whapiEndpoint = `${baseUrl}/${targetPath}`;
    console.log(`Forwarding to: ${whapiEndpoint}`);

    const whapiResponse = await fetch(whapiEndpoint, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${whapiToken}`,
        Accept: "application/json",
      },
      body: req.method !== "GET" ? JSON.stringify(whapiPayload) : null,
    });

    let whapiResult: any = {};
    const whapiContentType = whapiResponse.headers.get("content-type") || "";
    if (whapiContentType.includes("application/json")) {
      whapiResult = await whapiResponse.json().catch(() => ({}));
    } else {
      whapiResult = { raw: await whapiResponse.text().catch(() => "") };
    }

    // 4. Save to Supabase (Only for outbound messages)
    if (
      whapiResponse.ok &&
      clientId &&
      req.method === "POST" &&
      targetPath.includes("messages")
    ) {
      const dbAppId =
        appId === "00000000-0000-0000-0000-000000000000" ? null : appId;

      const { error: dbError } = await supabaseClient
        .from("whatsapp_messages")
        .insert({
          client_id: clientId,
          application_id: dbAppId,
          phone_number: to,
          message_content: messageText,
          message_type: "text",
          direction: "outbound",
          status: "sent",
          external_id: whapiResult.id || whapiResult.message_id,
        });
      if (dbError) console.error("DB Save failed:", dbError);
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
