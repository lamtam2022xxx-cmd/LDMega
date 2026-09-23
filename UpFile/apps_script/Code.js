/**
 * ==============================================================================
 * UpFile - Google Apps Script Engine
 * Xử lý tải lên tệp vào Google Drive từ Telegram Bot & Web App Link Script
 * 
 * Thư mục Drive mục tiêu:
 * https://drive.google.com/drive/folders/1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I
 * ==============================================================================
 */

// Cấu hình ID thư mục mặc định
const DEFAULT_FOLDER_ID = "1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I";

/**
 * Đọc cấu hình từ Script Properties
 */
function getSetting(key, defaultValue = "") {
  return PropertiesService.getScriptProperties().getProperty(key) || defaultValue;
}

/**
 * Lấy đối tượng Folder Google Drive đích
 */
function getTargetFolder() {
  const folderId = getSetting("DRIVE_FOLDER_ID", DEFAULT_FOLDER_ID);
  try {
    return DriveApp.getFolderById(folderId);
  } catch (err) {
    Logger.log("Lỗi tìm thư mục theo ID: " + err.message);
    // Nếu chưa truy cập được folderId, tạo hoặc dùng thư mục mặc định
    const folders = DriveApp.getFoldersByName("LDMega_Uploads");
    return folders.hasNext() ? folders.next() : DriveApp.createFolder("LDMega_Uploads");
  }
}

/**
 * 1. WEB APP INTERFACE (doGet)
 * Cho phép mở "Link Script" trên trình duyệt để kéo thả upload file
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

  if (action === "ping" || action === "status") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "active",
      folder_id: getSetting("DRIVE_FOLDER_ID", DEFAULT_FOLDER_ID),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Render giao diện Web Upload hiện đại
  const template = HtmlService.createTemplateFromFile("upload_ui");
  return template.evaluate()
    .setTitle("LDMega - Cổng Tải Lên Tệp Google Drive")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 2. WEB APP API & TELEGRAM WEBHOOK (doPost)
 * Tiếp nhận file qua API (Base64) hoặc Webhook từ Telegram Bot
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Dữ liệu trống" }, 400);
    }

    const rawData = e.postData.contents;
    let payload;
    try {
      payload = JSON.parse(rawData);
    } catch (parseErr) {
      return createJsonResponse({ success: false, error: "Định dạng JSON không hợp lệ" }, 400);
    }

    // Trường hợp A: Dữ liệu gửi đến từ Telegram Webhook
    if (payload.update_id && (payload.message || payload.channel_post)) {
      return handleTelegramUpdate(payload.message || payload.channel_post);
    }

    // Trường hợp B: Dữ liệu gửi từ Webhook / REST API tải lên tệp
    if (payload.action === "upload_file" || payload.base64_data) {
      const res = saveBase64File(payload.file_name, payload.base64_data, payload.mime_type);
      return createJsonResponse(res);
    }

    return createJsonResponse({ success: false, error: "Hành động không được hỗ trợ" });
  } catch (err) {
    Logger.log("Lỗi doPost: " + err.toString());
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * 3. HÀM GỌI TỪ GIAO DIỆN WEB (google.script.run)
 */
