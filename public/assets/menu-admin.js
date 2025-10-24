const API = '/api';

async function apiGet(path){ const r = await fetch(API+path); return r.json(); }
async function apiPost(path, body){ return fetch(API+path, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) }); }
async function apiPut(path, body){ return fetch(API+path, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(body) }); }
async function apiDelete(path){ return fetch(API+path, { method:'DELETE' }); }

const tableBody = document.querySelector('#menu-table tbody');
const form = document.getElementById('menu-form');
const title = document.getElementById('form-title');
let menuItems = [];

async function load(){
  const items = await apiGet('/menu?all=1');
  menuItems = items;
  tableBody.innerHTML = '';
  items.forEach(it=>{
    const tr = document.createElement('tr');
    const availChecked = it.available === undefined ? true : !!it.available;
    tr.innerHTML = `<td>${it.id}</td><td>${it.name}</td><td>${Number(it.price).toFixed(2)}</td><td>${it.category}</td><td><input type="checkbox" data-id="avail-${it.id}" ${availChecked? 'checked':''} /></td><td class="muted">${it.description||''}</td><td><button data-id="${it.id}" class="edit">Edit</button> <button data-id="${it.id}" class="del">Delete</button></td>`;
    tableBody.appendChild(tr);
  });
  attachButtons();
  // attach availability toggles
  items.forEach(it=>{
    const cb = document.querySelector(`input[data-id="avail-${it.id}"]`);
    if(cb){ cb.addEventListener('change', async e=>{
      const newVal = e.target.checked;
      // send update with only available flag (server will set other fields default)
      const body = { name: it.name, price: it.price, category: it.category, available: newVal };
      const res = await apiPut('/menu/' + it.id, body);
      if(!res.ok) alert('Could not update availability');
    }); }
  });
}

function attachButtons(){
  document.querySelectorAll('button.edit').forEach(b=>b.addEventListener('click', async e=>{
    const btn = e.target;
    const id = btn.dataset.id;
    const tr = btn.closest('tr');
    // prevent multiple rows editing
    const editing = document.querySelector('tr[data-editing="1"]');
    if(editing && editing !== tr){ return alert('Please finish editing the other row first'); }
    // toggle between Edit and Save
    if(btn.textContent.trim().toLowerCase() === 'edit'){
      // enter edit mode
      const it = menuItems.find(x=>String(x.id)===String(id));
      if(!it) return alert('Item not found');
      tr.dataset.orig = tr.innerHTML;
      tr.dataset.editing = '1';
      // cells: 0=id,1=name,2=price,3=category,4=avail,5=desc,6=actions
      const nameTd = tr.children[1];
      const priceTd = tr.children[2];
      const catTd = tr.children[3];
      const availTd = tr.children[4];
      const descTd = tr.children[5];
      const actionsTd = tr.children[6];
      // create inputs
      nameTd.innerHTML = `<input type="text" value="${escapeHtml(it.name)}" style="width:100%" />`;
      priceTd.innerHTML = `<input type="number" step="0.01" value="${Number(it.price).toFixed(2)}" style="width:100%" />`;
      // category select: clone options from main form select
      const catSelect = document.createElement('select');
      const mainCat = document.getElementById('m-category');
      if(mainCat){ Array.from(mainCat.options).forEach(o=>{ const opt = document.createElement('option'); opt.value=o.value; opt.textContent=o.textContent; if(o.value===it.category) opt.selected=true; catSelect.appendChild(opt); }); }
      else { catSelect.innerHTML = `<option>${escapeHtml(it.category)}</option>`; }
      catSelect.style.width = '100%'; catTd.innerHTML = ''; catTd.appendChild(catSelect);
      // available checkbox
      const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = it.available === undefined ? true : !!it.available;
      availTd.innerHTML = ''; availTd.appendChild(chk);
      // description editable
      descTd.innerHTML = `<input type="text" value="${escapeHtml(it.description||'')}" style="width:100%" />`;
      // change action buttons
      actionsTd.innerHTML = `<button data-id="${it.id}" class="save">Save</button> <button data-id="${it.id}" class="cancel">Cancel</button>`;
      // attach save/cancel handlers
      actionsTd.querySelector('button.save').addEventListener('click', async ev=>{
        const newName = nameTd.querySelector('input').value;
        const newPrice = parseFloat(priceTd.querySelector('input').value);
        const newCat = catTd.querySelector('select').value;
        const newAvail = availTd.querySelector('input').checked;
        const newDesc = descTd.querySelector('input').value;
        const body = { name: newName, price: newPrice, category: newCat, description: newDesc, available: newAvail };
        const res = await apiPut('/menu/' + it.id, body);
        if(res.ok){ tr.removeAttribute('data-editing'); load(); } else { alert('Update failed'); }
      });
      actionsTd.querySelector('button.cancel').addEventListener('click', ev=>{
        // revert
        tr.innerHTML = tr.dataset.orig;
        tr.removeAttribute('data-editing');
        attachButtons();
      });
    } else {
      // if button isn't 'Edit' it may be Save triggered elsewhere; ignore
    }
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

function resetForm(){ document.getElementById('m-id').value=''; document.getElementById('m-name').value=''; document.getElementById('m-price').value=''; document.getElementById('m-category').value=''; title.textContent='Add new item'; document.getElementById('m-available').checked=true; updateThumb(); }

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

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
