import HouseholdProvider from "@/features/household/api/HouseholdProvider";
import FirebaseAuthProvider from "@/shared/api/FirebaseAuthProvider";
import GoogleCalendarProvider from "@/shared/api/GoogleCalendarProvider";
import { CssBaseline, ThemeProvider } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "../src/app/App";
import { dashboardTheme } from "./app/theme";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Failed to register the app service worker:", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={dashboardTheme}>
      <CssBaseline />
      <FirebaseAuthProvider>
        <HouseholdProvider>
          <GoogleCalendarProvider>
            <App />
          </GoogleCalendarProvider>
        </HouseholdProvider>
      </FirebaseAuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
