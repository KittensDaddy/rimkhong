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
    const thaiStatus = t.status === 'available' ? 'โต๊ะว่าง' : (t.status === 'order_pending' ? 'อาหารรอเสิร์ฟ' : (t.status === 'paid' ? 'เก็บเงินแล้ว' : t.status));
    d.innerHTML = `<div>${t.name}</div><div>${thaiStatus}</div>`;
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
    // create modal area inside panel
    const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.left='0'; modal.style.top='0'; modal.style.right='0'; modal.style.bottom='0'; modal.style.background='rgba(0,0,0,0.4)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center';
    const box = document.createElement('div'); box.style.background='#fff'; box.style.padding='16px'; box.style.borderRadius='8px'; box.style.width='320px';
    box.innerHTML = `<h3>เลือกวิธีการชำระ</h3><div style="display:flex;gap:8px;margin-top:8px"><button id="pay-cash">เงินสด</button><button id="pay-qr">QR</button><button id="pay-cancel" style="margin-left:8px">ยกเลิก</button></div>`;
    modal.appendChild(box); document.body.appendChild(modal);
    modal.querySelector('#pay-cancel').addEventListener('click', ()=> modal.remove());

    modal.querySelector('#pay-cash').addEventListener('click', async ()=>{
      // calculate total from current unpaid orders
      const orders = await api(`/tables/${tableId}/orders`);
      const total = (orders || []).reduce((s,o)=>s + Number(o.total||0), 0);
      box.innerHTML = `<h3>สรุปการชำระ (เงินสด)</h3><div>จำนวนรายการ: ${(orders||[]).length}</div><div>ยอดรวม: <strong>${total.toFixed(2)} ฿</strong></div><div style="margin-top:12px"><button id="confirm-cash">รับเงินแล้ว</button><button id="cancel-cash" style="margin-left:8px">ยกเลิก</button></div>`;
      box.querySelector('#cancel-cash').addEventListener('click', ()=> modal.remove());
      box.querySelector('#confirm-cash').addEventListener('click', async ()=>{
        const res = await fetch('/api/tables/'+tableId+'/mark-paid', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ payment_method: 'cash' }) });
        const j = await res.json();
        alert('ทำการบันทึกการชำระสำหรับ '+ (j.count||0) +' รายการ');
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
        alert('ทำการบันทึกการชำระสำหรับ '+ (j.count||0) +' รายการ');
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
      alert('โต๊ะถูกเก็บเรียบร้อย');
      await loadTables();
      panel.innerHTML = '';
    });
    paidWrap.appendChild(cleanBtn);
  }
  panel.appendChild(paidWrap);
}

loadTables();
