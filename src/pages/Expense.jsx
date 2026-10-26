import {useEffect,useState} from 'react';
import {addDoc,collection,doc,getDocs,updateDoc} from 'firebase/firestore';
import {db} from '../firebase';
import {today,inr,exportXlsx,toDmy,can} from '../util';

export default function Expense({me, onBack}){
  const [items,setItems]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [cycles,setCycles]=useState([]);
  const [returns,setReturns]=useState([]);
  const [disbursements,setDisbursements]=useState([]);

  // Sub-section navigation: null = 2-card Hub | 'general' = General Expense Module | 'petty' = Petty Cash Module
  const isPettyOnly = me.role === 'petty_cash';
  const isReportsOnly = me.role === 'reports';
  const [section,setSection]=useState(isPettyOnly ? 'petty' : null);

  // Tabs inside General Expense: 'entry' | 'items' | 'log'
  const [genTab,setGenTab]=useState(isReportsOnly ? 'log' : 'entry');

  // Tabs inside Petty Cash: 'voucher' | 'return' | 'cycles_report' | 'vouchers_log' | 'disburse'
  const [pettyTab,setPettyTab]=useState(isReportsOnly ? 'cycles_report' : 'voucher');

  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');

  // Selected cycle to view vouchers details in modal or drawer
  const [selectedCycleVouchers,setSelectedCycleVouchers]=useState(null);

  // Form states for General Expense Entry
  const [genForm,setGenForm]=useState({
    itemId:'',
    date:today(),
    amount:'',
    mode:'online',
    paidTo:'',
    attachmentName:'',
    remarks:''
  });

  // Form states for Item Setup
  const [newItemName,setNewItemName]=useState('');

  // Form states for Petty Cash Voucher Entry
  const [voucherForm,setVoucherForm]=useState({
    itemId:'',
    date:today(),
    amount:'',
    paidTo:'',
    attachmentName:'',
    remarks:''
  });

  // Form states for Return Balance & Settle Cycle
  const [returnForm,setReturnForm]=useState({
    date:today(),
    amount:'',
    returnedBy:isPettyOnly ? me.name : 'Raju (Office Staff)',
    receivedBy:me.name,
    remarks:'Returned remaining balance before starting fresh ₹20k cycle',
    autoReissue:true,
    reissueAmount:20000,
    reissueGivenTo:'Raju (Office Staff)'
  });

  // Form states for Manual Float Disburse
  const [disburseForm,setDisburseForm]=useState({
    date:today(),
    amount:20000,
    givenTo:'Raju (Office Staff)',
    mode:'cash',
    remarks:'Fresh Petty Cash Imprest Float for Office Operations'
  });

  // Filter states for General Log
  const [filterFrom,setFilterFrom]=useState('');
  const [filterTo,setFilterTo]=useState('');
  const [filterItem,setFilterItem]=useState('');

  const loadData = async()=>{
    try{
      const itSnap = await getDocs(collection(db,'expenseItems'));
      setItems(itSnap.docs.map(d=>({id:d.id,...d.data()})));

      const exSnap = await getDocs(collection(db,'expenses'));
      setExpenses(exSnap.docs.map(d=>({id:d.id,...d.data()})));

      const cySnap = await getDocs(collection(db,'pettyCashCycles'));
      setCycles(cySnap.docs.map(d=>({id:d.id,...d.data()})));

      const retSnap = await getDocs(collection(db,'pettyCashReturns'));
      setReturns(retSnap.docs.map(d=>({id:d.id,...d.data()})));

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
  
  // Split general expenses vs petty cash expenses
  const isPettyExp = e => Boolean(e.isPettyCash || e.mode === 'petty_cash' || e.cycleId);
  const generalExpenses = expenses.filter(e => !isPettyExp(e));
  const pettyExpenses = expenses.filter(isPettyExp);

  const totalGeneralPaid = sum(generalExpenses);
  const totalPettySpentAllTime = sum(pettyExpenses);

  // Active Petty Cash Cycle calculation
  const activeCycle = cycles.find(c => c.status === 'active') || null;
  const activeCycleExpenses = activeCycle 
    ? pettyExpenses.filter(e => e.cycleId === activeCycle.id || (!e.cycleId && e.date >= activeCycle.startDate))
    : [];
  const activeCycleSpent = sum(activeCycleExpenses);
  const activeCycleFloat = activeCycle ? Number(activeCycle.imprestAmount || 0) : 0;
  const activeCycleBalanceInHand = activeCycle ? Math.max(0, activeCycleFloat - activeCycleSpent) : 0;

  // Sync return form amount with active cycle balance when active cycle changes
  useEffect(()=>{
    if(activeCycle){
      setReturnForm(prev => ({
        ...prev,
        amount: activeCycleBalanceInHand,
        returnedBy: activeCycle.custodianName || 'Raju (Office Staff)'
      }));
    }
  },[activeCycle?.id, activeCycleBalanceInHand]);

  // Save General Institutional Expense
  const saveGeneralExpense = async e=>{
    e.preventDefault();
    setMsg('');
    setErr('');
    const amt = Number(genForm.amount);
    if(!genForm.itemId) return setErr('Please select an expense category/item.');
    if(amt <= 0) return setErr('Please enter a valid expense amount.');

    const selectedItem = items.find(it => it.id === genForm.itemId);
    setBusy(true);
    try{
      await addDoc(collection(db,'expenses'),{
        itemId: genForm.itemId,
        itemName: selectedItem ? selectedItem.name : 'General Expense',
        date: genForm.date,
        amount: amt,
        mode: genForm.mode,
        isPettyCash: false,
        paidTo: genForm.paidTo.trim(),
        attachmentName: genForm.attachmentName.trim(),
        remarks: genForm.remarks.trim(),
        createdBy: me.name,
        createdAt: new Date().toISOString()
      });
      setMsg(`Institutional expense of ${inr(amt)} for ${selectedItem?.name} recorded successfully!`);
      setGenForm({
        itemId:'',
        date:today(),
        amount:'',
        mode:'online',
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

  // Add Item to Catalog
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
      setMsg('New expense category added successfully!');
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

  // Save Daily Petty Cash Voucher
  const savePettyVoucher = async e=>{
    e.preventDefault();
    setMsg('');
    setErr('');
    const amt = Number(voucherForm.amount);
    if(!voucherForm.itemId) return setErr('Please select a petty cash expense category.');
    if(amt <= 0) return setErr('Please enter a valid expense amount.');

    if(!activeCycle){
      return setErr('No active petty cash cycle found! Please request Admin to issue a fresh Imprest float (e.g. ₹20,000) first.');
    }

    if(amt > activeCycleBalanceInHand){
      return setErr(`Insufficient Petty Cash: Available cash in hand is ${inr(activeCycleBalanceInHand)}, but this expense is ${inr(amt)}. Please return the remaining balance to Admin and start a fresh ₹20,000 cycle to proceed!`);
    }

    const selectedItem = items.find(it => it.id === voucherForm.itemId);
    setBusy(true);
    try{
      await addDoc(collection(db,'expenses'),{
        itemId: voucherForm.itemId,
        itemName: selectedItem ? selectedItem.name : 'Petty Expense',
        date: voucherForm.date,
        amount: amt,
        mode: 'petty_cash',
        isPettyCash: true,
        cycleId: activeCycle.id,
        cycleNumber: activeCycle.cycleNumber || 1,
        paidTo: voucherForm.paidTo.trim(),
        attachmentName: voucherForm.attachmentName.trim(),
        remarks: voucherForm.remarks.trim(),
        createdBy: me.name,
        createdAt: new Date().toISOString()
      });

      // Update totalSpent on active cycle
      const newTotalSpent = activeCycleSpent + amt;
      await updateDoc(doc(db,'pettyCashCycles',activeCycle.id),{
        totalSpent: newTotalSpent
      });

      setMsg(`Petty cash voucher of ${inr(amt)} for ${selectedItem?.name} recorded! Remaining in hand: ${inr(activeCycleBalanceInHand - amt)}.`);
      setVoucherForm({
        itemId:'',
        date:today(),
        amount:'',
        paidTo:'',
        attachmentName:'',
        remarks:''
      });
      await loadData();
    }catch(x){
      setErr('Failed to record voucher: ' + x.message);
    }
    setBusy(false);
  };

  // Return Remaining Balance and Settle Active Cycle (User's Exact Concept)
  const saveReturnAndSettle = async e=>{
    e.preventDefault();
    setMsg('');
    setErr('');
    if(!activeCycle){
      return setErr('No active cycle to settle.');
    }
    const returnAmt = Number(returnForm.amount);
    if(returnAmt < 0){
      return setErr('Return amount cannot be negative.');
    }

    setBusy(true);
    try{
      const nowIso = new Date().toISOString();
      const currentCycleNum = activeCycle.cycleNumber || 1;

      // 1. Mark current active cycle as CLOSED
      await updateDoc(doc(db,'pettyCashCycles',activeCycle.id),{
        status: 'closed',
        endDate: returnForm.date,
        returnedAmount: returnAmt,
        returnedDate: returnForm.date,
        returnedTo: returnForm.receivedBy,
        closingRemarks: returnForm.remarks.trim(),
        closedAt: nowIso
      });

      // 2. Record return transaction
      await addDoc(collection(db,'pettyCashReturns'),{
        cycleId: activeCycle.id,
        cycleNumber: currentCycleNum,
        date: returnForm.date,
        amount: returnAmt,
        returnedBy: returnForm.returnedBy.trim(),
        receivedBy: returnForm.receivedBy.trim(),
        remarks: returnForm.remarks.trim(),
        createdAt: nowIso
      });

      let extraSuccessMsg = '';

      // 3. If autoReissue is checked, immediately create fresh cycle with ₹20,000 float
      if(returnForm.autoReissue){
        const nextCycleNum = currentCycleNum + 1;
        const freshFloat = Number(returnForm.reissueAmount) || 20000;
        
        const newCycleRef = await addDoc(collection(db,'pettyCashCycles'),{
          cycleNumber: nextCycleNum,
          startDate: returnForm.date,
          endDate: '',
          imprestAmount: freshFloat,
          custodianName: returnForm.reissueGivenTo.trim(),
          givenBy: me.name,
          mode: 'cash',
          totalSpent: 0,
          returnedAmount: 0,
          returnedDate: '',
          returnedTo: '',
          status: 'active',
          closingRemarks: '',
          createdAt: nowIso
        });

        // Record disbursement record for audit
        await addDoc(collection(db,'pettyCashDisbursements'),{
          cycleId: newCycleRef.id,
          cycleNumber: nextCycleNum,
          date: returnForm.date,
          amount: freshFloat,
          givenTo: returnForm.reissueGivenTo.trim(),
          givenBy: me.name,
          mode: 'cash',
          remarks: `Fresh Imprest float of ${inr(freshFloat)} issued immediately following Cycle #${currentCycleNum} settlement`,
          createdAt: nowIso
        });

        extraSuccessMsg = ` Fresh Cycle #${nextCycleNum} opened with ${inr(freshFloat)} float given to ${returnForm.reissueGivenTo}! Office boy now has ${inr(freshFloat)} in hand.`;
      }

      setMsg(`Cycle #${currentCycleNum} successfully settled & closed! Returned balance of ${inr(returnAmt)} recorded.${extraSuccessMsg}`);
      await loadData();
      setPettyTab('cycles_report');
    }catch(x){
      setErr('Settlement failed: ' + x.message);
    }
    setBusy(false);
  };

  // Issue Fresh Float (Manual)
  const saveManualDisburse = async e=>{
    e.preventDefault();
    setMsg('');
    setErr('');
    const amt = Number(disburseForm.amount);
    if(amt <= 0) return setErr('Please enter a valid amount.');

    if(activeCycle){
      if(!window.confirm(`There is already an active cycle (#${activeCycle.cycleNumber}) running with ${inr(activeCycleBalanceInHand)} in hand. Do you want to close it or proceed?`)){
        return;
      }
    }

    setBusy(true);
    try{
      const nowIso = new Date().toISOString();
      const nextCycleNum = (cycles.length > 0 ? Math.max(...cycles.map(c=>Number(c.cycleNumber)||0)) : 0) + 1;

      const newCycleRef = await addDoc(collection(db,'pettyCashCycles'),{
        cycleNumber: nextCycleNum,
        startDate: disburseForm.date,
        endDate: '',
        imprestAmount: amt,
        custodianName: disburseForm.givenTo.trim(),
        givenBy: me.name,
        mode: disburseForm.mode,
        totalSpent: 0,
        returnedAmount: 0,
        status: 'active',
        closingRemarks: '',
        createdAt: nowIso
      });

      await addDoc(collection(db,'pettyCashDisbursements'),{
        cycleId: newCycleRef.id,
        cycleNumber: nextCycleNum,
        date: disburseForm.date,
        amount: amt,
        givenTo: disburseForm.givenTo.trim(),
        givenBy: me.name,
        mode: disburseForm.mode,
        remarks: disburseForm.remarks.trim(),
        createdAt: nowIso
      });

      setMsg(`Fresh Petty Cash Imprest of ${inr(amt)} issued for Cycle #${nextCycleNum} successfully!`);
      await loadData();
      setPettyTab('voucher');
    }catch(x){
      setErr(x.message);
    }
    setBusy(false);
  };

  // Filtering for General Expenses Log
  const inR = d => (!filterFrom || d >= filterFrom) && (!filterTo || d <= filterTo);
  const filteredGeneral = generalExpenses.filter(e => {
    if (!inR(e.date)) return false;
    if (filterItem && e.itemId !== filterItem) return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));

  const exportGeneralLog = ()=>{
    const rows = filteredGeneral.map(e => ({
      'Date': toDmy(e.date),
      'Expense Category': e.itemName,
      'Amount (₹)': e.amount,
      'Payment Mode': e.mode,
      'Paid To / Vendor': e.paidTo || '-',
      'Attachment / Bill Ref': e.attachmentName || '-',
      'Remarks': e.remarks || '-',
      'Logged By': e.createdBy || '-'
    }));
    exportXlsx(rows, 'General_Institutional_Expenses_Log');
  };

  // Filtering for Petty Cash Cycles
  const sortedCycles = [...cycles].sort((a,b) => (b.cycleNumber || 0) - (a.cycleNumber || 0));

  const exportPettyCyclesLog = ()=>{
    const rows = sortedCycles.map(c => {
      const cycleSpent = sum(pettyExpenses.filter(e => e.cycleId === c.id || (!e.cycleId && e.date >= c.startDate && (!c.endDate || e.date <= c.endDate))));
      const returned = Number(c.returnedAmount || 0);
      const floatAmt = Number(c.imprestAmount || 0);
      const variance = c.status === 'closed' ? (floatAmt - (cycleSpent + returned)) : 0;
      return {
        'Cycle No': `#${c.cycleNumber}`,
        'Start Date': toDmy(c.startDate),
        'End / Return Date': c.endDate ? toDmy(c.endDate) : 'Active / Running',
        'Custodian': c.custodianName,
        'Float Given (₹)': floatAmt,
        'Total Vouchers Spent (₹)': cycleSpent,
        'Balance Returned to Admin (₹)': returned,
        'Audit Variance (₹)': variance === 0 ? 'Balanced (₹0)' : `Discrepancy (₹${variance})`,
        'Cycle Status': c.status === 'closed' ? 'SETTLED & CLOSED' : `ACTIVE (₹${floatAmt - cycleSpent} in hand)`,
        'Closing Remarks': c.closingRemarks || '-'
      };
    });
    exportXlsx(rows, 'Petty_Cash_Imprest_Cycles_Audit');
  };

  const handleFileUpload = (e, formSetter)=>{
    const file = e.target.files && e.target.files[0];
    if(file){
      formSetter(prev => ({...prev, attachmentName: file.name}));
    }
  };

  /* =========================================================================================
     VIEW 1: PRIMARY 2-CARD HUB (General Expense vs Petty Cash)
     ========================================================================================= */
  if(!section){
    return (
      <div className="parent-card">
        <div className="parent-card-header">
          <div>
            <h2>🧾 General Expense & Petty Cash Hub</h2>
            <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
              Select an activity module below to manage institutional debits or office boy petty cash cycles
            </p>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            {onBack && <button type="button" className="btn sm outline" onClick={onBack}>← Back to Dashboard Hub</button>}
            <span className="badge">Role: {me.role}</span>
          </div>
        </div>

        {/* Top Debit Highlights */}
        <div className="grid" style={{marginBottom:'24px'}}>
          <div className="card kpi">
            Institutional Debits Paid
            <b style={{color:'var(--red)'}}>{inr(totalGeneralPaid)}</b>
            <span className="muted" style={{fontSize:'12px'}}>{generalExpenses.length} institutional vouchers (Rent, EB, Water)</span>
          </div>
          <div className="card kpi">
            Active Petty Cash Float
            <b>{inr(activeCycleFloat)}</b>
            <span className="muted" style={{fontSize:'12px'}}>
              {activeCycle ? `Cycle #${activeCycle.cycleNumber} with ${activeCycle.custodianName}` : 'No cycle currently active'}
            </span>
          </div>
          <div className="card kpi">
            Current Cycle Cash in Hand
            <b style={{color:activeCycleBalanceInHand<2000?'var(--red)':'var(--grn)'}}>{inr(activeCycleBalanceInHand)}</b>
            <span className="muted" style={{fontSize:'12px'}}>
              Spent {inr(activeCycleSpent)} out of {inr(activeCycleFloat)}
            </span>
          </div>
        </div>

        {/* 2 Primary Distinct Cards */}
        <div className="hub-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))'}}>
          
          {/* Card 1: General Expense */}
          <div className="hub-card" onClick={()=>setSection('general')}>
            <div>
              <div className="hub-icon">🏛️</div>
              <span className="count-tag" style={{marginBottom:'8px'}}>Institutional Accounts</span>
              <h3>General Expense & Debits</h3>
              <p>
                Record non-petty institutional payouts (Academy Room Rent, EB Electricity Bill, Water Supplier, Internet Broadband, Fixed Assets), configure categories, and view voucher reports.
              </p>
              <div style={{marginTop:'12px',fontSize:'12px',color:'#3b82f6',fontWeight:'600'}}>
                • Total Paid: {inr(totalGeneralPaid)} ({generalExpenses.length} entries)
              </div>
            </div>
            <div className="hub-action">
              <span>Open General Expenses</span>
              <span>→</span>
            </div>
          </div>

          {/* Card 2: Petty Cash */}
          <div className="hub-card" onClick={()=>setSection('petty')} style={{borderColor:activeCycleBalanceInHand<2000?'#fca5a5':'#cbd5e1'}}>
            <div>
              <div className="hub-icon">🪙</div>
              <span className="count-tag" style={{marginBottom:'8px',background:activeCycle?'#dcfce7':'#fef3c7',color:activeCycle?'#166534':'#92400e'}}>
                {activeCycle ? `Cycle #${activeCycle.cycleNumber} (Active Float: ${inr(activeCycleFloat)})` : 'Imprest Cycles'}
              </span>
              <h3>Petty Cash Management</h3>
              <p>
                Handled via standard Imprest float (₹20,000). Office boy records daily micro-expenses (tea, coffee, cleaner, fuel/petrol, courier). When low (e.g. ₹1,500 left), he returns balance to Admin and fresh ₹20,000 is re-issued.
              </p>
              <div style={{marginTop:'12px',fontSize:'12px',color:activeCycleBalanceInHand<2000?'var(--red)':'#166534',fontWeight:'700'}}>
                • Cash in Hand with Staff: {inr(activeCycleBalanceInHand)} | Spent: {inr(activeCycleSpent)}
              </div>
            </div>
            <div className="hub-action">
              <span>Open Petty Cash Cycles</span>
              <span>→</span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  /* =========================================================================================
     VIEW 2: GENERAL EXPENSE SUB-MODULE (Institutional Debits)
     ========================================================================================= */
  if(section === 'general'){
    return (
      <div className="parent-card">
        {/* Header with Back button */}
        <div className="parent-card-header">
          <div>
            <h2>🏛️ General Expense & Institutional Debits</h2>
            <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
              Manage academy rent, electricity board, internet, building maintenance, and institutional payout vouchers
            </p>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <button type="button" className="btn sm outline" onClick={()=>setSection(null)}>
              ← Back to Expense Hub
            </button>
            <span className="badge">Total Paid: {inr(totalGeneralPaid)}</span>
          </div>
        </div>

        {/* Tab selection */}
        <div style={{display:'flex',gap:'8px',marginBottom:'18px',borderBottom:'1.5px solid var(--border)',paddingBottom:'10px',flexWrap:'wrap'}}>
          {!isReportsOnly && (
            <button className={`btn sm ${genTab==='entry'?'':'outline'}`} onClick={()=>setGenTab('entry')}>
              ➕ Record Institutional Expense
            </button>
          )}
          {!isReportsOnly && (
            <button className={`btn sm ${genTab==='items'?'':'outline'}`} onClick={()=>setGenTab('items')}>
              🏷️ Expense Categories Setup ({items.length})
            </button>
          )}
          <button className={`btn sm ${genTab==='log'?'':'outline'}`} onClick={()=>setGenTab('log')}>
            📑 General Expense Reports & Log ({generalExpenses.length})
          </button>
        </div>

        {msg && <div style={{background:'#dcfce7',color:'#166534',padding:'10px 14px',borderRadius:'8px',marginBottom:'14px',fontWeight:'600'}}>{msg}</div>}
        {err && <div className="err" style={{marginBottom:'14px'}}>{err}</div>}

        {/* TAB 1: General Expense Entry */}
        {genTab === 'entry' && (
          <div className="card" style={{maxWidth:'800px',margin:'0 auto'}}>
            <h3 style={{marginTop:0}}>Record New Institutional Payment</h3>
            <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>
              Fill in the details for rent, electricity, fiber broadband, or vendor debits.
            </p>

            <form onSubmit={saveGeneralExpense}>
              <div className="grid2">
                <label>
                  Expense Category / Item *
                  <select value={genForm.itemId} onChange={e=>setGenForm({...genForm, itemId:e.target.value})} required>
                    <option value="">-- Select Category --</option>
                    {items.filter(it=>it.active).map(it=>(
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Payment Date (dd-mm-yyyy) *
                  <input type="date" value={genForm.date} onChange={e=>setGenForm({...genForm, date:e.target.value})} required/>
                </label>
              </div>

              <div className="grid2" style={{marginTop:'12px'}}>
                <label>
                  Amount Paid (₹) *
                  <input type="number" min="1" step="any" placeholder="e.g. 25000" value={genForm.amount} onChange={e=>setGenForm({...genForm, amount:e.target.value})} required/>
                </label>

                <label>
                  Payment Mode *
                  <select value={genForm.mode} onChange={e=>setGenForm({...genForm, mode:e.target.value})} required>
                    <option value="online">Net Banking / NEFT / UPI</option>
                    <option value="cash">Direct Cash</option>
                    <option value="cheque">Cheque / Demand Draft</option>
                  </select>
                </label>
              </div>

              <div className="grid2" style={{marginTop:'12px'}}>
                <label>
                  Paid To / Vendor Name
                  <input placeholder="e.g. Property Owner / TNEB Board" value={genForm.paidTo} onChange={e=>setGenForm({...genForm, paidTo:e.target.value})}/>
                </label>

                <label>
                  Bill Receipt / Attachment
                  <input type="file" onChange={e=>handleFileUpload(e, setGenForm)}/>
                  {genForm.attachmentName && <span style={{fontSize:'12px',color:'#0284c7'}}>Attached: {genForm.attachmentName}</span>}
                </label>
              </div>

              <div style={{marginTop:'12px'}}>
                <label>
                  Remarks / Description
                  <textarea rows="2" placeholder="e.g. October 2026 premises rent paid via NEFT" value={genForm.remarks} onChange={e=>setGenForm({...genForm, remarks:e.target.value})}/>
                </label>
              </div>

              <div style={{marginTop:'18px',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Saving...' : 'Save Institutional Payment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Categories Setup */}
        {genTab === 'items' && (
          <div className="card">
            <h3 style={{marginTop:0}}>Expense Categories Catalog</h3>
            <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>
              Add and manage institutional expense heads (Room Rent, EB Bill, Water Supply, Internet, Repairs).
            </p>

            <form onSubmit={addItem} style={{display:'flex',gap:'10px',marginBottom:'20px',maxWidth:'560px'}}>
              <input 
                placeholder="Enter new category name (e.g. Generator Fuel, AC AMC)"
                value={newItemName}
                onChange={e=>setNewItemName(e.target.value)}
                required
              />
              <button type="submit" className="btn" disabled={busy}>+ Add Category</button>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it=>(
                    <tr key={it.id}>
                      <td><b>{it.name}</b></td>
                      <td>
                        <span className={`badge ${it.active?'':'late'}`}>
                          {it.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn sm outline" onClick={()=>toggleItemActive(it)}>
                          {it.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: General Expenses Log */}
        {genTab === 'log' && (
          <div>
            <div className="filter-card">
              <div className="grid-filter">
                <div>
                  <label>From Date <span className="filter-label-format">(dd-mm-yyyy)</span></label>
                  <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)}/>
                </div>
                <div>
                  <label>To Date <span className="filter-label-format">(dd-mm-yyyy)</span></label>
                  <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)}/>
                </div>
                <div>
                  <label>Category Filter</label>
                  <select value={filterItem} onChange={e=>setFilterItem(e.target.value)}>
                    <option value="">All Categories</option>
                    {items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                </div>
                <div>
                  <button type="button" className="btn" onClick={exportGeneralLog}>
                    📥 Export to Excel
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <h3 style={{margin:0}}>General Institutional Expenses Log ({filteredGeneral.length})</h3>
                <b>Total: {inr(sum(filteredGeneral))}</b>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Mode</th>
                      <th>Paid To / Vendor</th>
                      <th>Attachment</th>
                      <th>Remarks</th>
                      <th>Logged By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGeneral.length === 0 ? (
                      <tr><td colSpan="8" style={{textAlign:'center',padding:'20px'}}>No records found for the selected filter.</td></tr>
                    ) : (
                      filteredGeneral.map(e=>(
                        <tr key={e.id}>
                          <td><b>{toDmy(e.date)}</b></td>
                          <td>{e.itemName}</td>
                          <td><b style={{color:'var(--red)'}}>{inr(e.amount)}</b></td>
                          <td><span className="badge">{e.mode.toUpperCase()}</span></td>
                          <td>{e.paidTo || '-'}</td>
                          <td>{e.attachmentName ? <span style={{color:'#0284c7'}}>📎 {e.attachmentName}</span> : '-'}</td>
                          <td><small>{e.remarks || '-'}</small></td>
                          <td><small>{e.createdBy || '-'}</small></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  /* =========================================================================================
     VIEW 3: PETTY CASH SUB-MODULE (Imprest Cycles: ₹20k Float, Spendings, Return & Re-issue)
     ========================================================================================= */
  return (
    <div className="parent-card">
      {/* Header */}
      <div className="parent-card-header">
        <div>
          <h2>🪙 Petty Cash Imprest & Cycle Management</h2>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            Fixed Imprest system: ₹20,000 float given to office boy. Daily micro-expenses deducted. Leftover balance returned to Admin and fresh ₹20,000 re-issued.
          </p>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <button type="button" className="btn sm outline" onClick={()=>setSection(null)}>
            ← Back to Expense Hub
          </button>
          <span className="badge">Role: {me.role}</span>
        </div>
      </div>

      {/* Active Imprest Cycle Live Status Bar */}
      <div className="card" style={{
        background: activeCycleBalanceInHand < 2000 
          ? 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)' 
          : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        borderColor: activeCycleBalanceInHand < 2000 ? '#fca5a5' : '#86efac',
        marginBottom:'20px',
        padding:'20px'
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'14px'}}>
          <div>
            <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
              <span className="badge" style={{background:'#0b2447',color:'#fff',fontSize:'12px'}}>
                {activeCycle ? `CYCLE #${activeCycle.cycleNumber} (ACTIVE)` : 'NO ACTIVE CYCLE'}
              </span>
              {activeCycle && (
                <span className="muted" style={{fontSize:'12px'}}>
                  Started: <b>{toDmy(activeCycle.startDate)}</b> | Custodian: <b>{activeCycle.custodianName}</b>
                </span>
              )}
            </div>
            <div style={{fontSize:'13px',color:'#1e293b'}}>
              Standard Imprest Float: <b>{inr(activeCycleFloat)}</b> &nbsp;|&nbsp; 
              Vouchers Spent so far: <b style={{color:'var(--red)'}}>{inr(activeCycleSpent)}</b>
            </div>
          </div>

          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.5px',color:'#475569',fontWeight:'700'}}>
              Cash in Hand with Office Boy
            </div>
            <div style={{fontSize:'28px',fontWeight:'800',color:activeCycleBalanceInHand < 2000 ? 'var(--red)' : '#166534'}}>
              {inr(activeCycleBalanceInHand)}
            </div>
            {activeCycleBalanceInHand < 2000 && (
              <span className="count-tag" style={{background:'#dc2626',color:'#fff',marginTop:'4px'}}>
                ⚠️ Low Balance - Ready for Return & Settlement
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Petty Cash Navigation Tabs */}
      <div style={{display:'flex',gap:'8px',marginBottom:'18px',borderBottom:'1.5px solid var(--border)',paddingBottom:'10px',flexWrap:'wrap'}}>
        {!isReportsOnly && (
          <button className={`btn sm ${pettyTab==='voucher'?'':'outline'}`} onClick={()=>setPettyTab('voucher')}>
            📝 Record Petty Cash Voucher
          </button>
        )}
        {!isReportsOnly && (
          <button className={`btn sm ${pettyTab==='return'?'':'outline'}`} onClick={()=>setPettyTab('return')} style={{borderColor:'#d97706'}}>
            🔄 Return Balance & Settle Cycle
          </button>
        )}
        <button className={`btn sm ${pettyTab==='cycles_report'?'':'outline'}`} onClick={()=>setPettyTab('cycles_report')}>
          📊 Petty Cash Cycles Audit Report ({cycles.length})
        </button>
        <button className={`btn sm ${pettyTab==='vouchers_log'?'':'outline'}`} onClick={()=>setPettyTab('vouchers_log')}>
          📑 All Petty Vouchers ({pettyExpenses.length})
        </button>
        {!isReportsOnly && can(me, 'petty_cash_disburse') && (
          <button className={`btn sm ${pettyTab==='disburse'?'':'outline'}`} onClick={()=>setPettyTab('disburse')}>
            ➕ Issue Fresh Imprest Float
          </button>
        )}
      </div>

      {msg && <div style={{background:'#dcfce7',color:'#166534',padding:'12px 16px',borderRadius:'8px',marginBottom:'14px',fontWeight:'600'}}>{msg}</div>}
      {err && <div className="err" style={{marginBottom:'14px'}}>{err}</div>}

      {/* ===================================================================
          TAB 1: Record Petty Cash Voucher (Tea, Coffee, Supplies, Petrol)
          =================================================================== */}
      {pettyTab === 'voucher' && (
        <div className="card" style={{maxWidth:'800px',margin:'0 auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <h3 style={{margin:0}}>Record Daily Petty Cash Voucher</h3>
            <span className="badge">Active Balance: {inr(activeCycleBalanceInHand)}</span>
          </div>
          <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>
            Record office boy daily disbursements (tea, coffee, cleaner, stationery, car petrol, courier) deducting from the active Imprest cycle.
          </p>

          <form onSubmit={savePettyVoucher}>
            <div className="grid2">
              <label>
                Petty Expense Item *
                <select value={voucherForm.itemId} onChange={e=>setVoucherForm({...voucherForm, itemId:e.target.value})} required>
                  <option value="">-- Select Expense Item --</option>
                  {items.filter(it=>it.active).map(it=>(
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Voucher Date (dd-mm-yyyy) *
                <input type="date" value={voucherForm.date} onChange={e=>setVoucherForm({...voucherForm, date:e.target.value})} required/>
              </label>
            </div>

            <div className="grid2" style={{marginTop:'12px'}}>
              <label>
                Amount (₹) *
                <input 
                  type="number" 
                  min="1" 
                  step="any" 
                  placeholder="e.g. 480 or 4000" 
                  value={voucherForm.amount} 
                  onChange={e=>setVoucherForm({...voucherForm, amount:e.target.value})} 
                  required
                />
                {Number(voucherForm.amount) > activeCycleBalanceInHand && (
                  <span style={{color:'var(--red)',fontSize:'12px',fontWeight:'bold',display:'block',marginTop:'4px'}}>
                    ⚠️ Exceeds cash in hand ({inr(activeCycleBalanceInHand)})! Return remaining balance to Admin first.
                  </span>
                )}
              </label>

              <label>
                Paid To / Vendor
                <input placeholder="e.g. Anand Tea Stall / HP Petrol Bunk" value={voucherForm.paidTo} onChange={e=>setVoucherForm({...voucherForm, paidTo:e.target.value})}/>
              </label>
            </div>

            <div className="grid2" style={{marginTop:'12px'}}>
              <label>
                Bill Receipt / Voucher Attachment
                <input type="file" onChange={e=>handleFileUpload(e, setVoucherForm)}/>
                {voucherForm.attachmentName && <span style={{fontSize:'12px',color:'#0284c7'}}>Attached: {voucherForm.attachmentName}</span>}
              </label>

              <label>
                Deducted From Cycle
                <input 
                  type="text" 
                  disabled 
                  value={activeCycle ? `Cycle #${activeCycle.cycleNumber} (${activeCycle.custodianName})` : 'No active cycle!'}
                  style={{background:'#f1f5fa'}}
                />
              </label>
            </div>

            <div style={{marginTop:'12px'}}>
              <label>
                Remarks / Purpose
                <textarea 
                  rows="2" 
                  placeholder="e.g. Car petrol full tank for academy visit / Weekly tea & refreshments" 
                  value={voucherForm.remarks} 
                  onChange={e=>setVoucherForm({...voucherForm, remarks:e.target.value})}
                />
              </label>
            </div>

            <div style={{marginTop:'18px',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
              <button 
                type="submit" 
                className="btn" 
                disabled={busy || Number(voucherForm.amount) > activeCycleBalanceInHand || !activeCycle}
              >
                {busy ? 'Recording...' : 'Record Petty Cash Voucher'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================
          TAB 2: RETURN BALANCE & SETTLE CYCLE (The User's Exact Workflow)
          =================================================================== */}
      {pettyTab === 'return' && (
        <div className="card" style={{maxWidth:'850px',margin:'0 auto'}}>
          <div style={{background:'#eef4ff',border:'1.5px solid #c7d8f9',borderRadius:'8px',padding:'14px',marginBottom:'18px'}}>
            <b style={{color:'#0b2447',fontSize:'15px'}}>🔄 Cycle Settlement & Float Re-issuance Protocol</b>
            <p style={{margin:'6px 0 0',fontSize:'13px',color:'#1e293b',lineHeight:'1.5'}}>
              <b>Example:</b> Office boy was given <b>₹20,000</b> on 01/10/2026. Daily spendings total <b>₹18,500</b>, leaving <b>₹1,500</b> in hand.
              Now on 26/10/2026 he needs to pay <b>₹4,000</b> for Car Petrol. Because ₹1,500 is insufficient, he returns the remaining ₹1,500 to Admin.
              Once settled, Admin immediately issues fresh <b>₹20,000</b> so he can pay the ₹4,000 petrol expense under the new cycle!
            </p>
          </div>

          {!activeCycle ? (
            <div style={{textAlign:'center',padding:'30px'}}>
              <h3>No Active Cycle Found</h3>
              <p className="muted">All previous cycles have been closed. Please issue a fresh Imprest float to start a new cycle.</p>
              <button type="button" className="btn" onClick={()=>setPettyTab('disburse')}>Issue Fresh Float (₹20,000)</button>
            </div>
          ) : (
            <form onSubmit={saveReturnAndSettle}>
              <div style={{background:'#f8fafd',border:'1px solid #cbd5e1',borderRadius:'8px',padding:'14px',marginBottom:'16px'}}>
                <h4 style={{margin:'0 0 10px',color:'#0b2447'}}>Settling Active Cycle #{activeCycle.cycleNumber}</h4>
                <div className="grid" style={{fontSize:'13px'}}>
                  <div>Start Date: <b>{toDmy(activeCycle.startDate)}</b></div>
                  <div>Initial Float: <b>{inr(activeCycle.imprestAmount)}</b></div>
                  <div>Total Spent: <b style={{color:'var(--red)'}}>{inr(activeCycleSpent)}</b></div>
                  <div>Calculated Remaining: <b style={{color:'var(--grn)'}}>{inr(activeCycleBalanceInHand)}</b></div>
                </div>
              </div>

              <div className="grid2">
                <label>
                  Return Date (dd-mm-yyyy) *
                  <input type="date" value={returnForm.date} onChange={e=>setReturnForm({...returnForm, date:e.target.value})} required/>
                </label>

                <label>
                  Remaining Balance Amount Returned (₹) *
                  <input 
                    type="number" 
                    min="0" 
                    step="any" 
                    placeholder="e.g. 1500" 
                    value={returnForm.amount} 
                    onChange={e=>setReturnForm({...returnForm, amount:e.target.value})} 
                    required
                  />
                  <small className="muted">Default filled with unspent balance ({inr(activeCycleBalanceInHand)})</small>
                </label>
              </div>

              <div className="grid2" style={{marginTop:'12px'}}>
                <label>
                  Returned By (Office Staff) *
                  <input value={returnForm.returnedBy} onChange={e=>setReturnForm({...returnForm, returnedBy:e.target.value})} required/>
                </label>

                <label>
                  Received By (Admin / Manager) *
                  <input value={returnForm.receivedBy} onChange={e=>setReturnForm({...returnForm, receivedBy:e.target.value})} required/>
                </label>
              </div>

              <div style={{marginTop:'12px'}}>
                <label>
                  Settlement Remarks / Audit Note
                  <textarea rows="2" value={returnForm.remarks} onChange={e=>setReturnForm({...returnForm, remarks:e.target.value})}/>
                </label>
              </div>

              {/* Automatic Fresh ₹20,000 Float Re-issuance Checkbox */}
              <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:'8px',padding:'14px',marginTop:'18px'}}>
                <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontSize:'14px',color:'#166534',fontWeight:'700'}}>
                  <input 
                    type="checkbox" 
                    style={{width:'18px',height:'18px',margin:0}} 
                    checked={returnForm.autoReissue} 
                    onChange={e=>setReturnForm({...returnForm, autoReissue:e.target.checked})}
                  />
                  <span>Immediately issue fresh Imprest Float of ₹20,000 for Next Cycle #{ (activeCycle.cycleNumber || 1) + 1 }</span>
                </label>

                {returnForm.autoReissue && (
                  <div className="grid2" style={{marginTop:'10px'}}>
                    <label>
                      Fresh Imprest Amount (₹)
                      <input 
                        type="number" 
                        min="1000" 
                        step="any" 
                        value={returnForm.reissueAmount} 
                        onChange={e=>setReturnForm({...returnForm, reissueAmount:e.target.value})} 
                        required
                      />
                    </label>
                    <label>
                      Handed Over To (Office Staff)
                      <input 
                        value={returnForm.reissueGivenTo} 
                        onChange={e=>setReturnForm({...returnForm, reissueGivenTo:e.target.value})} 
                        required
                      />
                    </label>
                  </div>
                )}
              </div>

              <div style={{marginTop:'20px',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
                <button type="submit" className="btn" disabled={busy} style={{background:'#0b2447'}}>
                  {busy ? 'Processing Settlement...' : `Confirm Return of ${inr(returnForm.amount)} & Settle Cycle`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ===================================================================
          TAB 3: PETTY CASH CYCLES AUDIT REPORT (Cycle 1 vs Cycle 2)
          =================================================================== */}
      {pettyTab === 'cycles_report' && (
        <div>
          <div className="card" style={{marginBottom:'16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'10px'}}>
              <div>
                <h3 style={{margin:0}}>Petty Cash Imprest Cycles Audit History</h3>
                <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
                  Reconciliation of every ₹20,000 float: Given ➔ Vouchers Spent ➔ Returned ➔ Discrepancy (₹0).
                </p>
              </div>
              <button type="button" className="btn" onClick={exportPettyCyclesLog}>
                📥 Export Cycles Audit to Excel
              </button>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th>Period</th>
                    <th>Custodian</th>
                    <th>Imprest Given</th>
                    <th>Vouchers Spent</th>
                    <th>Returned to Admin</th>
                    <th>Audit Discrepancy</th>
                    <th>Cycle Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCycles.map(c=>{
                    const cycleVouchers = pettyExpenses.filter(e => e.cycleId === c.id || (!e.cycleId && e.date >= c.startDate && (!c.endDate || e.date <= c.endDate)));
                    const cycleSpent = sum(cycleVouchers);
                    const returned = Number(c.returnedAmount || 0);
                    const floatAmt = Number(c.imprestAmount || 0);
                    const isClosed = c.status === 'closed';
                    const discrepancy = isClosed ? (floatAmt - (cycleSpent + returned)) : 0;
                    const inHand = Math.max(0, floatAmt - cycleSpent);

                    return (
                      <tr key={c.id}>
                        <td><b>Cycle #{c.cycleNumber}</b></td>
                        <td>
                          <b>{toDmy(c.startDate)}</b> to {c.endDate ? <b>{toDmy(c.endDate)}</b> : <span className="badge" style={{background:'#dcfce7',color:'#166534'}}>Running</span>}
                        </td>
                        <td>{c.custodianName}</td>
                        <td><b>{inr(floatAmt)}</b></td>
                        <td><b style={{color:'var(--red)'}}>{inr(cycleSpent)}</b></td>
                        <td>
                          {isClosed ? <b style={{color:'#0284c7'}}>{inr(returned)}</b> : <span className="muted">-</span>}
                        </td>
                        <td>
                          {isClosed ? (
                            discrepancy === 0 ? (
                              <span className="badge" style={{background:'#dcfce7',color:'#166534'}}>✅ Balanced (₹0)</span>
                            ) : (
                              <span className="badge late">⚠️ Discrepancy {inr(discrepancy)}</span>
                            )
                          ) : (
                            <span className="muted">In progress</span>
                          )}
                        </td>
                        <td>
                          {isClosed ? (
                            <span className="badge">SETTLED & CLOSED</span>
                          ) : (
                            <span className="badge" style={{background:'#dcfce7',color:'#166534',fontWeight:'700'}}>
                              ACTIVE ({inr(inHand)} in hand)
                            </span>
                          )}
                        </td>
                        <td>
                          <button 
                            type="button" 
                            className="btn sm outline"
                            onClick={()=>setSelectedCycleVouchers({cycle:c, vouchers:cycleVouchers})}
                          >
                            View {cycleVouchers.length} Vouchers
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal / Panel: View Vouchers for selected cycle */}
          {selectedCycleVouchers && (
            <div className="card" style={{marginTop:'20px',border:'2px solid var(--navy2)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <h3 style={{margin:0}}>
                  🧾 Vouchers for Cycle #{selectedCycleVouchers.cycle.cycleNumber} ({toDmy(selectedCycleVouchers.cycle.startDate)} to {selectedCycleVouchers.cycle.endDate ? toDmy(selectedCycleVouchers.cycle.endDate) : 'Active'})
                </h3>
                <button type="button" className="btn sm" onClick={()=>setSelectedCycleVouchers(null)}>✕ Close</button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item / Category</th>
                      <th>Amount</th>
                      <th>Paid To / Vendor</th>
                      <th>Attachment</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCycleVouchers.vouchers.length === 0 ? (
                      <tr><td colSpan="6" style={{textAlign:'center',padding:'16px'}}>No vouchers recorded under this cycle yet.</td></tr>
                    ) : (
                      selectedCycleVouchers.vouchers.map(v=>(
                        <tr key={v.id}>
                          <td><b>{toDmy(v.date)}</b></td>
                          <td>{v.itemName}</td>
                          <td><b style={{color:'var(--red)'}}>{inr(v.amount)}</b></td>
                          <td>{v.paidTo || '-'}</td>
                          <td>{v.attachmentName ? <span style={{color:'#0284c7'}}>📎 {v.attachmentName}</span> : '-'}</td>
                          <td><small>{v.remarks || '-'}</small></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          TAB 4: ALL PETTY VOUCHERS LOG
          =================================================================== */}
      {pettyTab === 'vouchers_log' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <h3 style={{margin:0}}>All Petty Cash Vouchers History ({pettyExpenses.length})</h3>
            <b>Total Spent All-Time: {inr(totalPettySpentAllTime)}</b>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Cycle</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Paid To</th>
                  <th>Attachment</th>
                  <th>Remarks</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {pettyExpenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>(
                  <tr key={e.id}>
                    <td><b>{toDmy(e.date)}</b></td>
                    <td><span className="badge">Cycle #{e.cycleNumber || 1}</span></td>
                    <td>{e.itemName}</td>
                    <td><b style={{color:'var(--red)'}}>{inr(e.amount)}</b></td>
                    <td>{e.paidTo || '-'}</td>
                    <td>{e.attachmentName ? <span style={{color:'#0284c7'}}>📎 {e.attachmentName}</span> : '-'}</td>
                    <td><small>{e.remarks || '-'}</small></td>
                    <td><small>{e.createdBy || '-'}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 5: MANUAL DISBURSE FLOAT (Admin)
          =================================================================== */}
      {pettyTab === 'disburse' && (
        <div className="card" style={{maxWidth:'700px',margin:'0 auto'}}>
          <h3 style={{marginTop:0}}>Issue Fresh Petty Cash Float</h3>
          <p className="muted" style={{fontSize:'13px',marginBottom:'16px'}}>
            Issue standard Imprest float (₹20,000) to office boy/staff to initiate a new cycle.
          </p>

          <form onSubmit={saveManualDisburse}>
            <div className="grid2">
              <label>
                Disbursement Date (dd-mm-yyyy) *
                <input type="date" value={disburseForm.date} onChange={e=>setDisburseForm({...disburseForm, date:e.target.value})} required/>
              </label>

              <label>
                Float Amount (₹) *
                <input 
                  type="number" 
                  min="1000" 
                  step="any" 
                  value={disburseForm.amount} 
                  onChange={e=>setDisburseForm({...disburseForm, amount:e.target.value})} 
                  required
                />
              </label>
            </div>

            <div className="grid2" style={{marginTop:'12px'}}>
              <label>
                Staff / Custodian Name *
                <input value={disburseForm.givenTo} onChange={e=>setDisburseForm({...disburseForm, givenTo:e.target.value})} required/>
              </label>

              <label>
                Disbursement Mode *
                <select value={disburseForm.mode} onChange={e=>setDisburseForm({...disburseForm, mode:e.target.value})} required>
                  <option value="cash">Direct Cash Handover</option>
                  <option value="online">Bank Transfer / UPI</option>
                </select>
              </label>
            </div>

            <div style={{marginTop:'12px'}}>
              <label>
                Remarks
                <textarea rows="2" value={disburseForm.remarks} onChange={e=>setDisburseForm({...disburseForm, remarks:e.target.value})}/>
              </label>
            </div>

            <div style={{marginTop:'18px',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Issuing...' : `Issue Imprest Float of ${inr(disburseForm.amount)}`}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
