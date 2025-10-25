const API = '/api';

async function apiGet(path){
  const res = await fetch(API+path);
  return res.json();
}

// small toast utility so we don't block the UI with alert()
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
    // force a reflow then show
    void t.offsetWidth;
    t.style.opacity = '1';
    setTimeout(()=>{ t.style.opacity = '0'; setTimeout(()=>{ t.remove(); if(container.children.length===0) container.remove(); }, 250); }, timeout);
  }catch(e){ console.warn('Could not show toast', e); }
}

function parsePath(){
  const parts = location.pathname.split('/').filter(Boolean);
  if(parts[0]==='table' && parts[1]) return { table: parseInt(parts[1],10), token: parts[2] };
  const p = new URLSearchParams(location.search);
  return { table: parseInt(p.get('table')||'1',10), token: p.get('token') || null };
}

const PATH = parsePath();
let CART = { items: [], table: PATH.table, token: PATH.token };

let CURRENT_CATEGORY = null;
let SOCKET = null;
function markCategorySelected(){ document.querySelectorAll('#categories button').forEach(btn=>{ btn.classList.toggle('selected', btn.textContent===CURRENT_CATEGORY); }); }
function renderCategories(categories){
  const el = document.getElementById('categories');
  el.innerHTML = '';
  const hiddenCategory = 'ชุดเปิดเตา (บังคับเลือก)';
  categories.filter(c=>c!==hiddenCategory).forEach(c=>{
    const b=document.createElement('button'); b.textContent=c; b.onclick=()=>{ CURRENT_CATEGORY=c; markCategorySelected(); loadMenu(c); }; el.appendChild(b);
  });
  markCategorySelected();
}

function renderMenu(items){
  const el = document.getElementById('menu-list');
  el.innerHTML = '';
  items.filter(it=>it.name !== 'ชุดเปิดเตา').forEach(it=>{
    const row = document.createElement('div'); row.className='menu-item';
    // simple Add button only (quantity selection removed per request)
    row.innerHTML = `<div class="left"><div><strong>${it.name}</strong></div><div class="price">${Number(it.price).toFixed(2)}</div></div><div class="menu-actions"><button class="menu-add" data-id="${it.id}">Add</button></div>`;
    const addBtn = row.querySelector('.menu-add');
    addBtn.addEventListener('click',()=>{
      // prevent adding the mandatory set more than once
      if((it.name||'').trim() === 'ชุดเปิดเตา'){
        showToast('ชุดเปิดเตา ต้องสั่งเพียง 1 ชุดเท่านั้น', 2000);
        return;
      }
      addToCart(it, 1);
      renderOrdersPanel();
    });
    el.appendChild(row);
  });
}

function addToCart(item, qty = 1, locked = false){
  qty = Number(qty) || 1;
  const existing = CART.items.find(i=>i.id===item.id);
  if(existing){
    // if this item is locked (mandatory single-item), don't change quantity
    if(existing.locked){ showToast('รายการนี้ต้องสั่งครั้งเดียวเท่านั้น', 2000); return; }
    existing.qty = Number(existing.qty || 0) + qty;
  } else {
    CART.items.push({ id:item.id, name:item.name, price:Number(item.price), qty: qty, locked: !!locked });
  }
  renderCart();
}

