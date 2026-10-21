import {useEffect,useState} from 'react';
import {collection,getDocs} from 'firebase/firestore';
import {db} from '../firebase';import {today,inr,exportXlsx} from '../util';

export default function Reports(){
  const [S,setS]=useState([]),[P,setP]=useState([]),[tab,setTab]=useState('sum'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[course,setCourse]=useState('');
  useEffect(()=>{getDocs(collection(db,'students')).then(r=>setS(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'payments')).then(r=>setP(r.docs.map(d=>({id:d.id,...d.data()}))));},[]);
  const inR=d=>(!from||d>=from)&&(!to||d<=to);
  const st=S.filter(s=>inR(s.date)&&(!course||s.courseId===course)),pay=P.filter(p=>inR(p.date)&&(!course||p.courseId===course));
  const courses=[...new Map(S.map(s=>[s.courseId,s.courseName]))];
  const sum=a=>a.reduce((x,y)=>x+y,0),T={fee:sum(st.map(s=>s.netFee)),paid:sum(st.map(s=>s.totalPaid)),bal:sum(st.map(s=>s.balance))};
  const byCourse=courses.map(([id,name])=>{const x=st.filter(s=>s.courseId===id);
    return {Course:name,'No. of Students':x.length,'Student Names':x.map(s=>s.name).join(', '),'Total Fee':sum(x.map(s=>s.netFee)),Collected:sum(x.map(s=>s.totalPaid)),Pending:sum(x.map(s=>s.balance))};}).filter(r=>r['No. of Students']);
  const studentRows=[...st].sort((a,b)=>(a.nextDueDate||'9').localeCompare(b.nextDueDate||'9')).map(s=>({Student:s.name,Mobile:s.mobile,Course:s.courseName,
    'Net Fee':s.netFee,Paid:s.totalPaid,Pending:s.balance,'Due Date':s.nextDueDate||''}));
  const overdue=st.filter(s=>s.balance>0&&s.nextDueDate&&s.nextDueDate<today()).sort((a,b)=>a.nextDueDate.localeCompare(b.nextDueDate))
    .map(s=>({Student:s.name,Mobile:s.mobile,Course:s.courseName,Pending:s.balance,'Due Date':s.nextDueDate,'Days Overdue':Math.round((new Date(today())-new Date(s.nextDueDate))/864e5)}));
  const cash=sum(pay.filter(p=>p.mode==='cash').map(p=>p.amount)),online=sum(pay.filter(p=>p.mode==='online').map(p=>p.amount));
  const payRows=[...pay].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>({Date:p.date,Student:p.studentName,Course:p.courseName,Amount:p.amount,Mode:p.mode,'Trans ID':p.transId,Remarks:p.remarks}));
  const isCurrency=k=>['Total Fee','Collected','Pending','Net Fee','Paid','Amount'].includes(k);
  const fmt=(k,v)=>(typeof v==='number'&&isCurrency(k)?inr(v):v);
  const Tbl=({rows,name})=><div className="card"><button className="btn sm gold" onClick={()=>exportXlsx(rows,name)}>Download Excel</button>
    <div className="wrap"><table><thead><tr>{rows[0]&&Object.keys(rows[0]).map(k=><th key={k}>{k}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={i} className={r.Course==='TOTAL'?'total':''}>{Object.entries(r).map(([k,v],j)=><td key={j}>{fmt(k,v)}</td>)}</tr>)}</tbody></table></div>{!rows.length&&<p className="muted">No records.</p>}</div>;
  const max=Math.max(1,...byCourse.map(r=>r.Pending));
  const tabs=[['sum','Summary & course-wise'],['stu','Student-wise pending'],['col','Cash / Online'],['chart','Pending chart'],['over','Due date crossed']];
  return <div><div className="card grid2"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <label>Course<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">All</option>{courses.map(([i,n])=><option key={i} value={i}>{n}</option>)}</select></label></div>
    <div className="tabs">{tabs.map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
    {tab==='sum'&&<><div className="grid"><div className="card kpi">Total to collect<b>{inr(T.fee)}</b></div><div className="card kpi">Collected<b>{inr(T.paid)}</b></div>
      <div className="card kpi">Pending<b>{inr(T.bal)}</b></div><div className="card kpi">Collected + Pending<b>{inr(T.paid+T.bal)}</b></div></div>
      <Tbl rows={[...byCourse,{Course:'TOTAL','No. of Students':st.length,'Student Names':`${st.length} students total`,'Total Fee':T.fee,Collected:T.paid,Pending:T.bal}]} name="course_wise"/></>}
    {tab==='stu'&&<Tbl rows={studentRows} name="student_wise_pending"/>}
    {tab==='col'&&<><div className="grid"><div className="card kpi">Cash<b>{inr(cash)}</b></div><div className="card kpi">Online<b>{inr(online)}</b></div>
      <div className="card kpi">Total<b>{inr(cash+online)}</b></div></div><Tbl rows={payRows} name="collections"/></>}
    {tab==='chart'&&<div className="card"><h3>Pending amount by course</h3>{[...byCourse].sort((a,b)=>b.Pending-a.Pending).map(r=>
      <div className="row" key={r.Course}><span>{r.Course}</span><div className="bar" style={{width:`${r.Pending/max*60}%`}}/><span>{inr(r.Pending)}</span></div>)}</div>}
    {tab==='over'&&<Tbl rows={overdue} name="overdue"/>}</div>;
}
