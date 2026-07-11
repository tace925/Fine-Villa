/* ============================================================
   FINE VILLA LIMITED — SYSTEM CORE  (localStorage prototype)
   ============================================================ */
const SUPABASE_URL = "https://ybqwivcmznzqwxupvjii.supabase.co";
const SUPABASE_KEY = "sb_publishable_p09ka2D_3bB-gkl_Et-XDQ_I6GosAfG";
const REST = SUPABASE_URL + "/rest/v1/fv_state";
const STORAGE_BUCKET = "tour-images";
const DAY = 86400000;
let DB = null;
let app = { page:"home", portal:null, identity:null, portalTab:null, theme:"dark" };

function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(window.__toastT); window.__toastT=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ---------------- SEED DATA ---------------- */
function seedDB(){
  const houses=[];
  for(let i=1;i<=200;i++){
    const no=String(i).padStart(3,'0');
    const occ = i===134 || i%7===0;
    houses.push({no, status: occ?'occ':'emp', tenant: i===134? 'Telvin Nyinge' : (occ? 'Tenant '+no : null), maintLog:[], lastInspected:null});
  }
  return {
    owner:{name:"Mr. Daniel Kamau", role:"Director / Owner", phone:"0721 404 647", email:"finevillaproperties@gmail.com", start:new Date('2016-01-01').getTime(), photo:"🧔🏾"},
    ownerHistory:[],
    agents:[{name:"Grace Wambui", id:"31245678", phone:"0733 221 044", passcode:"agt-001-4T7Q", start:new Date('2021-03-01').getTime(), end:null, photo:"👩🏾‍💼", active:true}],
    caretakers:[{name:"Samuel Otieno", phone:"0798 112 233", email:"s.otieno@finevilla.co.ke", passcode:"care-001-9X2M", start:new Date('2022-06-01').getTime(), end:null, photo:"👨🏿‍🔧", active:true}],
    tenants:[{no:"134", name:"Telvin Nyinge", phone:"0712 000 134", email:"telvin.nyinge@example.com", passcode:"tent-134-8K1L", house:"134", rentExpected:18670, rentPaid:8670, balance:80761, lastPayment:"2026-06-22", active:true}],
    messages:[
      {id:1, from:"Agent", to:"Admin", subject:"May Occupancy Summary", body:"142 of 200 units occupied. Two vacancies flagged for repainting before listing.", ts:Date.now()-DAY*2, file:null}
    ],
    complaints:[
      {id:1, tenant:"Telvin Nyinge", house:"134", text:"Kitchen tap has been leaking since Monday.", ts:Date.now()-DAY, status:"open"}
    ],
    notices:{
      global:[{id:1, author:"Admin", text:"Rent for June is due on or before the 5th. Payments after the 10th attract a 10% penalty.", ts:Date.now()-DAY*3, urgency:"important"}],
      agent:[{id:1, author:"Agent", text:"Site visit scheduled Friday 10am — all caretakers please be present.", ts:Date.now()-DAY, urgency:"normal"}],
      caretaker:[{id:1, author:"Caretaker", text:"Water tank cleaning this Saturday, expect low pressure 8–11am.", ts:Date.now()-3600000*5, urgency:"important"}],
      tenant:[{id:1, author:"Caretaker", text:"Garbage collection now happens every Tuesday & Friday.", ts:Date.now()-3600000*10, urgency:"normal"}]
    },
    tour:{
      history:"Fine Villa began in 2016 as a single block of six units off Naivasha Road. What started as one caretaker with a ledger book and a bicycle has grown into a 200-unit residential community across Riruta. The early years meant chasing rent on foot and settling water disputes by torchlight — today the same spirit runs the estate, just with better paperwork.",
      challenge:"The hardest years were 2018–2020: flooding damaged the lower units twice, and manual paper receipts made it difficult to track who had paid, who hadn't, and which units needed repair. That gap is exactly what this system was built to close.",
      quote:"\u201cHonest is successful \u2014 build the kind of place you'd be proud to hand your own keys to.\u201d",
      gallery:[
        {label:"Front View", caption:"", url:null}, {label:"Side View", caption:"", url:null}, {label:"Back View", caption:"", url:null},
        {label:"Compound", caption:"", url:null}, {label:"Parking", caption:"", url:null}, {label:"Rooftop / Communal Area", caption:"", url:null}
      ]
    },
    policies:[
      {title:"Rent Payment", cat:"Payments", body:"Rent is due on or before the 5th of every month. Payment after the 10th attracts a 10% penalty charge and may result in the house being closed pending settlement.", updated:"2026-05-01"},
      {title:"Water Billing", cat:"Payments", body:"Water is billed per unit consumed at the prevailing rate and must be settled alongside rent to avoid disconnection.", updated:"2026-05-01"},
      {title:"Deposit & Refunds", cat:"Move-in / Move-out", body:"A one-month deposit is held against damages and is refundable within 30 days of vacating, less any deductions for repairs beyond fair wear and tear.", updated:"2026-01-15"},
      {title:"Notice to Vacate", cat:"Move-in / Move-out", body:"Tenants must give 30 days' written notice before vacating. Failure to do so may forfeit part of the deposit.", updated:"2026-01-15"},
      {title:"Maintenance & Repairs", cat:"Maintenance", body:"Tenants must report faults promptly via the Complaints section. Fine Villa targets a 48-hour response for urgent repairs (water, electricity, security).", updated:"2026-04-10"},
      {title:"Conduct & Noise", cat:"Conduct", body:"Residents are expected to maintain reasonable noise levels after 10pm and to keep shared spaces (corridors, compounds, parking) clear and clean.", updated:"2026-02-20"}
    ],
    auditLog:[],
    houses
  };
}

/* ---------------- Supabase load/save ---------------- */
async function loadDB(){
  try{
    const res = await fetch(REST + "?id=eq.1&select=data", {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
    });
    if(!res.ok) throw new Error("Supabase fetch failed: " + res.status);
    const rows = await res.json();
    if(rows && rows[0] && rows[0].data && Object.keys(rows[0].data).length){
      DB = rows[0].data;
    } else {
      DB = seedDB();
      await pushDB();
    }
  }catch(e){
    console.error(e);
    toast("Could not reach the server — working offline for now");
    DB = seedDB();
  }
  normalizeDB();
  pushDB();
}

// Backfills any fields that didn't exist yet when this data was last saved
// (e.g. older records saved before "start/end" timestamps or photos were
// introduced), so older saved data never crashes newer code.
function normalizeDB(){
  const seed = seedDB();
  if(!DB.owner) DB.owner = seed.owner;
  if(!DB.owner.start){
    DB.owner.start = DB.owner.since ? new Date(DB.owner.since, 0, 1).getTime() : Date.now();
  }
  if(DB.owner.photo===undefined) DB.owner.photo = seed.owner.photo;
  if(!DB.ownerHistory) DB.ownerHistory = [];

  ['agents','caretakers'].forEach(key=>{
    if(!Array.isArray(DB[key])) DB[key]=[];
    DB[key].forEach(r=>{
      if(!r.start){ r.start = r.since ? new Date(r.since, 0, 1).getTime() : Date.now(); }
      if(r.end===undefined) r.end = null;
      if(r.active===undefined) r.active = true;
      if(r.photo===undefined) r.photo = null;
    });
  });
  if(!Array.isArray(DB.tenants)) DB.tenants=[];
  DB.tenants.forEach(t=>{
    if(t.active===undefined) t.active = true;
    if(t.rentExpected===undefined) t.rentExpected = 0;
    if(t.rentPaid===undefined) t.rentPaid = 0;
    if(t.balance===undefined) t.balance = 0;
  });
  if(!DB.tour) DB.tour = seed.tour;
  if(!Array.isArray(DB.tour.gallery)) DB.tour.gallery = seed.tour.gallery;
  DB.tour.gallery.forEach(g=>{ if(g.url===undefined) g.url=null; });
  if(!Array.isArray(DB.policies)) DB.policies = seed.policies;
  if(!Array.isArray(DB.auditLog)) DB.auditLog = [];
  if(!Array.isArray(DB.messages)) DB.messages = [];
  if(!Array.isArray(DB.complaints)) DB.complaints = [];
  if(!Array.isArray(DB.houses) || DB.houses.length!==200) DB.houses = seed.houses;
  if(!DB.notices) DB.notices = seed.notices;
  ['global','agent','caretaker','tenant'].forEach(b=>{ if(!Array.isArray(DB.notices[b])) DB.notices[b]=[]; });
}
function saveDB(showToast){
  pushDB();
  if(showToast) toast("Saved");
}
async function pushDB(){
  try{
    const res = await fetch(REST + "?id=eq.1", {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ data: DB, updated_at: new Date().toISOString() })
    });
    if(!res.ok) throw new Error("Supabase save failed: " + res.status);
  }catch(e){
    console.error(e);
    toast("Could not sync to server");
  }
}

/* ---------------- Supabase Storage: tour image upload ---------------- */
async function uploadTourImage(idx, file){
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('Please choose an image file'); return; }
  if(file.size > 5*1024*1024){ toast('Image is too large — please keep it under 5MB'); return; }
  toast('Uploading photo…');
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g,'-');
  const path = `slot-${idx}-${Date.now()}-${safeName}`;
  try{
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method:'POST',
      headers:{
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer '+SUPABASE_KEY,
        'Content-Type': file.type
      },
      body: file
    });
    if(!res.ok) throw new Error('Upload failed: '+res.status);
    const url = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
    DB.tour.gallery[idx].url = url;
    saveDB(true);
    render();
  }catch(e){
    console.error(e);
    toast('Upload failed — check that the "tour-images" bucket exists and is public');
  }
}

