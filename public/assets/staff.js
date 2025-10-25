const api = path=>fetch('/api'+path).then(r=>r.json());

// lightweight toast utility (non-blocking)
function showToast(msg, timeout = 2500){
  try{
    let container = document.getElementById('toast-container');
    if(!container){ container = document.createElement('div'); container.id = 'toast-container'; container.style.position = 'fixed'; container.style.bottom = '20px'; container.style.right = '20px'; container.style.zIndex = '9999'; document.body.appendChild(container); }
    const t = document.createElement('div');
    t.className = 'toast-msg';
    t.textContent = msg;
    t.style.background = 'rgba(0,0,0,0.8)';
    t.style.color = 'white';
    t.style.padding = '8px 12px';
    t.style.borderRadius = '6px';
    t.style.marginTop = '8px';
    t.style.opacity = '0';
    t.style.transition = 'opacity 200ms ease';
    container.appendChild(t);
    void t.offsetWidth;
    t.style.opacity = '1';
    setTimeout(()=>{ t.style.opacity = '0'; setTimeout(()=>{ t.remove(); if(container.children.length===0) container.remove(); }, 250); }, timeout);
  }catch(e){ console.warn('Could not show toast', e); }
}

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
    const thaiStatus = t.status === 'available' ? 'โต๊ะว่าง' : (t.status === 'order_pending' ? 'อาหารรอเสิร์ฟ' : (t.status === 'paid' ? 'เก็บเงินแล้ว' : t.status));
    d.innerHTML = `<div>${t.name}</div><div>${thaiStatus}</div>`;
    d.addEventListener('click', ()=>showOrders(t.id));
    grid.appendChild(d);
  });
}

