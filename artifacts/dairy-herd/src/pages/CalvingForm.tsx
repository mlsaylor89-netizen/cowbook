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
import { processCalving } from '@/db/computed';
import { format } from 'date-fns';

const formSchema = z.object({
  animalId: z.string().min(1, 'Animal is required'),
  calvingDate: z.string().min(1, 'Calving date is required'),
  calfSex: z.enum(['Heifer', 'Bull', 'Twins', 'Stillborn', 'Unknown']),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CalvingForm() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialAnimalId = searchParams.get('animalId') || '';

  const animals = useLiveQuery(() =>
    db.animals.toArray().then(a => a.sort((x, y) => (x.barnName || x.name).localeCompare(y.barnName || y.name)))
  ) ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animalId: initialAnimalId,
      calvingDate: format(new Date(), 'yyyy-MM-dd'),
      calfSex: 'Heifer',
      notes: '',
    },
  });

  async function onSubmit(values: FormValues) {
    const animal = await db.animals.get(values.animalId);
    if (!animal) return;

    const { calfId } = await processCalving(
      {
        animalId: values.animalId,
        calvingDate: new Date(values.calvingDate).toISOString(),
        calfSex: values.calfSex,
        notes: values.notes || undefined,
      },
      animal,
    );

    // Check if any calving protocols exist — if so, send user to the checklist.
    // Attach the protocol to the calf's page when a calf record was created,
    // otherwise fall back to the dam's page.
    const calvingProtocols = await db.protocols
      .where('triggerType').equals('calving')
      .count();

    const returnTo = initialAnimalId ? `/herd/${initialAnimalId}` : '/herd';

    if (calvingProtocols > 0) {
      const checklistParams = new URLSearchParams({
        trigger: 'calving',
        animalId: calfId ?? values.animalId,
        returnTo,
      });
      setLocation(`/protocol-checklist?${checklistParams.toString()}`);
    } else {
      setLocation(returnTo);
    }
  }

  const backHref = initialAnimalId ? `/herd/${initialAnimalId}` : '/herd';

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">Record Calving</h2>
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
                        onChange={e => field.onChange(e.target.value)}
                        className="h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select animal…</option>
                        {animals.map(a => (
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

              {/* Calving Date */}
              <FormField
                control={form.control}
                name="calvingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calving Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-12 text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Calf Sex */}
              <FormField
                control={form.control}
                name="calfSex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calf</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Heifer">Heifer</SelectItem>
                        <SelectItem value="Bull">Bull</SelectItem>
                        <SelectItem value="Twins">Twins</SelectItem>
                        <SelectItem value="Stillborn">Stillborn</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        placeholder="Any additional notes about the calving"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-14 text-lg font-bold mt-2">
                Record Calving
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
