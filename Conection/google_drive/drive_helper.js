/**
 * Google Drive Helper (JavaScript)
 * Cung cấp tiện ích tương tác với Google Drive cho cả Google Apps Script và Cloudflare.
 */

class GoogleDriveHelperJS {
  /**
   * Phương thức dành riêng cho Google Apps Script (sử dụng DriveApp gốc)
   */
  static gas = {
    /**
     * Tìm hoặc tạo thư mục trong Google Drive
     * @param {string} folderName
     * @param {string|null} parentFolderId
     */
    getOrCreateFolder(folderName, parentFolderId = null) {
      if (typeof DriveApp === "undefined") {
        throw new Error("Phương thức này chỉ khả dụng trong môi trường Google Apps Script.");
      }

      const parent = parentFolderId 
        ? DriveApp.getFolderById(parentFolderId) 
        : DriveApp.getRootFolder();

      const folders = parent.getFoldersByName(folderName);
      if (folders.hasNext()) {
        return folders.next();
      }
      return parent.createFolder(folderName);
    },

    /**
     * Tạo file văn bản trong thư mục Drive
     * @param {string} folderId
     * @param {string} fileName
     * @param {string} content
     * @param {string} mimeType
     */
    createFile(folderId, fileName, content, mimeType = "text/plain") {
      if (typeof DriveApp === "undefined") {
        throw new Error("Phương thức này chỉ khả dụng trong môi trường Google Apps Script.");
      }

      const folder = DriveApp.getFolderById(folderId);
      return folder.createFile(fileName, content, mimeType);
    }
  };

  /**
   * Phương thức REST API (dành cho Cloudflare Worker hoặc Node.js)
   */
  static async listFilesREST(accessToken, folderId = null) {
    let url = "https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,webViewLink)";
    if (folderId) {
      url += `&q='${folderId}'+in+parents+and+trashed=false`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return await res.json();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { GoogleDriveHelperJS };
}
