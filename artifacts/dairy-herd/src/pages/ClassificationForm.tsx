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

const scoreField = z.coerce.number().min(1).max(9).optional().or(z.literal('').transform(() => undefined));

const formSchema = z.object({
  animalId: z.string().min(1, 'Cow is required'),
  date: z.string().min(1, 'Date is required'),
  classifier: z.string().optional(),
  finalScore: z.enum(['E', 'VG', 'G+', 'G', 'F', 'P', '']).optional(),
  finalPoints: z.coerce.number().min(50).max(100).optional().or(z.literal('').transform(() => undefined)),
  // Frame
  stature: scoreField,
  strength: scoreField,
  bodyDepth: scoreField,
  dairyForm: scoreField,
  // Feet & Legs
  footAngle: scoreField,
  rearLegs: scoreField,
  // Udder
  foreUdderAttachment: scoreField,
  rearUdderHeight: scoreField,
  rearUdderWidth: scoreField,
  udderCleft: scoreField,
  udderDepth: scoreField,
  frontTeatPlacement: scoreField,
  rearTeatPlacement: scoreField,
  teatLength: scoreField,
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const LINEAR_TRAITS = [
  {
    group: 'Frame',
    traits: [
      { name: 'stature' as const, label: 'Stature', lo: 'Short', hi: 'Tall' },
      { name: 'strength' as const, label: 'Strength', lo: 'Frail', hi: 'Strong' },
      { name: 'bodyDepth' as const, label: 'Body Depth', lo: 'Shallow', hi: 'Deep' },
      { name: 'dairyForm' as const, label: 'Dairy Form', lo: 'Fleshy', hi: 'Sharp' },
    ],
  },
  {
    group: 'Feet & Legs',
    traits: [
      { name: 'footAngle' as const, label: 'Foot Angle', lo: 'Low (< 45°)', hi: 'High (> 55°)' },
      { name: 'rearLegs' as const, label: 'Rear Legs (side)', lo: 'Sickled', hi: 'Straight' },
    ],
  },
  {
    group: 'Udder',
    traits: [
      { name: 'foreUdderAttachment' as const, label: 'Fore Udder Attachment', lo: 'Weak', hi: 'Strong' },
      { name: 'rearUdderHeight' as const, label: 'Rear Udder Height', lo: 'Low', hi: 'High' },
      { name: 'rearUdderWidth' as const, label: 'Rear Udder Width', lo: 'Narrow', hi: 'Wide' },
      { name: 'udderCleft' as const, label: 'Udder Cleft', lo: 'Weak', hi: 'Strong' },
      { name: 'udderDepth' as const, label: 'Udder Depth', lo: 'Very Deep', hi: 'High' },
      { name: 'frontTeatPlacement' as const, label: 'Front Teat Placement', lo: 'Wide', hi: 'Close' },
      { name: 'rearTeatPlacement' as const, label: 'Rear Teat Placement', lo: 'Wide', hi: 'Close' },
      { name: 'teatLength' as const, label: 'Teat Length', lo: 'Short', hi: 'Long' },
    ],
  },
];

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
            stature: (c.stature ?? '') as any,
            strength: (c.strength ?? '') as any,
            bodyDepth: (c.bodyDepth ?? '') as any,
            dairyForm: (c.dairyForm ?? '') as any,
            footAngle: (c.footAngle ?? '') as any,
            rearLegs: (c.rearLegs ?? '') as any,
            foreUdderAttachment: (c.foreUdderAttachment ?? '') as any,
            rearUdderHeight: (c.rearUdderHeight ?? '') as any,
            rearUdderWidth: (c.rearUdderWidth ?? '') as any,
            udderCleft: (c.udderCleft ?? '') as any,
            udderDepth: (c.udderDepth ?? '') as any,
            frontTeatPlacement: (c.frontTeatPlacement ?? '') as any,
            rearTeatPlacement: (c.rearTeatPlacement ?? '') as any,
            teatLength: (c.teatLength ?? '') as any,
            notes: c.notes ?? '',
          });
        }
      });
    }
  }, [editId, form]);

  async function onSubmit(values: FormValues) {
    const now = new Date().toISOString();
    const payload: any = {
      animalId: values.animalId,
      date: new Date(values.date).toISOString(),
      classifier: values.classifier || undefined,
      finalScore: values.finalScore || undefined,
      finalPoints: values.finalPoints || undefined,
      stature: values.stature || undefined,
      strength: values.strength || undefined,
      bodyDepth: values.bodyDepth || undefined,
      dairyForm: values.dairyForm || undefined,
      footAngle: values.footAngle || undefined,
      rearLegs: values.rearLegs || undefined,
      foreUdderAttachment: values.foreUdderAttachment || undefined,
      rearUdderHeight: values.rearUdderHeight || undefined,
      rearUdderWidth: values.rearUdderWidth || undefined,
      udderCleft: values.udderCleft || undefined,
      udderDepth: values.udderDepth || undefined,
      frontTeatPlacement: values.frontTeatPlacement || undefined,
      rearTeatPlacement: values.rearTeatPlacement || undefined,
      teatLength: values.teatLength || undefined,
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* Animal + Date */}
          <Card>
            <CardContent className="p-4 pt-5 space-y-4">
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

              {/* Overall score */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="finalScore" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Final Score</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-lg"><SelectValue placeholder="Grade" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        <SelectItem value="E">E — Excellent (90+)</SelectItem>
                        <SelectItem value="VG">VG — Very Good (85–89)</SelectItem>
                        <SelectItem value="G+">G+ — Good Plus (80–84)</SelectItem>
                        <SelectItem value="G">G — Good (75–79)</SelectItem>
                        <SelectItem value="F">F — Fair (65–74)</SelectItem>
                        <SelectItem value="P">P — Poor (&lt; 65)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="finalPoints" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points (50–100)</FormLabel>
                    <FormControl><Input type="number" min="50" max="100" className="h-12" placeholder="e.g. 83" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Linear trait groups */}
          {LINEAR_TRAITS.map(group => (
            <Card key={group.group}>
              <CardContent className="p-4 pt-5 space-y-4">
                <h3 className="font-bold text-base text-muted-foreground uppercase tracking-wider">{group.group}</h3>
                {group.traits.map(trait => (
                  <FormField key={trait.name} control={form.control} name={trait.name} render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel className="text-sm font-medium">{trait.label}</FormLabel>
                        <span className="text-xs text-muted-foreground">1–9</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 text-right leading-tight">{trait.lo}</span>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="9"
                            className="h-10 text-center text-lg font-bold w-20 shrink-0"
                            placeholder="—"
                            {...field}
                          />
                        </FormControl>
                        <span className="text-xs text-muted-foreground w-20 leading-tight">{trait.hi}</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </CardContent>
            </Card>
          ))}

          {/* Notes */}
          <Card>
            <CardContent className="p-4 pt-5">
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional observations…" className="min-h-[80px] resize-none" {...field} />
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Button type="submit" className="w-full h-14 text-lg font-bold">
            {editId ? 'Save Changes' : 'Save Classification'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
