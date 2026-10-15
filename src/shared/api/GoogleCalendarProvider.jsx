import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFirebaseAuth } from "./firebaseAuthContext";
import { GoogleCalendarContext } from "./googleCalendarContext";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = import.meta.env.VITE_GOOGLE_CALENDAR_SCOPES;
const EXPIRY_CHECK_INTERVAL_MS = 2 * 60 * 1000;

function getTokenKey(userId) {
  return `google_calendar_access_token_${userId}`;
}

function getExpiryKey(userId) {
  return `google_calendar_token_expires_at_${userId}`;
}

function clearLegacyLocalTokens() {
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

function loadActiveToken(userId) {
  clearLegacyLocalTokens();
  if (!userId) return null;
  const tokenKey = getTokenKey(userId);
  const expiryKey = getExpiryKey(userId);
  const token = sessionStorage.getItem(tokenKey);
  const expiresAt = Number(sessionStorage.getItem(expiryKey) || 0);
  if (!token || (expiresAt && Date.now() >= expiresAt)) {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(expiryKey);
    return null;
  }
  return token;
}

function GoogleCalendarInner({ children, userId }) {
  const tokenKey = getTokenKey(userId);
  const expiryKey = getExpiryKey(userId);
  const [accessToken, setAccessToken] = useState(() => loadActiveToken(userId));
  const [sessionExpired, setSessionExpired] = useState(false);

  const connectCalendar = useGoogleLogin({
    scope: SCOPES,
    onSuccess: (tokenResponse) => {
      const expiresAt = Date.now() + (tokenResponse.expires_in ?? 3600) * 1000;
      setAccessToken(tokenResponse.access_token);
      setSessionExpired(false);
      sessionStorage.setItem(tokenKey, tokenResponse.access_token);
      sessionStorage.setItem(expiryKey, String(expiresAt));
    },
    onError: (error) => console.error("Google Calendar connection failed:", error),
  });

  const disconnectCalendar = useCallback(() => {
    setAccessToken(null);
    setSessionExpired(false);
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(expiryKey);
  }, [expiryKey, tokenKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const expiresAt = Number(sessionStorage.getItem(expiryKey) || 0);
      if (expiresAt && Date.now() >= expiresAt) {
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem(expiryKey);
        setAccessToken(null);
        setSessionExpired(true);
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [expiryKey, tokenKey]);

  const value = useMemo(
    () => ({
      accessToken,
      calendarConnected: Boolean(accessToken),
      sessionExpired,
      connectCalendar,
      disconnectCalendar,
    }),
    [accessToken, connectCalendar, disconnectCalendar, sessionExpired],
  );

  return <GoogleCalendarContext.Provider value={value}>{children}</GoogleCalendarContext.Provider>;
}

export default function GoogleCalendarProvider({ children }) {
  const { user } = useFirebaseAuth();
  if (!CLIENT_ID) {
    return (
      <GoogleCalendarContext.Provider
        value={{
          accessToken: null,
          calendarConnected: false,
          sessionExpired: false,
          connectCalendar: () => {},
          disconnectCalendar: () => {},
        }}
      >
        {children}
      </GoogleCalendarContext.Provider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <GoogleCalendarInner key={user?.uid || "signed-out"} userId={user?.uid}>
        {children}
      </GoogleCalendarInner>
    </GoogleOAuthProvider>
  );
}
