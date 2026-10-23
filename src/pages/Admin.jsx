import {useEffect,useState} from 'react';
import {initializeApp,getApps,getApp} from 'firebase/app';
import {createUserWithEmailAndPassword,getAuth,signOut} from 'firebase/auth';
import {addDoc,collection,doc,getDocs,setDoc,updateDoc} from 'firebase/firestore';
import {cfg,db,emailOf} from '../firebase';
import {inr} from '../util';

const ROLES=[['fees','Fees entry'],['reports','Payment reports'],['both','Fees + reports'],['petty_cash','Petty Cash / Office Staff'],['super_admin','Super admin']];

export default function Admin({onBack}){
  const [U,setU]=useState([]),[C,setC]=useState([]);
  const [f,setF]=useState({name:'',username:'',password:'',role:'fees'});
  const [c,setCf]=useState({name:'',fee:''});
  const [msg,setMsg]=useState('');

  const load=async()=>{
    setU((await getDocs(collection(db,'users'))).docs.map(d=>({id:d.id,...d.data()})));
    setC((await getDocs(collection(db,'courses'))).docs.map(d=>({id:d.id,...d.data()})));
  };

  useEffect(()=>{load();},[]);

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
    </div>
  );
}
