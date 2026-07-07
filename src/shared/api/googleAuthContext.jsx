import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = import.meta.env.VITE_GOOGLE_CALENDAR_SCOPES;

// Check for expiry every 2 minutes; prompt re-login when within this window
const EXPIRY_CHECK_INTERVAL_MS = 2 * 60 * 1000;

const GoogleAuthContext = createContext(null);

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

function GoogleAuthInner({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    const token = localStorage.getItem("google_access_token");
    if (!token) return null;
    // Synchronously clear expired token so the first render never sees a stale one
    const expiresAt = Number(
      localStorage.getItem("google_token_expires_at") || 0,
    );
    if (expiresAt && Date.now() >= expiresAt) {
      localStorage.removeItem("google_access_token");
      localStorage.removeItem("google_token_expires_at");
      return null;
    }
    return token;
  });
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("google_user") || "null"),
  );
  const [isSignedIn, setIsSignedIn] = useState(() => {
    // Mirror the same expiry logic so isSignedIn is accurate on first render
    const token = localStorage.getItem("google_access_token");
    if (!token) return false;
    const expiresAt = Number(
      localStorage.getItem("google_token_expires_at") || 0,
    );
    return !(expiresAt && Date.now() >= expiresAt);
  });
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = useGoogleLogin({
    scope: SCOPES,
    onSuccess: (tokenResponse) => {
      const expiresAt = Date.now() + (tokenResponse.expires_in ?? 3600) * 1000;
      setAccessToken(tokenResponse.access_token);
      setIsSignedIn(true);
      setSessionExpired(false);
      localStorage.setItem("google_access_token", tokenResponse.access_token);
      localStorage.setItem("google_token_expires_at", String(expiresAt));

      // Fetch user info
      fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
        .then((res) => res.json())
        .then((info) => {
          const userData = {
            name: info.name,
            email: info.email,
            picture: info.picture,
          };
          setUser(userData);
          localStorage.setItem("google_user", JSON.stringify(userData));
        });
    },
    onError: (err) => console.error("Google login failed:", err),
  });

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setIsSignedIn(false);
    setSessionExpired(false);
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_token_expires_at");
    localStorage.removeItem("google_user");
  }, []);

  // On mount: check stored expiry first (fast, no network), fall back to tokeninfo
  useEffect(() => {
    if (!accessToken) return;

    const expiresAt = Number(
      localStorage.getItem("google_token_expires_at") || 0,
    );

    if (expiresAt) {
      // We have an expiry timestamp — use it directly
      if (Date.now() >= expiresAt) {
        logout();
      }
      // else: token is still valid; periodic check below will handle future expiry
    } else {
      // Old session without expiry stored — verify with tokeninfo
      fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      )
        .then((res) => res.json())
        .then((info) => {
          if (info.error || !info.expires_in) {
            logout();
          } else {
            // Backfill the expiry for future use
            const newExpiresAt = Date.now() + Number(info.expires_in) * 1000;
            localStorage.setItem(
              "google_token_expires_at",
              String(newExpiresAt),
            );
          }
        })
        .catch(logout);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic expiry check — catches tokens that expire while the tab is open
  useEffect(() => {
    const interval = setInterval(() => {
      const expiresAt = Number(
        localStorage.getItem("google_token_expires_at") || 0,
      );
      if (expiresAt && Date.now() >= expiresAt) {
        setSessionExpired(true);
        // Clear stored token so a page reload also prompts re-login
        localStorage.removeItem("google_access_token");
        localStorage.removeItem("google_token_expires_at");
        setAccessToken(null);
        setIsSignedIn(false);
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <GoogleAuthContext.Provider
      value={{ accessToken, user, isSignedIn, sessionExpired, login, logout }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function GoogleAuthProvider({ children }) {
  if (!CLIENT_ID) {
    console.warn("VITE_GOOGLE_CLIENT_ID not set — Google auth disabled");
    return (
      <GoogleAuthContext.Provider
        value={{
          accessToken: null,
          user: null,
          isSignedIn: false,
          sessionExpired: false,
          login: () => {},
          logout: () => {},
        }}
      >
        {children}
      </GoogleAuthContext.Provider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <GoogleAuthInner>{children}</GoogleAuthInner>
    </GoogleOAuthProvider>
  );
}
