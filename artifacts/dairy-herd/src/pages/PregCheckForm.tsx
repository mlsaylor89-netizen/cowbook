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
import { ArrowLeft } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLiveQuery } from 'dexie-react-hooks';
import { processPregCheck } from '@/db/computed';
import { format } from 'date-fns';

const formSchema = z.object({
  animalId: z.string().min(1, 'Animal is required'),
  breedingId: z.string().min(1, 'A breeding record is required to record a pregnancy check'),
  checkDate: z.string().min(1, 'Check date is required'),
  result: z.enum(['Pregnant', 'Open', 'Recheck']),
  recheckDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function PregCheckForm() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialAnimalId = searchParams.get('animalId') || '';

  const data = useLiveQuery(async () => {
    const animals = (await db.animals.toArray()).sort((a, b) => (a.barnName || a.name).localeCompare(b.barnName || b.name));
    const settings = await db.settings.get('default');

    // Pre-load breedings for the initial animal so we can set a default breedingId
    let initialBreedingId = '';
    if (initialAnimalId) {
      const breedings = await db.breedings
        .where('animalId')
        .equals(initialAnimalId)
        .reverse()
        .sortBy('date');
      initialBreedingId = breedings[0]?.id ?? '';
    }

    return { animals, settings, initialBreedingId };
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animalId: initialAnimalId,
      breedingId: '',
      checkDate: format(new Date(), 'yyyy-MM-dd'),
      result: 'Pregnant',
      recheckDate: '',
      notes: '',
    },
  });

  // When the form data loads set the initial breedingId
  const initialBreedingId = data?.initialBreedingId;
  if (initialBreedingId && !form.getValues('breedingId')) {
    form.setValue('breedingId', initialBreedingId);
  }

  // When animal changes, reload the latest breeding for that animal
  const watchedAnimalId = form.watch('animalId');
  const animalBreedings = useLiveQuery(async () => {
    if (!watchedAnimalId) return [];
    return db.breedings.where('animalId').equals(watchedAnimalId).reverse().sortBy('date');
  }, [watchedAnimalId]) ?? [];

  // Auto-select the most recent breeding when animal changes
  const currentBreedingId = form.watch('breedingId');
  if (animalBreedings.length > 0 && !currentBreedingId) {
    form.setValue('breedingId', animalBreedings[0].id);
  }

  const result = form.watch('result');

  async function onSubmit(values: FormValues) {
    const animal = await db.animals.get(values.animalId);
    const settings = await db.settings.get('default');
    if (!animal || !settings) return;

    await processPregCheck(
      {
        animalId: values.animalId,
        breedingId: values.breedingId,
        checkDate: new Date(values.checkDate).toISOString(),
        result: values.result,
        recheckDate: values.recheckDate ? new Date(values.recheckDate).toISOString() : undefined,
        notes: values.notes || undefined,
      },
      animal,
      settings,
    );

    setLocation(initialAnimalId ? `/herd/${initialAnimalId}` : '/checklist/preg-check');
  }

  const backHref = initialAnimalId ? `/herd/${initialAnimalId}` : '/checklist/preg-check';

  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">Pregnancy Check</h2>
      </div>

      <Card>
        <CardContent className="p-4 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Animal */}
              <FormField
                control={form.control}
                name="animalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Animal</FormLabel>
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={e => {
                          field.onChange(e.target.value);
                          form.setValue('breedingId', '');
                        }}
                        className="h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select animal…</option>
                        {data.animals.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.number} — {a.barnName || a.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Breeding being checked */}
              {animalBreedings.length > 0 ? (
                <FormField
                  control={form.control}
                  name="breedingId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breeding</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={e => field.onChange(e.target.value)}
                          className="h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Select breeding…</option>
                          {animalBreedings.map(b => (
                            <option key={b.id} value={b.id}>
                              {format(new Date(b.date), 'MMM d, yyyy')} — {b.breedingType}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : watchedAnimalId ? (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  No breeding records found for this animal. Record a breeding first.
                </p>
              ) : null}

              {/* Check Date */}
              <FormField
                control={form.control}
                name="checkDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-12 text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Result — large tap targets */}
              <FormField
                control={form.control}
                name="result"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Result</FormLabel>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {(['Pregnant', 'Open', 'Recheck'] as const).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => field.onChange(r)}
                          className={`h-14 rounded-lg border-2 font-bold text-sm transition-colors ${
                            field.value === r
                              ? r === 'Pregnant'
                                ? 'bg-green-700 border-green-700 text-white'
                                : r === 'Open'
                                  ? 'bg-destructive border-destructive text-white'
                                  : 'bg-amber-500 border-amber-500 text-white'
                              : 'border-border bg-card text-foreground hover:bg-secondary'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Recheck date — only shown when result = Recheck */}
              {result === 'Recheck' && (
                <FormField
                  control={form.control}
                  name="recheckDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recheck Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-12 text-base" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        className="text-base min-h-[80px]"
                        placeholder="Any additional notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-14 text-lg font-bold mt-2">
                Save Result
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
