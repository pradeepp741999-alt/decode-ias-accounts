const STORAGE_KEY = 'decode_ias_mock_db_v1';
const CURRENT_USER_KEY = 'decode_ias_mock_user';

const INITIAL_DATA = {
  users: {
    'u_admin': { id: 'u_admin', uid: 'u_admin', name: 'Super Admin', username: 'admin', role: 'super_admin', active: true, password: 'ChangeMe@123' },
    'u_fees': { id: 'u_fees', uid: 'u_fees', name: 'Kavitha R', username: 'fees', role: 'fees', active: true, password: 'ChangeMe@123' },
    'u_reports': { id: 'u_reports', uid: 'u_reports', name: 'Suresh Babu', username: 'reports', role: 'reports', active: true, password: 'ChangeMe@123' },
    'u_both': { id: 'u_both', uid: 'u_both', name: 'Divya M', username: 'both', role: 'both', active: true, password: 'ChangeMe@123' },
  },
  courses: {
    'c_1': { id: 'c_1', name: 'UPSC Prelims + Mains', fee: 80000, active: true },
    'c_2': { id: 'c_2', name: 'TNPSC Group 1', fee: 25000, active: true },
    'c_3': { id: 'c_3', name: 'TNPSC Group 4', fee: 8000, active: true },
    'c_4': { id: 'c_4', name: 'UPSC CSAT Special', fee: 15000, active: true },
  },
  students: {
    's_1': {
      id: 's_1', date: '2026-09-01', name: 'Ramesh Kumar', fatherName: 'P. Kumar', mobile: '9876543210',
      courseId: 'c_1', courseName: 'UPSC Prelims + Mains', courseFee: 80000, discountPct: 0, netFee: 80000,
      totalPaid: 50000, balance: 30000, nextDueDate: '2026-10-21', remarks: 'First installment paid',
      createdBy: 'Kavitha R', createdAt: '2026-09-01T10:00:00.000Z'
    },
    's_2': {
      id: 's_2', date: '2026-08-15', name: 'Priya Dharshini', fatherName: 'M. Sundaram', mobile: '9840123456',
      courseId: 'c_2', courseName: 'TNPSC Group 1', courseFee: 25000, discountPct: 10, netFee: 22500,
      totalPaid: 22500, balance: 0, nextDueDate: '', remarks: 'Early bird 10% discount. Fees fully settled',
      createdBy: 'Super Admin', createdAt: '2026-08-15T11:30:00.000Z'
    },
    's_3': {
      id: 's_3', date: '2026-09-10', name: 'Karthik Raja', fatherName: 'V. Raja', mobile: '9790887766',
      courseId: 'c_1', courseName: 'UPSC Prelims + Mains', courseFee: 80000, discountPct: 10, netFee: 72000,
      totalPaid: 30000, balance: 42000, nextDueDate: '2026-10-15', remarks: 'Merit scholarship discount',
      createdBy: 'Kavitha R', createdAt: '2026-09-10T14:15:00.000Z'
    },
    's_4': {
      id: 's_4', date: '2026-10-05', name: 'Ananya S', fatherName: 'K. Selvam', mobile: '9444112233',
      courseId: 'c_3', courseName: 'TNPSC Group 4', courseFee: 8000, discountPct: 0, netFee: 8000,
      totalPaid: 4000, balance: 4000, nextDueDate: '2026-10-21', remarks: 'Part payment',
      createdBy: 'Kavitha R', createdAt: '2026-10-05T09:45:00.000Z'
    },
    's_5': {
      id: 's_5', date: '2026-10-18', name: 'Vignesh S', fatherName: 'S. Srinivasan', mobile: '9940556677',
      courseId: 'c_4', courseName: 'UPSC CSAT Special', courseFee: 15000, discountPct: 0, netFee: 15000,
      totalPaid: 15000, balance: 0, nextDueDate: '', remarks: 'Online full fee',
      createdBy: 'Super Admin', createdAt: '2026-10-18T16:00:00.000Z'
    }
  },
  payments: {
    'p_1': { id: 'p_1', studentId: 's_1', studentName: 'Ramesh Kumar', courseId: 'c_1', courseName: 'UPSC Prelims + Mains', date: '2026-09-01', amount: 50000, mode: 'online', transId: 'UPI20260901789', nextDueDate: '2026-10-21', remarks: 'First installment', createdBy: 'Kavitha R', createdAt: '2026-09-01T10:00:00.000Z' },
    'p_2': { id: 'p_2', studentId: 's_2', studentName: 'Priya Dharshini', courseId: 'c_2', courseName: 'TNPSC Group 1', date: '2026-08-15', amount: 12500, mode: 'online', transId: 'NEFT8899120', nextDueDate: '2026-09-15', remarks: 'Part payment', createdBy: 'Super Admin', createdAt: '2026-08-15T11:30:00.000Z' },
    'p_3': { id: 'p_3', studentId: 's_2', studentName: 'Priya Dharshini', courseId: 'c_2', courseName: 'TNPSC Group 1', date: '2026-09-14', amount: 10000, mode: 'cash', transId: '', nextDueDate: '', remarks: 'Final balance settlement in cash', createdBy: 'Kavitha R', createdAt: '2026-09-14T15:20:00.000Z' },
    'p_4': { id: 'p_4', studentId: 's_3', studentName: 'Karthik Raja', courseId: 'c_1', courseName: 'UPSC Prelims + Mains', date: '2026-09-10', amount: 30000, mode: 'online', transId: 'HDFC9843210', nextDueDate: '2026-10-15', remarks: 'Admission token fee', createdBy: 'Kavitha R', createdAt: '2026-09-10T14:15:00.000Z' },
    'p_5': { id: 'p_5', studentId: 's_4', studentName: 'Ananya S', courseId: 'c_3', courseName: 'TNPSC Group 4', date: '2026-10-05', amount: 4000, mode: 'cash', transId: '', nextDueDate: '2026-10-21', remarks: 'First half cash', createdBy: 'Kavitha R', createdAt: '2026-10-05T09:45:00.000Z' },
    'p_6': { id: 'p_6', studentId: 's_5', studentName: 'Vignesh S', courseId: 'c_4', courseName: 'UPSC CSAT Special', date: '2026-10-18', amount: 15000, mode: 'online', transId: 'GPAY998811', nextDueDate: '', remarks: 'Full fees payment', createdBy: 'Super Admin', createdAt: '2026-10-18T16:00:00.000Z' }
  }
};

