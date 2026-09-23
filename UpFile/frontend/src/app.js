/**
 * app.js — Frontend Main Application
 * Điều phối toàn bộ luồng UI:
 * 1. Google Sign-In
 * 2. Tải danh sách phòng ban được phép
 * 3. Browse subfolder
 * 4. Chọn file và upload với progress
 * 5. Thông báo hoàn tất + link Drive
 */

import { initGoogleAuth, renderSignInButton, getIdToken, getCurrentUser, signOut } from "./auth.js";
import { fetchMe, fetchFolders, startUploadSession, completeUpload } from "./api.js";
import { resumableUpload, formatBytes } from "./uploader.js";

// ================================================================
// State
// ================================================================
let state = {
  user: null,
  idToken: null,
  departments: [],         // [{key, label, folderId}]
  selectedDept: null,
  currentFolderId: null,
  folderPath: [],          // Breadcrumb [{id, name}]
  selectedFile: null,
  uploadController: null,  // AbortController
  isUploading: false,
};

// ================================================================
// DOM references (injected sau khi DOM ready)
// ================================================================
let dom = {};

// ================================================================
// Init
// ================================================================
export function init() {
  dom = {
    signInSection:    document.getElementById("sign-in-section"),
    signInBtn:        document.getElementById("sign-in-btn"),
    appSection:       document.getElementById("app-section"),
    userAvatar:       document.getElementById("user-avatar"),
    userName:         document.getElementById("user-name"),
    userEmail:        document.getElementById("user-email"),
    signOutBtn:       document.getElementById("sign-out-btn"),
    deptList:         document.getElementById("dept-list"),
    folderBrowser:    document.getElementById("folder-browser"),
    folderPath:       document.getElementById("folder-path"),
    folderList:       document.getElementById("folder-list"),
    dropzone:         document.getElementById("dropzone"),
    fileInput:        document.getElementById("file-input"),
    fileInfo:         document.getElementById("file-info"),
    fileName:         document.getElementById("file-name"),
    fileSize:         document.getElementById("file-size"),
    uploadBtn:        document.getElementById("upload-btn"),
    progressSection:  document.getElementById("progress-section"),
    progressBar:      document.getElementById("progress-bar"),
    progressText:     document.getElementById("progress-text"),
    progressSpeed:    document.getElementById("progress-speed"),
    resultSection:    document.getElementById("result-section"),
    resultLink:       document.getElementById("result-link"),
    resultFileName:   document.getElementById("result-file-name"),
    uploadAnother:    document.getElementById("upload-another"),
    errorBanner:      document.getElementById("error-banner"),
    errorMsg:         document.getElementById("error-msg"),
    loadingOverlay:   document.getElementById("loading-overlay"),
  };

  // Khởi tạo Google Sign-In
  initGoogleAuth(handleSignIn);
  renderSignInButton(dom.signInBtn);

  // Event listeners
  dom.signOutBtn?.addEventListener("click", handleSignOut);
  dom.dropzone?.addEventListener("click", () => dom.fileInput?.click());
  dom.dropzone?.addEventListener("dragover", e => { e.preventDefault(); dom.dropzone.classList.add("drag-over"); });
  dom.dropzone?.addEventListener("dragleave",  () => dom.dropzone.classList.remove("drag-over"));
  dom.dropzone?.addEventListener("drop", e => {
    e.preventDefault();
    dom.dropzone.classList.remove("drag-over");
    handleFileSelected(e.dataTransfer.files[0]);
  });
  dom.fileInput?.addEventListener("change", e => handleFileSelected(e.target.files[0]));
  dom.uploadBtn?.addEventListener("click", handleUpload);
  dom.uploadAnother?.addEventListener("click", resetToUploadState);

  // Cancel upload
  document.getElementById("cancel-btn")?.addEventListener("click", () => {
    state.uploadController?.abort();
  });
}

