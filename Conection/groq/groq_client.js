/**
 * Groq AI Client Connector (JavaScript / Universal)
 * Tương thích cả Cloudflare Workers, Node.js và Google Apps Script (GAS).
 */

class GroqClientJS {
  constructor(apiKey, defaultModel = "llama-3.3-70b-versatile") {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.apiUrl = "https://api.groq.com/openai/v1/chat/completions";
  }

  /**
   * Gửi prompt tới Groq AI
   * @param {string} prompt
   * @param {string|null} systemPrompt
   * @param {object} options
   */
  async chat(prompt, systemPrompt = null, options = {}) {
    if (!this.apiKey) {
      throw new Error("Chưa cấu hình Groq API Key.");
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const payload = {
      model: options.model || this.defaultModel,
      messages: messages,
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      max_tokens: options.max_tokens || 2048
    };

    // 1. Nếu môi trường là Google Apps Script (GAS)
    if (typeof UrlFetchApp !== "undefined") {
      const response = UrlFetchApp.fetch(this.apiUrl, {
        method: "post",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const json = JSON.parse(response.getContentText());
      if (response.getResponseCode() !== 200) {
        throw new Error(`Groq API Error: ${JSON.stringify(json)}`);
      }
      return {
        success: true,
        content: json.choices[0].message.content,
        usage: json.usage,
        model: json.model
      };
    }

    // 2. Môi trường Cloudflare Workers hoặc Node.js (fetch API)
    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": "LDMega-GroqClientJS/1.0"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Groq Error ${res.status}: ${JSON.stringify(data)}`);
    }

    return {
      success: true,
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model
    };
  }
}

// Xuất module tương thích ES / CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = { GroqClientJS };
}
