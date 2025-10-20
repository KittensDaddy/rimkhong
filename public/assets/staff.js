const api = path=>fetch('/api'+path).then(r=>r.json());

async function loadTables(){
  const tables = await api('/tables');
  const grid = document.getElementById('tables-grid'); grid.innerHTML='';
  tables.forEach(t=>{
    const d = document.createElement('div'); d.className='table-card';
  // color based on status: available (white), served (green), order pending (orange), paid (black)
  if(t.status === 'available') d.classList.add('table-available');
  else if(t.status === 'served') d.classList.add('table-served');
  else if(t.status === 'order_pending') d.classList.add('table-pending');
  else if(t.status === 'paid') d.classList.add('table-paid');
    // make whole card clickable to show details
    d.innerHTML = `<div>${t.name}</div><div>Status: <span class="table-status">${t.status}</span></div>`;
    d.addEventListener('click', ()=>showOrders(t.id));
    grid.appendChild(d);
  });
}

async function showOrders(tableId){
  const orders = await api(`/tables/${tableId}/orders`);
  const panel = document.getElementById('orders-panel'); panel.innerHTML='';
  const title = document.createElement('h3'); title.textContent = `รายการสั่งของโต๊ะ ${tableId}`; panel.appendChild(title);
  if(orders.length===0){ panel.appendChild(document.createElement('div')).textContent = 'ยังไม่มีรายการสั่ง'; }
  orders.forEach(o=>{
    const div = document.createElement('div'); div.className='menu-item';
    const itemsText = (o.items || []).map(i=>i.name+' x'+i.qty).join(', ');
    div.innerHTML = `<div><strong>Order ${o.id}</strong><div>${itemsText}</div></div><div>${Number(o.total).toFixed(2)}<div></div></div>`;
    // served toggle
  const servedBtn = document.createElement('button'); servedBtn.textContent = o.served ? 'เสิร์ฟแล้ว' : 'ทำเครื่องหมายว่าเสิร์ฟแล้ว';
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
  const paidBtn = document.createElement('button'); paidBtn.textContent='ชำระเงินทั้งหมด';
  paidBtn.addEventListener('click', async ()=>{
    const method = prompt('วิธีการชำระ (เช่น เงินสด, QR)', 'เงินสด');
    if(!method) return;
    const res = await fetch('/api/tables/'+tableId+'/mark-paid', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ payment_method: method }) });
    const j = await res.json();
    alert('ทำการบันทึกการชำระสำหรับ '+ (j.count||0) +' รายการ');
    await loadTables();
    panel.innerHTML = '';
  });
  paidWrap.appendChild(paidBtn);
  // show clean button only if table is paid
  const cleanBtn = document.createElement('button'); cleanBtn.textContent = 'เก็บโต๊ะแล้ว'; cleanBtn.style.marginLeft='8px';
  // check current table status
  const tinfo = await api('/tables');
  const cur = tinfo.find(x=>x.id===tableId);
  if(cur && cur.status === 'paid'){
    cleanBtn.addEventListener('click', async ()=>{
      const r = await fetch('/api/tables/'+tableId+'/clean', { method: 'POST' });
      const j = await r.json();
      alert('โต๊ะถูกเก็บเรียบร้อย');
      await loadTables();
      panel.innerHTML = '';
    });
    paidWrap.appendChild(cleanBtn);
  }
  panel.appendChild(paidWrap);
}

loadTables();
