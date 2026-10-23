// EDIT THIS FILE to change the receipt format. r = receipt data.
export const receiptHtml=r=>`<html><head><title>Receipt</title><style>
body{font-family:Arial,sans-serif;padding:18px;width:360px;color:#111}
h2{margin:0;text-align:center;color:#0b2447}p.s{text-align:center;margin:2px 0 10px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:5px 0;border-bottom:1px dashed #bbb}
td:last-child{text-align:right;font-weight:bold}.sig{margin-top:36px;text-align:right;font-size:12px}
</style></head><body>
<h2>D'code IAS Academy</h2><p class="s">Block Z, 5th Ave, Anna Nagar, Chennai - 600040</p>
<table>
<tr><td>Receipt Date</td><td>${r.date}</td></tr>
<tr><td>Student</td><td>${r.name}</td></tr>
<tr><td>Father</td><td>${r.fatherName||'-'}</td></tr>
<tr><td>Mobile</td><td>${r.mobile}</td></tr>
<tr><td>Course</td><td>${r.courseName}</td></tr>
${r.courseFee&&r.discountAmt?`<tr><td>Course Fee</td><td>₹${r.courseFee}</td></tr><tr><td>Discount Amount</td><td>-₹${r.discountAmt}</td></tr>`:''}
<tr><td>Net Fee</td><td>₹${r.netFee}</td></tr>
<tr><td>Paid Now (${r.mode})</td><td>₹${r.amount}</td></tr>
${r.transId?`<tr><td>Transaction ID</td><td>${r.transId}</td></tr>`:''}
<tr><td>Total Paid</td><td>₹${r.totalPaid}</td></tr>
<tr><td>Balance</td><td>₹${r.balance}</td></tr>
${r.nextDueDate?`<tr><td>Next Due Date</td><td>${r.nextDueDate}</td></tr>`:''}
</table><div class="sig">Authorised Signature</div></body></html>`;
