/* ============================================================
   FINE VILLA LIMITED — SYSTEM CORE  (real Supabase backend)
   Auth: Supabase Auth (email + password, invite-based onboarding)
   Data: relational tables + Row Level Security
   ============================================================ */

// This is the PUBLIC anon key — safe to ship in the browser.
// It can do nothing on its own; every table is locked down by
// Row Level Security, and privileged actions (inviting a new
// person) go through the invite-user Edge Function instead.
const SUPABASE_URL = "https://ybqwivcmznzqwxupvjii.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_p09ka2D_3bB-gkl_Et-XDQ_I6GosAfG";
const STORAGE_BUCKET = "tour-images";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let DB = null;                 // read-model cache, rebuilt from real tables
let app = { page: "home", portal: null, profile: null, portalTab: null, theme: "dark", session: null };

function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(window.__toastT); window.__toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------------- utilities (unchanged from before) ---------------- */
function esc(s){return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(ts){ if(!ts) return '—'; return new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function money(n){ return 'Kshs ' + (n||0).toLocaleString(); }
function downloadBlob(content, filename, mime){
  const blob = new Blob([content], {type:mime});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  URL.revokeObjectURL(a.href);
}
function toCSV(rows){ return rows.map(r=>r.map(c=>`"${(c??'').toString().replace(/"/g,'""')}"`).join(',')).join('\n'); }
function notExpired(n){ return !n.expires_at || new Date(n.expires_at).getTime() > Date.now(); }
function isImgUrl(p){ return typeof p==='string' && p.indexOf('http')===0; }
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
const ROLE_LABEL = { owner:'Admin', agent:'Agent', caretaker:'Caretaker', tenant:'Tenant' };

/* ============================================================
   DATA LOADING — rebuilds the DB read-model from real tables
   ============================================================ */
async function loadAll(){
  const [
    profilesR, accountsR, housesR, maintR, messagesR, noticesR,
    complaintsR, policiesR, tourR, galleryR, auditR, historyR
  ] = await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('tenant_accounts').select('*'),
    sb.from('houses').select('*').order('no'),
    sb.from('maintenance_log').select('*').order('created_at', {ascending:false}),
    sb.from('messages').select('*').order('created_at', {ascending:true}),
    sb.from('notices').select('*').order('created_at', {ascending:true}),
    sb.from('complaints').select('*').order('created_at', {ascending:true}),
    sb.from('policies').select('*'),
    sb.from('tour_content').select('*').eq('id',1).maybeSingle(),
    sb.from('tour_gallery').select('*').order('slot'),
    sb.from('audit_log').select('*').order('created_at', {ascending:false}).limit(200),
    sb.from('owner_history').select('*').order('start_date', {ascending:true}),
  ]);

  [profilesR, accountsR, housesR, maintR, messagesR, noticesR, complaintsR, policiesR, tourR, galleryR, auditR, historyR]
    .forEach(r => { if (r.error) console.error(r.error); });

  const profiles = profilesR.data || [];
  const accounts = accountsR.data || [];
  const byId = Object.fromEntries(profiles.map(p => [p.id, p]));

  const owner = profiles.find(p => p.role === 'owner') || null;
  const agents = profiles.filter(p => p.role === 'agent').map(mapPerson);
  const caretakers = profiles.filter(p => p.role === 'caretaker').map(mapPerson);
  const tenants = profiles.filter(p => p.role === 'tenant').map(p => {
    const acc = accounts.find(a => a.tenant_id === p.id) || {};
    return {
      id: p.id, name: p.name, phone: p.phone, email: p.email, house: p.house_no,
      rentExpected: acc.rent_expected || 0, rentPaid: acc.rent_paid || 0,
      balance: acc.balance || 0, lastPayment: acc.last_payment, active: p.active,
    };
  });

  const houses = (housesR.data || []).map(h => ({
    no: h.no, status: h.status,
    tenant: h.tenant_id ? (byId[h.tenant_id]?.name || null) : null,
    lastInspected: h.last_inspected,
    maintLog: (maintR.data || []).filter(m => m.house_no === h.no).map(m => ({ id:m.id, text:m.note, ts:new Date(m.created_at).getTime() })),
  }));

  const messages = (messagesR.data || []).map(m => ({
    id: m.id,
    from: ROLE_LABEL[byId[m.from_id]?.role] || 'Unknown',
    to: ROLE_LABEL[m.to_role],
    to_role: m.to_role, to_id: m.to_id, from_id: m.from_id,
    subject: m.subject, body: m.body, file: m.file_path, ts: new Date(m.created_at).getTime(),
  }));

  const notices = { global: [], agent: [], caretaker: [], tenant: [] };
  (noticesR.data || []).forEach(n => {
    notices[n.board].push({
      id: n.id, author: ROLE_LABEL[byId[n.author_id]?.role] || 'Unknown',
      text: n.text, ts: new Date(n.created_at).getTime(),
      expires_at: n.expires_at, urgency: n.urgency,
    });
  });

  const complaints = (complaintsR.data || []).map(c => ({
    id: c.id, tenant: byId[c.tenant_id]?.name || 'Unknown', house: c.house_no,
    text: c.text, status: c.status, ts: new Date(c.created_at).getTime(), tenant_id: c.tenant_id,
  }));

  const policies = (policiesR.data || []).map(p => ({
    id: p.id, title: p.title, cat: p.category, body: p.body, updated: (p.updated_at||'').slice(0,10),
  }));

  const tour = {
    history: tourR.data?.history || '', challenge: tourR.data?.challenge || '', quote: tourR.data?.quote || '',
    gallery: (galleryR.data || []).map(g => ({ slot:g.slot, label:g.label, caption:g.caption||'', url:g.url })),
  };

  const auditLog = (auditR.data || []).map(a => ({
    id: a.id, actor: byId[a.actor_id]?.name || 'System', action: a.action, detail: a.detail, ts: new Date(a.created_at).getTime(),
  }));

  const ownerHistory = (historyR.data || []).map(h => ({
    name: h.name, phone: h.phone, email: h.email, photo: h.photo_url,
    start: new Date(h.start_date).getTime(), end: new Date(h.end_date).getTime(), reason: h.reason,
  }));

  DB = {
    owner: owner ? mapPerson(owner) : { name:'Vacant', phone:'', email:'', photo:null, start:Date.now() },
    ownerHistory, agents, caretakers, tenants, houses, messages, notices, complaints, policies, tour, auditLog,
  };
}
function mapPerson(p){
  return { id:p.id, name:p.name, phone:p.phone, email:p.email, idNumber: p.id_number, photo: p.photo_url,
    start: new Date(p.start_date).getTime(), end: p.end_date ? new Date(p.end_date).getTime() : null,
    active: p.active, passcode: null, house: p.house_no };
}
async function refresh(){ await loadAll(); render(); }

