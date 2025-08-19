import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { configService } from "./services/ConfigurationService";

// Expose debug utilities in development mode
if (process.env.NODE_ENV === "development") {
  window.debugConfig = {
    configService,
    checkMigration: () => configService.debugStorageState(),
    forceMigration: () => configService.forceMigration(),
    hasDeprecated: () => configService.hasDeprecatedEntries(),
    getSettings: () => configService.getSettings(),
  };
  console.log("🔧 Debug utilities available: window.debugConfig");
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
