import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { clearStaleFirestoreCache } from '@/lib/firestore';

import './index.css';

// Remove IndexedDB databases left by the old persistentMultipleTabManager
// config — they hold a lock that makes every write hang indefinitely.
clearStaleFirestoreCache('herdsman-95bca');

// Register service worker. When a new version is detected, reload immediately
// so the browser always runs the latest code instead of stale cached JS.
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      window.location.reload();
    },
  });
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
