import { ShieldX, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

/**
 * Drop-in block shown to Viewer-role users who navigate to a restricted page.
 * Usage: return <ViewerBlock backHref="/herd" /> early in any form/page that
 * Viewers are not allowed to use.
 */
export function ViewerBlock({ backHref = '/more' }: { backHref?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
      <div className="rounded-full bg-muted p-5">
        <ShieldX className="h-10 w-10 text-muted-foreground" />
      </div>
      <p className="text-xl font-bold">Access Restricted</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Viewers can't make changes here. Contact your farm owner to update your role.
      </p>
      <Link href={backHref}>
        <Button variant="outline" className="gap-2 mt-2">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </Link>
    </div>
  );
}
