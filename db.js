const DB = (() => {
  const DB_NAME = 'ManutExtDB';
  const DB_VERSION = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('clientes')) {
          const cs = d.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
          cs.createIndex('nome', 'nome', { unique: false });
        }
        if (!d.objectStoreNames.contains('servicos')) {
          const ss = d.createObjectStore('servicos', { keyPath: 'id', autoIncrement: true });
          ss.createIndex('clienteId', 'clienteId', { unique: false });
          ss.createIndex('data', 'data', { unique: false });
          ss.createIndex('status', 'status', { unique: false });
        }
        if (!d.objectStoreNames.contains('extintores')) {
          const es = d.createObjectStore('extintores', { keyPath: 'id', autoIncrement: true });
          es.createIndex('servicoId', 'servicoId', { unique: false });
          es.createIndex('estado', 'estado', { unique: false });
          es.createIndex('marca', 'marca', { unique: false });
        }
        if (!d.objectStoreNames.contains('config')) {
          d.createObjectStore('config', { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  function tx(store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  function add(store, data) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx(store, 'readwrite').add(data);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }

  function put(store, data) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx(store, 'readwrite').put(data);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }

  function get(store, id) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx(store, 'readonly').get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }

  function getAll(store) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx(store, 'readonly').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }

  function getAllByIndex(store, indexName, value) {
    return open().then(d => new Promise((res, rej) => {
      const s = tx(store, 'readonly');
      const idx = s.index(indexName);
      const r = idx.getAll(value);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }

  function del(store, id) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx(store, 'readwrite').delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    }));
  }

  function clear(store) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx(store, 'readwrite').clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    }));
  }

  function getConfig(key) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx('config', 'readonly').get(key);
      r.onsuccess = () => res(r.result ? r.result.value : null);
      r.onerror = () => rej(r.error);
    }));
  }

  function setConfig(key, value) {
    return open().then(d => new Promise((res, rej) => {
      const r = tx('config', 'readwrite').put({ key, value });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    }));
  }

  async function exportAll() {
    await open();
    const [clientes, servicos, extintores, config] = await Promise.all([
      getAll('clientes'), getAll('servicos'), getAll('extintores'), getAll('config')
    ]);
    return { clientes, servicos, extintores, config, version: DB_VERSION, exportDate: new Date().toISOString() };
  }

  async function importAll(data) {
    await open();
    const stores = ['clientes', 'servicos', 'extintores', 'config'];
    for (const s of stores) {
      if (data[s] && Array.isArray(data[s])) {
        await clear(s);
        for (const item of data[s]) {
          await put(s, item);
        }
      }
    }
  }

  async function clearAll() {
    await open();
    for (const s of ['clientes', 'servicos', 'extintores', 'config']) {
      await clear(s);
    }
  }

  return {
    open, add, put, get, getAll, getAllByIndex, del, clear,
    getConfig, setConfig, exportAll, importAll, clearAll
  };
})();
