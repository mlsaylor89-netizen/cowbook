import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { HerdList } from '@/pages/HerdList';
import { AnimalDetail } from '@/pages/AnimalDetail';
import { AnimalForm } from '@/pages/AnimalForm';
import { BreedingForm } from '@/pages/BreedingForm';
import { SemenInventory } from '@/pages/SemenInventory';
import { SemenDetail } from '@/pages/SemenDetail';
import { SemenBullForm } from '@/pages/SemenBullForm';
import { SemenPurchaseForm } from '@/pages/SemenPurchaseForm';
import { EmbryoInventory } from '@/pages/EmbryoInventory';
import { EmbryoDetail } from '@/pages/EmbryoDetail';
import { EmbryoDonorForm } from '@/pages/EmbryoDonorForm';
import { EmbryoPurchaseForm } from '@/pages/EmbryoPurchaseForm';
import { PharmacyInventory } from '@/pages/PharmacyInventory';
import { DrugForm } from '@/pages/DrugForm';
import { MoreMenu } from '@/pages/MoreMenu';
import { Reports } from '@/pages/Reports';
import { PrintReport } from '@/pages/PrintReport';
import { Settings } from '@/pages/Settings';
import { Backup } from '@/pages/Backup';
import { Checklist } from '@/pages/Checklist';
import { TreatmentForm } from '@/pages/TreatmentForm';
import { TreatmentLog } from '@/pages/TreatmentLog';
import { CalvingForm } from '@/pages/CalvingForm';
import { PregCheckForm } from '@/pages/PregCheckForm';
import { ClassificationForm } from '@/pages/ClassificationForm';

// Firebase auth + sync
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { FarmSetupPage } from '@/pages/FarmSetupPage';
import { MigrationPage, MIGRATION_KEY_PREFIX } from '@/pages/MigrationPage';
import { db } from '@/db';

const queryClient = new QueryClient();

// ─── Auth guard ────────────────────────────────────────────────────────────

type MigrationState = 'checking' | 'needed' | 'done';

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, farmId, loading } = useAuth();
  const [migration, setMigration] = useState<MigrationState>('checking');

  useEffect(() => {
    if (!user || !farmId) {
      setMigration('checking');
      return;
    }

    // Fast path: already migrated (or farm is brand new)
    if (localStorage.getItem(`${MIGRATION_KEY_PREFIX}${farmId}`)) {
      setMigration('done');
      return;
    }

    // Async path: check if there is any local herd data to offer migration for
    db.animals.count().then((n) => {
      setMigration(n > 0 ? 'needed' : 'done');
    });
  }, [user, farmId]);

  if (loading) return <LoadingSpinner />;
  if (!user) return <AuthPage />;
  if (!farmId) return <FarmSetupPage />;

  // Still checking Dexie animal count — only flashes for new logins on
  // devices that have never completed migration
  if (migration === 'checking') return <LoadingSpinner />;

  if (migration === 'needed') {
    return (
      <MigrationPage
        onComplete={() => setMigration('done')}
      />
    );
  }

  return <>{children}</>;
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );
}

// ─── Router ────────────────────────────────────────────────────────────────

function Router() {
  return (
    <RoutedErrorBoundary>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          
          <Route path="/checklist/:type" component={Checklist} />
          
          <Route path="/herd" component={HerdList} />
          <Route path="/herd/new" component={AnimalForm} />
          <Route path="/herd/:id/edit" component={AnimalForm} />
          <Route path="/herd/:id" component={AnimalDetail} />
          
          <Route path="/breeding" component={BreedingForm} />
          <Route path="/treatment" component={TreatmentForm} />
          <Route path="/treatment-log" component={TreatmentLog} />
          <Route path="/classification" component={ClassificationForm} />
          <Route path="/calving" component={CalvingForm} />
          <Route path="/preg-check" component={PregCheckForm} />
          
          <Route path="/semen" component={SemenInventory} />
          <Route path="/semen/new" component={SemenBullForm} />
          <Route path="/semen/:id/purchase" component={SemenPurchaseForm} />
          <Route path="/semen/:id" component={SemenDetail} />

          <Route path="/embryo" component={EmbryoInventory} />
          <Route path="/embryo/new" component={EmbryoDonorForm} />
          <Route path="/embryo/:id/purchase" component={EmbryoPurchaseForm} />
          <Route path="/embryo/:id" component={EmbryoDetail} />

          <Route path="/pharmacy" component={PharmacyInventory} />
          <Route path="/pharmacy/new" component={DrugForm} />
          <Route path="/pharmacy/:id/edit" component={DrugForm} />
          
          <Route path="/more" component={MoreMenu} />
          <Route path="/reports" component={Reports} />
          <Route path="/print-report" component={PrintReport} />
          <Route path="/settings" component={Settings} />
          <Route path="/backup" component={Backup} />
          
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

// ─── App ───────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthGuard>
              <Router />
            </AuthGuard>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
