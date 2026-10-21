import {useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {doc,getDoc} from 'firebase/firestore';
import {auth,db,emailOf,isMock} from './firebase';
import {can} from './util';
import Enroll from './pages/Enroll';import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';import Admin from './pages/Admin';

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

  return <div className="login"><form onSubmit={go} className="card" style={{width:'360px'}}>
    <h1>D'code IAS</h1><p className="muted">Fees Manager – staff login</p>
    {isMock&&<div style={{background:'#eef4ff',border:'1px solid #c7d8f9',borderRadius:'6px',padding:'10px',marginBottom:'12px',fontSize:'12px',color:'#19376d'}}>
      <b>Mock Mode Active</b>
      <p style={{margin:'4px 0 6px'}}>Quick test accounts (password: <code>ChangeMe@123</code>):</p>
      <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
        <button type="button" className="btn sm" onClick={()=>quickFill('admin')} title="Super Admin role">admin</button>
        <button type="button" className="btn sm" onClick={()=>quickFill('fees')} title="Fees entry role">fees</button>
        <button type="button" className="btn sm" onClick={()=>quickFill('reports')} title="Reports role">reports</button>
        <button type="button" className="btn sm" onClick={()=>quickFill('both')} title="Both fees + reports">both</button>
      </div>
    </div>}
    <label>Username<input value={u} onChange={e=>setU(e.target.value)} required/></label>
    <label>Password<input type="password" value={p} onChange={e=>setP(e.target.value)} required/></label>
    {err&&<div className="err">{err}</div>}<button className="btn" style={{marginTop:'12px'}}>Sign in</button></form></div>;
}

export default function App(){
  const [me,setMe]=useState(undefined),[tab,setTab]=useState('');
  useEffect(()=>onAuthStateChanged(auth,async f=>{
    if(!f){setMe(null);return;}
    const s=await getDoc(doc(db,'users',f.uid));const d=s.exists()?s.data():null;
    if(!d||!d.active){await signOut(auth);setMe(null);alert('Account disabled or not found.');return;}
    setMe({...d,uid:f.uid});
    setTab(d.role==='reports'?'reports':'dash');
  }),[]);

  const handleResetData = () => {
    if (window.confirm('Reset mock database to initial sample data?')) {
      window.localStorage.removeItem('decode_ias_mock_db_v1');
      window.location.reload();
    }
  };

  if(me===undefined)return <div className="login" style={{color:'#fff'}}>Loading…</div>;
  if(!me)return <Login/>;
  const tabs=[can(me,'fees')&&['dash','Dashboard'],can(me,'fees')&&['enroll','New student'],
    can(me,'reports')&&['reports','Reports'],me.role==='super_admin'&&['admin','Admin']].filter(Boolean);
  return <div><header><b>D'code IAS</b><nav>{tabs.map(([k,l])=>
      <button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</nav>
    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
      {isMock&&<span style={{background:'#d4a017',color:'#0b2447',padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'bold'}}>MOCK MODE</span>}
      {isMock&&<button className="link" style={{fontSize:'12px',textDecoration:'underline'}} onClick={handleResetData}>Reset Data</button>}
      <span>{me.name} ({me.role}) <button className="link" onClick={()=>signOut(auth)}>Sign out</button></span>
    </div></header>
    <main>{tab==='dash'&&<Dashboard me={me}/>}{tab==='enroll'&&<Enroll me={me} done={()=>setTab('dash')}/>}
    {tab==='reports'&&<Reports/>}{tab==='admin'&&<Admin/>}</main></div>;
}
