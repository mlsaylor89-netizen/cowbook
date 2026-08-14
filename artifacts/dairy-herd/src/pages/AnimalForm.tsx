import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { Link, useLocation, useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, addDays, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const formSchema = z.object({
  number: z.string().min(1, 'Number is required'),
  name: z.string().min(1, 'Name is required'),
  breed: z.string().min(1, 'Breed is required'),
  status: z.enum(['Lactating', 'Dry', 'Heifer', 'BredHeifer', 'Pregnant', 'Open', 'Sold', 'Dead']),
  lactationNumber: z.coerce.number().min(0),
  rfidTag: z.string().optional(),
  // Service sire — shown when status is BredHeifer or Pregnant
  breedingDate: z.string().optional(),
  breedingType: z.enum(['AI', 'NaturalService', 'Embryo']).optional(),
  serviceBullId: z.string().optional(),
  serviceEmbryoId: z.string().optional(),
  expectedCalvingDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const BRED_STATUSES = ['BredHeifer', 'Pregnant'];

export function AnimalForm() {
  const [, setLocation] = useLocation();
  const [matchEdit, params] = useRoute('/herd/:id/edit');
  const isEdit = !!matchEdit;
  const id = params?.id;

  const { bulls, embryos, settings } = useLiveQuery(async () => ({
    bulls: await db.semenBulls.toArray(),
    embryos: await db.embryos.toArray(),
    settings: await db.settings.get('default'),
  })) || { bulls: [], embryos: [], settings: null };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: '',
      name: '',
      breed: 'Holstein',
      status: 'Heifer',
      lactationNumber: 0,
      rfidTag: '',
      breedingDate: format(new Date(), 'yyyy-MM-dd'),
      breedingType: 'AI',
      serviceBullId: '',
      serviceEmbryoId: '',
      expectedCalvingDate: '',
    },
  });

  const status = form.watch('status');
  const breedingType = form.watch('breedingType');
  const breedingDate = form.watch('breedingDate');
  const showBreedingSection = BRED_STATUSES.includes(status) && !isEdit;

  // Auto-calculate expected calving date when breeding date changes
  useEffect(() => {
    if (!settings || !breedingDate || !showBreedingSection) return;
    if (status === 'Pregnant') {
      const calving = addDays(parseISO(breedingDate), settings.gestationDays);
      form.setValue('expectedCalvingDate', format(calving, 'yyyy-MM-dd'));
    }
  }, [breedingDate, settings, status, showBreedingSection]);

  useEffect(() => {
    if (isEdit && id) {
      db.animals.get(id).then(animal => {
        if (animal) {
          form.reset({
            number: animal.number,
            name: animal.name,
            breed: animal.breed,
            status: animal.status,
            lactationNumber: animal.lactationNumber,
            rfidTag: animal.rfidTag || '',
            breedingDate: format(new Date(), 'yyyy-MM-dd'),
            breedingType: 'AI',
            serviceBullId: '',
            serviceEmbryoId: '',
            expectedCalvingDate: '',
          });
        }
      });
    }
  }, [id, isEdit, form]);

  async function removeAnimal() {
    if (!id) return;
    await Promise.all([
      db.animals.delete(id),
      db.breedings.where('animalId').equals(id).delete(),
      db.calvings.where('animalId').equals(id).delete(),
      db.pregnancyChecks.where('animalId').equals(id).delete(),
      db.treatments.where('animalId').equals(id).delete(),
      db.animalNotes.where('animalId').equals(id).delete(),
    ]);
    setLocation('/herd');
  }

  async function onSubmit(values: FormValues) {
    const now = new Date().toISOString();

    if (isEdit && id) {
      await db.animals.update(id, { ...values, updatedAt: now });
      setLocation(`/herd/${id}`);
      return;
    }

    // --- New animal ---
    const newId = crypto.randomUUID();

    // Resolve calving/dry-off dates for Pregnant animals
    let expectedCalvingDate: string | undefined;
    let expectedDryOffDate: string | undefined;

    if (values.status === 'Pregnant' && values.expectedCalvingDate && settings) {
      expectedCalvingDate = new Date(values.expectedCalvingDate).toISOString();
      const dryOff = addDays(parseISO(values.expectedCalvingDate), -settings.dryPeriodDays);
      expectedDryOffDate = dryOff.toISOString();
    }

    await db.animals.add({
      id: newId,
      farmId: 'demo-farm',
      number: values.number,
      name: values.name,
      breed: values.breed,
      status: values.status,
      lactationNumber: values.lactationNumber,
      rfidTag: values.rfidTag || undefined,
      expectedCalvingDate,
      expectedDryOffDate,
      createdAt: now,
      updatedAt: now,
    });

    // Create breeding record if service sire info was provided
    if (showBreedingSection && values.breedingDate && values.breedingType) {
      const breedingDateISO = new Date(values.breedingDate).toISOString();
      const pregCheckDays = settings?.pregnancyCheckDays ?? 35;
      const pregCheckDate = addDays(parseISO(values.breedingDate), pregCheckDays).toISOString();

      await db.breedings.add({
        id: crypto.randomUUID(),
        animalId: newId,
        date: breedingDateISO,
        breedingType: values.breedingType,
        bullId: values.breedingType !== 'Embryo'
          ? (values.serviceBullId || undefined)
          : undefined,
        embryoId: values.breedingType === 'Embryo'
          ? (values.serviceEmbryoId || undefined)
          : undefined,
        pregnancyCheckScheduledDate: pregCheckDate,
        createdAt: now,
        updatedAt: now,
      });
    }

    setLocation(`/herd/${newId}`);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={isEdit ? `/herd/${id}` : '/herd'}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">{isEdit ? 'Edit Animal' : 'Add Animal'}</h2>
      </div>

      <Card>
        <CardContent className="p-4 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number</FormLabel>
                    <FormControl><Input className="h-12" placeholder="e.g. 101" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input className="h-12" placeholder="e.g. Daisy" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={(val) => {
                    field.onChange(val);
                    // reset sire fields when status changes away from bred
                    if (!BRED_STATUSES.includes(val)) {
                      form.setValue('serviceBullId', '');
                      form.setValue('serviceEmbryoId', '');
                    }
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Lactating">Lactating</SelectItem>
                      <SelectItem value="Dry">Dry</SelectItem>
                      <SelectItem value="Pregnant">Pregnant</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Heifer">Heifer</SelectItem>
                      <SelectItem value="BredHeifer">Bred Heifer</SelectItem>
                      <SelectItem value="Sold">Sold</SelectItem>
                      <SelectItem value="Dead">Dead</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="breed" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breed</FormLabel>
                    <FormControl><Input className="h-12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lactationNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lactation #</FormLabel>
                    <FormControl><Input className="h-12" type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ── Service Sire Section ── */}
              {showBreedingSection && (
                <div className="border rounded-xl p-4 space-y-4 bg-muted/30">
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Service Sire</p>

                  <FormField control={form.control} name="breedingDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breeding / Service Date</FormLabel>
                      <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="breedingType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breeding Type</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue('serviceBullId', '');
                        form.setValue('serviceEmbryoId', '');
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
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
                  )} />

                  {(breedingType === 'AI' || breedingType === 'NaturalService') && (
                    <FormField control={form.control} name="serviceBullId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{breedingType === 'AI' ? 'Semen / Bull' : 'Exposed to Bull'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Select bull (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Unknown / Not recorded</SelectItem>
                            {bulls.map(b => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}{b.naabCode ? ` — ${b.naabCode}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {breedingType === 'Embryo' && (
                    <FormField control={form.control} name="serviceEmbryoId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Embryo Lot</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
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
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {status === 'Pregnant' && (
                    <FormField control={form.control} name="expectedCalvingDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Calving Date</FormLabel>
                        <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                        <p className="text-xs text-muted-foreground">Auto-calculated from breeding date + gestation days. Adjust if needed.</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-14 text-lg font-bold mt-4">
                {isEdit ? 'Save Changes' : 'Add Animal'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isEdit && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full h-12 border-destructive text-destructive hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Remove Animal
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this animal?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the animal and all of her records — breedings, calvings, pregnancy checks, treatments, and notes. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-white"
                onClick={removeAnimal}
              >
                Yes, Remove Animal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
