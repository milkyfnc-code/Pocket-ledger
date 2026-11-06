const DB_KEY = "pocket-ledger-v1";
const defaults = {
  currencies: [
    {code:"THB",name:"Thai Baht",rate:1},
    {code:"USD",name:"US Dollar",rate:35},
    {code:"JPY",name:"Japanese Yen",rate:0.23},
    {code:"EUR",name:"Euro",rate:38}
  ],
  transactions: []
};
let data = loadData();
let currentKind = "expense";
let editingId = null;

function loadData(){
  try {
    const raw = localStorage.getItem(DB_KEY);
    if(!raw) return structuredClone(defaults);
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed.currencies)||!Array.isArray(parsed.transactions)) return structuredClone(defaults);
    if(!parsed.currencies.some(c=>c.code==="THB")) parsed.currencies.unshift({code:"THB",name:"Thai Baht",rate:1});
    return parsed;
  } catch { return structuredClone(defaults); }
}
function persist(){ localStorage.setItem(DB_KEY, JSON.stringify(data)); render(); }
function money(n,code="THB"){
  const digits = code==="JPY"?0:2;
  return new Intl.NumberFormat("en-US",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(n)||0)+" "+code;
}
function thb(n){return "฿"+new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function rate(code){return data.currencies.find(c=>c.code===code)?.rate??1}
function total(kind){return data.transactions.filter(t=>!kind||t.kind===kind).reduce((s,t)=>s+(t.amount*t.rateSnapshot*(t.kind==="income"?1:-1)),0)}
function balance(code){return data.transactions.filter(t=>t.currency===code).reduce((s,t)=>s+(t.kind==="income"?t.amount:-t.amount),0)}
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2300)}
function dateLabel(v){return new Date(v).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})}
function txHTML(t){
  const sign=t.kind==="income"?"+":"−";
  return `<article class="transaction-row">
    <div class="transaction-icon ${t.kind==="expense"?"out":""}">${t.kind==="income"?"↙":"↗"}</div>
    <div class="row-main"><div class="row-title">${esc(t.category||"ทั่วไป")}</div><div class="row-sub">${esc(t.note||dateLabel(t.date))} · ${esc(t.currency)}</div><div class="row-sub">${dateLabel(t.date)} · เรท ${Number(t.rateSnapshot).toFixed(4)}</div></div>
    <div class="row-value ${t.kind==="income"?"positive":"negative"}">${sign}${money(t.amount,t.currency)}<span class="converted">${thb(t.amount*t.rateSnapshot)}</span><button class="text-button delete-tx" data-id="${t.id}">ลบ</button></div>
  </article>`;
}
function render(){
  document.getElementById("totalBalance").textContent=thb(total());
  document.getElementById("incomeTotal").textContent=thb(total("income"));
  document.getElementById("expenseTotal").textContent=thb(-total("expense"));
  const currHTML=data.currencies.map(c=>`<article class="currency-row"><div class="currency-code">${esc(c.code)}</div><div class="row-main"><div class="row-title">${esc(c.name)}</div><div class="row-sub">1 ${esc(c.code)} = ${Number(c.rate).toFixed(4)} THB</div></div><div class="row-value">${money(balance(c.code),c.code)}<span class="converted">${thb(balance(c.code)*c.rate)}</span></div></article>`).join("");
  document.getElementById("currencyBalances").innerHTML=currHTML||'<div class="empty">ยังไม่มีสกุลเงิน</div>';
  const sorted=[...data.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById("recentTransactions").innerHTML=sorted.slice(0,4).map(txHTML).join("")||'<div class="empty">ยังไม่มีรายการ กด ＋ เพื่อเริ่มบันทึก</div>';
  document.getElementById("allTransactions").innerHTML=sorted.map(txHTML).join("")||'<div class="empty">ยังไม่มีรายการ</div>';
  document.getElementById("transactionCount").textContent=`${sorted.length} รายการ`;
  document.getElementById("currencySettings").innerHTML=data.currencies.map(c=>`<article class="currency-row"><div class="currency-code">${esc(c.code)}</div><div class="row-main"><div class="row-title">${esc(c.name)}</div><div class="row-sub">${c.code==="THB"?"สกุลเงินหลัก":`1 ${esc(c.code)} เท่ากับกี่บาท`}</div></div><div class="rate-wrap">${c.code==="THB"?'<strong>1.0000</strong>':`<input class="rate-input" type="number" min="0.000001" step="any" value="${Number(c.rate)}" data-rate="${esc(c.code)}" aria-label="เรท ${esc(c.code)}">`}${c.code==="THB"?"":`<button class="delete-currency" data-code="${esc(c.code)}" aria-label="ลบ ${esc(c.code)}">×</button>`}</div></article>`).join("");
  const select=document.getElementById("transactionCurrency"), old=select.value;
  select.innerHTML=data.currencies.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} — ${esc(c.name)}</option>`).join("");
  if(data.currencies.some(c=>c.code===old))select.value=old;
  updateRatePreview();
}
function openTx(){
  editingId=null;currentKind="expense";
  document.getElementById("transactionTitle").textContent="เพิ่มรายการ";
  document.getElementById("transactionForm").reset();
  document.getElementById("category").value="ทั่วไป";
  const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
  document.getElementById("date").value=now.toISOString().slice(0,16);
  setKind("expense");render();document.getElementById("transactionDialog").showModal();
}
function setKind(kind){currentKind=kind;document.querySelectorAll(".segment").forEach(b=>b.classList.toggle("selected",b.dataset.kind===kind));}
function updateRatePreview(){const code=document.getElementById("transactionCurrency").value||"THB";document.getElementById("ratePreview").textContent=`เรทที่จะบันทึก: 1 ${code} = ${Number(rate(code)).toFixed(4)} THB`;}
function switchTab(tab){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  document.getElementById(tab+"Page").classList.remove("hidden");
  document.getElementById("floatingAdd").style.display=tab==="settings"||tab==="currencies"?"none":"block";
}
document.getElementById("quickAdd").onclick=openTx;
document.getElementById("floatingAdd").onclick=openTx;
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.goto)));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.close).close()));
document.querySelectorAll(".segment").forEach(b=>b.addEventListener("click",()=>setKind(b.dataset.kind)));
document.getElementById("transactionCurrency").addEventListener("change",updateRatePreview);
document.getElementById("transactionForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number(document.getElementById("amount").value),currency=document.getElementById("transactionCurrency").value;
  if(!Number.isFinite(amount)||amount<=0){toast("กรุณากรอกจำนวนเงินให้ถูกต้อง");return;}
  data.transactions.unshift({id:crypto.randomUUID(),kind:currentKind,amount,currency,rateSnapshot:rate(currency),category:document.getElementById("category").value.trim()||"ทั่วไป",note:document.getElementById("note").value.trim(),date:new Date(document.getElementById("date").value).toISOString()});
  persist();document.getElementById("transactionDialog").close();toast("บันทึกรายการแล้ว");
});
document.getElementById("addCurrency").onclick=()=>document.getElementById("currencyDialog").showModal();
document.getElementById("currencyForm").addEventListener("submit",e=>{
  e.preventDefault();const code=document.getElementById("newCode").value.trim().toUpperCase(),name=document.getElementById("newName").value.trim(),r=Number(document.getElementById("newRate").value);
  if(!/^[A-Z]{3}$/.test(code)||code==="THB"||data.currencies.some(c=>c.code===code)||!name||!Number.isFinite(r)||r<=0){toast("ตรวจสอบรหัสสกุลเงินและเรทอีกครั้ง");return;}
  data.currencies.push({code,name,rate:r});persist();document.getElementById("currencyDialog").close();document.getElementById("currencyForm").reset();toast("เพิ่มสกุลเงินแล้ว");
});
document.getElementById("currencySettings").addEventListener("change",e=>{
  if(!e.target.matches("[data-rate]"))return;
  const c=data.currencies.find(x=>x.code===e.target.dataset.rate),r=Number(e.target.value);
  if(!c||!Number.isFinite(r)||r<=0){toast("เรทต้องมากกว่า 0");render();return;}
  c.rate=r;persist();toast("อัปเดตเรทแล้ว · รายการเก่าไม่เปลี่ยน");
});
document.getElementById("currencySettings").addEventListener("click",e=>{
  const b=e.target.closest(".delete-currency");if(!b)return;
  const code=b.dataset.code;
  if(data.transactions.some(t=>t.currency===code)){toast("ลบไม่ได้: ยังมีรายการใช้สกุลเงินนี้");return;}
  if(confirm(`ต้องการลบ ${code} หรือไม่?`)){data.currencies=data.currencies.filter(c=>c.code!==code);persist();toast("ลบสกุลเงินแล้ว");}
});
document.body.addEventListener("click",e=>{
  const b=e.target.closest(".delete-tx");if(!b)return;
  if(confirm("ต้องการลบรายการนี้หรือไม่?")){data.transactions=data.transactions.filter(t=>t.id!==b.dataset.id);persist();toast("ลบรายการแล้ว");}
});
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.getElementById("exportBackup").onclick=()=>download("pocket-ledger-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({version:1,exportedAt:new Date().toISOString(),...data},null,2),"application/json");
document.getElementById("importBackup").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{const obj=JSON.parse(await file.text());if(!Array.isArray(obj.currencies)||!Array.isArray(obj.transactions)||!obj.currencies.some(c=>c.code==="THB"))throw Error();
    if(confirm("การนำเข้าจะแทนที่ข้อมูลปัจจุบันทั้งหมด ต้องการดำเนินการต่อหรือไม่?")){data={currencies:obj.currencies,transactions:obj.transactions};persist();toast("นำเข้าข้อมูลสำเร็จ");}
  }catch{toast("ไฟล์สำรองไม่ถูกต้อง");}e.target.value="";
});
document.getElementById("exportCSV").onclick=()=>{
  const rows=[["date","type","amount","currency","rate_to_thb_snapshot","amount_in_thb","category","note"],...data.transactions.map(t=>[t.date,t.kind,t.amount,t.currency,t.rateSnapshot,t.amount*t.rateSnapshot,t.category,t.note])];
  const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  download("pocket-ledger-transactions.csv",csv,"text/csv;charset=utf-8");
};
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));}
render();
