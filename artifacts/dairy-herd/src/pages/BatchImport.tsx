import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Download, Upload, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db, type Animal, type SemenBull, type SemenPurchase, type Embryo, type EmbryoPurchase } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { useToast } from '@/hooks/use-toast';

// ─── CSV Utilities ─────────────────────────────────────────────────────────

/** Parse a CSV string into an array of objects keyed by header row. */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    // Handle quoted fields
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, (cols[i] ?? '').trim()]));
  });
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

// ─── Templates ─────────────────────────────────────────────────────────────

const ANIMAL_TEMPLATE = `name,barnName,number,breed,status,lactationNumber,birthDate,sire,dam,registrationNumber,rfidTag,notes
Meadowburne Daisy 4892-ET,Daisy,1001,Holstein,Lactating,3,2021-03-15,Star Bravo,Lady Blue,US123456,,Good producer
Sunny Hill Rosie 0042,Rosie,1002,Jersey,Heifer,0,2023-06-01,,,,ABC987,
`;

const SEMEN_TEMPLATE = `bullName,naabCode,breed,studCompany,units,purchaseDate,pricePerUnit,registrationNumber,notes
Goldwyn,7HO12345,Holstein,Select Sires,20,2024-01-10,18.50,HOUSA123,High type
Altitude,29HO18888,Holstein,ST Genetics,15,2024-02-05,22.00,,
`;

const EMBRYO_TEMPLATE = `donorName,sireName,sireNaabCode,breed,studCompany,units,purchaseDate,pricePerUnit,notes
Royal Lady,Goldwyn,7HO12345,Holstein,Trans Ova,5,2024-03-01,250.00,Grade 1
Prairie Rose,,,Jersey,,3,2024-03-15,200.00,
`;

// ─── Validation helpers ─────────────────────────────────────────────────────

const VALID_STATUSES = ['Lactating','Dry','Heifer','BredHeifer','Pregnant','Open','Sold','Dead'];

interface RowResult { row: number; status: 'ok' | 'skip' | 'error'; message: string; name: string; }

// ─── Animal Import ──────────────────────────────────────────────────────────

async function importAnimals(
  rows: Record<string, string>[],
  farmId: string,
): Promise<RowResult[]> {
  const existing = await db.animals.where('farmId').equals(farmId).toArray();
  const existingNumbers = new Set(existing.map(a => a.number?.toLowerCase()));
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const name = r.name || r['animal name'] || '';
    const number = r.number || r['tag'] || r['ear tag'] || '';

    if (!name) { results.push({ row: rowNum, status: 'error', message: 'Missing name', name: number || `Row ${rowNum}` }); continue; }
    if (!number) { results.push({ row: rowNum, status: 'error', message: 'Missing number/tag', name }); continue; }
    if (!r.breed) { results.push({ row: rowNum, status: 'error', message: 'Missing breed', name }); continue; }

    if (existingNumbers.has(number.toLowerCase())) {
      results.push({ row: rowNum, status: 'skip', message: `Tag ${number} already exists`, name }); continue;
    }

    const statusRaw = r.status || 'Open';
    const status = VALID_STATUSES.find(s => s.toLowerCase() === statusRaw.toLowerCase()) ?? 'Open';
    const lactNum = parseInt(r.lactationnumber || r['lactation number'] || r.lactation || '0', 10);

    const barnName = r.barnname || r['barn name'] || r['barn'] || undefined;

    const animal: Animal = {
      id: uid(),
      farmId,
      name,
      barnName: barnName || undefined,
      number,
      breed: r.breed,
      status: status as Animal['status'],
      lactationNumber: isNaN(lactNum) ? 0 : lactNum,
      birthDate: r.birthdate || r['birth date'] || r.dob || undefined,
      sire: r.sire || undefined,
      dam: r.dam || undefined,
      registrationNumber: r.registrationnumber || r['registration number'] || r.reg || undefined,
      rfidTag: r.rfidtag || r['rfid tag'] || r.rfid || undefined,
      notes: r.notes || undefined,
      createdAt: now(),
      updatedAt: now(),
    };

    await db.animals.put(animal);
    results.push({ row: rowNum, status: 'ok', message: 'Imported', name });
  }

  return results;
}

// ─── Semen Import ───────────────────────────────────────────────────────────

