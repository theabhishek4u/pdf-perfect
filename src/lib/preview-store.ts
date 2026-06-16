// Ephemeral in-memory store for "Apply & Preview" output bytes.
// Survives client-side navigation but not full page reload.
const store = new Map<string, { bytes: Uint8Array; name: string }>();

export function setPreview(id: string, bytes: Uint8Array, name: string) {
  store.set(id, { bytes, name });
}

export function getPreview(id: string) {
  return store.get(id) ?? null;
}

export function clearPreview(id: string) {
  store.delete(id);
}
