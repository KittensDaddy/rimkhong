const API = '/api';

async function apiGet(path){
  const res = await fetch(API+path);
  return res.json();
}

function getTableFromUrl(){
  const p = new URLSearchParams(location.search);
  return parseInt(p.get('table')||'1',10);
}

let CART = { items: [], table: getTableFromUrl() };

function renderCategories(categories){
  const el = document.getElementById('categories');
  el.innerHTML = '';
  const all = document.createElement('button'); all.textContent='All'; all.onclick = ()=>loadMenu(); el.appendChild(all);
  categories.forEach(c=>{ const b=document.createElement('button'); b.textContent=c; b.onclick=()=>loadMenu(c); el.appendChild(b); });
}

function renderMenu(items){
  const el = document.getElementById('menu-list');
  el.innerHTML = '';
  items.forEach(it=>{
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
  const payload = { table_id: CART.table, items: CART.items, total: CART.items.reduce((s,i)=>s+i.qty*i.price,0), payment_method: 'cash' };
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
  await loadMenu();
  renderCart();
  document.getElementById('title').textContent = `Menu - Table ${CART.table}`;
}

init();