async function uploadPersonPhoto(role, file){
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('Please choose an image file'); return; }
  if(file.size > 5*1024*1024){ toast('Image is too large — please keep it under 5MB'); return; }
  toast('Uploading photo…');
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g,'-');
  const path = `people/${role}-${Date.now()}-${safeName}`;
  try{
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method:'POST',
      headers:{ apikey: SUPABASE_KEY, Authorization: 'Bearer '+SUPABASE_KEY, 'Content-Type': file.type },
      body: file
    });
    if(!res.ok) throw new Error('Upload failed: '+res.status);
    const url = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
    if(role==='admin'){
      DB.owner.photo = url;
      app.identity = { ...DB.owner };
    } else {
      const list = role==='agent'? DB.agents : DB.caretakers;
      const rec = list.find(r=>r.passcode===app.identity.passcode);
      if(rec){ rec.photo = url; app.identity = { ...rec }; }
    }
    saveDB(true); render();
  }catch(e){
    console.error(e);
    toast('Upload failed — check that the "tour-images" bucket exists and is public');
  }
}
function logAudit(actor, action, detail){
  DB.auditLog.unshift({id:Date.now(), actor, action, detail, ts:Date.now()});
  if(DB.auditLog.length>200) DB.auditLog.length=200;
}

/* ---------------- utilities ---------------- */
function esc(s){return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(ts){ return new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function money(n){ return 'Kshs ' + (n||0).toLocaleString(); }
function genPass(prefix, seq){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for(let i=0;i<4;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return `${prefix}-${String(seq).padStart(3,'0')}-${s}`;
}
function downloadBlob(content, filename, mime){
  const blob = new Blob([content], {type:mime});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  URL.revokeObjectURL(a.href);
}
function toCSV(rows){
  return rows.map(r=>r.map(c=>`"${(c??'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
}
function notExpired(n){ return (Date.now() - n.ts) < DAY*30; }
function isImgUrl(p){ return typeof p==='string' && p.indexOf('http')===0; }
function getCurrent(list){
  const actives = (list||[]).filter(x=>x.active!==false).sort((a,b)=>(b.start||0)-(a.start||0));
  return actives[0] || null;
}
function formatDuration(ms){
  if(ms<0) ms=0;
  let sec = Math.floor(ms/1000);
  const years = Math.floor(sec/(365*86400)); sec-=years*365*86400;
  const months = Math.floor(sec/(30*86400)); sec-=months*30*86400;
  const days = Math.floor(sec/86400); sec-=days*86400;
  const hours = Math.floor(sec/3600); sec-=hours*3600;
  const mins = Math.floor(sec/60); sec-=mins*60;
  const secs = sec;
  const cell = (n,l)=>`<div class="cd-row"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="countdown-row">${cell(years,'yrs')}${cell(months,'mo')}${cell(days,'d')}${cell(hours,'h')}${cell(mins,'m')}${cell(secs,'s')}</div>`;
}
function startCountdowns(){
  clearInterval(window.__cdInt);
  const els = document.querySelectorAll('[data-countdown]');
  if(!els.length) return;
  function tick(){
    els.forEach(el=>{
      const start = parseInt(el.dataset.countdown);
      el.innerHTML = start ? formatDuration(Date.now()-start) : '';
    });
  }
  tick();
  window.__cdInt = setInterval(tick, 1000);
}

function svgDonut(occ, empty){
  const total=occ+empty || 1; const pct=occ/total; const r=52, c=2*Math.PI*r;
  return `<svg viewBox="0 0 140 140" width="140" height="140">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--bg-3)" stroke-width="16"/>
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--gold)" stroke-width="16"
      stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct)}" transform="rotate(-90 70 70)" stroke-linecap="round"/>
    <text x="70" y="66" text-anchor="middle" fill="var(--ink)" font-size="20" font-weight="700" font-family="Fraunces,serif">${Math.round(pct*100)}%</text>
    <text x="70" y="84" text-anchor="middle" fill="var(--muted)" font-size="9">OCCUPIED</text>
  </svg>`;
}
function svgBars(data, w=280, h=140){
  const max = Math.max(1, ...data.map(d=>d.v));
  const bw = w/data.length - 14;
  let bars = data.map((d,i)=>{
    const bh = (d.v/max) * (h-30);
    const x = i*(w/data.length) + 7;
    const y = h-24-bh;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="var(--gold)"/>
      <text x="${x+bw/2}" y="${h-8}" text-anchor="middle" font-size="9" fill="var(--muted)">${esc(d.k)}</text>
      <text x="${x+bw/2}" y="${y-6}" text-anchor="middle" font-size="10" fill="var(--ink)" font-weight="700">${d.v}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">${bars}</svg>`;
}

/* ============================================================
   RENDER: PAGE ROUTER
   ============================================================ */
function render(){
  document.body.setAttribute('data-theme', app.theme || 'dark');
  document.querySelectorAll('#pillnav .btn3d').forEach(b=>b.classList.toggle('active', b.dataset.page===app.page));
  const main = document.getElementById('mainWrap');
  document.getElementById('stOcc').textContent = DB.houses.filter(h=>h.status==='occ').length;

  // session chip
  const chip = document.getElementById('sessionChip');
  const menuSession = document.getElementById('menuSession');
  if(app.portal){
    const label = `${PORTAL_META[app.portal].icon} ${PORTAL_META[app.portal].label} — ${identityName()}`;
    chip.textContent = label; chip.classList.remove('hide');
    menuSession.innerHTML = `Currently signed in:<br><b>${esc(label)}</b>`; menuSession.classList.remove('hide');
  } else {
    chip.classList.add('hide'); menuSession.classList.add('hide');
  }

  try{
    if(app.page==='home') main.innerHTML = pageHome();
    else if(app.page==='tour') main.innerHTML = pageTour();
    else if(app.page==='policies') main.innerHTML = pagePolicies();
    else if(app.page==='notices') main.innerHTML = pageNotices();
    else if(app.page==='portal') main.innerHTML = pagePortal();
  }catch(e){
    console.error('Render error:', e);
    main.innerHTML = `<div class="card" style="margin-top:30px;">
      <h3>⚠️ Something went wrong loading this page</h3>
      <div style="color:var(--muted); font-size:13px; margin-bottom:14px;">${esc(e.message)}</div>
      <button class="btn3d btn-gold" id="reloadBtn">Reload</button>
    </div>`;
    const rb = document.getElementById('reloadBtn');
    if(rb) rb.onclick = ()=> location.reload();
    return;
  }

  attachPageEvents();

  // Tie the typing animation and countdowns to the elements actually on
  // screen right now, so they never run against a detached/replaced node.
  if(app.page==='home'){ startTyping(); startCountdowns(); }
  else { clearInterval(window.__typeInt); clearInterval(window.__cdInt); }
}

/* ---------------- HOME ---------------- */
function pageHome(){
  const occ = DB.houses.filter(h=>h.status==='occ').length, total=DB.houses.length;
  const pct = Math.round(occ/total*100);
  const curAgent = getCurrent(DB.agents);
  const curCaretaker = getCurrent(DB.caretakers);
  const people = [
    {role:'Owner', name:DB.owner.name, photo:DB.owner.photo, rank:'Director / Owner', start:DB.owner.start},
    {role:'Agent', name: curAgent? curAgent.name : 'Currently Vacant', photo: curAgent? (curAgent.photo||'💼') : '💼', rank:'Managing Agent', start: curAgent? curAgent.start : null},
    {role:'Caretaker', name: curCaretaker? curCaretaker.name : 'Currently Vacant', photo: curCaretaker? (curCaretaker.photo||'🧰') : '🧰', rank:'On-site Caretaker', start: curCaretaker? curCaretaker.start : null}
  ];
  return `
  <section class="hero">
    <div class="typing" id="typingLine"></div>
    <div class="occ-strip">
      <div><div class="num">${occ}/${total}</div><div class="lbl">Units Occupied</div></div>
      <div class="occ-bar"><i style="width:${pct}%"></i></div>
      <div class="lbl">${pct}% full</div>
    </div>
    <div class="chain">
      <div class="node"><b>🗝️ Owner</b><span>sets policy</span></div><div class="arrow">→</div>
      <div class="node"><b>💼 Agent</b><span>manages branch</span></div><div class="arrow">→</div>
      <div class="node"><b>🧰 Caretaker</b><span>runs the site</span></div><div class="arrow">→</div>
      <div class="node"><b>🏘️ Tenant</b><span>lives on site</span></div>
    </div>
  </section>
  <section class="section">
    <h2>The People Behind Fine Villa</h2>
    <div class="sub">Tap a card to flip it — this updates automatically as roles change hands.</div>
    <div class="cardgrid">
      ${people.map((p,i)=>`
        <div class="flip" data-flip="${i}">
          <div class="flip-inner">
            <div class="flip-face flip-front">
              <div class="photo">${isImgUrl(p.photo)? `<img src="${esc(p.photo)}" alt="${esc(p.name)}">` : `<span>${p.photo||'❔'}</span>`}</div>
              <div class="cap"><b>${esc(p.name)}</b></div>
            </div>
            <div class="flip-face flip-back">
              <div class="role">${esc(p.role)}</div>
              <div style="font-size:13px;color:var(--muted)">${esc(p.rank)}</div>
              ${p.start? `<div data-countdown="${p.start}"></div><div style="font-size:9.5px;color:var(--muted); margin-top:6px;">served / serving</div>` : `<div style="font-size:12px;color:var(--muted); margin-top:14px;">No one currently assigned</div>`}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </section>
  <section class="section">
    <h2>Why This System Exists</h2>
    <div class="sub">Born from a stack of hand-written receipts and water bills.</div>
    <div class="card" style="display:flex; gap:20px; flex-wrap:wrap; align-items:center;">
      <div style="flex:1; min-width:240px;">
        <p style="color:var(--muted); line-height:1.7; font-size:14px;">Every month, tenants received a torn slip of paper for rent and another for water — easy to lose, hard to reconcile, and impossible for an owner to audit from a distance. Fine Villa's digital ledger keeps every receipt, notice and complaint in one place, visible to exactly the people who need it: the owner, the agent, the caretaker, and the tenant.</p>
      </div>
      <div class="ticket" style="flex:1; min-width:240px;">
        <span class="refno">Ref No. 14922</span>
        <div style="font-size:11px;color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Received From</div>
        <div style="font-family:var(--serif); font-size:18px; margin:4px 0 10px;">Telvin Nyinge — Hse 134</div>
        <div style="font-size:11px;color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Being Payment For</div>
        <div style="margin-bottom:10px;">May Rent</div>
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span>Balance</span><b style="color:var(--gold-soft)">Kshs 80,761</b>
        </div>
      </div>
    </div>
  </section>
  `;
}

/* ---------------- TOUR ---------------- */
function pageTour(){
  return `
  <section class="section">
    <h2>Tour the Villa</h2>
    <div class="sub">A look at the property — plus the story behind it.</div>
    <div class="cardgrid" style="grid-template-columns:repeat(3,1fr);">
      ${DB.tour.gallery.map(g=>`
        <div class="imgph ${g.url?'has-img':''}">
          ${g.url?
            `<img src="${esc(g.url)}" alt="${esc(g.label)}"><div class="imgcap">${esc(g.label)}${g.caption? ' — "'+esc(g.caption)+'"':''}</div>`
            : `📷<br>${esc(g.label)}${g.caption? `<div style="color:var(--ink);font-size:11px;margin-top:4px;">"${esc(g.caption)}"</div>`:''}`}
        </div>
      `).join('')}
    </div>
    <div class="card" style="margin-top:24px;">
      <h3>🏛️ Our History</h3>
      <p style="color:var(--muted); line-height:1.7; font-size:14px;">${esc(DB.tour.history)}</p>
    </div>
    <div class="card">
      <h3>⚠️ Challenges We've Faced</h3>
      <p style="color:var(--muted); line-height:1.7; font-size:14px;">${esc(DB.tour.challenge)}</p>
    </div>
    <div class="quote">${esc(DB.tour.quote)}</div>
    <div style="font-size:11px;color:var(--muted); margin-top:16px;">Content in this section is managed by the Agent Portal → Tour tab.</div>
  </section>`;
}

/* ---------------- POLICIES ---------------- */
function pagePolicies(){
  const cats = [...new Set(DB.policies.map(p=>p.cat||'General'))];
  return `
  <section class="section">
    <h2>Policies</h2>
    <div class="sub">Ground rules for a fair, well-kept estate — written and maintained by the Agent.</div>
    ${cats.map(cat=>`
      <div class="policy-cat">${esc(cat)}</div>
      <div class="cardgrid" style="grid-template-columns:repeat(2,1fr);">
        ${DB.policies.filter(p=>(p.cat||'General')===cat).map(p=>`
          <div class="card"><h3>📄 ${esc(p.title)}</h3>
            <p style="color:var(--muted); font-size:13.5px; line-height:1.6;">${esc(p.body)}</p>
            <div class="updated">Last updated ${esc(p.updated||'—')}</div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </section>`;
}

/* ---------------- GLOBAL NOTICE BOARD ---------------- */
function pageNotices(){
  const list = DB.notices.global.filter(notExpired).slice().reverse();
  return `
  <section class="section">
    <h2>Global Notice Board</h2>
    <div class="sub">Posted by the Owner / Admin and visible to everyone. Notices auto-expire after 30 days.</div>
    <div class="card">
      ${list.map(n=>`
        <div class="notice-post urg-${n.urgency||'normal'}">
          <div class="meta"><span>${esc(n.author)} · ${fmtDate(n.ts)}</span><span class="urg-tag urg-${n.urgency||'normal'}">${(n.urgency||'normal').toUpperCase()}</span></div>
          <div style="font-size:14px;">${esc(n.text)}</div>
        </div>
      `).join('') || '<div style="color:var(--muted);font-size:13px;">No notices yet.</div>'}
    </div>
  </section>`;
}

/* ============================================================
   PORTAL LOGIN
   ============================================================ */
const PORTAL_META = {
  admin:{label:'Owner / Admin', icon:'🗝️'},
  agent:{label:'Agent', icon:'💼'},
  caretaker:{label:'Caretaker', icon:'🧰'},
  tenant:{label:'Tenant', icon:'🏘️'}
};

function openLoginModal(role){
  const body = document.createElement('div');
  body.innerHTML = `
  <div class="modal-back" id="loginModal">
    <div class="modal">
      <h3>${PORTAL_META[role].icon} ${PORTAL_META[role].label} Login</h3>
      <div class="field"><label>Passcode</label><input id="passInput" placeholder="Enter your passcode" autocomplete="off"></div>
      <div id="loginErr" style="color:var(--danger); font-size:12.5px; margin-bottom:10px;"></div>
      <div style="display:flex; gap:10px;">
        <button class="btn3d btn-gold" style="flex:1" id="loginGo">Enter Portal</button>
        <button class="btn3d btn-ghost" id="loginCancel">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(body.firstElementChild);
  document.getElementById('loginCancel').onclick = ()=> document.getElementById('loginModal').remove();
  document.getElementById('loginGo').onclick = ()=> tryLogin(role);
  document.getElementById('passInput').addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(role); });
  document.getElementById('passInput').focus();
}
function tryLogin(role){
  const val = document.getElementById('passInput').value.trim();
  let identity=null;
  if(role==='admin' && val==='owner-4321') identity={ ...DB.owner };
  if(role==='agent') identity = DB.agents.find(a=>a.passcode===val && a.active!==false);
  if(role==='caretaker') identity = DB.caretakers.find(a=>a.passcode===val && a.active!==false);
  if(role==='tenant') identity = DB.tenants.find(a=>a.passcode===val && a.active!==false);
  if(!identity){ document.getElementById('loginErr').textContent='Passcode not recognised (or has been revoked). Please check and try again.'; return; }
  app.portal = role; app.identity = identity; app.page='portal';
  app.portalTab = 'profile';
  document.getElementById('loginModal').remove();
  closeMenu();
  render();
}

/* ============================================================
   PORTAL SHELL
   ============================================================ */
const PORTAL_TABS = {
  admin:[['profile','👤 Profile'],['generate','🔑 Generate Agent'],['received','📥 Received'],['send','📤 Send'],['notices','📣 Notices'],['report','📊 Report'],['audit','🕵️ Audit Log']],
  agent:[['profile','👤 Profile'],['generate','🔑 Generate Caretaker'],['tour','🗺️ Tour'],['policy','📄 Policies'],['received','📥 Received'],['send','📤 Send'],['notices','📣 Notices'],['report','📊 Report']],
  caretaker:[['profile','👤 Profile'],['generate','🔑 Generate Tenant'],['status','🏘️ House Status'],['received','📥 Received'],['send','📤 Send'],['tenants','🧾 Tenants'],['notices','📣 Notices'],['complaints','⚠️ Complaints'],['report','📊 Report']],
  tenant:[['profile','👤 Profile'],['received','📥 Received'],['send','📤 Send'],['complaints','⚠️ Complain'],['notices','📣 Notices'],['report','📊 Report']]
};

function pagePortal(){
  const role = app.portal; const meta = PORTAL_META[role];
  const tabs = PORTAL_TABS[role];
  const unread = countUnread(role);
  return `
  <div class="portal-head">
    <h2>${meta.icon} ${meta.label} Portal</h2>
    <div style="display:flex; gap:10px;">
      <span style="font-size:12px;color:var(--muted); align-self:center;">Signed in as <b style="color:var(--ink)">${esc(identityName())}</b></span>
      <button class="btn3d btn-ghost" id="logoutBtn">↩ Log out</button>
    </div>
  </div>
  <div class="portal-wrap">
    <div class="portal-nav">
      ${tabs.map(([id,label])=>`<button data-tab="${id}" class="${app.portalTab===id?'active':''}">${label}${id==='received'&&unread?`<span class="badge">${unread}</span>`:''}</button>`).join('')}
    </div>
    <div id="portalBody">${renderPortalTab(role, app.portalTab)}</div>
  </div>`;
}
function identityName(){
  if(app.portal==='admin') return DB.owner.name;
  return app.identity?.name || '';
}
function listForRole(role){
  return role==='admin'? DB.agents : role==='agent'? DB.caretakers : DB.tenants;
}
function countUnread(role){
  const label = {admin:'Admin', agent:'Agent', caretaker:'Caretaker', tenant:'Tenant'}[role];
  return DB.messages.filter(m=>m.to===label).length;
}

/* ---------------- TAB DISPATCH ---------------- */
function renderPortalTab(role, tab){
  if(tab==='profile') return tabProfile(role);
  if(tab==='generate') return tabGenerate(role);
  if(tab==='received') return tabReceived(role);
  if(tab==='send') return tabSend(role);
  if(tab==='notices') return tabNotices(role);
  if(tab==='report') return tabReport(role);
  if(tab==='audit') return tabAudit();
  if(tab==='tour') return tabTourEdit();
  if(tab==='policy') return tabPolicyEdit();
  if(tab==='status') return tabHouseStatus();
  if(tab==='tenants') return tabTenants();
  if(tab==='complaints') return role==='tenant'? tabComplainForm() : tabComplaintsList();
  return '<div class="card">Coming soon.</div>';
}

/* ---------------- PROFILE ---------------- */
function tabProfile(role){
  if(role==='admin'){
    const o=DB.owner;
    return `
    <div class="card"><h3>👤 Owner Profile</h3>
      <div class="row" style="align-items:flex-start;">
        <div style="flex:0 0 100px;">
          <div class="person-photo">${isImgUrl(o.photo)? `<img src="${esc(o.photo)}">` : `<span>${o.photo||'🧔🏾'}</span>`}</div>
          <input type="file" accept="image/*" id="p_photo" style="font-size:10px; margin-top:8px;">
        </div>
        <div style="flex:1; min-width:220px;">
          <div class="row">
            <div class="field"><label>Full Name</label><input id="p_name" value="${esc(o.name)}"></div>
            <div class="field"><label>Phone</label><input id="p_phone" value="${esc(o.phone)}"></div>
          </div>
          <div class="row">
            <div class="field"><label>Email</label><input id="p_email" value="${esc(o.email)}"></div>
            <div class="field"><label>Ownership Start Date</label><input type="date" id="p_start" value="${new Date(o.start).toISOString().slice(0,10)}"></div>
          </div>
        </div>
      </div>
      <button class="btn3d btn-gold" id="saveProfile">💾 Save Changes</button>
    </div>

    <div class="card"><h3>🔁 Hand Over Ownership</h3>
      <div style="font-size:11.5px;color:var(--muted); margin-bottom:14px;">Transfers the Owner role to a new person (e.g. a successor or family member). ${esc(o.name)} is archived into the history below the moment this happens, and the Home page flip card switches over automatically.</div>
      <div class="row">
        <div class="field"><label>Successor Full Name</label><input id="ho_name" placeholder="Full name"></div>
        <div class="field"><label>Phone</label><input id="ho_phone" placeholder="07XX XXX XXX"></div>
      </div>
      <div class="row">
        <div class="field"><label>Email</label><input id="ho_email" placeholder="name@email.com"></div>
        <div class="field"><label>Reason (optional)</label><input id="ho_reason" placeholder="e.g. Retirement, passed to son"></div>
      </div>
      <button class="btn3d btn-danger" id="handoverBtn">🔁 Hand Over Ownership</button>
    </div>

    <div class="card"><h3>🏛️ Ownership History</h3>
      <div class="cardgrid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">
        <div class="history-card current">
          <span class="cur-badge">CURRENT</span>
          <div class="hphoto">${isImgUrl(o.photo)? `<img src="${esc(o.photo)}">` : `<span>${o.photo||'🧔🏾'}</span>`}</div>
          <b>${esc(o.name)}</b>
          <span>${fmtDate(o.start).split(',')[0]} — Present</span>
        </div>
        ${(DB.ownerHistory||[]).slice().reverse().map(h=>`
          <div class="history-card">
            <div class="hphoto">${isImgUrl(h.photo)? `<img src="${esc(h.photo)}">` : `<span>${h.photo||'🧔🏾'}</span>`}</div>
            <b>${esc(h.name)}</b>
            <span>${fmtDate(h.start).split(',')[0]} — ${fmtDate(h.end).split(',')[0]}</span>
            ${h.reason? `<span class="reason">${esc(h.reason)}</span>`:''}
          </div>
        `).join('') || '<div style="color:var(--muted); font-size:12.5px;">No previous owners yet.</div>'}
      </div>
    </div>`;
  }
  if(role==='tenant'){
    const t=app.identity;
    const bal = t.balance||0, exp=t.rentExpected||0, paid=t.rentPaid||0;
    return `
    <div class="card"><h3>👤 Tenant Profile <span style="font-size:11px;color:var(--muted); font-weight:400;">(editable only by Caretaker)</span></h3>
      <div class="row"><div><label style="display:block;font-size:11px;color:var(--muted);">Name</label><div style="padding:8px 0;">${esc(t.name)}</div></div>
      <div><label style="display:block;font-size:11px;color:var(--muted);">House No.</label><div style="padding:8px 0;">${esc(t.house)}</div></div></div>
      <div class="row"><div><label style="display:block;font-size:11px;color:var(--muted);">Phone</label><div style="padding:8px 0;">${esc(t.phone)}</div></div>
      <div><label style="display:block;font-size:11px;color:var(--muted);">Email</label><div style="padding:8px 0;">${esc(t.email)}</div></div></div>
      <div style="font-size:11px;color:var(--muted);">Passcode: <span class="pass-chip">${esc(t.passcode)}</span></div>
    </div>
    <div class="card"><h3>🧾 Rent Balance</h3>
      <div class="rent-box">
        <div class="stat"><b>${money(exp)}</b><span>Expected / month</span></div>
        <div class="stat"><b>${money(paid)}</b><span>Paid this month</span></div>
        <div class="stat"><b style="color:${bal>0?'var(--danger)':'var(--ok)'}">${money(bal)}</b><span>Balance</span></div>
        <div class="stat"><b>${esc(t.lastPayment||'—')}</b><span>Last Payment</span></div>
      </div>
    </div>`;
  }
  const list = role==='agent'? DB.agents : DB.caretakers;
  const rec = list.find(r=>r.passcode===app.identity.passcode) || app.identity;
  return `<div class="card"><h3>👤 ${PORTAL_META[role].label} Profile</h3>
    <div class="row" style="align-items:flex-start;">
      <div style="flex:0 0 100px;">
        <div class="person-photo">${isImgUrl(rec.photo)? `<img src="${esc(rec.photo)}">` : `<span>${rec.photo||(role==='agent'?'💼':'🧰')}</span>`}</div>
        <input type="file" accept="image/*" id="p_photo" style="font-size:10px; margin-top:8px;">
      </div>
      <div style="flex:1; min-width:200px;">
        <div><label style="display:block;font-size:11px;color:var(--muted);">Name</label><div style="padding:8px 0;">${esc(rec.name)}</div></div>
        <div><label style="display:block;font-size:11px;color:var(--muted);">Phone</label><div style="padding:8px 0;">${esc(rec.phone)}</div></div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--muted);">Serving since ${fmtDate(rec.start).split(',')[0]}${rec.active===false?' · <span style="color:var(--danger)">Access revoked</span>':''} · Passcode: <span class="pass-chip">${esc(rec.passcode)}</span></div>
  </div>`;
}

/* ---------------- GENERATE PASSCODE ---------------- */
function tabGenerate(role){
  const target = {admin:'Agent', agent:'Caretaker', caretaker:'Tenant'}[role];
  const list = {admin:DB.agents, agent:DB.caretakers, caretaker:DB.tenants}[role];
  const extraField = role==='caretaker' ? `<div class="field"><label>House No. (001–200)</label><input id="g_house" placeholder="e.g. 057"></div>` :
    `<div class="field"><label>${role==='admin'?'ID Number':'Email'}</label><input id="g_extra" placeholder="${role==='admin'?'e.g. 31245678':'name@email.com'}"></div>`;
  const canRevoke = role==='agent' || role==='admin' || role==='caretaker';
  return `
  <div class="card">
    <h3>🔑 Generate ${target} Passcode</h3>
    <div class="row">
      <div class="field"><label>Full Name</label><input id="g_name" placeholder="Full name"></div>
      <div class="field"><label>Phone Number</label><input id="g_phone" placeholder="07XX XXX XXX"></div>
    </div>
    ${extraField}
    <button class="btn3d btn-gold" id="genBtn">⚙️ Generate Passcode</button>
  </div>
  <div class="card">
    <h3>📋 ${target} Records</h3>
    <table><thead><tr><th>Name</th><th>${role==='caretaker'?'House':(role==='admin'?'ID No.':'Email')}</th><th>Phone</th><th>Passcode</th>${canRevoke?'<th></th>':''}</tr></thead>
    <tbody>
      ${list.map((r,i)=>`<tr>
        <td>${esc(r.name)}</td><td>${esc(role==='caretaker'? r.house : (role==='admin'? r.id : r.email))}</td><td>${esc(r.phone)}</td>
        <td><span class="pass-chip" style="${r.active===false?'opacity:.4;text-decoration:line-through;':''}">${esc(r.passcode)}</span></td>
        ${canRevoke? `<td style="display:flex; gap:6px;">
            <button class="btn3d btn-sm" data-regen="${i}">↻ Regenerate</button>
            <button class="btn3d btn-sm ${r.active===false?'btn-gold':'btn-danger'}" data-revoke="${i}">${r.active===false?'Restore':'Revoke'}</button>
          </td>`:''}
      </tr>`).join('') || `<tr><td colspan="5" style="color:var(--muted)">No records yet.</td></tr>`}
    </tbody></table>
  </div>`;
}

/* ---------------- RECEIVED ---------------- */
function tabReceived(role){
  const label = {admin:'Admin', agent:'Agent', caretaker:'Caretaker', tenant:'Tenant'}[role];
  const msgs = DB.messages.filter(m=>m.to===label).slice().reverse();
  return `
  <div class="card">
    <h3>📥 Received</h3>
    ${msgs.map(m=>`
      <div class="msg-item">
        <div class="meta"><span>From ${esc(m.from)}</span><span>${fmtDate(m.ts)}</span></div>
        <div style="font-weight:700; font-size:13.5px; margin-bottom:4px;">${esc(m.subject)}</div>
        <div style="font-size:13px; color:var(--muted);">${esc(m.body)}</div>
        ${m.file?`<div class="attach-box">📎 ${esc(m.file)}</div>`:''}
      </div>`).join('') || '<div style="color:var(--muted);font-size:13px;">Nothing received yet.</div>'}
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn3d" data-save="csv">⬇ Save CSV</button>
      <button class="btn3d" data-save="excel">⬇ Save Excel</button>
      <button class="btn3d" data-save="pdf">🖨 Save / Print PDF</button>
    </div>
  </div>`;
}

/* ---------------- SEND ---------------- */
function sendRecipients(role){
  if(role==='admin') return [['Agent','Agent']];
  if(role==='agent') return [['Admin','Owner / Admin'],['Caretaker','Caretaker']];
  if(role==='caretaker') return [['Agent','Agent'],['Tenant','All Tenants']];
  if(role==='tenant') return [['Caretaker','Caretaker']];
  return [];
}
function tabSend(role){
  const recips = sendRecipients(role);
  return `
  <div class="card">
    <h3>📤 Send</h3>
    <div class="row">
      <div class="field"><label>To</label><select id="s_to">${recips.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field"><label>Subject</label><input id="s_subject" placeholder="e.g. June rent receipt"></div>
    </div>
    <div class="field"><label>Message</label>
      <textarea id="s_body" rows="4" placeholder="Write your message..."></textarea>
      <div class="attach-box"><span class="attach-btn" id="attachBtn">+</span> <span id="attachLabel">Attach a file, document or image (optional)</span></div>
      <input type="file" id="fileInput" class="hide">
    </div>
    <button class="btn3d btn-gold" id="sendBtn">📨 Send</button>
  </div>`;
}

/* ---------------- NOTICES ---------------- */
function noticeBoards(role){
  if(role==='admin') return [['global','Global Notice Board', true]];
  if(role==='agent') return [['global','Global Notice Board', false],['agent','Agent Notice Board', true]];
  if(role==='caretaker') return [['agent','From Agent', false],['caretaker','Caretaker Notice Board', true],['tenant','Tenant Notice Board', true]];
  if(role==='tenant') return [['caretaker','From Caretaker', false],['tenant','Tenant Notice Board', false]];
  return [];
}
function tabNotices(role){
  const boards = noticeBoards(role);
  return boards.map(([id,label,canPost])=>`
    <div class="card">
      <h3>📣 ${esc(label)}</h3>
      ${(DB.notices[id]||[]).filter(notExpired).slice().reverse().map(n=>`
        <div class="notice-post urg-${n.urgency||'normal'}">
          <div class="meta"><span>${esc(n.author)} · ${fmtDate(n.ts)}</span><span class="urg-tag urg-${n.urgency||'normal'}">${(n.urgency||'normal').toUpperCase()}</span></div>
          <div style="font-size:13.5px;">${esc(n.text)}</div>
        </div>
      `).join('') || '<div style="color:var(--muted);font-size:13px;">No posts yet.</div>'}
      ${canPost? `
        <div class="field" style="margin-top:12px;"><textarea id="np_${id}" rows="2" placeholder="Post a notice to ${esc(label)}..."></textarea></div>
        <div class="field"><label>Urgency</label><select id="nu_${id}"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></div>
        <button class="btn3d btn-gold" data-postnotice="${id}">Post Notice</button>` : ''}
    </div>
  `).join('');
}

/* ---------------- REPORT ---------------- */
function tabReport(role){
  const occ = DB.houses.filter(h=>h.status==='occ').length, emp = DB.houses.length-occ;
  const msgBars = ['Admin','Agent','Caretaker','Tenant'].map(k=>({k, v: DB.messages.filter(m=>m.to===k).length}));
  const peopleBars = [{k:'Agents', v:DB.agents.length},{k:'Caretakers', v:DB.caretakers.length},{k:'Tenants', v:DB.tenants.length}];
  const expected = DB.tenants.reduce((s,t)=>s+(t.rentExpected||0),0);
  const paid = DB.tenants.reduce((s,t)=>s+(t.rentPaid||0),0);
  let rentBlock = '';
  if(role==='admin'){
    rentBlock = `<div class="svg-card"><h4>Rent Collection (this month)</h4>${svgBars([{k:'Expected',v:expected},{k:'Collected',v:paid}])}<div style="font-size:11px;color:var(--muted); margin-top:6px;">${money(expected-paid)} outstanding across ${DB.tenants.length} recorded tenant(s)</div></div>`;
  }
  return `
  <div class="cardgrid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
    <div class="svg-card"><h4>Occupancy</h4>${svgDonut(occ,emp)}<div style="font-size:11px;color:var(--muted); margin-top:6px;">${occ} occupied · ${emp} vacant of ${DB.houses.length} units</div></div>
    <div class="svg-card"><h4>Messages by Recipient</h4>${svgBars(msgBars)}</div>
    <div class="svg-card"><h4>People on Record</h4>${svgBars(peopleBars)}</div>
    <div class="svg-card"><h4>Complaints</h4>${svgBars([{k:'Open',v:DB.complaints.filter(c=>c.status==='open').length},{k:'In Progress',v:DB.complaints.filter(c=>c.status==='inprogress').length},{k:'Resolved',v:DB.complaints.filter(c=>c.status==='resolved').length}])}</div>
    ${rentBlock}
  </div>`;
}

/* ---------------- ADMIN: AUDIT LOG ---------------- */
function tabAudit(){
  return `<div class="card">
    <h3>🕵️ Audit Log <span style="font-size:11px;color:var(--muted); font-weight:400;">(who generated what, and when)</span></h3>
    <div style="font-size:11.5px;color:var(--muted); margin-bottom:14px;">Clearing is meant to happen once, at the end of each month — it wipes this list only, nothing else in the system.</div>
    ${DB.auditLog.map(a=>`<div class="audit-row"><b style="color:var(--ink)">${esc(a.actor)}</b> ${esc(a.action)} — ${esc(a.detail)} <span style="float:right;">${fmtDate(a.ts)}</span></div>`).join('') || '<div style="color:var(--muted);font-size:13px;">No activity logged yet.</div>'}
    <button class="btn3d btn-danger" id="clearAudit" style="margin-top:16px;">🧹 Clear Audit Log (end of month)</button>
  </div>`;
}

/* ---------------- AGENT: TOUR / POLICY EDIT ---------------- */
function tabTourEdit(){
  return `
  <div class="card"><h3>🗺️ Edit Tour Content</h3>
    <div class="field"><label>Villa History</label><textarea id="t_history" rows="4">${esc(DB.tour.history)}</textarea></div>
    <div class="field"><label>Challenges Faced</label><textarea id="t_challenge" rows="3">${esc(DB.tour.challenge)}</textarea></div>
    <div class="field"><label>Inspirational Quote</label><input id="t_quote" value="${esc(DB.tour.quote)}"></div>
    <button class="btn3d btn-gold" id="saveTour" style="margin-top:6px;">💾 Publish to Tour Page</button>
  </div>
  <div class="card"><h3>📷 Gallery Images</h3>
    <div style="font-size:11.5px;color:var(--muted); margin-bottom:14px;">Upload a photo for each angle (max 5MB, JPG/PNG). Uploading replaces the placeholder immediately.</div>
    <div class="cardgrid" style="grid-template-columns:repeat(3,1fr);">
      ${DB.tour.gallery.map((g,i)=>`
        <div>
          <div class="imgph ${g.url?'has-img':''}" style="min-height:120px;">
            ${g.url? `<img src="${esc(g.url)}" alt="${esc(g.label)}">` : `📷<br>${esc(g.label)}`}
          </div>
          <div style="font-size:11px;color:var(--muted); margin:8px 0 4px;">${esc(g.label)}</div>
          <input type="file" accept="image/*" data-upload="${i}" style="font-size:11px; padding:6px;">
          <input data-cap="${i}" value="${esc(g.caption)}" placeholder="Caption..." style="margin-top:6px;">
        </div>
      `).join('')}
    </div>
    <button class="btn3d btn-gold" id="saveGallery" style="margin-top:16px;">💾 Save Captions</button>
  </div>`;
}
function tabPolicyEdit(){
  return `
  <div class="card"><h3>📄 Add / Manage Policy</h3>
    <div class="row">
      <div class="field"><label>Policy Title</label><input id="pol_title" placeholder="e.g. Pet Policy"></div>
      <div class="field"><label>Category</label><select id="pol_cat"><option>Payments</option><option>Maintenance</option><option>Conduct</option><option>Move-in / Move-out</option></select></div>
    </div>
    <div class="field"><label>Policy Details</label><textarea id="pol_body" rows="3" placeholder="Describe the policy..."></textarea>
      <div class="attach-box"><span class="attach-btn">+</span> Attach supporting document (optional)</div>
    </div>
    <button class="btn3d btn-gold" id="addPolicy">📨 Publish to Policies Page</button>
  </div>
  <div class="card"><h3>Current Policies</h3>
    ${DB.policies.map(p=>`<div class="msg-item"><b>${esc(p.title)}</b> <span style="font-size:10.5px;color:var(--gold-soft);">${esc(p.cat||'General')}</span><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${esc(p.body)}</div><div class="updated">Updated ${esc(p.updated)}</div></div>`).join('')}
  </div>`;
}

/* ---------------- CARETAKER: HOUSE STATUS ---------------- */
function tabHouseStatus(){
  const occ = DB.houses.filter(h=>h.status==='occ').length;
  return `
  <div class="card">
    <h3>🏘️ House Status <span style="font-size:12px;color:var(--muted); font-weight:400;">(${occ} occupied / ${DB.houses.length-occ} vacant of 200)</span></h3>
    <div style="font-size:12px;color:var(--muted); margin-bottom:10px;">Click a unit to toggle occupied ⇄ vacant.</div>
    <div class="house-grid">
      ${DB.houses.map(h=>`<div class="house ${h.status} ${h.lastInspected?'inspected':''}" data-house="${h.no}" title="${h.status==='occ'?'Occupied — '+esc(h.tenant||''):'Vacant'}">${h.no}</div>`).join('')}
    </div>
    <button class="btn3d btn-gold" id="reportStatus" style="margin-top:14px;">📤 Send Occupancy Report to Agent</button>
  </div>
  <div class="card">
    <h3>🧹 Bulk Inspection</h3>
    <div class="row">
      <div class="field"><label>From House No.</label><input id="bulk_from" placeholder="001"></div>
      <div class="field"><label>To House No.</label><input id="bulk_to" placeholder="020"></div>
    </div>
    <button class="btn3d btn-gold" id="bulkInspect">✔ Mark Block as Inspected Today</button>
  </div>
  <div class="card">
    <h3>🛠️ Maintenance Log</h3>
    <div class="row">
      <div class="field"><label>House No.</label><input id="maint_house" placeholder="e.g. 057"></div>
      <div class="field"><label>Note</label><input id="maint_note" placeholder="e.g. Replaced kitchen tap"></div>
    </div>
    <button class="btn3d btn-gold" id="addMaint">➕ Add Log Entry</button>
    <div style="margin-top:14px;">
      ${DB.houses.filter(h=>h.maintLog && h.maintLog.length).flatMap(h=>h.maintLog.map(l=>({...l, house:h.no}))).sort((a,b)=>b.ts-a.ts).slice(0,10).map(l=>`
        <div class="audit-row"><b style="color:var(--ink)">House ${esc(l.house)}</b> — ${esc(l.text)} <span style="float:right;">${fmtDate(l.ts)}</span></div>
      `).join('') || '<div style="color:var(--muted);font-size:13px;">No maintenance entries yet.</div>'}
    </div>
  </div>`;
}

/* ---------------- CARETAKER: TENANTS ---------------- */
function tabTenants(){
  return `
  <div class="card">
    <h3>🧾 Tenant Records</h3>
    <table><thead><tr><th>House</th><th>Name</th><th>Phone</th><th>Rent Expected</th><th>Balance</th><th>Last Payment</th><th></th></tr></thead>
    <tbody>
      ${DB.tenants.map((t,i)=>`<tr>
        <td>${esc(t.house)}</td>
        <td>${esc(t.name)}</td>
        <td>${esc(t.phone)}</td>
        <td>${money(t.rentExpected||0)}</td>
        <td style="color:${(t.balance||0)>0?'var(--danger)':'var(--ok)'}">${money(t.balance||0)}</td>
        <td>${esc(t.lastPayment||'—')}</td>
        <td><button class="btn3d btn-sm" data-edittenant="${i}">✎ Edit</button></td>
      </tr>`).join('') || `<tr><td colspan="7" style="color:var(--muted)">No tenants yet — generate one in the "Generate Tenant" tab.</td></tr>`}
    </tbody></table>
  </div>`;
}
function openTenantEditModal(i){
  const t = DB.tenants[i];
  const back = document.createElement('div');
  back.innerHTML = `<div class="modal-back" id="tenantEditModal"><div class="modal">
    <h3>✎ Edit Tenant — House ${esc(t.house)}</h3>
    <div class="row">
      <div class="field"><label>Full Name</label><input id="te_name" value="${esc(t.name)}"></div>
      <div class="field"><label>House No. (001–200)</label><input id="te_house" value="${esc(t.house)}"></div>
    </div>
    <div class="row">
      <div class="field"><label>Phone</label><input id="te_phone" value="${esc(t.phone)}"></div>
      <div class="field"><label>Email</label><input id="te_email" value="${esc(t.email||'')}"></div>
    </div>
    <div class="row">
      <div class="field"><label>Rent Expected / Month</label><input id="te_expected" value="${t.rentExpected||0}"></div>
      <div class="field"><label>Balance</label><input id="te_balance" value="${t.balance||0}"></div>
    </div>
    <div class="row">
      <div class="field"><label>Last Payment Date</label><input type="date" id="te_lastpayment" value="${esc(t.lastPayment||'')}"></div>
    </div>
    <div id="tenantEditErr" style="color:var(--danger); font-size:12.5px; margin-bottom:10px;"></div>
    <button class="btn3d btn-gold" id="teSave" style="width:100%; margin-bottom:16px;">💾 Save Details</button>

    <div style="border-top:1px solid var(--line); padding-top:14px;">
      <h4 style="font-size:12px; color:var(--gold); margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Record a Payment</h4>
      <div class="field"><label>Amount Received</label><input id="te_payment" placeholder="e.g. 18670"></div>
      <button class="btn3d btn-gold" id="teRecordPayment" style="width:100%;">➕ Record Payment</button>
      <div style="font-size:11px;color:var(--muted); margin-top:8px;">Last payment: ${esc(t.lastPayment||'—')}. Recording a payment adds it to "Paid this month" and reduces the balance.</div>
    </div>

    <button class="btn3d btn-ghost" id="teCancel" style="width:100%; margin-top:16px;">Close</button>
  </div></div>`;
  document.body.appendChild(back.firstElementChild);
  document.getElementById('teCancel').onclick = ()=> document.getElementById('tenantEditModal').remove();

  document.getElementById('teSave').onclick = ()=>{
    const newHouse = document.getElementById('te_house').value.trim().padStart(3,'0');
    const oldHouse = t.house;
    const newName = document.getElementById('te_name').value.trim() || t.name;
    if(newHouse !== oldHouse){
      const clash = DB.tenants.find((x,xi)=>xi!==i && x.house===newHouse);
      if(clash){ document.getElementById('tenantEditErr').textContent = `House ${newHouse} already has a tenant (${clash.name}).`; return; }
      const oldH = DB.houses.find(h=>h.no===oldHouse); if(oldH){ oldH.status='emp'; oldH.tenant=null; }
      const newH = DB.houses.find(h=>h.no===newHouse); if(newH){ newH.status='occ'; newH.tenant=newName; }
      logAudit(identityName(), 'reassigned tenant', `${newName}: House ${oldHouse} → ${newHouse}`);
    }
    t.name = newName; t.house = newHouse; t.no = newHouse;
    t.phone = document.getElementById('te_phone').value.trim();
    t.email = document.getElementById('te_email').value.trim();
    t.rentExpected = parseFloat(document.getElementById('te_expected').value)||0;
    t.balance = parseFloat(document.getElementById('te_balance').value)||0;
    t.lastPayment = document.getElementById('te_lastpayment').value || t.lastPayment;
    const h = DB.houses.find(h=>h.no===t.house); if(h) h.tenant = t.name;
    logAudit(identityName(), 'updated tenant record for', `${t.name} (House ${t.house})`);
    saveDB(true);
    document.getElementById('tenantEditModal').remove();
    render();
  };

  document.getElementById('teRecordPayment').onclick = ()=>{
    const amt = parseFloat(document.getElementById('te_payment').value);
    if(!amt || amt<=0){ document.getElementById('tenantEditErr').textContent = 'Enter a valid payment amount.'; return; }
    t.rentPaid = (t.rentPaid||0) + amt;
    t.balance = Math.max(0, (t.balance||0) - amt);
    t.lastPayment = new Date().toISOString().slice(0,10);
    logAudit(identityName(), 'recorded a payment for', `${t.name} — ${money(amt)}`);
    saveDB(true);
    document.getElementById('tenantEditModal').remove();
    toast('Payment recorded');
    render();
  };
}

/* ---------------- COMPLAINTS ---------------- */
const COMPLAINT_STAGES = ['open','inprogress','resolved'];
const COMPLAINT_LABELS = {open:'Open', inprogress:'In Progress', resolved:'Resolved'};
function statusTrack(status){
  const idx = COMPLAINT_STAGES.indexOf(status);
  return `<div class="status-track">${COMPLAINT_STAGES.map((s,i)=>`<span class="${i<=idx?'done':''}">${COMPLAINT_LABELS[s]}</span>`).join('')}</div>`;
}
function tabComplainForm(){
  return `
  <div class="card">
    <h3>⚠️ Raise a Complaint</h3>
    <div class="field"><label>Describe the issue</label><textarea id="c_text" rows="4" placeholder="What's wrong, and since when?"></textarea></div>
    <button class="btn3d btn-danger" id="sendComplaint">Send Complaint</button>
  </div>
  <div class="card"><h3>Your Past Complaints</h3>
    ${DB.complaints.filter(c=>c.tenant===app.identity.name).slice().reverse().map(c=>`
      <div class="msg-item"><div class="meta"><span>${fmtDate(c.ts)}</span></div>${esc(c.text)}${statusTrack(c.status)}</div>
    `).join('') || '<div style="color:var(--muted);font-size:13px;">None yet.</div>'}
  </div>`;
}
function tabComplaintsList(){
  return `
  <div class="card">
    <h3>⚠️ Complaints from Tenants</h3>
    ${DB.complaints.slice().reverse().map((c)=>`
      <div class="msg-item">
        <div class="meta"><span>House ${esc(c.house)} — ${esc(c.tenant)}</span><span>${fmtDate(c.ts)}</span></div>
        <div style="font-size:13.5px;">${esc(c.text)}</div>
        ${statusTrack(c.status)}
        <div style="margin-top:8px; display:flex; gap:8px;">
          ${c.status!=='inprogress' && c.status!=='resolved' ? `<button class="btn3d btn-sm" data-progress="${c.id}">Mark In Progress</button>`:''}
          ${c.status!=='resolved'? `<button class="btn3d btn-sm btn-gold" data-resolve="${c.id}">Mark Resolved</button>` : `<span style="color:var(--ok); font-size:12px;">✔ Resolved</span>`}
        </div>
      </div>
    `).join('') || '<div style="color:var(--muted);font-size:13px;">No complaints logged.</div>'}
  </div>`;
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
function attachPageEvents(){
  document.querySelectorAll('[data-flip]').forEach(el=>{ el.onclick = ()=> el.classList.toggle('flipped'); });

  document.querySelectorAll('.portal-nav button[data-tab]').forEach(b=>{
    b.onclick = ()=>{ app.portalTab=b.dataset.tab; render(); };
  });
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.onclick = ()=>{ app.portal=null; app.identity=null; app.page='home'; render(); };

  const saveProfile = document.getElementById('saveProfile');
  if(saveProfile) saveProfile.onclick = ()=>{
    DB.owner.name=document.getElementById('p_name').value;
    DB.owner.phone=document.getElementById('p_phone').value;
    DB.owner.email=document.getElementById('p_email').value;
    const sd = document.getElementById('p_start').value;
    if(sd) DB.owner.start = new Date(sd).getTime();
    app.identity = { ...DB.owner };
    saveDB(true); render();
  };

  const pPhoto = document.getElementById('p_photo');
  if(pPhoto) pPhoto.onchange = (e)=> uploadPersonPhoto(app.portal, e.target.files[0]);

  const handoverBtn = document.getElementById('handoverBtn');
  if(handoverBtn) handoverBtn.onclick = ()=>{
    const name = document.getElementById('ho_name').value.trim();
    const phone = document.getElementById('ho_phone').value.trim();
    const email = document.getElementById('ho_email').value.trim();
    const reason = document.getElementById('ho_reason').value.trim();
    if(!name || !phone){ toast("Enter the successor's name and phone"); return; }
    if(!confirm(`Hand over ownership to ${name}? ${DB.owner.name} will be archived into history.`)) return;
    DB.ownerHistory = DB.ownerHistory || [];
    DB.ownerHistory.push({ ...DB.owner, end:Date.now(), reason: reason || 'Ownership transferred' });
    const outgoing = DB.owner.name;
    DB.owner = { name, phone, email, photo:null, start:Date.now() };
    app.identity = { ...DB.owner };
    logAudit(name, 'received ownership from', outgoing);
    saveDB(true); toast('Ownership transferred to '+name); render();
  };

  const genBtn = document.getElementById('genBtn');
  if(genBtn) genBtn.onclick = ()=>{
    const role = app.portal;
    const name = document.getElementById('g_name').value.trim();
    const phone = document.getElementById('g_phone').value.trim();
    if(!name || !phone){ toast('Please fill in name and phone'); return; }
    const actor = identityName();
    if(role==='admin'){
      const id = document.getElementById('g_extra').value.trim();
      const seq = DB.agents.length+1;
      const pc = genPass('agt',seq);
      DB.agents.push({name, id, phone, passcode:pc, start:Date.now(), end:null, photo:null, active:true});
      logAudit(actor, 'generated Agent passcode', `${name} → ${pc}`);
    } else if(role==='agent'){
      const email = document.getElementById('g_extra').value.trim();
      const seq = DB.caretakers.length+1;
      const pc = genPass('care',seq);
      DB.caretakers.push({name, email, phone, passcode:pc, start:Date.now(), end:null, photo:null, active:true});
      logAudit(actor, 'generated Caretaker passcode', `${name} → ${pc}`);
    } else if(role==='caretaker'){
      const house = (document.getElementById('g_house').value.trim()||'000').padStart(3,'0');
      const pc = `tent-${house}-` + genPass('x',0).split('-')[2];
      DB.tenants.push({no:house, name, phone, email:'', passcode:pc, house, rentExpected:0, rentPaid:0, balance:0, lastPayment:'', active:true});
      const h = DB.houses.find(h=>h.no===house); if(h){ h.status='occ'; h.tenant=name; }
      logAudit(actor, 'generated Tenant passcode', `${name} (House ${house}) → ${pc}`);
    }
    saveDB(true); render();
  };

  document.querySelectorAll('[data-revoke]').forEach(b=>{
    b.onclick = ()=>{
      const role = app.portal; const i = b.dataset.revoke;
      const list = listForRole(role);
      const rec = list[i];
      if(rec.active===false){
        rec.active = true; rec.end = null;
        logAudit(identityName(), 'restored access for', rec.name);
      } else {
        const reason = prompt(`Reason for revoking ${rec.name}'s access? (optional)`) || '';
        rec.active = false; rec.end = Date.now(); rec.reason = reason;
        logAudit(identityName(), 'revoked access for', rec.name + (reason? ' — '+reason : ''));
      }
      saveDB(true); render();
    };
  });
  document.querySelectorAll('[data-regen]').forEach(b=>{
    b.onclick = ()=>{
      const role = app.portal; const i = b.dataset.regen;
      const list = listForRole(role);
      let pc;
      if(role==='caretaker'){
        pc = `tent-${list[i].house}-` + genPass('x',0).split('-')[2];
      } else {
        const prefix = role==='admin'? 'agt':'care';
        pc = genPass(prefix, parseInt(i)+1);
      }
      list[i].passcode = pc;
      logAudit(identityName(), 'regenerated passcode for', list[i].name);
      saveDB(true); render();
    };
  });

  document.querySelectorAll('[data-save]').forEach(b=>{
    b.onclick = ()=>{
      const label = {admin:'Admin', agent:'Agent', caretaker:'Caretaker', tenant:'Tenant'}[app.portal];
      const msgs = DB.messages.filter(m=>m.to===label);
      const type = b.dataset.save;
      if(type==='csv'){
        downloadBlob(toCSV([['From','Subject','Message','Date'], ...msgs.map(m=>[m.from,m.subject,m.body,fmtDate(m.ts)])]), 'received.csv', 'text/csv');
      } else if(type==='excel'){
        downloadBlob(toCSV([['From','Subject','Message','Date'], ...msgs.map(m=>[m.from,m.subject,m.body,fmtDate(m.ts)])]), 'received.xls', 'application/vnd.ms-excel');
      } else { window.print(); }
    };
  });

  const attachBtn = document.getElementById('attachBtn');
  if(attachBtn){
    attachBtn.onclick = ()=> document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = (e)=>{
      const f = e.target.files[0];
      document.getElementById('attachLabel').textContent = f? '📎 '+f.name : 'Attach a file, document or image (optional)';
    };
  }
  const sendBtn = document.getElementById('sendBtn');
  if(sendBtn) sendBtn.onclick = ()=>{
    const to = document.getElementById('s_to').value;
    const subject = document.getElementById('s_subject').value.trim();
    const body = document.getElementById('s_body').value.trim();
    const file = document.getElementById('fileInput').files[0];
    if(!subject || !body){ toast('Add a subject and message'); return; }
    const fromLabel = {admin:'Admin', agent:'Agent', caretaker:'Caretaker', tenant:'Tenant'}[app.portal];
    DB.messages.push({id:Date.now(), from:fromLabel, to, subject, body, file: file?file.name:null, ts:Date.now()});
    saveDB(true); toast('Sent to '+to); render();
  };

  document.querySelectorAll('[data-postnotice]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.postnotice;
      const txt = document.getElementById('np_'+id).value.trim();
      const urgency = document.getElementById('nu_'+id).value;
      if(!txt) return;
      const author = {admin:'Admin', agent:'Agent', caretaker:'Caretaker'}[app.portal];
      DB.notices[id] = DB.notices[id]||[];
      DB.notices[id].push({id:Date.now(), author, text:txt, ts:Date.now(), urgency});
      saveDB(true); render();
    };
  });

  const saveTour = document.getElementById('saveTour');
  if(saveTour) saveTour.onclick = ()=>{
    DB.tour.history = document.getElementById('t_history').value;
    DB.tour.challenge = document.getElementById('t_challenge').value;
    DB.tour.quote = document.getElementById('t_quote').value;
    saveDB(true); toast('Tour page updated');
  };
  document.querySelectorAll('[data-upload]').forEach(inp=>{
    inp.onchange = (e)=> uploadTourImage(parseInt(inp.dataset.upload), e.target.files[0]);
  });
  const saveGallery = document.getElementById('saveGallery');
  if(saveGallery) saveGallery.onclick = ()=>{
    document.querySelectorAll('[data-cap]').forEach(inp=>{ DB.tour.gallery[inp.dataset.cap].caption = inp.value; });
    saveDB(true); toast('Captions saved');
  };

  const addPolicy = document.getElementById('addPolicy');
  if(addPolicy) addPolicy.onclick = ()=>{
    const title = document.getElementById('pol_title').value.trim();
    const cat = document.getElementById('pol_cat').value;
    const body = document.getElementById('pol_body').value.trim();
    if(!title || !body){ toast('Add a title and details'); return; }
    DB.policies.push({title, cat, body, updated:new Date().toISOString().slice(0,10)});
    saveDB(true); render();
  };

  document.querySelectorAll('[data-house]').forEach(el=>{
    el.onclick = ()=>{
      const h = DB.houses.find(h=>h.no===el.dataset.house);
      const wasOcc = h.status==='occ';
      h.status = wasOcc ? 'emp' : 'occ';
      if(h.status==='emp'){
        h.tenant=null;
        DB.messages.push({id:Date.now(), from:'Caretaker', to:'Agent', subject:'Vacancy Alert — House '+h.no, body:`House ${h.no} has just been marked vacant and may need to be re-listed.`, file:null, ts:Date.now()});
      }
      saveDB(false); render();
    };
  });
  const bulkInspect = document.getElementById('bulkInspect');
  if(bulkInspect) bulkInspect.onclick = ()=>{
    const from = parseInt(document.getElementById('bulk_from').value)||1;
    const to = parseInt(document.getElementById('bulk_to').value)||from;
    const today = new Date().toISOString().slice(0,10);
    DB.houses.forEach(h=>{ const n=parseInt(h.no); if(n>=from && n<=to) h.lastInspected=today; });
    saveDB(true); toast(`Marked houses ${String(from).padStart(3,'0')}–${String(to).padStart(3,'0')} inspected`); render();
  };
  const addMaint = document.getElementById('addMaint');
  if(addMaint) addMaint.onclick = ()=>{
    const house = (document.getElementById('maint_house').value.trim()).padStart(3,'0');
    const note = document.getElementById('maint_note').value.trim();
    const h = DB.houses.find(h=>h.no===house);
    if(!h || !note){ toast('Enter a valid house number and note'); return; }
    h.maintLog = h.maintLog || [];
    h.maintLog.push({id:Date.now(), text:note, ts:Date.now()});
    saveDB(true); toast('Logged'); render();
  };
  const reportStatus = document.getElementById('reportStatus');
  if(reportStatus) reportStatus.onclick = ()=>{
    const occ = DB.houses.filter(h=>h.status==='occ').length;
    DB.messages.push({id:Date.now(), from:'Caretaker', to:'Agent', subject:'Occupancy Report', body:`${occ} of ${DB.houses.length} units occupied as of today.`, file:null, ts:Date.now()});
    saveDB(true); toast('Report sent to Agent');
  };

  document.querySelectorAll('[data-edittenant]').forEach(b=>{
    b.onclick = ()=> openTenantEditModal(parseInt(b.dataset.edittenant));
  });

  const clearAudit = document.getElementById('clearAudit');
  if(clearAudit) clearAudit.onclick = ()=>{
    if(!confirm('Clear the entire audit log? This cannot be undone — only do this at the end of the month.')) return;
    DB.auditLog = [];
    saveDB(true); toast('Audit log cleared'); render();
  };
  const sendComplaint = document.getElementById('sendComplaint');
  if(sendComplaint) sendComplaint.onclick = ()=>{
    const text = document.getElementById('c_text').value.trim();
    if(!text) return;
    DB.complaints.push({id:Date.now(), tenant:app.identity.name, house:app.identity.house, text, ts:Date.now(), status:'open'});
    saveDB(true); toast('Complaint sent to Caretaker'); render();
  };
  document.querySelectorAll('[data-progress]').forEach(b=>{
    b.onclick = ()=>{ const c = DB.complaints.find(c=>c.id==b.dataset.progress); c.status='inprogress'; saveDB(true); render(); };
  });
  document.querySelectorAll('[data-resolve]').forEach(b=>{
    b.onclick = ()=>{ const c = DB.complaints.find(c=>c.id==b.dataset.resolve); c.status='resolved'; saveDB(true); render(); };
  });
}

