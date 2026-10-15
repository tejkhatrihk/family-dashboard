import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFirebaseAuth } from "./firebaseAuthContext";
import { GoogleCalendarContext } from "./googleCalendarContext";
import {
  clearGoogleCalendarToken,
  loadActiveGoogleCalendarToken,
  storeGoogleCalendarToken,
} from "./googleCalendarTokenStorage";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = import.meta.env.VITE_GOOGLE_CALENDAR_SCOPES;
const EXPIRY_CHECK_INTERVAL_MS = 2 * 60 * 1000;

function GoogleCalendarInner({ children, userId }) {
  const [tokenState, setTokenState] = useState(() => {
    const activeToken = loadActiveGoogleCalendarToken(userId);
    return {
      userId,
      token: activeToken?.token || null,
      expiresAt: activeToken?.expiresAt || null,
    };
  });
  const activeTokenState =
    tokenState.userId === userId
      ? tokenState
      : {
          userId,
          ...(loadActiveGoogleCalendarToken(userId) || {}),
        };
  const accessToken = activeTokenState.token || null;

  const renewCalendarAccess = useGoogleLogin({
    scope: SCOPES,
    onSuccess: (tokenResponse) => {
      const expiresAt = storeGoogleCalendarToken(
        userId,
        tokenResponse.access_token,
        tokenResponse.expires_in ?? 3600,
      );
      setTokenState({
        userId,
        token: tokenResponse.access_token,
        expiresAt,
      });
    },
    onError: (error) => console.error("Google Calendar authorization failed:", error),
  });

  const expireCalendarAccess = useCallback(() => {
    clearGoogleCalendarToken(userId);
    setTokenState({ userId, token: null, expiresAt: null });
  }, [userId]);

  useEffect(() => {
    const syncToken = () => {
      const activeToken = loadActiveGoogleCalendarToken(userId);
      setTokenState({
        userId,
        token: activeToken?.token || null,
        expiresAt: activeToken?.expiresAt || null,
      });
    };
    window.addEventListener("google-calendar-token-changed", syncToken);
    const interval = window.setInterval(() => {
      const currentToken = loadActiveGoogleCalendarToken(userId);
      if (!currentToken) {
        expireCalendarAccess();
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener("google-calendar-token-changed", syncToken);
      window.clearInterval(interval);
    };
  }, [expireCalendarAccess, userId]);

  const value = useMemo(
    () => ({
      accessToken,
      calendarConnected: Boolean(accessToken),
      canRenewCalendarAccess: Boolean(CLIENT_ID && SCOPES),
      renewCalendarAccess,
      expireCalendarAccess,
    }),
    [accessToken, expireCalendarAccess, renewCalendarAccess],
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
          canRenewCalendarAccess: false,
          renewCalendarAccess: () => {},
          expireCalendarAccess: () => {},
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
