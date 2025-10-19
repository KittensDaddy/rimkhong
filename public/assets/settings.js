// Simple API helper
async function api(path, opts){
  const res = await fetch('/api' + path, opts || {});
  return res.json();
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

// init table count (public endpoint)
// init table count (public endpoint)
(async ()=>{ const resp = await fetch('/api/tables'); const t = await resp.json(); document.getElementById('table-count').value = t.length; })();

// load admin-only table links and show QR/regenerate buttons
async function loadTableLinks(){
  try{
    const tables = await api('/admin/tables');
    const container = document.getElementById('table-links'); container.innerHTML='';
  if(!tables || tables.length===0){ container.textContent = 'No tables found.'; return; }
    for(const t of tables){
      const row = document.createElement('div'); row.className='menu-item';
      const left = document.createElement('div');
      left.innerHTML = `<strong>${t.name}</strong><div class="muted">${t.link}</div>`;
      const right = document.createElement('div');
  const qrBtn = document.createElement('button'); qrBtn.textContent='Show QR';
  const downloadBtn = document.createElement('button'); downloadBtn.textContent='Download PNG';
  const regenBtn = document.createElement('button'); regenBtn.textContent='Regenerate';
  right.appendChild(qrBtn); right.appendChild(downloadBtn); right.appendChild(regenBtn);
      row.appendChild(left); row.appendChild(right);
      container.appendChild(row);

      // Show inline label SVG (QR + table text)
      const previewHolder = document.createElement('div'); previewHolder.style.marginTop='8px';
      row.appendChild(previewHolder);

      qrBtn.addEventListener('click', async ()=>{
  const res = await fetch('/api/admin/tables/'+t.id+'/label');
        if(res.ok){
          const svgText = await res.text();
          previewHolder.innerHTML = svgText;
        } else {
          const j = await res.json().catch(()=>null);
          alert('Failed to load label: ' + (j?.error||res.status));
        }
      });

      // Download PNG: fetch SVG then convert to PNG using canvas
      downloadBtn.addEventListener('click', async ()=>{
        try{
          const res = await fetch('/api/admin/tables/'+t.id+'/label');
          if(!res.ok) return alert('Failed to load label for download');
          const svgText = await res.text();
          const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          const img = new Image();
          img.onload = ()=>{
            const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.drawImage(img,0,0);
            canvas.toBlob((blob)=>{
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${t.name.replace(/\s+/g,'_')}_label.png`; document.body.appendChild(a); a.click(); a.remove();
            }, 'image/png');
          };
          img.onerror = ()=> alert('Failed to render SVG to image');
          img.src = url;
        }catch(err){ console.error(err); alert('Download failed'); }
      });

      regenBtn.addEventListener('click', async ()=>{
  const res = await fetch('/api/admin/tables/'+t.id+'/regenerate-token', { method:'POST' });
        const j = await res.json().catch(()=>null);
        if(res.ok){ alert('Regenerated token for '+t.name); loadTableLinks(); } else { alert('Regenerate failed: '+(j?.error||res.status)); }
      });
    }
  }catch(err){ console.error(err); alert('Failed to load table links.'); }

}

// load table links on page load (staff will access this by visiting /plek and then settings)
loadTableLinks();