/* ============================================================
   AUTH
   ============================================================ */
async function boot(){
  // If the URL contains an invite/recovery hash, Supabase's client
  // auto-detects it and creates a session — we then force a "set password" step.
  const hash = window.location.hash;
  const isInviteLink = hash.includes('type=invite') || hash.includes('type=recovery');

  const { data: { session } } = await sb.auth.getSession();
  app.session = session;

  if (session) await loadProfileForSession();

  initChrome();

  if (isInviteLink && session) {
    showSetPasswordModal();
    history.replaceState(null, '', window.location.pathname); // clean the URL
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    app.session = session;
    if (session) await loadProfileForSession(); else { app.profile = null; app.portal = null; }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') render();
  });

  await loadAll();
  render();
}
async function loadProfileForSession(){
  const { data } = await sb.from('profiles').select('*').eq('id', app.session.user.id).maybeSingle();
  app.profile = data;
  app.portal = data ? data.role : null;
  if (data) app.portalTab = 'profile';
}
function identityName(){ return app.profile?.name || ''; }

/* ---------------- login modal (real email+password) ---------------- */
function openLoginModal(){
  const body = document.createElement('div');
  body.innerHTML = `
  <div class="modal-back" id="loginModal">
    <div class="modal">
      <h3>🔐 Sign In</h3>
      <div class="field"><label>Email</label><input id="li_email" placeholder="you@email.com" autocomplete="username"></div>
      <div class="field"><label>Password</label><input id="li_pass" type="password" placeholder="Password" autocomplete="current-password"></div>
      <div id="loginErr" style="color:var(--danger); font-size:12.5px; margin-bottom:10px;"></div>
      <div style="display:flex; gap:10px;">
        <button class="btn3d btn-gold" style="flex:1" id="loginGo">Sign In</button>
        <button class="btn3d btn-ghost" id="loginCancel">Cancel</button>
      </div>
      <a class="help-link" id="forgotLink" style="margin-top:12px; display:inline-block;">Forgot your password?</a>
    </div>
  </div>`;
  document.body.appendChild(body.firstElementChild);
  document.getElementById('loginCancel').onclick = ()=> document.getElementById('loginModal').remove();
  document.getElementById('loginGo').onclick = doLogin;
  document.getElementById('li_pass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('forgotLink').onclick = async ()=>{
    const email = document.getElementById('li_email').value.trim();
    if(!email){ document.getElementById('loginErr').textContent = 'Enter your email first, then tap "Forgot password?"'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    document.getElementById('loginErr').style.color = 'var(--ok)';
    document.getElementById('loginErr').textContent = error ? error.message : 'Reset link sent — check your email.';
  };
  document.getElementById('li_email').focus();
}
async function doLogin(){
  const email = document.getElementById('li_email').value.trim();
  const password = document.getElementById('li_pass').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { document.getElementById('loginErr').textContent = error.message; return; }
  document.getElementById('loginModal').remove();
  closeMenu();
  app.page = 'portal';
  render();
}
function showSetPasswordModal(){
  const body = document.createElement('div');
  body.innerHTML = `
  <div class="modal-back" id="setPassModal">
    <div class="modal">
      <h3>🔑 Set Your Password</h3>
      <div style="font-size:12.5px;color:var(--muted); margin-bottom:12px;">Welcome to Fine Villa. Choose a password for future sign-ins.</div>
      <div class="field"><label>New Password</label><input id="sp_pass" type="password" placeholder="At least 8 characters"></div>
      <div class="field"><label>Confirm Password</label><input id="sp_pass2" type="password" placeholder="Repeat password"></div>
      <div id="spErr" style="color:var(--danger); font-size:12.5px; margin-bottom:10px;"></div>
      <button class="btn3d btn-gold" style="width:100%;" id="spGo">Save & Continue</button>
    </div>
  </div>`;
  document.body.appendChild(body.firstElementChild);
  document.getElementById('spGo').onclick = async ()=>{
    const p1 = document.getElementById('sp_pass').value, p2 = document.getElementById('sp_pass2').value;
    if(p1.length < 8){ document.getElementById('spErr').textContent = 'Use at least 8 characters.'; return; }
    if(p1 !== p2){ document.getElementById('spErr').textContent = 'Passwords do not match.'; return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error){ document.getElementById('spErr').textContent = error.message; return; }
    document.getElementById('setPassModal').remove();
    toast('Password set — you\'re in.');
    app.page = 'portal'; render();
  };
}

/* ============================================================
   RENDER: PAGE ROUTER  (mostly unchanged from the original)
   ============================================================ */
function render(){
  document.body.setAttribute('data-theme', app.theme || 'dark');
  document.querySelectorAll('#pillnav .btn3d').forEach(b=>b.classList.toggle('active', b.dataset.page===app.page));
  const main = document.getElementById('mainWrap');
  if (!DB) { main.innerHTML = `<div style="padding:80px 0; text-align:center; color:var(--muted);">Loading…</div>`; return; }
  document.getElementById('stOcc').textContent = DB.houses.filter(h=>h.status==='occ').length;

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
    else if(app.page==='portal') main.innerHTML = app.portal ? pagePortal() : pageSignInPrompt();
  }catch(e){
    console.error('Render error:', e);
    main.innerHTML = `<div class="card" style="margin-top:30px;">
      <h3>⚠️ Something went wrong loading this page</h3>
      <div style="color:var(--muted); font-size:13px; margin-bottom:14px;">${esc(e.message)}</div>
      <button class="btn3d btn-gold" id="reloadBtn">Reload</button>
    </div>`;
    document.getElementById('reloadBtn').onclick = ()=> location.reload();
    return;
  }

  attachPageEvents();
  if(app.page==='home'){ startTyping(); startCountdowns(); }
  else { clearInterval(window.__typeInt); clearInterval(window.__cdInt); }
}
function pageSignInPrompt(){
  return `<div class="card" style="margin-top:30px; text-align:center;">
    <h3>🔐 Please Sign In</h3>
    <p style="color:var(--muted); font-size:13.5px;">Use the menu to sign in to your portal.</p>
    <button class="btn3d btn-gold" id="promptSignIn">Sign In</button>
  </div>`;
}

