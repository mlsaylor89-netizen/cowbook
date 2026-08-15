import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLiveQuery } from 'dexie-react-hooks';
import { processBreeding } from '@/db/computed';
import { format } from 'date-fns';

const formSchema = z.object({
  animalId: z.string().min(1, 'Cow is required'),
  date: z.string().min(1, 'Date is required'),
  bullId: z.string().optional(),
  embryoId: z.string().optional(),
  breedingType: z.enum(['AI', 'NaturalService', 'Embryo']),
  technician: z.string().optional(),
});

export function BreedingForm() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialAnimalId = searchParams.get('animalId') || '';

  const { animals, bulls, embryos, settings } = useLiveQuery(async () => {
    return {
      animals: (await db.animals.toArray()).filter(a => {
        const s = a.status;
        if (s === 'Sold' || s === 'Dead') return false;
        const rs = a.reproStatus ?? (s === 'Pregnant' ? 'Pregnant' : s === 'BredHeifer' ? 'Bred' : 'Open');
        return rs === 'Open' || rs === 'Bred';
      }),
      bulls: await db.semenBulls.toArray(),
      embryos: await db.embryos.toArray(),
      settings: await db.settings.get('default')
    };
  }) || { animals: [], bulls: [], embryos: [], settings: null };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      animalId: initialAnimalId,
      date: format(new Date(), 'yyyy-MM-dd'),
      breedingType: 'AI',
      bullId: '',
      embryoId: '',
      technician: '',
    },
  });

  const breedingType = form.watch('breedingType');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!settings) return;

    const breedingDate = new Date(values.date).toISOString();
    const pregCheckDate = new Date(new Date(values.date).getTime() + settings.pregnancyCheckDays * 24 * 60 * 60 * 1000).toISOString();

    await processBreeding({
      animalId: values.animalId,
      date: breedingDate,
      breedingType: values.breedingType,
      bullId: values.breedingType !== 'Embryo' ? (values.bullId || undefined) : undefined,
      embryoId: values.breedingType === 'Embryo' ? (values.embryoId || undefined) : undefined,
      technician: values.technician,
      pregnancyCheckScheduledDate: pregCheckDate
    });

    setLocation('/checklist/breeding');
  }

  if (!settings) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">Record Breeding</h2>
      </div>

      <Card>
        <CardContent className="p-4 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <FormField
                control={form.control}
                name="animalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cow</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-lg">
                          <SelectValue placeholder="Select cow" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {animals.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.number} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-12 text-lg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="breedingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breeding Type</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      // clear the other selector when switching type
                      form.setValue('bullId', '');
                      form.setValue('embryoId', '');
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-lg">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="AI">AI (Artificial Insemination)</SelectItem>
                        <SelectItem value="NaturalService">Natural Service</SelectItem>
                        <SelectItem value="Embryo">Embryo Transfer (ET)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(breedingType === 'AI' || breedingType === 'NaturalService') && (
                <FormField
                  control={form.control}
                  name="bullId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {breedingType === 'AI' ? 'Semen / Bull' : 'Exposed to Bull'}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-lg">
                            <SelectValue placeholder={breedingType === 'AI' ? 'Select bull' : 'Select bull (optional)'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {breedingType === 'NaturalService' && (
                            <SelectItem value="">Unknown / Not recorded</SelectItem>
                          )}
                          {bulls.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}{b.naabCode ? ` — ${b.naabCode}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {breedingType === 'Embryo' && (
                <FormField
                  control={form.control}
                  name="embryoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Embryo Lot</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-lg">
                            <SelectValue placeholder="Select embryo lot (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Unknown / Not recorded</SelectItem>
                          {embryos.map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.donorName}{e.sireName ? ` × ${e.sireName}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {embryos.length === 0 && (
                        <p className="text-xs text-muted-foreground pt-1">
                          No embryo lots on file —{' '}
                          <a href="/embryo/new" className="underline text-primary">add one</a> first to track inventory.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button type="submit" className="w-full h-14 text-lg font-bold mt-4">
                Record Breeding
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
