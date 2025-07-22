import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShiftScheduleEditor from './components/ShiftScheduleEditor.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 3,
    },
    mutations: {
      retry: 3,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <ShiftScheduleEditor />
      </div>
    </QueryClientProvider>
  );
}

export default App;