import {useCallback,useEffect,useState} from 'react';
import {collection,doc,getDocs,query,where,serverTimestamp,writeBatch} from 'firebase/firestore';
import {db} from '../firebase';
import {today,inr,calcBalance,toDmy} from '../util';
import {printReceipt} from '../receipt';

function Pay({s,me,onDone}){
  const [h,setH]=useState([]);
  const [f,setF]=useState({amount:'',mode:'cash',transId:'',nextDueDate:'',remarks:''});
  const [err,setErr]=useState('');

  useEffect(()=>{
    getDocs(query(collection(db,'payments'),where('studentId','==',s.id))).then(r=>
      setH(r.docs.map(d=>d.data()).sort((a,b)=>a.date.localeCompare(b.date)))
    );
  },[s.id]);

  const set=k=>e=>setF({...f,[k]:e.target.value});
  const amt=Number(f.amount)||0;
  const left=calcBalance(s.balance,amt);

  const save=async e=>{
    e.preventDefault();
    setErr('');
    if(amt<=0||amt>s.balance) return setErr(`Amount must be between 1 and ${s.balance}.`);
    if(f.mode==='online'&&!f.transId.trim()) return setErr('Transaction ID is mandatory for online payment.');
    if(left>0&&!f.nextDueDate) return setErr('Enter the next due date.');
    try{
      const b=writeBatch(db),pr=doc(collection(db,'payments')),paid=s.totalPaid+amt;
      b.set(pr,{studentId:s.id,studentName:s.name,courseId:s.courseId,courseName:s.courseName,date:today(),amount:amt,mode:f.mode,
        transId:f.mode==='online'?f.transId.trim():'',nextDueDate:left>0?f.nextDueDate:'',remarks:f.remarks,createdBy:me.name,createdAt:serverTimestamp()});
      b.update(doc(db,'students',s.id),{totalPaid:paid,balance:left,nextDueDate:left>0?f.nextDueDate:'',remarks:f.remarks||s.remarks});
      await b.commit();
      printReceipt({...s,amount:amt,mode:f.mode,transId:f.transId,date:today(),totalPaid:paid,balance:left,nextDueDate:left>0?f.nextDueDate:''});
      onDone();
    }catch(x){setErr(x.message);}
  };

  return (
    <div className="sub-card" style={{border:'2px solid var(--navy)',background:'#fff',marginTop:'20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'1px solid #e2e8f0',paddingBottom:'10px',marginBottom:'12px'}}>
        <div>
          <h3 style={{margin:0,color:'var(--navy)'}}>{s.name} <span className="muted">– {s.courseName}</span></h3>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            Father: <b>{s.fatherName}</b> | Mobile: <span className="mobile-badge">📞 {s.mobile}</span>
          </p>
        </div>
        <button className="btn sm outline" onClick={onDone}>✕ Close</button>
      </div>

      <div style={{display:'flex',gap:'16px',flexWrap:'wrap',marginBottom:'14px',fontSize:'13px',background:'#f8fafd',padding:'10px',borderRadius:'6px'}}>
        <div>Net Fee: <b>{inr(s.netFee)}</b></div>
        <div>Total Paid: <b style={{color:'var(--grn)'}}>{inr(s.totalPaid)}</b></div>
        <div>Remaining Balance: <b className="err">{inr(s.balance)}</b></div>
        <div>Next Due: <b>{toDmy(s.nextDueDate)}</b></div>
      </div>

      <h4 style={{margin:'14px 0 8px'}}>Payment History</h4>
      <div className="wrap" style={{marginBottom:'16px'}}>
        <table>
          <thead>
            <tr><th>Date</th><th>Amount</th><th>Mode</th><th>Trans ID</th><th>Remarks</th></tr>
          </thead>
          <tbody>
            {h.map((p,i)=>(
              <tr key={i}>
                <td>{toDmy(p.date)}</td>
                <td style={{fontWeight:600}}>{inr(p.amount)}</td>
                <td style={{textTransform:'capitalize'}}>{p.mode}</td>
                <td>{p.transId||'-'}</td>
                <td>{p.remarks||'-'}</td>
              </tr>
            ))}
            {!h.length&&<tr><td colSpan={5} className="muted">No payment logs found.</td></tr>}
          </tbody>
        </table>
      </div>

      {s.balance>0 && (
        <form onSubmit={save} style={{background:'#f6f9fe',padding:'16px',borderRadius:'8px',border:'1px solid #d0e0f5'}}>
          <h4 style={{margin:'0 0 12px',color:'var(--navy)'}}>💳 Collect Installment Payment</h4>
          <div className="grid2">
            <label>Amount (₹)<input type="number" min="1" max={s.balance} value={f.amount} onChange={set('amount')} placeholder={`Max ${s.balance}`} required/></label>
            <label>Payment Mode
              <select value={f.mode} onChange={set('mode')}>
                <option value="cash">Cash</option>
                <option value="online">Online (UPI / Bank)</option>
              </select>
            </label>
            {f.mode==='online' && <label>Transaction ID *<input value={f.transId} onChange={set('transId')} placeholder="Mandatory for online" required/></label>}
            <label>Next Due Date (dd-mm-yyyy){left>0?' *':''}<input type="date" value={f.nextDueDate} onChange={set('nextDueDate')}/></label>
            <label>Remarks<input value={f.remarks} onChange={set('remarks')} placeholder="Optional note"/></label>
          </div>
          <div style={{margin:'12px 0'}}>
            Remaining after this payment: <b style={{color:left>0?'var(--red)':'var(--grn)',fontSize:'15px'}}>{inr(left)}</b>
          </div>
          {err&&<div className="err">{err}</div>}
          <button className="btn gold">Save & Print Receipt</button>
        </form>
      )}
    </div>
  );
}

export default function Dashboard({me,onBack}){
  const [list,setList]=useState([]);
  const [day,setDay]=useState(null);
  const [sel,setSel]=useState(null);
  const [q,setQ]=useState('');

  const load=useCallback(async()=>{
    const r=await getDocs(collection(db,'students'));
    setList(r.docs.map(d=>({id:d.id,...d.data()})));
    setSel(null);
  },[]);

  useEffect(()=>{load();},[load]);

  const due=list.filter(s=>s.balance>0&&s.nextDueDate&&s.nextDueDate<=today());
  const days={};
  due.forEach(s=>(days[s.nextDueDate]=days[s.nextDueDate]||[]).push(s));
  const keys=Object.keys(days).sort();
  const found=q.length>1?list.filter(s=>(s.name+' '+s.mobile).toLowerCase().includes(q.toLowerCase())):[];

  return (
    <div className="parent-card">
      <div className="parent-card-header">
        <div>
          <h2>📌 Fees Management Dashboard</h2>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            Monitor pending dues, collect subsequent installments, and track receipts
          </p>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          {onBack && <button type="button" className="btn sm outline" onClick={onBack}>← Back to Dashboard Hub</button>}
          <span className="badge">Staff: {me.name}</span>
        </div>
      </div>

      {/* Sub-card 1: Due Today & Earlier */}
      <div className="sub-card">
        <h4 style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>⏰ Fees Due Today & Earlier</span>
          <span className="muted" style={{fontSize:'12px'}}>{due.length} student(s) with dues</span>
        </h4>
        {!keys.length && <p className="muted" style={{margin:'8px 0'}}>No pending dues today or earlier. 🎉</p>}
        <div className="grid">
          {keys.map(k=>(
            <div
              key={k}
              className={'card due'+(k<today()?' late':'')}
              style={{padding:'14px',marginBottom:0}}
              onClick={()=>{setDay(k);setSel(null);}}
            >
              <h3 style={{fontSize:'15px'}}>{toDmy(k)}</h3>
              <div style={{fontWeight:600}}>{days[k].length} student(s)</div>
              <div className="muted">{inr(days[k].reduce((a,s)=>a+s.balance,0))}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Due Day Drilldown */}
      {day && days[day] && (
        <div className="sub-card" style={{border:'1px solid #b8d2f2',background:'#fff'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
            <h4 style={{margin:0,color:'var(--navy)'}}>Students Due on {toDmy(day)}</h4>
            <button className="btn sm outline" onClick={()=>setDay(null)}>Close List</button>
          </div>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Course</th>
                  <th>Mobile Number</th>
                  <th>Remaining Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {days[day].map(s=>(
                  <tr key={s.id}>
                    <td className="student-name-tag">{s.name}</td>
                    <td>{s.courseName}</td>
                    <td><span className="mobile-badge">📞 {s.mobile}</span></td>
                    <td style={{color:'var(--red)',fontWeight:600}}>{inr(s.balance)}</td>
                    <td><button className="btn sm gold" onClick={()=>setSel(s)}>Collect Fees</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-card 2: Search Student */}
      <div className="sub-card">
        <h4>🔍 Search Any Student</h4>
        <label>
          Search by Student Name or Mobile Number
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Type name or 10-digit mobile number..."
          />
        </label>
        {q.length>1 && !found.length && (
          <p className="muted" style={{marginTop:'8px',fontSize:'13px'}}>No student found matching "{q}".</p>
        )}
        {found.map(s=>(
          <div key={s.id} className="row" style={{background:'#fff',padding:'8px 12px',borderRadius:'6px',border:'1px solid #e2e8f0'}}>
            <span><b>{s.name}</b></span>
            <span><span className="mobile-badge">📞 {s.mobile}</span></span>
            <span className="muted">{s.courseName}</span>
            <span style={{color:s.balance>0?'var(--red)':'var(--grn)',fontWeight:600}}>
              {s.balance>0?`Pending: ${inr(s.balance)}`:'Fully Paid'}
            </span>
            <button className="btn sm gold" onClick={()=>setSel(s)}>Open</button>
          </div>
        ))}
      </div>

      {/* Sub-card 3: Payment Panel if student selected */}
      {sel && <Pay key={sel.id} s={sel} me={me} onDone={load}/>}
    </div>
  );
}
