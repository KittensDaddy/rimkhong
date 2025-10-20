const api = path=>fetch('/api'+path).then(r=>r.json());

async function loadTables(){
  const tables = await api('/tables');
  const grid = document.getElementById('tables-grid'); grid.innerHTML='';
  tables.forEach(t=>{
    const d = document.createElement('div'); d.className='table-card';
    // color based on status: available (white), order pending (orange), paid (black)
    d.classList.add(t.status==='available' ? 'table-available' : (t.status==='paid' ? 'table-paid' : 'table-pending'));
    // make whole card clickable to show details
    d.innerHTML = `<div>${t.name}</div><div>Status: <span class="table-status">${t.status}</span></div>`;
    d.addEventListener('click', ()=>showOrders(t.id));
    grid.appendChild(d);
  });
}

async function showOrders(tableId){
  const orders = await api(`/tables/${tableId}/orders`);
  const panel = document.getElementById('orders-panel'); panel.innerHTML='';
  const title = document.createElement('h3'); title.textContent = `Table ${tableId} Orders`; panel.appendChild(title);
  if(orders.length===0){ panel.appendChild(document.createElement('div')).textContent = 'No orders'; }
  orders.forEach(o=>{
    const div = document.createElement('div'); div.className='menu-item';
    const itemsText = (o.items || []).map(i=>i.name+' x'+i.qty).join(', ');
    div.innerHTML = `<div><strong>Order ${o.id}</strong><div>${itemsText}</div></div><div>${Number(o.total).toFixed(2)}<div></div></div>`;
    // served toggle
    const servedBtn = document.createElement('button'); servedBtn.textContent = o.served ? 'Served' : 'Mark Served';
    servedBtn.style.marginLeft = '8px';
    servedBtn.addEventListener('click', async (ev)=>{
      ev.stopPropagation();
      await fetch('/api/orders/'+o.id+'/serve', { method:'POST' });
      showOrders(tableId);
      loadTables();
    });
    div.querySelector('div div').appendChild(servedBtn);
    panel.appendChild(div);
  });
  // mark paid button for the whole table (below detailed view)
  const paidWrap = document.createElement('div'); paidWrap.style.marginTop='12px';
  const paidBtn = document.createElement('button'); paidBtn.textContent='Mark All Paid';
  paidBtn.addEventListener('click', async ()=>{
    const method = prompt('Payment method? (cash or qr)', 'cash');
    if(!method) return;
    const res = await fetch('/api/tables/'+tableId+'/mark-paid', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ payment_method: method }) });
    const j = await res.json();
    alert('Marked paid for '+ (j.count||0) +' orders');
    await loadTables();
    panel.innerHTML = '';
  });
  paidWrap.appendChild(paidBtn);
  panel.appendChild(paidWrap);
}

loadTables();
