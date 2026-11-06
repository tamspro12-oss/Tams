import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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
const Clients = lazy(() => import("./pages/Clients"));
const Vendors = lazy(() => import("./pages/Vendors"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const UmrahCalculator = lazy(() => import("./pages/UmrahCalculator"));
const BankCashManager = lazy(() => import("./pages/BankCashManager"));
const Queries = lazy(() => import("./pages/Queries"));
const EmailHistory = lazy(() => import("./pages/EmailHistory"));
const UserManual = lazy(() => import("./pages/UserManual"));
const B2BAgents = lazy(() => import("./pages/B2BAgents"));
const B2BAgentDashboard = lazy(() => import("./pages/B2BAgentDashboard"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const Refunds = lazy(() => import("./pages/Refunds"));
const OpeningBalances = lazy(() => import("./pages/OpeningBalances"));
const Quotations = lazy(() => import("./pages/Quotations"));
const Vouchers = lazy(() => import("./pages/Vouchers"));
const Reminders = lazy(() => import("./pages/Reminders"));

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
                  <Route path="/" element={<PublicHomepage />} />
                  <Route path="/features" element={<FeaturesPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/install" element={<Install />} />
                  <Route path="/subscription-expired" element={<SubscriptionExpired />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  
                  <Route path="/auth" element={<Navigate to="/login" replace />} />
                  <Route path="/public" element={<Navigate to="/" replace />} />

                  {/* ========== APP ROUTES (Login Required) ========== */}
                  <Route path="/app/dashboard" element={<ProtectedRoute><DashboardLayout><Index /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/admin" element={<ProtectedRoute><DashboardLayout><Admin /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/clients" element={<ProtectedRoute><DashboardLayout><Clients /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/quotations" element={<ProtectedRoute><DashboardLayout><Quotations /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/vouchers" element={<ProtectedRoute><DashboardLayout><Vouchers /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/reminders" element={<ProtectedRoute><DashboardLayout><Reminders /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/b2b-agents" element={<ProtectedRoute><DashboardLayout><B2BAgents /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/b2b-agents/:agentId" element={<ProtectedRoute><DashboardLayout><B2BAgentDashboard /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/vendors" element={<ProtectedRoute><DashboardLayout><Vendors /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/vendors/:vendorId" element={<ProtectedRoute><DashboardLayout><VendorDashboard /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/queries" element={<ProtectedRoute><DashboardLayout><Queries /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/expenses" element={<ProtectedRoute><DashboardLayout><Expenses /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/reports" element={<ProtectedRoute><DashboardLayout><Reports /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/umrah-calculator" element={<ProtectedRoute><DashboardLayout><UmrahCalculator /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/bank-cash" element={<ProtectedRoute><DashboardLayout><BankCashManager /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/refunds" element={<ProtectedRoute><DashboardLayout><Refunds /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/opening-balances" element={<ProtectedRoute><DashboardLayout><OpeningBalances /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/email-history" element={<ProtectedRoute><DashboardLayout><EmailHistory /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/settings" element={<ProtectedRoute><DashboardLayout><Settings /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/user-manual" element={<ProtectedRoute><DashboardLayout><UserManual /></DashboardLayout></ProtectedRoute>} />
                  
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
