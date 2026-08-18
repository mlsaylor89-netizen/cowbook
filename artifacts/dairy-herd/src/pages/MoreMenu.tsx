import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronRight,
  Settings,
  Printer,
  DownloadCloud,
  Activity,
  Droplet,
  ClipboardList,
  FlaskConical,
  Pill,
  LogOut,
  User,
  FileUp,
  Thermometer,
  CalendarDays,
  Microscope,
  Pipette,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { SpermIcon } from '@/components/icons';

export function MoreMenu() {
  const { user, farmId, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <h2 className="text-2xl font-bold mb-4">More</h2>

      <div className="space-y-2">
        <MenuLink href="/heat" icon={<Thermometer className="h-5 w-5 text-rose-500" />} title="Record Heat / Alarm" />
        <MenuLink href="/sync-protocol" icon={<CalendarDays className="h-5 w-5 text-primary" />} title="Sync Protocols" />
        <MenuLink href="/protocols" icon={<ListChecks className="h-5 w-5 text-teal-600" />} title="Protocols" />
        <MenuLink href="/reports" icon={<Activity className="h-5 w-5 text-blue-600" />} title="Herd Reports & Metrics" />
        <MenuLink href="/treatment-log" icon={<ClipboardList className="h-5 w-5 text-purple-600" />} title="Treatment Log" />
        <MenuLink href="/checklist/treatments" icon={<Droplet className="h-5 w-5 text-rose-600" />} title="Active Treatments & Withholds" />
        <MenuLink href="/semen" icon={<SpermIcon className="h-5 w-5 text-cyan-600" />} title="Semen Inventory" />
        <MenuLink href="/embryo" icon={<FlaskConical className="h-5 w-5 text-violet-600" />} title="Embryo Inventory" />
        <MenuLink href="/flush" icon={<Microscope className="h-5 w-5 text-teal-600" />} title="Flush History" />
        <MenuLink href="/et-recipients" icon={<Pipette className="h-5 w-5 text-violet-500" />} title="ET Recipients" />
        <MenuLink href="/pharmacy" icon={<Pill className="h-5 w-5 text-emerald-600" />} title="Pharmacy" />
        <MenuLink href="/print-report" icon={<Printer className="h-5 w-5 text-gray-600" />} title="Print Daily Worksheet" />
      </div>

      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1 pt-4">System</h3>
      <div className="space-y-2">
        <MenuLink href="/import" icon={<FileUp className="h-5 w-5 text-indigo-600" />} title="Batch Import" />
        <MenuLink href="/settings" icon={<Settings className="h-5 w-5 text-gray-600" />} title="Settings" />
        <MenuLink href="/backup" icon={<DownloadCloud className="h-5 w-5 text-green-600" />} title="Backup & Restore" />
      </div>

      {/* Account section */}
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1 pt-4">Account</h3>
      <div className="space-y-2">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-secondary/50 rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate">{user?.displayName || user?.email}</p>
              {user?.displayName && (
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              )}
              {farmId && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Farm ID: {farmId.slice(0, 8)}…
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <button className="w-full text-left active-elevate hover-elevate" onClick={logout}>
          <Card className="shadow-sm border-destructive/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <p className="font-bold text-lg text-destructive">Sign Out</p>
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  );
}

function MenuLink({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return (
    <Link href={href} className="block active-elevate hover-elevate">
      <Card className="shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/50 rounded-lg">
              {icon}
            </div>
            <p className="font-bold text-lg">{title}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
