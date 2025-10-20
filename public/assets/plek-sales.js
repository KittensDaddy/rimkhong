async function loadSales(){
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const qs = new URLSearchParams();
  if(from) qs.set('from', from);
  if(to) qs.set('to', to);
  const res = await fetch('/api/reports/sales?' + qs.toString());
  const data = await res.json();
  const out = document.getElementById('results');
  if(!data || data.length===0){ out.innerHTML = '<p>ไม่พบรายการขาย</p>'; return; }
  let html = '<table class="sales-table"><thead><tr><th>เวลา</th><th>โต๊ะ</th><th>รายการ</th><th>รวม</th><th>วิธีชำระ</th></tr></thead><tbody>';
  for(const s of data){
    const paidAt = new Date(s.paid_at).toLocaleString('th-TH');
  let items = s.orders || [];
  if(typeof items === 'string') try{ items = JSON.parse(items); }catch(e){ items = []; }
  const itemsText = items.map(o=>('สั่ง: '+ (o.items?.map(i=>i.name+' x'+i.qty).join(', ') || JSON.stringify(o.items)) )).join('<br>');
    html += `<tr><td>${paidAt}</td><td>${s.table_id}</td><td>${itemsText}</td><td>${s.total}</td><td>${s.payment_method||''}</td></tr>`;
  }
  html += '</tbody></table>';
  out.innerHTML = html;
}

// set defaults to today
(function init(){
  const d = new Date();
  const iso = d.toISOString().slice(0,10);
  document.getElementById('from').value = iso;
  document.getElementById('to').value = iso;
  document.getElementById('load').addEventListener('click', loadSales);
  loadSales();
})();