// ================================================================
// Auth Handlers
// ================================================================
async function handleSignIn(userInfo, idToken) {
  state.user = userInfo;
  state.idToken = idToken;

  showLoading(true);
  hideError();

  try {
    const me = await fetchMe(idToken);
    state.departments = me.departments || [];

    renderUserInfo(me);
    renderDepartments(state.departments);

    show(dom.appSection);
    hide(dom.signInSection);
  } catch (err) {
    showError(`Lỗi tải thông tin: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

function handleSignOut() {
  signOut();
  state = { ...state, user: null, idToken: null, departments: [], selectedDept: null,
    currentFolderId: null, folderPath: [], selectedFile: null };
  show(dom.signInSection);
  hide(dom.appSection);
  resetToUploadState();
}

// ================================================================
// Department Selection
// ================================================================
function renderDepartments(departments) {
  if (!dom.deptList) return;

  if (departments.length === 0) {
    dom.deptList.innerHTML = `
      <div class="no-permission">
        <span class="icon">🔒</span>
        <p>Tài khoản của bạn chưa được cấp quyền upload vào phòng ban nào.<br>
        Vui lòng liên hệ quản trị viên.</p>
      </div>`;
    return;
  }

  dom.deptList.innerHTML = departments.map(dept => `
    <button class="dept-btn" data-key="${dept.key}" data-folder="${dept.folderId}">
      <span class="dept-icon">📁</span>
      <span class="dept-label">${dept.label}</span>
      <span class="dept-arrow">›</span>
    </button>
  `).join("");

  dom.deptList.querySelectorAll(".dept-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".dept-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectDepartment(btn.dataset.key, btn.dataset.folder);
    });
  });
}

async function selectDepartment(deptKey, rootFolderId) {
  state.selectedDept = deptKey;
  state.currentFolderId = rootFolderId;
  state.folderPath = [{ id: rootFolderId, name: deptKey }];
  state.selectedFile = null;

  hide(dom.fileInfo);
  hide(dom.uploadBtn);
  renderBreadcrumb();
  await loadFolders(rootFolderId);
  show(dom.folderBrowser);
}

async function loadFolders(parentId) {
  if (!dom.folderList) return;
  dom.folderList.innerHTML = `<div class="loading-folders">Đang tải...</div>`;

  try {
    const result = await fetchFolders(parentId, state.selectedDept, state.idToken);
    renderFolderList(result.folders || [], parentId);
  } catch (err) {
    dom.folderList.innerHTML = `<div class="folder-error">Lỗi tải thư mục: ${err.message}</div>`;
  }
}

function renderFolderList(folders, currentId) {
  const hasFolders = folders.length > 0;
  const isRoot = state.folderPath.length === 1;

  let html = "";

  // Nút Upload vào thư mục hiện tại
  html += `<button class="folder-item folder-select-current" onclick="window._selectCurrentFolder('${currentId}')">
    <span class="folder-icon">📤</span>
    <span>Upload vào thư mục này</span>
  </button>`;

  if (hasFolders) {
    html += folders.map(f => `
      <button class="folder-item" onclick="window._navigateFolder('${f.id}', '${escapeHtml(f.name)}')">
        <span class="folder-icon">📁</span>
        <span>${escapeHtml(f.name)}</span>
        <span class="folder-arrow">›</span>
      </button>
    `).join("");
  } else {
    html += `<div class="no-subfolders">Không có thư mục con</div>`;
  }

  dom.folderList.innerHTML = html;

  // Expose handlers cho inline onclick
  window._selectCurrentFolder = (folderId) => {
    state.currentFolderId = folderId;
    show(dom.dropzone);
    show(dom.fileInput?.parentElement || dom.dropzone);
    dom.dropzone?.classList.add("selected");
  };

  window._navigateFolder = async (folderId, folderName) => {
    state.folderPath.push({ id: folderId, name: folderName });
    state.currentFolderId = folderId;
    renderBreadcrumb();
    await loadFolders(folderId);
  };
}

function renderBreadcrumb() {
  if (!dom.folderPath) return;
  dom.folderPath.innerHTML = state.folderPath.map((item, idx) => {
    const isLast = idx === state.folderPath.length - 1;
    if (isLast) return `<span class="breadcrumb-current">${escapeHtml(item.name)}</span>`;
    return `<button class="breadcrumb-link" onclick="window._jumpToPath(${idx})">${escapeHtml(item.name)}</button><span class="breadcrumb-sep">›</span>`;
  }).join("");

  window._jumpToPath = async (idx) => {
    state.folderPath = state.folderPath.slice(0, idx + 1);
    state.currentFolderId = state.folderPath[idx].id;
    renderBreadcrumb();
    await loadFolders(state.currentFolderId);
  };
}

// ================================================================
// File Selection
// ================================================================
function handleFileSelected(file) {
  if (!file) return;
  state.selectedFile = file;

  if (dom.fileName) dom.fileName.textContent = file.name;
  if (dom.fileSize) dom.fileSize.textContent = formatBytes(file.size);

  show(dom.fileInfo);
  show(dom.uploadBtn);
  hide(dom.resultSection);
  hideError();
}

// ================================================================
// Upload Flow
// ================================================================
async function handleUpload() {
  if (!state.selectedFile || !state.selectedDept || !state.currentFolderId) {
    showError("Vui lòng chọn phòng ban, thư mục và tệp trước khi tải lên.");
    return;
  }

  const idToken = getIdToken();
  if (!idToken) {
    showError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    handleSignOut();
    return;
  }

  state.isUploading = true;
  state.uploadController = new AbortController();

  hide(dom.fileInfo);
  hide(dom.uploadBtn);
  show(dom.progressSection);
  hide(dom.resultSection);
  hideError();

  try {
    // 1. Khởi tạo session từ backend
    const session = await startUploadSession({
      filename:   state.selectedFile.name,
      mimeType:   state.selectedFile.type || "application/octet-stream",
      size:       state.selectedFile.size,
      department: state.selectedDept,
      folderId:   state.currentFolderId,
    }, idToken);

    updateProgress(0, state.selectedFile.size, 0);

    // 2. Upload trực tiếp lên Drive — không qua backend
    const { fileId } = await resumableUpload({
      uploadUrl: session.uploadUrl,
      uploadId:  session.uploadId,
      file:      state.selectedFile,
      signal:    state.uploadController.signal,
      onProgress: ({ loaded, total, percent, speedMBps }) => {
        updateProgress(loaded, total, speedMBps);
      },
      onComplete: ({ fileId }) => {
        console.log("Upload complete, fileId:", fileId);
      },
      onError: (err) => {
        if (err.name !== "AbortError") {
          showError(`Lỗi upload: ${err.message}`);
        }
      },
    });

    // 3. Thông báo backend verify và ghi log
    const result = await completeUpload(fileId, session.uploadId, state.selectedDept, idToken);

    // 4. Hiển thị kết quả
    hide(dom.progressSection);
    renderResult(result);

  } catch (err) {
    hide(dom.progressSection);
    if (err.name !== "AbortError") {
      showError(`Tải lên thất bại: ${err.message}`);
      show(dom.uploadBtn);
      show(dom.fileInfo);
    } else {
      showError("Tải lên đã bị hủy.");
      resetToUploadState();
    }
  } finally {
    state.isUploading = false;
  }
}

function updateProgress(loaded, total, speedMBps) {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  if (dom.progressBar) dom.progressBar.style.width = `${percent}%`;
  if (dom.progressText) dom.progressText.textContent =
    `${formatBytes(loaded)} / ${formatBytes(total)} (${percent}%)`;
  if (dom.progressSpeed) dom.progressSpeed.textContent =
    speedMBps > 0 ? `${speedMBps.toFixed(1)} MB/s` : "";
}

function renderResult(result) {
  if (dom.resultFileName) dom.resultFileName.textContent = result.fileName || state.selectedFile?.name || "";
  if (dom.resultLink) {
    dom.resultLink.href = result.url || "#";
    dom.resultLink.textContent = "Mở tệp trên Google Drive ↗";
  }
  show(dom.resultSection);
}

function resetToUploadState() {
  state.selectedFile = null;
  state.isUploading = false;
  if (dom.fileInput) dom.fileInput.value = "";
  if (dom.progressBar) dom.progressBar.style.width = "0%";
  hide(dom.fileInfo);
  hide(dom.uploadBtn);
  hide(dom.progressSection);
  hide(dom.resultSection);
  hideError();
}

// ================================================================
// UI Utilities
// ================================================================
function renderUserInfo(me) {
  if (dom.userAvatar) {
    if (me.picture) {
      dom.userAvatar.src = me.picture;
      dom.userAvatar.style.display = "block";
    }
  }
  if (dom.userName) dom.userName.textContent = me.name || "";
  if (dom.userEmail) dom.userEmail.textContent = me.email || "";
}

function show(el) { if (el) el.style.display = ""; }
function hide(el) { if (el) el.style.display = "none"; }
function showLoading(v) { if (dom.loadingOverlay) dom.loadingOverlay.style.display = v ? "flex" : "none"; }
function showError(msg) {
  if (dom.errorBanner) dom.errorBanner.style.display = "flex";
  if (dom.errorMsg) dom.errorMsg.textContent = msg;
}
function hideError() {
  if (dom.errorBanner) dom.errorBanner.style.display = "none";
}
function escapeHtml(text) {
  return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
