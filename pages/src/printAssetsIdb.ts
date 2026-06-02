type PrintAssetRecord = {
  key: string;
  printBlob: Blob;
  createdAt: number;
};

const DB_NAME = 'print_assets_db';
const DB_VERSION = 1;
const STORE_NAME = 'print_assets';

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, DB_VERSION);

    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    openReq.onsuccess = () => resolve(openReq.result);
    openReq.onerror = () => reject(openReq.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await getDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    fn(store)
      .then((v) => resolve(v))
      .catch((e) => reject(e));

    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      // resolve handled above
    };
  });
}

export async function putPrintFile(assetKey: string, printBlob: Blob): Promise<void> {
  if (!assetKey) throw new Error('putPrintFile: missing assetKey');
  if (!printBlob) throw new Error('putPrintFile: missing printBlob');

  const record: PrintAssetRecord = {
    key: assetKey,
    printBlob,
    createdAt: Date.now(),
  };

  await withStore('readwrite', async (store) => {
    await new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return;
  });
}

export async function deletePrintAssets(keys: string | string[]): Promise<void> {
  const list = Array.isArray(keys) ? keys : [keys];
  const unique = Array.from(new Set(list.filter((k): k is string => Boolean(k))));

  if (unique.length === 0) return;

  await withStore('readwrite', async (store) => {
    await Promise.all(
      unique.map(
        (key) =>
          new Promise<void>((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
      )
    );
    return;
  });
}

export async function deleteManyPrintAssets(keys: string[]): Promise<void> {
  await deletePrintAssets(keys);
}
