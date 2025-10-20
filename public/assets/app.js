const API = '/api';

async function apiGet(path){
  const res = await fetch(API+path);
  return res.json();
}

// Expect path like /table/<id>/<token> (we will support root fallback but discourage it)
function parsePath(){
  const parts = location.pathname.split('/').filter(Boolean);
  // if path is /table/3/abcdef
  if(parts[0]==='table' && parts[1]) return { table: parseInt(parts[1],10), token: parts[2] };
  // fallback to ?table=1 (legacy) but token will be null — will be rejected by server
  const p = new URLSearchParams(location.search);
  return { table: parseInt(p.get('table')||'1',10), token: p.get('token') || null };
}

const PATH = parsePath();
let CART = { items: [], table: PATH.table, token: PATH.token };

function renderCategories(categories){
  const el = document.getElementById('categories');
  el.innerHTML = '';
  // hide the special required set category from customer view
  const hiddenCategory = 'ชุดเปิดเตา (บังคับเลือก)';
  categories.filter(c=>c!==hiddenCategory).forEach(c=>{ const b=document.createElement('button'); b.textContent=c; b.onclick=()=>loadMenu(c); el.appendChild(b); });
}

function renderMenu(items){
  const el = document.getElementById('menu-list');
  el.innerHTML = '';
  // hide mandatory opening set item from customer menu
  items.filter(it=>it.name !== 'ชุดเปิดเตา').forEach(it=>{
    const row = document.createElement('div'); row.className='menu-item';
    row.innerHTML = `<div><strong>${it.name}</strong><div class="muted">${it.category} - ${it.description||''}</div></div><div><div>${Number(it.price).toFixed(2)}</div><button data-id="${it.id}">Add</button></div>`;
    row.querySelector('button').addEventListener('click',()=>{ addToCart(it); });
    el.appendChild(row);
  });
}

function addToCart(item){
  const existing = CART.items.find(i=>i.id===item.id);
  if(existing) existing.qty += 1; else CART.items.push({ id:item.id, name:item.name, price:Number(item.price), qty:1 });
  renderCart();
}

function renderCart(){
  const el = document.getElementById('cart-items'); el.innerHTML='';
  let total=0;
  CART.items.forEach(it=>{ total += it.qty * it.price; const li=document.createElement('li'); li.textContent=`${it.name} x${it.qty} - ${ (it.qty*it.price).toFixed(2) }`; el.appendChild(li); });
  document.getElementById('cart-total').textContent = total.toFixed(2);
}

async function checkout(){
  if(CART.items.length===0){ alert('Cart empty'); return; }
  if(!CART.token) return alert('Invalid table link. Please use the QR code on your table.');
  const payload = { table_id: CART.table, items: CART.items, total: CART.items.reduce((s,i)=>s+i.qty*i.price,0), payment_method: 'cash', token: CART.token };
  const res = await fetch('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  if(res.ok){ CART.items=[]; renderCart(); alert('Order placed'); } else alert('Order failed');
}

document.getElementById('checkout').addEventListener('click', checkout);

async function loadMenu(category){
  const items = await apiGet('/menu');
  if(category) renderMenu(items.filter(i=>i.category===category)); else renderMenu(items);
}

async function init(){
  const cats = await apiGet('/menu/categories');
  renderCategories(cats);
  // default to 'อาหารสด' category for customers
  const defaultCat = 'อาหารสด';
  const hasDefault = (cats || []).includes(defaultCat);
  if(hasDefault) await loadMenu(defaultCat); else await loadMenu();
  // If this table has no unpaid orders, force-add the mandatory opening set (ชุดเปิดเตา) once
  try{
    const existing = await apiGet('/orders/' + CART.table);
    if((existing || []).length === 0){
      // find the mandatory item from the full menu
      const all = await apiGet('/menu');
      const mandatory = (all || []).find(it => it.name === 'ชุดเปิดเตา');
      if(mandatory){
        const already = CART.items.find(i=>i.name===mandatory.name || i.id===mandatory.id);
        if(!already) addToCart(mandatory);
      }
    }
  }catch(e){ console.warn('Could not check existing orders for mandatory set', e); }
  renderCart();
  document.getElementById('title').textContent = `Menu - Table ${CART.table}`;
  if(!CART.token){
    // indicate invalid access
    const warn = document.createElement('div'); warn.style.color='red'; warn.textContent = 'This page requires a table-specific QR link. Please use the QR code on your table.';
    document.querySelector('.container').prepend(warn);
  }
}

init();