function uploadFileFromWeb(fileData) {
  try {
    return saveBase64File(fileData.name, fileData.base64, fileData.type);
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Lưu tệp từ Base64 vào thư mục Google Drive
 */
function saveBase64File(fileName, base64Data, mimeType = "application/octet-stream") {
  const targetFolder = getTargetFolder();
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const file = targetFolder.createFile(blob);

  // Cấp quyền bất kỳ ai có link đều có thể xem (tùy chọn)
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Bỏ qua nếu tổ chức chặn chia sẻ công khai
  }

  return {
    success: true,
    file: {
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      size: file.getSize(),
      mime_type: file.getMimeType()
    }
  };
}

/**
 * 4. XỬ LÝ SỰ KIỆN TỪ TELEGRAM BOT
 */
function handleTelegramUpdate(msg) {
  const chatId = msg.chat.id;
  const botToken = getSetting("TELEGRAM_BOT_TOKEN");

  if (!botToken) {
    Logger.log("Chưa cấu hình TELEGRAM_BOT_TOKEN trong Script Properties");
    return createJsonResponse({ success: false, error: "Missing TELEGRAM_BOT_TOKEN" });
  }

  // 1. Phản hồi các lệnh văn bản thông thường
  if (msg.text) {
    const text = msg.text.trim();
    if (text.startsWith("/start") || text.startsWith("/help")) {
      const welcome = "👋 <b>Chào mừng bạn đến với LDMega UpFile Bot!</b>\n\n" +
        "📁 Thư mục Google Drive lưu trữ:\n" +
        "<a href=\"https://drive.google.com/drive/folders/" + DEFAULT_FOLDER_ID + "\">Nhấp vào đây để xem thư mục Drive</a>\n\n" +
        "🚀 <b>Cách sử dụng:</b>\n" +
        "Hãy gửi trực tiếp bất kỳ tệp nào vào đoạn chat này (Tài liệu PDF/Word/Excel, Ảnh, Video, File nén ZIP...).\n" +
        "Bot sẽ tự động tải lên Google Drive và gửi lại link cho bạn ngay tức thì!";
      sendTelegramMessage(botToken, chatId, welcome);
      return createJsonResponse({ success: true, action: "welcome_sent" });
    }
  }

  // 2. Phát hiện và xử lý tệp đính kèm
  let fileId = null;
  let fileName = "upload_" + new Date().getTime();
  let fileSize = 0;

  if (msg.document) {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || fileName;
    fileSize = msg.document.file_size || 0;
  } else if (msg.photo && msg.photo.length > 0) {
    // Lấy ảnh có độ phân giải cao nhất (phần tử cuối)
    const bestPhoto = msg.photo[msg.photo.length - 1];
    fileId = bestPhoto.file_id;
    fileName = "photo_" + new Date().getTime() + ".jpg";
    fileSize = bestPhoto.file_size || 0;
  } else if (msg.video) {
    fileId = msg.video.file_id;
    fileName = msg.video.file_name || ("video_" + new Date().getTime() + ".mp4");
    fileSize = msg.video.file_size || 0;
  } else if (msg.audio) {
    fileId = msg.audio.file_id;
    fileName = msg.audio.file_name || ("audio_" + new Date().getTime() + ".mp3");
    fileSize = msg.audio.file_size || 0;
  } else if (msg.voice) {
    fileId = msg.voice.file_id;
    fileName = "voice_" + new Date().getTime() + ".ogg";
    fileSize = msg.voice.file_size || 0;
  }

  if (!fileId) {
    sendTelegramMessage(botToken, chatId, "ℹ️ Vui lòng gửi một <b>tệp đính kèm</b> (tài liệu, hình ảnh, file nén, video...) để tải lên Google Drive.");
    return createJsonResponse({ success: true, note: "No file found" });
  }

  // Thông báo bắt đầu xử lý
  sendTelegramMessage(botToken, chatId, "⏳ Đang tải tệp <b>" + escapeHtml(fileName) + "</b> lên Google Drive...");

  try {
    // Lấy link tải tệp từ Telegram Bot API
    const getFileUrl = "https://api.telegram.org/bot" + botToken + "/getFile?file_id=" + fileId;
    const fileInfoRes = UrlFetchApp.fetch(getFileUrl, { muteHttpExceptions: true });
    const fileInfo = JSON.parse(fileInfoRes.getContentText());

    if (!fileInfo.ok || !fileInfo.result.file_path) {
      sendTelegramMessage(botToken, chatId, "❌ Lỗi: Không thể lấy đường dẫn tệp từ Telegram. Tệp có thể vượt quá dung lượng cho phép của bot.");
      return createJsonResponse({ success: false, error: "GetFile failed" });
    }

    // Tải file trực tiếp từ máy chủ Telegram
    const downloadUrl = "https://api.telegram.org/file/bot" + botToken + "/" + fileInfo.result.file_path;
    const fileBlob = UrlFetchApp.fetch(downloadUrl).getBlob().setName(fileName);

    // Lưu vào thư mục Google Drive
    const targetFolder = getTargetFolder();
    const driveFile = targetFolder.createFile(fileBlob);

    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}

    // Gửi tin nhắn thành công kèm liên kết
    const successMsg = "✅ <b>Tải lên Google Drive thành công!</b>\n\n" +
      "📄 <b>Tên tệp:</b> " + escapeHtml(driveFile.getName()) + "\n" +
      "📦 <b>Dung lượng:</b> " + formatBytes(driveFile.getSize()) + "\n" +
      "🔗 <b>Link xem tệp:</b> <a href=\"" + driveFile.getUrl() + "\">Mở trên Google Drive</a>\n" +
      "📁 <b>Thư mục:</b> <a href=\"https://drive.google.com/drive/folders/" + DEFAULT_FOLDER_ID + "\">Xem toàn bộ thư mục</a>";

    sendTelegramMessage(botToken, chatId, successMsg);
    return createJsonResponse({ success: true, file_id: driveFile.getId(), url: driveFile.getUrl() });

  } catch (err) {
    Logger.log("Lỗi tải tệp: " + err.toString());
    sendTelegramMessage(botToken, chatId, "❌ Đã có lỗi xảy ra khi lưu tệp vào Google Drive:\n<code>" + escapeHtml(err.toString()) + "</code>");
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Gửi tin nhắn Telegram kèm định dạng HTML
 */
function sendTelegramMessage(botToken, chatId, text) {
  const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: false
  };

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * Thiết lập Telegram Webhook nhanh chóng qua hàm Apps Script
 * Chạy hàm này một lần sau khi deploy Web App
 */
function setupTelegramWebhook() {
  const botToken = getSetting("TELEGRAM_BOT_TOKEN");
  const webAppUrl = getSetting("GAS_WEBAPP_URL");

  if (!botToken || !webAppUrl) {
    Logger.log("Cần điền TELEGRAM_BOT_TOKEN và GAS_WEBAPP_URL vào Script Properties trước.");
    return "Thiếu cấu hình TELEGRAM_BOT_TOKEN hoặc GAS_WEBAPP_URL";
  }

  const url = "https://api.telegram.org/bot" + botToken + "/setWebhook?url=" + encodeURIComponent(webAppUrl);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log("Kết quả setWebhook: " + response.getContentText());
  return response.getContentText();
}

/**
 * Hàm kiểm tra nhanh quyền truy cập thư mục Google Drive
 */
function testDriveAccess() {
  const folder = getTargetFolder();
  Logger.log("Thư mục kết nối: " + folder.getName() + " (ID: " + folder.getId() + ")");
  const testFile = folder.createFile("test_connection_" + new Date().getTime() + ".txt", "LDMega UpFile Test");
  Logger.log("Tệp test đã tạo: " + testFile.getUrl());
  return { status: "OK", url: testFile.getUrl() };
}

// Tiện ích
function createJsonResponse(obj, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
