import { useAuth } from '@/contexts/useAuth';

/**
 * Central permission check for role-based UI enforcement.
 * - isViewer      → read-only role; can log events but cannot mutate records or inventories
 * - canEditHerd   → add / edit / delete animal records
 * - canEditInventory → semen, embryo, pharmacy inventory changes
 */
export function usePermissions() {
  const { userDoc } = useAuth();
  const isViewer = userDoc?.role === 'viewer';
  return {
    isViewer,
    canEditHerd: !isViewer,
    canEditInventory: !isViewer,
    canLogEvents: true, // heats, breedings, calvings — open to all roles
  };
}
