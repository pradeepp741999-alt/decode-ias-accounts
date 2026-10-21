import {useEffect,useState} from 'react';
import {collection,doc,getDocs,serverTimestamp,writeBatch} from 'firebase/firestore';
import {db} from '../firebase';import {today,calcNet,calcBalance,inr} from '../util';import {printReceipt} from '../receipt';
const blank={date:today(),name:'',fatherName:'',mobile:'',courseId:'',discountPct:0,mode:'cash',paid:'',transId:'',nextDueDate:'',remarks:''};
export default function Enroll({me,done}){
  const [courses,setCourses]=useState([]),[f,setF]=useState(blank),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{getDocs(collection(db,'courses')).then(s=>setCourses(s.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.active)));},[]);
  const set=k=>e=>setF({...f,[k]:e.target.value});
  const c=courses.find(x=>x.id===f.courseId),fee=c?.fee||0,net=calcNet(fee,f.discountPct),paid=Number(f.paid)||0,bal=calcBalance(net,paid);
  const save=async e=>{e.preventDefault();setErr('');
    if(!c)return setErr('Select a course.');
    if(paid<=0)return setErr('Enter the amount paid now.');
    if(paid>net)return setErr('Paid amount is more than the net fee.');
    if(f.mode==='online'&&!f.transId.trim())return setErr('Transaction ID is mandatory for online payment.');
    if(bal>0&&!f.nextDueDate)return setErr('Enter the next due date for the remaining fees.');
    setBusy(true);
    try{
      const b=writeBatch(db),sr=doc(collection(db,'students')),pr=doc(collection(db,'payments'));
      const s={date:f.date,name:f.name.trim(),fatherName:f.fatherName.trim(),mobile:f.mobile.trim(),courseId:c.id,courseName:c.name,
        courseFee:fee,discountPct:Number(f.discountPct)||0,netFee:net,totalPaid:paid,balance:bal,nextDueDate:bal>0?f.nextDueDate:'',
        remarks:f.remarks,createdBy:me.name,createdAt:serverTimestamp()};
      b.set(sr,s);
      b.set(pr,{studentId:sr.id,studentName:s.name,courseId:c.id,courseName:c.name,date:f.date,amount:paid,mode:f.mode,
        transId:f.mode==='online'?f.transId.trim():'',nextDueDate:s.nextDueDate,remarks:f.remarks,createdBy:me.name,createdAt:serverTimestamp()});
      await b.commit();
      printReceipt({...s,amount:paid,mode:f.mode,transId:f.transId,date:f.date});
      setF(blank);done&&done();
    }catch(x){setErr('Save failed: '+x.message);}setBusy(false);};
  return <form className="card" onSubmit={save}><h2>New student – fees entry</h2>
    <div className="grid2">
      <label>Date<input type="date" value={f.date} onChange={set('date')} required/></label>
      <label>Student name<input value={f.name} onChange={set('name')} required/></label>
      <label>Father name<input value={f.fatherName} onChange={set('fatherName')} required/></label>
      <label>Mobile<input value={f.mobile} onChange={set('mobile')} pattern="[0-9]{10}" title="10 digit mobile" required/></label>
      <label>Course<select value={f.courseId} onChange={set('courseId')} required><option value="">Select</option>
        {courses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Course fee<input value={fee} readOnly/></label>
      <label>Discount %<input type="number" min="0" max="100" value={f.discountPct} onChange={set('discountPct')}/></label>
      <label>Payment mode<select value={f.mode} onChange={set('mode')}><option value="cash">Cash</option><option value="online">Online</option></select></label>
      <label>Amount paid now<input type="number" min="1" value={f.paid} onChange={set('paid')} required/></label>
      {f.mode==='online'&&<label>Transaction ID *<input value={f.transId} onChange={set('transId')}/></label>}
      <label>Next due date (for remaining)<input type="date" value={f.nextDueDate} onChange={set('nextDueDate')}/></label>
      <label>Remarks<input value={f.remarks} onChange={set('remarks')}/></label>
    </div>
    <p><b>Total fee after discount: {inr(net)}</b> &nbsp; Paid: {inr(paid)} &nbsp; <span className={bal>0?'err':'ok'}>Remaining: {inr(bal)}</span></p>
    {err&&<div className="err">{err}</div>}<button className="btn gold" disabled={busy}>{busy?'Saving…':'Save & print receipt'}</button></form>;
}
