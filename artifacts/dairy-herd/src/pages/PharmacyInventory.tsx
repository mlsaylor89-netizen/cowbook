import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
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

type DialogMode = { type: 'restock'; id: string; name: string; unit: string }
               | { type: 'delete';  id: string; name: string }
               | null;

export function PharmacyInventory() {
  const [, navigate] = useLocation();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [restockQty, setRestockQty] = useState('');

  const drugs = useLiveQuery(async () => {
    const all = await db.drugProducts.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  });

  async function handleRestock() {
    if (dialog?.type !== 'restock') return;
    const qty = parseFloat(restockQty);
    if (isNaN(qty) || qty <= 0) return;
    await db.drugProducts.where('id').equals(dialog.id).modify(d => {
      d.quantityOnHand = Math.max(0, d.quantityOnHand) + qty;
      d.updatedAt = new Date().toISOString();
    });
    setDialog(null);
    setRestockQty('');
  }

  async function handleDelete() {
    if (dialog?.type !== 'delete') return;
    await db.drugProducts.delete(dialog.id);
    setDialog(null);
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Pharmacy</h2>
        <Button size="sm" onClick={() => navigate('/pharmacy/new')}>
          <Plus className="h-4 w-4 mr-2" /> Add Drug
        </Button>
      </div>

      {drugs === undefined ? (
        <div className="p-4 text-center">Loading...</div>
      ) : drugs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
          No drugs in pharmacy yet.
        </div>
      ) : (
        <div className="space-y-3">
          {drugs.map(drug => {
            const threshold = drug.lowStockThreshold ?? 1;
            const pct = drug.bottleSize && drug.bottleSize > 0
              ? Math.max(0, Math.round((drug.quantityOnHand / drug.bottleSize) * 100))
              : null;
            const isLow = drug.bottleSize
              ? drug.quantityOnHand <= drug.bottleSize * 0.25
              : drug.quantityOnHand <= threshold;
            const isOut = drug.quantityOnHand <= 0;

            return (
              <div
                key={drug.id}
                className="cursor-pointer active-elevate hover-elevate"
                onClick={() => navigate(`/pharmacy/${drug.id}/edit`)}
              >
                <Card className={`shadow-sm ${isOut ? 'border-destructive' : isLow ? 'border-amber-500' : ''}`}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg leading-tight">{drug.name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                        {drug.milkWithholdDays > 0 && (
                          <span>🥛 {drug.milkWithholdDays}d milk</span>
                        )}
                        {drug.meatWithholdDays > 0 && (
                          <span>🥩 {drug.meatWithholdDays}d meat</span>
                        )}
                        {drug.defaultRoute && <span>{drug.defaultRoute}</span>}
                      </div>
                      {/* Progress bar */}
                      {pct !== null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isOut ? 'bg-destructive' : isLow ? 'bg-amber-500' : 'bg-primary'
                              }`}
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                        </div>
                      )}
                      {drug.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{drug.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className={`text-2xl font-bold tabular-nums ${isOut ? 'text-destructive' : isLow ? 'text-amber-600' : 'text-primary'}`}>
                          {drug.quantityOnHand}
                        </p>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{drug.unit}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 p-0"
                          title="Add stock"
                          onClick={e => {
                            e.stopPropagation();
                            setRestockQty('');
                            setDialog({ type: 'restock', id: drug.id, name: drug.name, unit: drug.unit });
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); navigate(`/pharmacy/${drug.id}/edit`); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remove"
                          onClick={e => { e.stopPropagation(); setDialog({ type: 'delete', id: drug.id, name: drug.name }); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>

                  {(isOut || isLow) && (
                    <div className={`text-xs font-bold uppercase tracking-wider px-3 py-1 flex items-center justify-center gap-1 rounded-b-lg ${
                      isOut ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-900'
                    }`}>
                      <AlertTriangle className="h-3 w-3" />
                      {isOut ? 'Out of Stock' : 'Low Stock'}
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Restock dialog */}
      <AlertDialog
        open={dialog?.type === 'restock'}
        onOpenChange={open => { if (!open) setDialog(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Add Stock — {dialog?.type === 'restock' ? dialog.name : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Enter the quantity to add to current inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={`Quantity (${dialog?.type === 'restock' ? dialog.unit : 'units'})`}
            value={restockQty}
            onChange={e => setRestockQty(e.target.value)}
            className="h-12 text-lg"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDialog(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestock}
              disabled={!restockQty || parseFloat(restockQty) <= 0}
            >
              Add Stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={dialog?.type === 'delete'}
        onOpenChange={open => { if (!open) setDialog(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {dialog?.type === 'delete' ? dialog.name : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the drug from your pharmacy. Existing treatment records that used it are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDialog(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleDelete}
            >
              Yes, Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