/* ---------------- HOME ---------------- */
function pageHome(){
  const occ = DB.houses.filter(h=>h.status==='occ').length, total=DB.houses.length;
  const pct = total ? Math.round(occ/total*100) : 0;
  const curAgent = DB.agents.filter(a=>a.active).sort((a,b)=>b.start-a.start)[0];
  const curCaretaker = DB.caretakers.filter(a=>a.active).sort((a,b)=>b.start-a.start)[0];
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
        <p style="color:var(--muted); line-height:1.7; font-size:14px;">Every month, tenants received a torn slip of paper for rent and another for water — easy to lose, hard to reconcile, and impossible for an owner to audit from a distance. Fine Villa's digital ledger keeps every receipt, notice and complaint in one place, visible to exactly the people who need it.</p>
      </div>
    </div>
  </section>`;
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
    <div class="card" style="margin-top:24px;"><h3>🏛️ Our History</h3><p style="color:var(--muted); line-height:1.7; font-size:14px;">${esc(DB.tour.history)}</p></div>
    <div class="card"><h3>⚠️ Challenges We've Faced</h3><p style="color:var(--muted); line-height:1.7; font-size:14px;">${esc(DB.tour.challenge)}</p></div>
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
   PORTAL SHELL
   ============================================================ */
const PORTAL_META = {
  owner:{label:'Owner / Admin', icon:'🗝️'},
  agent:{label:'Agent', icon:'💼'},
  caretaker:{label:'Caretaker', icon:'🧰'},
  tenant:{label:'Tenant', icon:'🏘️'}
};
const PORTAL_TABS = {
  owner:[['profile','👤 Profile'],['generate','🔑 Invite Agent'],['received','📥 Received'],['send','📤 Send'],['notices','📣 Notices'],['report','📊 Report'],['audit','🕵️ Audit Log']],
  agent:[['profile','👤 Profile'],['generate','🔑 Invite Caretaker'],['tour','🗺️ Tour'],['policy','📄 Policies'],['received','📥 Received'],['send','📤 Send'],['notices','📣 Notices'],['report','📊 Report']],
  caretaker:[['profile','👤 Profile'],['generate','🔑 Invite Tenant'],['status','🏘️ House Status'],['received','📥 Received'],['send','📤 Send'],['tenants','🧾 Tenants'],['notices','📣 Notices'],['complaints','⚠️ Complaints'],['report','📊 Report']],
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
function countUnread(role){
  const label = ROLE_LABEL[role];
  return DB.messages.filter(m=>m.to===label).length;
}
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
  if(role==='owner'){
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
          <div style="font-size:11px;color:var(--muted);">Email (sign-in ID, contact support to change): ${esc(o.email||'')}</div>
        </div>
      </div>
      <button class="btn3d btn-gold" id="saveProfile" style="margin-top:12px;">💾 Save Changes</button>
    </div>
    <div class="card"><h3>🏛️ Ownership History</h3>
      <div class="cardgrid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">
        <div class="history-card current">
          <span class="cur-badge">CURRENT</span>
          <div class="hphoto">${isImgUrl(o.photo)? `<img src="${esc(o.photo)}">` : `<span>${o.photo||'🧔🏾'}</span>`}</div>
          <b>${esc(o.name)}</b><span>${fmtDate(o.start).split(',')[0]} — Present</span>
        </div>
        ${(DB.ownerHistory||[]).slice().reverse().map(h=>`
          <div class="history-card">
            <div class="hphoto">${isImgUrl(h.photo)? `<img src="${esc(h.photo)}">` : `<span>${h.photo||'🧔🏾'}</span>`}</div>
            <b>${esc(h.name)}</b><span>${fmtDate(h.start).split(',')[0]} — ${fmtDate(h.end).split(',')[0]}</span>
            ${h.reason? `<span class="reason">${esc(h.reason)}</span>`:''}
          </div>
        `).join('') || '<div style="color:var(--muted); font-size:12.5px;">No previous owners yet.</div>'}
      </div>
    </div>`;
  }
  if(role==='tenant'){
    const t = DB.tenants.find(t=>t.id===app.profile.id);
    if(!t) return '<div class="card">Loading…</div>';
    const bal = t.balance||0, exp=t.rentExpected||0, paid=t.rentPaid||0;
    return `
    <div class="card"><h3>👤 Tenant Profile <span style="font-size:11px;color:var(--muted); font-weight:400;">(editable only by Caretaker)</span></h3>
      <div class="row"><div><label style="display:block;font-size:11px;color:var(--muted);">Name</label><div style="padding:8px 0;">${esc(t.name)}</div></div>
      <div><label style="display:block;font-size:11px;color:var(--muted);">House No.</label><div style="padding:8px 0;">${esc(t.house)}</div></div></div>
      <div class="row"><div><label style="display:block;font-size:11px;color:var(--muted);">Phone</label><div style="padding:8px 0;">${esc(t.phone)}</div></div>
      <div><label style="display:block;font-size:11px;color:var(--muted);">Email</label><div style="padding:8px 0;">${esc(t.email)}</div></div></div>
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
  const rec = list.find(r=>r.id===app.profile.id) || {};
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
    <div style="font-size:11px;color:var(--muted);">Serving since ${fmtDate(rec.start).split(',')[0]}${rec.active===false?' · <span style="color:var(--danger)">Access revoked</span>':''}</div>
  </div>`;
}

