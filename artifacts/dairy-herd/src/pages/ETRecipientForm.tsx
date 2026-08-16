import { useLocation } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, parseISO } from 'date-fns';

const formSchema = z.object({
  animalId: z.string().optional(),
  animalIdentifier: z.string().min(1, 'Animal ID / tag is required'),
  location: z.string().optional(),
  embryoId: z.string().optional(),
  embryoIdentifier: z.string().optional(),
  transferDate: z.string().optional(),
  notes: z.string().optional(),
});

export function ETRecipientForm() {
  const [, setLocation] = useLocation();
  const { farmId } = useAuth();
  const { toast } = useToast();

  const { animals, embryos, gestationDays } = useLiveQuery(async () => {
    const [animalsRaw, embryosRaw, settings] = await Promise.all([
      db.animals.toArray(),
      db.embryos.toArray(),
      db.settings.get('default'),
    ]);
    return {
      animals: animalsRaw.sort((a, b) => (a.barnName || a.name).localeCompare(b.barnName || b.name)),
      embryos: embryosRaw,
      gestationDays: settings?.gestationDays ?? 283,
    };
  }) ?? { animals: [], embryos: [], gestationDays: 283 };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animalId: '',
      animalIdentifier: '',
      location: '',
      embryoId: '',
      embryoIdentifier: '',
      transferDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    },
  });

  // Live-derived due date = transferDate + (gestationDays − 7)
  const transferDate = useWatch({ control: form.control, name: 'transferDate' });
  const expectedCalvingDate = (() => {
    if (!transferDate) return null;
    try {
      return addDays(parseISO(transferDate), gestationDays - 7);
    } catch { return null; }
  })();

  function handleAnimalSelect(animalId: string) {
    form.setValue('animalId', animalId);
    if (animalId) {
      const a = animals.find(x => x.id === animalId);
      if (a) {
        const label = [a.number, a.barnName || a.name].filter(Boolean).join(' ');
        form.setValue('animalIdentifier', label);
      }
    }
  }

  function handleEmbryoSelect(embryoId: string) {
    form.setValue('embryoId', embryoId);
    if (embryoId) {
      const e = embryos.find(x => x.id === embryoId);
      if (e) {
        const label = [e.donorName, e.sireName ? `× ${e.sireName}` : ''].filter(Boolean).join(' ');
        form.setValue('embryoIdentifier', label);
      }
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const now = new Date().toISOString();
    const calvingDate = values.transferDate
      ? addDays(parseISO(values.transferDate), gestationDays - 7).toISOString()
      : undefined;

    await db.etRecipients.add({
      id: crypto.randomUUID(),
      farmId: farmId ?? 'demo-farm',
      animalId: values.animalId || undefined,
      animalIdentifier: values.animalIdentifier,
      location: values.location?.trim() || undefined,
      embryoId: values.embryoId || undefined,
      embryoIdentifier: values.embryoIdentifier?.trim() || undefined,
      transferDate: values.transferDate || undefined,
      expectedCalvingDate: calvingDate,
      status: 'pending',
      notes: values.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    toast({ title: 'Recipient added' });
    setLocation('/et-recipients');
  }

  const nativeSel = 'h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/et-recipients">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h2 className="text-xl font-bold">Add ET Recipient</h2>
      </div>

      <Card>
        <CardContent className="p-4 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Animal */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Recipient Animal</h3>

                <div className="space-y-2">
                  <Label>Select from Herd (optional)</Label>
                  <select
                    value={form.watch('animalId') ?? ''}
                    onChange={e => handleAnimalSelect(e.target.value)}
                    className={nativeSel}
                  >
                    <option value="">— Not in herd list —</option>
                    {animals.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.number ? `${a.number} — ` : ''}{a.barnName || a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <FormField control={form.control} name="animalIdentifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Animal ID / Tag *</FormLabel>
                    <FormControl>
                      <Input className="h-12" placeholder="e.g. 412, Daisy, RFID 9832…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input className="h-12" placeholder="e.g. Pen 3, North Barn, Pasture B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Embryo */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Embryo</h3>

                <div className="space-y-2">
                  <Label>Select Embryo Lot (optional)</Label>
                  <select
                    value={form.watch('embryoId') ?? ''}
                    onChange={e => handleEmbryoSelect(e.target.value)}
                    className={nativeSel}
                  >
                    <option value="">— Not in inventory —</option>
                    {embryos.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.donorName}{e.sireName ? ` × ${e.sireName}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <FormField control={form.control} name="embryoIdentifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Embryo ID / Description</FormLabel>
                    <FormControl>
                      <Input className="h-12" placeholder="e.g. Grade 1, Donor Ella × Sire Max" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Transfer date & due date */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Transfer Details</h3>

                <FormField control={form.control} name="transferDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Calculated due date */}
                {expectedCalvingDate && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                    <Calendar className="h-4 w-4 text-violet-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                        Expected Calving Date
                      </p>
                      <p className="font-bold text-violet-900 dark:text-violet-100">
                        {format(expectedCalvingDate, 'EEEE, MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-violet-600 dark:text-violet-400">
                        Transfer date + {gestationDays - 7} days (gestation {gestationDays}d − 7d for recipient)
                      </p>
                    </div>
                  </div>
                )}

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[80px]" placeholder="Optional notes…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Button type="submit" className="w-full h-14 text-lg font-bold" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Add Recipient'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