function renderCart(){
  const ph = document.getElementById('cart-placeholder');
  ph.innerHTML = '';
  if(CART.items.length===0) return;
  const h = document.createElement('div'); h.innerHTML = '<h4>Cart</h4>'; ph.appendChild(h);
  const ul = document.createElement('ul'); let total=0;
  CART.items.forEach(it=>{
    total += it.qty * it.price;
    const li=document.createElement('li');
    // add spacing/padding to make buttons easier to click
    li.style.marginBottom = '8px';
    li.style.padding = '6px 0';
    if(it.locked){
      // locked mandatory item: show fixed qty (1) and no +/- controls
      li.innerHTML = `<span class="cart-name">${it.name}</span> <span class="cart-qty">1</span> <span class="cart-price">- ${ (it.qty*it.price).toFixed(2) }</span>`;
    } else {
      li.innerHTML = `<span class="cart-name">${it.name}</span> <span class="cart-controls"><button class="cart-minus" data-id="${it.id}">-</button> <span class="cart-qty">${it.qty}</span> <button class="cart-plus" data-id="${it.id}">+</button></span> <span class="cart-price">- ${ (it.qty*it.price).toFixed(2) }</span>`;
    }
    ul.appendChild(li);
  });
  ph.appendChild(ul);
  const footer = document.createElement('div'); footer.className='cart-footer'; footer.innerHTML = `<div>Total: <strong>${total.toFixed(2)}</strong></div><button id="checkout-small">ส่งรายการ</button>`;
  ph.appendChild(footer);
  const smallBtn = document.getElementById('checkout-small'); if(smallBtn) smallBtn.addEventListener('click', checkout);

  // attach cart plus/minus handlers
  ph.querySelectorAll('.cart-plus').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-id');
      const it = CART.items.find(x=>String(x.id)===String(id));
      if(it){ if(it.locked){ showToast('รายการนี้ไม่สามารถแก้ไขจำนวนได้', 1500); return; } it.qty = Number(it.qty||0) + 1; renderCart(); }
    });
  });
  ph.querySelectorAll('.cart-minus').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-id');
      const idx = CART.items.findIndex(x=>String(x.id)===String(id));
      if(idx!==-1){ if(CART.items[idx].locked){ showToast('รายการนี้ไม่สามารถแก้ไขจำนวนได้', 1500); return; } CART.items[idx].qty = Number(CART.items[idx].qty||0) - 1; if(CART.items[idx].qty <= 0) CART.items.splice(idx,1); renderCart(); }
    });
  });
}

async function renderOrdersPanel(){
  const ul = document.getElementById('placed-orders'); ul.innerHTML='';
  try{
    const orders = await apiGet('/orders/' + CART.table) || [];
    // group orders by status and aggregate identical items
    const groups = {};
    let grandTotal = 0;
    (orders || []).forEach(o=>{
      const status = o.served ? 'served' : (o.status === 'paid' ? 'paid' : 'pending');
      if(!groups[status]) groups[status] = { items: {}, total: 0, count: 0 };
      const g = groups[status];
      g.total += Number(o.total || 0);
      g.count += 1;
      grandTotal += Number(o.total || 0);
      const items = Array.isArray(o.items) ? o.items : (o.items && JSON.parse(o.items)) || [];
      items.forEach(it=>{
        const key = it.id != null ? String(it.id) : it.name;
        if(!g.items[key]) g.items[key] = { id: it.id, name: it.name, price: Number(it.price||0), qty: 0 };
        g.items[key].qty += Number(it.qty || 1);
      });
    });

    // render groups in order: pending, served, paid
    const orderSeq = ['pending','served','paid'];
    const statusLabel = s => s==='pending' ? 'รอเสิร์ฟ' : (s==='served' ? 'เสิร์ฟแล้ว' : 'ชำระแล้ว');
    orderSeq.forEach(s=>{
      const g = groups[s];
      if(!g) return;
      const li = document.createElement('li'); li.className = 'placed-order';
      const section = document.createElement('div');
      const header = document.createElement('div'); header.style.fontWeight='600'; header.style.marginBottom='6px';
      header.textContent = `${statusLabel(s)} — จำนวน ${g.count} รายการ — ยอดรวม ${g.total.toFixed(2)} ฿`;
      section.appendChild(header);
      const list = document.createElement('ul');
      Object.values(g.items).forEach(it=>{
        const itemLi = document.createElement('li'); itemLi.textContent = `${it.name} x${it.qty} — ${(it.price * it.qty).toFixed(2)} ฿`; list.appendChild(itemLi);
      });
      section.appendChild(list);
      li.appendChild(section);
      ul.appendChild(li);
    });

    // grand total
    const totalLi = document.createElement('li'); totalLi.className='placed-order';
    const totalDiv = document.createElement('div'); totalDiv.style.fontWeight='700'; totalDiv.textContent = `ยอดรวมทั้งหมด: ${grandTotal.toFixed(2)} ฿`;
    totalLi.appendChild(totalDiv);
    ul.appendChild(totalLi);

  }catch(e){ console.warn('Could not load placed orders', e); }
}

