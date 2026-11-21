import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminOnlyGuard } from "@/components/AdminRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

import { AuthProvider } from "@/contexts/AuthContext";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { useAuth } from "@/hooks/useAuth";
import { getLastAppRoute } from "@/lib/lastRouteStorage";
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

const PublicHomeRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to={getLastAppRoute(user.id)} replace />;
  }
  return (
    <RouteErrorBoundary routeName="Homepage">
      <PublicHomepage />
    </RouteErrorBoundary>
  );
};

const AppIndexRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={getLastAppRoute(user?.id)} replace />;
};

// Lazy-loaded Public Pages
const PublicHomepage = lazyWithRetry(() => import("./pages/PublicHomepage"));
const FeaturesPage = lazyWithRetry(() => import("./pages/FeaturesPage"));
const PricingPage = lazyWithRetry(() => import("./pages/PricingPage"));
const ContactPage = lazyWithRetry(() => import("./pages/ContactPage"));
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
const LeadsQuotesHub = lazyWithRetry(() => import("./pages/LeadsQuotesHub"));
const QueryFormPage = lazyWithRetry(() => import("./pages/QueryFormPage"));
const QuotationFormPage = lazyWithRetry(() => import("./pages/QuotationFormPage"));
const NotificationsHub = lazyWithRetry(() => import("./pages/NotificationsHub"));
const SettingsHub = lazyWithRetry(() => import("./pages/SettingsHub"));
const UmrahCalculator = lazyWithRetry(() => import("./pages/UmrahCalculator"));

// Lazy non-critical overlays (kept out of the initial bundle)
const UpdateNotification = lazyWithRetry(() =>
  import("@/components/UpdateNotification").then((m) => ({ default: m.UpdateNotification }))
);
const PwaOnboardModal = lazyWithRetry(() =>
  import("@/components/PwaOnboardModal").then((m) => ({ default: m.PwaOnboardModal }))
);

import { registerGlobalQueryClient } from "@/lib/cacheManager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
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

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      idle(() => {
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
      <AuthProvider>
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
                    <Route path="/" element={<PublicHomeRoute />} />
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
                    <Route path="/auth/callback" element={<RouteErrorBoundary routeName="Auth Callback"><AuthCallbackPage /></RouteErrorBoundary>} />
                    <Route path="/verify-email" element={<RouteErrorBoundary routeName="Verify Email"><AuthCallbackPage /></RouteErrorBoundary>} />

                    <Route path="/auth" element={<Navigate to="/login" replace />} />
                    <Route path="/public" element={<Navigate to="/" replace />} />
                    <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
                    <Route path="/admin/*" element={<Navigate to="/app/admin" replace />} />

                    {/* ========== TAMS PRO CANONICAL MENU (Persistent Layout Shell) ========== */}
                    <Route
                      path="/app"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<AppIndexRedirect />} />
                      <Route path="dashboard" element={<RouteErrorBoundary routeName="Dashboard"><Index /></RouteErrorBoundary>} />
                      <Route path="sales-expenses" element={<RouteErrorBoundary routeName="Sales & Expenses"><SalesExpensesHub /></RouteErrorBoundary>} />
                      <Route path="clients-vendors" element={<RouteErrorBoundary routeName="Clients & Vendors"><ClientsVendors /></RouteErrorBoundary>} />
                      <Route path="reports" element={<RouteErrorBoundary routeName="Reports"><ReportsHub /></RouteErrorBoundary>} />
                      <Route path="admin" element={<AdminOnlyGuard><RouteErrorBoundary routeName="Admin"><Admin /></RouteErrorBoundary></AdminOnlyGuard>} />
                      <Route path="admin/*" element={<AdminOnlyGuard><RouteErrorBoundary routeName="Admin"><Admin /></RouteErrorBoundary></AdminOnlyGuard>} />
                      <Route path="leads-quotes" element={<RouteErrorBoundary routeName="Queries & Quotes"><LeadsQuotesHub /></RouteErrorBoundary>} />
                      <Route path="leads-quotes/queries/new" element={<RouteErrorBoundary routeName="New Query"><QueryFormPage /></RouteErrorBoundary>} />
                      <Route path="leads-quotes/queries/:id/edit" element={<RouteErrorBoundary routeName="Edit Query"><QueryFormPage /></RouteErrorBoundary>} />
                      <Route path="leads-quotes/quotations/new" element={<RouteErrorBoundary routeName="New Quotation"><QuotationFormPage /></RouteErrorBoundary>} />
                      <Route path="leads-quotes/quotations/:id/edit" element={<RouteErrorBoundary routeName="Edit Quotation"><QuotationFormPage /></RouteErrorBoundary>} />
                      <Route path="umrah-calculator" element={<RouteErrorBoundary routeName="Umrah Calculator"><UmrahCalculator /></RouteErrorBoundary>} />
                      <Route path="notifications" element={<RouteErrorBoundary routeName="Notifications"><NotificationsHub /></RouteErrorBoundary>} />
                      <Route path="settings" element={<RouteErrorBoundary routeName="Settings"><SettingsHub /></RouteErrorBoundary>} />
                      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </DateFilterProvider>
        </SyncProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
