import { mockStore } from './mockStore';

export function getFirestore(app) {
  return { app, type: 'mock-firestore' };
}

function genId(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function collection(db, path) {
  return { type: 'collection', path };
}

export function doc(first, ...rest) {
  if (first && first.type === 'collection') {
    const id = rest[0] || genId(first.path.charAt(0));
    return { type: 'doc', col: first.path, id };
  }
  // format: doc(db, 'users', uid)
  const col = rest[0];
  const id = rest[1] || genId(col ? col.charAt(0) : 'd');
  return { type: 'doc', col, id };
}

export async function getDoc(docRef) {
  const item = mockStore.getDoc(docRef.col, docRef.id);
  return {
    id: docRef.id,
    exists: () => item !== null && item !== undefined,
    data: () => (item ? { ...item } : undefined)
  };
}

export async function getDocs(target) {
  let items = [];
  if (target.type === 'collection') {
    items = mockStore.getCollection(target.path);
  } else if (target.type === 'query') {
    items = mockStore.getCollection(target.col);
    if (target.conditions && target.conditions.length) {
      for (const cond of target.conditions) {
        if (cond.op === '==') {
          items = items.filter(x => x[cond.field] === cond.value);
        } else if (cond.op === '>') {
          items = items.filter(x => x[cond.field] > cond.value);
        } else if (cond.op === '<') {
          items = items.filter(x => x[cond.field] < cond.value);
        } else if (cond.op === '>=') {
          items = items.filter(x => x[cond.field] >= cond.value);
        } else if (cond.op === '<=') {
          items = items.filter(x => x[cond.field] <= cond.value);
        }
      }
    }
  }

  const docs = items.map(item => ({
    id: item.id,
    exists: () => true,
    data: () => ({ ...item })
  }));

  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: cb => docs.forEach(cb)
  };
}

export async function setDoc(docRef, data) {
  return mockStore.setDoc(docRef.col, docRef.id, data);
}

export async function addDoc(colRef, data) {
  return mockStore.addDoc(colRef.path, data);
}

export async function updateDoc(docRef, partial) {
  return mockStore.updateDoc(docRef.col, docRef.id, partial);
}

export function writeBatch(db) {
  const operations = [];
  return {
    set(docRef, data) {
      operations.push({ op: 'set', ref: docRef, data });
    },
    update(docRef, data) {
      operations.push({ op: 'update', ref: docRef, data });
    },
    async commit() {
      for (const op of operations) {
        if (op.op === 'set') {
          await mockStore.setDoc(op.ref.col, op.ref.id, op.data);
        } else if (op.op === 'update') {
          await mockStore.updateDoc(op.ref.col, op.ref.id, op.data);
        }
      }
    }
  };
}

export function query(colRef, ...conditions) {
  return {
    type: 'query',
    col: colRef.path,
    conditions: conditions.filter(Boolean)
  };
}

export function where(field, op, value) {
  return { field, op, value };
}

export function serverTimestamp() {
  return new Date().toISOString();
}
