import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 s; avoids redundant network requests
      // when the user switches browser tabs and comes back.
      staleTime: 30_000,
      // Retry failed requests twice before surfacing an error
      retry: 2,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60_000,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
