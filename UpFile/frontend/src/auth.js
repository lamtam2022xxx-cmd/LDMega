/**
 * auth.js — Frontend
 * Google Sign-In dùng Google Identity Services (GIS) library.
 * Trả về ID Token (JWT) của nhân viên để gửi lên Cloudflare Worker.
 * ID Token KHÔNG chứa khả năng tạo file Drive — chỉ để xác thực danh tính.
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

let _idToken = null;
let _userInfo = null;
let _tokenExpiry = 0;
let _onSignInCallback = null;

/**
 * Khởi tạo Google Identity Services.
 * Gọi hàm này sau khi script GIS đã được load.
 */
export function initGoogleAuth(onSignIn) {
  _onSignInCallback = onSignIn;

  if (!window.google?.accounts?.id) {
    console.error("Google Identity Services not loaded");
    return;
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: false,
  });
}

/**
 * Hiển thị nút "Sign in with Google" trong container element.
 * @param {HTMLElement} container
 */
export function renderSignInButton(container) {
  if (!window.google?.accounts?.id) return;
  window.google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    width: 280,
  });
}

/**
 * Callback nhận credential từ Google Sign-In.
 * @param {Object} response — { credential: <ID Token JWT> }
 */
function handleCredentialResponse(response) {
  _idToken = response.credential;

  // Decode payload để lấy thông tin cơ bản (không verify — Worker sẽ verify)
  try {
    const payload = JSON.parse(atob(_idToken.split(".")[1]));
    _userInfo = {
      email: payload.email,
      name:  payload.name,
      picture: payload.picture,
    };
    _tokenExpiry = payload.exp * 1000; // Convert to ms
  } catch (e) {
    console.error("Failed to decode ID token", e);
  }

  _onSignInCallback?.(_userInfo, _idToken);
}

/**
 * Trả về ID Token hiện tại.
 * @returns {string|null}
 */
export function getIdToken() {
  // Token còn ít nhất 5 phút
  if (_idToken && Date.now() < _tokenExpiry - 5 * 60 * 1000) {
    return _idToken;
  }
  return null;
}

/**
 * Trả về thông tin user hiện tại.
 * @returns {{email, name, picture}|null}
 */
export function getCurrentUser() {
  return _userInfo;
}

/**
 * Đăng xuất.
 */
export function signOut() {
  if (_userInfo?.email && window.google?.accounts?.id) {
    window.google.accounts.id.revoke(_userInfo.email);
  }
  _idToken = null;
  _userInfo = null;
  _tokenExpiry = 0;
}

/**
 * Yêu cầu Google prompt Sign-In thủ công (cho nút Sign In).
 */
export function promptSignIn() {
  if (!window.google?.accounts?.id) return;
  window.google.accounts.id.prompt();
}