let CURRENT_OPEN_TABLE = null;
async function showOrders(tableId){
  CURRENT_OPEN_TABLE = tableId;
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
    // create modal area inside panel
    const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.left='0'; modal.style.top='0'; modal.style.right='0'; modal.style.bottom='0'; modal.style.background='rgba(0,0,0,0.4)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center';
    const box = document.createElement('div'); box.style.background='#fff'; box.style.padding='16px'; box.style.borderRadius='8px'; box.style.width='320px';
    box.innerHTML = `<h3>เลือกวิธีการชำระ</h3><div style="display:flex;gap:8px;margin-top:8px"><button id="pay-cash">เงินสด</button><button id="pay-qr">QR</button><button id="pay-cancel" style="margin-left:8px">ยกเลิก</button></div>`;
    modal.appendChild(box); document.body.appendChild(modal);
    modal.querySelector('#pay-cancel').addEventListener('click', ()=> modal.remove());

    modal.querySelector('#pay-cash').addEventListener('click', async ()=>{
      // calculate total from current unpaid orders and aggregate identical menu items
      const orders = await api(`/tables/${tableId}/orders`);
      // orders are per-item rows, but each order may contain an items array with one element
      const flatItems = [];
      (orders || []).forEach(o=>{
        const items = Array.isArray(o.items) ? o.items : (o.items && JSON.parse(o.items)) || [];
        items.forEach(it=> flatItems.push({ id: it.id, name: it.name, price: Number(it.price || 0) }));
      });
      // aggregate by id (fallback to name)
      const agg = {};
      flatItems.forEach(it=>{
        const key = it.id != null ? String(it.id) : it.name;
        if(!agg[key]) agg[key] = { id: it.id, name: it.name, price: it.price, qty: 0 };
        agg[key].qty += 1;
      });
      const lines = Object.values(agg);
      const total = lines.reduce((s,l)=> s + l.price * l.qty, 0);
      // build summary HTML with merged lines
      let listHtml = '<ul style="padding-left:16px;margin-top:8px">';
      lines.forEach(l=>{ listHtml += `<li>${escapeHtml(l.name)} x${l.qty} — ${(l.price * l.qty).toFixed(2)} ฿</li>`; });
      listHtml += '</ul>';
      box.innerHTML = `<h3>สรุปการชำระ (เงินสด)</h3><div>จำนวนรายการรวม: ${lines.reduce((s,l)=>s+l.qty,0)}</div>${listHtml}<div>ยอดรวม: <strong>${total.toFixed(2)} ฿</strong></div><div style="margin-top:12px"><button id="confirm-cash">รับเงินแล้ว</button><button id="cancel-cash" style="margin-left:8px">ยกเลิก</button></div>`;
      box.querySelector('#cancel-cash').addEventListener('click', ()=> modal.remove());
      box.querySelector('#confirm-cash').addEventListener('click', async ()=>{
        const res = await fetch('/api/tables/'+tableId+'/mark-paid', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ payment_method: 'cash' }) });
  const j = await res.json();
  showToast('ทำการบันทึกการชำระสำหรับ '+ (j.count||0) +' รายการ', 2600);
        modal.remove(); await loadTables(); panel.innerHTML='';
      });
    });

    modal.querySelector('#pay-qr').addEventListener('click', async ()=>{
      // fetch payment info and show QR
      const info = await api('/payment-info');
      if(!info){ box.innerHTML = `<h3>QR ไม่พร้อมใช้งาน</h3><div>ยังไม่ได้ตั้งค่า QR</div><div style="margin-top:12px"><button id="cancel-qr">ปิด</button></div>`; box.querySelector('#cancel-qr').addEventListener('click', ()=> modal.remove()); return; }
      box.innerHTML = `<h3>ชำระด้วย QR</h3><div>${info.account_name || ''} - ${info.bank || ''}</div><div id="qr-holder" style="margin-top:8px"></div><div style="margin-top:12px"><button id="confirm-qr">รับเงินแล้ว</button><button id="cancel-qr" style="margin-left:8px">ยกเลิก</button></div>`;
      const qrHolder = box.querySelector('#qr-holder');
      // show PNG QR image
      const img = document.createElement('img'); img.style.width='200px'; img.style.height='200px'; img.alt='QR';
      img.src = '/api/payment-info/' + info.id + '/qr';
      qrHolder.appendChild(img);
      box.querySelector('#cancel-qr').addEventListener('click', ()=> modal.remove());
      box.querySelector('#confirm-qr').addEventListener('click', async ()=>{
        const res = await fetch('/api/tables/'+tableId+'/mark-paid', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ payment_method: 'qr' }) });
  const j = await res.json();
  showToast('ทำการบันทึกการชำระสำหรับ '+ (j.count||0) +' รายการ', 2600);
        modal.remove(); await loadTables(); panel.innerHTML='';
      });
    });
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
  showToast('โต๊ะถูกเก็บเรียบร้อย', 2200);
  await loadTables();
  panel.innerHTML = '';
    });
    paidWrap.appendChild(cleanBtn);
  }
  panel.appendChild(paidWrap);
}

loadTables();

// real-time socket: staff listens for table/order changes
try{
  const socket = io();
  socket.on('connect', ()=>{ socket.emit('joinStaff'); });
  socket.on('tables:update', (data)=>{ /* refresh table overview */ loadTables(); });
  socket.on('orders:created', (data)=>{ if(data && data.table_id){ loadTables(); if(CURRENT_OPEN_TABLE === data.table_id) showOrders(CURRENT_OPEN_TABLE); } });
  socket.on('orders:updated', (data)=>{ if(data && data.order && data.order.table_id){ loadTables(); if(CURRENT_OPEN_TABLE === data.order.table_id) showOrders(CURRENT_OPEN_TABLE); } });
  socket.on('orders:cleared', (data)=>{ if(data && data.table_id){ loadTables(); if(CURRENT_OPEN_TABLE === data.table_id) showOrders(CURRENT_OPEN_TABLE); } });
  socket.on('table:paid', (data)=>{ if(data && data.table_id){ loadTables(); if(CURRENT_OPEN_TABLE === data.table_id) showOrders(CURRENT_OPEN_TABLE); } });
}catch(e){ console.warn('Socket.io not available', e); }

// keep the table overview fresh: poll every 5 seconds
setInterval(() => {
  try{ loadTables(); }catch(e){ console.warn('loadTables poll failed', e); }
}, 5000);

// small helper to escape HTML
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
