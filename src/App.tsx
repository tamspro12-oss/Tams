import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { sessionManager } from "@/lib/sessionManager";
import { preloadEssentialData } from "@/lib/dataPreloader";
import { supabase } from "@/integrations/supabase/client";
import { versionManager } from "@/lib/versionManager";
import { errorLogger } from "@/lib/errorLogger";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";

// Lazy-loaded Public Pages
const PublicHomepage = lazy(() => import("./pages/PublicHomepage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Install = lazy(() => import("./pages/Install"));
const SubscriptionExpired = lazy(() => import("./pages/SubscriptionExpired"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-loaded App Pages (Protected)
const Index = lazy(() => import("./pages/Index"));
const Admin = lazy(() => import("./pages/Admin"));
const BookingsHub = lazy(() => import("./pages/BookingsHub"));
const LeadsQuotesHub = lazy(() => import("./pages/LeadsQuotesHub"));
const QueryFormPage = lazy(() => import("./pages/QueryFormPage"));
const QuotationFormPage = lazy(() => import("./pages/QuotationFormPage"));
const AccountsHub = lazy(() => import("./pages/AccountsHub"));
const NotificationsHub = lazy(() => import("./pages/NotificationsHub"));
const SettingsHub = lazy(() => import("./pages/SettingsHub"));
const UmrahCalculator = lazy(() => import("./pages/UmrahCalculator"));
const B2BAgentDashboard = lazy(() => import("./pages/B2BAgentDashboard"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));

// Lazy non-critical overlays (kept out of the initial bundle)
const UpdateNotification = lazy(() =>
  import("@/components/UpdateNotification").then((m) => ({ default: m.UpdateNotification }))
);
const PwaOnboardModal = lazy(() =>
  import("@/components/PwaOnboardModal").then((m) => ({ default: m.PwaOnboardModal }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 0,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const idle = (fn: () => void, timeout = 2000) => {
  if (typeof (window as any).requestIdleCallback === "function") {
    (window as any).requestIdleCallback(fn, { timeout });
  } else {
    setTimeout(fn, 0);
  }
};

const App = () => {
  useAutoUpdate();

  useEffect(() => {
    // Defer non-critical boot work until the browser is idle
    idle(() => {
      versionManager.checkVersion();
      // touch errorLogger to initialize side effects
      void errorLogger;
    });

    sessionManager.setOnTimeout(async () => {
      await supabase.auth.signOut({ scope: 'local' });
      sessionManager.endSession();
      window.location.href = '/login';
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      idle(() => {
        const lastSync = queryClient.getQueryState(['clients'])?.dataUpdatedAt;
        const fiveMinutes = 5 * 60 * 1000;
        if (!lastSync || (Date.now() - lastSync) > fiveMinutes) {
          preloadEssentialData(queryClient);
        }
        versionManager.checkVersionAPI().catch(() => {});
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <DateFilterProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Suspense fallback={null}>
              <UpdateNotification />
              <PwaOnboardModal />
            </Suspense>
            <BrowserRouter>
              <Suspense fallback={null}>

                <Routes>
                  {/* ========== PUBLIC ROUTES (No Login Required) ========== */}
                  <Route path="/" element={<RouteErrorBoundary routeName="Homepage"><PublicHomepage /></RouteErrorBoundary>} />
                  <Route path="/features" element={<RouteErrorBoundary routeName="Features"><FeaturesPage /></RouteErrorBoundary>} />
                  <Route path="/pricing" element={<RouteErrorBoundary routeName="Pricing"><PricingPage /></RouteErrorBoundary>} />
                  <Route path="/contact" element={<RouteErrorBoundary routeName="Contact"><ContactPage /></RouteErrorBoundary>} />
                  <Route path="/login" element={<RouteErrorBoundary routeName="Login"><LoginPage /></RouteErrorBoundary>} />
                  <Route path="/signup" element={<RouteErrorBoundary routeName="Sign Up"><SignupPage /></RouteErrorBoundary>} />
                  <Route path="/privacy" element={<RouteErrorBoundary routeName="Privacy Policy"><PrivacyPolicy /></RouteErrorBoundary>} />
                  <Route path="/terms" element={<RouteErrorBoundary routeName="Terms of Service"><TermsOfService /></RouteErrorBoundary>} />
                  <Route path="/install" element={<RouteErrorBoundary routeName="Install"><Install /></RouteErrorBoundary>} />
                  <Route path="/subscription-expired" element={<RouteErrorBoundary routeName="Subscription Expired"><SubscriptionExpired /></RouteErrorBoundary>} />
                  <Route path="/reset-password" element={<RouteErrorBoundary routeName="Reset Password"><ResetPassword /></RouteErrorBoundary>} />
                  
                  <Route path="/auth" element={<Navigate to="/login" replace />} />
                  <Route path="/public" element={<Navigate to="/" replace />} />

                  {/* ========== CANONICAL 7 HUBS (Login Required) ========== */}
                  <Route path="/app/dashboard" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Dashboard"><Index /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/admin" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Admin"><Admin /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/bookings" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Bookings"><BookingsHub /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/leads-quotes" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Queries & Quotes"><LeadsQuotesHub /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/leads-quotes/queries/new" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="New Query"><QueryFormPage /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/leads-quotes/queries/:id/edit" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Edit Query"><QueryFormPage /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/leads-quotes/quotations/new" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="New Quotation"><QuotationFormPage /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/leads-quotes/quotations/:id/edit" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Edit Quotation"><QuotationFormPage /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/accounts" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Accounts"><AccountsHub /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/umrah-calculator" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Umrah Calculator"><UmrahCalculator /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/notifications" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Notifications"><NotificationsHub /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/settings" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Settings"><SettingsHub /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />

                  {/* Detail Routes */}
                  <Route path="/app/b2b-agents/:agentId" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="B2B Agent Dashboard"><B2BAgentDashboard /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/vendors/:vendorId" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Vendor Dashboard"><VendorDashboard /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />

                  {/* ========== 100% SEAMLESS LEGACY ROUTE REDIRECTS ========== */}
                  <Route path="/app/clients" element={<Navigate to="/app/bookings?tab=clients" replace />} />
                  <Route path="/app/b2b-agents" element={<Navigate to="/app/bookings?tab=b2b-agents" replace />} />
                  <Route path="/app/vendors" element={<Navigate to="/app/bookings?tab=vendors" replace />} />
                  <Route path="/app/vouchers" element={<Navigate to="/app/bookings?tab=vouchers" replace />} />

                  <Route path="/app/queries" element={<Navigate to="/app/leads-quotes?tab=queries" replace />} />
                  <Route path="/app/client-queries" element={<Navigate to="/app/leads-quotes?tab=queries" replace />} />
                  <Route path="/app/quotations" element={<Navigate to="/app/leads-quotes?tab=quotations" replace />} />

                  <Route path="/app/bank-cash" element={<Navigate to="/app/accounts?tab=bank-cash" replace />} />
                  <Route path="/app/expenses" element={<Navigate to="/app/accounts?tab=expenses" replace />} />
                  <Route path="/app/refunds" element={<Navigate to="/app/accounts?tab=refunds" replace />} />
                  <Route path="/app/reports" element={<Navigate to="/app/accounts?tab=reports" replace />} />
                  <Route path="/app/opening-balances" element={<Navigate to="/app/accounts?tab=opening-balances" replace />} />

                  <Route path="/app/reminders" element={<Navigate to="/app/notifications?tab=reminders" replace />} />
                  <Route path="/app/email-history" element={<Navigate to="/app/settings?tab=email-integration" replace />} />
                  <Route path="/app/user-manual" element={<Navigate to="/app/settings?tab=manual" replace />} />
                  
                  <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </DateFilterProvider>
      </SyncProvider>
    </QueryClientProvider>
  );
};

export default App;
