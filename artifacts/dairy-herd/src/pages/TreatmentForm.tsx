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
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, addDays } from 'date-fns';

const formSchema = z.object({
  animalId: z.string().min(1, 'Animal is required'),
  date: z.string().min(1, 'Date is required'),
  condition: z.string().min(1, 'Condition / problem is required'),
  product: z.string().min(1, 'Product / treatment is required'),
  dose: z.string().optional(),
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

  const animals = useLiveQuery(() => db.animals.toArray()) ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animalId: initialAnimalId,
      date: format(new Date(), 'yyyy-MM-dd'),
      condition: '',
      product: '',
      dose: '',
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

  // Preview the withhold-until date as the user types
  const milkWithholdUntilPreview =
    milkWithholdDays && milkWithholdDays > 0 && dateValue
      ? format(addDays(new Date(dateValue), milkWithholdDays), 'MMM d, yyyy')
      : null;

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
      createdAt: now,
      updatedAt: now,
    });

    // Go back to the animal record if we came from one, otherwise go to treatment checklist
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
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">Record Treatment</h2>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder="Select animal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {animals.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.number} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-12 text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Condition */}
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition / Problem</FormLabel>
                    <FormControl>
                      <Input className="h-12 text-base" placeholder="e.g. Mastitis, Milk fever, Foot rot" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Product */}
              <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product / Treatment</FormLabel>
                    <FormControl>
                      <Input className="h-12 text-base" placeholder="e.g. Penicillin, Dextrose, Banamine" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dose + Route in a row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dose</FormLabel>
                      <FormControl>
                        <Input className="h-12 text-base" placeholder="e.g. 10 mL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="route"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Route</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="IM">IM</SelectItem>
                          <SelectItem value="SQ">SQ</SelectItem>
                          <SelectItem value="IV">IV</SelectItem>
                          <SelectItem value="Oral">Oral</SelectItem>
                          <SelectItem value="Intramammary">Intramammary</SelectItem>
                          <SelectItem value="Topical">Topical</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Administrator */}
              <FormField
                control={form.control}
                name="administrator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person Administering (optional)</FormLabel>
                    <FormControl>
                      <Input className="h-12 text-base" placeholder="Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Withhold days */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="milkWithholdDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Milk Withhold (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="h-12 text-base"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="meatWithholdDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meat Withhold (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="h-12 text-base"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Milk withhold warning banner */}
              {milkWithholdUntilPreview && (
                <div className="flex items-center gap-3 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg font-semibold">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>Milk Withhold until {milkWithholdUntilPreview}</span>
                </div>
              )}

              {/* Follow-up date */}
              <FormField
                control={form.control}
                name="followUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follow-Up Date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-12 text-base" {...field} />
                    </FormControl>
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
                        placeholder="Any additional notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
