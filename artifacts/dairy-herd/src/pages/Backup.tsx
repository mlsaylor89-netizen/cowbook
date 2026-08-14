import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Upload, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { clearDemoData, seedDemoData } from '@/db/seed';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function Backup() {
  const { toast } = useToast();

  const handleExport = async () => {
    const data = {
      animals: await db.animals.toArray(),
      breedings: await db.breedings.toArray(),
      pregnancyChecks: await db.pregnancyChecks.toArray(),
      calvings: await db.calvings.toArray(),
      treatments: await db.treatments.toArray(),
      semenBulls: await db.semenBulls.toArray(),
      semenPurchases: await db.semenPurchases.toArray(),
      settings: await db.settings.toArray()
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dairy-herd-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Backup downloaded' });
  };

  const handleClearDemo = async () => {
    await clearDemoData();
    toast({ title: 'Data cleared' });
    window.location.reload();
  };

  const handleLoadDemo = async () => {
    await clearDemoData();
    await seedDemoData();
    toast({ title: 'Demo data loaded' });
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/more">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">Backup & Restore</h2>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-bold text-lg">Export Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Download a complete JSON backup of your herd data.</p>
            <Button onClick={handleExport} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90">
              <Download className="h-4 w-4 mr-2" /> Download Backup
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-bold text-lg">Demo Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Load or clear fictional demo data for testing.</p>
            
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-white h-12">
                    <Trash2 className="h-4 w-4 mr-2" /> Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all herd data from this device.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearDemo} className="bg-destructive text-white">Delete All Data</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex-1 h-12">
                    <Upload className="h-4 w-4 mr-2" /> Load Demo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Load Demo Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace your current data with a demo dataset. You will lose any data you've added.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLoadDemo}>Load Demo Data</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