/* ============================================================
   HEADER / NAV / MENU WIRING (static, once)
   ============================================================ */
function closeMenu(){
  document.getElementById('sidemenu').classList.remove('open');
  document.getElementById('overlay').classList.add('hide');
}
function initChrome(){
  document.getElementById('menuBtn').onclick = ()=>{
    document.getElementById('sidemenu').classList.add('open');
    document.getElementById('overlay').classList.remove('hide');
  };
  document.getElementById('overlay').onclick = closeMenu;
  document.querySelectorAll('.sidemenu [data-page]').forEach(b=>{
    b.onclick = ()=>{ app.page=b.dataset.page; closeMenu(); render(); };
  });
  document.querySelectorAll('.sidemenu [data-portal]').forEach(b=>{
    b.onclick = ()=>{ openLoginModal(b.dataset.portal); };
  });
  document.querySelectorAll('#pillnav [data-page]').forEach(b=>{
    b.onclick = ()=>{ app.page=b.dataset.page; render(); };
  });
  document.getElementById('darkBtn').onclick = ()=>{
    app.theme = app.theme==='light' ? 'dark' : 'light';
    document.getElementById('darkBtn').innerHTML = app.theme==='light' ? '☀️ Light Mode' : '🌙 Dark Mode';
    render();
  };
  document.getElementById('helpBtn').onclick = openHelp;
}
function openHelp(){
  const items = [
    ['☰ Menu','Opens the side panel with all four portals plus quick links to the public pages. It also shows which portal you\'re currently signed into.'],
    ['🌙 Dark Mode','Switches the whole system between dark and light themes.'],
    ['🏠 Home','Brings you back to the welcome page with live occupancy, the ownership chain, and the flip cards.'],
    ['🗺️ Tour','Shows the property gallery, history, challenges and the Fine Villa motto. Edited by the Agent.'],
    ['📄 Policies','House rules grouped by category — Payments, Maintenance, Conduct, Move-in/out. Published by the Agent.'],
    ['📣 Global Notice Board','Estate-wide announcements posted by the Owner/Admin, tagged by urgency, auto-expiring after 30 days.'],
    ['🗝️ Portals','Each portal needs a passcode. The Admin passcode is fixed; Agent, Caretaker and Tenant passcodes are generated by the level above them.'],
    ['📥 Received / 📤 Send','Every portal can message the portal(s) directly above or below it — this replaces the paper slips.'],
    ['⚠️ Complaints','Tenants raise issues, tracked Open → In Progress → Resolved by the Caretaker.'],
    ['📊 Report','Live charts summarising occupancy, rent collection, messages and people on record.']
  ];
  const back = document.createElement('div');
  back.innerHTML = `<div class="modal-back" id="helpModal"><div class="modal">
    <h3>⚙️ How Fine Villa Works</h3>
    ${items.map(([t,d])=>`<div class="help-item"><b>${t}</b><span>${d}</span></div>`).join('')}
    <a class="help-link" id="reportIssueLink">🐞 Report an issue with the system (not a maintenance complaint)</a>
    <button class="btn3d btn-gold" id="closeHelp" style="width:100%; margin-top:14px;">Got it</button>
  </div></div>`;
  document.body.appendChild(back.firstElementChild);
  document.getElementById('closeHelp').onclick = ()=> document.getElementById('helpModal').remove();
  document.getElementById('reportIssueLink').onclick = ()=>{
    document.getElementById('helpModal').remove();
    openSystemIssueModal();
  };
}
function openSystemIssueModal(){
  const back = document.createElement('div');
  back.innerHTML = `<div class="modal-back" id="issueModal"><div class="modal">
    <h3>🐞 Report a System Issue</h3>
    <div style="font-size:12.5px;color:var(--muted); margin-bottom:12px;">This goes to the developer, not the Caretaker — use it for bugs or things that look broken, not for maintenance requests (use the Complaints tab in the Tenant Portal for those).</div>
    <div class="field"><label>Describe what happened</label><textarea id="issue_text" rows="4" placeholder="e.g. The dark mode button doesn't work on..."></textarea></div>
    <button class="btn3d btn-gold" id="issueSend" style="width:100%;">Send Report</button>
  </div></div>`;
  document.body.appendChild(back.firstElementChild);
  document.getElementById('issueSend').onclick = ()=>{
    toast('Thanks — your report has been noted.');
    document.getElementById('issueModal').remove();
  };
}

/* ---------------- typing animation ---------------- */
function startTyping(){
  const el = document.getElementById('typingLine');
  if(!el) return;
  const full = "Welcome to Fine Villa Apartments";
  let i=0;
  el.textContent='';
  clearInterval(window.__typeInt);
  window.__typeInt = setInterval(()=>{
    el.textContent = full.slice(0,i+1);
    i++;
    if(i>full.length){ clearInterval(window.__typeInt); }
  }, 65);
}

/* ============================================================
   BOOT
   ============================================================ */
(async function boot(){
  await loadDB();
  initChrome();
  render();
})();