import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a stable query client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time - data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, 
      // Cache time - data stays in cache for 30 minutes after being unused
      gcTime: 30 * 60 * 1000,
      // Enable background refetch when window refocuses
      refetchOnWindowFocus: false,
      // Disable automatic refetch on reconnect to prevent conflicts
      refetchOnReconnect: false,
      // Retry configuration for failed requests
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) return false;
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Retry mutations once on network errors
      retry: (failureCount, error) => {
        // Don't retry client errors or auth errors
        if (error?.status >= 400 && error?.status < 500) return false;
        // Retry once for network/server errors
        return failureCount < 1;
      },
      retryDelay: 1000,
    },
  },
});

export const QueryProvider = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Export the query client for use in other parts of the app
export { queryClient };