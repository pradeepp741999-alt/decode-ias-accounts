import {useEffect,useState,Fragment} from 'react';
import {collection,getDocs,doc,getDoc} from 'firebase/firestore';
import {db} from '../firebase';
import {today,inr,exportXlsx,toDmy} from '../util';

const DEFAULT_REPORT_VIS = {
  showPendingChart: true,
  showDueDateCrossed: true,
  showIncomeVsExpense: true
};

export default function Reports({onBack}){
  const [S,setS]=useState([]),[P,setP]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [disbursements,setDisbursements]=useState([]);
  const [cycles,setCycles]=useState([]);
  const [returns,setReturns]=useState([]);
  // activeReport: null = show report cards menu; 'sum' | 'stu' | 'course_collection' | 'day' | 'col' | 'chart' | 'over' | 'expense_split'
  const [activeReport,setActiveReport]=useState(null);
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [course,setCourse]=useState('');
  // Summary course drill-down state
  const [selectedSummaryCourseId,setSelectedSummaryCourseId]=useState(null);
  // Student-wise pending filter toggle (pending only vs all)
  const [stuPendingOnly,setStuPendingOnly]=useState(true);

  // Admin visibility controls for Report tabs (Pending chart, Due date crossed, Income vs expenses & petty cash)
  const [reportVis, setReportVis] = useState(() => {
    try {
      const saved = localStorage.getItem('decode_report_visibility');
      return saved ? { ...DEFAULT_REPORT_VIS, ...JSON.parse(saved) } : DEFAULT_REPORT_VIS;
    } catch (e) {
      return DEFAULT_REPORT_VIS;
    }
  });

  useEffect(() => {
    const handleVisUpdate = () => {
      try {
        const saved = localStorage.getItem('decode_report_visibility');
        if (saved) setReportVis(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {}
    };
    window.addEventListener('report_vis_changed', handleVisUpdate);
    window.addEventListener('storage', handleVisUpdate);

    getDoc(doc(db, 'settings', 'report_visibility')).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setReportVis(prev => ({ ...prev, ...data }));
        try { localStorage.setItem('decode_report_visibility', JSON.stringify(data)); } catch (e) {}
      }
    }).catch(() => {});

    return () => {
      window.removeEventListener('report_vis_changed', handleVisUpdate);
      window.removeEventListener('storage', handleVisUpdate);
    };
  }, []);

  useEffect(()=>{
    getDocs(collection(db,'students')).then(r=>setS(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'payments')).then(r=>setP(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'expenses')).then(r=>setExpenses(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'pettyCashDisbursements')).then(r=>setDisbursements(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'pettyCashCycles')).then(r=>setCycles(r.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'pettyCashReturns')).then(r=>setReturns(r.docs.map(d=>({id:d.id,...d.data()}))));
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

  // Helper to extract student payment modes & transaction IDs
  const getStudentPaymentDetails = (studentId) => {
    const studentPayments = P.filter(p => p.studentId === studentId);
    if (!studentPayments.length) {
      return { mode: 'Cash', transId: '-' };
    }
    const modes = Array.from(new Set(studentPayments.map(p => p.mode === 'online' ? 'Online' : 'Cash'))).join(', ');
    const transIds = Array.from(new Set(studentPayments.map(p => p.transId).filter(Boolean))).join(', ') || '-';
    return { mode: modes, transId: transIds };
  };

  // 1. Summary & course-wise (Overall Course Overview, without cramming Students & Mobile)
  const byCourse=courses.map(([id,name])=>{
    const x=st.filter(s=>s.courseId===id);
    return {
      courseId: id,
      'Course':name,
      'No. of Students':x.length,
      'Total Fee':sum(x.map(s=>s.netFee)),
      'Collected':sum(x.map(s=>s.totalPaid)),
      'Pending':sum(x.map(s=>s.balance))
    };
  }).filter(r=>r['No. of Students']);

  // Selected Course Drill-down rows for below grid in Summary & course-wise
  const selectedCourseStudents = selectedSummaryCourseId 
    ? st.filter(s => s.courseId === selectedSummaryCourseId)
    : [];
  const selectedCourseObj = courses.find(([id]) => id === selectedSummaryCourseId);
  const selectedCourseName = selectedCourseObj ? selectedCourseObj[1] : '';

  const courseStudentDetailRows = selectedCourseStudents.map((s, index) => {
    const payInfo = getStudentPaymentDetails(s.id);
    return {
      'S.No': index + 1,
      'Date': toDmy(s.date),
      'Name': s.name,
      'Phone Number': s.mobile,
      'Batch Name': s.batchName || s.batch || 'Regular Batch',
      'Course': s.courseName,
      'Net Fee': s.netFee,
      'Paid': s.totalPaid,
      'Mode': payInfo.mode,
      'Trans ID': payInfo.transId,
      'Pending Due': s.balance,
      'Due Date': toDmy(s.nextDueDate)
    };
  });

  // 2. Student-wise pending (Individual student records with all requested fields)
  const displayedStudents = [...st]
    .filter(s => stuPendingOnly ? s.balance > 0 : true)
    .sort((a,b)=>(a.nextDueDate||'9').localeCompare(b.nextDueDate||'9'));

  const studentPendingRows = displayedStudents.map((s, index) => {
    const payInfo = getStudentPaymentDetails(s.id);
    return {
      'S.No': index + 1,
      'Date': toDmy(s.date),
      'Student Name': s.name,
      'Phone Number': s.mobile,
      'Course': s.courseName,
      'Net Fee': s.netFee,
      'Paid': s.totalPaid,
      'Mode': payInfo.mode,
      'Trans ID': payInfo.transId,
      'Pending Due': s.balance,
      'Due Date': toDmy(s.nextDueDate)
    };
  });

  // 3. Total fees collection course-wise
  const collectionCourseWiseRows = courses.map(([id, name], index) => {
    const courseStudents = st.filter(s => s.courseId === id);
    const coursePayments = pay.filter(p => p.courseId === id);
    const cFee = sum(courseStudents.map(s => s.netFee));
    const cOnline = sum(coursePayments.filter(p => p.mode === 'online').map(p => p.amount));
    const cCash = sum(coursePayments.filter(p => p.mode === 'cash').map(p => p.amount));
    const cTotal = cOnline + cCash;
    const cPending = sum(courseStudents.map(s => s.balance));
    return {
      'S.No': index + 1,
      courseId: id,
      'Course': name,
      'No. of Students': courseStudents.length,
      'Total Net Fee': cFee,
      'Online Received': cOnline,
      'Cash Received': cCash,
      'Total Received': cTotal,
      'Pending Due': cPending
    };
  }).filter(r => r['No. of Students'] > 0 || r['Total Received'] > 0);

  const totalOnlineCourseWise = sum(collectionCourseWiseRows.map(r => r['Online Received']));
  const totalCashCourseWise = sum(collectionCourseWiseRows.map(r => r['Cash Received']));
  const totalCollectionCourseWise = sum(collectionCourseWiseRows.map(r => r['Total Received']));

  const collectionCourseWiseExportRows = collectionCourseWiseRows.map(r => ({
    'S.No': r['S.No'],
    'Course': r['Course'],
    'No. of Students': r['No. of Students'],
    'Total Net Fee': r['Total Net Fee'],
    'Online Received': r['Online Received'],
    'Cash Received': r['Cash Received'],
    'Total Received': r['Total Received'],
    'Pending Due': r['Pending Due']
  }));

  // 4. Day-wise grouping calculation (Group receipts under each date)
  const dayMap = {};
  pay.forEach(p => {
    const d = p.date;
    if (!dayMap[d]) {
      dayMap[d] = { date: d, cash: 0, online: 0, total: 0, receipts: [] };
    }
    const amt = Number(p.amount) || 0;
    if (p.mode === 'cash') dayMap[d].cash += amt;
    else dayMap[d].online += amt;
    dayMap[d].total += amt;
    dayMap[d].receipts.push(p);
  });

  const dayKeys = Object.keys(dayMap).sort((a,b) => b.localeCompare(a));
  const totalDayCash = sum(dayKeys.map(d => dayMap[d].cash));
  const totalDayOnline = sum(dayKeys.map(d => dayMap[d].online));
  const totalDayAll = sum(dayKeys.map(d => dayMap[d].total));

  // Day-wise Export Rows with Subtotal row under each date
  // Clean financial register layout: blank fields instead of '--', numeric value only in 'Total Single Day Collection'
  const dayWiseGroupedExportRows = [];
  let globalReceiptCounter = 1;
  dayKeys.forEach(d => {
    const group = dayMap[d];
    group.receipts.forEach(p => {
      const stu = studentMap.get(p.studentId);
      const mob = (stu && stu.mobile) || p.mobile || '';
      dayWiseGroupedExportRows.push({
        'S.No': globalReceiptCounter++,
        'Date': toDmy(p.date),
        'Student Name': p.studentName || '',
        'Phone Number': mob,
        'Course': p.courseName || '',
        'Payment Mode': p.mode === 'online' ? 'Online' : 'Cash',
        'Trans ID': p.transId || '',
        'Amount': p.amount,
        'Remarks': p.remarks || '',
        'Total Single Day Collection': ''
      });
    });
    // Subtotal row for this date: all other columns blank, numeric value only in 'Total Single Day Collection'
    dayWiseGroupedExportRows.push({
      'S.No': '',
      'Date': toDmy(d),
      'Student Name': '',
      'Phone Number': '',
      'Course': '',
      'Payment Mode': '',
      'Trans ID': '',
      'Amount': '',
      'Remarks': '',
      'Total Single Day Collection': group.total
    });
  });

  if (dayKeys.length > 0) {
    dayWiseGroupedExportRows.push({
      'S.No': '',
      'Date': 'OVERALL GRAND TOTAL',
      'Student Name': '',
      'Phone Number': '',
      'Course': '',
      'Payment Mode': '',
      'Trans ID': '',
      'Amount': '',
      'Remarks': '',
      'Total Single Day Collection': totalDayAll
    });
  }

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

  const isCurrency=k=>[
    'Total Fee','Collected','Pending','Net Fee','Paid','Pending Due',
    'Amount','Cash Collection','Online Collection','Total Day Collection',
    'Total Net Fee','Cash Received','Online Received','Total Received',
    'Total Single Day Collection'
  ].includes(k);

  const renderCell=(k,v)=>{
    if(typeof v==='number'&&isCurrency(k)) return inr(v);
    if((k==='Mobile Number'||k==='Phone Number')&&v&&v!=='-') return <span className="mobile-badge">📞 {v}</span>;
    if(k==='Mode'||k==='Payment Mode') return (
      <span className="badge" style={{background: String(v).includes('Online') ? '#e0e7ff' : '#f1f5fa', color: String(v).includes('Online') ? '#4338ca' : '#1e293b'}}>
        {v}
      </span>
    );
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

  const ALL_REPORT_CARDS=[
    {
      id:'sum',
      icon:'📑',
      title:'Summary & course-wise pending',
      tag:'Course Overview',
      desc:'Course fees overview, student enrollment counts, total collections, and pending dues with student drill-down view.',
      badge:`${courses.length} Courses`
    },
    {
      id:'stu',
      icon:'👥',
      title:'Student-wise pending',
      tag:'Pending Balances',
      desc:'Individual student records with phone number, course, net fees, paid, mode (cash/online), trans ID, and due dates.',
      badge:`${st.filter(s=>s.balance>0).length} Pending Students`
    },
    {
      id:'course_collection',
      icon:'💰',
      title:'Total fees collection course-wise',
      tag:'Inflow by Course',
      desc:'Total fees collection course-wise breakdown: Online, Cash, Total received, Pending dues, and Net total.',
      badge:`${courses.length} Courses`
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

  // Filter report cards based on Admin display controls (show/hide for Pending chart, Due date crossed, Income vs expenses)
  const REPORT_CARDS = ALL_REPORT_CARDS.filter(rc => {
    if (rc.id === 'chart' && !reportVis.showPendingChart) return false;
    if (rc.id === 'over' && !reportVis.showDueDateCrossed) return false;
    if (rc.id === 'expense_split' && !reportVis.showIncomeVsExpense) return false;
    return true;
  });

  const clearFilters=()=>{
    setFrom('');
    setTo('');
    setCourse('');
  };

  const hasFilter = from || to || course;
  const currentReportMeta = REPORT_CARDS.find(c=>c.id===activeReport);

  // Guard: if current activeReport was disabled in Admin controls, prompt to return to menu
  if (activeReport && !REPORT_CARDS.some(c => c.id === activeReport)) {
    return (
      <div className="parent-card">
        <div className="parent-card-header">
          <h2>🔒 Report View Disabled</h2>
          <button type="button" className="btn sm" onClick={()=>setActiveReport(null)} style={{background:'var(--navy)',color:'#fff'}}>
            ← Back to Reports Menu
          </button>
        </div>
        <div className="sub-card" style={{textAlign:'center',padding:'40px 20px'}}>
          <p style={{fontSize:'16px',fontWeight:600,color:'var(--navy)'}}>
            This report tab is currently hidden by Administrator controls.
          </p>
          <p className="muted" style={{fontSize:'13px',marginBottom:'20px'}}>
            An administrator can re-enable visibility in the System Admin control panel.
          </p>
          <button type="button" className="btn gold" onClick={()=>setActiveReport(null)}>
            Return to Reports Menu
          </button>
        </div>
      </div>
    );
  }

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

      {/* Sleek Compact Filter Bar (Standard Website Style) */}
      <div className="filter-card">
        <div style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
          <span style={{fontWeight:700,color:'var(--navy)',fontSize:'12px',display:'inline-flex',alignItems:'center',gap:'4px'}}>
            <span>🔍</span> Filters:
          </span>
          <label style={{display:'inline-flex',alignItems:'center',gap:'6px',margin:0,fontSize:'12px',fontWeight:600,color:'#334155'}}>
            From:
            <input 
              type="date" 
              value={from} 
              onChange={e=>setFrom(e.target.value)}
              style={{width:'135px',height:'32px',padding:'4px 8px',margin:0,fontSize:'12px'}}
            />
          </label>
          <label style={{display:'inline-flex',alignItems:'center',gap:'6px',margin:0,fontSize:'12px',fontWeight:600,color:'#334155'}}>
            To:
            <input 
              type="date" 
              value={to} 
              onChange={e=>setTo(e.target.value)}
              style={{width:'135px',height:'32px',padding:'4px 8px',margin:0,fontSize:'12px'}}
            />
          </label>
          <label style={{display:'inline-flex',alignItems:'center',gap:'6px',margin:0,fontSize:'12px',fontWeight:600,color:'#334155'}}>
            Course:
            <select 
              value={course} 
              onChange={e=>setCourse(e.target.value)}
              style={{width:'180px',height:'32px',padding:'4px 8px',margin:0,fontSize:'12px'}}
            >
              <option value="">All Courses</option>
              {courses.map(([i,n])=><option key={i} value={i}>{n}</option>)}
            </select>
          </label>
          {hasFilter && (
            <button
              type="button"
              className="btn sm outline"
              onClick={clearFilters}
              style={{height:'32px',padding:'0 10px',fontSize:'12px',display:'inline-flex',alignItems:'center',gap:'4px'}}
              title="Clear active filters"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>
        {hasFilter && (
          <span style={{fontSize:'11px',background:'#fff7dc',color:'#855c00',padding:'3px 8px',borderRadius:'12px',border:'1px solid #ffeeba',fontWeight:600}}>
            Active: {from?`From ${toDmy(from)} `:''}{to?`To ${toDmy(to)} `:''}{course?'Course filtered':''}
          </span>
        )}
      </div>

      {/* ============================================================== */}
      {/* 1. SUMMARY & COURSE-WISE PENDING REPORT SCREEN                 */}
      {/* ============================================================== */}
      {activeReport==='sum' && (
        <div>
          <div className="grid" style={{marginBottom:'16px'}}>
            <div className="card kpi">Total Course Fee<b>{inr(T.fee)}</b><span className="muted" style={{fontSize:'12px'}}>From {st.length} enrolled students</span></div>
            <div className="card kpi">Total Collected<b style={{color:'var(--grn)'}}>{inr(T.paid)}</b><span className="muted" style={{fontSize:'12px'}}>Fees received</span></div>
            <div className="card kpi">Total Pending<b style={{color:'var(--red)'}}>{inr(T.bal)}</b><span className="muted" style={{fontSize:'12px'}}>Outstanding balance</span></div>
            <div className="card kpi">Total Active Courses<b>{byCourse.length}</b><span className="muted" style={{fontSize:'12px'}}>Offerings with admissions</span></div>
          </div>

          {/* First Grid: Overall Course-wise Overview (without Students & Mobile column) */}
          <div className="sub-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
              <div>
                <span style={{fontWeight:700,color:'var(--navy)',fontSize:'14px'}}>
                  Overall Course-wise Pending Overview
                </span>
                <span className="muted" style={{fontSize:'12px',marginLeft:'8px'}}>
                  (Showing <b>{byCourse.length}</b> courses — Click "View" to drill down into student records below)
                </span>
              </div>
              <button 
                className="btn sm gold" 
                onClick={()=>exportXlsx(byCourse.map(r=>({
                  'Course': r.Course,
                  'No. of Students': r['No. of Students'],
                  'Total Fee': r['Total Fee'],
                  'Collected': r['Collected'],
                  'Pending': r['Pending']
                })), 'Course_Wise_Summary_Overview')}
              >
                📥 Download Summary Excel
              </button>
            </div>
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>No. of Students</th>
                    <th>Total Fee</th>
                    <th>Collected</th>
                    <th>Pending</th>
                    <th>Student Details</th>
                  </tr>
                </thead>
                <tbody>
                  {byCourse.length === 0 ? (
                    <tr><td colSpan="6" style={{textAlign:'center',padding:'16px'}}>No course records found matching filters.</td></tr>
                  ) : (
                    byCourse.map((r)=>(
                      <tr key={r.courseId}>
                        <td><b>{r.Course}</b></td>
                        <td><span className="count-tag">{r['No. of Students']}</span></td>
                        <td><b>{inr(r['Total Fee'])}</b></td>
                        <td><b style={{color:'var(--grn)'}}>{inr(r['Collected'])}</b></td>
                        <td><b style={{color:'var(--red)'}}>{inr(r['Pending'])}</b></td>
                        <td>
                          <button 
                            type="button" 
                            className={`btn sm ${selectedSummaryCourseId===r.courseId?'':'outline'}`}
                            onClick={()=>setSelectedSummaryCourseId(selectedSummaryCourseId===r.courseId?null:r.courseId)}
                          >
                            👁️ {selectedSummaryCourseId===r.courseId ? 'Viewing' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                  {byCourse.length > 0 && (
                    <tr className="total">
                      <td><b>TOTAL</b></td>
                      <td><b>{st.length}</b></td>
                      <td><b>{inr(T.fee)}</b></td>
                      <td><b style={{color:'var(--grn)'}}>{inr(T.paid)}</b></td>
                      <td><b style={{color:'var(--red)'}}>{inr(T.bal)}</b></td>
                      <td>-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Second Grid: Extra grid below showing student records of clicked course */}
          {selectedSummaryCourseId && (
            <div className="sub-card" style={{marginTop:'22px', border:'2px solid var(--navy2)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px',flexWrap:'wrap',gap:'8px'}}>
                <div>
                  <h4 style={{margin:0,color:'var(--navy)'}}>
                    👥 Enrolled Students for: <b>{selectedCourseName}</b> ({courseStudentDetailRows.length} Students)
                  </h4>
                  <p className="muted" style={{margin:'2px 0 0',fontSize:'12px'}}>
                    Individual student admissions, batch names, payment modes, trans IDs, and pending dues
                  </p>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <button 
                    className="btn sm gold" 
                    onClick={()=>exportXlsx(courseStudentDetailRows, `${(selectedCourseName||'Course').replace(/[^a-zA-Z0-9]/g,'_')}_Students_Report`)}
                  >
                    📥 Download Course Excel
                  </button>
                  <button className="btn sm outline" onClick={()=>setSelectedSummaryCourseId(null)}>✕ Close</button>
                </div>
              </div>

              <div className="wrap">
                <table>
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Date</th>
                      <th>Name</th>
                      <th>Phone Number</th>
                      <th>Batch Name</th>
                      <th>Course</th>
                      <th>Net Fee</th>
                      <th>Paid</th>
                      <th>Mode</th>
                      <th>Trans ID</th>
                      <th>Pending Due</th>
                      <th>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseStudentDetailRows.length === 0 ? (
                      <tr><td colSpan="12" style={{textAlign:'center',padding:'16px'}}>No students enrolled for this course in the selected date range.</td></tr>
                    ) : (
                      courseStudentDetailRows.map((r)=>(
                        <tr key={r['S.No']}>
                          <td><b>{r['S.No']}</b></td>
                          <td>{r['Date']}</td>
                          <td className="student-name-tag">{r['Name']}</td>
                          <td><span className="mobile-badge">📞 {r['Phone Number']}</span></td>
                          <td>{r['Batch Name']}</td>
                          <td>{r['Course']}</td>
                          <td>{inr(r['Net Fee'])}</td>
                          <td><b style={{color:'var(--grn)'}}>{inr(r['Paid'])}</b></td>
                          <td>
                            <span className="badge" style={{background: String(r['Mode']).includes('Online') ? '#e0e7ff' : '#f1f5fa', color: String(r['Mode']).includes('Online') ? '#4338ca' : '#1e293b'}}>
                              {r['Mode']}
                            </span>
                          </td>
                          <td><small>{r['Trans ID']}</small></td>
                          <td><b style={{color:'var(--red)'}}>{inr(r['Pending Due'])}</b></td>
                          <td>{r['Due Date']}</td>
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

      {/* ============================================================== */}
      {/* 2. STUDENT-WISE PENDING REPORT SCREEN                          */}
      {/* ============================================================== */}
      {activeReport==='stu' && (
        <div>
          <div className="sub-card" style={{marginBottom:'16px',background:'#fff8f8',borderColor:'#f5c6cb'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
              <div>
                <span style={{color:'var(--red)',fontWeight:700,fontSize:'16px'}}>
                  Total Outstanding Balance: {inr(T.bal)}
                </span>
                <span className="muted" style={{fontSize:'13px',display:'block',marginTop:'2px'}}>
                  {st.filter(s=>s.balance>0).length} of {st.length} students have remaining fees
                </span>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer',margin:0}}>
                  <input 
                    type="checkbox" 
                    style={{width:'auto',margin:0}} 
                    checked={stuPendingOnly} 
                    onChange={e=>setStuPendingOnly(e.target.checked)}
                  />
                  <span>Show Pending Dues Only</span>
                </label>
              </div>
            </div>
          </div>

          <div className="sub-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
              <span className="muted" style={{fontSize:'13px'}}>Showing <b>{studentPendingRows.length}</b> student records</span>
              <button 
                className="btn sm gold" 
                onClick={()=>exportXlsx(studentPendingRows, 'Student_Wise_Pending_Report')}
              >
                📥 Download Excel
              </button>
            </div>
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Date</th>
                    <th>Student Name</th>
                    <th>Phone Number</th>
                    <th>Course</th>
                    <th>Net Fee</th>
                    <th>Paid</th>
                    <th>Mode</th>
                    <th>Trans ID</th>
                    <th>Pending Due</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {studentPendingRows.length === 0 ? (
                    <tr><td colSpan="11" style={{textAlign:'center',padding:'16px'}}>No student records found matching filters.</td></tr>
                  ) : (
                    studentPendingRows.map((r)=>(
                      <tr key={r['S.No']}>
                        <td><b>{r['S.No']}</b></td>
                        <td>{r['Date']}</td>
                        <td className="student-name-tag">{r['Student Name']}</td>
                        <td><span className="mobile-badge">📞 {r['Phone Number']}</span></td>
                        <td>{r['Course']}</td>
                        <td>{inr(r['Net Fee'])}</td>
                        <td><b style={{color:'var(--grn)'}}>{inr(r['Paid'])}</b></td>
                        <td>
                          <span className="badge" style={{background: String(r['Mode']).includes('Online') ? '#e0e7ff' : '#f1f5fa', color: String(r['Mode']).includes('Online') ? '#4338ca' : '#1e293b'}}>
                            {r['Mode']}
                          </span>
                        </td>
                        <td><small>{r['Trans ID']}</small></td>
                        <td><b style={{color:'var(--red)'}}>{inr(r['Pending Due'])}</b></td>
                        <td>{r['Due Date']}</td>
                      </tr>
                    ))
                  )}
                  {studentPendingRows.length > 0 && (
                    <tr className="total">
                      <td colSpan="5"><b>TOTAL</b></td>
                      <td><b>{inr(sum(studentPendingRows.map(r=>r['Net Fee'])))}</b></td>
                      <td><b style={{color:'var(--grn)'}}>{inr(sum(studentPendingRows.map(r=>r['Paid'])))}</b></td>
                      <td colSpan="2">-</td>
                      <td><b style={{color:'var(--red)'}}>{inr(sum(studentPendingRows.map(r=>r['Pending Due'])))}</b></td>
                      <td>-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. TOTAL FEES COLLECTION COURSE-WISE REPORT SCREEN             */}
      {/* ============================================================== */}
      {activeReport==='course_collection' && (
        <div>
          {/* KPI Summary Cards */}
          <div className="grid" style={{marginBottom:'16px'}}>
            <div className="card kpi" style={{borderLeft:'4px solid var(--grn)'}}>
              Total Fees Received
              <b style={{color:'var(--grn)'}}>{inr(totalCollectionCourseWise)}</b>
              <span className="muted" style={{fontSize:'12px'}}>From all student payments</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid #16a34a'}}>
              Cash Received
              <b style={{color:'var(--navy)'}}>{inr(totalCashCourseWise)}</b>
              <span className="muted" style={{fontSize:'12px'}}>Direct cash collections</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid #4338ca'}}>
              Online Received
              <b style={{color:'#4338ca'}}>{inr(totalOnlineCourseWise)}</b>
              <span className="muted" style={{fontSize:'12px'}}>UPI, Net Banking, Cards</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid var(--red)'}}>
              Total Pending Dues
              <b style={{color:'var(--red)'}}>{inr(T.bal)}</b>
              <span className="muted" style={{fontSize:'12px'}}>Outstanding student fees</span>
            </div>
          </div>

          <div className="sub-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
              <span className="muted" style={{fontSize:'13px'}}>Showing <b>{collectionCourseWiseRows.length}</b> courses</span>
              <button 
                className="btn sm gold" 
                onClick={()=>exportXlsx(collectionCourseWiseExportRows, 'Total_Fees_Collection_Course_Wise')}
              >
                📥 Download Excel
              </button>
            </div>
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Course</th>
                    <th>No. of Students</th>
                    <th>Total Net Fee</th>
                    <th>Online Received</th>
                    <th>Cash Received</th>
                    <th>Total Received</th>
                    <th>Pending Due</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionCourseWiseRows.length === 0 ? (
                    <tr><td colSpan="8" style={{textAlign:'center',padding:'16px'}}>No course collections found matching filters.</td></tr>
                  ) : (
                    collectionCourseWiseRows.map((r)=>(
                      <tr key={r['S.No']}>
                        <td><b>{r['S.No']}</b></td>
                        <td><b>{r['Course']}</b></td>
                        <td><span className="count-tag">{r['No. of Students']}</span></td>
                        <td><b>{inr(r['Total Net Fee'])}</b></td>
                        <td><b style={{color:'#4338ca'}}>{inr(r['Online Received'])}</b></td>
                        <td><b style={{color:'#16a34a'}}>{inr(r['Cash Received'])}</b></td>
                        <td><b style={{color:'var(--grn)'}}>{inr(r['Total Received'])}</b></td>
                        <td><b style={{color:'var(--red)'}}>{inr(r['Pending Due'])}</b></td>
                      </tr>
                    ))
                  )}
                  {collectionCourseWiseRows.length > 0 && (
                    <tr className="total">
                      <td colSpan="2"><b>TOTAL</b></td>
                      <td><b>{st.length}</b></td>
                      <td><b>{inr(T.fee)}</b></td>
                      <td><b style={{color:'#4338ca'}}>{inr(totalOnlineCourseWise)}</b></td>
                      <td><b style={{color:'#16a34a'}}>{inr(totalCashCourseWise)}</b></td>
                      <td><b style={{color:'var(--grn)'}}>{inr(totalCollectionCourseWise)}</b></td>
                      <td><b style={{color:'var(--red)'}}>{inr(T.bal)}</b></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
              <span className="muted" style={{fontSize:'12px'}}>{pay.length} receipts across {dayKeys.length} collection days</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid #16a34a'}}>
              Cash Received
              <b style={{fontSize:'18px',color:'var(--navy)'}}>{inr(totalDayCash)}</b>
              <span className="muted" style={{fontSize:'12px'}}>Direct cash collections</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid #4338ca'}}>
              Online Received
              <b style={{fontSize:'18px',color:'#4338ca'}}>{inr(totalDayOnline)}</b>
              <span className="muted" style={{fontSize:'12px'}}>UPI, Net Banking, QR</span>
            </div>
            <div className="card kpi" style={{borderLeft:'4px solid var(--gold)'}}>
              Average Collection per Day
              <b style={{color:'var(--navy)'}}>{inr(dayKeys.length ? Math.round(totalDayAll / dayKeys.length) : 0)}</b>
              <span className="muted" style={{fontSize:'12px'}}>Based on {dayKeys.length} active collection days</span>
            </div>
          </div>

          {/* Professional Daily Payment Collection Register */}
          <div className="sub-card">
            {/* Formal Report Header for Print and Display */}
            <div className="print-header">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <h2 style={{margin:0,fontSize:'18pt',color:'#0f172a',textTransform:'uppercase',letterSpacing:'0.5px'}}>D'code IAS Accounts</h2>
                  <h3 style={{margin:'2px 0 0',fontSize:'13pt',fontWeight:600,color:'#334155'}}>Daily Payment Collection Report / Register</h3>
                  <p style={{margin:'4px 0 0',fontSize:'9pt',color:'#64748b'}}>
                    Period: <b>{from ? toDmy(from) : 'All Recorded Dates'}</b> to <b>{to ? toDmy(to) : 'Present'}</b> | Filter: <b>{course ? (courses.find(c=>c[0]===course)?.[1] || 'Filtered Course') : 'All Courses'}</b>
                  </p>
                </div>
                <div style={{textAlign:'right',fontSize:'9pt',color:'#64748b'}}>
                  <div>Report Generated: <b>{toDmy(today())}</b></div>
                  <div>Status: <b>Official Financial Record</b></div>
                </div>
              </div>
            </div>

            {/* Action Bar (Hidden when printed) */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px',flexWrap:'wrap',gap:'8px'}}>
              <div>
                <span style={{fontWeight:700,color:'var(--navy)',fontSize:'15px'}}>
                  📅 Daily Payment Collection Report
                </span>
                <span className="muted" style={{fontSize:'12px',marginLeft:'8px'}}>
                  (Structured date-wise transactions with daily total amounts and overall summary)
                </span>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button 
                  type="button"
                  className="btn sm outline"
                  onClick={()=>window.print()}
                  style={{display:'inline-flex',alignItems:'center',gap:'4px'}}
                >
                  🖨️ Print Report
                </button>
                <button 
                  type="button"
                  className="btn sm gold" 
                  onClick={()=>exportXlsx(dayWiseGroupedExportRows, 'Daily_Payment_Collection_Report')}
                >
                  📥 Download Day-wise Excel
                </button>
              </div>
            </div>

            <div className="wrap">
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f1f5f9',color:'#0f172a'}}>
                    <th style={{textAlign:'center',width:'50px'}}>S.No</th>
                    <th style={{width:'100px'}}>Date</th>
                    <th>Student Name</th>
                    <th style={{width:'115px'}}>Phone Number</th>
                    <th>Course</th>
                    <th style={{textAlign:'center',width:'95px'}}>Payment Mode</th>
                    <th style={{width:'110px'}}>Trans ID</th>
                    <th style={{textAlign:'right',width:'100px'}}>Amount</th>
                    <th>Remarks</th>
                    <th style={{textAlign:'right',width:'140px'}}>Total Single Day Collection</th>
                  </tr>
                </thead>
                <tbody>
                  {dayKeys.length === 0 ? (
                    <tr><td colSpan="10" style={{textAlign:'center',padding:'24px',color:'#64748b'}}>No payment collection records found for the selected period.</td></tr>
                  ) : (
                    dayKeys.map((dateKey) => {
                      const group = dayMap[dateKey];
                      return (
                        <Fragment key={dateKey}>
                          {/* Payment entries for this date */}
                          {group.receipts.map((p, pIdx) => {
                            const stu = studentMap.get(p.studentId);
                            const mob = (stu && stu.mobile) || p.mobile || '';
                            return (
                              <tr key={p.id || pIdx}>
                                <td style={{textAlign:'center'}}><small>{pIdx + 1}</small></td>
                                <td><b>{toDmy(p.date)}</b></td>
                                <td className="student-name-tag">{p.studentName}</td>
                                <td>{mob ? <span className="mobile-badge">📞 {mob}</span> : ''}</td>
                                <td>{p.courseName}</td>
                                <td style={{textAlign:'center'}}>
                                  <span className="badge" style={{background: p.mode === 'online' ? '#e0e7ff' : '#f1f5fa', color: p.mode === 'online' ? '#4338ca' : '#1e293b'}}>
                                    {p.mode === 'online' ? 'Online' : 'Cash'}
                                  </span>
                                </td>
                                <td><small>{p.transId || '-'}</small></td>
                                <td style={{textAlign:'right'}}><b>{inr(p.amount)}</b></td>
                                <td><small>{p.remarks || '-'}</small></td>
                                <td></td>
                              </tr>
                            );
                          })}

                          {/* Total Amount row after each date's transactions */}
                          {/* Light background shading, bold formatting, remaining columns blank, value only */}
                          <tr style={{background:'#f8fafc',borderTop:'1px solid #cbd5e1',borderBottom:'1px solid #cbd5e1'}}>
                            <td></td>
                            <td><b style={{color:'var(--navy)'}}>{toDmy(dateKey)}</b></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style={{textAlign:'right',fontWeight:700,color:'var(--navy)',fontSize:'13px'}}>
                              {inr(group.total)}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })
                  )}

                  {/* Overall Grand Total Row at the Bottom of Table */}
                  {dayKeys.length > 0 && (
                    <tr className="total" style={{background:'#f1f5f9',borderTop:'2px solid #334155',borderBottom:'2px solid #334155'}}>
                      <td></td>
                      <td>
                        <b style={{color:'var(--navy)',fontSize:'13px'}}>OVERALL GRAND TOTAL</b>
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{textAlign:'right',fontWeight:800,color:'var(--navy)',fontSize:'15px'}}>
                        {inr(totalDayAll)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Final Overall Summary Section at the Bottom */}
            {dayKeys.length > 0 && (
              <div className="daily-report-summary" style={{marginTop:'22px',padding:'16px 20px',background:'#f8fafc',border:'1px solid #cbd5e1',borderRadius:'8px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
                  <h4 style={{margin:0,color:'var(--navy)',fontSize:'13px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>
                    📌 Final Overall Collections Summary
                  </h4>
                  <span className="muted" style={{fontSize:'12px'}}>
                    Verified against {dayKeys.length} collection days & {pay.length} total receipts
                  </span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))',gap:'12px'}}>
                  <div style={{background:'#ffffff',padding:'12px 14px',borderRadius:'6px',border:'1px solid #e2e8f0'}}>
                    <span className="muted" style={{fontSize:'11px',textTransform:'uppercase',display:'block'}}>Active Collection Days</span>
                    <b style={{fontSize:'16px',color:'var(--navy)'}}>{dayKeys.length} Days</b>
                  </div>
                  <div style={{background:'#ffffff',padding:'12px 14px',borderRadius:'6px',border:'1px solid #e2e8f0'}}>
                    <span className="muted" style={{fontSize:'11px',textTransform:'uppercase',display:'block'}}>Total Receipts Issued</span>
                    <b style={{fontSize:'16px',color:'var(--navy)'}}>{pay.length} Receipts</b>
                  </div>
                  <div style={{background:'#ffffff',padding:'12px 14px',borderRadius:'6px',border:'1px solid #e2e8f0'}}>
                    <span className="muted" style={{fontSize:'11px',textTransform:'uppercase',display:'block'}}>Total Cash Received</span>
                    <b style={{fontSize:'16px',color:'#16a34a'}}>{inr(totalDayCash)}</b>
                  </div>
                  <div style={{background:'#ffffff',padding:'12px 14px',borderRadius:'6px',border:'1px solid #e2e8f0'}}>
                    <span className="muted" style={{fontSize:'11px',textTransform:'uppercase',display:'block'}}>Total Online Received</span>
                    <b style={{fontSize:'16px',color:'#2563eb'}}>{inr(totalDayOnline)}</b>
                  </div>
                  <div style={{background:'#ffffff',padding:'12px 14px',borderRadius:'6px',border:'2px solid var(--navy)'}}>
                    <span className="muted" style={{fontSize:'11px',textTransform:'uppercase',display:'block',fontWeight:700,color:'var(--navy)'}}>Net Total Collection</span>
                    <b style={{fontSize:'18px',color:'var(--navy)'}}>{inr(totalDayAll)}</b>
                  </div>
                </div>
              </div>
            )}
          </div>
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
              * Fixed Imprest system: ₹20,000 float given to office boy. Daily micro-expenses deducted. Leftover balance returned to Admin and fresh ₹20,000 re-issued.
            </p>
          </div>

          {/* Petty Cash Imprest Cycles Audit Summary Table */}
          {cycles.length > 0 && (
            <div style={{marginBottom:'24px'}}>
              <h4 style={{margin:'0 0 8px',color:'var(--navy)'}}>🪙 Petty Cash Imprest Cycles Reconciliation History</h4>
              <Tbl
                rows={[...cycles].sort((a,b)=>(b.cycleNumber||0)-(a.cycleNumber||0)).map(c=>{
                  const cycleVouchers = expenses.filter(e => e.cycleId === c.id || (!e.cycleId && e.date >= c.startDate && (!c.endDate || e.date <= c.endDate)));
                  const cycleSpent = sum(cycleVouchers.map(v=>Number(v.amount)||0));
                  const returned = Number(c.returnedAmount || 0);
                  const floatAmt = Number(c.imprestAmount || 0);
                  const isClosed = c.status === 'closed';
                  const discrepancy = isClosed ? (floatAmt - (cycleSpent + returned)) : 0;
                  return {
                    'Cycle': `#${c.cycleNumber}`,
                    'Period': `${toDmy(c.startDate)} to ${c.endDate ? toDmy(c.endDate) : 'Active'}`,
                    'Custodian': c.custodianName,
                    'Imprest Given': floatAmt,
                    'Vouchers Spent': cycleSpent,
                    'Returned to Admin': returned,
                    'Audit Discrepancy': isClosed ? (discrepancy === 0 ? '✅ Balanced (₹0)' : `Discrepancy (₹${discrepancy})`) : 'Running',
                    'Status': isClosed ? 'SETTLED & CLOSED' : `ACTIVE (${inr(floatAmt - cycleSpent)} in hand)`
                  };
                })}
                name="petty_cash_imprest_cycles_reconciliation"
              />
            </div>
          )}

          {/* Itemized Petty Cash Spent Table */}
          <h4 style={{margin:'16px 0 8px',color:'var(--navy)'}}>🚩 Office Boy Petty Cash Vouchers Breakdown</h4>
          <Tbl
            rows={pettySpentList.map(e=>({
              'Date': toDmy(e.date),
              'Expense Item': e.itemName,
              'Amount': e.amount,
              'Payment Mode': e.mode === 'online' ? 'Online (UPI/QR)' : 'Cash',
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
