import React from "react";
import ReactDOM from "react-dom/client";
import { QueryProvider } from "./providers/QueryProvider";
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
    // Phase 4: Staff Migration Test Utilities
    staffMigration: async () => {
      const { quickTests } = await import("./utils/testMigration");
      return quickTests;
    },
  };
  console.log("🔧 Debug utilities available: window.debugConfig (async)");

  // Phase 4: Staff Migration Test Utilities - Direct access
  import("./utils/testMigration").then(({ quickTests }) => {
    window.migrationTest = quickTests;
    console.log(
      "🚀 Staff migration test utilities available: window.migrationTest",
    );
    console.log("   • migrationTest.dryRun() - Test migration without changes");
    console.log("   • migrationTest.migrate() - Perform actual migration");
    console.log(
      "   • migrationTest.createData() - Create sample localStorage data",
    );
    console.log("   • migrationTest.check() - Check localStorage status");
    console.log("   • migrationTest.cleanup() - Clear test data");
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </React.StrictMode>,
);
