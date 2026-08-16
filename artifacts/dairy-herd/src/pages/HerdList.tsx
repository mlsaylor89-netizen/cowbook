import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { getDIM, lactStat, reproStat } from '@/db/computed';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus, Trash2, CheckSquare, Square, X, ArrowDownAZ, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/useAuth';

type SortMode = 'name' | 'number';
function getSavedSort(): SortMode {
  return (localStorage.getItem('herdSort') as SortMode) ?? 'name';
}

/** Delete an animal and every related record. */
async function deleteAnimals(ids: string[]) {
  await db.transaction('rw',
    db.animals,
    db.breedings,
    db.calvings,
    db.treatments,
    db.pregnancyChecks,
    db.animalNotes,
    db.classifications,
    db.heats,
    db.syncEvents,
    async () => {
      await db.animals.bulkDelete(ids);
      for (const animalId of ids) {
        const breedingIds = (await db.breedings.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.breedings.bulkDelete(breedingIds);
        const calvingIds = (await db.calvings.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.calvings.bulkDelete(calvingIds);
        const treatmentIds = (await db.treatments.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.treatments.bulkDelete(treatmentIds);
        const pcIds = (await db.pregnancyChecks.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.pregnancyChecks.bulkDelete(pcIds);
        const noteIds = (await db.animalNotes.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.animalNotes.bulkDelete(noteIds);
        const classIds = (await db.classifications.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.classifications.bulkDelete(classIds);
        const heatIds = (await db.heats.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.heats.bulkDelete(heatIds);
        const seIds = (await db.syncEvents.where('animalId').equals(animalId).primaryKeys()) as string[];
        await db.syncEvents.bulkDelete(seIds);
      }
    }
  );
}

export function HerdList() {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>(getSavedSort);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { userDoc } = useAuth();
  const isViewer = userDoc?.role === 'viewer';

  function toggleSort() {
    const next: SortMode = sortMode === 'name' ? 'number' : 'name';
    setSortMode(next);
    localStorage.setItem('herdSort', next);
  }

  const animals = useLiveQuery(async () => {
    let all = await db.animals.toArray();
    if (search.trim()) {
      const s = search.toLowerCase();
      all = all.filter(a =>
        a.number.toLowerCase().includes(s) ||
        a.name.toLowerCase().includes(s) ||
        (a.barnName && a.barnName.toLowerCase().includes(s)) ||
        (a.rfidTag && a.rfidTag.toLowerCase().includes(s))
      );
    }
    return all;
  }, [search]);

  const sorted = animals
    ? [...animals].sort((a, b) =>
        sortMode === 'number'
          ? a.number.localeCompare(b.number, undefined, { numeric: true })
          : (a.barnName || a.name).localeCompare(b.barnName || b.name)
      )
    : undefined;

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmOpen(false);
  }

  function toggleAnimal(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!sorted) return;
    const allIds = sorted.map(a => a.id);
    const allSelected = allIds.every(id => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAnimals([...selected]);
      exitSelectMode();
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = !!sorted?.length && sorted.every(a => selected.has(a.id));

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Herd</h2>
        <div className="flex gap-2">
          {/* Sort toggle */}
          {!selectMode && (
            <Button size="sm" variant="outline" onClick={toggleSort} title={`Sorted by ${sortMode}. Click to sort by ${sortMode === 'name' ? 'number' : 'name'}`}>
              {sortMode === 'name'
                ? <><ArrowDownAZ className="h-4 w-4 mr-1.5" />Name</>
                : <><Hash className="h-4 w-4 mr-1.5" />Number</>}
            </Button>
          )}
          {!isViewer && !selectMode && (
            <Button size="sm" variant="outline" onClick={() => setSelectMode(true)}>
              <CheckSquare className="h-4 w-4 mr-1.5" /> Select
            </Button>
          )}
          {selectMode && (
            <Button size="sm" variant="ghost" onClick={exitSelectMode}>
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
          )}
          {!selectMode && !isViewer && (
            <Link href="/herd/new">
              <Button size="sm" className="hidden sm:flex">
                <Plus className="h-4 w-4 mr-2" /> Add Animal
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search number, name, or RFID..."
          className="pl-10 h-12 text-lg bg-card"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Select-all bar */}
      {selectMode && !!sorted?.length && (
        <div className="flex items-center justify-between px-1">
          <button
            className="flex items-center gap-2 text-sm font-medium text-foreground"
            onClick={toggleAll}
          >
            {allSelected
              ? <CheckSquare className="h-4 w-4 text-primary" />
              : <Square className="h-4 w-4 text-muted-foreground" />}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
        </div>
      )}

      {/* Animal list */}
      {sorted === undefined ? (
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
          No animals found.
        </div>
      ) : (
        <div className="space-y-2 pb-28">
          {sorted.map(animal => {
            const isSelected = selected.has(animal.id);

            if (selectMode) {
              return (
                <button
                  key={animal.id}
                  className="w-full text-left"
                  onClick={() => toggleAnimal(animal.id)}
                >
                  <Card className={`shadow-sm transition-colors ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 transition-colors overflow-hidden ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {isSelected
                            ? <CheckSquare className="h-6 w-6" />
                            : animal.photoUrl
                              ? <img src={animal.photoUrl} alt="" className="w-full h-full object-cover" />
                              : animal.number}
                        </div>
                        <div>
                          <p className="font-bold text-base leading-tight">
                            {animal.barnName || animal.name}
                          </p>
                          {animal.barnName && animal.barnName !== animal.name && (
                            <p className="text-xs text-muted-foreground leading-tight">{animal.name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <LactationBadge status={lactStat(animal)} />
                            <ReproBadge status={reproStat(animal)} />
                            {lactStat(animal) !== 'Heifer' && getDIM(animal) !== null && (
                              <span className="text-xs text-muted-foreground">{getDIM(animal)} DIM</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            }

            return (
              <Link key={animal.id} href={`/herd/${animal.id}`} className="block active-elevate hover-elevate">
                <Card className="shadow-sm">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                        {animal.photoUrl
                          ? <img src={animal.photoUrl} alt="" className="w-full h-full object-cover" />
                          : animal.number}
                      </div>
                      <div>
                        <p className="font-bold text-base leading-tight">
                          {animal.barnName || animal.name}
                        </p>
                        {animal.barnName && animal.barnName !== animal.name && (
                          <p className="text-xs text-muted-foreground leading-tight">{animal.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <LactationBadge status={lactStat(animal)} />
                          <ReproBadge status={reproStat(animal)} />
                          {lactStat(animal) !== 'Heifer' && getDIM(animal) !== null && (
                            <span className="text-xs text-muted-foreground">{getDIM(animal)} DIM</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Sticky delete bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="pointer-events-auto mx-4 w-full max-w-md">
            <Button
              variant="destructive"
              className="w-full h-14 text-base font-semibold shadow-xl"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Delete {selected.size} {selected.size === 1 ? 'Animal' : 'Animals'}
            </Button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-bold">
                Delete {selected.size} {selected.size === 1 ? 'Animal' : 'Animals'}?
              </h3>
              <p className="text-sm text-muted-foreground">
                This permanently removes the {selected.size === 1 ? 'animal' : 'animals'} and all
                associated records — breedings, treatments, notes, and more.
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Legacy badge — still used by AnimalDetail for old records without split fields */
export function StatusBadge({ status }: { status: string }) {
  let color = 'bg-gray-100 text-gray-800 border-gray-200';
  switch (status) {
    case 'Lactating': color = 'bg-green-100 text-green-800 border-green-200'; break;
    case 'Dry': color = 'bg-blue-100 text-blue-800 border-blue-200'; break;
    case 'Pregnant': color = 'bg-amber-100 text-amber-800 border-amber-200'; break;
    case 'Open': color = 'bg-red-100 text-red-800 border-red-200'; break;
    case 'Heifer': case 'BredHeifer': color = 'bg-purple-100 text-purple-800 border-purple-200'; break;
  }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {status}
    </span>
  );
}

export function LactationBadge({ status }: { status: string }) {
  const color =
    status === 'Milking' ? 'bg-green-100 text-green-800 border-green-200' :
    status === 'Dry'     ? 'bg-blue-100 text-blue-800 border-blue-200' :
                           'bg-purple-100 text-purple-800 border-purple-200';
  const label = status === 'Milking' ? 'Milking' : status;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

export function ReproBadge({ status }: { status: string }) {
  const color =
    status === 'Open'     ? 'bg-red-100 text-red-800 border-red-200' :
    status === 'Bred'     ? 'bg-amber-100 text-amber-800 border-amber-200' :
    status === 'Pregnant' ? 'bg-amber-200 text-amber-900 border-amber-300' :
    status === 'Fresh'    ? 'bg-sky-100 text-sky-800 border-sky-200' :
                            'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {status}
    </span>
  );
}
