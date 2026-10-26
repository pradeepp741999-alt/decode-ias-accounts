const STORAGE_KEY = 'decode_ias_mock_db_v3';
const CURRENT_USER_KEY = 'decode_ias_mock_user';

const INITIAL_DATA = {
  users: {
    'u_admin': { id: 'u_admin', uid: 'u_admin', name: 'Super Admin', username: 'admin', role: 'super_admin', active: true, password: 'ChangeMe@123' },
    'u_fees': { id: 'u_fees', uid: 'u_fees', name: 'Kavitha R', username: 'fees', role: 'fees', active: true, password: 'ChangeMe@123' },
    'u_reports': { id: 'u_reports', uid: 'u_reports', name: 'Suresh Babu', username: 'reports', role: 'reports', active: true, password: 'ChangeMe@123' },
    'u_expense': { id: 'u_expense', uid: 'u_expense', name: 'Anand Kumar (Accounts)', username: 'expense', role: 'expense', active: true, password: 'ChangeMe@123' },
    'u_both': { id: 'u_both', uid: 'u_both', name: 'Divya M', username: 'both', role: 'both', active: true, password: 'ChangeMe@123' },
    'u_petty': { id: 'u_petty', uid: 'u_petty', name: 'Raju (Office Staff)', username: 'petty', role: 'petty_cash', active: true, password: 'ChangeMe@123' },
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
  },
  expenseItems: {
    'ei_1': { id: 'ei_1', name: 'EB Bill (Electricity)', active: true },
    'ei_2': { id: 'ei_2', name: 'Room Rent (Premises)', active: true },
    'ei_3': { id: 'ei_3', name: 'Water Can / Water Bill', active: true },
    'ei_4': { id: 'ei_4', name: 'Tea & Refreshments', active: true },
    'ei_5': { id: 'ei_5', name: 'Office Stationery & Printing', active: true },
    'ei_6': { id: 'ei_6', name: 'Internet & Telephone', active: true },
    'ei_7': { id: 'ei_7', name: 'Repairs & Maintenance', active: true },
    'ei_8': { id: 'ei_8', name: 'Courier & Postal', active: true },
    'ei_9': { id: 'ei_9', name: 'Car Petrol / Fuel (Office Vehicle)', active: true },
    'ei_10': { id: 'ei_10', name: 'Classroom Cleaning & Maintenance', active: true },
  },
  pettyCashCycles: {
    'pcc_1': {
      id: 'pcc_1',
      cycleNumber: 1,
      startDate: '2026-10-01',
      endDate: '2026-10-26',
      imprestAmount: 20000,
      custodianName: 'Raju (Office Staff)',
      givenBy: 'Super Admin',
      mode: 'cash',
      totalSpent: 18500,
      returnedAmount: 1500,
      returnedDate: '2026-10-26',
      returnedTo: 'Super Admin',
      status: 'closed',
      closingRemarks: 'Returned remaining balance ₹1,500. Settled before fresh ₹20k float for car petrol & travel.',
      createdAt: '2026-10-01T09:00:00.000Z',
      closedAt: '2026-10-26T10:30:00.000Z'
    },
    'pcc_2': {
      id: 'pcc_2',
      cycleNumber: 2,
      startDate: '2026-10-26',
      endDate: '',
      imprestAmount: 20000,
      custodianName: 'Raju (Office Staff)',
      givenBy: 'Super Admin',
      mode: 'cash',
      totalSpent: 4000,
      returnedAmount: 0,
      returnedDate: '',
      returnedTo: '',
      status: 'active',
      closingRemarks: '',
      createdAt: '2026-10-26T10:35:00.000Z'
    }
  },
  pettyCashReturns: {
    'pcr_1': {
      id: 'pcr_1',
      cycleId: 'pcc_1',
      cycleNumber: 1,
      date: '2026-10-26',
      amount: 1500,
      returnedBy: 'Raju (Office Staff)',
      receivedBy: 'Super Admin',
      remarks: 'Returned remaining balance of ₹1,500 to Admin before fresh ₹20,000 float issuance',
      createdAt: '2026-10-26T10:30:00.000Z'
    }
  },
  pettyCashDisbursements: {
    'pc_1': { id: 'pc_1', cycleId: 'pcc_1', cycleNumber: 1, date: '2026-10-01', amount: 20000, givenTo: 'Raju (Office Staff)', givenBy: 'Super Admin', mode: 'cash', remarks: 'Monthly Imprest float of ₹20,000 given to Office Boy', createdAt: '2026-10-01T09:00:00.000Z' },
    'pc_2': { id: 'pc_2', cycleId: 'pcc_2', cycleNumber: 2, date: '2026-10-26', amount: 20000, givenTo: 'Raju (Office Staff)', givenBy: 'Super Admin', mode: 'cash', remarks: 'Re-issued fresh Imprest float of ₹20,000 for next cycle', createdAt: '2026-10-26T10:35:00.000Z' },
  },
  expenses: {
    'ex_1': { id: 'ex_1', itemId: 'ei_2', itemName: 'Room Rent (Premises)', date: '2026-10-02', amount: 25000, mode: 'online', isPettyCash: false, paidTo: 'Property Owner (Building)', attachmentName: 'rent_agreement_oct.pdf', remarks: 'October 2026 Academy premises rent', createdBy: 'Super Admin', createdAt: '2026-10-02T11:00:00.000Z' },
    'ex_2': { id: 'ex_2', itemId: 'ei_1', itemName: 'EB Bill (Electricity)', date: '2026-10-08', amount: 4850, mode: 'online', isPettyCash: false, paidTo: 'TNEB Electricity Board', attachmentName: 'tneb_bill_oct.pdf', remarks: 'EB Consumer No 04-123-4567 paid via Net Banking', createdBy: 'Super Admin', createdAt: '2026-10-08T14:30:00.000Z' },
    'ex_6': { id: 'ex_6', itemId: 'ei_6', itemName: 'Internet & Telephone', date: '2026-10-17', amount: 1499, mode: 'online', isPettyCash: false, paidTo: 'Airtel Broadband', attachmentName: 'airtel_bill_oct.pdf', remarks: '300 Mbps fiber internet monthly bill', createdBy: 'Super Admin', createdAt: '2026-10-17T15:20:00.000Z' },

    // Cycle #1 Petty Cash Expenses (Total = ₹18,500; Leftover = ₹1,500 returned)
    'ex_3': { id: 'ex_3', cycleId: 'pcc_1', cycleNumber: 1, itemId: 'ei_3', itemName: 'Water Can / Water Bill', date: '2026-10-03', amount: 850, mode: 'petty_cash', isPettyCash: true, paidTo: 'Balaji Water Suppliers', attachmentName: 'water_slip_03oct.jpg', remarks: '20 water cans for classrooms and staff room', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-03T16:00:00.000Z' },
    'ex_4': { id: 'ex_4', cycleId: 'pcc_1', cycleNumber: 1, itemId: 'ei_4', itemName: 'Tea & Refreshments', date: '2026-10-06', amount: 1450, mode: 'petty_cash', isPettyCash: true, paidTo: 'Anand Tea Stall', attachmentName: 'tea_bill.jpg', remarks: 'Weekly faculty and visitor refreshments', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-06T17:15:00.000Z' },
    'ex_clean': { id: 'ex_clean', cycleId: 'pcc_1', cycleNumber: 1, itemId: 'ei_10', itemName: 'Classroom Cleaning & Maintenance', date: '2026-10-10', amount: 920, mode: 'petty_cash', isPettyCash: true, paidTo: 'Selvam General Stores', attachmentName: 'cleaning_bill.jpg', remarks: 'Floor cleaner, disinfectant phenyl, brooms', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-10T11:00:00.000Z' },
    'ex_5': { id: 'ex_5', cycleId: 'pcc_1', cycleNumber: 1, itemId: 'ei_5', itemName: 'Office Stationery & Printing', date: '2026-10-14', amount: 6800, mode: 'petty_cash', isPettyCash: true, paidTo: 'Sri Ram Xerox & Stationery', attachmentName: 'xerox_bill_14oct.pdf', remarks: 'A4 paper bundles and test series question paper photocopy', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-14T12:00:00.000Z' },
    'ex_7': { id: 'ex_7', cycleId: 'pcc_1', cycleNumber: 1, itemId: 'ei_8', itemName: 'Courier & Postal', date: '2026-10-18', amount: 1180, mode: 'petty_cash', isPettyCash: true, paidTo: 'DTDC Courier Service', attachmentName: 'courier_receipt.jpg', remarks: 'Postal study material dispatched to outstation candidates', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-18T11:45:00.000Z' },
    'ex_repair': { id: 'ex_repair', cycleId: 'pcc_1', cycleNumber: 1, itemId: 'ei_7', itemName: 'Repairs & Maintenance', date: '2026-10-21', amount: 1300, mode: 'petty_cash', isPettyCash: true, paidTo: 'Murugan Electricals', attachmentName: 'light_bill.jpg', remarks: 'Hall tube light starter and LED batten replacement', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-21T15:00:00.000Z' },
    'ex_snack': { id: 'ex_snack', cycleId: 'pcc_1', cycleNumber: 1, itemId: 'ei_4', itemName: 'Tea & Refreshments', date: '2026-10-24', amount: 6000, mode: 'petty_cash', isPettyCash: true, paidTo: 'Saravana Bhavan Hotel', attachmentName: 'catering_bill.pdf', remarks: 'Guest lecture seminar tea, snacks & lunch for 60 participants', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-24T18:00:00.000Z' },

    // Cycle #2 Petty Cash Expenses (Fresh ₹20,000 float given on 26/10/2026; ₹4,000 spent; ₹16,000 balance in hand)
    'ex_petrol': { id: 'ex_petrol', cycleId: 'pcc_2', cycleNumber: 2, itemId: 'ei_9', itemName: 'Car Petrol / Fuel (Office Vehicle)', date: '2026-10-26', amount: 4000, mode: 'petty_cash', isPettyCash: true, paidTo: 'HP Petrol Bunk', attachmentName: 'petrol_bill_4000.jpg', remarks: 'Car petrol full tank for academy inspection visit', createdBy: 'Raju (Office Staff)', createdAt: '2026-10-26T11:00:00.000Z' },
  }
};

function loadStore() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure pettyCashCycles & pettyCashReturns exist in parsed data
      if (!parsed.pettyCashCycles || Object.keys(parsed.pettyCashCycles).length === 0) {
        parsed.pettyCashCycles = JSON.parse(JSON.stringify(INITIAL_DATA.pettyCashCycles));
        parsed.pettyCashReturns = JSON.parse(JSON.stringify(INITIAL_DATA.pettyCashReturns));
        parsed.expenseItems = { ...INITIAL_DATA.expenseItems, ...parsed.expenseItems };
        parsed.expenses = { ...INITIAL_DATA.expenses, ...parsed.expenses };
        saveStore(parsed);
      }
      return parsed;
    }
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
      if (savedUid && this.data.users && this.data.users[savedUid]) {
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
