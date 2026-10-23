import {useEffect,useState} from 'react';
import {collection,doc,getDocs,serverTimestamp,writeBatch} from 'firebase/firestore';
import {db} from '../firebase';
import {today,calcNet,calcBalance,inr,toDmy} from '../util';
import {printReceipt} from '../receipt';

const blank={date:today(),name:'',fatherName:'',mobile:'',courseId:'',discountAmt:'',mode:'cash',paid:'',transId:'',nextDueDate:'',remarks:''};

export default function Enroll({me,done,onBack}){
  const [courses,setCourses]=useState([]);
  const [f,setF]=useState(blank);
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    getDocs(collection(db,'courses')).then(s=>setCourses(s.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.active)));
  },[]);

  const set=k=>e=>setF({...f,[k]:e.target.value});
  const c=courses.find(x=>x.id===f.courseId);
  const fee=c?.fee||0;
  const discount=Number(f.discountAmt)||0;
  const net=calcNet(fee,discount);
  const paid=Number(f.paid)||0;
  const bal=calcBalance(net,paid);

  const save=async e=>{
    e.preventDefault();
    setErr('');
    if(!c)return setErr('Select a course.');
    if(discount>fee)return setErr(`Discount amount cannot exceed course fee (${inr(fee)}).`);
    if(paid<=0)return setErr('Enter the amount paid now.');
    if(paid>net)return setErr('Paid amount is more than the net fee.');
    if(f.mode==='online'&&!f.transId.trim())return setErr('Transaction ID is mandatory for online payment.');
    if(bal>0&&!f.nextDueDate)return setErr('Enter the next due date for the remaining fees.');
    setBusy(true);
    try{
      const b=writeBatch(db),sr=doc(collection(db,'students')),pr=doc(collection(db,'payments'));
      const s={
        date:f.date,
        name:f.name.trim(),
        fatherName:f.fatherName.trim(),
        mobile:f.mobile.trim(),
        courseId:c.id,
        courseName:c.name,
        courseFee:fee,
        discountAmt:discount,
        discountPct:fee>0?Math.round((discount/fee)*100):0,
        netFee:net,
        totalPaid:paid,
        balance:bal,
        nextDueDate:bal>0?f.nextDueDate:'',
        remarks:f.remarks,
        createdBy:me.name,
        createdAt:serverTimestamp()
      };
      b.set(sr,s);
      b.set(pr,{
        studentId:sr.id,
        studentName:s.name,
        courseId:c.id,
        courseName:c.name,
        date:f.date,
        amount:paid,
        mode:f.mode,
        transId:f.mode==='online'?f.transId.trim():'',
        nextDueDate:s.nextDueDate,
        remarks:f.remarks,
        createdBy:me.name,
        createdAt:serverTimestamp()
      });
      await b.commit();
      printReceipt({...s,amount:paid,mode:f.mode,transId:f.transId,date:f.date,courseFee:fee,discountAmt:discount});
      setF(blank);done&&done();
    }catch(x){setErr('Save failed: '+x.message);}
    setBusy(false);
  };

  return (
    <div className="parent-card">
      <div className="parent-card-header">
        <div>
          <h2>📝 Student Fees Entry</h2>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            Enrol new admission, register first installment, and generate receipt
          </p>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          {onBack && <button type="button" className="btn sm outline" onClick={onBack}>← Back to Dashboard Hub</button>}
          <span className="badge">New Admission</span>
        </div>
      </div>

      <form onSubmit={save}>
        {/* Sub-card 1: Student Information */}
        <div className="sub-card">
          <h4>👤 1. Student & Course Information</h4>
          <div className="grid2">
            <label>Admission Date (dd-mm-yyyy)<input type="date" value={f.date} onChange={set('date')} required/></label>
            <label>Student Full Name<input value={f.name} onChange={set('name')} placeholder="e.g. Ramesh Kumar" required/></label>
            <label>Father's Name<input value={f.fatherName} onChange={set('fatherName')} placeholder="e.g. P. Kumar" required/></label>
            <label>Mobile Number (10 digits)<input value={f.mobile} onChange={set('mobile')} pattern="[0-9]{10}" title="10 digit mobile" placeholder="e.g. 9876543210" required/></label>
            <label>Course Name
              <select value={f.courseId} onChange={set('courseId')} required>
                <option value="">Select Course</option>
                {courses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>Base Course Fee<input value={fee?inr(fee):'Select a course'} readOnly style={{background:'#edf2f7',fontWeight:600}}/></label>
            <label>
              Discount Amount (₹)
              <input
                type="number"
                min="0"
                max={fee||undefined}
                value={f.discountAmt}
                onChange={set('discountAmt')}
                placeholder="e.g. 1000, 2000"
              />
            </label>
          </div>
        </div>

        {/* Sub-card 2: Payment Details */}
        <div className="sub-card">
          <h4>💳 2. Payment & Due Details</h4>
          <div className="grid2">
            <label>Payment Mode
              <select value={f.mode} onChange={set('mode')}>
                <option value="cash">Cash</option>
                <option value="online">Online (UPI / Bank Transfer)</option>
              </select>
            </label>
            <label>Amount Paid Now<input type="number" min="1" value={f.paid} onChange={set('paid')} placeholder="Enter amount" required/></label>
            {f.mode==='online' && (
              <label>Transaction ID *<input value={f.transId} onChange={set('transId')} placeholder="e.g. UPI / UTR number" required/></label>
            )}
            <label>Next Due Date (for balance)<input type="date" value={f.nextDueDate} onChange={set('nextDueDate')}/></label>
            <label>Remarks / Notes<input value={f.remarks} onChange={set('remarks')} placeholder="Optional notes"/></label>
          </div>
        </div>

        {/* Sub-card 3: Fee Calculation Summary */}
        <div className="sub-card" style={{border:'2px solid var(--navy)',background:'#ffffff',boxShadow:'0 4px 14px rgba(11,36,71,0.08)'}}>
          <h4 style={{color:'var(--navy)',borderBottomColor:'var(--navy)'}}>💰 3. Live Fees Calculation</h4>
          <div className="grid" style={{marginTop:'12px'}}>
            <div style={{background:'#f8fafc',padding:'12px',borderRadius:'8px',border:'1.5px solid #cbd5e1'}}>
              <span className="muted" style={{fontSize:'12px',display:'block',fontWeight:600}}>Base Course Fee</span>
              <b style={{fontSize:'18px',color:'#1e293b'}}>{inr(fee)}</b>
            </div>
            {discount > 0 && (
              <div style={{background:'#fefce8',padding:'12px',borderRadius:'8px',border:'1.5px solid #fef08a'}}>
                <span style={{fontSize:'12px',display:'block',color:'#854d0e',fontWeight:600}}>Discount Applied</span>
                <b style={{fontSize:'18px',color:'#ca8a04'}}>-{inr(discount)}</b>
              </div>
            )}
            <div style={{background:'#f0fdf4',padding:'12px',borderRadius:'8px',border:'1.5px solid #bbf7d0'}}>
              <span style={{fontSize:'12px',display:'block',color:'#166534',fontWeight:600}}>Net Fee (Payable)</span>
              <b style={{fontSize:'18px',color:'var(--navy)'}}>{inr(net)}</b>
            </div>
            <div style={{background:'#f0fdf4',padding:'12px',borderRadius:'8px',border:'1.5px solid #bbf7d0'}}>
              <span style={{fontSize:'12px',display:'block',color:'#166534',fontWeight:600}}>Paid Now</span>
              <b style={{fontSize:'18px',color:'var(--grn)'}}>{inr(paid)}</b>
            </div>
            <div style={{background:bal>0?'#fff5f5':'#f0fdf4',padding:'12px',borderRadius:'8px',border:`1.5px solid ${bal>0?'#fecaca':'#bbf7d0'}`}}>
              <span style={{fontSize:'12px',display:'block',color:bal>0?'#991b1b':'#166534',fontWeight:600}}>
                Remaining Balance {bal>0&&f.nextDueDate?`(Due: ${toDmy(f.nextDueDate)})`:''}
              </span>
              <b style={{fontSize:'18px',color:bal>0?'var(--red)':'var(--grn)'}}>{inr(bal)}</b>
            </div>
          </div>
        </div>

        {err && <div className="err" style={{background:'#fdeeed',padding:'10px 14px',borderRadius:'6px',border:'1px solid #f5c2c7'}}>{err}</div>}

        <div style={{marginTop:'16px',display:'flex',gap:'10px'}}>
          <button className="btn gold" disabled={busy} style={{padding:'12px 24px',fontSize:'15px'}}>
            {busy?'Saving…':'💾 Save Entry & Print Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}
