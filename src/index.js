import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize console logger in development mode
if (process.env.NODE_ENV === "development") {
  import("./utils/consoleLogger").then(() => {
    console.log("🔍 Console logger initialized - all logs are being captured");
    console.log("💡 Use exportConsoleLogs() to download logs anytime");
    console.log("📊 Use printLogSummary() to see log statistics");
  });
}

// Expose debug utilities in development mode (lazy loading)
if (process.env.NODE_ENV === "development") {
  window.debugConfig = {
    getConfigService: async () => {
      const { configService } = await import("./services/ConfigurationService");
      return configService;
    },
    checkMigration: async () => {
      const { configService } = await import("./services/ConfigurationService");
      return configService.debugStorageState();
    },
    forceMigration: async () => {
      const { configService } = await import("./services/ConfigurationService");
      return configService.forceMigration();
    },
    hasDeprecated: async () => {
      const { configService } = await import("./services/ConfigurationService");
      return configService.hasDeprecatedEntries();
    },
    getSettings: async () => {
      const { configService } = await import("./services/ConfigurationService");
      return configService.getSettings();
    },
  };
  console.log("🔧 Debug utilities available: window.debugConfig (async)");
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
