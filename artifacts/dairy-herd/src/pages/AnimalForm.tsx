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
import { deriveStatus } from '@/db/computed';
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
  lactationStatus: z.enum(['Milking', 'Dry', 'Heifer']),
  reproStatus: z.enum(['Open', 'Bred', 'Pregnant', 'Fresh']),
  disposition: z.enum(['Active', 'Sold', 'Dead']),
  lactationNumber: z.coerce.number().min(0),
  rfidTag: z.string().optional(),
  sire: z.string().optional(),
  dam: z.string().optional(),
  birthDate: z.string().optional(),
  lastCalvingDate: z.string().optional(),
  // Service sire — shown when reproStatus is Bred or Pregnant on a new animal
  breedingDate: z.string().optional(),
  breedingType: z.enum(['AI', 'NaturalService', 'Embryo']).optional(),
  serviceBullId: z.string().optional(),
  naturalServiceBullName: z.string().optional(),
  serviceEmbryoId: z.string().optional(),
  expectedCalvingDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function inferLactation(status: string): 'Milking' | 'Dry' | 'Heifer' {
  if (status === 'Dry') return 'Dry';
  if (status === 'Heifer' || status === 'BredHeifer') return 'Heifer';
  return 'Milking';
}
function inferRepro(status: string): 'Open' | 'Bred' | 'Pregnant' | 'Fresh' {
  if (status === 'Pregnant') return 'Pregnant';
  if (status === 'BredHeifer') return 'Bred';
  return 'Open';
}
function inferDisposition(status: string): 'Active' | 'Sold' | 'Dead' {
  if (status === 'Sold') return 'Sold';
  if (status === 'Dead') return 'Dead';
  return 'Active';
}

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
      lactationStatus: 'Milking',
      reproStatus: 'Open',
      disposition: 'Active',
      lactationNumber: 1,
      rfidTag: '',
      sire: '',
      dam: '',
      birthDate: '',
      lastCalvingDate: '',
      breedingDate: format(new Date(), 'yyyy-MM-dd'),
      breedingType: 'AI',
      serviceBullId: '',
      naturalServiceBullName: '',
      serviceEmbryoId: '',
      expectedCalvingDate: '',
    },
  });

  const lactationStatus = form.watch('lactationStatus');
  const reproStatus = form.watch('reproStatus');
  const breedingType = form.watch('breedingType');
  const breedingDate = form.watch('breedingDate');

  const showBreedingSection = (reproStatus === 'Bred' || reproStatus === 'Pregnant') && !isEdit;

  // Auto-calculate expected calving date when breeding date changes
  useEffect(() => {
    if (!settings || !breedingDate || !showBreedingSection) return;
    if (reproStatus === 'Pregnant') {
      const calving = addDays(parseISO(breedingDate), settings.gestationDays);
      form.setValue('expectedCalvingDate', format(calving, 'yyyy-MM-dd'));
    }
  }, [breedingDate, settings, reproStatus, showBreedingSection]);

  useEffect(() => {
    if (isEdit && id) {
      db.animals.get(id).then(animal => {
        if (animal) {
          form.reset({
            number: animal.number,
            name: animal.name,
            breed: animal.breed,
            lactationStatus: animal.lactationStatus ?? inferLactation(animal.status),
            reproStatus: animal.reproStatus ?? inferRepro(animal.status),
            disposition: inferDisposition(animal.status),
            lactationNumber: animal.lactationNumber,
            rfidTag: animal.rfidTag || '',
            sire: animal.sire || '',
            dam: animal.dam || '',
            birthDate: animal.birthDate ? animal.birthDate.slice(0, 10) : '',
            lastCalvingDate: animal.lastCalvingDate ? animal.lastCalvingDate.slice(0, 10) : '',
            breedingDate: format(new Date(), 'yyyy-MM-dd'),
            breedingType: 'AI',
            serviceBullId: '',
            naturalServiceBullName: '',
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
    const derivedStatus = deriveStatus(values.lactationStatus, values.reproStatus, values.disposition);

    if (isEdit && id) {
      await db.animals.update(id, {
        number: values.number,
        name: values.name,
        breed: values.breed,
        lactationStatus: values.lactationStatus,
        reproStatus: values.reproStatus,
        status: derivedStatus,
        lactationNumber: values.lactationNumber,
        rfidTag: values.rfidTag || undefined,
        sire: values.sire?.trim() || undefined,
        dam: values.dam?.trim() || undefined,
        birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : undefined,
        lastCalvingDate: values.lastCalvingDate
          ? new Date(values.lastCalvingDate).toISOString()
          : undefined,
        updatedAt: now,
      });
      setLocation(`/herd/${id}`);
      return;
    }

    // --- New animal ---
    const newId = crypto.randomUUID();

    let expectedCalvingDate: string | undefined;
    let expectedDryOffDate: string | undefined;

    if (values.reproStatus === 'Pregnant' && values.expectedCalvingDate && settings) {
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
      lactationStatus: values.lactationStatus,
      reproStatus: values.reproStatus,
      status: derivedStatus,
      lactationNumber: values.lactationNumber,
      rfidTag: values.rfidTag || undefined,
      sire: values.sire?.trim() || undefined,
      dam: values.dam?.trim() || undefined,
      birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : undefined,
      lastCalvingDate: values.lastCalvingDate
        ? new Date(values.lastCalvingDate).toISOString()
        : undefined,
      expectedCalvingDate,
      expectedDryOffDate,
      createdAt: now,
      updatedAt: now,
    });

    // Create breeding record if service sire info provided
    if (showBreedingSection && values.breedingDate && values.breedingType) {
      const breedingDateISO = new Date(values.breedingDate).toISOString();
      const pregCheckDays = settings?.pregnancyCheckDays ?? 35;
      const pregCheckDate = addDays(parseISO(values.breedingDate), pregCheckDays).toISOString();

      await db.breedings.add({
        id: crypto.randomUUID(),
        animalId: newId,
        date: breedingDateISO,
        breedingType: values.breedingType,
        bullId: values.breedingType === 'AI' ? (values.serviceBullId || undefined) : undefined,
        naturalServiceBullName: values.breedingType === 'NaturalService'
          ? (values.naturalServiceBullName?.trim() || undefined)
          : undefined,
        embryoId: values.breedingType === 'Embryo' ? (values.serviceEmbryoId || undefined) : undefined,
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

              {/* Number + Name */}
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

              {/* ── Status ── */}
              <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="lactationStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lactation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Milking">Milking</SelectItem>
                          <SelectItem value="Dry">Dry</SelectItem>
                          <SelectItem value="Heifer">Heifer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="reproStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repro</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Bred">Bred</SelectItem>
                          <SelectItem value="Pregnant">Pregnant</SelectItem>
                          <SelectItem value="Fresh">Fresh</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="disposition" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disposition</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Sold">Sold</SelectItem>
                        <SelectItem value="Dead">Dead</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Breed + Lactation # */}
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

              {/* Last Calving Date */}
              {lactationStatus !== 'Heifer' && (
                <FormField control={form.control} name="lastCalvingDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Calving Date</FormLabel>
                    <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="AI">AI</SelectItem>
                          <SelectItem value="NaturalService">Natural Service</SelectItem>
                          <SelectItem value="Embryo">Embryo Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {breedingType === 'AI' && (
                    <FormField control={form.control} name="serviceBullId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bull</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12"><SelectValue placeholder="Select bull (optional)" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bulls.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.name} — {b.studCompany}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {breedingType === 'NaturalService' && (
                    <FormField control={form.control} name="naturalServiceBullName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bull Name</FormLabel>
                        <FormControl>
                          <Input className="h-12" placeholder="e.g. Big Red, Reg. #12345 (optional)" {...field} />
                        </FormControl>
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
                            <SelectTrigger className="h-12"><SelectValue placeholder="Select embryo lot (optional)" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {embryos.map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.donorName} — {e.breed}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {reproStatus === 'Pregnant' && (
                    <FormField control={form.control} name="expectedCalvingDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Calving Date</FormLabel>
                        <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              )}

              {/* ── Identity ── */}
              <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Identity</p>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sire" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sire</FormLabel>
                      <FormControl><Input className="h-12" placeholder="Sire name / reg." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dam" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dam</FormLabel>
                      <FormControl><Input className="h-12" placeholder="Dam name / reg." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="rfidTag" render={({ field }) => (
                    <FormItem>
                      <FormLabel>RFID Tag</FormLabel>
                      <FormControl><Input className="h-12" placeholder="Optional" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base font-bold" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Animal'}
              </Button>

              {isEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 mr-2" /> Remove Animal
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this animal?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the animal and all their records (breedings, treatments, calvings, notes). This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90 text-white"
                        onClick={removeAnimal}
                      >
                        Yes, Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