async function checkout(){
  if(CART.items.length===0){ showToast('Cart empty', 1800); return; }
  if(!CART.token) return showToast('Invalid table link. Please use the QR code on your table.', 3000);
  // disable checkout buttons to prevent double-submit
  const smallBtn = document.getElementById('checkout-small');
  const largeBtn = document.getElementById('checkout');
  if(smallBtn) smallBtn.disabled = true;
  if(largeBtn) largeBtn.disabled = true;
  try{
    const payload = { table_id: CART.table, items: CART.items, total: CART.items.reduce((s,i)=>s+i.qty*i.price,0), payment_method: 'cash', token: CART.token };
    const res = await fetch('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
    if(res.ok){
      // clear cart and refresh UI immediately
      CART.items = [];
      renderCart();
      // refresh placed orders panel so the new pending order appears instantly
      await renderOrdersPanel();
      showToast('ส่งรายการเรียบร้อย', 2200);
    } else {
      let msg = 'ส่งรายการล้มเหลว';
      try{ const txt = await res.text(); if(txt) msg += ': ' + txt; }catch(e){}
      showToast(msg, 3000);
    }
  }catch(e){ console.error('Checkout failed', e); showToast('ส่งรายการล้มเหลว', 3000); }
  finally{
    if(smallBtn) smallBtn.disabled = false;
    if(largeBtn) largeBtn.disabled = false;
  }
}

const oldCheckout = document.getElementById('checkout'); if(oldCheckout) oldCheckout.addEventListener('click', checkout);

async function loadMenu(category){
  const items = await apiGet('/menu');
  if(category) renderMenu(items.filter(i=>i.category===category)); else renderMenu(items);
}

async function init(){
  const cats = await apiGet('/menu/categories');
  renderCategories(cats);

  const defaultCat = 'อาหารสด (25 บาท)';
  const hasDefault = (cats || []).includes(defaultCat);
  if(hasDefault){ CURRENT_CATEGORY = defaultCat; markCategorySelected(); await loadMenu(defaultCat); } else { await loadMenu(); }

  try{
    const existing = await apiGet('/orders/' + CART.table);
    if((existing || []).length === 0){
      const all = await apiGet('/menu');
      const mandatory = (all || []).find(it => it.name === 'ชุดเปิดเตา');
      if(mandatory){
        const already = CART.items.find(i=>i.name===mandatory.name || i.id===mandatory.id);
        if(!already) addToCart(mandatory, 1, true);
      }
    }
  }catch(e){ console.warn('Could not check existing orders for mandatory set', e); }
  renderCart();
  await renderOrdersPanel();
  document.getElementById('title').textContent = `Menu - Table ${CART.table}`;
  if(!CART.token){
    const warn = document.createElement('div'); warn.style.color='red'; warn.textContent = 'กรุณาแสกน QR Code ที่โต๊ะเพื่อสั่งอาหาร';
    document.querySelector('.container').prepend(warn);
  }
}

init();

// real-time updates via socket.io: join table room and refresh when orders change
try{
  SOCKET = io();
  SOCKET.on('connect', ()=>{ SOCKET.emit('joinTable', PATH.table); });
  SOCKET.on('orders:created', (data)=>{ if(data && data.table_id === CART.table){ renderOrdersPanel(); } });
  SOCKET.on('orders:updated', (data)=>{ if(data && data.order && data.order.table_id === CART.table){ renderOrdersPanel(); } });
  SOCKET.on('orders:cleared', (data)=>{ if(data && data.table_id === CART.table){ renderOrdersPanel(); renderCart(); } });
  SOCKET.on('table:paid', (data)=>{ if(data && data.table_id === CART.table){ renderOrdersPanel(); renderCart(); } });
  SOCKET.on('table:cleaned', (data)=>{ if(data && data.table_id === CART.table){ renderOrdersPanel(); } });
}catch(e){ console.warn('Socket.io not available', e); }
