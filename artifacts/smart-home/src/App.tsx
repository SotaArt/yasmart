import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";

const EngineeringPanel = lazy(() => import("@/pages/engineering-panel/index"));
const UserPanel = lazy(() => import("@/pages/user-panel"));
const MobilePanel = lazy(() => import("@/pages/mobile-panel"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-border border-t-[hsl(var(--gold))] animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          {/* User panel is standalone — no shared header */}
          <Route path="/panel/:householdId" component={UserPanel} />
          {/* Mobile panel is standalone — touch-ориентированная версия */}
          <Route path="/mobile/:householdId" component={MobilePanel} />
          <Route>
            <AppLayout>
              <Switch>
                <Route path="/" component={EngineeringPanel} />
                <Route component={NotFound} />
              </Switch>
            </AppLayout>
          </Route>
        </Switch>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
