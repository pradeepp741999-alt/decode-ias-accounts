import {useEffect,useState} from 'react';
import {initializeApp,getApps,getApp} from 'firebase/app';
import {createUserWithEmailAndPassword,getAuth,signOut} from 'firebase/auth';
import {addDoc,collection,doc,getDocs,setDoc,updateDoc} from 'firebase/firestore';
import {cfg,db,emailOf} from '../firebase';
const ROLES=[['fees','Fees entry'],['reports','Payment reports'],['both','Fees + reports'],['super_admin','Super admin']];
export default function Admin(){
  const [U,setU]=useState([]),[C,setC]=useState([]),[f,setF]=useState({name:'',username:'',password:'',role:'fees'}),[c,setCf]=useState({name:'',fee:''}),[msg,setMsg]=useState('');
  const load=async()=>{setU((await getDocs(collection(db,'users'))).docs.map(d=>({id:d.id,...d.data()})));
    setC((await getDocs(collection(db,'courses'))).docs.map(d=>({id:d.id,...d.data()})));};
  useEffect(()=>{load();},[]);
  const addUser=async e=>{e.preventDefault();setMsg('');
    try{const sec=getApps().find(a=>a.name==='sec')||initializeApp(cfg,'sec'),a=getAuth(sec);
      const r=await createUserWithEmailAndPassword(a,emailOf(f.username),f.password);await signOut(a);
      await setDoc(doc(db,'users',r.user.uid),{name:f.name,username:f.username.trim().toLowerCase(),role:f.role,active:true});
      setF({name:'',username:'',password:'',role:'fees'});setMsg('User created.');load();}catch(x){setMsg(x.message);}};
  const upd=(col,id,d)=>updateDoc(doc(db,col,id),d).then(load);
  const addCourse=async e=>{e.preventDefault();await addDoc(collection(db,'courses'),{name:c.name,fee:Number(c.fee),active:true});setCf({name:'',fee:''});load();};
  return <div><div className="card"><h2>Staff accounts</h2>
    <form onSubmit={addUser} className="grid2"><label>Name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/></label>
      <label>Username<input value={f.username} onChange={e=>setF({...f,username:e.target.value})} required/></label>
      <label>Password (min 6)<input type="text" minLength="6" value={f.password} onChange={e=>setF({...f,password:e.target.value})} required/></label>
      <label>Role<select value={f.role} onChange={e=>setF({...f,role:e.target.value})}>{ROLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <button className="btn gold">Create user</button></form><p className="muted">{msg}</p>
    <div className="wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead><tbody>{U.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.username}</td>
      <td><select value={u.role} onChange={e=>upd('users',u.id,{role:e.target.value})}>{ROLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
      <td><button className="btn sm" onClick={()=>upd('users',u.id,{active:!u.active})}>{u.active?'Active – disable':'Disabled – enable'}</button></td></tr>)}</tbody></table></div></div>
    <div className="card"><h2>Courses</h2><form onSubmit={addCourse} className="grid2"><label>Course name<input value={c.name} onChange={e=>setCf({...c,name:e.target.value})} required/></label>
      <label>Fee<input type="number" value={c.fee} onChange={e=>setCf({...c,fee:e.target.value})} required/></label><button className="btn gold">Add course</button></form>
    <div className="wrap"><table><thead><tr><th>Course</th><th>Fee</th><th>Status</th></tr></thead><tbody>{C.map(x=><tr key={x.id}><td>{x.name}</td>
      <td><input type="number" defaultValue={x.fee} onBlur={e=>Number(e.target.value)!==x.fee&&upd('courses',x.id,{fee:Number(e.target.value)})}/></td>
      <td><button className="btn sm" onClick={()=>upd('courses',x.id,{active:!x.active})}>{x.active?'Active – hide':'Hidden – show'}</button></td></tr>)}</tbody></table></div></div></div>;
}
