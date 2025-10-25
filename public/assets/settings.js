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

// Save tables count
const saveTablesBtn = document.getElementById('save-tables');
if(saveTablesBtn){
  saveTablesBtn.addEventListener('click', async ()=>{
    const el = document.getElementById('table-count');
    const count = parseInt(el && el.value,10);
    if(!count || count<1) return showToast('จำนวนโต๊ะไม่ถูกต้อง', 2000);
    const r = await api('/settings/tables', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ count }) });
    showToast('Saved tables: '+(Array.isArray(r)?r.length:r?.length||0), 2200);
  });
}

// Refresh report
const refreshReportBtn = document.getElementById('refresh-report');
if(refreshReportBtn){
  refreshReportBtn.addEventListener('click', async ()=>{
    const r = await api('/reports/sales');
    const out = document.getElementById('report-output');
    if(out) out.textContent = JSON.stringify(r, null, 2);
  });
}

// init table count (public endpoint)
(async ()=>{
  try{
    const resp = await fetch('/api/tables');
    const t = await resp.json();
    const el = document.getElementById('table-count');
    if(el) el.value = (t && t.length) || 0;
  }catch(e){ /* ignore */ }
})();

// load admin-only table links and show QR/regenerate buttons
let currentPreviewHolder = null; // track which preview is currently shown
async function loadTableLinks(){
  try{
    const tables = await api('/admin/tables');
    const container = document.getElementById('table-links'); if(!container) return;
    container.innerHTML='';
    if(!tables || tables.length===0){ container.textContent = 'ไม่พบโต๊ะ'; return; }
    for(const t of tables){
      const row = document.createElement('div'); row.className='menu-item';
      const left = document.createElement('div');
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

      const previewHolder = document.createElement('div'); previewHolder.style.marginTop='8px';
      row.appendChild(previewHolder);

      qrBtn.addEventListener('click', async ()=>{
        if(currentPreviewHolder && currentPreviewHolder !== previewHolder){ currentPreviewHolder.innerHTML = ''; }
        if(previewHolder.innerHTML && previewHolder.innerHTML.trim() !== ''){ previewHolder.innerHTML = ''; currentPreviewHolder = null; return; }
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

      copyBtn.addEventListener('click', async ()=>{
        try{ await navigator.clipboard.writeText(t.link); const orig = copyBtn.textContent; copyBtn.textContent = 'คัดลอกแล้ว'; setTimeout(()=> copyBtn.textContent = orig, 1500); }catch(err){ window.prompt('Copy this link', t.link); }
      });

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
            canvas.toBlob((blob)=>{ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${t.name.replace(/\s+/g,'_')}_label.png`; document.body.appendChild(a); a.click(); a.remove(); }, 'image/png');
          };
          img.onerror = ()=> showToast('ไม่สามารถแปลง SVG เป็นรูปภาพได้', 2600);
          img.src = url;
        }catch(err){ console.error(err); showToast('Download failed', 2600); }
      });

      regenBtn.addEventListener('click', async ()=>{
        try{
          const res = await fetch('/api/admin/tables/'+t.id+'/regenerate-token', { method:'POST' });
          const j = await res.json().catch(()=>null);
          if(res.ok){ showToast('สร้างโทเค่นใหม่สำหรับ '+t.name, 2200); loadTableLinks(); } else { showToast('การสร้างใหม่ล้มเหลว: '+(j?.error||res.status), 3000); }
        }catch(e){ showToast('การสร้างใหม่ล้มเหลว', 2600); }
      });
    }
  }catch(err){ console.error(err); showToast('Failed to load table links.', 3000); }
}

loadTableLinks();

// Payment info UI
const payFile = document.getElementById('pay-file');
if(payFile){
  payFile.addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{ const preview = document.getElementById('pay-preview'); if(preview){ preview.innerHTML = `<img src="${reader.result}" style="max-width:240px" />`; preview.dataset.base64 = reader.result; } };
    reader.readAsDataURL(f);
  });
}

const savePayBtn = document.getElementById('save-pay');
if(savePayBtn){
  savePayBtn.addEventListener('click', async ()=>{
    const name = document.getElementById('pay-name').value;
    const bank = document.getElementById('pay-bank').value;
    const base64 = document.getElementById('pay-preview').dataset.base64 || null;
    const payload = { account_name: name, bank: bank, qr_image_base64: base64 };
    try{
      const res = await api('/payment-info', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
      if(res) showToast('Saved payment info', 2200); else showToast('Save failed', 2600);
    }catch(e){ console.error(e); showToast('Save failed', 2600); }
  });
}

// load existing payment info into preview
async function loadPaymentInfo(){
  try{
    const p = await api('/payment-info');
    if(!p) return;
    const nameEl = document.getElementById('pay-name'); if(nameEl) nameEl.value = p.account_name || '';
    const bankEl = document.getElementById('pay-bank'); if(bankEl) bankEl.value = p.bank || '';
    if(p.qr_image_base64){ const preview = document.getElementById('pay-preview'); if(preview){ preview.innerHTML = `<img src="${p.qr_image_base64}" style="max-width:240px" />`; preview.dataset.base64 = p.qr_image_base64; } }
  }catch(e){ console.warn('Could not load payment info', e); }
}
loadPaymentInfo();
