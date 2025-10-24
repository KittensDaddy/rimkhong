const API = '/api';

async function apiGet(path){
  const res = await fetch(API+path);
  return res.json();
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
    row.innerHTML = `<div class="left"><div><strong>${it.name}</strong></div><div class="price">${Number(it.price).toFixed(2)}</div></div><div><button data-id="${it.id}">Add</button></div>`;
    row.querySelector('button').addEventListener('click',()=>{ addToCart(it); renderOrdersPanel(); });
    el.appendChild(row);
  });
}

function addToCart(item){
  const existing = CART.items.find(i=>i.id===item.id);
  if(existing) existing.qty += 1; else CART.items.push({ id:item.id, name:item.name, price:Number(item.price), qty:1 });
  renderCart();
}

function renderCart(){
  const ph = document.getElementById('cart-placeholder');
  ph.innerHTML = '';
  if(CART.items.length===0) return;
  const h = document.createElement('div'); h.innerHTML = '<h4>Cart</h4>'; ph.appendChild(h);
  const ul = document.createElement('ul'); let total=0;
  CART.items.forEach(it=>{ total += it.qty * it.price; const li=document.createElement('li'); li.textContent=`${it.name} x${it.qty} - ${ (it.qty*it.price).toFixed(2) }`; ul.appendChild(li); });
  ph.appendChild(ul);
  const footer = document.createElement('div'); footer.className='cart-footer'; footer.innerHTML = `<div>Total: <strong>${total.toFixed(2)}</strong></div><button id="checkout-small">ส่งรายการ</button>`;
  ph.appendChild(footer);
  document.getElementById('checkout-small').addEventListener('click', checkout);
}

async function renderOrdersPanel(){
  const ul = document.getElementById('placed-orders'); ul.innerHTML='';
  try{
    const orders = await apiGet('/orders/' + CART.table);
    (orders || []).forEach(o=>{
      const li = document.createElement('li'); li.className='placed-order';
      const items = Array.isArray(o.items) ? o.items : (o.items && JSON.parse(o.items)) || [];
      const name = items.map(it=>`${it.name}${it.qty>1? ' x'+it.qty:''}`).join(', ');
      const status = o.served ? 'served' : (o.status === 'paid' ? 'paid' : 'pending');
      const statusClass = status==='served' ? 'status-served' : (status==='paid' ? 'status-paid' : 'status-pending');
      li.innerHTML = `<div>${name}</div><div><span class="status ${statusClass}">${status}</span></div>`;
      ul.appendChild(li);
    });
  }catch(e){ console.warn('Could not load placed orders', e); }
}

async function checkout(){
  if(CART.items.length===0){ alert('Cart empty'); return; }
  if(!CART.token) return alert('Invalid table link. Please use the QR code on your table.');
  const payload = { table_id: CART.table, items: CART.items, total: CART.items.reduce((s,i)=>s+i.qty*i.price,0), payment_method: 'cash', token: CART.token };
  const res = await fetch('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  if(res.ok){ CART.items=[]; renderCart(); alert('ส่งรายการเรียบร้อย'); } else alert('ส่งรายการล้มเหลว');
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
        if(!already) addToCart(mandatory);
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
