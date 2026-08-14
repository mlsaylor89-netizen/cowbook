import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  farmName: z.string().min(1, 'Farm name is required'),
  pregnancyCheckDays: z.coerce.number().min(20).max(100),
  freshCowWindowDays: z.coerce.number().min(3).max(30),
  voluntaryWaitingPeriodDays: z.coerce.number().min(30).max(100),
  dryPeriodDays: z.coerce.number().min(30).max(100),
  dryOffWarningDays: z.coerce.number().min(1).max(30),
  lowSemenThreshold: z.coerce.number().min(0),
  gestationDays: z.coerce.number().min(270).max(295),
});

export function Settings() {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      farmName: '',
      pregnancyCheckDays: 35,
      freshCowWindowDays: 10,
      voluntaryWaitingPeriodDays: 60,
      dryPeriodDays: 60,
      dryOffWarningDays: 14,
      lowSemenThreshold: 2,
      gestationDays: 283,
    },
  });

  useEffect(() => {
    db.settings.get('default').then(settings => {
      if (settings) {
        form.reset(settings);
      }
    });
  }, [form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await db.settings.update('default', {
      ...values,
      updatedAt: new Date().toISOString()
    });
    
    toast({
      title: 'Settings saved',
      description: 'Your changes have been saved successfully.',
    });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/more">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">Settings</h2>
      </div>

      <Card>
        <CardContent className="p-4 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="farmName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Farm Name</FormLabel>
                    <FormControl>
                      <Input className="h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-sm">Herd Management Limits</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pregnancyCheckDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preg Check (Days bred)</FormLabel>
                        <FormControl>
                          <Input className="h-12" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshCowWindowDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fresh Window (DIM)</FormLabel>
                        <FormControl>
                          <Input className="h-12" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="voluntaryWaitingPeriodDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VWP (DIM)</FormLabel>
                        <FormControl>
                          <Input className="h-12" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dryPeriodDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dry Period (Days)</FormLabel>
                        <FormControl>
                          <Input className="h-12" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dryOffWarningDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dry-Off Warning</FormLabel>
                        <FormControl>
                          <Input className="h-12" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gestationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gestation (Days)</FormLabel>
                        <FormControl>
                          <Input className="h-12" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-14 text-lg font-bold">
                <Save className="mr-2 h-5 w-5" /> Save Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
