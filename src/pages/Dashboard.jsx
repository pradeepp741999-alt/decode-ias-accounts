import {useCallback,useEffect,useState} from 'react';
import {collection,doc,getDocs,query,where,serverTimestamp,writeBatch} from 'firebase/firestore';
import {db} from '../firebase';import {today,inr,calcBalance} from '../util';import {printReceipt} from '../receipt';

function Pay({s,me,onDone}){
  const [h,setH]=useState([]),[f,setF]=useState({amount:'',mode:'cash',transId:'',nextDueDate:'',remarks:''}),[err,setErr]=useState('');
  useEffect(()=>{getDocs(query(collection(db,'payments'),where('studentId','==',s.id))).then(r=>
    setH(r.docs.map(d=>d.data()).sort((a,b)=>a.date.localeCompare(b.date))));},[s.id]);
  const set=k=>e=>setF({...f,[k]:e.target.value}),amt=Number(f.amount)||0,left=calcBalance(s.balance,amt);
  const save=async e=>{e.preventDefault();setErr('');
    if(amt<=0||amt>s.balance)return setErr(`Amount must be between 1 and ${s.balance}.`);
    if(f.mode==='online'&&!f.transId.trim())return setErr('Transaction ID is mandatory for online payment.');
    if(left>0&&!f.nextDueDate)return setErr('Enter the next due date.');
    try{const b=writeBatch(db),pr=doc(collection(db,'payments')),paid=s.totalPaid+amt;
      b.set(pr,{studentId:s.id,studentName:s.name,courseId:s.courseId,courseName:s.courseName,date:today(),amount:amt,mode:f.mode,
        transId:f.mode==='online'?f.transId.trim():'',nextDueDate:left>0?f.nextDueDate:'',remarks:f.remarks,createdBy:me.name,createdAt:serverTimestamp()});
      b.update(doc(db,'students',s.id),{totalPaid:paid,balance:left,nextDueDate:left>0?f.nextDueDate:'',remarks:f.remarks||s.remarks});
      await b.commit();
      printReceipt({...s,amount:amt,mode:f.mode,transId:f.transId,date:today(),totalPaid:paid,balance:left,nextDueDate:left>0?f.nextDueDate:''});
      onDone();}catch(x){setErr(x.message);}};
  return <div className="card"><h3>{s.name} <span className="muted">– {s.courseName}</span></h3>
    <p>Father: {s.fatherName} | Mobile: {s.mobile} | Net fee: {inr(s.netFee)} | Paid: {inr(s.totalPaid)} | <b className="err">Remaining: {inr(s.balance)}</b> | Due: {s.nextDueDate||'-'}</p>
    <div className="wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Trans ID</th><th>Remarks</th></tr></thead>
      <tbody>{h.map((p,i)=><tr key={i}><td>{p.date}</td><td>{inr(p.amount)}</td><td>{p.mode}</td><td>{p.transId}</td><td>{p.remarks}</td></tr>)}</tbody></table></div>
    {s.balance>0&&<form onSubmit={save}><h4>Collect payment</h4><div className="grid2">
      <label>Amount<input type="number" value={f.amount} onChange={set('amount')} required/></label>
      <label>Mode<select value={f.mode} onChange={set('mode')}><option value="cash">Cash</option><option value="online">Online</option></select></label>
      {f.mode==='online'&&<label>Transaction ID *<input value={f.transId} onChange={set('transId')}/></label>}
      <label>Next due date{left>0?' *':''}<input type="date" value={f.nextDueDate} onChange={set('nextDueDate')}/></label>
      <label>Remarks<input value={f.remarks} onChange={set('remarks')}/></label></div>
      <p>Remaining after this payment: <b>{inr(left)}</b></p>{err&&<div className="err">{err}</div>}
      <button className="btn gold">Save & print receipt</button></form>}</div>;
}

export default function Dashboard({me}){
  const [list,setList]=useState([]),[day,setDay]=useState(null),[sel,setSel]=useState(null),[q,setQ]=useState('');
  const load=useCallback(async()=>{const r=await getDocs(collection(db,'students'));setList(r.docs.map(d=>({id:d.id,...d.data()})));setSel(null);},[]);
  useEffect(()=>{load();},[load]);
  const due=list.filter(s=>s.balance>0&&s.nextDueDate&&s.nextDueDate<=today());
  const days={};due.forEach(s=>(days[s.nextDueDate]=days[s.nextDueDate]||[]).push(s));
  const keys=Object.keys(days).sort(),found=q.length>1?list.filter(s=>(s.name+s.mobile).toLowerCase().includes(q.toLowerCase())):[];
  return <div><h2>Fees due today & earlier</h2>
    {!keys.length&&<p className="muted">No pending dues. 🎉</p>}
    <div className="grid">{keys.map(k=><div key={k} className={'card due'+(k<today()?' late':'')} onClick={()=>{setDay(k);setSel(null);}}>
      <h3>{k}</h3><div>{days[k].length} student(s)</div><div className="muted">{inr(days[k].reduce((a,s)=>a+s.balance,0))}</div></div>)}</div>
    {day&&days[day]&&<div className="card"><h3>Due on {day}</h3><div className="wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Mobile</th><th>Remaining</th><th></th></tr></thead>
      <tbody>{days[day].map(s=><tr key={s.id}><td>{s.name}</td><td>{s.courseName}</td><td>{s.mobile}</td><td>{inr(s.balance)}</td>
        <td><button className="btn sm" onClick={()=>setSel(s)}>Open</button></td></tr>)}</tbody></table></div></div>}
    <div className="card"><label>Search any student (name / mobile)<input value={q} onChange={e=>setQ(e.target.value)}/></label>
      {found.map(s=><div key={s.id} className="row"><span>{s.name} – {s.mobile}</span><span>{inr(s.balance)}</span><button className="btn sm" onClick={()=>setSel(s)}>Open</button></div>)}</div>
    {sel&&<Pay key={sel.id} s={sel} me={me} onDone={load}/>}</div>;
}
