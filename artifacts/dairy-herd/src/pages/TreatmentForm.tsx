import { useEffect } from 'react';
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
import { ArrowLeft, AlertTriangle, FlaskConical } from 'lucide-react';
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

  const { animals, drugs } = useLiveQuery(async () => ({
    animals: (await db.animals.toArray()).sort((a, b) => (a.barnName || a.name).localeCompare(b.barnName || b.name)),
    drugs: (await db.drugProducts.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
  })) ?? { animals: [], drugs: [] };

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

    // Deduct from pharmacy inventory
    if (values.drugProductId && values.quantityUsed && values.quantityUsed > 0) {
      await db.drugProducts.where('id').equals(values.drugProductId).modify(drug => {
        drug.quantityOnHand = Math.max(0, drug.quantityOnHand - values.quantityUsed!);
        drug.updatedAt = now;
      });
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select animal" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {animals.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.number} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
