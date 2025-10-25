const api = path => fetch('/api' + path).then(r=>r.json());

function fmtDateTime(ts){
  if(!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('th-TH');
}

function toISODate(d){
  return d.toISOString().slice(0,10);
}

async function loadSales(){
  const from = document.getElementById('from-date').value;
  const to = document.getElementById('to-date').value;
  const f = from || toISODate(new Date());
  const t = to || toISODate(new Date());
  const rows = await api(`/reports/sales?from=${f}&to=${t}`);
  const tbody = document.querySelector('#report-table tbody'); tbody.innerHTML = '';
  if(!rows || rows.length===0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="muted">ไม่พบรายการขาย</td>';
    tbody.appendChild(tr);
    return;
  }
  (rows || []).forEach(r=>{
    const tr = document.createElement('tr');
    // orders may be an array of order objects; aggregate identical menu items across all orders
    let ordersText = '';
    try{
      const orders = r.orders || [];
      // aggregate items by id or name
      const agg = {};
      (orders || []).forEach(o=>{
        const items = o.items || [];
        (items || []).forEach(i=>{
          const key = (i.id != null ? String(i.id) : (i.name || i.item || '')).trim();
          if(!key) return;
          if(!agg[key]) agg[key] = { name: i.name || i.item || key, qty: 0 };
          agg[key].qty += Number(i.qty || 1);
        });
      });
      const parts = Object.values(agg).map(a=> `${a.name} x${a.qty}`);
      ordersText = parts.join(', ');
      if(!ordersText){
        // fallback: show raw orders if aggregation produced nothing
        ordersText = (orders || []).map(o=> JSON.stringify(o)).join(' | ');
      }
    }catch(e){ ordersText = '' }
    tr.innerHTML = `<td>${fmtDateTime(r.paid_at)}</td><td>${r.table_id}</td><td>${r.payment_method || ''}</td><td>${Number(r.total || 0).toFixed(2)}</td><td>${escapeHtml(ordersText)}</td>`;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

window.addEventListener('DOMContentLoaded', ()=>{
  const today = new Date();
  document.getElementById('from-date').value = toISODate(today);
  document.getElementById('to-date').value = toISODate(today);
  document.getElementById('refresh').addEventListener('click', loadSales);
  loadSales();
});
