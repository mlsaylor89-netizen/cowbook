import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/db';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Copy, CheckCheck, RefreshCw, UserMinus, Shield, Crown, AlertTriangle, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/useAuth';
import {
  getFarmDoc,
  listFarmMembers,
  removeFarmMember,
  updateMemberRole,
  regenerateJoinCode,
  repairFarmDoc,
  normaliseRole,
  roleLabel,
  type FarmDoc,
  type MemberDetail,
  type MemberRole,
} from '@/lib/farmService';

// ─── Herd settings form ────────────────────────────────────────────────────

const formSchema = z.object({
  farmName: z.string().min(1, 'Farm name is required'),
  pregnancyCheckDays: z.coerce.number().min(20).max(100),
  freshCowWindowDays: z.coerce.number().min(3).max(30),
  voluntaryWaitingPeriodDays: z.coerce.number().min(30).max(100),
  dryPeriodDays: z.coerce.number().min(30).max(100),
  dryOffWarningDays: z.coerce.number().min(1).max(30),
  lowSemenThreshold: z.coerce.number().min(0),
  gestationDays: z.coerce.number().min(270).max(295),
  conventionalBreedingHours: z.coerce.number().min(1).max(72),
  sexedBreedingHours: z.coerce.number().min(1).max(72),
  embryoTransferHours: z.coerce.number().min(24).max(240),
});