async function importSemen(rows: Record<string, string>[]): Promise<RowResult[]> {
  const results: RowResult[] = [];
  const existing = await db.semenBulls.toArray();
  const existingBulls = new Map(existing.map(b => [b.naabCode?.toLowerCase() ?? '', b.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const bullName = r.bullname || r['bull name'] || r.name || '';
    const naabCode = r.naabcode || r['naab code'] || r.naab || '';

    if (!bullName) { results.push({ row: rowNum, status: 'error', message: 'Missing bull name', name: naabCode || `Row ${rowNum}` }); continue; }
    if (!r.breed)  { results.push({ row: rowNum, status: 'error', message: 'Missing breed', name: bullName }); continue; }

    const unitsRaw = parseInt(r.units || '0', 10);
    if (!unitsRaw || unitsRaw <= 0) { results.push({ row: rowNum, status: 'error', message: 'Units must be > 0', name: bullName }); continue; }

    const purchaseDate = r.purchasedate || r['purchase date'] || r.date || new Date().toISOString().slice(0, 10);

    // Re-use existing bull if same NAAB code, else create new
    let bullId = naabCode ? (existingBulls.get(naabCode.toLowerCase()) ?? null) : null;
    if (!bullId) {
      const bull: SemenBull = {
        id: uid(),
        name: bullName,
        naabCode: naabCode || undefined,
        registrationNumber: r.registrationnumber || r['registration number'] || undefined,
        breed: r.breed,
        studCompany: r.studcompany || r['stud company'] || undefined,
        notes: r.notes || undefined,
        createdAt: now(),
        updatedAt: now(),
      };
      await db.semenBulls.put(bull);
      if (naabCode) existingBulls.set(naabCode.toLowerCase(), bull.id);
      bullId = bull.id;
    }

    const priceRaw = parseFloat(r.priceperunit || r['price per unit'] || r.price || '0');
    const purchase: SemenPurchase = {
      id: uid(),
      bullId,
      purchaseDate,
      unitsCount: unitsRaw,
      pricePerUnit: isNaN(priceRaw) ? 0 : priceRaw,
      totalCost: isNaN(priceRaw) ? 0 : priceRaw * unitsRaw,
      notes: r.notes || undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.semenPurchases.put(purchase);
    results.push({ row: rowNum, status: 'ok', message: `${unitsRaw} units added`, name: bullName });
  }

  return results;
}

// ─── Embryo Import ──────────────────────────────────────────────────────────

async function importEmbryos(rows: Record<string, string>[]): Promise<RowResult[]> {
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const donorName = r.donorname || r['donor name'] || r.donor || '';

    if (!donorName) { results.push({ row: rowNum, status: 'error', message: 'Missing donor name', name: `Row ${rowNum}` }); continue; }
    if (!r.breed)   { results.push({ row: rowNum, status: 'error', message: 'Missing breed', name: donorName }); continue; }

    const unitsRaw = parseInt(r.units || '0', 10);
    if (!unitsRaw || unitsRaw <= 0) { results.push({ row: rowNum, status: 'error', message: 'Units must be > 0', name: donorName }); continue; }

    const purchaseDate = r.purchasedate || r['purchase date'] || r.date || new Date().toISOString().slice(0, 10);

    const embryo: Embryo = {
      id: uid(),
      donorName,
      sireName: r.sirename || r['sire name'] || r.sire || undefined,
      sireNaabCode: r.sirenaabcode || r['sire naab code'] || r.sirenaab || undefined,
      breed: r.breed,
      studCompany: r.studcompany || r['stud company'] || undefined,
      notes: r.notes || undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.embryos.put(embryo);

    const priceRaw = parseFloat(r.priceperunit || r['price per unit'] || r.price || '0');
    const purchase: EmbryoPurchase = {
      id: uid(),
      embryoId: embryo.id,
      purchaseDate,
      unitsCount: unitsRaw,
      pricePerUnit: isNaN(priceRaw) ? 0 : priceRaw,
      totalCost: isNaN(priceRaw) ? 0 : priceRaw * unitsRaw,
      notes: r.notes || undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.embryoPurchases.put(purchase);
    results.push({ row: rowNum, status: 'ok', message: `${unitsRaw} embryos added`, name: donorName });
  }

  return results;
}

// ─── Shared Import Panel ────────────────────────────────────────────────────

type ImportType = 'animals' | 'semen' | 'embryos';

interface ImportPanelProps {
  type: ImportType;
  template: string;
  templateFilename: string;
  description: string;
  onImport: (rows: Record<string, string>[]) => Promise<RowResult[]>;
}

function ImportPanel({ type, template, templateFilename, description, onImport }: ImportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setResults(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string ?? '');
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!rows.length) return;
    setLoading(true);
    try {
      const res = await onImport(rows);
      setResults(res);
      const ok = res.filter(r => r.status === 'ok').length;
      const skipped = res.filter(r => r.status === 'skip').length;
      const errors = res.filter(r => r.status === 'error').length;
      toast({
        title: `Import complete`,
        description: `${ok} imported${skipped ? `, ${skipped} skipped` : ''}${errors ? `, ${errors} errors` : ''}`,
      });
    } catch (err) {
      toast({ title: 'Import failed', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setRows([]);
    setResults(null);
    setFilename('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const ok = results?.filter(r => r.status === 'ok').length ?? 0;
  const skipped = results?.filter(r => r.status === 'skip').length ?? 0;
  const errors = results?.filter(r => r.status === 'error').length ?? 0;

  return (
    <div className="space-y-4">
      {/* Step 1 — Download template */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step 1 — Download template</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={() => downloadCSV(templateFilename, template)}
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </Button>
        </CardContent>
      </Card>

      {/* Step 2 — Upload */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step 2 — Upload your file</p>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-muted-foreground">
              {filename ? filename : 'Click to choose a CSV file'}
            </span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
          {rows.length > 0 && !results && (
            <p className="text-sm text-center text-muted-foreground">{rows.length} row{rows.length !== 1 ? 's' : ''} ready to import</p>
          )}
        </CardContent>
      </Card>

      {/* Step 3 — Import */}
      {rows.length > 0 && !results && (
        <Button className="w-full h-12 font-bold gap-2" onClick={handleImport} disabled={loading}>
          <Upload className="h-4 w-4" />
          {loading ? 'Importing…' : `Import ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
        </Button>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-4 text-sm">
              {ok > 0 && <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 className="h-4 w-4" />{ok} imported</span>}
              {skipped > 0 && <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertCircle className="h-4 w-4" />{skipped} skipped</span>}
              {errors > 0 && <span className="flex items-center gap-1 text-destructive font-bold"><XCircle className="h-4 w-4" />{errors} errors</span>}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${
                  r.status === 'ok' ? 'bg-green-50 text-green-800' :
                  r.status === 'skip' ? 'bg-amber-50 text-amber-800' :
                  'bg-red-50 text-red-800'
                }`}>
                  {r.status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  {r.status === 'skip' && <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  {r.status === 'error' && <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  <span><span className="font-bold">{r.name}</span> — {r.message}</span>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={reset}>
              Import another file
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function BatchImport() {
  const { farmId } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/more">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold">Batch Import</h2>
          <p className="text-sm text-muted-foreground">Load your herd, semen, and embryo inventory from CSV files</p>
        </div>
      </div>

      <Tabs defaultValue="animals">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="animals">🐄 Animals</TabsTrigger>
          <TabsTrigger value="semen">🧬 Semen</TabsTrigger>
          <TabsTrigger value="embryos">🔬 Embryos</TabsTrigger>
        </TabsList>

        <TabsContent value="animals" className="mt-4">
          <ImportPanel
            type="animals"
            template={ANIMAL_TEMPLATE}
            templateFilename="herdtrack-animals-template.csv"
            description="One row per cow or heifer. Required columns: name, number, breed, status, lactationNumber. Status options: Lactating, Dry, Heifer, BredHeifer, Pregnant, Open, Sold, Dead."
            onImport={rows => importAnimals(rows, farmId!)}
          />
        </TabsContent>

        <TabsContent value="semen" className="mt-4">
          <ImportPanel
            type="semen"
            template={SEMEN_TEMPLATE}
            templateFilename="herdtrack-semen-template.csv"
            description="One row per bull entry. Required columns: bullName, breed, units, purchaseDate. Bulls with the same NAAB code are merged into one inventory entry."
            onImport={importSemen}
          />
        </TabsContent>

        <TabsContent value="embryos" className="mt-4">
          <ImportPanel
            type="embryos"
            template={EMBRYO_TEMPLATE}
            templateFilename="herdtrack-embryos-template.csv"
            description="One row per donor group. Required columns: donorName, breed, units, purchaseDate."
            onImport={importEmbryos}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
