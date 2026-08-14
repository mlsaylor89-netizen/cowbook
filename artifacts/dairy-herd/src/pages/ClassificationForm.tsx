import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';

const formSchema = z.object({
  animalId: z.string().min(1, 'Cow is required'),
  date: z.string().min(1, 'Date is required'),
  classifier: z.string().optional(),
  finalScore: z.enum(['E', 'VG', 'G+', 'G', 'F', 'P', '']).optional(),
  finalPoints: z.coerce.number().min(50).max(100).optional().or(z.literal('').transform(() => undefined)),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function ClassificationForm() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialAnimalId = searchParams.get('animalId') || '';
  const editId = searchParams.get('editId') || '';

  const animals = useLiveQuery(async () => {
    const all = await db.animals.toArray();
    return all.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }) ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animalId: initialAnimalId,
      date: format(new Date(), 'yyyy-MM-dd'),
      classifier: '',
      finalScore: '',
      finalPoints: '' as any,
      notes: '',
    },
  });

  useEffect(() => {
    if (editId) {
      db.classifications.get(editId).then(c => {
        if (c) {
          form.reset({
            animalId: c.animalId,
            date: c.date.slice(0, 10),
            classifier: c.classifier ?? '',
            finalScore: (c.finalScore ?? '') as any,
            finalPoints: (c.finalPoints ?? '') as any,
            notes: c.notes ?? '',
          });
        }
      });
    }
  }, [editId, form]);

  async function onSubmit(values: FormValues) {
    const now = new Date().toISOString();
    const payload = {
      animalId: values.animalId,
      date: new Date(values.date).toISOString(),
      classifier: values.classifier || undefined,
      finalScore: (values.finalScore || undefined) as any,
      finalPoints: values.finalPoints || undefined,
      notes: values.notes || undefined,
    };

    if (editId) {
      await db.classifications.update(editId, { ...payload, updatedAt: now });
    } else {
      await db.classifications.add({ ...payload, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
    }

    setLocation(initialAnimalId ? `/herd/${values.animalId}` : '/herd');
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Link href={initialAnimalId ? `/herd/${initialAnimalId}` : '/herd'}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h2 className="text-xl font-bold">{editId ? 'Edit Classification' : 'Record Classification'}</h2>
      </div>

      <Card>
        <CardContent className="p-4 pt-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <FormField control={form.control} name="animalId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cow</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 text-lg"><SelectValue placeholder="Select cow" /></SelectTrigger>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="classifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classifier</FormLabel>
                    <FormControl><Input className="h-12" placeholder="Name (optional)" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="finalScore" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-lg"><SelectValue placeholder="—" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        <SelectItem value="E">E — Excellent</SelectItem>
                        <SelectItem value="VG">VG — Very Good</SelectItem>
                        <SelectItem value="G+">G+ — Good Plus</SelectItem>
                        <SelectItem value="G">G — Good</SelectItem>
                        <SelectItem value="F">F — Fair</SelectItem>
                        <SelectItem value="P">P — Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="finalPoints" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Score (50–100)</FormLabel>
                    <FormControl><Input type="number" min="50" max="100" className="h-12 text-lg" placeholder="e.g. 83" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional observations…" className="min-h-[70px] resize-none" {...field} />
                  </FormControl>
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-14 text-lg font-bold">
                {editId ? 'Save Changes' : 'Save Classification'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
