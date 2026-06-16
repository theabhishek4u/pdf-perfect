// Local browser-based PDF storage using IndexedDB. No auth, no server.

export type PdfRecord = {
  id: string;
  name: string;
  size_bytes: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

type PdfRow = PdfRecord & { data: Blob };

const DB_NAME = "pdf-editify";
const STORE = "pdfs";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const s = t.objectStore(STORE);
        const req = fn(s);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function listPdfs(): Promise<PdfRecord[]> {
  const all = await tx<PdfRow[]>("readonly", (s) => s.getAll() as IDBRequest<PdfRow[]>);
  return all
    .map(({ data: _d, ...rest }) => rest)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getPdf(id: string): Promise<{ record: PdfRecord; bytes: Uint8Array } | null> {
  const row = await tx<PdfRow | undefined>("readonly", (s) => s.get(id) as IDBRequest<PdfRow | undefined>);
  if (!row) return null;
  const { data, ...record } = row;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { record, bytes };
}

export async function addPdf(file: File): Promise<PdfRecord> {
  const now = new Date().toISOString();
  const record: PdfRecord = {
    id: crypto.randomUUID(),
    name: file.name,
    size_bytes: file.size,
    is_favorite: false,
    created_at: now,
    updated_at: now,
  };
  const row: PdfRow = { ...record, data: file };
  await tx("readwrite", (s) => s.put(row));
  return record;
}

export async function updatePdf(id: string, patch: Partial<PdfRecord> & { bytes?: Uint8Array }) {
  const row = await tx<PdfRow | undefined>("readonly", (s) => s.get(id) as IDBRequest<PdfRow | undefined>);
  if (!row) return;
  const { bytes, ...rest } = patch;
  const next: PdfRow = {
    ...row,
    ...rest,
    updated_at: new Date().toISOString(),
  };
  if (bytes) {
    next.data = new Blob([bytes as BlobPart], { type: "application/pdf" });
    next.size_bytes = bytes.byteLength;
  }
  await tx("readwrite", (s) => s.put(next));
}

export async function deletePdf(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}
