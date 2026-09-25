import HouseholdProvider from "@/features/household/api/HouseholdProvider";
import FirebaseAuthProvider from "@/shared/api/FirebaseAuthProvider";
import GoogleCalendarProvider from "@/shared/api/GoogleCalendarProvider";
import { CssBaseline, ThemeProvider } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "../src/app/App";
import { dashboardTheme } from "./app/theme";

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
