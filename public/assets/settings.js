// Simple API helper
async function api(path, opts){
  const res = await fetch('/api' + path, opts || {});
  // Simple API helper
  async function api(path, opts){
    const res = await fetch('/api' + path, opts || {});
    return res.json();
  }

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

  // Menu creation handled in /menu-admin.html; removed inline add form from settings page

  document.getElementById('save-tables').addEventListener('click', async ()=>{
    const count = parseInt(document.getElementById('table-count').value,10);
    if(!count || count<1) return showToast('invalid', 2000);
    const r = await api('/settings/tables', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ count }) });
    showToast('Saved tables: '+r.length, 2200);
  });

  document.getElementById('refresh-report').addEventListener('click', async ()=>{
    const r = await api('/reports/sales');
    document.getElementById('report-output').textContent = JSON.stringify(r, null, 2);
  });

  // init table count (public endpoint)
  // init table count (public endpoint)
  (async ()=>{ const resp = await fetch('/api/tables'); const t = await resp.json(); document.getElementById('table-count').value = t.length; })();

  // load admin-only table links and show QR/regenerate buttons
  let currentPreviewHolder = null; // track which preview is currently shown
  async function loadTableLinks(){
    try{
      const tables = await api('/admin/tables');
      const container = document.getElementById('table-links'); container.innerHTML='';
      if(!tables || tables.length===0){ container.textContent = 'ไม่พบโต๊ะ'; return; }
      for(const t of tables){
        const row = document.createElement('div'); row.className='menu-item';
        const left = document.createElement('div');
        // show only name and a copy-link button (do not display full URL)
        left.innerHTML = `<strong>${t.name}</strong>`;
        const copyBtn = document.createElement('button'); copyBtn.textContent = 'คัดลอกลิ้ง'; copyBtn.style.marginLeft = '8px';
        left.appendChild(copyBtn);
        const right = document.createElement('div');
        const qrBtn = document.createElement('button'); qrBtn.textContent='แสดง QR';
        const downloadBtn = document.createElement('button'); downloadBtn.textContent='ดาวน์โหลด PNG';
        const regenBtn = document.createElement('button'); regenBtn.textContent='สร้างใหม่';
        right.appendChild(qrBtn); right.appendChild(downloadBtn); right.appendChild(regenBtn);
        row.appendChild(left); row.appendChild(right);
        container.appendChild(row);

        // Show inline label SVG (QR + table text)
        const previewHolder = document.createElement('div'); previewHolder.style.marginTop='8px';
        row.appendChild(previewHolder);

        qrBtn.addEventListener('click', async ()=>{
          // if another preview is open, close it
          if(currentPreviewHolder && currentPreviewHolder !== previewHolder){ currentPreviewHolder.innerHTML = ''; }
          // toggle this preview
          if(previewHolder.innerHTML && previewHolder.innerHTML.trim() !== ''){
            previewHolder.innerHTML = '';
            currentPreviewHolder = null;
            return;
          }
          try{
            const res = await fetch('/api/admin/tables/'+t.id+'/label');
            if(res.ok){
              const svgText = await res.text();
              previewHolder.innerHTML = svgText;
              currentPreviewHolder = previewHolder;
            } else {
              const j = await res.json().catch(()=>null);
              showToast('Failed to load label: ' + (j?.error||res.status), 3000);
            }
          }catch(err){ console.error(err); showToast('Failed to load label', 2500); }
        });

        // copy link button handler (uses Clipboard API)
        copyBtn.addEventListener('click', async ()=>{
          try{
            await navigator.clipboard.writeText(t.link);
            const orig = copyBtn.textContent;
            copyBtn.textContent = 'คัดลอกแล้ว';
            setTimeout(()=> copyBtn.textContent = orig, 1500);
          }catch(err){
            // fallback: prompt
            window.prompt('Copy this link', t.link);
          }
        });

        // Download PNG: fetch SVG then convert to PNG using canvas
        downloadBtn.addEventListener('click', async ()=>{
          try{
            const res = await fetch('/api/admin/tables/'+t.id+'/label');
            if(!res.ok) return showToast('ไม่สามารถโหลดป้ายสำหรับดาวน์โหลดได้', 2600);
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
            img.onerror = ()=> showToast('ไม่สามารถแปลง SVG เป็นรูปภาพได้', 2600);
            img.src = url;
          }catch(err){ console.error(err); showToast('Download failed', 2600); }
        });

        regenBtn.addEventListener('click', async ()=>{
          const res = await fetch('/api/admin/tables/'+t.id+'/regenerate-token', { method:'POST' });
          const j = await res.json().catch(()=>null);
          if(res.ok){ showToast('สร้างโทเค่นใหม่สำหรับ '+t.name, 2200); loadTableLinks(); } else { showToast('การสร้างใหม่ล้มเหลว: '+(j?.error||res.status), 3000); }
        });
      }
    }catch(err){ console.error(err); showToast('Failed to load table links.', 3000); }

  }

  // load table links on page load (staff will access this by visiting /plek and then settings)
  loadTableLinks();

  // Payment info UI
  document.getElementById('pay-file').addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{ document.getElementById('pay-preview').innerHTML = `<img src="${reader.result}" style="max-width:240px" />`; document.getElementById('pay-preview').dataset.base64 = reader.result; };
    reader.readAsDataURL(f);
  });

  document.getElementById('save-pay').addEventListener('click', async ()=>{
    const name = document.getElementById('pay-name').value;
    const bank = document.getElementById('pay-bank').value;
    const base64 = document.getElementById('pay-preview').dataset.base64 || null;
    const payload = { account_name: name, bank: bank, qr_image_base64: base64 };
    const res = await api('/payment-info', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
    if(res) showToast('Saved payment info', 2200); else showToast('Save failed', 2600);
  });

  // load existing payment info into preview
  async function loadPaymentInfo(){
    try{
      const p = await api('/payment-info');
      if(!p) return;
      document.getElementById('pay-name').value = p.account_name || '';
      document.getElementById('pay-bank').value = p.bank || '';
      if(p.qr_image_base64){ document.getElementById('pay-preview').innerHTML = `<img src="${p.qr_image_base64}" style="max-width:240px" />`; document.getElementById('pay-preview').dataset.base64 = p.qr_image_base64; }
    }catch(e){ console.warn('Could not load payment info', e); }
  }
  loadPaymentInfo();
document.getElementById('pay-file').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{ document.getElementById('pay-preview').innerHTML = `<img src="${reader.result}" style="max-width:240px" />`; document.getElementById('pay-preview').dataset.base64 = reader.result; };
  reader.readAsDataURL(f);
});

document.getElementById('save-pay').addEventListener('click', async ()=>{
  const name = document.getElementById('pay-name').value;
  const bank = document.getElementById('pay-bank').value;
  const base64 = document.getElementById('pay-preview').dataset.base64 || null;
  const payload = { account_name: name, bank: bank, qr_image_base64: base64 };
  const res = await api('/payment-info', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  if(res) showToast('Saved payment info', 2200); else showToast('Save failed', 2600);
  }catch(err){ console.error(err); showToast('Failed to load table links.', 3000); }
});

// load existing payment info into preview
async function loadPaymentInfo(){
  try{
    const p = await api('/payment-info');
    if(!p) return;
    document.getElementById('pay-name').value = p.account_name || '';
    document.getElementById('pay-bank').value = p.bank || '';
    if(p.qr_image_base64){ document.getElementById('pay-preview').innerHTML = `<img src="${p.qr_image_base64}" style="max-width:240px" />`; document.getElementById('pay-preview').dataset.base64 = p.qr_image_base64; }
  }catch(e){ console.warn('Could not load payment info', e); }
}
loadPaymentInfo();
