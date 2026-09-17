// Client App Logic for Cloudflare Pages Dashboard

document.addEventListener("DOMContentLoaded", () => {
  const btnSendAi = document.getElementById("btn-send-ai");
  const aiInput = document.getElementById("ai-input");
  const chatMessages = document.getElementById("chat-messages");

  const btnSendTg = document.getElementById("btn-send-tg");
  const tgMsg = document.getElementById("tg-msg");
  const tgResult = document.getElementById("tg-result");

  // Xử lý gửi chat Groq AI
  btnSendAi.addEventListener("click", async () => {
    const text = aiInput.value.trim();
    if (!text) return;

    appendMessage("user", text);
    aiInput.value = "";

    const loadingMsg = appendMessage("bot", "Đang xử lý qua Groq Llama 3.3...");

    try {
      // Gọi API backend (nếu chạy local hoặc sau khi deploy Cloudflare Worker)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || JSON.stringify(data);
        loadingMsg.textContent = content;
      } else {
        loadingMsg.textContent = `[Demo Mode / Chưa cấu hình Backend API]: Bạn vừa hỏi "${text}". Hãy cấu hình GROQ_API_KEY trên Cloudflare Worker để nhận câu trả lời thật!`;
      }
    } catch (err) {
      loadingMsg.textContent = `[Demo Frontend]: Đã nhận câu hỏi "${text}". Kết nối Worker Backend để kích hoạt gọi trực tiếp.`;
    }
  });

  aiInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") btnSendAi.click();
  });

  // Xử lý gửi tin nhắn Telegram
  btnSendTg.addEventListener("click", async () => {
    const text = tgMsg.value.trim();
    if (!text) return;

    btnSendTg.disabled = true;
    btnSendTg.textContent = "Đang gửi...";

    try {
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      tgResult.classList.remove("hidden");
      if (res.ok) {
        tgResult.className = "result-box success";
        tgResult.textContent = "✅ Đã gửi tin nhắn đến Telegram Bot thành công!";
        tgMsg.value = "";
      } else {
        tgResult.className = "result-box success";
        tgResult.textContent = "ℹ️ Yêu cầu gửi đã được ghi nhận. Hãy cấu hình TELEGRAM_BOT_TOKEN để hoàn tất.";
      }
    } catch (err) {
      tgResult.classList.remove("hidden");
      tgResult.className = "result-box success";
      tgResult.textContent = "ℹ️ [Chế độ thử nghiệm]: Tin nhắn '" + text + "' sẵn sàng được gửi khi kết nối Worker.";
    } finally {
      btnSendTg.disabled = false;
      btnSendTg.textContent = "Gửi Telegram ngay";
    }
  });

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }
});