/* ---------------- INVITE (was "generate passcode") ---------------- */
function tabGenerate(role){
  const targetRole = { owner:'agent', agent:'caretaker', caretaker:'tenant' }[role];
  const targetLabel = { agent:'Agent', caretaker:'Caretaker', tenant:'Tenant' }[targetRole];
  const list = { agent:DB.agents, caretaker:DB.caretakers, tenant:DB.tenants }[targetRole];
  const extraField = targetRole==='tenant'
    ? `<div class="field"><label>House No. (001–200)</label><input id="g_house" placeholder="e.g. 057"></div>`
    : `<div class="field"><label>ID Number (optional)</label><input id="g_extra" placeholder="e.g. 31245678"></div>`;
  return `
  <div class="card">
    <h3>🔑 Invite a ${targetLabel}</h3>
    <div style="font-size:11.5px;color:var(--muted); margin-bottom:12px;">They'll receive an email invite link to set their own password. No passcodes are shared.</div>
    <div class="row">
      <div class="field"><label>Full Name</label><input id="g_name" placeholder="Full name"></div>
      <div class="field"><label>Email</label><input id="g_email" placeholder="name@email.com"></div>
    </div>
    <div class="row">
      <div class="field"><label>Phone Number</label><input id="g_phone" placeholder="07XX XXX XXX"></div>
      ${extraField}
    </div>
    <div id="genErr" style="color:var(--danger); font-size:12.5px; margin-bottom:8px;"></div>
    <button class="btn3d btn-gold" id="genBtn">📨 Send Invite</button>
  </div>
  <div class="card">
    <h3>📋 ${targetLabel} Records</h3>
    <table><thead><tr><th>Name</th><th>${targetRole==='tenant'?'House':'Email'}</th><th>Phone</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${list.map((r)=>`<tr>
        <td>${esc(r.name)}</td><td>${esc(targetRole==='tenant'? r.house : r.email)}</td><td>${esc(r.phone)}</td>
        <td>${r.active===false?'<span style="color:var(--danger)">Revoked</span>':'<span style="color:var(--ok)">Active</span>'}</td>
        <td style="display:flex; gap:6px;">
            <button class="btn3d btn-sm" data-resetpw="${esc(r.email||'')}">✉ Reset Link</button>
            <button class="btn3d btn-sm ${r.active===false?'btn-gold':'btn-danger'}" data-revoke="${r.id}" data-role="${targetRole}">${r.active===false?'Restore':'Revoke'}</button>
          </td>
      </tr>`).join('') || `<tr><td colspan="5" style="color:var(--muted)">No records yet.</td></tr>`}
    </tbody></table>
  </div>`;
}

