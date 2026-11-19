import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { sessionManager } from "@/lib/sessionManager";
import { preloadEssentialData } from "@/lib/dataPreloader";
import { supabase } from "@/integrations/supabase/client";
import { versionManager } from "@/lib/versionManager";
import { errorLogger } from "@/lib/errorLogger";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";

function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (firstErr) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      try {
        return await importer();
      } catch (secondErr) {
        try {
          const key = "tams_chunk_reload_at";
          const last = Number(sessionStorage.getItem(key) || "0");
          if (Date.now() - last > 15000) {
            sessionStorage.setItem(key, String(Date.now()));
            window.location.reload();
          }
        } catch {
          // Ignore storage errors
        }
        throw secondErr || firstErr;
      }
    }
  });
}

const RouteLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-xs text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Lazy-loaded Public Pages
const PublicHomepage = lazyWithRetry(() => import("./pages/PublicHomepage"));
const FeaturesPage = lazyWithRetry(() => import("./pages/FeaturesPage"));
const PricingPage = lazyWithRetry(() => import("./pages/PricingPage"));
const ContactPage = lazyWithRetry(() => import("./pages/ContactPage"));
const BlogsPage = lazyWithRetry(() => import("./pages/BlogsPage"));
const BlogDetailPage = lazyWithRetry(() => import("./pages/BlogDetailPage"));
const LoginPage = lazyWithRetry(() => import("./pages/LoginPage"));
const SignupPage = lazyWithRetry(() => import("./pages/SignupPage"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"));
const Install = lazyWithRetry(() => import("./pages/Install"));
const SubscriptionExpired = lazyWithRetry(() => import("./pages/SubscriptionExpired"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const AuthCallbackPage = lazyWithRetry(() => import("./pages/AuthCallbackPage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

// Lazy-loaded App Pages (Protected)
const Index = lazyWithRetry(() => import("./pages/Index"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const SalesExpensesHub = lazyWithRetry(() => import("./pages/SalesExpensesHub"));
const ClientsVendors = lazyWithRetry(() => import("./pages/ClientsVendors"));
const ReportsHub = lazyWithRetry(() => import("./pages/ReportsHub"));
const BookingsHub = lazyWithRetry(() => import("./pages/BookingsHub"));
const LeadsQuotesHub = lazyWithRetry(() => import("./pages/LeadsQuotesHub"));
const QueryFormPage = lazyWithRetry(() => import("./pages/QueryFormPage"));
const QuotationFormPage = lazyWithRetry(() => import("./pages/QuotationFormPage"));
const AccountsHub = lazyWithRetry(() => import("./pages/AccountsHub"));
const NotificationsHub = lazyWithRetry(() => import("./pages/NotificationsHub"));
const SettingsHub = lazyWithRetry(() => import("./pages/SettingsHub"));
const UmrahCalculator = lazyWithRetry(() => import("./pages/UmrahCalculator"));
const B2BAgentDashboard = lazyWithRetry(() => import("./pages/B2BAgentDashboard"));
const VendorDashboard = lazyWithRetry(() => import("./pages/VendorDashboard"));

// Lazy non-critical overlays (kept out of the initial bundle)
const UpdateNotification = lazyWithRetry(() =>
  import("@/components/UpdateNotification").then((m) => ({ default: m.UpdateNotification }))
);
const PwaOnboardModal = lazyWithRetry(() =>
  import("@/components/PwaOnboardModal").then((m) => ({ default: m.PwaOnboardModal }))
);

import { registerGlobalQueryClient, clearAllAgencyDataCache } from "@/lib/cacheManager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
registerGlobalQueryClient(queryClient);

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
      clearAllAgencyDataCache();
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
        versionManager.checkVersionAPI().catch(() => { });
      });
    };

    const handleVitePreloadError = () => {
      try {
        const key = "tams_chunk_reload_at";
        const last = Number(sessionStorage.getItem(key) || "0");
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // Ignore storage errors
      }
    };

    window.addEventListener("vite:preloadError", handleVitePreloadError as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener("vite:preloadError", handleVitePreloadError as EventListener);
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
              <Suspense fallback={<RouteLoadingFallback />}>

                <Routes>
                  {/* ========== PUBLIC ROUTES (No Login Required) ========== */}
                  <Route path="/" element={<RouteErrorBoundary routeName="Homepage"><PublicHomepage /></RouteErrorBoundary>} />
                  <Route path="/features" element={<RouteErrorBoundary routeName="Features"><FeaturesPage /></RouteErrorBoundary>} />
                  <Route path="/pricing" element={<RouteErrorBoundary routeName="Pricing"><PricingPage /></RouteErrorBoundary>} />
                  <Route path="/contact" element={<RouteErrorBoundary routeName="Contact"><ContactPage /></RouteErrorBoundary>} />
                  <Route path="/blogs" element={<RouteErrorBoundary routeName="Blogs"><BlogsPage /></RouteErrorBoundary>} />
                  <Route path="/blogs/:slug" element={<RouteErrorBoundary routeName="Blog Post"><BlogDetailPage /></RouteErrorBoundary>} />
                  <Route path="/login" element={<RouteErrorBoundary routeName="Login"><LoginPage /></RouteErrorBoundary>} />
                  <Route path="/signup" element={<RouteErrorBoundary routeName="Sign Up"><SignupPage /></RouteErrorBoundary>} />
                  <Route path="/privacy" element={<RouteErrorBoundary routeName="Privacy Policy"><PrivacyPolicy /></RouteErrorBoundary>} />
                  <Route path="/terms" element={<RouteErrorBoundary routeName="Terms of Service"><TermsOfService /></RouteErrorBoundary>} />
                  <Route path="/install" element={<RouteErrorBoundary routeName="Install"><Install /></RouteErrorBoundary>} />
                  <Route path="/subscription-expired" element={<RouteErrorBoundary routeName="Subscription Expired"><SubscriptionExpired /></RouteErrorBoundary>} />
                  <Route path="/reset-password" element={<RouteErrorBoundary routeName="Reset Password"><ResetPassword /></RouteErrorBoundary>} />
                  <Route path="/auth/callback" element={<RouteErrorBoundary routeName="Auth Callback"><AuthCallbackPage /></RouteErrorBoundary>} />
                  <Route path="/verify-email" element={<RouteErrorBoundary routeName="Verify Email"><AuthCallbackPage /></RouteErrorBoundary>} />

                  <Route path="/auth" element={<Navigate to="/login" replace />} />
                  <Route path="/public" element={<Navigate to="/" replace />} />

                  {/* ========== TAMS PRO CANONICAL MENU (Login Required) ========== */}
                  <Route path="/app/dashboard" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Dashboard"><Index /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/sales-expenses" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Sales & Expenses"><SalesExpensesHub /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/clients-vendors" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Clients & Vendors"><ClientsVendors /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/reports" element={<ProtectedRoute><DashboardLayout><RouteErrorBoundary routeName="Reports"><ReportsHub /></RouteErrorBoundary></DashboardLayout></ProtectedRoute>} />
                  <Route path="/app/admin" element={<AdminRoute><DashboardLayout><RouteErrorBoundary routeName="Admin"><Admin /></RouteErrorBoundary></DashboardLayout></AdminRoute>} />
                  <Route path="/app/admin/*" element={<AdminRoute><DashboardLayout><RouteErrorBoundary routeName="Admin"><Admin /></RouteErrorBoundary></DashboardLayout></AdminRoute>} />
                  <Route path="/admin" element={<AdminRoute><Navigate to="/app/admin" replace /></AdminRoute>} />
                  <Route path="/admin/*" element={<AdminRoute><Navigate to="/app/admin" replace /></AdminRoute>} />
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
