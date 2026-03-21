import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { MessagesProvider } from "@/contexts/MessagesContext";
import { MatchInvitesProvider } from "@/contexts/MatchInvitesContext";
import { ConversationsProvider } from "@/contexts/ConversationsContext";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/admin/AdminRoute";
import RealtimeNotificationsManager from "@/components/RealtimeNotificationsManager";
import { logger } from "@/utils/logger";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import NewDashboard from "./pages/NewDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProfileSetup from "./pages/ProfileSetup";
import PublicAvailability from "./pages/PublicAvailability";
import NotFound from "./pages/NotFound";
import Leagues from "./pages/Leagues";
import League from "./pages/League";
import Courts from "./pages/Courts";
import Contact from "./pages/Contact";
import Rules from "./pages/Rules";
import ScrollToTop from "@/components/ScrollToTop";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  logger.debug('App component rendering');
  
  // Add global error handlers to catch unhandled errors
  React.useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection:', {
        reason: event.reason,
        stack: event.reason?.stack,
        timestamp: new Date().toISOString()
      });
      // Prevent the default browser behavior
      event.preventDefault();
    };

    // Handle unhandled JavaScript errors
    const handleError = (event: ErrorEvent) => {
      logger.error('Global JavaScript error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString()
      });
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Cleanup function
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          <NotificationsProvider>
            <MatchInvitesProvider>
            <AvailabilityProvider>
            <ConversationsProvider>
            <MessagesProvider>
              <RealtimeNotificationsManager />
              <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/leagues" element={<Leagues />} />
                  <Route path="/league/:leagueId" element={
                    <ProtectedRoute>
                      <League />
                    </ProtectedRoute>
                  } />
                  <Route path="/courts" element={<Courts />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/rules" element={<Rules />} />
                  <Route path="/profile-setup" element={
                    <ProtectedRoute>
                      <ProfileSetup />
                    </ProtectedRoute>
                  } />
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <NewDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/dashboard-old" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  } />
                  <Route path="/public-availability/:userId" element={<PublicAvailability />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
            </MessagesProvider>
            </ConversationsProvider>
            </AvailabilityProvider>
            </MatchInvitesProvider>
          </NotificationsProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