function loadStore() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load mock data from localStorage:', err);
  }
  return JSON.parse(JSON.stringify(INITIAL_DATA));
}

function saveStore(data) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (err) {
    console.warn('Failed to save mock data to localStorage:', err);
  }
}

class MockStore {
  constructor() {
    this.data = loadStore();
    this.authListeners = new Set();
    this.currentUser = this.loadCurrentUser();
  }

  loadCurrentUser() {
    try {
      const savedUid = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_USER_KEY) : null;
      if (savedUid && this.data.users[savedUid]) {
        return { uid: savedUid, email: `${this.data.users[savedUid].username}@decodeias.app` };
      }
    } catch (_) {}
    return null;
  }

  setCurrentUser(user) {
    this.currentUser = user;
    try {
      if (typeof window !== 'undefined') {
        if (user) {
          window.localStorage.setItem(CURRENT_USER_KEY, user.uid);
        } else {
          window.localStorage.removeItem(CURRENT_USER_KEY);
        }
      }
    } catch (_) {}
    for (const listener of this.authListeners) {
      try { listener(this.currentUser); } catch (e) { console.error(e); }
    }
  }

  subscribeAuth(cb) {
    this.authListeners.add(cb);
    setTimeout(() => cb(this.currentUser), 0);
    return () => this.authListeners.delete(cb);
  }

  getCollection(colName) {
    const col = this.data[colName] || {};
    return Object.values(col);
  }

  getDoc(colName, id) {
    const col = this.data[colName] || {};
    return col[id] || null;
  }

  setDoc(colName, id, item) {
    if (!this.data[colName]) this.data[colName] = {};
    this.data[colName][id] = { id, ...item };
    saveStore(this.data);
    return Promise.resolve();
  }

  updateDoc(colName, id, partial) {
    if (!this.data[colName] || !this.data[colName][id]) {
      return Promise.reject(new Error(`Document ${colName}/${id} not found.`));
    }
    this.data[colName][id] = { ...this.data[colName][id], ...partial };
    saveStore(this.data);
    return Promise.resolve();
  }

  addDoc(colName, item) {
    if (!this.data[colName]) this.data[colName] = {};
    const id = colName.charAt(0) + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    this.data[colName][id] = { id, ...item };
    saveStore(this.data);
    return Promise.resolve({ id });
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    saveStore(this.data);
  }
}

export const mockStore = new MockStore();
