import { Routes, Route } from "react-router-dom"
import { SignIn, SignUp } from "@clerk/clerk-react"
import { Toaster } from "@/components/ui/toaster"
import { AuthTokenProvider } from "@/hooks/use-auth-token"

// Layouts
import { PublicLayout } from "@/components/layout/public-layout"
import { AppLayout } from "@/components/layout/app-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"

// Public pages
import { HomePage } from "@/pages/home"
import { PricingPage } from "@/pages/pricing"
import { CGVPage } from "@/pages/cgv"

// Protected pages
import { AssistantsPage } from "@/pages/assistants"
import { ChatPage } from "@/pages/chat"
import { CollectionsPage } from "@/pages/collections"
import { DocumentsPage } from "@/pages/documents"
import { DocumentEditorPage } from "@/pages/document-editor"
import { ProfilePage } from "@/pages/profile"
import { BillingPage } from "@/pages/billing"
import { IntegrationsPage } from "@/pages/integrations"

function App() {
  return (
    <AuthTokenProvider>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/cgv" element={<CGVPage />} />
          <Route
            path="/login/*"
            element={
              <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
                <SignIn
                  routing="path"
                  path="/login"
                  signUpUrl="/signup"
                  afterSignInUrl="/app/assistants"
                />
              </div>
            }
          />
          <Route
            path="/signup/*"
            element={
              <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
                <SignUp
                  routing="path"
                  path="/signup"
                  signInUrl="/login"
                  afterSignUpUrl="/app/assistants"
                />
              </div>
            }
          />
        </Route>

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/app/assistants" element={<AssistantsPage />} />
          <Route path="/app/assistants/:id" element={<ChatPage />} />
          <Route path="/app/collections" element={<CollectionsPage />} />
          <Route path="/app/documents" element={<DocumentsPage />} />
          <Route path="/app/documents/:id" element={<DocumentEditorPage />} />
          <Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/app/billing" element={<BillingPage />} />
          <Route path="/app/integrations" element={<IntegrationsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </AuthTokenProvider>
  )
}

export default App
