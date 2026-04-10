import { GoogleAuthProvider } from "@/shared/api/googleAuthContext";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "../src/app/App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleAuthProvider>
      <App />
    </GoogleAuthProvider>
  </React.StrictMode>,
);
