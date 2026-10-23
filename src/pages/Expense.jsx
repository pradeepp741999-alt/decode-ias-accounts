import {useEffect,useState} from 'react';
import {addDoc,collection,doc,getDocs,updateDoc} from 'firebase/firestore';
import {db} from '../firebase';
import {today,inr,exportXlsx,toDmy} from '../util';

export default function Expense({me, onBack}){
  const [items,setItems]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [disbursements,setDisbursements]=useState([]);
  const [viewTab,setViewTab]=useState('entry'); // 'entry' | 'items' | 'disburse' | 'log'
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');

  // Form states for Expense Entry
  const isPettyRole = me.role === 'petty_cash';
  const [entryForm,setEntryForm]=useState({
    itemId:'',
    date:today(),
    amount:'',
    mode:isPettyRole ? 'petty_cash' : 'cash',
    isPettyCash:isPettyRole,
    paidTo:'',
    attachmentName:'',
    remarks:''
  });

  // Form states for Item Setup
  const [newItemName,setNewItemName]=useState('');

  // Form states for Petty Cash Disbursement
  const [disburseForm,setDisburseForm]=useState({
    date:today(),
    amount:'',
    givenTo:isPettyRole ? me.name : 'Raju (Office Staff)',
    mode:'cash',
    remarks:''
  });

  // Filter states for Log
  const [filterFrom,setFilterFrom]=useState('');
  const [filterTo,setFilterTo]=useState('');
  const [filterItem,setFilterItem]=useState('');
  const [filterType,setFilterType]=useState('all'); // 'all' | 'petty' | 'general'

  const loadData = async()=>{
    try{
      const itSnap = await getDocs(collection(db,'expenseItems'));
      setItems(itSnap.docs.map(d=>({id:d.id,...d.data()})));
      const exSnap = await getDocs(collection(db,'expenses'));
      setExpenses(exSnap.docs.map(d=>({id:d.id,...d.data()})));
      const disSnap = await getDocs(collection(db,'pettyCashDisbursements'));
      setDisbursements(disSnap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){
      console.error(e);
    }
  };

  useEffect(()=>{
    loadData();
  },[]);

  // Calculations
  const sum = arr => arr.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalExpenses = sum(expenses);
  const pettyExpenses = expenses.filter(e => e.isPettyCash || e.mode === 'petty_cash');
  const generalExpenses = expenses.filter(e => !e.isPettyCash && e.mode !== 'petty_cash');
  const totalPettySpent = sum(pettyExpenses);
  const totalPettyGiven = sum(disbursements);
  const pettyBalance = totalPettyGiven - totalPettySpent;

  // Save new Expense
  const saveExpense = async e=>{
    e.preventDefault();
    setMsg('');
    setErr('');
    const amt = Number(entryForm.amount);
    if(!entryForm.itemId) return setErr('Please select an expense item/category.');
    if(amt <= 0) return setErr('Please enter a valid expense amount.');

    const selectedItem = items.find(it => it.id === entryForm.itemId);
    setBusy(true);
    try{
      await addDoc(collection(db,'expenses'),{
        itemId: entryForm.itemId,
        itemName: selectedItem ? selectedItem.name : 'Other',
        date: entryForm.date,
        amount: amt,
        mode: entryForm.mode,
        isPettyCash: Boolean(entryForm.isPettyCash || entryForm.mode === 'petty_cash'),
        paidTo: entryForm.paidTo.trim(),
        attachmentName: entryForm.attachmentName.trim(),
        remarks: entryForm.remarks.trim(),
        createdBy: me.name,
        createdAt: new Date().toISOString()
      });
      setMsg(`Expense of ${inr(amt)} for ${selectedItem?.name} recorded successfully!`);
      setEntryForm({
        itemId:'',
        date:today(),
        amount:'',
        mode:isPettyRole ? 'petty_cash' : 'cash',
        isPettyCash:isPettyRole,
        paidTo:'',
        attachmentName:'',
        remarks:''
      });
      await loadData();
    }catch(x){
      setErr('Failed to record expense: ' + x.message);
    }
    setBusy(false);
  };

  // Add Item (EB bill, Room rent, Water bill, etc.)
  const addItem = async e=>{
    e.preventDefault();
    if(!newItemName.trim()) return;
    setBusy(true);
    try{
      await addDoc(collection(db,'expenseItems'),{
        name: newItemName.trim(),
        active: true,
        createdAt: new Date().toISOString()
      });
      setNewItemName('');
      setMsg('New expense item added successfully!');
      await loadData();
    }catch(x){
      setErr(x.message);
    }
    setBusy(false);
  };

  const toggleItemActive = async (item)=>{
    try{
      await updateDoc(doc(db,'expenseItems',item.id),{active: !item.active});
      await loadData();
    }catch(x){
      setErr(x.message);
    }
  };

  // Disburse Petty Cash to Office Boy / Staff
  const saveDisbursement = async e=>{
    e.preventDefault();
    setMsg('');
    setErr('');
    const amt = Number(disburseForm.amount);
    if(amt <= 0) return setErr('Please enter a valid disbursement amount.');
    setBusy(true);
    try{
      await addDoc(collection(db,'pettyCashDisbursements'),{
        date: disburseForm.date,
        amount: amt,
        givenTo: disburseForm.givenTo.trim(),
        givenBy: me.name,
        mode: disburseForm.mode,
        remarks: disburseForm.remarks.trim(),
        createdAt: new Date().toISOString()
      });
      setMsg(`Petty cash of ${inr(amt)} disbursed to ${disburseForm.givenTo} successfully!`);
      setDisburseForm({
        date:today(),
        amount:'',
        givenTo:isPettyRole ? me.name : 'Raju (Office Staff)',
        mode:'cash',
        remarks:''
      });
      await loadData();
    }catch(x){
      setErr(x.message);
    }
    setBusy(false);
  };

  // Filtering for logs
  const inR = d => (!filterFrom || d >= filterFrom) && (!filterTo || d <= filterTo);
  const filteredExpenses = expenses.filter(e => {
    if (!inR(e.date)) return false;
    if (filterItem && e.itemId !== filterItem) return false;
    if (filterType === 'petty' && !e.isPettyCash && e.mode !== 'petty_cash') return false;
    if (filterType === 'general' && (e.isPettyCash || e.mode === 'petty_cash')) return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));

  const exportExpenseLog = ()=>{
    const rows = filteredExpenses.map(e => ({
      'Date': toDmy(e.date),
      'Expense Item': e.itemName,
      'Amount': e.amount,
      'Payment Mode': e.mode,
      'Petty Cash?': (e.isPettyCash || e.mode === 'petty_cash') ? 'YES' : 'NO',
      'Paid To / Vendor': e.paidTo || '-',
      'Attachment / Bill Ref': e.attachmentName || '-',
      'Remarks': e.remarks || '-',
      'Logged By': e.createdBy || '-'
    }));
    exportXlsx(rows, 'General_Expenses_Log');
  };

  const handleFileUpload = (e)=>{
    const file = e.target.files && e.target.files[0];
    if(file){
      setEntryForm(prev => ({...prev, attachmentName: file.name}));
    }
  };

  return (
    <div className="parent-card">
      {/* Header */}
      <div className="parent-card-header">
        <div>
          <h2>🧾 General Expense & Petty Cash Management</h2>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            Record debit institutional payouts (EB Bill, Rent, Water), manage items, and track office boy petty cash
          </p>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          {onBack && (
            <button type="button" className="btn sm outline" onClick={onBack}>
              ← Back to Dashboard Hub
            </button>
          )}
          <span className="badge">Role: {me.role}</span>
        </div>
      </div>

      {/* Financial Debit KPIs */}
      <div className="grid" style={{marginBottom:'20px'}}>
        <div className="card kpi">
          Total Expenses Paid
          <b style={{color:'var(--red)'}}>{inr(totalExpenses)}</b>
          <span className="muted" style={{fontSize:'12px'}}>{expenses.length} debit transactions</span>
        </div>
        <div className="card kpi">
          Office Boy Petty Cash Given
          <b>{inr(totalPettyGiven)}</b>
          <span className="muted" style={{fontSize:'12px'}}>{disbursements.length} disbursements</span>
        </div>
        <div className="card kpi">
          Office Boy Petty Cash Spent
          <b style={{color:'#d97706'}}>{inr(totalPettySpent)}</b>
          <span className="muted" style={{fontSize:'12px'}}>{pettyExpenses.length} petty cash vouchers</span>
        </div>
        <div className="card kpi" style={{background:pettyBalance<1000?'#fff5f5':'#f8fafd'}}>
          Petty Cash Balance in Hand
          <b style={{color:pettyBalance<1000?'var(--red)':'var(--grn)'}}>{inr(pettyBalance)}</b>
          <span className="muted" style={{fontSize:'12px'}}>Remaining with office boy</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="tabs" style={{marginBottom:'16px'}}>
        <button className={viewTab==='entry'?'on':''} onClick={()=>setViewTab('entry')}>
          💸 1. Record Expense Payment
        </button>
        <button className={viewTab==='items'?'on':''} onClick={()=>setViewTab('items')}>
          🏷️ 2. Expense Items Setup ({items.filter(i=>i.active).length})
        </button>
        {me.role !== 'petty_cash' && (
          <button className={viewTab==='disburse'?'on':''} onClick={()=>setViewTab('disburse')}>
            💰 3. Disburse Petty Cash to Staff
          </button>
        )}
        <button className={viewTab==='log'?'on':''} onClick={()=>setViewTab('log')}>
          📋 4. Expense Log & Reports ({expenses.length})
        </button>
      </div>

      {msg && <div className="ok" style={{background:'#edfdf5',padding:'10px 14px',borderRadius:'6px',border:'1px solid #c6f6d5',marginBottom:'16px'}}>✅ {msg}</div>}
      {err && <div className="err" style={{background:'#fdeeed',padding:'10px 14px',borderRadius:'6px',border:'1px solid #f5c2c7',marginBottom:'16px'}}>⚠️ {err}</div>}

      {/* ============================================================== */}
      {/* 1. RECORD EXPENSE FORM                                         */}
      {/* ============================================================== */}
      {viewTab==='entry' && (
        <div className="card" style={{padding:'20px'}}>
          <h3 style={{marginTop:0,color:'var(--navy)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>💸 Record New Expense Voucher</span>
            {isPettyRole && <span className="badge" style={{background:'#fff3cd',color:'#856404'}}>Petty Cash Mode</span>}
          </h3>
          <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>
            Fill in the details below to debit the institutional account or office boy petty cash fund.
          </p>

          <form onSubmit={saveExpense}>
            <div className="grid2">
              <label>
                Expense Item / Category *
                <select
                  value={entryForm.itemId}
                  onChange={e=>setEntryForm({...entryForm, itemId: e.target.value})}
                  required
                >
                  <option value="">Select Expense Item (e.g. EB Bill, Rent, Water)</option>
                  {items.filter(i=>i.active).map(it=>(
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Expense Date (dd-mm-yyyy) *
                <input
                  type="date"
                  value={entryForm.date}
                  onChange={e=>setEntryForm({...entryForm, date: e.target.value})}
                  required
                />
              </label>

              <label>
                Debit Amount (₹) *
                <input
                  type="number"
                  min="1"
                  value={entryForm.amount}
                  onChange={e=>setEntryForm({...entryForm, amount: e.target.value})}
                  placeholder="e.g. 1500"
                  required
                />
              </label>

              <label>
                Payment Mode *
                <select
                  value={entryForm.mode}
                  onChange={e=>{
                    const m = e.target.value;
                    setEntryForm({
                      ...entryForm,
                      mode: m,
                      isPettyCash: m === 'petty_cash' ? true : entryForm.isPettyCash
                    });
                  }}
                  required
                >
                  <option value="cash">Cash (Direct Counter Cash)</option>
                  <option value="online">Online / UPI / Bank Transfer</option>
                  <option value="petty_cash">Petty Cash (Office Boy Cash Hand)</option>
                </select>
              </label>

              <label>
                Paid To / Vendor / Person Name
                <input
                  value={entryForm.paidTo}
                  onChange={e=>setEntryForm({...entryForm, paidTo: e.target.value})}
                  placeholder="e.g. TNEB, Building Owner, Water Vendor, Tea Shop"
                />
              </label>

              <label>
                Bill Attachment / Proof (Receipt / Voucher)
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    style={{padding:'6px',fontSize:'12px'}}
                  />
                  {entryForm.attachmentName && (
                    <span className="badge" style={{background:'#e2e8f0',fontSize:'11px'}}>
                      📎 {entryForm.attachmentName}
                    </span>
                  )}
                </div>
              </label>
            </div>

            {/* Petty Cash Split Checkbox Flag */}
            <div style={{background:'#f6f9fe',border:'1px solid #d0e0f5',borderRadius:'8px',padding:'12px 16px',margin:'16px 0'}}>
              <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontWeight:600,color:'var(--navy)'}}>
                <input
                  type="checkbox"
                  checked={entryForm.isPettyCash || entryForm.mode==='petty_cash'}
                  onChange={e=>setEntryForm({...entryForm, isPettyCash: e.target.checked})}
                  style={{width:'18px',height:'18px',margin:0}}
                />
                <span>🚩 Mark this as an Office Boy / Petty Cash expenditure (Deducts from Petty Cash Balance)</span>
              </label>
              <p className="muted" style={{margin:'4px 0 0 28px',fontSize:'12px'}}>
                This flag separates office boy daily micro-expenses (tea, water cans, printing, courier) from high-value institutional payments (rent, EB bill).
              </p>
            </div>

            <label style={{marginBottom:'16px'}}>
              Remarks / Description
              <textarea
                rows={2}
                value={entryForm.remarks}
                onChange={e=>setEntryForm({...entryForm, remarks: e.target.value})}
                placeholder="Optional notes, consumer number, bill number or voucher details..."
              />
            </label>

            <button className="btn gold" disabled={busy} style={{padding:'12px 24px',fontSize:'15px'}}>
              {busy ? 'Saving Expense…' : '💾 Save Expense Entry'}
            </button>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. EXPENSE ITEMS SETUP                                         */}
      {/* ============================================================== */}
      {viewTab==='items' && (
        <div className="card" style={{padding:'20px'}}>
          <h3 style={{marginTop:0,color:'var(--navy)'}}>🏷️ Manage Expense Items & Categories</h3>
          <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>
            Create predefined expense items like EB Bill, Room Rent, Water Bill, Stationery, etc., for staff to select from.
          </p>

          <form onSubmit={addItem} style={{display:'flex',gap:'10px',alignItems:'flex-end',marginBottom:'20px',flexWrap:'wrap'}}>
            <label style={{flex:1,minWidth:'240px'}}>
              New Expense Item Name *
              <input
                value={newItemName}
                onChange={e=>setNewItemName(e.target.value)}
                placeholder="e.g. Cleaning Supplies, Diesel Generator, Water Bill..."
                required
              />
            </label>
            <button className="btn gold" disabled={busy} style={{height:'40px'}}>
              + Add Item
            </button>
          </form>

          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Expense Item Name</th>
                  <th>Status</th>
                  <th>Total Spent Under Item</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it=>{
                  const spentOnIt = sum(expenses.filter(e=>e.itemId===it.id));
                  return (
                    <tr key={it.id}>
                      <td><b>{it.name}</b></td>
                      <td>
                        <span style={{fontWeight:600,color:it.active?'var(--grn)':'var(--mut)'}}>
                          {it.active ? '● Active' : '○ Inactive'}
                        </span>
                      </td>
                      <td><b>{inr(spentOnIt)}</b></td>
                      <td>
                        <button
                          type="button"
                          className="btn sm outline"
                          onClick={()=>toggleItemActive(it)}
                        >
                          {it.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. DISBURSE PETTY CASH (GIVE TO OFFICE BOY)                    */}
      {/* ============================================================== */}
      {viewTab==='disburse' && (
        <div className="card" style={{padding:'20px'}}>
          <h3 style={{marginTop:0,color:'var(--navy)'}}>💰 Disburse Petty Cash to Office Boy / Staff</h3>
          <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>
            Record funds given to the office boy or petty cashier for daily operational expenses.
          </p>

          <form onSubmit={saveDisbursement} style={{marginBottom:'24px'}}>
            <div className="grid2">
              <label>
                Disbursement Date (dd-mm-yyyy) *
                <input
                  type="date"
                  value={disburseForm.date}
                  onChange={e=>setDisburseForm({...disburseForm, date: e.target.value})}
                  required
                />
              </label>

              <label>
                Amount Given (₹) *
                <input
                  type="number"
                  min="1"
                  value={disburseForm.amount}
                  onChange={e=>setDisburseForm({...disburseForm, amount: e.target.value})}
                  placeholder="e.g. 5000"
                  required
                />
              </label>

              <label>
                Given To (Staff / Office Boy Name) *
                <input
                  value={disburseForm.givenTo}
                  onChange={e=>setDisburseForm({...disburseForm, givenTo: e.target.value})}
                  placeholder="e.g. Raju (Office Staff)"
                  required
                />
              </label>

              <label>
                Payment Mode
                <select
                  value={disburseForm.mode}
                  onChange={e=>setDisburseForm({...disburseForm, mode: e.target.value})}
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="online">Online / UPI to Staff</option>
                </select>
              </label>
            </div>

            <label style={{margin:'14px 0'}}>
              Disbursement Remarks
              <input
                value={disburseForm.remarks}
                onChange={e=>setDisburseForm({...disburseForm, remarks: e.target.value})}
                placeholder="e.g. Weekly petty cash advance for water and tea"
              />
            </label>

            <button className="btn gold" disabled={busy}>
              {busy ? 'Saving…' : '💵 Record Fund Disbursement'}
            </button>
          </form>

          <h4 style={{marginBottom:'10px',color:'var(--navy)'}}>Petty Cash Disbursement History</h4>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount Given</th>
                  <th>Given To</th>
                  <th>Given By</th>
                  <th>Mode</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {disbursements.map(d=>(
                  <tr key={d.id}>
                    <td>{toDmy(d.date)}</td>
                    <td style={{fontWeight:700,color:'var(--grn)'}}>{inr(d.amount)}</td>
                    <td><b>{d.givenTo}</b></td>
                    <td>{d.givenBy}</td>
                    <td style={{textTransform:'capitalize'}}>{d.mode}</td>
                    <td>{d.remarks||'-'}</td>
                  </tr>
                ))}
                {!disbursements.length && <tr><td colSpan={6} className="muted">No disbursement records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. EXPENSE LOG & SPLIT REPORT                                  */}
      {/* ============================================================== */}
      {viewTab==='log' && (
        <div className="card" style={{padding:'20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
            <div>
              <h3 style={{margin:0,color:'var(--navy)'}}>📋 Expense Vouchers & Split Log</h3>
              <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
                Filter debit payouts by date, category, and petty cash split
              </p>
            </div>
            <button className="btn sm gold" onClick={exportExpenseLog}>
              📥 Download Excel Log
            </button>
          </div>

          {/* Filter Card inside Log */}
          <div className="filter-card">
            <div className="grid-filter">
              <label>
                From <span className="filter-label-format">(dd-mm-yyyy)</span>
                <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)}/>
              </label>
              <label>
                To <span className="filter-label-format">(dd-mm-yyyy)</span>
                <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)}/>
              </label>
              <label>
                Expense Item
                <select value={filterItem} onChange={e=>setFilterItem(e.target.value)}>
                  <option value="">All Items</option>
                  {items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </label>
              <label>
                Expense Type
                <select value={filterType} onChange={e=>setFilterType(e.target.value)}>
                  <option value="all">All Expenses (General + Petty Cash)</option>
                  <option value="petty">Petty Cash Only (Office Boy)</option>
                  <option value="general">Institutional General Only</option>
                </select>
              </label>
            </div>
          </div>

          {/* Split Summary Bar */}
          <div style={{display:'flex',gap:'14px',flexWrap:'wrap',background:'#f6f9fe',border:'1px solid #d0e0f5',borderRadius:'8px',padding:'12px',marginBottom:'16px',fontSize:'13px'}}>
            <div>Total in view: <b>{inr(sum(filteredExpenses))}</b></div>
            <div>Petty Cash in view: <b style={{color:'#d97706'}}>{inr(sum(filteredExpenses.filter(e=>e.isPettyCash||e.mode==='petty_cash')))}</b></div>
            <div>Institutional in view: <b style={{color:'var(--navy)'}}>{inr(sum(filteredExpenses.filter(e=>!e.isPettyCash&&e.mode!=='petty_cash')))}</b></div>
          </div>

          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense Item</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Petty Cash?</th>
                  <th>Paid To / Vendor</th>
                  <th>Attachment</th>
                  <th>Remarks</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e=>(
                  <tr key={e.id}>
                    <td>{toDmy(e.date)}</td>
                    <td><b>{e.itemName}</b></td>
                    <td style={{color:'var(--red)',fontWeight:700}}>{inr(e.amount)}</td>
                    <td style={{textTransform:'capitalize'}}>{e.mode}</td>
                    <td>
                      {(e.isPettyCash || e.mode==='petty_cash') ? (
                        <span style={{background:'#fff3cd',color:'#856404',padding:'3px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:700}}>
                          🚩 Petty Cash
                        </span>
                      ) : (
                        <span className="muted" style={{fontSize:'12px'}}>Direct Institutional</span>
                      )}
                    </td>
                    <td>{e.paidTo || '-'}</td>
                    <td>
                      {e.attachmentName ? (
                        <span className="badge" style={{background:'#e2e8f0',fontSize:'11px'}}>
                          📎 {e.attachmentName}
                        </span>
                      ) : '-'}
                    </td>
                    <td>{e.remarks || '-'}</td>
                    <td>{e.createdBy || '-'}</td>
                  </tr>
                ))}
                {!filteredExpenses.length && (
                  <tr><td colSpan={9} className="muted" style={{padding:'20px',textAlign:'center'}}>No expense records found matching filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
