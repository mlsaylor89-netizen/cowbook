import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Settings, Printer, DownloadCloud, Activity, Droplet, ClipboardList, Dna, FlaskConical, Pill } from 'lucide-react';

export function MoreMenu() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <h2 className="text-2xl font-bold mb-4">More</h2>

      <div className="space-y-2">
        <MenuLink href="/reports" icon={<Activity className="h-5 w-5 text-blue-600" />} title="Herd Reports & Metrics" />
        <MenuLink href="/treatment-log" icon={<ClipboardList className="h-5 w-5 text-purple-600" />} title="Treatment Log" />
        <MenuLink href="/checklist/treatments" icon={<Droplet className="h-5 w-5 text-rose-600" />} title="Active Treatments & Withholds" />
        <MenuLink href="/semen" icon={<Dna className="h-5 w-5 text-cyan-600" />} title="Semen Inventory" />
        <MenuLink href="/embryo" icon={<FlaskConical className="h-5 w-5 text-violet-600" />} title="Embryo Inventory" />
        <MenuLink href="/pharmacy" icon={<Pill className="h-5 w-5 text-emerald-600" />} title="Pharmacy" />
        <MenuLink href="/print-report" icon={<Printer className="h-5 w-5 text-gray-600" />} title="Print Daily Worksheet" />
      </div>

      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1 pt-4">System</h3>
      <div className="space-y-2">
        <MenuLink href="/settings" icon={<Settings className="h-5 w-5 text-gray-600" />} title="Settings" />
        <MenuLink href="/backup" icon={<DownloadCloud className="h-5 w-5 text-green-600" />} title="Backup & Restore" />
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
