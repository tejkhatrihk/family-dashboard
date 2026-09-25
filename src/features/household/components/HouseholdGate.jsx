import GoogleIcon from "@mui/icons-material/Google";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useFirebaseAuth } from "../../../shared/api/firebaseAuthContext";
import { useHousehold } from "../api/householdContext";

function CenteredPage({ children }) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "background.default" }}>
      {children}
    </Box>
  );
}

function FirebaseSetupRequired() {
  return (
    <CenteredPage>
      <Paper elevation={0} sx={{ width: "100%", maxWidth: 560, p: 4, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h4" sx={{ fontSize: "1.8rem" }}>Firebase setup required</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          Add the Firebase web configuration values from your Firebase project to the app&apos;s environment file, then restart the development server.
        </Typography>
        <Typography component="pre" sx={{ mt: 2, p: 2, bgcolor: "#f3f1eb", borderRadius: 1, overflowX: "auto", fontSize: "0.76rem" }}>
          VITE_FIREBASE_API_KEY{"\n"}
          VITE_FIREBASE_AUTH_DOMAIN{"\n"}
          VITE_FIREBASE_PROJECT_ID{"\n"}
          VITE_FIREBASE_STORAGE_BUCKET{"\n"}
          VITE_FIREBASE_MESSAGING_SENDER_ID{"\n"}
          VITE_FIREBASE_APP_ID
        </Typography>
      </Paper>
    </CenteredPage>
  );
}

function SignInPage({ login, error }) {
  return (
    <CenteredPage>
      <Paper elevation={0} sx={{ width: "100%", maxWidth: 440, p: { xs: 3, sm: 4.5 }, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <Typography variant="h4">Family Dashboard</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.25, mb: 3 }}>
          One calm place for your household&apos;s schedule, meals, and routines.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
        <Button variant="contained" size="large" startIcon={<GoogleIcon />} onClick={login} fullWidth>
          Continue with Google
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          This signs you into the dashboard only. Calendar access is requested separately.
        </Typography>
      </Paper>
    </CenteredPage>
  );
}

function HouseholdOnboarding() {
  const { createHousehold, joinHousehold, error } = useHousehold();
  const [tab, setTab] = useState("create");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const submit = async () => {
    setSubmitting(true);
    setLocalError(null);
    try {
      if (tab === "create") await createHousehold(householdName);
      else await joinHousehold(inviteCode);
    } catch (submitError) {
      setLocalError(submitError);
    } finally {
      setSubmitting(false);
    }
  };

  const valid = tab === "create" ? householdName.trim().length >= 2 : inviteCode.trim().length >= 6;

  return (
    <CenteredPage>
      <Paper elevation={0} sx={{ width: "100%", maxWidth: 500, p: { xs: 2.5, sm: 4 }, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h4" sx={{ fontSize: "1.8rem" }}>Set up your household</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>
          Create a new family space or join one using an invitation code.
        </Typography>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ mb: 2.5 }}>
          <Tab value="create" label="Create household" />
          <Tab value="join" label="Join household" />
        </Tabs>
        {(localError || error) && <Alert severity="error" sx={{ mb: 2 }}>{(localError || error).message}</Alert>}
        {tab === "create" ? (
          <TextField label="Household name" placeholder="e.g. The Patel family" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} fullWidth autoFocus />
        ) : (
          <TextField label="Invitation code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} fullWidth autoFocus inputProps={{ style: { letterSpacing: "0.12em" } }} />
        )}
        <Button variant="contained" fullWidth disabled={!valid || submitting} onClick={submit} sx={{ mt: 2.5 }}>
          {submitting ? "Please wait..." : tab === "create" ? "Create household" : "Join household"}
        </Button>
      </Paper>
    </CenteredPage>
  );
}

export default function HouseholdGate({ children }) {
  const { user, loading: authLoading, error, login, isConfigured } = useFirebaseAuth();
  const { household, loading: householdLoading } = useHousehold();

  if (!isConfigured) return <FirebaseSetupRequired />;
  if (authLoading || (user && householdLoading)) {
    return <CenteredPage><CircularProgress size={32} /></CenteredPage>;
  }
  if (!user) return <SignInPage login={login} error={error} />;
  if (!household) return <HouseholdOnboarding />;
  return children;
}
