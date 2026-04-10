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

const GoogleAuthContext = createContext(null);

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

function GoogleAuthInner({ children }) {
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem("google_access_token") || null,
  );
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("google_user") || "null"),
  );
  const [isSignedIn, setIsSignedIn] = useState(!!accessToken);

  const login = useGoogleLogin({
    scope: SCOPES,
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      setIsSignedIn(true);
      localStorage.setItem("google_access_token", tokenResponse.access_token);

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
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_user");
  }, []);

  // Verify token is still valid on mount
  useEffect(() => {
    if (!accessToken) return;
    fetch("https://www.googleapis.com/oauth2/v3/tokeninfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((res) => {
      if (!res.ok) {
        // Token expired — clear it
        logout();
      }
    });
  }, [accessToken, logout]);

  return (
    <GoogleAuthContext.Provider
      value={{ accessToken, user, isSignedIn, login, logout }}
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
