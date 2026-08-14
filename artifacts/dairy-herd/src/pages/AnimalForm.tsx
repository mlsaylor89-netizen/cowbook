import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { Link, useLocation, useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  number: z.string().min(1, 'Number is required'),
  name: z.string().min(1, 'Name is required'),
  breed: z.string().min(1, 'Breed is required'),
  status: z.enum(['Lactating', 'Dry', 'Heifer', 'BredHeifer', 'Pregnant', 'Open', 'Sold', 'Dead']),
  lactationNumber: z.coerce.number().min(0),
  rfidTag: z.string().optional(),
});

export function AnimalForm() {
  const [, setLocation] = useLocation();
  const [matchEdit, params] = useRoute('/herd/:id/edit');
  const isEdit = !!matchEdit;
  const id = params?.id;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: '',
      name: '',
      breed: 'Holstein',
      status: 'Heifer',
      lactationNumber: 0,
      rfidTag: '',
    },
  });

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
          });
        }
      });
    }
  }, [id, isEdit, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const now = new Date().toISOString();
    
    if (isEdit && id) {
      await db.animals.update(id, {
        ...values,
        updatedAt: now
      });
      setLocation(`/herd/${id}`);
    } else {
      const newId = crypto.randomUUID();
      await db.animals.add({
        ...values,
        id: newId,
        farmId: 'demo-farm',
        createdAt: now,
        updatedAt: now
      });
      setLocation(`/herd/${newId}`);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={isEdit ? `/herd/${id}` : "/herd"}>
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
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number</FormLabel>
                      <FormControl>
                        <Input className="h-12" placeholder="e.g. 101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input className="h-12" placeholder="e.g. Daisy" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="breed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breed</FormLabel>
                      <FormControl>
                        <Input className="h-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lactationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lactation #</FormLabel>
                      <FormControl>
                        <Input className="h-12" type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full h-14 text-lg font-bold mt-4">
                {isEdit ? 'Save Changes' : 'Add Animal'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
