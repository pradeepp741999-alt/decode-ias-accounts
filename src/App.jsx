import {useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {doc,getDoc} from 'firebase/firestore';
import {auth,db,emailOf,isMock} from './firebase';
import {can} from './util';
import Enroll from './pages/Enroll';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Expense from './pages/Expense';

function Login(){
  const [u,setU]=useState('admin'),[p,setP]=useState('ChangeMe@123'),[err,setErr]=useState('');
  const go=async e=>{
    if(e) e.preventDefault();
    setErr('');
    try{await signInWithEmailAndPassword(auth,emailOf(u),p);}catch(err){setErr(err.message || 'Wrong username or password.');}
  };
  const quickFill=(user)=>{
    setU(user);
    setP('ChangeMe@123');
  };

  return (
    <div className="login">
      <form onSubmit={go} className="card" style={{width:'360px'}}>
        <h1>D'code IAS</h1>
        <p className="muted">Fees & Accounts Management</p>
        {isMock && (
          <div style={{background:'#eef4ff',border:'1px solid #c7d8f9',borderRadius:'6px',padding:'10px',marginBottom:'12px',fontSize:'12px',color:'#19376d'}}>
            <b>Mock Mode Active</b>
            <p style={{margin:'4px 0 6px'}}>Quick test accounts (password: <code>ChangeMe@123</code>):</p>
            <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
              <button type="button" className="btn sm" onClick={()=>quickFill('admin')} title="Super Admin role">admin</button>
              <button type="button" className="btn sm" onClick={()=>quickFill('fees')} title="Fees entry role">fees</button>
              <button type="button" className="btn sm" onClick={()=>quickFill('reports')} title="Reports role">reports</button>
              <button type="button" className="btn sm" onClick={()=>quickFill('both')} title="Both fees + reports">both</button>
              <button type="button" className="btn sm" onClick={()=>quickFill('petty')} title="Office Boy / Petty cash role">petty</button>
            </div>
          </div>
        )}
        <label>Username<input value={u} onChange={e=>setU(e.target.value)} required/></label>
        <label>Password<input type="password" value={p} onChange={e=>setP(e.target.value)} required/></label>
        {err&&<div className="err">{err}</div>}
        <button className="btn" style={{marginTop:'12px'}}>Sign in</button>
      </form>
    </div>
  );
}

function DashboardHub({me, onSelect}){
  // Rights-based module cards
  const canFees = can(me, 'fees');
  const canReports = can(me, 'reports');
  const isAdmin = me.role === 'super_admin';

  const cards = [
    canFees && {
      id: 'enroll',
      icon: '👨‍🎓',
      title: 'New Student',
      tag: 'Admission & Fees Entry',
      desc: 'Enrol new student admissions, calculate course discounts, register first payment installment, and print receipts.'
    },
    canFees && {
      id: 'dash',
      icon: '💳',
      title: 'Fees Management',
      tag: 'Dues & Installments',
      desc: 'View pending fee dues, overdue calendar, search students by name or mobile number, and collect subsequent installments.'
    },
    canReports && {
      id: 'reports',
      icon: '📊',
      title: 'Records',
      tag: 'Financial Reports',
      desc: 'Summary & course-wise breakdown, student pending list with mobile numbers, cash/online collection logs, charts, and overdue tracking.'
    },
    {
      id: 'expense',
      icon: '🧾',
      title: 'General Expense',
      tag: 'Debits & Petty Cash',
      desc: 'Record daily institutional debit payouts (EB bill, room rent, water bill), manage items, and track office boy petty cash.'
    },
    isAdmin && {
      id: 'admin',
      icon: '⚙️',
      title: 'System Admin',
      tag: 'Staff & Course Setup',
      desc: 'Create and manage staff logins, modify permissions and roles, configure course catalog offerings and course fees.'
    }
  ].filter(Boolean);

  return (
    <div className="parent-card">
      <div className="parent-card-header">
        <div>
          <h2>🏛️ Main Dashboard Hub</h2>
          <p className="muted" style={{margin:'4px 0 0',fontSize:'13px'}}>
            Welcome, <b>{me.name}</b> ({me.role})! Select an activity card below to open its module:
          </p>
        </div>
        <span className="badge">Role: {me.role}</span>
      </div>

      <div className="hub-grid">
        {cards.map(c=>(
          <div key={c.id} className="hub-card" onClick={()=>onSelect(c.id)}>
            <div>
              <div className="hub-icon">{c.icon}</div>
              <span className="count-tag" style={{marginBottom:'8px'}}>{c.tag}</span>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
            <div className="hub-action">
              <span>Open {c.title}</span>
              <span>→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App(){
  const [me,setMe]=useState(undefined);
  const [tab,setTab]=useState('hub');

  useEffect(()=>onAuthStateChanged(auth,async f=>{
    if(!f){setMe(null);return;}
    const s=await getDoc(doc(db,'users',f.uid));
    const d=s.exists()?s.data():null;
    if(!d||!d.active){
      await signOut(auth);
      setMe(null);
      alert('Account disabled or not found.');
      return;
    }
    setMe({...d,uid:f.uid});
    // Redirect to the main Dashboard Hub card view on sign-in
    setTab('hub');
  }),[]);

  const handleResetData = () => {
    if (window.confirm('Reset mock database to initial sample data?')) {
      window.localStorage.removeItem('decode_ias_mock_db_v1');
      window.location.reload();
    }
  };

  if(me===undefined)return <div className="login" style={{color:'#fff'}}>Loading…</div>;
  if(!me)return <Login/>;

  // Rights-based navigation tabs
  const tabs=[
    ['hub','🏠 Dashboard Hub'],
    can(me,'fees')&&['enroll','New Student'],
    can(me,'fees')&&['dash','Fees Management'],
    can(me,'reports')&&['reports','Records'],
    ['expense','General Expense'],
    me.role==='super_admin'&&['admin','Admin']
  ].filter(Boolean);

  return (
    <div>
      <header>
        <b>D'code IAS</b>
        <nav>
          {tabs.map(([k,l])=>(
            <button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>
              {l}
            </button>
          ))}
        </nav>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {isMock && <span style={{background:'#d4a017',color:'#0b2447',padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'bold'}}>MOCK MODE</span>}
          {isMock && <button className="link" style={{fontSize:'12px',textDecoration:'underline'}} onClick={handleResetData}>Reset Data</button>}
          <span>{me.name} ({me.role}) <button className="link" onClick={()=>signOut(auth)}>Sign out</button></span>
        </div>
      </header>

      <main>
        {tab==='hub' && <DashboardHub me={me} onSelect={setTab}/>}
        {tab==='enroll' && <Enroll me={me} done={()=>setTab('dash')} onBack={()=>setTab('hub')}/>}
        {tab==='dash' && <Dashboard me={me} onBack={()=>setTab('hub')}/>}
        {tab==='reports' && <Reports onBack={()=>setTab('hub')}/>}
        {tab==='expense' && <Expense me={me} onBack={()=>setTab('hub')}/>}
        {tab==='admin' && <Admin onBack={()=>setTab('hub')}/>}
      </main>
    </div>
  );
}
