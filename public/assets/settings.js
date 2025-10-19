async function api(path, opts){
  const r = await fetch('/api'+path, opts); return r.json();
}

document.getElementById('menu-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const payload = { name: document.getElementById('m-name').value, price: parseFloat(document.getElementById('m-price').value), category: document.getElementById('m-category').value, description: document.getElementById('m-desc').value };
  const r = await api('/menu', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  alert('Added: '+r.name);
});

document.getElementById('save-tables').addEventListener('click', async ()=>{
  const count = parseInt(document.getElementById('table-count').value,10);
  if(!count || count<1) return alert('invalid');
  const r = await api('/settings/tables', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ count }) });
  alert('Saved tables: '+r.length);
});

document.getElementById('refresh-report').addEventListener('click', async ()=>{
  const r = await api('/reports/sales');
  document.getElementById('report-output').textContent = JSON.stringify(r, null, 2);
});

// init
(async ()=>{ const t = await api('/tables'); document.getElementById('table-count').value = t.length; })();
