import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FirebaseAuthContext } from "./firebaseAuthContext";
import {
  clearGoogleCalendarToken,
  storeGoogleCalendarToken,
} from "./googleCalendarTokenStorage";
import {
  firebaseAuth,
  firestore,
  isFirebaseConfigured,
} from "./firebaseClient";

const CALENDAR_SCOPE = import.meta.env.VITE_GOOGLE_CALENDAR_SCOPES;

async function ensureUserProfile(user) {
  await setDoc(
    doc(firestore, "users", user.uid),
    {
      uid: user.uid,
      email: user.email?.toLowerCase() || "",
      displayName: user.displayName || user.email || "Family member",
      photoURL: user.photoURL || "",
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export default function FirebaseAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseAuth) return undefined;
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setError(null);
      setLoading(false);
      if (nextUser) {
        ensureUserProfile(nextUser).catch((profileError) => {
          console.error("Failed to initialize user profile:", profileError);
          setError(profileError);
        });
      }
    });
  }, []);

  const login = useCallback(async () => {
    if (!firebaseAuth) return;
    setError(null);
    const provider = new GoogleAuthProvider();
    if (CALENDAR_SCOPE) provider.addScope(CALENDAR_SCOPE);
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        storeGoogleCalendarToken(result.user.uid, credential.accessToken);
      }
    } catch (loginError) {
      setError(loginError);
      throw loginError;
    }
  }, []);

  const logout = useCallback(async () => {
    if (firebaseAuth) {
      if (firebaseAuth.currentUser) {
        clearGoogleCalendarToken(firebaseAuth.currentUser.uid);
      }
      await signOut(firebaseAuth);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      isConfigured: isFirebaseConfigured,
      isSignedIn: Boolean(user),
    }),
    [error, loading, login, logout, user],
  );

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}
