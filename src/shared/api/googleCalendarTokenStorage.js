function getTokenKey(userId) {
  return `google_calendar_access_token_${userId}`;
}

function getExpiryKey(userId) {
  return `google_calendar_token_expires_at_${userId}`;
}

function notifyTokenChanged() {
  window.dispatchEvent(new Event("google-calendar-token-changed"));
}

export function clearLegacyLocalTokens() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (
      key?.startsWith("google_calendar_access_token_") ||
      key?.startsWith("google_calendar_token_expires_at_")
    ) {
      localStorage.removeItem(key);
    }
  }
}

export function loadActiveGoogleCalendarToken(userId) {
  clearLegacyLocalTokens();
  if (!userId) return null;

  const tokenKey = getTokenKey(userId);
  const expiryKey = getExpiryKey(userId);
  const token = sessionStorage.getItem(tokenKey);
  const expiresAt = Number(sessionStorage.getItem(expiryKey) || 0);
  if (!token || !expiresAt || Date.now() >= expiresAt) {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(expiryKey);
    return null;
  }

  return { token, expiresAt };
}

export function storeGoogleCalendarToken(userId, token, expiresIn = 3600) {
  const expiresAt = Date.now() + expiresIn * 1000;
  sessionStorage.setItem(getTokenKey(userId), token);
  sessionStorage.setItem(getExpiryKey(userId), String(expiresAt));
  notifyTokenChanged();
  return expiresAt;
}

export function clearGoogleCalendarToken(userId) {
  if (!userId) return;
  sessionStorage.removeItem(getTokenKey(userId));
  sessionStorage.removeItem(getExpiryKey(userId));
  notifyTokenChanged();
}
