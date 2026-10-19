// Everything is stored on this phone in IndexedDB. Nothing is uploaded.
const DB_NAME = "snore-tracker";
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("nights", { keyPath: "id" });
        db.createObjectStore("clips", { keyPath: "id" }).createIndex("nightId", "nightId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function done(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = "readonly") {
  return (await open()).transaction(name, mode).objectStore(name);
}

export async function putNight(night) {
  return done((await store("nights", "readwrite")).put(night));
}

export async function getNight(id) {
  return done((await store("nights")).get(id));
}

// Newest first.
export async function allNights() {
  const nights = await done((await store("nights")).getAll());
  return nights.sort((a, b) => b.start - a.start);
}

export async function deleteNight(id) {
  const db = await open();
  const tx = db.transaction(["nights", "clips"], "readwrite");
  tx.objectStore("nights").delete(id);
  const keys = await done(tx.objectStore("clips").index("nightId").getAllKeys(id));
  keys.forEach((k) => tx.objectStore("clips").delete(k));
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function putClip(clip) {
  return done((await store("clips", "readwrite")).put(clip));
}

export async function deleteClip(id) {
  return done((await store("clips", "readwrite")).delete(id));
}

// Oldest first.
export async function clipsForNight(nightId) {
  const clips = await done((await store("clips")).index("nightId").getAll(nightId));
  return clips.sort((a, b) => a.time - b.time);
}

// Deletes the audio of nights that started before `beforeMs`. Their statistics stay.
export async function pruneClips(beforeMs) {
  const nights = await allNights();
  for (const n of nights) {
    if (n.start >= beforeMs || n.status === "recording") continue;
    for (const c of await clipsForNight(n.id)) await deleteClip(c.id);
  }
}

export async function clearAll() {
  const db = await open();
  const tx = db.transaction(["nights", "clips"], "readwrite");
  tx.objectStore("nights").clear();
  tx.objectStore("clips").clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
