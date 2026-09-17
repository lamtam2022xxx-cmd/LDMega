/**
 * Cloudflare Worker Backend for LDMega
 * Xử lý: Groq AI Proxy, Telegram Bot Webhook, Health Check & CORS
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Health check & thông tin API
      if (pathname === "/" || pathname === "/api/health") {
        return new Response(
          JSON.stringify({
            status: "online",
            project: "LDMega Cloudflare Backend",
            endpoints: [
              "POST /api/chat - Hỏi đáp Groq AI (Llama 3.3)",
              "POST /api/telegram/send - Gửi tin nhắn Telegram",
              "POST /api/telegram/webhook - Webhook nhận sự kiện Telegram",
              "GET  /api/status - Kiểm tra trạng thái các dịch vụ"
            ],
            timestamp: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Chat với Groq AI (Proxy siêu tốc)
      if (pathname === "/api/chat" && request.method === "POST") {
        const body = await request.json();
        const apiKey = env.GROQ_API_KEY;

        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "Chưa cấu hình GROQ_API_KEY trong Worker Secrets." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const model = body.model || env.GROQ_DEFAULT_MODEL || "llama-3.3-70b-versatile";
        const prompt = body.prompt || "Xin chào";
        const systemPrompt = body.system_prompt || "Bạn là trợ lý AI thông minh của hệ thống LDMega.";

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "User-Agent": "LDMega-CloudflareWorker/1.0"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            temperature: body.temperature || 0.7,
            max_tokens: body.max_tokens || 2048
          })
        });

        const groqData = await groqRes.json();
        return new Response(JSON.stringify(groqData), {
          status: groqRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. Gửi tin nhắn Telegram
      if (pathname === "/api/telegram/send" && request.method === "POST") {
        const body = await request.json();
        const botToken = env.TELEGRAM_BOT_TOKEN;
        const chatId = body.chat_id || env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
          return new Response(
            JSON.stringify({ error: "Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: body.message || "Thông báo từ LDMega Cloudflare Worker",
            parse_mode: body.parse_mode || "HTML"
          })
        });

        const tgData = await tgRes.json();
        return new Response(JSON.stringify(tgData), {
          status: tgRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 4. Webhook nhận tin nhắn Telegram và tự động trả lời bằng Groq AI!
      if (pathname === "/api/telegram/webhook" && request.method === "POST") {
        const update = await request.json();
        if (update.message && update.message.text) {
          const chatId = update.message.chat.id;
          const userText = update.message.text;

          // Nếu có GROQ_API_KEY, gọi AI trả lời
          if (env.GROQ_API_KEY && env.TELEGRAM_BOT_TOKEN) {
            ctx.waitUntil(
              (async () => {
                try {
                  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${env.GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                      model: env.GROQ_DEFAULT_MODEL || "llama-3.3-70b-versatile",
                      messages: [
                        { role: "system", content: "Bạn là AI Bot Telegram của LDMega, trả lời ngắn gọn, thông minh." },
                        { role: "user", content: userText }
                      ]
                    })
                  });
                  const groqData = await groqRes.json();
                  const replyText = groqData.choices?.[0]?.message?.content || "Không nhận được phản hồi từ AI.";

                  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: replyText })
                  });
                } catch (e) {
                  console.error("Lỗi webhook processing:", e);
                }
              })()
            );
          }
        }
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // 404
      return new Response(
        JSON.stringify({ error: "Endpoint không tồn tại", path: pathname }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message, stack: err.stack }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
};
