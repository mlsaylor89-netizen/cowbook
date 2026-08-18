import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, AlertTriangle, FlaskConical, ListChecks } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, addDays } from 'date-fns';

const formSchema = z.object({
  animalId: z.string().min(1, 'Animal is required'),
  date: z.string().min(1, 'Date is required'),
  condition: z.string().min(1, 'Condition / problem is required'),
  drugProductId: z.string().optional(),
  product: z.string().min(1, 'Product / treatment is required'),
  dose: z.string().optional(),
  quantityUsed: z.coerce.number().min(0).optional(),
  route: z.enum(['IM', 'SQ', 'IV', 'Oral', 'Intramammary', 'Topical', 'Other']),
  administrator: z.string().optional(),
  milkWithholdDays: z.coerce.number().min(0).optional(),
  meatWithholdDays: z.coerce.number().min(0).optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function TreatmentForm() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialAnimalId = searchParams.get('animalId') || '';

  const [useProtocol, setUseProtocol] = useState(false);
  const [selectedProtocolId, setSelectedProtocolId] = useState('');

  const { animals, drugs, treatmentProtocols } = useLiveQuery(async () => ({
    animals: (await db.animals.toArray()).sort((a, b) => (a.barnName || a.name).localeCompare(b.barnName || b.name)),
    drugs: (await db.drugProducts.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
    treatmentProtocols: (await db.protocols.where('triggerType').equals('treatment').toArray())
      .sort((a, b) => a.name.localeCompare(b.name)),
  })) ?? { animals: [], drugs: [], treatmentProtocols: [] };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animalId: initialAnimalId,
      date: format(new Date(), 'yyyy-MM-dd'),
      condition: '',
      drugProductId: '',
      product: '',
      dose: '',
      quantityUsed: undefined,
      route: 'IM',
      administrator: '',
      milkWithholdDays: undefined,
      meatWithholdDays: undefined,
      followUpDate: '',
      notes: '',
    },
  });

  const milkWithholdDays = form.watch('milkWithholdDays');
  const dateValue = form.watch('date');
  const drugProductId = form.watch('drugProductId');

  // Auto-fill when a drug is selected from pharmacy
  useEffect(() => {
    if (!drugProductId || !drugs.length) return;
    const drug = drugs.find(d => d.id === drugProductId);
    if (!drug) return;
    form.setValue('product', drug.name);
    if (drug.milkWithholdDays) form.setValue('milkWithholdDays', drug.milkWithholdDays);
    if (drug.meatWithholdDays) form.setValue('meatWithholdDays', drug.meatWithholdDays);
    if (drug.defaultDose) form.setValue('dose', drug.defaultDose);
    if (drug.defaultRoute) form.setValue('route', drug.defaultRoute);
  }, [drugProductId, drugs]);

  // Auto-fill when a treatment protocol is selected
  useEffect(() => {
    if (!selectedProtocolId || !treatmentProtocols.length || !drugs.length) return;
    const proto = treatmentProtocols.find(p => p.id === selectedProtocolId);
    if (!proto) return;
    // Pre-fill from the first pharmacy drug item in the protocol
    const firstDrugItem = proto.items.find(i => i.drugProductId);
    if (firstDrugItem?.drugProductId) {
      const drug = drugs.find(d => d.id === firstDrugItem.drugProductId);
      if (drug) {
        form.setValue('drugProductId', drug.id);
        form.setValue('product', drug.name);
        if (drug.milkWithholdDays) form.setValue('milkWithholdDays', drug.milkWithholdDays);
        if (drug.meatWithholdDays) form.setValue('meatWithholdDays', drug.meatWithholdDays);
        if (firstDrugItem.dosePerAnimal) form.setValue('dose', `${firstDrugItem.dosePerAnimal} ${drug.unit}`);
        if (drug.defaultRoute) form.setValue('route', drug.defaultRoute);
        form.setValue('quantityUsed', firstDrugItem.dosePerAnimal ?? undefined);
      }
    }
  }, [selectedProtocolId, treatmentProtocols, drugs]);

  const milkWithholdUntilPreview =
    milkWithholdDays && milkWithholdDays > 0 && dateValue
      ? format(addDays(new Date(dateValue), milkWithholdDays), 'MMM d, yyyy')
      : null;

  // Show remaining stock for selected drug
  const selectedDrug = drugProductId ? drugs.find(d => d.id === drugProductId) : null;

  async function onSubmit(values: FormValues) {
    const now = new Date().toISOString();
    const treatmentDate = new Date(values.date);

    const milkWithholdUntil =
      values.milkWithholdDays && values.milkWithholdDays > 0
        ? addDays(treatmentDate, values.milkWithholdDays).toISOString()
        : undefined;

    const meatWithholdUntil =
      values.meatWithholdDays && values.meatWithholdDays > 0
        ? addDays(treatmentDate, values.meatWithholdDays).toISOString()
        : undefined;

    await db.treatments.add({
      id: self.crypto.randomUUID(),
      animalId: values.animalId,
      date: treatmentDate.toISOString(),
      condition: values.condition,
      product: values.product,
      dose: values.dose || undefined,
      route: values.route,
      administrator: values.administrator || undefined,
      milkWithholdDays: values.milkWithholdDays || undefined,
      meatWithholdDays: values.meatWithholdDays || undefined,
      milkWithholdUntil,
      meatWithholdUntil,
      followUpDate: values.followUpDate || undefined,
      notes: values.notes || undefined,
      resolved: false,
      drugProductId: values.drugProductId || undefined,
      quantityUsed: values.quantityUsed || undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Deduct from pharmacy inventory for directly-selected drug
    if (values.drugProductId && values.quantityUsed && values.quantityUsed > 0) {
      await db.drugProducts.where('id').equals(values.drugProductId).modify(drug => {
        drug.quantityOnHand = Math.max(0, drug.quantityOnHand - values.quantityUsed!);
        drug.updatedAt = now;
      });
    }

    // If a treatment protocol was used: save completion + deduct all drug items
    if (useProtocol && selectedProtocolId) {
      const proto = treatmentProtocols.find(p => p.id === selectedProtocolId);
      if (proto) {
        // Mark all items as complete (treatment ran the full protocol)
        await db.protocolCompletions.add({
          id: crypto.randomUUID(),
          farmId: (await db.animals.get(values.animalId))?.farmId ?? '',
          protocolId: proto.id,
          animalId: values.animalId,
          date: format(treatmentDate, 'yyyy-MM-dd'),
          completedItems: proto.items.map(i => i.id),
          notes: values.notes?.trim() || undefined,
          createdAt: now,
        });
        // Deduct pharmacy inventory for every drug item with a dose (skip the one already deducted above)
        for (const item of proto.items) {
          if (
            item.drugProductId &&
            item.dosePerAnimal != null &&
            item.dosePerAnimal > 0 &&
            item.drugProductId !== values.drugProductId  // already handled above
          ) {
            const dose = item.dosePerAnimal;
            await db.drugProducts.where('id').equals(item.drugProductId).modify(drug => {
              drug.quantityOnHand = Math.max(0, drug.quantityOnHand - dose);
              drug.updatedAt = now;
            });
          }
        }
      }
    }

    if (initialAnimalId) {
      setLocation(`/herd/${initialAnimalId}`);
    } else {
      setLocation('/checklist/treatments');
    }
  }

  const backHref = initialAnimalId ? `/herd/${initialAnimalId}` : '/checklist/treatments';

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h2 className="text-xl font-bold">Record Treatment</h2>
      </div>

      <Card>
        <CardContent className="p-4 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Animal */}
              <FormField control={form.control} name="animalId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Animal</FormLabel>
                  <FormControl>
                    <select
                      value={field.value}
                      onChange={e => field.onChange(e.target.value)}
                      className="h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select animal…</option>
                      {animals.map(a => (
                        <option key={a.id} value={a.id}>{a.number} — {a.barnName || a.name}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Date */}
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" className="h-12 text-base" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Condition */}
              <FormField control={form.control} name="condition" render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition / Problem</FormLabel>
                  <FormControl>
                    <Input className="h-12 text-base" placeholder="e.g. Mastitis, Milk fever, Foot rot" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* ── Treatment Protocol picker ── */}
              {treatmentProtocols.length > 0 && (
                <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-teal-600" />
                      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Use a Protocol</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setUseProtocol(v => !v); setSelectedProtocolId(''); }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useProtocol ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${useProtocol ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {useProtocol && (
                    <>
                      <select
                        value={selectedProtocolId}
                        onChange={e => setSelectedProtocolId(e.target.value)}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select a treatment protocol…</option>
                        {treatmentProtocols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>

                      {selectedProtocolId && (() => {
                        const proto = treatmentProtocols.find(p => p.id === selectedProtocolId);
                        if (!proto || proto.items.length === 0) return null;
                        return (
                          <div className="space-y-1.5">
                            {proto.items.map(item => {
                              const drug = item.drugProductId ? drugs.find(d => d.id === item.drugProductId) : null;
                              return (
                                <div key={item.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg bg-background border">
                                  <span className="text-teal-600">·</span>
                                  <span className="font-medium">{item.label}</span>
                                  {item.dosePerAnimal != null && drug && (
                                    <span className="ml-auto text-muted-foreground text-xs">{item.dosePerAnimal} {drug.unit}</span>
                                  )}
                                </div>
                              );
                            })}
                            <p className="text-xs text-muted-foreground pt-1">
                              All items will be recorded as complete and inventory deducted on save.
                              The first drug pre-fills the form below.
                            </p>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* ── Pharmacy picker ── */}
              {drugs.length > 0 && (
                <div className="border rounded-xl p-4 space-y-4 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-violet-600" />
                    <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Select from Pharmacy</p>
                  </div>

                  <FormField control={form.control} name="drugProductId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drug / Product</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        if (!val) {
                          form.setValue('product', '');
                          form.setValue('milkWithholdDays', undefined);
                          form.setValue('meatWithholdDays', undefined);
                          form.setValue('dose', '');
                        }
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Choose or leave blank to type manually" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">— Type manually —</SelectItem>
                          {drugs.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                              {d.quantityOnHand <= (d.lowStockThreshold ?? 1) ? ' ⚠️' : ''}
                              {' '}({d.quantityOnHand} {d.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {selectedDrug && (
                    <FormField control={form.control} name="quantityUsed" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity Used ({selectedDrug.unit})</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            className="h-12 text-base"
                            placeholder={`0 ${selectedDrug.unit}`}
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          On hand: <strong>{selectedDrug.quantityOnHand} {selectedDrug.unit}</strong>
                        </p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              )}

              {/* Product name (auto-filled from pharmacy or typed manually) */}
              <FormField control={form.control} name="product" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product / Treatment</FormLabel>
                  <FormControl>
                    <Input className="h-12 text-base" placeholder="e.g. Penicillin, Dextrose, Banamine" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Dose + Route */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="dose" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dose</FormLabel>
                    <FormControl><Input className="h-12 text-base" placeholder="e.g. 10 mL" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="route" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(['IM','SQ','IV','Oral','Intramammary','Topical','Other'] as const).map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Administrator */}
              <FormField control={form.control} name="administrator" render={({ field }) => (
                <FormItem>
                  <FormLabel>Person Administering (optional)</FormLabel>
                  <FormControl><Input className="h-12 text-base" placeholder="Name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Withhold days */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="milkWithholdDays" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milk Withhold (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" className="h-12 text-base" placeholder="0"
                        {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="meatWithholdDays" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meat Withhold (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" className="h-12 text-base" placeholder="0"
                        {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {milkWithholdUntilPreview && (
                <div className="flex items-center gap-3 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg font-semibold">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>Milk Withhold until {milkWithholdUntilPreview}</span>
                </div>
              )}

              {/* Follow-up date */}
              <FormField control={form.control} name="followUpDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Follow-Up Date (optional)</FormLabel>
                  <FormControl><Input type="date" className="h-12 text-base" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Notes */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea className="text-base min-h-[80px]" placeholder="Any additional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-14 text-lg font-bold mt-2">
                Save Treatment
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
