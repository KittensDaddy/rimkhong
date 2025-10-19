const api = path=>fetch('/api'+path).then(r=>r.json());

async function loadTables(){
  const tables = await api('/tables');
  const grid = document.getElementById('tables-grid'); grid.innerHTML='';
  tables.forEach(t=>{
    const d = document.createElement('div'); d.className='table-card';
    d.classList.add(t.status==='available' ? 'table-available' : (t.status==='paid' ? 'table-paid' : 'table-pending'));
    d.innerHTML = `<div>${t.name}</div><div>Id:${t.id}</div><button data-id="${t.id}">View</button>`;
    d.querySelector('button').addEventListener('click', ()=>showOrders(t.id));
    grid.appendChild(d);
  });
}

async function showOrders(tableId){
  const orders = await api(`/orders/${tableId}`);
  const panel = document.getElementById('orders-panel'); panel.innerHTML='';
  orders.forEach(o=>{
    const div = document.createElement('div'); div.className='menu-item';
    div.innerHTML = `<div><strong>Order ${o.id}</strong><div>${o.items.map(i=>i.name+' x'+i.qty).join(', ')}</div></div><div>${o.total}<div><button data-id="${o.id}">Mark Paid</button></div></div>`;
    div.querySelector('button').addEventListener('click', ()=>markPaid(o.id));
    panel.appendChild(div);
  });
}

async function markPaid(orderId){
  await fetch('/api/orders/'+orderId, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ status:'paid', payment_method:'cash' }) });
  await loadTables();
}

loadTables();
