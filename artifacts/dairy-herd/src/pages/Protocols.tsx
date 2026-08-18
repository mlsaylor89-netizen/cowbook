import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { db, type Protocol, type ProtocolTrigger } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Baby,
  Droplets,
  Syringe,
  Stethoscope,
  ClipboardList,
} from 'lucide-react';
import { Link } from 'wouter';

const TRIGGER_META: Record<ProtocolTrigger, { label: string; icon: React.ReactNode; color: string }> = {
  calving:     { label: 'After Calving',     icon: <Baby className="h-4 w-4" />,         color: 'text-pink-500' },
  'dry-off':   { label: 'Dry Off',           icon: <Droplets className="h-4 w-4" />,     color: 'text-blue-500' },
  vaccination: { label: 'Vaccination',       icon: <Syringe className="h-4 w-4" />,      color: 'text-emerald-500' },
  treatment:   { label: 'Treatment',         icon: <Stethoscope className="h-4 w-4" />,  color: 'text-purple-500' },
  manual:      { label: 'Manual / On-Demand', icon: <ClipboardList className="h-4 w-4" />, color: 'text-gray-500' },
};

export function Protocols() {
  const [, navigate] = useLocation();
  const { farmId } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<Protocol | null>(null);

  const protocols = useLiveQuery(
    () => farmId ? db.protocols.where('farmId').equals(farmId).toArray() : [],
    [farmId],
  ) ?? [];

  // Group by trigger type
  const grouped = protocols.reduce<Partial<Record<ProtocolTrigger, Protocol[]>>>((acc, p) => {
    (acc[p.triggerType] ??= []).push(p);
    return acc;
  }, {});

  const triggerOrder: ProtocolTrigger[] = ['calving', 'dry-off', 'vaccination', 'treatment', 'manual'];

  async function handleDelete() {
    if (!deleteTarget) return;
    await db.protocols.delete(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link href="/more">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-xl font-bold">Protocols</h2>
        </div>
        <Button onClick={() => navigate('/protocols/new')} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <p className="text-sm text-muted-foreground px-1">
        Protocols are checklists that pop up when a specific event happens — like a newborn calf checklist after every calving.
      </p>

      {protocols.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No protocols yet</p>
            <p className="text-sm mt-1">Tap <strong>New</strong> to create your first protocol.</p>
          </CardContent>
        </Card>
      )}

      {triggerOrder.map(trigger => {
        const group = grouped[trigger];
        if (!group?.length) return null;
        const meta = TRIGGER_META[trigger];
        return (
          <div key={trigger} className="space-y-2">
            <div className={`flex items-center gap-2 px-1 ${meta.color}`}>
              {meta.icon}
              <h3 className="text-sm font-bold uppercase tracking-wider">{meta.label}</h3>
            </div>
            {group.map(p => (
              <Card key={p.id} className="shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-base truncate">{p.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {p.items.length} {p.items.length === 1 ? 'item' : 'items'}
                      {p.items.length > 0 && (
                        <span className="ml-1.5 text-xs">
                          — {p.items.slice(0, 3).map(i => i.label).join(', ')}
                          {p.items.length > 3 && ` +${p.items.length - 3} more`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/protocols/${p.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This protocol and its checklist items will be permanently removed. Past completions won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
