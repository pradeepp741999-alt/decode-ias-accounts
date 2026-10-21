import { mockStore } from './mockStore';

export function getAuth(app) {
  return {
    app,
    get currentUser() {
      return mockStore.currentUser;
    }
  };
}

export function onAuthStateChanged(auth, cb) {
  return mockStore.subscribeAuth(cb);
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const norm = (email || '').trim().toLowerCase();
  const username = norm.includes('@') ? norm.split('@')[0] : norm;

  const users = mockStore.getCollection('users');
  const user = users.find(u => u.username === username || `${u.username}@decodeias.app` === norm);

  if (!user) {
    throw new Error('User not found. Check username.');
  }

  // Allow login if password matches or default ChangeMe@123
  if (user.password && user.password !== password && password !== 'ChangeMe@123') {
    throw new Error('Wrong password.');
  }

  if (!user.active) {
    throw new Error('Account disabled or not found.');
  }

  const currentUser = { uid: user.id || user.uid, email: `${user.username}@decodeias.app` };
  mockStore.setCurrentUser(currentUser);
  return { user: currentUser };
}

export async function signOut(auth) {
  mockStore.setCurrentUser(null);
  return Promise.resolve();
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  const norm = (email || '').trim().toLowerCase();
  const username = norm.includes('@') ? norm.split('@')[0] : norm;
  const uid = 'u_' + Date.now();
  return { user: { uid, email: `${username}@decodeias.app` } };
}
