import { type ReactNode } from 'react';
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

const queryClient = new QueryClient();

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
