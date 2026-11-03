import {useEffect,useState} from 'react';
import {initializeApp,getApps,getApp} from 'firebase/app';
import {createUserWithEmailAndPassword,getAuth,signOut} from 'firebase/auth';
import {addDoc,collection,doc,getDoc,getDocs,setDoc,updateDoc} from 'firebase/firestore';
import {cfg,db,emailOf} from '../firebase';
import {inr} from '../util';

const ROLES=[
  ['fees','Fees entry & admissions'],
  ['reports','Payment & Expense reports'],
  ['both','Fees + Reports'],
  ['expense','General Expense & Petty Cash Manager'],
  ['petty_cash','Office Staff / Petty Cash Custodian'],
  ['super_admin','Super admin (Full access)']
];

const DEFAULT_REPORT_VIS = {
  showPendingChart: true,
  showDueDateCrossed: true,
  showIncomeVsExpense: true
};

export default function Admin({onBack}){
  const [U,setU]=useState([]),[C,setC]=useState([]);
  const [f,setF]=useState({name:'',username:'',password:'',role:'fees'});
  const [c,setCf]=useState({name:'',fee:''});
  const [msg,setMsg]=useState('');

  // Report tabs visibility control state
  const [reportVis, setReportVis] = useState(() => {
    try {
      const saved = localStorage.getItem('decode_report_visibility');
      return saved ? { ...DEFAULT_REPORT_VIS, ...JSON.parse(saved) } : DEFAULT_REPORT_VIS;
    } catch (e) {
      return DEFAULT_REPORT_VIS;
    }
  });
  const [visMsg, setVisMsg] = useState('');

  const load=async()=>{
    setU((await getDocs(collection(db,'users'))).docs.map(d=>({id:d.id,...d.data()})));
    setC((await getDocs(collection(db,'courses'))).docs.map(d=>({id:d.id,...d.data()})));
    try {
      const snap = await getDoc(doc(db, 'settings', 'report_visibility'));
      if (snap.exists()) {
        const data = snap.data();
        setReportVis(prev => ({ ...prev, ...data }));
        localStorage.setItem('decode_report_visibility', JSON.stringify(data));
      }
    } catch (_) {}
  };

  useEffect(()=>{load();},[]);

  const handleToggleReportVis = async (field, checked) => {
    const updated = { ...reportVis, [field]: checked };
    setReportVis(updated);
    try {
      localStorage.setItem('decode_report_visibility', JSON.stringify(updated));
      window.dispatchEvent(new Event('report_vis_changed'));
      await setDoc(doc(db, 'settings', 'report_visibility'), updated);
      setVisMsg('Saved successfully!');
      setTimeout(() => setVisMsg(''), 2500);
    } catch (err) {
      setVisMsg('Saved locally');
      setTimeout(() => setVisMsg(''), 2500);
    }
  };

  const addUser=async e=>{
    e.preventDefault();
    setMsg('');
    try{
      const sec=getApps().find(a=>a.name==='sec')||initializeApp(cfg,'sec'),a=getAuth(sec);
      const r=await createUserWithEmailAndPassword(a,emailOf(f.username),f.password);
      await signOut(a);
      await setDoc(doc(db,'users',r.user.uid),{name:f.name,username:f.username.trim().toLowerCase(),role:f.role,active:true});
      setF({name:'',username:'',password:'',role:'fees'});
      setMsg('User created successfully.');
      load();
    }catch(x){setMsg(x.message);}
  };

  const upd=(col,id,d)=>updateDoc(doc(db,col,id),d).then(load);

  const addCourse=async e=>{
    e.preventDefault();
    await addDoc(collection(db,'courses'),{name:c.name,fee:Number(c.fee),active:true});
    setCf({name:'',fee:''});
    load();
  };

  return (
    <div className="parent-card">
      <div className="parent-card-header">
        <div>
          <h2>⚙️ System Administration</h2>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            Manage staff login credentials, access permissions, and course offerings
          </p>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          {onBack && <button type="button" className="btn sm outline" onClick={onBack}>← Back to Dashboard Hub</button>}
          <span className="badge">Super Admin Only</span>
        </div>
      </div>

      {/* Sub-card 1: Staff Accounts */}
      <div className="sub-card">
        <h3>👥 Staff Accounts & Permissions</h3>
        <form onSubmit={addUser} className="grid2" style={{marginBottom:'14px'}}>
          <label>Staff Full Name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Priya Sharma" required/></label>
          <label>Username<input value={f.username} onChange={e=>setF({...f,username:e.target.value})} placeholder="e.g. priya" required/></label>
          <label>Password (min 6 chars)<input type="text" minLength="6" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Password" required/></label>
          <label>Staff Role<select value={f.role} onChange={e=>setF({...f,role:e.target.value})}>{ROLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <div style={{display:'flex',alignItems:'flex-end'}}>
            <button className="btn gold" style={{height:'40px'}}>Create User</button>
          </div>
        </form>
        {msg && <p className="muted" style={{fontWeight:600}}>{msg}</p>}

        <div className="wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Username</th><th>Assigned Role</th><th>Account Status</th></tr>
            </thead>
            <tbody>
              {U.map(u=>(
                <tr key={u.id}>
                  <td><b>{u.name}</b></td>
                  <td><code>{u.username}</code></td>
                  <td>
                    <select value={u.role} onChange={e=>upd('users',u.id,{role:e.target.value})}>
                      {ROLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className={`btn sm ${u.active?'':'gold'}`} onClick={()=>upd('users',u.id,{active:!u.active})}>
                      {u.active?'Active (Click to Disable)':'Disabled (Click to Enable)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-card 2: Course Management */}
      <div className="sub-card">
        <h3>📚 Course Offerings & Pricing</h3>
        <form onSubmit={addCourse} className="grid2" style={{marginBottom:'14px'}}>
          <label>New Course Name<input value={c.name} onChange={e=>setCf({...c,name:e.target.value})} placeholder="e.g. Ethics & Essay Masterclass" required/></label>
          <label>Course Fee (₹)<input type="number" min="0" value={c.fee} onChange={e=>setCf({...c,fee:e.target.value})} placeholder="e.g. 15000" required/></label>
          <div style={{display:'flex',alignItems:'flex-end'}}>
            <button className="btn gold" style={{height:'40px'}}>Add Course</button>
          </div>
        </form>

        <div className="wrap">
          <table>
            <thead>
              <tr><th>Course Name</th><th>Standard Fee (₹)</th><th>Visibility Status</th></tr>
            </thead>
            <tbody>
              {C.map(x=>(
                <tr key={x.id}>
                  <td><b>{x.name}</b></td>
                  <td>
                    <input
                      type="number"
                      defaultValue={x.fee}
                      onBlur={e=>Number(e.target.value)!==x.fee&&upd('courses',x.id,{fee:Number(e.target.value)})}
                      style={{width:'140px',display:'inline-block'}}
                    />
                  </td>
                  <td>
                    <button className={`btn sm ${x.active?'':'gold'}`} onClick={()=>upd('courses',x.id,{active:!x.active})}>
                      {x.active?'Active (Hide)':'Hidden (Show)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-card 3: Report Cards & Analytics Visibility Controls */}
      <div className="sub-card" style={{border:'2px solid #e2e8f0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px',flexWrap:'wrap',gap:'8px'}}>
          <div>
            <h3 style={{margin:0,color:'var(--navy)'}}>📊 Records & Reports Tabs Display Controls</h3>
            <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
              Control which advanced report tabs and analytics cards are visible to staff in the Records & Reports menu. Tick checkbox to show, uncheck to hide.
            </p>
          </div>
          {visMsg && (
            <span style={{fontSize:'12px',color:'#065f46',fontWeight:700,background:'#d1fae5',padding:'4px 12px',borderRadius:'16px',border:'1px solid #a7f3d0'}}>
              ✓ {visMsg}
            </span>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'12px',marginTop:'16px'}}>
          {/* Tab 1: Pending chart */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:'8px',border: reportVis.showPendingChart ? '1px solid #bbf7d0' : '1px solid #e2e8f0', background: reportVis.showPendingChart ? '#f0fdf4' : '#f8fafc',transition:'all 0.2s ease'}}>
            <label style={{display:'flex',alignItems:'center',gap:'14px',margin:0,cursor:'pointer',userSelect:'none',flex:1}}>
              <input 
                type="checkbox" 
                checked={reportVis.showPendingChart} 
                onChange={e=>handleToggleReportVis('showPendingChart', e.target.checked)}
                style={{width:'20px',height:'20px',accentColor:'var(--navy)',cursor:'pointer'}}
              />
              <div>
                <span style={{fontWeight:700,fontSize:'14px',color:'var(--navy)',display:'flex',alignItems:'center',gap:'6px'}}>
                  <span>📈</span> Pending chart
                </span>
                <p className="muted" style={{margin:'2px 0 0',fontSize:'12px'}}>
                  Visual comparative bar chart of pending fees by course with student name & mobile breakdown.
                </p>
              </div>
            </label>
            <span className="badge" style={{background: reportVis.showPendingChart ? '#dcfce7' : '#fee2e2', color: reportVis.showPendingChart ? '#15803d' : '#991b1b',fontWeight:700,padding:'4px 10px'}}>
              {reportVis.showPendingChart ? '✓ Shown in Reports' : '✕ Hidden from Staff'}
            </span>
          </div>

          {/* Tab 2: Due date crossed */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:'8px',border: reportVis.showDueDateCrossed ? '1px solid #bbf7d0' : '1px solid #e2e8f0', background: reportVis.showDueDateCrossed ? '#f0fdf4' : '#f8fafc',transition:'all 0.2s ease'}}>
            <label style={{display:'flex',alignItems:'center',gap:'14px',margin:0,cursor:'pointer',userSelect:'none',flex:1}}>
              <input 
                type="checkbox" 
                checked={reportVis.showDueDateCrossed} 
                onChange={e=>handleToggleReportVis('showDueDateCrossed', e.target.checked)}
                style={{width:'20px',height:'20px',accentColor:'var(--navy)',cursor:'pointer'}}
              />
              <div>
                <span style={{fontWeight:700,fontSize:'14px',color:'var(--navy)',display:'flex',alignItems:'center',gap:'6px'}}>
                  <span>⚠️</span> Due date crossed
                </span>
                <p className="muted" style={{margin:'2px 0 0',fontSize:'12px'}}>
                  Immediate tracker for students whose fees have crossed the scheduled due date with mobile numbers.
                </p>
              </div>
            </label>
            <span className="badge" style={{background: reportVis.showDueDateCrossed ? '#dcfce7' : '#fee2e2', color: reportVis.showDueDateCrossed ? '#15803d' : '#991b1b',fontWeight:700,padding:'4px 10px'}}>
              {reportVis.showDueDateCrossed ? '✓ Shown in Reports' : '✕ Hidden from Staff'}
            </span>
          </div>

          {/* Tab 3: Income vs Expenses & Petty Cash */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:'8px',border: reportVis.showIncomeVsExpense ? '1px solid #bbf7d0' : '1px solid #e2e8f0', background: reportVis.showIncomeVsExpense ? '#f0fdf4' : '#f8fafc',transition:'all 0.2s ease'}}>
            <label style={{display:'flex',alignItems:'center',gap:'14px',margin:0,cursor:'pointer',userSelect:'none',flex:1}}>
              <input 
                type="checkbox" 
                checked={reportVis.showIncomeVsExpense} 
                onChange={e=>handleToggleReportVis('showIncomeVsExpense', e.target.checked)}
                style={{width:'20px',height:'20px',accentColor:'var(--navy)',cursor:'pointer'}}
              />
              <div>
                <span style={{fontWeight:700,fontSize:'14px',color:'var(--navy)',display:'flex',alignItems:'center',gap:'6px'}}>
                  <span>🧾</span> Income vs Expenses & Petty Cash
                </span>
                <p className="muted" style={{margin:'2px 0 0',fontSize:'12px'}}>
                  Complete institutional accounting: Student fees inflow vs Expenses outflow, and Office Boy petty cash split & reconciliation.
                </p>
              </div>
            </label>
            <span className="badge" style={{background: reportVis.showIncomeVsExpense ? '#dcfce7' : '#fee2e2', color: reportVis.showIncomeVsExpense ? '#15803d' : '#991b1b',fontWeight:700,padding:'4px 10px'}}>
              {reportVis.showIncomeVsExpense ? '✓ Shown in Reports' : '✕ Hidden from Staff'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
