import * as XLSX from 'xlsx';
export const today=()=>new Date().toISOString().slice(0,10);
export const inr=n=>'₹'+Number(n||0).toLocaleString('en-IN');
export const calcNet=(fee,discount)=>Math.max(0,Math.round(((Number(fee)||0)-(Number(discount)||0))*100)/100);
export const calcBalance=(net,paid)=>Math.round((net-(Number(paid)||0))*100)/100;
export const can=(me,k)=>{
  if(!me)return false;
  if(me.role==='super_admin')return true;
  if(k==='expense')return true;
  if(me.role==='both')return k==='fees'||k==='reports'||k==='expense'||k==='petty_cash';
  if(me.role==='fees')return k==='fees'||k==='expense';
  if(me.role==='reports')return k==='reports'||k==='expense';
  if(me.role==='petty_cash')return k==='expense'||k==='petty_cash';
  return me.role===k;
};
export const toDmy=(d)=>{
  if(!d)return'-';
  const parts=String(d).split('-');
  return(parts.length===3&&parts[0].length===4)?`${parts[2]}-${parts[1]}-${parts[0]}`:d;
};
export const exportXlsx=(rows,name)=>{
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Report');XLSX.writeFile(wb,`${name}_${today()}.xlsx`);
};
