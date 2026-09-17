/**
 * ==============================================================================
 * LDMega - Google Apps Script Integration Hub
 * Kết nối sẵn: Groq AI, Telegram Bot, Google Drive & Web App API
 * ==============================================================================
 */

// Đọc cấu hình từ Script Properties (Cài đặt trong Project Settings của GAS)
function getProperty(key, defaultValue = "") {
  return PropertiesService.getScriptProperties().getProperty(key) || defaultValue;
}

/**
 * Tạo Menu khi mở Google Sheets hoặc Docs
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi ? SpreadsheetApp.getUi() : null;
  if (ui) {
    ui.createMenu("🚀 LDMega Hub")
      .addItem("🤖 Hỏi Groq AI", "menuAskGroq")
      .addItem("📢 Gửi thông báo Telegram", "menuSendTelegram")
      .addItem("📁 Lưu dữ liệu vào Drive", "menuBackupDrive")
      .addToUi();
  }
}

/**
 * 1. KẾT NỐI GROQ AI (Llama 3.3 siêu tốc)
 */
function callGroqAI(prompt, systemPrompt = "Bạn là trợ lý ảo thông minh của LDMega.") {
  const apiKey = getProperty("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("Vui lòng cấu hình GROQ_API_KEY trong Project Settings > Script Properties.");
  }

  const url = "https://api.groq.com/openai/v1/chat/completions";
  const payload = {
    model: getProperty("GROQ_MODEL", "llama-3.3-70b-versatile"),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2048
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const json = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) {
    throw new Error("Groq API Error: " + response.getContentText());
  }

  return json.choices[0].message.content;
}

/**
 * 2. KẾT NỐI TELEGRAM BOT
 */
function sendTelegramNotification(text, customChatId = null) {
  const botToken = getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = customChatId || getProperty("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    throw new Error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong Script Properties.");
  }

  const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return JSON.parse(response.getContentText());
}

/**
 * 3. KẾT NỐI GOOGLE DRIVE
 */
function backupToGoogleDrive(fileName, content, folderName = "LDMega_Backups") {
  const folders = DriveApp.getFoldersByName(folderName);
  let targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const file = targetFolder.createFile(fileName, content, MimeType.PLAIN_TEXT);
  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl()
  };
}

/**
 * 4. WEB APP ENDPOINTS (doGet & doPost)
 * Cho phép Cloudflare Worker hoặc các hệ thống khác gọi vào GAS qua HTTP REST API
 */
function doGet(e) {
  const action = e.parameter.action || "ping";
  let result = { status: "success", action: action, timestamp: new Date().toISOString() };

  if (action === "ping") {
    result.message = "LDMega Apps Script Web App đang hoạt động tốt!";
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let responseData = {};

    if (action === "groq_chat") {
      const answer = callGroqAI(data.prompt, data.system_prompt);
      responseData = { success: true, answer: answer };
    } else if (action === "send_telegram") {
      const tgRes = sendTelegramNotification(data.message, data.chat_id);
      responseData = { success: true, telegram: tgRes };
    } else if (action === "backup_drive") {
      const file = backupToGoogleDrive(data.file_name, data.content, data.folder_name);
      responseData = { success: true, file: file };
    } else {
      responseData = { success: false, error: "Hành động không hợp lệ: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Menu actions mẫu
function menuAskGroq() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("Hỏi Groq AI", "Nhập câu hỏi bạn muốn Groq trả lời:", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() === ui.Button.OK) {
    const answer = callGroqAI(res.getResponseText());
    ui.alert("Trả lời từ Groq", answer, ui.ButtonSet.OK);
  }
}

function menuSendTelegram() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("Gửi Telegram", "Nhập thông điệp cần gửi đến nhóm:", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() === ui.Button.OK) {
    sendTelegramNotification(res.getResponseText());
    ui.alert("Thông báo", "Đã gửi tin nhắn đến Telegram thành công!", ui.ButtonSet.OK);
  }
}

function menuBackupDrive() {
  const ui = SpreadsheetApp.getUi();
  const file = backupToGoogleDrive("backup_" + new Date().getTime() + ".txt", "Bản lưu trữ dữ liệu từ LDMega Hub");
  ui.alert("Đã lưu Drive", "Tệp đã được tạo tại: " + file.url, ui.ButtonSet.OK);
}