export function Settings() {
  const { toast } = useToast();
  const [clearing, setClearing] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);

  async function clearAllData() {
    if (!clearArmed) { setClearArmed(true); return; }
    setClearing(true);
    setClearArmed(false);
    try {
      await Promise.all([
        db.animals.clear(),
        db.breedings.clear(),
        db.pregnancyChecks.clear(),
        db.calvings.clear(),
        db.treatments.clear(),
        db.semenBulls.clear(),
        db.semenPurchases.clear(),
        db.animalNotes.clear(),
        db.classifications.clear(),
        db.embryos.clear(),
        db.embryoPurchases.clear(),
        db.drugProducts.clear(),
        db.heats.clear(),
        db.syncProtocolBatches.clear(),
        db.syncEvents.clear(),
        db.flushRecords.clear(),
        db.etRecipients.clear(),
      ]);
      toast({ title: 'All data cleared', description: 'Every animal, event, and inventory record has been deleted. Settings were kept.' });
    } finally {
      setClearing(false);
    }
  }

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
      conventionalBreedingHours: 12,
      sexedBreedingHours: 30,
      embryoTransferHours: 168,
    },
  });

  useEffect(() => {
    db.settings.get('default').then(settings => {
      if (settings) form.reset(settings);
    });
  }, [form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await db.settings.update('default', {
      ...values,
      updatedAt: new Date().toISOString(),
    });
    toast({ title: 'Settings saved', description: 'Your changes have been saved successfully.' });
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

      {/* ── Herd management settings ── */}
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
                <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-sm">
                  Herd Management Limits
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="pregnancyCheckDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preg Check (Days bred)</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="freshCowWindowDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fresh Window (DIM)</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="voluntaryWaitingPeriodDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>VWP (DIM)</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dryPeriodDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dry Period (Days)</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dryOffWarningDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dry-Off Warning</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gestationDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gestation (Days)</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-sm">
                  Breeding Timing (hours after heat observed)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="conventionalBreedingHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conventional AI</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="sexedBreedingHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexed AI</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="embryoTransferHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ET Transfer</FormLabel>
                      <FormControl><Input className="h-12" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Button type="submit" className="w-full h-14 text-lg font-bold">
                <Save className="mr-2 h-5 w-5" /> Save Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ── Farm / Users ── */}
      <FarmUsersSection />

      {/* ── Danger Zone ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-destructive uppercase tracking-wider px-1 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Danger Zone
        </h3>
        <Card className="border-destructive/40">
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-bold">Clear All Demo Data</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Permanently deletes every animal, breeding, calving, heat, treatment, pregnancy check,
                inventory record, and ET recipient. Your farm settings are kept.
              </p>
            </div>

            {clearArmed ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  This will erase everything. Tap again to confirm.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={clearAllData}
                    disabled={clearing}
                  >
                    <Trash2 className="h-4 w-4" />
                    {clearing ? 'Clearing…' : 'Yes, delete everything'}
                  </Button>
                  <Button variant="outline" onClick={() => setClearArmed(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
                onClick={clearAllData}
                disabled={clearing}
              >
                <Trash2 className="h-4 w-4" /> Clear All Data
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Farm / Users section ──────────────────────────────────────────────────

function FarmUsersSection() {
  const { user, farmId, userDoc } = useAuth();
  const { toast } = useToast();

  const [farm, setFarm] = useState<FarmDoc | null>(null);
  const [members, setMembers] = useState<MemberDetail[]>([]);
  const [loadingFarm, setLoadingFarm] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairName, setRepairName] = useState('');
  const [repairError, setRepairError] = useState('');

  const isOwner = userDoc?.role === 'owner';

  async function load() {
    if (!farmId) return;
    setLoadingFarm(true);
    try {
      const [farmData, memberList] = await Promise.all([
        getFarmDoc(farmId),
        listFarmMembers(farmId),
      ]);
      setFarm(farmData);
      // Sort: owner first, then alphabetically
      setMembers(
        memberList.sort((a, b) => {
          if (a.role === 'owner') return -1;
          if (b.role === 'owner') return 1;
          return (a.displayName || a.email).localeCompare(b.displayName || b.email);
        }),
      );
    } catch {
      // Members subcollection may not exist on legacy farms — still show farm doc
    } finally {
      setLoadingFarm(false);
    }
  }

  useEffect(() => { load(); }, [farmId]); // eslint-disable-line react-hooks/exhaustive-deps

  function copyCode() {
    if (!farm?.joinCode) return;
    navigator.clipboard.writeText(farm.joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleRegenerate() {
    if (!farm || !farmId) return;
    if (!confirm('Generate a new join code? The old code will stop working immediately.')) return;
    setRegenerating(true);
    try {
      const newCode = await regenerateJoinCode(farmId, farm.joinCode);
      setFarm(prev => prev ? { ...prev, joinCode: newCode } : prev);
      toast({ title: 'Join code updated', description: `New code: ${newCode}` });
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to regenerate code',
        variant: 'destructive',
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRemove(uid: string, name: string) {
    if (!farmId) return;
    if (!confirm(`Remove ${name} from this farm? They will lose access immediately.`)) return;
    setRemovingId(uid);
    try {
      await removeFarmMember(farmId, uid);
      setMembers(prev => prev.filter(m => m.uid !== uid));
      toast({ title: 'Member removed', description: `${name} has been removed from the farm.` });
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRoleChange(uid: string, newRole: MemberRole) {
    if (!farmId) return;
    setUpdatingRoleId(uid);
    try {
      await updateMemberRole(farmId, uid, newRole);
      setMembers(prev => prev.map(m => m.uid === uid ? { ...m, role: newRole } : m));
      toast({ title: 'Role updated' });
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function handleRepair(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !user) return;
    setRepairing(true);
    setRepairError('');
    try {
      const newCode = await repairFarmDoc(
        farmId,
        user.uid,
        user.email!,
        userDoc?.displayName || user.email!,
        repairName.trim() || 'My Farm',
      );
      await load();
      toast({ title: 'Farm data repaired', description: `Your join code is ${newCode}` });
    } catch (err: unknown) {
      setRepairError(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setRepairing(false);
    }
  }

  if (loadingFarm) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">Farm / Users</h3>
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading…</CardContent></Card>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">Farm / Users</h3>
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <p className="font-bold text-destructive">Farm data missing</p>
            <p className="text-sm text-muted-foreground">
              Your account is linked to a farm but the farm record wasn't saved to the server.
              Enter your farm name to repair it — this will generate a new join code your family members can use.
            </p>
            <form onSubmit={handleRepair} className="space-y-2">
              <Input
                placeholder="Farm name (e.g. Sunny Pastures)"
                value={repairName}
                onChange={e => setRepairName(e.target.value)}
                required
              />
              {repairError && <p className="text-sm text-destructive">{repairError}</p>}
              <Button type="submit" className="w-full" disabled={repairing}>
                {repairing ? 'Repairing…' : 'Repair farm data'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">Farm / Users</h3>

      {/* ── Join code ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Farm Name</p>
            <p className="font-bold text-lg">{farm.name}</p>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Farm Join Code
            </p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-black tracking-widest font-mono text-primary">
                {farm.joinCode}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={copyCode}
              >
                {copied ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Share this code with family members so they can join your farm account.
              They must also create a HerdTrack account first.
            </p>
          </div>

          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Generating…' : 'Regenerate code'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Members list ── */}
      {isOwner && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Members ({members.length})
            </p>

            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No members on file yet. Members who join using the code above will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {members.map(m => {
                  const role = normaliseRole(m.role);
                  const name = m.displayName || m.email;
                  const isSelf = m.uid === user?.uid;
                  const isRemoving = removingId === m.uid;

                  return (
                    <div
                      key={m.uid}
                      className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {role === 'owner'
                            ? <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            : <Shield className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          }
                          <p className="font-bold truncate">{name}{isSelf ? ' (you)' : ''}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                          {roleLabel(role)}
                        </p>
                      </div>

                      {/* Actions — never show for self or the owner row */}
                      {!isSelf && role !== 'owner' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={role}
                            onChange={e => handleRoleChange(m.uid, e.target.value as MemberRole)}
                            disabled={updatingRoleId === m.uid}
                            className="text-xs border rounded-md px-2 py-1 bg-background"
                          >
                            <option value="full_access">Full Access</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemove(m.uid, name)}
                            disabled={isRemoving}
                            title="Remove member"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-owner: show own role only */}
      {!isOwner && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Your Role</p>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <p className="font-bold">{roleLabel(userDoc?.role ?? 'full_access')}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Contact the farm owner to change your role.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
