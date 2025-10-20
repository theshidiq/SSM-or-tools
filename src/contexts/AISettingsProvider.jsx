/**
 * AISettingsProvider.jsx
 *
 * Context provider for AI settings to avoid prop drilling
 * Makes useAISettings available throughout the component tree
 */

import React, { createContext, useContext } from "react";
import { useAISettings } from "../hooks/useAISettings";

const AISettingsContext = createContext(null);

/**
 * Provider component that makes AI settings available to all children
 */
export const AISettingsProvider = ({ children }) => {
  const aiSettings = useAISettings();

  return (
    <AISettingsContext.Provider value={aiSettings}>
      {children}
    </AISettingsContext.Provider>
  );
};

/**
 * Hook to consume AI settings from context
 * Must be used within AISettingsProvider
 */
export const useAISettingsContext = () => {
  const context = useContext(AISettingsContext);
  if (!context) {
    throw new Error(
      "useAISettingsContext must be used within AISettingsProvider",
    );
  }
  return context;
};

export default AISettingsProvider;
