/**
 * Telegram Bot Connector (JavaScript / Universal)
 * Tương thích Cloudflare Workers, Node.js và Google Apps Script (GAS).
 */

class TelegramClientJS {
  constructor(botToken, defaultChatId = null) {
    this.botToken = botToken;
    this.defaultChatId = defaultChatId;
    this.baseUrl = botToken ? `https://api.telegram.org/bot${botToken}` : null;
  }

  /**
   * Gửi tin nhắn Telegram
   * @param {string} text
   * @param {string|number|null} chatId
   * @param {string} parseMode
   */
  async sendMessage(text, chatId = null, parseMode = "HTML") {
    const targetChat = chatId || this.defaultChatId;
    if (!this.baseUrl || !targetChat) {
      throw new Error("Thiếu botToken hoặc targetChat.");
    }

    const payload = {
      chat_id: targetChat,
      text: text,
      parse_mode: parseMode
    };

    const url = `${this.baseUrl}/sendMessage`;

    // Môi trường Google Apps Script
    if (typeof UrlFetchApp !== "undefined") {
      const response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      return JSON.parse(response.getContentText());
    }

    // Môi trường Cloudflare Workers / Node.js
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  /**
   * Kiểm tra thông tin Bot
   */
  async getMe() {
    if (!this.baseUrl) throw new Error("Chưa cấu hình botToken.");
    const url = `${this.baseUrl}/getMe`;

    if (typeof UrlFetchApp !== "undefined") {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      return JSON.parse(response.getContentText());
    }

    const res = await fetch(url);
    return await res.json();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TelegramClientJS };
}
