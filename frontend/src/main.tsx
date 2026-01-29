import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClerkProvider } from "@clerk/clerk-react"
import { frFR } from "@clerk/localizations"
import App from "./App"
import "./index.css"

// Get Clerk publishable key from environment
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Render with or without Clerk based on config
const AppWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {CLERK_PUBLISHABLE_KEY ? (
      <ClerkProvider 
        publishableKey={CLERK_PUBLISHABLE_KEY}
        localization={frFR}
        afterSignOutUrl="/"
      >
        <AppWithProviders />
      </ClerkProvider>
    ) : (
      <>
        {console.warn("⚠️ VITE_CLERK_PUBLISHABLE_KEY not set - running without auth")}
        <AppWithProviders />
      </>
    )}
  </React.StrictMode>
)
