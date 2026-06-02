import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle Meta GET Webhook verification challenge
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken =
      Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "pixora_verify_token";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified by Meta successfully.");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("Received Webhook Payload:", JSON.stringify(payload, null, 2));

    // ── Meta Graph API Webhook Handler ──
    if (payload.object === "whatsapp_business_account") {
      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value || value.messaging_product !== "whatsapp") continue;

          const recipientPhoneNumberId = value.metadata?.phone_number_id;

          // 1. Process Status Updates (sent, delivered, read, failed)
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const messageId = statusObj.id; // wamid
              const status = statusObj.status; // delivered, read, failed, etc.

              console.log(`Processing Meta status update: msg ${messageId} -> ${status}`);

              // Update the status of the message in the database matching wamid
              const { error: updateError } = await supabaseAdmin
                .from("whatsapp_messages")
                .update({ status })
                .or(`wamid.eq.${messageId},external_id.eq.${messageId}`);

              if (updateError) {
                console.warn(`Failed to update status for wamid ${messageId}:`, updateError.message);
              }
            }
          }

          // 2. Process Inbound Messages
          if (value.messages && Array.isArray(value.messages)) {
            for (const messageData of value.messages) {
              const senderPhoneNumber = messageData.from;
              const messageId = messageData.id;

              // Identify message type and content
              const msgType = messageData.type;
              let content = "";
              let mediaInfo: any = null;

              if (msgType === "text") {
                content = messageData.text?.body || "";
              } else if (["image", "video", "document", "audio"].includes(msgType)) {
                const media = messageData[msgType];
                content = media?.caption || `[Received ${msgType}]`;
                mediaInfo = {
                  media_id: media?.id,
                  mime_type: media?.mime_type,
                  sha256: media?.sha256,
                  filename: media?.filename,
                };
              } else if (msgType === "button") {
                content = messageData.button?.text || "";
              } else if (msgType === "interactive") {
                const interactive = messageData.interactive;
                if (interactive?.type === "button_reply") {
                  content = interactive.button_reply?.title || "";
                } else if (interactive?.type === "list_reply") {
                  content = interactive.list_reply?.title || "";
                }
              }

              // Extract sender name from contacts
              const contact = value.contacts?.find((c: any) => c.wa_id === senderPhoneNumber);
              const senderName = contact?.profile?.name || "WhatsApp User";

              console.log(
                `Processing Meta message from ${senderPhoneNumber} to ${recipientPhoneNumberId}: ${content}`,
              );

              // Find the application/bot by phone_number_id (checking both plural and singular)
              const { data: bot, error: botError } = await supabaseAdmin
                .from("whatsapp_applications")
                .select("*")
                .eq("phone_number_id", recipientPhoneNumberId)
                .maybeSingle();

              let finalBot = bot;
              if (botError || !bot) {
                const { data: singularBot } = await supabaseAdmin
                  .from("whatsapp_application")
                  .select("*")
                  .eq("phone_number_id", recipientPhoneNumberId)
                  .maybeSingle();
                finalBot = singularBot;
              }

              if (!finalBot) {
                console.error("Bot not found for phone_number_id:", recipientPhoneNumberId);
                continue;
              }

              if (finalBot.status !== "active") {
                console.log(
                  `Bot ${finalBot.name} (${finalBot.id}) is not active. Status: ${finalBot.status}. Ignoring message.`,
                );
                continue;
              }

              // Find client_id linked to this bot
              let clientId = finalBot.client_id;
              if (!clientId) {
                const { data: access } = await supabaseAdmin
                  .from("whatsapp_user_access")
                  .select("user_id")
                  .eq("application_id", finalBot.id)
                  .limit(1)
                  .maybeSingle();

                if (access) {
                  const { data: client } = await supabaseAdmin
                    .from("clients")
                    .select("id")
                    .eq("user_id", access.user_id)
                    .maybeSingle();
                  clientId = client?.id;
                }
              }

              if (!clientId) {
                console.error("Client not found for bot:", finalBot.id);
                continue;
              }

              // Store incoming message in database
              const { error: storeError } = await supabaseAdmin
                .from("whatsapp_messages")
                .insert({
                  application_id: finalBot.id,
                  client_id: clientId,
                  phone_number: senderPhoneNumber,
                  message_content: content,
                  direction: "inbound",
                  sender_name: senderName,
                  external_id: messageId,
                  status: "delivered",
                  wamid: messageId,
                  sent_at: new Date().toISOString(),
                  metadata: mediaInfo ? { media: mediaInfo } : null,
                });

              if (storeError) {
                console.error("Failed to store incoming message:", storeError.message);
              }

              // AI Chatbot Response Logic
              const openApiKey = Deno.env.get("OPENAI_API_KEY");
              if (openApiKey && content) {
                try {
                  const openai = new OpenAI({ apiKey: openApiKey });

                  // Fetch bot personality
                  const { data: aiBot } = await supabaseAdmin
                    .from("ai_chatbots")
                    .select("system_prompt, temperature, is_active")
                    .eq("client_id", clientId)
                    .limit(1)
                    .maybeSingle();

                  if (aiBot && aiBot.is_active === false) {
                    console.log("AI Chatbot is disabled for this client. Skipping response.");
                    continue;
                  }

                  const systemPrompt =
                    aiBot?.system_prompt ||
                    "You are a helpful and professional assistant for LeadNest. Answer queries concisely and kindly in the same language as the user.";
                  const temperature = aiBot?.temperature || 0.7;

                  // Fetch recent history
                  const { data: history } = await supabaseAdmin
                    .from("whatsapp_messages")
                    .select("direction, message_content")
                    .eq("phone_number", senderPhoneNumber)
                    .eq("application_id", finalBot.id)
                    .order("sent_at", { ascending: false })
                    .limit(10);

                  const chatHistory = (history || []).reverse().map((m) => ({
                    role: m.direction === "inbound" ? "user" : "assistant",
                    content: m.message_content,
                  }));

                  // Call OpenAI
                  const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                      { role: "system", content: systemPrompt },
                      ...chatHistory,
                    ],
                    temperature: Number(temperature),
                  });

                  const aiText = completion.choices[0].message.content;

                  if (aiText) {
                    console.log("AI Response:", aiText);

                    // Send AI response using Meta Graph API
                    const token =
                      finalBot.api_config?.meta_access_token ||
                      finalBot.api_config?.api_key ||
                      Deno.env.get("WHATSAPP_API_KEY");
                    const phoneId = finalBot.api_config?.phone_id;

                    if (token && phoneId) {
                      const metaSendUrl = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
                      const metaSendResponse = await fetch(metaSendUrl, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          messaging_product: "whatsapp",
                          recipient_type: "individual",
                          to: senderPhoneNumber,
                          type: "text",
                          text: { body: aiText },
                        }),
                      });

                      const metaSendResult = await metaSendResponse.json();
                      console.log("Meta AI Send Response:", metaSendResult);

                      const wamid = metaSendResult?.messages?.[0]?.id || null;

                      // Store AI response message in DB
                      await supabaseAdmin.from("whatsapp_messages").insert({
                        application_id: finalBot.id,
                        client_id: clientId,
                        phone_number: senderPhoneNumber,
                        message_content: aiText,
                        direction: "outbound",
                        sender_name: finalBot.name || "LeadNest AI",
                        status: metaSendResponse.ok ? "sent" : "failed",
                        sent_at: new Date().toISOString(),
                        wamid: wamid,
                        metadata: { ai_response: true, meta_id: wamid },
                      });
                    } else {
                      console.warn("No token or phone ID configured for Meta AI reply. Bot ID:", finalBot.id);
                    }
                  }
                } catch (aiErr) {
                  console.error("AI Generation Error for Meta webhook:", aiErr);
                }
              }
            }
          }
        }
      }
    } else {
      // ── WhapiHub (Original) Webhook Handler ──
      const dataArray = Array.isArray(payload) ? payload : [payload];

      for (const item of dataArray) {
        const body = item.body || item;
        if (body.event !== "message" && body.event !== "messages") continue;

        const messageData = body.data || (body.messages ? body.messages[0] : null);
        if (!messageData) continue;

        const senderPhoneNumber =
          messageData.senderPhoneNumber ||
          messageData.from ||
          messageData.chat_id?.split("@")[0];
        const recipientPhoneNumberId =
          messageData.recipientPhoneNumberId ||
          body.phone_id ||
          body.phone_number_id;
        const content =
          messageData.content?.text ||
          messageData.text?.body ||
          messageData.body ||
          "";
        const messageId = messageData.messageId || messageData.id;
        const senderName =
          messageData.senderName || messageData.from_name || "WhatsApp User";

        console.log(
          `Processing Whapi message from ${senderPhoneNumber} to ${recipientPhoneNumberId}: ${content}`,
        );

        // Find the application/bot by phone_number_id
        const { data: bot, error: botError } = await supabaseAdmin
          .from("whatsapp_applications")
          .select("*")
          .eq("phone_number_id", recipientPhoneNumberId)
          .maybeSingle();

        let finalBot = bot;
        if (botError || !bot) {
          const { data: singularBot } = await supabaseAdmin
            .from("whatsapp_application")
            .select("*")
            .eq("phone_number_id", recipientPhoneNumberId)
            .maybeSingle();
          finalBot = singularBot;
        }

        if (!finalBot) {
          console.error("Bot not found for recipientPhoneNumberId:", recipientPhoneNumberId);
          continue;
        }

        if (finalBot.status !== "active") {
          console.log(
            `Bot ${finalBot.name} (${finalBot.id}) is not active. Status: ${finalBot.status}. Ignoring message.`,
          );
          continue;
        }

        let clientId = finalBot.client_id;
        if (!clientId) {
          const { data: access } = await supabaseAdmin
            .from("whatsapp_user_access")
            .select("user_id")
            .eq("application_id", finalBot.id)
            .limit(1)
            .maybeSingle();

          if (access) {
            const { data: client } = await supabaseAdmin
              .from("clients")
              .select("id")
              .eq("user_id", access.user_id)
              .maybeSingle();
            clientId = client?.id;
          }
        }

        if (!clientId) {
          console.error("Client not found for bot:", finalBot.id);
          continue;
        }

        // Store incoming message
        const { data: storedMsg, error: storeError } = await supabaseAdmin
          .from("whatsapp_messages")
          .insert({
            application_id: finalBot.id,
            client_id: clientId,
            phone_number: senderPhoneNumber,
            message_content: content,
            direction: "inbound",
            sender_name: senderName,
            external_id: messageId,
            status: "delivered",
            sent_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (storeError) {
          console.error("Failed to store incoming message:", storeError);
        }

        // AI Chatbot Response
        const openApiKey = Deno.env.get("OPENAI_API_KEY");
        if (openApiKey && content) {
          try {
            const openai = new OpenAI({ apiKey: openApiKey });

            const { data: aiBot } = await supabaseAdmin
              .from("ai_chatbots")
              .select("system_prompt, temperature, is_active")
              .eq("client_id", clientId)
              .limit(1)
              .maybeSingle();

            if (aiBot && aiBot.is_active === false) {
              console.log("AI Chatbot is disabled for this client. Skipping response.");
              continue;
            }

            const systemPrompt =
              aiBot?.system_prompt ||
              "You are a helpful and professional assistant for LeadNest. Answer queries concisely and kindly in the same language as the user.";
            const temperature = aiBot?.temperature || 0.7;

            const { data: history } = await supabaseAdmin
              .from("whatsapp_messages")
              .select("direction, message_content")
              .eq("phone_number", senderPhoneNumber)
              .eq("application_id", finalBot.id)
              .order("sent_at", { ascending: false })
              .limit(10);

            const chatHistory = (history || []).reverse().map((m) => ({
              role: m.direction === "inbound" ? "user" : "assistant",
              content: m.message_content,
            }));

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                ...chatHistory,
              ],
              temperature: Number(temperature),
            });

            const aiText = completion.choices[0].message.content;

            if (aiText) {
              console.log("AI Response:", aiText);

              const apiKey =
                finalBot.api_config?.api_key || Deno.env.get("WHATSAPP_API_KEY");

              if (apiKey) {
                const whapiRes = await fetch(
                  "https://app.whapihub.com/api/v2/whatsapp-business/messages",
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      to: senderPhoneNumber,
                      phoneNoId: finalBot.api_config?.phone_id,
                      type: "text",
                      text: aiText,
                    }),
                  },
                );

                const whapiResult = await whapiRes.json();
                console.log("Whapi Response:", whapiResult);

                await supabaseAdmin.from("whatsapp_messages").insert({
                  application_id: finalBot.id,
                  client_id: clientId,
                  phone_number: senderPhoneNumber,
                  message_content: aiText,
                  direction: "outbound",
                  sender_name: finalBot.name || "LeadNest AI",
                  status: whapiRes.ok ? "sent" : "failed",
                  sent_at: new Date().toISOString(),
                  metadata: { ai_response: true, whapi_id: whapiResult.id },
                });
              } else {
                console.warn("No WhatsApp API key found for bot:", finalBot.id);
              }
            }
          } catch (aiErr) {
            console.error("AI Generation Error:", aiErr);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