/* ---------------- RECEIVED / SEND ---------------- */
function tabReceived(role){
  const label = ROLE_LABEL[role];
  const msgs = DB.messages.filter(m=>m.to===label).slice().reverse();
  return `
  <div class="card">
    <h3>📥 Received</h3>
    ${msgs.map(m=>`
      <div class="msg-item">
        <div class="meta"><span>From ${esc(m.from)}</span><span>${fmtDate(m.ts)}</span></div>
        <div style="font-weight:700; font-size:13.5px; margin-bottom:4px;">${esc(m.subject)}</div>
        <div style="font-size:13px; color:var(--muted);">${esc(m.body)}</div>
        ${m.file?`<a class="attach-box" href="${esc(m.file)}" target="_blank" rel="noopener">📎 View attachment</a>`:''}
      </div>`).join('') || '<div style="color:var(--muted);font-size:13px;">Nothing received yet.</div>'}
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn3d" data-save="csv">⬇ Save CSV</button>
      <button class="btn3d" data-save="excel">⬇ Save Excel</button>
      <button class="btn3d" data-save="pdf">🖨 Save / Print PDF</button>
    </div>
  </div>`;
}
function sendRecipients(role){
  if(role==='owner') return [['agent','Agent']];
  if(role==='agent') return [['owner','Owner / Admin'],['caretaker','Caretaker']];
  if(role==='caretaker') return [['agent','Agent'],['tenant','All Tenants']];
  if(role==='tenant') return [['caretaker','Caretaker']];
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
  if(role==='owner') return [['global','Global Notice Board', true]];
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
  if(role==='owner'){
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

/* ---------------- AUDIT LOG ---------------- */
function tabAudit(){
  return `<div class="card">
    <h3>🕵️ Audit Log</h3>
    <div style="font-size:11.5px;color:var(--muted); margin-bottom:14px;">A permanent record of who invited/revoked whom, and when. This log itself cannot be deleted from the portal — that's intentional for a real audit trail.</div>
    ${DB.auditLog.map(a=>`<div class="audit-row"><b style="color:var(--ink)">${esc(a.actor)}</b> ${esc(a.action)} — ${esc(a.detail)} <span style="float:right;">${fmtDate(a.ts)}</span></div>`).join('') || '<div style="color:var(--muted);font-size:13px;">No activity logged yet.</div>'}
  </div>`;
}

/* ---------------- TOUR / POLICY EDIT ---------------- */
function tabTourEdit(){
  return `
  <div class="card"><h3>🗺️ Edit Tour Content</h3>
    <div class="field"><label>Villa History</label><textarea id="t_history" rows="4">${esc(DB.tour.history)}</textarea></div>
    <div class="field"><label>Challenges Faced</label><textarea id="t_challenge" rows="3">${esc(DB.tour.challenge)}</textarea></div>
    <div class="field"><label>Inspirational Quote</label><input id="t_quote" value="${esc(DB.tour.quote)}"></div>
    <button class="btn3d btn-gold" id="saveTour" style="margin-top:6px;">💾 Publish to Tour Page</button>
  </div>
  <div class="card"><h3>📷 Gallery Images</h3>
    <div style="font-size:11.5px;color:var(--muted); margin-bottom:14px;">Upload a photo for each angle (max 5MB, JPG/PNG).</div>
    <div class="cardgrid" style="grid-template-columns:repeat(3,1fr);">
      ${DB.tour.gallery.map((g)=>`
        <div>
          <div class="imgph ${g.url?'has-img':''}" style="min-height:120px;">
            ${g.url? `<img src="${esc(g.url)}" alt="${esc(g.label)}">` : `📷<br>${esc(g.label)}`}
          </div>
          <div style="font-size:11px;color:var(--muted); margin:8px 0 4px;">${esc(g.label)}</div>
          <input type="file" accept="image/*" data-upload="${g.slot}" style="font-size:11px; padding:6px;">
          <input data-cap="${g.slot}" value="${esc(g.caption)}" placeholder="Caption..." style="margin-top:6px;">
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
    <div class="field"><label>Policy Details</label><textarea id="pol_body" rows="3" placeholder="Describe the policy..."></textarea></div>
    <button class="btn3d btn-gold" id="addPolicy">📨 Publish to Policies Page</button>
  </div>
  <div class="card"><h3>Current Policies</h3>
    ${DB.policies.map(p=>`<div class="msg-item"><b>${esc(p.title)}</b> <span style="font-size:10.5px;color:var(--gold-soft);">${esc(p.cat||'General')}</span><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${esc(p.body)}</div><div class="updated">Updated ${esc(p.updated)}</div></div>`).join('')}
  </div>`;
}

/* ---------------- HOUSE STATUS ---------------- */
function tabHouseStatus(){
  const occ = DB.houses.filter(h=>h.status==='occ').length;
  return `
  <div class="card">
    <h3>🏘️ House Status <span style="font-size:12px;color:var(--muted); font-weight:400;">(${occ} occupied / ${DB.houses.length-occ} vacant of ${DB.houses.length})</span></h3>
    <div style="font-size:12px;color:var(--muted); margin-bottom:10px;">Click a unit to toggle occupied ⇄ vacant. (Occupying a house directly here does not assign a tenant — use "Invite Tenant" for that.)</div>
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

/* ---------------- TENANTS ---------------- */
function tabTenants(){
  return `
  <div class="card">
    <h3>🧾 Tenant Records</h3>
    <table><thead><tr><th>House</th><th>Name</th><th>Phone</th><th>Rent Expected</th><th>Balance</th><th>Last Payment</th><th></th></tr></thead>
    <tbody>
      ${DB.tenants.map((t)=>`<tr>
        <td>${esc(t.house)}</td><td>${esc(t.name)}</td><td>${esc(t.phone)}</td>
        <td>${money(t.rentExpected||0)}</td>
        <td style="color:${(t.balance||0)>0?'var(--danger)':'var(--ok)'}">${money(t.balance||0)}</td>
        <td>${esc(t.lastPayment||'—')}</td>
        <td><button class="btn3d btn-sm" data-edittenant="${t.id}">✎ Edit</button></td>
      </tr>`).join('') || `<tr><td colspan="7" style="color:var(--muted)">No tenants yet — invite one in the "Invite Tenant" tab.</td></tr>`}
    </tbody></table>
  </div>`;
}
function openTenantEditModal(id){
  const t = DB.tenants.find(t=>t.id===id);
  const back = document.createElement('div');
  back.innerHTML = `<div class="modal-back" id="tenantEditModal"><div class="modal">
    <h3>✎ Edit Tenant — House ${esc(t.house)}</h3>
    <div class="row">
      <div class="field"><label>Rent Expected / Month</label><input id="te_expected" value="${t.rentExpected||0}"></div>
      <div class="field"><label>Balance</label><input id="te_balance" value="${t.balance||0}"></div>
    </div>
    <div id="tenantEditErr" style="color:var(--danger); font-size:12.5px; margin-bottom:10px;"></div>
    <button class="btn3d btn-gold" id="teSave" style="width:100%; margin-bottom:16px;">💾 Save Details</button>
    <div style="border-top:1px solid var(--line); padding-top:14px;">
      <h4 style="font-size:12px; color:var(--gold); margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Record a Payment</h4>
      <div class="field"><label>Amount Received</label><input id="te_payment" placeholder="e.g. 18670"></div>
      <button class="btn3d btn-gold" id="teRecordPayment" style="width:100%;">➕ Record Payment</button>
      <div style="font-size:11px;color:var(--muted); margin-top:8px;">Last payment: ${esc(t.lastPayment||'—')}.</div>
    </div>
    <button class="btn3d btn-ghost" id="teCancel" style="width:100%; margin-top:16px;">Close</button>
  </div></div>`;
  document.body.appendChild(back.firstElementChild);
  document.getElementById('teCancel').onclick = ()=> document.getElementById('tenantEditModal').remove();

  document.getElementById('teSave').onclick = async ()=>{
    const expected = parseFloat(document.getElementById('te_expected').value)||0;
    const balance = parseFloat(document.getElementById('te_balance').value)||0;
    const { error } = await sb.from('tenant_accounts').update({ rent_expected: expected, balance }).eq('tenant_id', t.id);
    if(error){ document.getElementById('tenantEditErr').textContent = error.message; return; }
    await sb.from('audit_log').insert({ actor_id: app.profile.id, action: 'updated tenant record for', detail: `${t.name} (House ${t.house})` });
    toast('Saved'); document.getElementById('tenantEditModal').remove(); await refresh();
  };
  document.getElementById('teRecordPayment').onclick = async ()=>{
    const amt = parseFloat(document.getElementById('te_payment').value);
    if(!amt || amt<=0){ document.getElementById('tenantEditErr').textContent = 'Enter a valid payment amount.'; return; }
    const today = new Date().toISOString().slice(0,10);
    const newPaid = (t.rentPaid||0) + amt, newBal = Math.max(0, (t.balance||0) - amt);
    await sb.from('payments').insert({ tenant_id: t.id, amount: amt, recorded_by: app.profile.id });
    await sb.from('tenant_accounts').update({ rent_paid: newPaid, balance: newBal, last_payment: today }).eq('tenant_id', t.id);
    await sb.from('audit_log').insert({ actor_id: app.profile.id, action: 'recorded a payment for', detail: `${t.name} — ${money(amt)}` });
    toast('Payment recorded'); document.getElementById('tenantEditModal').remove(); await refresh();
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
    ${DB.complaints.filter(c=>c.tenant_id===app.profile.id).slice().reverse().map(c=>`
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
  document.querySelectorAll('.portal-nav button[data-tab]').forEach(b=>{ b.onclick = ()=>{ app.portalTab=b.dataset.tab; render(); }; });

  const promptSignIn = document.getElementById('promptSignIn');
  if(promptSignIn) promptSignIn.onclick = openLoginModal;

  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.onclick = async ()=>{ await sb.auth.signOut(); app.portal=null; app.profile=null; app.page='home'; render(); };

  const saveProfile = document.getElementById('saveProfile');
  if(saveProfile) saveProfile.onclick = async ()=>{
    const name = document.getElementById('p_name').value, phone = document.getElementById('p_phone').value;
    await sb.from('profiles').update({ name, phone }).eq('id', app.profile.id);
    toast('Saved'); await refresh();
  };
  const pPhoto = document.getElementById('p_photo');
  if(pPhoto) pPhoto.onchange = (e)=> uploadPersonPhoto(e.target.files[0]);

  const genBtn = document.getElementById('genBtn');
  if(genBtn) genBtn.onclick = async ()=>{
    const targetRole = { owner:'agent', agent:'caretaker', caretaker:'tenant' }[app.portal];
    const name = document.getElementById('g_name').value.trim();
    const email = document.getElementById('g_email').value.trim();
    const phone = document.getElementById('g_phone').value.trim();
    if(!name || !email || !phone){ document.getElementById('genErr').textContent = 'Fill in name, email and phone.'; return; }
    const payload = { role: targetRole, name, email, phone };
    if(targetRole==='tenant') payload.house_no = (document.getElementById('g_house').value.trim()||'').padStart(3,'0');
    else payload.id_number = document.getElementById('g_extra').value.trim();

    const { data, error } = await sb.functions.invoke('invite-user', { body: payload });
    if(error || data?.error){ document.getElementById('genErr').textContent = data?.error || error.message; return; }
    toast('Invite sent to '+email); await refresh();
  };

  document.querySelectorAll('[data-revoke]').forEach(b=>{
    b.onclick = async ()=>{
      const list = { agent:DB.agents, caretaker:DB.caretakers, tenant:DB.tenants }[b.dataset.role];
      const rec = list.find(r=>r.id===b.dataset.revoke);
      if(rec.active===false){
        await sb.from('profiles').update({ active:true, end_date:null }).eq('id', rec.id);
        await sb.from('audit_log').insert({ actor_id: app.profile.id, action:'restored access for', detail: rec.name });
      } else {
        const reason = prompt(`Reason for revoking ${rec.name}'s access? (optional)`) || '';
        await sb.from('profiles').update({ active:false, end_date: new Date().toISOString(), revoke_reason: reason }).eq('id', rec.id);
        await sb.from('audit_log').insert({ actor_id: app.profile.id, action:'revoked access for', detail: rec.name + (reason? ' — '+reason:'') });
      }
      await refresh();
    };
  });
  document.querySelectorAll('[data-resetpw]').forEach(b=>{
    b.onclick = async ()=>{
      const email = b.dataset.resetpw;
      if(!email){ toast('No email on file'); return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      toast(error ? error.message : 'Reset link sent to '+email);
    };
  });

  document.querySelectorAll('[data-save]').forEach(b=>{
    b.onclick = ()=>{
      const label = ROLE_LABEL[app.portal];
      const msgs = DB.messages.filter(m=>m.to===label);
      const type = b.dataset.save;
      if(type==='csv'){ downloadBlob(toCSV([['From','Subject','Message','Date'], ...msgs.map(m=>[m.from,m.subject,m.body,fmtDate(m.ts)])]), 'received.csv', 'text/csv'); }
      else if(type==='excel'){ downloadBlob(toCSV([['From','Subject','Message','Date'], ...msgs.map(m=>[m.from,m.subject,m.body,fmtDate(m.ts)])]), 'received.xls', 'application/vnd.ms-excel'); }
      else { window.print(); }
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
  if(sendBtn) sendBtn.onclick = async ()=>{
    const to_role = document.getElementById('s_to').value;
    const subject = document.getElementById('s_subject').value.trim();
    const body = document.getElementById('s_body').value.trim();
    const file = document.getElementById('fileInput').files[0];
    if(!subject || !body){ toast('Add a subject and message'); return; }
    let file_path = null;
    if(file){
      if(file.size > 10*1024*1024){ toast('File too large — 10MB max'); return; }
      const path = `attachments/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g,'-')}`;
      const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
      if(upErr){ toast('Attachment upload failed: '+upErr.message); return; }
      file_path = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    await sb.from('messages').insert({ from_id: app.profile.id, to_role, subject, body, file_path });
    toast('Sent'); await refresh();
  };

  document.querySelectorAll('[data-postnotice]').forEach(b=>{
    b.onclick = async ()=>{
      const board = b.dataset.postnotice;
      const txt = document.getElementById('np_'+board).value.trim();
      const urgency = document.getElementById('nu_'+board).value;
      if(!txt) return;
      await sb.from('notices').insert({ board, author_id: app.profile.id, text: txt, urgency });
      await refresh();
    };
  });

  const saveTour = document.getElementById('saveTour');
  if(saveTour) saveTour.onclick = async ()=>{
    const history = document.getElementById('t_history').value, challenge = document.getElementById('t_challenge').value, quote = document.getElementById('t_quote').value;
    await sb.from('tour_content').update({ history, challenge, quote, updated_by: app.profile.id, updated_at: new Date().toISOString() }).eq('id',1);
    toast('Tour page updated'); await refresh();
  };
  document.querySelectorAll('[data-upload]').forEach(inp=>{ inp.onchange = (e)=> uploadTourImage(parseInt(inp.dataset.upload), e.target.files[0]); });
  const saveGallery = document.getElementById('saveGallery');
  if(saveGallery) saveGallery.onclick = async ()=>{
    const updates = [...document.querySelectorAll('[data-cap]')].map(inp=> sb.from('tour_gallery').update({ caption: inp.value }).eq('slot', parseInt(inp.dataset.cap)) );
    await Promise.all(updates);
    toast('Captions saved'); await refresh();
  };

  const addPolicy = document.getElementById('addPolicy');
  if(addPolicy) addPolicy.onclick = async ()=>{
    const title = document.getElementById('pol_title').value.trim();
    const category = document.getElementById('pol_cat').value;
    const body = document.getElementById('pol_body').value.trim();
    if(!title || !body){ toast('Add a title and details'); return; }
    await sb.from('policies').insert({ title, category, body, updated_by: app.profile.id });
    await refresh();
  };

  document.querySelectorAll('[data-house]').forEach(el=>{
    el.onclick = async ()=>{
      const h = DB.houses.find(h=>h.no===el.dataset.house);
      const wasOcc = h.status==='occ';
      const newStatus = wasOcc ? 'emp' : 'occ';
      await sb.from('houses').update({ status: newStatus, tenant_id: newStatus==='emp' ? null : undefined }).eq('no', h.no);
      if(newStatus==='emp'){
        await sb.from('messages').insert({ from_id: app.profile.id, to_role:'agent', subject:'Vacancy Alert — House '+h.no, body:`House ${h.no} has just been marked vacant and may need to be re-listed.` });
      }
      await refresh();
    };
  });
  const bulkInspect = document.getElementById('bulkInspect');
  if(bulkInspect) bulkInspect.onclick = async ()=>{
    const from = parseInt(document.getElementById('bulk_from').value)||1;
    const to = parseInt(document.getElementById('bulk_to').value)||from;
    const today = new Date().toISOString().slice(0,10);
    const nos = DB.houses.filter(h=>{ const n=parseInt(h.no); return n>=from && n<=to; }).map(h=>h.no);
    await sb.from('houses').update({ last_inspected: today }).in('no', nos);
    toast(`Marked houses ${String(from).padStart(3,'0')}–${String(to).padStart(3,'0')} inspected`); await refresh();
  };
  const addMaint = document.getElementById('addMaint');
  if(addMaint) addMaint.onclick = async ()=>{
    const house = (document.getElementById('maint_house').value.trim()).padStart(3,'0');
    const note = document.getElementById('maint_note').value.trim();
    if(!house || !note){ toast('Enter a valid house number and note'); return; }
    await sb.from('maintenance_log').insert({ house_no: house, note, logged_by: app.profile.id });
    toast('Logged'); await refresh();
  };
  const reportStatus = document.getElementById('reportStatus');
  if(reportStatus) reportStatus.onclick = async ()=>{
    const occ = DB.houses.filter(h=>h.status==='occ').length;
    await sb.from('messages').insert({ from_id: app.profile.id, to_role:'agent', subject:'Occupancy Report', body:`${occ} of ${DB.houses.length} units occupied as of today.` });
    toast('Report sent to Agent');
  };

  document.querySelectorAll('[data-edittenant]').forEach(b=>{ b.onclick = ()=> openTenantEditModal(b.dataset.edittenant); });

  const sendComplaint = document.getElementById('sendComplaint');
  if(sendComplaint) sendComplaint.onclick = async ()=>{
    const text = document.getElementById('c_text').value.trim();
    if(!text) return;
    await sb.from('complaints').insert({ tenant_id: app.profile.id, house_no: app.profile.house_no, text });
    toast('Complaint sent to Caretaker'); await refresh();
  };
  document.querySelectorAll('[data-progress]').forEach(b=>{ b.onclick = async ()=>{ await sb.from('complaints').update({status:'inprogress', updated_at:new Date().toISOString()}).eq('id', b.dataset.progress); await refresh(); }; });
  document.querySelectorAll('[data-resolve]').forEach(b=>{ b.onclick = async ()=>{ await sb.from('complaints').update({status:'resolved', updated_at:new Date().toISOString()}).eq('id', b.dataset.resolve); await refresh(); }; });
}

/* ---------------- photo uploads ---------------- */
async function uploadTourImage(slot, file){
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('Please choose an image file'); return; }
  if(file.size > 5*1024*1024){ toast('Image is too large — please keep it under 5MB'); return; }
  toast('Uploading photo…');
  const path = `slot-${slot}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g,'-')}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
  if(error){ toast('Upload failed: '+error.message); return; }
  const url = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  await sb.from('tour_gallery').update({ url }).eq('slot', slot);
  toast('Uploaded'); await refresh();
}
async function uploadPersonPhoto(file){
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('Please choose an image file'); return; }
  if(file.size > 5*1024*1024){ toast('Image is too large — please keep it under 5MB'); return; }
  toast('Uploading photo…');
  const path = `people/${app.profile.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g,'-')}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
  if(error){ toast('Upload failed: '+error.message); return; }
  const url = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  await sb.from('profiles').update({ photo_url: url }).eq('id', app.profile.id);
  toast('Uploaded'); await refresh();
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
  document.querySelectorAll('.sidemenu [data-page]').forEach(b=>{ b.onclick = ()=>{ app.page=b.dataset.page; closeMenu(); render(); }; });
  document.querySelectorAll('.sidemenu [data-portal]').forEach(b=>{ b.onclick = ()=>{ closeMenu(); openLoginModal(); }; });
  document.querySelectorAll('#pillnav [data-page]').forEach(b=>{ b.onclick = ()=>{ app.page=b.dataset.page; render(); }; });
  document.getElementById('darkBtn').onclick = ()=>{
    app.theme = app.theme==='light' ? 'dark' : 'light';
    document.getElementById('darkBtn').innerHTML = app.theme==='light' ? '☀️ Light Mode' : '🌙 Dark Mode';
    render();
  };
  document.getElementById('helpBtn').onclick = openHelp;
}
function openHelp(){
  const items = [
    ['☰ Menu','Opens the side panel with all four portals plus quick links to the public pages.'],
    ['🌙 Dark Mode','Switches the whole system between dark and light themes.'],
    ['🏠 Home','Live occupancy, the ownership chain, and the flip cards.'],
    ['🗺️ Tour','Property gallery, history, challenges and the Fine Villa motto. Edited by the Agent.'],
    ['📄 Policies','House rules grouped by category. Published by the Agent.'],
    ['📣 Global Notice Board','Estate-wide announcements posted by the Owner/Admin, auto-expiring after 30 days.'],
    ['🗝️ Portals','Sign in with the email + password set up when you were invited.'],
    ['📥 Received / 📤 Send','Every portal can message the portal(s) directly above or below it.'],
    ['⚠️ Complaints','Tenants raise issues, tracked Open → In Progress → Resolved by the Caretaker.'],
    ['📊 Report','Live charts summarising occupancy, rent collection, messages and people on record.']
  ];
  const back = document.createElement('div');
  back.innerHTML = `<div class="modal-back" id="helpModal"><div class="modal">
    <h3>⚙️ How Fine Villa Works</h3>
    ${items.map(([t,d])=>`<div class="help-item"><b>${t}</b><span>${d}</span></div>`).join('')}
    <button class="btn3d btn-gold" id="closeHelp" style="width:100%; margin-top:14px;">Got it</button>
  </div></div>`;
  document.body.appendChild(back.firstElementChild);
  document.getElementById('closeHelp').onclick = ()=> document.getElementById('helpModal').remove();
}

/* ---------------- typing animation ---------------- */
function startTyping(){
  const el = document.getElementById('typingLine');
  if(!el) return;
  const full = "Welcome to Fine Villa Apartments";
  let i=0; el.textContent='';
  clearInterval(window.__typeInt);
  window.__typeInt = setInterval(()=>{
    el.textContent = full.slice(0,i+1); i++;
    if(i>full.length){ clearInterval(window.__typeInt); }
  }, 65);
}

boot();