const API = '/api';

async function apiGet(path){ const r = await fetch(API+path); return r.json(); }
async function apiPost(path, body){ return fetch(API+path, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) }); }
async function apiPut(path, body){ return fetch(API+path, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(body) }); }
async function apiDelete(path){ return fetch(API+path, { method:'DELETE' }); }

const tableBody = document.querySelector('#menu-table tbody');
const form = document.getElementById('menu-form');
const title = document.getElementById('form-title');

async function load(){
  const items = await apiGet('/menu?all=1');
  tableBody.innerHTML = '';
  items.forEach(it=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${it.id}</td><td>${it.name}</td><td>${Number(it.price).toFixed(2)}</td><td>${it.category}</td><td class="muted">${it.description||''}</td><td><button data-id="${it.id}" class="edit">Edit</button> <button data-id="${it.id}" class="del">Delete</button></td>`;
    tableBody.appendChild(tr);
  });
  attachButtons();
}

function attachButtons(){
  document.querySelectorAll('button.edit').forEach(b=>b.addEventListener('click', async e=>{
    const id = e.target.dataset.id;
    const items = await apiGet('/menu?all=1');
    const it = items.find(x=>String(x.id)===String(id));
    if(!it) return alert('Item not found');
    document.getElementById('m-id').value = it.id;
    document.getElementById('m-name').value = it.name;
    document.getElementById('m-price').value = it.price;
    document.getElementById('m-category').value = it.category;
  // description field removed from admin UI; keep DB value if needed but not editable here
  document.getElementById('m-available').checked = it.available === undefined ? true : !!it.available;
  updateThumb();
    title.textContent = 'Edit item ' + it.id;
  }));
  document.querySelectorAll('button.del').forEach(b=>b.addEventListener('click', async e=>{
    if(!confirm('Delete this menu item?')) return;
    const id = e.target.dataset.id;
    const res = await apiDelete('/menu/' + id);
    if(res.ok) load(); else alert('Delete failed');
  }));
}

form.addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('m-id').value;
  const body = { name: document.getElementById('m-name').value, price: Number(document.getElementById('m-price').value), category: document.getElementById('m-category').value, available: document.getElementById('m-available').checked };
  if(id){
    const res = await apiPut('/menu/' + id, body);
    if(res.ok) { resetForm(); load(); } else alert('Update failed');
  } else {
    const res = await apiPost('/menu', body);
    if(res.ok) { resetForm(); load(); } else alert('Create failed');
  }
});

document.getElementById('cancel').addEventListener('click', e=>{ resetForm(); });

function resetForm(){ document.getElementById('m-id').value=''; document.getElementById('m-name').value=''; document.getElementById('m-price').value=''; document.getElementById('m-category').value=''; document.getElementById('m-desc').value=''; title.textContent='Add new item'; }

load();
// populate categories select
async function loadCategories(){
  const cats = await apiGet('/menu/categories?all=1');
  const sel = document.getElementById('m-category');
  sel.innerHTML = '';
  cats.forEach(c=>{ const o = document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
}
loadCategories();
// availability thumb UI
const availCheckbox = document.getElementById('m-available');
const availThumb = document.getElementById('m-available-thumb');
function updateThumb(){ if(!availCheckbox) return; if(availCheckbox.checked){ availCheckbox.style.background='#2ecc71'; availThumb.style.left='22px'; } else { availCheckbox.style.background='#ddd'; availThumb.style.left='2px'; } }
if(availCheckbox) availCheckbox.addEventListener('change', updateThumb);
updateThumb();
