// npm run seed  (needs serviceAccountKey.json in project root)
import admin from 'firebase-admin';
import {readFileSync} from 'fs';
admin.initializeApp({credential:admin.credential.cert(JSON.parse(readFileSync('./serviceAccountKey.json','utf8')))});
const auth=admin.auth(), db=admin.firestore();
const username='admin', password='ChangeMe@123', email=`${username}@decodeias.app`;
let u; try{u=await auth.getUserByEmail(email);}catch{u=await auth.createUser({email,password});}
await db.doc(`users/${u.uid}`).set({name:'Super Admin',username,role:'super_admin',active:true});
for(const [name,fee] of [['UPSC Prelims + Mains',80000],['TNPSC Group 4',8000],['TNPSC Group 1',25000]])
  await db.collection('courses').add({name,fee,active:true});
/* Collections (created on first write):
 users{name,username,role,active}  courses{name,fee,active}
 students{date,name,fatherName,mobile,courseId,courseName,courseFee,discountPct,netFee,totalPaid,balance,nextDueDate,remarks,createdBy,createdAt}
 payments{studentId,studentName,courseId,courseName,date,amount,mode,transId,nextDueDate,remarks,createdBy,createdAt} */
console.log('Seeded. Login: admin / '+password);process.exit();
