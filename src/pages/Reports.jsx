import {useEffect,useState} from 'react';
import {collection,getDocs} from 'firebase/firestore';
import {db} from '../firebase';
import {today,inr,exportXlsx,toDmy} from '../util';

export default function Reports({onBack}){
  const [S,setS]=useState([]),[P,setP]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [disbursements,setDisbursements]=useState([]);
  // activeReport: null = show report cards menu; 'sum' | 'stu' | 'day' | 'col' | 'chart' | 'over' | 'expense_split'
  const [activeReport,setActiveReport]=useState(null);
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [course,setCourse]=useState('');

  useEffect(()=>{
    getDocs(collection(db,'students')).then(r=>setS(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'payments')).then(r=>setP(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'expenses')).then(r=>setExpenses(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'pettyCashDisbursements')).then(r=>setDisbursements(r.docs.map(d=>({id:d.id,...d.data()}))));
  },[]);

  // Lookup map for student details by studentId
  const studentMap = new Map(S.map(s=>[s.id, s]));

  const inR=d=>(!from||d>=from)&&(!to||d<=to);
  const st=S.filter(s=>inR(s.date)&&(!course||s.courseId===course));
  const pay=P.filter(p=>inR(p.date)&&(!course||p.courseId===course));
  const expFiltered=expenses.filter(e=>inR(e.date));
  const disFiltered=disbursements.filter(d=>inR(d.date));
  const courses=[...new Map(S.map(s=>[s.courseId,s.courseName]))];

  const sum=a=>a.reduce((x,y)=>x+y,0);
  const T={fee:sum(st.map(s=>s.netFee)),paid:sum(st.map(s=>s.totalPaid)),bal:sum(st.map(s=>s.balance))};

  // Expenses & Petty Cash Financial Calculations
  const totalInflow = sum(pay.map(p=>p.amount));
  const totalOutflow = sum(expFiltered.map(e=>e.amount));
  const netOperatingBalance = totalInflow - totalOutflow;

  const totalPettyGiven = sum(disFiltered.map(d=>d.amount));
  const pettySpentList = expFiltered.filter(e=>e.isPettyCash || e.mode==='petty_cash');
  const totalPettySpent = sum(pettySpentList.map(e=>e.amount));
  const pettyCashBalanceInHand = totalPettyGiven - totalPettySpent;

  // 1. Summary & course-wise
  const byCourse=courses.map(([id,name])=>{
    const x=st.filter(s=>s.courseId===id);
    return {
      'Course':name,
      'No. of Students':x.length,
      'Students & Mobile':x.map(s=>`${s.name} (${s.mobile})`).join('; ') || '-',
      'Total Fee':sum(x.map(s=>s.netFee)),
      'Collected':sum(x.map(s=>s.totalPaid)),
      'Pending':sum(x.map(s=>s.balance))
    };
  }).filter(r=>r['No. of Students']);

  // 2. Student-wise pending
  const studentRows=[...st].sort((a,b)=>(a.nextDueDate||'9').localeCompare(b.nextDueDate||'9')).map(s=>({
    'Student Name':s.name,
    'Mobile Number':s.mobile,
    'Course':s.courseName,
    'Net Fee':s.netFee,
    'Paid':s.totalPaid,
    'Pending Due':s.balance,
    'Due Date':toDmy(s.nextDueDate)
  }));

  // 3. Day-wise grouping calculation
  const dayMap = {};
  pay.forEach(p => {
    const d = p.date;
    if (!dayMap[d]) {
      dayMap[d] = { date: d, cash: 0, online: 0, total: 0, receipts: [], students: new Set() };
    }
    const amt = Number(p.amount) || 0;
    if (p.mode === 'cash') dayMap[d].cash += amt;
    else dayMap[d].online += amt;
    dayMap[d].total += amt;
    const stu = studentMap.get(p.studentId);
    const mob = (stu && stu.mobile) || p.mobile || '';
    dayMap[d].students.add(`${p.studentName}${mob ? ` (${mob})` : ''}`);
    dayMap[d].receipts.push(p);
  });

  const dayKeys = Object.keys(dayMap).sort((a,b) => b.localeCompare(a));
  const dayRows = dayKeys.map(d => ({
    'Date': toDmy(d),
    'Receipts Count': dayMap[d].receipts.length,
    'Students (Name & Mobile)': Array.from(dayMap[d].students).join('; '),
    'Cash Collection': dayMap[d].cash,
    'Online Collection': dayMap[d].online,
    'Total Day Collection': dayMap[d].total
  }));

  const totalDayCash = sum(dayKeys.map(d => dayMap[d].cash));
  const totalDayOnline = sum(dayKeys.map(d => dayMap[d].online));
  const totalDayAll = sum(dayKeys.map(d => dayMap[d].total));
  const totalReceiptsCount = sum(dayKeys.map(d => dayMap[d].receipts.length));

  // 4. Collections (Cash / Online)
  const cash=sum(pay.filter(p=>p.mode==='cash').map(p=>p.amount));
  const online=sum(pay.filter(p=>p.mode==='online').map(p=>p.amount));
  const payRows=[...pay].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{
    const stu=studentMap.get(p.studentId);
    const mob=(stu&&stu.mobile)||p.mobile||'-';
    return {
      'Date':toDmy(p.date),
      'Student Name':p.studentName,
      'Mobile Number':mob,
      'Course':p.courseName,
      'Amount':p.amount,
      'Mode':p.mode,
      'Trans ID':p.transId||'-',
      'Remarks':p.remarks||'-'
    };
  });

  // 5. Overdue
  const overdue=st.filter(s=>s.balance>0&&s.nextDueDate&&s.nextDueDate<today())
    .sort((a,b)=>a.nextDueDate.localeCompare(b.nextDueDate))
    .map(s=>({
      'Student Name':s.name,
      'Mobile Number':s.mobile,
      'Course':s.courseName,
      'Pending Due':s.balance,
      'Due Date':toDmy(s.nextDueDate),
      'Days Overdue':Math.round((new Date(today())-new Date(s.nextDueDate))/864e5)
    }));

  const isCurrency=k=>['Total Fee','Collected','Pending','Net Fee','Paid','Pending Due','Amount','Cash Collection','Online Collection','Total Day Collection'].includes(k);
  const renderCell=(k,v)=>{
    if(typeof v==='number'&&isCurrency(k)) return inr(v);
    if(k==='Mobile Number'&&v&&v!=='-') return <span className="mobile-badge">📞 {v}</span>;
    if(k==='Mode') return <span style={{textTransform:'capitalize',fontWeight:600,color:v==='online'?'#19376d':'#1e8449'}}>{v}</span>;
    if(k==='Days Overdue') return <span className="err" style={{fontWeight:600}}>{v} days</span>;
    return v;
  };

  const Tbl=({rows,name})=>(
    <div className="sub-card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
        <span className="muted" style={{fontSize:'13px'}}>Showing <b>{rows.length}</b> records</span>
        <button className="btn sm gold" onClick={()=>exportXlsx(rows,name)}>📥 Download Excel</button>
      </div>
      <div className="wrap">
        <table>
          <thead>
            <tr>{rows[0]&&Object.keys(rows[0]).map(k=><th key={k}>{k}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className={r.Course==='TOTAL'||r.Date==='TOTAL'?'total':''}>
                {Object.entries(r).map(([k,v],j)=><td key={j}>{renderCell(k,v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length&&<p className="muted" style={{margin:'14px 0 4px'}}>No records found matching filters.</p>}
    </div>
  );

  const max=Math.max(1,...byCourse.map(r=>r.Pending));

  const REPORT_CARDS=[
    {
      id:'sum',
      icon:'📑',
      title:'Summary & course-wise',
      tag:'Overview',
      desc:'Course fees overview, student enrollment counts, total collections, and pending dues.',
      badge:`${courses.length} Courses`
    },
    {
      id:'stu',
      icon:'👥',
      title:'Student-wise pending',
      tag:'Pending Balances',
      desc:'Individual student records with mobile numbers, enrolled course, total fees, and due dates.',
      badge:`${st.filter(s=>s.balance>0).length} Pending Students`
    },
    {
      id:'day',
      icon:'📅',
      title:'Day-wise Collections',
      tag:'Daily Income',
      desc:'Track daily fees collected from students with cash vs online breakdown and student details.',
      badge:`${dayKeys.length} Days Recorded`
    },
    {
      id:'col',
      icon:'💳',
      title:'Cash / Online Receipts',
      tag:'Collection Receipts',
      desc:'Complete payment transactions list with student mobile numbers, modes, and transaction IDs.',
      badge:`${pay.length} Receipts`
    },
    {
      id:'chart',
      icon:'📈',
      title:'Pending chart',
      tag:'Visual Analytics',
      desc:'Visual comparative bar chart of pending fees by course with student name & mobile breakdown.',
      badge:inr(T.bal)
    },
    {
      id:'over',
      icon:'⚠️',
      title:'Due date crossed',
      tag:'Overdue Alerts',
      desc:'Immediate tracker for students whose fees have crossed the scheduled due date with mobile numbers.',
      badge:`${overdue.length} Overdue Students`
    },
    {
      id:'expense_split',
      icon:'🧾',
      title:'Income vs Expenses & Petty Cash',
      tag:'Financial Balance',
      desc:'Complete institutional accounting: Student fees inflow vs Expenses outflow, and Office Boy petty cash split.',
      badge:`Net: ${inr(netOperatingBalance)}`
    }
  ];

  const clearFilters=()=>{
    setFrom('');
    setTo('');
    setCourse('');
  };

  const hasFilter = from || to || course;
  const currentReportMeta = REPORT_CARDS.find(c=>c.id===activeReport);

  // ==========================================
  // SCREEN 1: Reports Menu Cards Screen
  // ==========================================
  if(activeReport === null){
    return (
      <div className="parent-card">
        <div className="parent-card-header">
          <div>
            <h2>📊 Records & Reports Menu</h2>
            <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
              Select any report card below to open its dedicated view with date filters and records:
            </p>
          </div>
          {onBack && (
            <button type="button" className="btn sm outline" onClick={onBack}>
              ← Back to Dashboard Hub
            </button>
          )}
        </div>

        <div className="hub-grid">
          {REPORT_CARDS.map(rc=>(
            <div key={rc.id} className="hub-card" onClick={()=>setActiveReport(rc.id)}>
              <div>
                <div className="hub-icon">{rc.icon}</div>
                <span className="count-tag" style={{marginBottom:'8px'}}>{rc.tag}</span>
                <h3>{rc.title}</h3>
                <p>{rc.desc}</p>
                <div style={{marginBottom:'14px'}}>
                  <span style={{fontSize:'12px',fontWeight:700,background:'#eef2fb',color:'var(--navy2)',padding:'3px 10px',borderRadius:'12px'}}>
                    {rc.badge}
                  </span>
                </div>
              </div>
              <div className="hub-action">
                <span>Open {rc.title}</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==========================================
  // SCREEN 2: Dedicated Single-Report Screen
  // ==========================================
  return (
    <div className="parent-card">
      {/* Dedicated Screen Header with Back to Reports Menu */}
      <div className="parent-card-header">
        <div>
          <h2>
            <span>{currentReportMeta?.icon}</span> {currentReportMeta?.title}
          </h2>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            {currentReportMeta?.desc}
          </p>
        </div>
        <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
          <button type="button" className="btn sm" onClick={()=>setActiveReport(null)} style={{background:'var(--navy)',color:'#fff'}}>
            ← Back to Reports Menu
          </button>
          {onBack && (
            <button type="button" className="btn sm outline" onClick={onBack}>
              ← Back to Dashboard Hub
            </button>
          )}
        </div>
      </div>

      {/* Filter Card (From dd-mm-yyyy, To dd-mm-yyyy, Course dropdown) */}
      <div className="filter-card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',flexWrap:'wrap',gap:'6px'}}>
          <span style={{fontWeight:600,color:'var(--navy)',fontSize:'13px'}}>🔍 Filter Records:</span>
          {hasFilter && (
            <span style={{fontSize:'12px',background:'#fff7dc',color:'#855c00',padding:'2px 8px',borderRadius:'10px',border:'1px solid #ffeeba'}}>
              Filters Active ({from?`From: ${toDmy(from)}`:''} {to?`To: ${toDmy(to)}`:''} {course?'Course filtered':''})
            </span>
          )}
        </div>
        <div className="grid-filter">
          <label>
            From <span className="filter-label-format">(dd-mm-yyyy)</span>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          </label>
          <label>
            To <span className="filter-label-format">(dd-mm-yyyy)</span>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)}/>
          </label>
          <label>
            Course
            <select value={course} onChange={e=>setCourse(e.target.value)}>
              <option value="">All Courses</option>
              {courses.map(([i,n])=><option key={i} value={i}>{n}</option>)}
            </select>
          </label>
          <div>
            <button
              type="button"
              className="btn sm outline"
              onClick={clearFilters}
              disabled={!hasFilter}
              style={{height:'38px',display:'inline-flex',alignItems:'center',gap:'4px'}}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* 1. Summary & Course-wise Report Screen */}
      {activeReport==='sum' && (
        <div>
          <div className="grid" style={{marginBottom:'16px'}}>
            <div className="card kpi">Total to collect<b>{inr(T.fee)}</b></div>
            <div className="card kpi">Collected<b>{inr(T.paid)}</b></div>
            <div className="card kpi">Pending<b>{inr(T.bal)}</b></div>
            <div className="card kpi">Collected + Pending<b>{inr(T.paid+T.bal)}</b></div>
          </div>
          <Tbl
            rows={[
              ...byCourse,
              {
                'Course':'TOTAL',
                'No. of Students':st.length,
                'Students & Mobile':`${st.length} students total`,
                'Total Fee':T.fee,
                'Collected':T.paid,
                'Pending':T.bal
              }
            ]}
            name="course_wise_summary"
          />
        </div>
      )}

      {/* 2. Student-wise Pending Report Screen */}
      {activeReport==='stu' && (
        <div>
          <div className="sub-card" style={{marginBottom:'16px',background:'#fff8f8',borderColor:'#f5c6cb'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
              <span style={{color:'var(--red)',fontWeight:600}}>
                Total Outstanding Balance: {inr(T.bal)}
              </span>
              <span className="muted" style={{fontSize:'13px'}}>
                {st.filter(s=>s.balance>0).length} of {st.length} students have remaining fees
              </span>
            </div>
          </div>
          <Tbl rows={studentRows} name="student_wise_pending"/>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. DAY-WISE COLLECTIONS REPORT SCREEN                          */}
      {/* ============================================================== */}
      {activeReport==='day' && (
        <div>
          {/* Day-wise KPI Cards */}
          <div className="grid" style={{marginBottom:'16px'}}>
            <div className="card kpi" style={{borderLeft:'4px solid var(--navy)'}}>
              Total Amount Collected
              <b style={{color:'var(--grn)'}}>{inr(totalDayAll)}</b>
              <span className="muted" style={{fontSize:'12px'}}>{totalReceiptsCount} receipts across {dayKeys.length} collection days</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid #16a34a'}}>
              Cash vs Online Breakdown
              <b style={{fontSize:'17px',color:'var(--navy)'}}>Cash: {inr(totalDayCash)}</b>
              <span className="muted" style={{fontSize:'12px'}}>Online / UPI: <b>{inr(totalDayOnline)}</b></span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid var(--gold)'}}>
              Average Collection per Day
              <b style={{color:'var(--navy)'}}>{inr(dayKeys.length ? Math.round(totalDayAll / dayKeys.length) : 0)}</b>
              <span className="muted" style={{fontSize:'12px'}}>Based on active payment days</span>
            </div>
          </div>

          {/* Day-Wise Summary Table */}
          <Tbl
            rows={[
              ...dayRows,
              {
                'Date': 'TOTAL',
                'Receipts Count': totalReceiptsCount,
                'Students (Name & Mobile)': `${pay.length} payments total`,
                'Cash Collection': totalDayCash,
                'Online Collection': totalDayOnline,
                'Total Day Collection': totalDayAll
              }
            ]}
            name="day_wise_collection_summary"
          />

          {/* Detailed Itemized Receipts per Day */}
          <h4 style={{margin:'24px 0 10px',color:'var(--navy)'}}>📋 All Payment Receipts in Selected Period</h4>
          <Tbl rows={payRows} name="itemized_daily_receipts"/>
        </div>
      )}

      {/* 4. Cash / Online Collections Report Screen */}
      {activeReport==='col' && (
        <div>
          <div className="grid" style={{marginBottom:'16px'}}>
            <div className="card kpi">Cash Collections<b>{inr(cash)}</b></div>
            <div className="card kpi">Online Collections<b>{inr(online)}</b></div>
            <div className="card kpi">Total Received<b>{inr(cash+online)}</b></div>
          </div>
          <Tbl rows={payRows} name="cash_online_collections"/>
        </div>
      )}

      {/* 5. Pending Chart Report Screen */}
      {activeReport==='chart' && (
        <div className="sub-card">
          <h4 style={{marginBottom:'16px'}}>Pending Amount by Course</h4>
          {[...byCourse].sort((a,b)=>b.Pending-a.Pending).map(r=>(
            <div className="row" key={r.Course}>
              <span>{r.Course}</span>
              <div className="bar" style={{width:`${(r.Pending/max)*65}%`}}/>
              <span style={{fontWeight:600}}>{inr(r.Pending)}</span>
            </div>
          ))}
          <div style={{marginTop:'24px',borderTop:'1px solid #e2e8f0',paddingTop:'16px'}}>
            <h4 style={{marginBottom:'10px'}}>Students with Pending Fees in Selected View</h4>
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Mobile Number</th>
                    <th>Course</th>
                    <th>Pending Amount</th>
                    <th>Next Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {st.filter(s=>s.balance>0).map(s=>(
                    <tr key={s.id}>
                      <td className="student-name-tag">{s.name}</td>
                      <td><span className="mobile-badge">📞 {s.mobile}</span></td>
                      <td>{s.courseName}</td>
                      <td style={{color:'var(--red)',fontWeight:600}}>{inr(s.balance)}</td>
                      <td>{toDmy(s.nextDueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Due Date Crossed (Overdue) Report Screen */}
      {activeReport==='over' && (
        <div>
          <div className="sub-card" style={{marginBottom:'16px',background:'#fff5f5',borderColor:'#f5c6cb'}}>
            <span style={{color:'var(--red)',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}}>
              ⚠️ Critical Overdue: {overdue.length} student(s) have passed their due date without completing payment.
            </span>
          </div>
          <Tbl rows={overdue} name="overdue_students"/>
        </div>
      )}

      {/* 7. Income vs Expenses & Petty Cash Split Report */}
      {activeReport==='expense_split' && (
        <div>
          {/* Main Inflow vs Outflow KPI Cards */}
          <div className="grid" style={{marginBottom:'16px'}}>
            <div className="card kpi" style={{borderLeft:'4px solid var(--grn)'}}>
              Student Fees Inflow (Credit)
              <b style={{color:'var(--grn)'}}>{inr(totalInflow)}</b>
              <span className="muted" style={{fontSize:'12px'}}>{pay.length} collections received</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid var(--red)'}}>
              Total Expenses Outflow (Debit)
              <b style={{color:'var(--red)'}}>{inr(totalOutflow)}</b>
              <span className="muted" style={{fontSize:'12px'}}>{expFiltered.length} expense payments</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid var(--navy)'}}>
              Net Operating Balance
              <b style={{color:netOperatingBalance>=0?'var(--navy)':'var(--red)'}}>{inr(netOperatingBalance)}</b>
              <span className="muted" style={{fontSize:'12px'}}>Inflow minus Outflow</span>
            </div>
          </div>

          {/* Office Boy Petty Cash Split Card */}
          <div className="sub-card" style={{background:'#fffdf7',border:'1px solid #fed7aa',marginBottom:'20px'}}>
            <h4 style={{margin:'0 0 10px',color:'#9a3412',display:'flex',alignItems:'center',gap:'8px'}}>
              <span>💰</span> Office Boy Petty Cash Split & Balance Tracking
            </h4>
            <div className="grid" style={{marginBottom:'12px'}}>
              <div style={{background:'#fff',padding:'12px',borderRadius:'8px',border:'1px solid #fed7aa'}}>
                <span className="muted" style={{fontSize:'12px',display:'block'}}>Total Given to Office Boy</span>
                <b style={{fontSize:'18px',color:'#19376d'}}>{inr(totalPettyGiven)}</b>
              </div>
              <div style={{background:'#fff',padding:'12px',borderRadius:'8px',border:'1px solid #fed7aa'}}>
                <span className="muted" style={{fontSize:'12px',display:'block'}}>Total Spent by Office Boy</span>
                <b style={{fontSize:'18px',color:'#d97706'}}>{inr(totalPettySpent)}</b>
              </div>
              <div style={{background:'#fff',padding:'12px',borderRadius:'8px',border:'1px solid #fed7aa'}}>
                <span className="muted" style={{fontSize:'12px',display:'block'}}>Petty Cash Remaining in Hand</span>
                <b style={{fontSize:'18px',color:pettyCashBalanceInHand<1000?'var(--red)':'var(--grn)'}}>{inr(pettyCashBalanceInHand)}</b>
              </div>
            </div>
            <p className="muted" style={{margin:0,fontSize:'12px'}}>
              * Displays how much advance cash management gave to the office boy vs itemized micro-expenses spent (tea, water cans, stationery, courier) vs remaining balance.
            </p>
          </div>

          {/* Itemized Petty Cash Spent Table */}
          <h4 style={{margin:'16px 0 8px',color:'var(--navy)'}}>🚩 Office Boy Petty Cash Vouchers Breakdown</h4>
          <Tbl
            rows={pettySpentList.map(e=>({
              'Date': toDmy(e.date),
              'Expense Item': e.itemName,
              'Amount': e.amount,
              'Vendor / Paid To': e.paidTo || '-',
              'Attachment': e.attachmentName ? `📎 ${e.attachmentName}` : '-',
              'Remarks': e.remarks || '-',
              'Logged By': e.createdBy || '-'
            }))}
            name="office_boy_petty_cash_expenses"
          />

          {/* All General Expenses Table */}
          <h4 style={{margin:'24px 0 8px',color:'var(--navy)'}}>📋 All Institutional Expenses (General + Petty Cash)</h4>
          <Tbl
            rows={expFiltered.map(e=>({
              'Date': toDmy(e.date),
              'Expense Item': e.itemName,
              'Amount': e.amount,
              'Mode': e.mode,
              'Petty Cash?': (e.isPettyCash || e.mode==='petty_cash') ? 'YES' : 'NO',
              'Vendor / Paid To': e.paidTo || '-',
              'Attachment': e.attachmentName ? `📎 ${e.attachmentName}` : '-',
              'Remarks': e.remarks || '-',
              'Logged By': e.createdBy || '-'
            }))}
            name="all_institutional_expenses"
          />
        </div>
      )}
    </div>
  );
}
