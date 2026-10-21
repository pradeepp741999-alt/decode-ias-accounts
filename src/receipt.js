import {receiptHtml} from './receiptTemplate';
export function printReceipt(r){
  const w=window.open('','_blank','width=440,height=640');
  if(!w){alert('Allow pop-ups to print the receipt');return;}
  w.document.write(receiptHtml(r));w.document.close();w.focus();setTimeout(()=>w.print(),300);
}
