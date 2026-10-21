import * as XLSX from 'xlsx';
export const today=()=>new Date().toISOString().slice(0,10);
export const inr=n=>'₹'+Number(n||0).toLocaleString('en-IN');
export const calcNet=(fee,pct)=>Math.round((Number(fee)||0)*(1-(Number(pct)||0)/100)*100)/100;
export const calcBalance=(net,paid)=>Math.round((net-(Number(paid)||0))*100)/100;
export const can=(me,k)=>me&&(me.role==='super_admin'||me.role==='both'||me.role===k);
export const exportXlsx=(rows,name)=>{
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Report');XLSX.writeFile(wb,`${name}_${today()}.xlsx`);
};
