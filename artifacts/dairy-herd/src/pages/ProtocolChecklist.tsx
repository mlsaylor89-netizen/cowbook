import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { db, type Protocol } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';

/**
 * ProtocolChecklist — complete one or more protocols for a specific animal.
 *
 * Route: /protocol-checklist
 * Query params:
 *   trigger  — e.g. "calving" — loads all protocols for that trigger type
 *   animalId — the animal being processed
 *   returnTo — where to go after saving (default: /herd)
 *
 * Also supports a single protocol:
 *   protocolId — load just this one protocol
 */
export function ProtocolChecklist() {
  const [, navigate] = useLocation();
  const { farmId } = useAuth();

  const sp = new URLSearchParams(window.location.search);
  const trigger    = sp.get('trigger');
  const animalId   = sp.get('animalId') ?? '';
  const protocolId = sp.get('protocolId');
  const returnTo   = sp.get('returnTo') ?? '/herd';

  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [animal, setAnimal] = useState<{ name: string; barnName?: string; number: string } | null>(null);
  const [checked, setChecked] = useState<Record<string, Set<string>>>({}); // protocolId → Set of itemIds
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      // Load animal
      if (animalId) {
        const a = await db.animals.get(animalId);
        if (a) setAnimal(a);
      }
      // Load protocols
      let protos: Protocol[] = [];
      if (protocolId) {
        const p = await db.protocols.get(protocolId);
        if (p) protos = [p];
      } else if (trigger && farmId) {
        protos = await db.protocols
          .where('farmId').equals(farmId)
          .filter(p => p.triggerType === trigger)
          .toArray();
      }
      setProtocols(protos);
      // Init checked state — default all items unchecked
      const init: Record<string, Set<string>> = {};
      protos.forEach(p => { init[p.id] = new Set(); });
      setChecked(init);
    }
    load();
  }, [farmId, trigger, protocolId, animalId]);

  function toggleItem(protoId: string, itemId: string) {
    setChecked(prev => {
      const next = { ...prev, [protoId]: new Set(prev[protoId]) };
      if (next[protoId].has(itemId)) next[protoId].delete(itemId);
      else next[protoId].add(itemId);
      return next;
    });
  }

  function checkAll(protoId: string, proto: Protocol) {
    setChecked(prev => ({
      ...prev,
      [protoId]: new Set(proto.items.map(i => i.id)),
    }));
  }

  async function handleSave() {
    if (!farmId) return;
    setSaving(true);
    const now = new Date().toISOString();
    const today = format(new Date(), 'yyyy-MM-dd');

    await Promise.all(
      protocols.map(p =>
        db.protocolCompletions.add({
          id: crypto.randomUUID(),
          farmId,
          protocolId: p.id,
          animalId,
          date: today,
          completedItems: Array.from(checked[p.id] ?? []),
          notes: notes.trim() || undefined,
          createdAt: now,
        }),
      ),
    );

    setSaving(false);
    setDone(true);
    setTimeout(() => navigate(returnTo), 1200);
  }

  const animalLabel = animal
    ? `${animal.barnName || animal.name} (#${animal.number})`
    : animalId ? 'Animal' : '';

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        <p className="text-xl font-bold">Protocol{protocols.length > 1 ? 's' : ''} recorded!</p>
        <p className="text-muted-foreground">Returning…</p>
      </div>
    );
  }

  if (!protocols.length) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto pb-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(returnTo)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold">Protocols</h2>
        </div>
        <p className="text-muted-foreground px-1">No protocols found for this trigger.</p>
        <Button className="w-full h-12" onClick={() => navigate(returnTo)}>Continue</Button>
      </div>
    );
  }

  const totalItems = protocols.reduce((s, p) => s + p.items.length, 0);
  const totalChecked = protocols.reduce((s, p) => s + (checked[p.id]?.size ?? 0), 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(returnTo)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold leading-tight">
            {protocols.length === 1 ? protocols[0].name : 'Protocols'}
          </h2>
          {animalLabel && (
            <p className="text-sm text-muted-foreground">{animalLabel}</p>
          )}
        </div>
      </div>

      {/* Progress pill */}
      {totalItems > 0 && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(totalChecked / totalItems) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
            {totalChecked}/{totalItems}
          </span>
        </div>
      )}

      {protocols.map(proto => (
        <Card key={proto.id}>
          <CardContent className="p-4 space-y-3">
            {protocols.length > 1 && (
              <div className="flex items-center justify-between">
                <p className="font-bold text-base">{proto.name}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-primary"
                  onClick={() => checkAll(proto.id, proto)}
                >
                  Check all
                </Button>
              </div>
            )}
            {protocols.length === 1 && proto.items.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-primary"
                  onClick={() => checkAll(proto.id, proto)}
                >
                  Check all
                </Button>
              </div>
            )}

            {proto.items.length === 0 && (
              <p className="text-sm text-muted-foreground">No checklist items on this protocol.</p>
            )}

            <div className="space-y-1">
              {proto.items.map((item, idx) => {
                const isChecked = checked[proto.id]?.has(item.id) ?? false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      isChecked ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-secondary/40 hover:bg-secondary/70'
                    }`}
                    onClick={() => toggleItem(proto.id, item.id)}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleItem(proto.id, item.id)}
                      className="pointer-events-none shrink-0"
                    />
                    <span className={`text-sm font-medium flex-1 ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                      {idx + 1}. {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Notes */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="proto-notes">Notes (optional)</Label>
          <Textarea
            id="proto-notes"
            className="text-base min-h-[70px]"
            placeholder="Any observations or follow-up notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="h-14 flex-1" onClick={() => navigate(returnTo)}>
          Skip
        </Button>
        <Button
          className="h-14 flex-1 text-base font-bold gap-2"
          disabled={saving}
          onClick={handleSave}
        >
          <ClipboardCheck className="h-5 w-5" />
          {saving ? 'Saving…' : 'Record'}
        </Button>
      </div>
    </div>
  );
}
