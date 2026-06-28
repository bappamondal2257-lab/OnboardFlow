/* ============================================================
   OnboardFlow — Employee Onboarding Workflow App
   Vanilla JS SPA with a swappable storage layer (localStorage).
   Replace loadDB/saveDB + uploadDoc with API calls for production.
   ============================================================ */

/* ---------- Utilities ---------- */
const STORAGE_KEY = "onboardflow_db_v1";
const nowISO = () => new Date().toISOString();
function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
function addDays(baseISO, days) {
  const d = new Date(baseISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function esc(s) {
  return (s == null ? "" : String(s)).replace(/[&<>\"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

/* ---------- Role templates (add a role = add an object) ---------- */
const ROLE_TEMPLATES = {
  "Software Engineer": {
    tasks: [
      { title: "Sign offer letter & NDA", category: "Paperwork" },
      { title: "Submit tax & banking details", category: "Paperwork" },
      { title: "Set up company laptop", category: "IT Setup" },
      { title: "Configure email, Slack & calendar", category: "IT Setup" },
      { title: "Clone the main code repository", category: "IT Setup" },
      { title: "Complete security & compliance training", category: "Training" },
      { title: "Read the engineering handbook", category: "Training" },
      { title: "Meet your onboarding buddy", category: "Team" },
      { title: "Ship your first small pull request", category: "Team" }
    ],
    documents: ["Signed NDA", "Tax Form (W-4)", "Direct Deposit Form", "Government ID"],
    trainings: [
      { title: "Security & Compliance 101", offsetDays: 1, time: "10:00" },
      { title: "Codebase Walkthrough", offsetDays: 2, time: "14:00" },
      { title: "CI/CD & Deployment", offsetDays: 4, time: "11:00" }
    ]
  },
  "Sales Representative": {
    tasks: [
      { title: "Sign offer letter & NDA", category: "Paperwork" },
      { title: "Submit tax & banking details", category: "Paperwork" },
      { title: "Set up CRM account", category: "IT Setup" },
      { title: "Configure email & dialer", category: "IT Setup" },
      { title: "Complete product knowledge training", category: "Training" },
      { title: "Shadow a senior rep call", category: "Training" },
      { title: "Review the sales playbook", category: "Training" },
      { title: "Meet your sales pod", category: "Team" }
    ],
    documents: ["Signed NDA", "Tax Form (W-4)", "Direct Deposit Form", "Government ID"],
    trainings: [
      { title: "Product Knowledge Bootcamp", offsetDays: 1, time: "09:30" },
      { title: "CRM & Pipeline Training", offsetDays: 2, time: "13:00" },
      { title: "Objection Handling Workshop", offsetDays: 3, time: "15:00" }
    ]
  },
  "Product Designer": {
    tasks: [
      { title: "Sign offer letter & NDA", category: "Paperwork" },
      { title: "Submit tax & banking details", category: "Paperwork" },
      { title: "Set up laptop & design tools", category: "IT Setup" },
      { title: "Access Figma & the design system", category: "IT Setup" },
      { title: "Review brand & design guidelines", category: "Training" },
      { title: "Complete accessibility training", category: "Training" },
      { title: "Meet your design buddy", category: "Team" },
      { title: "Present a portfolio walkthrough", category: "Team" }
    ],
    documents: ["Signed NDA", "Tax Form (W-4)", "Direct Deposit Form", "Government ID"],
    trainings: [
      { title: "Design System Deep Dive", offsetDays: 1, time: "11:00" },
      { title: "Research & Accessibility", offsetDays: 3, time: "14:00" }
    ]
  },
  "General": {
    tasks: [
      { title: "Sign offer letter & NDA", category: "Paperwork" },
      { title: "Submit tax & banking details", category: "Paperwork" },
      { title: "Set up workstation & accounts", category: "IT Setup" },
      { title: "Complete security & compliance training", category: "Training" },
      { title: "Read the company handbook", category: "Training" },
      { title: "Meet your manager & team", category: "Team" }
    ],
    documents: ["Signed NDA", "Tax Form (W-4)", "Direct Deposit Form", "Government ID"],
    trainings: [
      { title: "Company Orientation", offsetDays: 1, time: "10:00" },
      { title: "Tools & Systems Overview", offsetDays: 2, time: "14:00" }
    ]
  }
};

/* ---------- Domain logic ---------- */
function createHire(db, { name, email, jobRole, managerId, startDate }) {
  const template = ROLE_TEMPLATES[jobRole] || ROLE_TEMPLATES["General"];
  const start = startDate || nowISO();
  const hire = { id: uid("usr"), name, email, role: "newhire", jobRole, managerId, startDate: start };
  db.users.push(hire);
  template.tasks.forEach((t, i) => {
    db.tasks.push({ id: uid("tsk"), userId: hire.id, title: t.title, category: t.category, status: "todo", dueDate: addDays(start, 7), order: i });
  });
  template.documents.forEach(name => {
    db.documents.push({ id: uid("doc"), userId: hire.id, name, fileName: null, dataUrl: null, status: "missing", uploadedAt: null });
  });
  template.trainings.forEach(tr => {
    db.trainings.push({ id: uid("trn"), userId: hire.id, title: tr.title, date: addDays(start, tr.offsetDays), time: tr.time, status: "scheduled" });
  });
  return hire;
}

function seed() {
  const db = { users: [], tasks: [], documents: [], trainings: [], notifications: [], session: { currentUserId: null } };
  const manager = { id: uid("usr"), name: "Maya Manager", email: "maya@company.com", role: "manager", jobRole: "Engineering Manager", managerId: null, startDate: nowISO() };
  db.users.push(manager);
  createHire(db, { name: "Sam Newhire", email: "sam@company.com", jobRole: "Software Engineer", managerId: manager.id, startDate: nowISO() });
  return db;
}

/* ---------- Storage layer (the single production seam) ---------- */
function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("DB parse failed, reseeding", e); }
  const fresh = seed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
function saveDB() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }
  catch (e) { alert("Browser storage limit reached. In production, files live in object storage, not the browser."); }
}

let DB = loadDB();
let selectedHireId = null;

/* ---------- Selectors ---------- */
const byId = id => DB.users.find(u => u.id === id);
const hires = () => DB.users.filter(u => u.role === "newhire");
const tasksFor = userId => DB.tasks.filter(t => t.userId === userId).sort((a, b) => a.order - b.order);
const docsFor = userId => DB.documents.filter(d => d.userId === userId);
const trainingsFor = userId => DB.trainings.filter(t => t.userId === userId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
const notifsFor = managerId => DB.notifications.filter(n => n.managerId === managerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
function progressFor(userId) {
  const ts = tasksFor(userId);
  if (!ts.length) return 0;
  return Math.round((ts.filter(t => t.status === "approved").length / ts.length) * 100);
}
function notify(managerId, message, type, refId) {
  if (!managerId) return;
  DB.notifications.push({ id: uid("ntf"), managerId, message, type, refId: refId || null, read: false, createdAt: nowISO() });
}

/* ---------- Actions ---------- */
function login(userId) { DB.session.currentUserId = userId; selectedHireId = null; saveDB(); render(); }
function logout() { DB.session.currentUserId = null; selectedHireId = null; saveDB(); render(); }

function completeTask(id) {
  const t = DB.tasks.find(x => x.id === id); if (!t) return;
  t.status = "submitted";
  const h = byId(t.userId);
  notify(h.managerId, h.name + ' completed task: "' + t.title + '"', "task", t.id);
  saveDB(); render();
}
function resubmitTask(id) {
  const t = DB.tasks.find(x => x.id === id); if (!t) return;
  t.status = "submitted";
  const h = byId(t.userId);
  notify(h.managerId, h.name + ' resubmitted task: "' + t.title + '"', "task", t.id);
  saveDB(); render();
}
function approveTask(id) { const t = DB.tasks.find(x => x.id === id); if (t) { t.status = "approved"; saveDB(); render(); } }
function rejectTask(id) { const t = DB.tasks.find(x => x.id === id); if (t) { t.status = "rejected"; saveDB(); render(); } }

function uploadDoc(docId, file) {
  const d = DB.documents.find(x => x.id === docId); if (!d) return;
  const reader = new FileReader();
  reader.onload = e => {
    d.dataUrl = e.target.result; d.fileName = file.name; d.status = "pending"; d.uploadedAt = nowISO();
    const h = byId(d.userId);
    notify(h.managerId, h.name + ' uploaded document: "' + d.name + '"', "document", d.id);
    saveDB(); render();
  };
  reader.readAsDataURL(file);
}
function approveDoc(id) { const d = DB.documents.find(x => x.id === id); if (d) { d.status = "approved"; saveDB(); render(); } }
function rejectDoc(id) { const d = DB.documents.find(x => x.id === id); if (d) { d.status = "rejected"; saveDB(); render(); } }
function viewDoc(id) { const d = DB.documents.find(x => x.id === id); if (d && d.dataUrl) window.open(d.dataUrl, "_blank"); }

function markRead(id) { const n = DB.notifications.find(x => x.id === id); if (n) { n.read = true; saveDB(); render(); } }
function markAllRead(mid) { notifsFor(mid).forEach(n => (n.read = true)); saveDB(); render(); }
function viewHire(id) { selectedHireId = id; render(); }

/* ---------- Render helpers ---------- */
function statusBadge(status) {
  const map = {
    todo: ["To do", "b-todo"], submitted: ["Awaiting approval", "b-pending"],
    approved: ["Approved", "b-ok"], rejected: ["Needs rework", "b-bad"],
    pending: ["Under review", "b-pending"], missing: ["Not uploaded", "b-todo"]
  };
  const [label, cls] = map[status] || [status, "b-todo"];
  return '<span class="badge ' + cls + '">' + label + "</span>";
}
function stat(icon, val, label) {
  return '<div class="stat"><span class="stat-icon">' + icon + '</span><span class="stat-val">' + val + '</span><span class="stat-label">' + label + "</span></div>";
}

/* ---------- Login screen ---------- */
function loginCard(u) {
  return '<button class="user-card" data-action="login" data-id="' + u.id + '">' +
    '<span class="avatar">' + esc(u.name.slice(0, 1)) + '</span>' +
    '<span class="uc-info"><strong>' + esc(u.name) + '</strong><small>' + esc(u.jobRole) + '</small></span></button>';
}
function renderLogin() {
  const managers = DB.users.filter(u => u.role === "manager");
  const nh = hires();
  return '<div class="login">' +
    '<div class="login-hero"><div class="logo">⚡ OnboardFlow</div>' +
    '<p class="tagline">Employee onboarding, automated end to end.</p></div>' +
    '<div class="login-cols">' +
    '<div class="login-col"><h3>👔 Managers</h3>' + managers.map(loginCard).join("") + '</div>' +
    '<div class="login-col"><h3>🙋 New Hires</h3>' + (nh.length ? nh.map(loginCard).join("") : '<p class="muted">No new hires yet.</p>') + '</div>' +
    '</div>' +
    '<br><button class="btn ghost small" data-action="reset-demo">Reset demo data</button></div>';
}

/* ---------- Shell ---------- */
function renderShell(user, content) {
  const roleLabel = user.role === "manager" ? "Manager" : "New Hire";
  return '<div class="topbar"><div class="logo small">⚡ OnboardFlow</div>' +
    '<div class="topbar-right">' +
    '<span class="role-pill ' + user.role + '">' + roleLabel + '</span>' +
    '<span class="me"><span class="avatar sm">' + esc(user.name.slice(0, 1)) + '</span>' + esc(user.name) + '</span>' +
    '<button class="btn ghost small" data-action="logout">Log out</button>' +
    '</div></div><main class="content">' + content + '</main>';
}

/* ---------- New hire view ---------- */
function taskRowHire(t) {
  let action = "";
  if (t.status === "todo") action = '<button class="btn small" data-action="complete-task" data-id="' + t.id + '">Mark complete</button>';
  else if (t.status === "rejected") action = '<button class="btn small" data-action="resubmit-task" data-id="' + t.id + '">Resubmit</button>';
  return '<div class="row"><div class="row-main"><span class="dot ' + t.status + '"></span>' + esc(t.title) + '</div>' +
    '<div class="row-side">' + statusBadge(t.status) + action + '</div></div>';
}
function docRowHire(d) {
  const uploaded = d.status !== "missing";
  const input = '<label class="btn small ghost upload-btn">' + (uploaded ? "Replace" : "Upload") +
    '<input type="file" data-upload="' + d.id + '" hidden></label>';
  const view = uploaded ? '<button class="btn small ghost" data-action="view-doc" data-id="' + d.id + '">View</button>' : "";
  return '<div class="row"><div class="row-main">' + esc(d.name) +
    (d.fileName ? '<small class="muted"> · ' + esc(d.fileName) + '</small>' : "") + '</div>' +
    '<div class="row-side">' + statusBadge(d.status) + view + input + '</div></div>';
}
function trainRow(t) {
  return '<div class="row"><div class="row-main"><strong>' + esc(t.title) + '</strong>' +
    '<small class="muted"> · ' + fmtDate(t.date) + ' at ' + esc(t.time) + '</small></div>' +
    '<div class="row-side"><span class="badge b-todo">' + esc(t.status) + '</span></div></div>';
}
function renderNewHire(u) {
  const prog = progressFor(u.id);
  const ts = tasksFor(u.id);
  const cats = [...new Set(ts.map(t => t.category))];
  const docs = docsFor(u.id);
  const trs = trainingsFor(u.id);
  const approved = ts.filter(t => t.status === "approved").length;
  return '<div class="page-head"><div><h1>Welcome, ' + esc(u.name.split(" ")[0]) + ' 👋</h1>' +
    '<p class="muted">' + esc(u.jobRole) + ' · Start date ' + fmtDate(u.startDate) + '</p></div></div>' +
    '<section class="card"><div class="card-head"><h2>Your progress</h2><span class="big-pct">' + prog + '%</span></div>' +
    '<div class="progress"><div class="progress-bar" style="width:' + prog + '%"></div></div>' +
    '<p class="muted small">' + approved + ' of ' + ts.length + ' tasks approved</p></section>' +
    '<section class="card"><div class="card-head"><h2>✅ Your checklist</h2></div>' +
    cats.map(c => '<div class="cat"><h4>' + esc(c) + '</h4>' +
      ts.filter(t => t.category === c).map(taskRowHire).join("") + '</div>').join("") + '</section>' +
    '<section class="card"><div class="card-head"><h2>📄 Documents</h2></div>' +
    '<div class="doc-list">' + docs.map(docRowHire).join("") + '</div></section>' +
    '<section class="card"><div class="card-head"><h2>📅 Training schedule</h2></div>' +
    '<div class="train-list">' + (trs.length ? trs.map(trainRow).join("") : '<p class="muted">No sessions scheduled.</p>') + '</div></section>';
}

/* ---------- Manager view ---------- */
function notiRow(n) {
  return '<div class="row ' + (n.read ? "" : "unread") + '"><div class="row-main">' +
    '<span class="ntype ' + n.type + '"></span>' + esc(n.message) +
    '<small class="muted"> · ' + timeAgo(n.createdAt) + '</small></div>' +
    '<div class="row-side">' + (n.read ? "" : '<button class="btn tiny ghost" data-action="mark-read" data-id="' + n.id + '">Mark read</button>') + '</div></div>';
}
function approvalRow(t) {
  const h = byId(t.userId);
  return '<div class="row"><div class="row-main"><strong>' + esc(h.name) + '</strong> — ' + esc(t.title) +
    ' <small class="muted">(' + esc(t.category) + ')</small></div><div class="row-side">' +
    '<button class="btn small" data-action="approve-task" data-id="' + t.id + '">Approve</button>' +
    '<button class="btn small ghost danger" data-action="reject-task" data-id="' + t.id + '">Reject</button></div></div>';
}
function docReviewRow(d) {
  const h = byId(d.userId);
  return '<div class="row"><div class="row-main"><strong>' + esc(h.name) + '</strong> — ' + esc(d.name) +
    ' <small class="muted">' + (d.fileName ? esc(d.fileName) : "") + '</small></div><div class="row-side">' +
    '<button class="btn small ghost" data-action="view-doc" data-id="' + d.id + '">View</button>' +
    '<button class="btn small" data-action="approve-doc" data-id="' + d.id + '">Approve</button>' +
    '<button class="btn small ghost danger" data-action="reject-doc" data-id="' + d.id + '">Reject</button></div></div>';
}
function hireRow(h) {
  const p = progressFor(h.id);
  return '<button class="row clickable" data-action="view-hire" data-id="' + h.id + '">' +
    '<div class="row-main"><span class="avatar sm">' + esc(h.name.slice(0, 1)) + '</span><strong>' + esc(h.name) +
    '</strong><small class="muted"> · ' + esc(h.jobRole) + '</small></div>' +
    '<div class="row-side mini-prog"><div class="progress slim"><div class="progress-bar" style="width:' + p + '%"></div></div>' +
    '<span class="muted small">' + p + '%</span></div></button>';
}
function renderManager(m) {
  if (selectedHireId) return renderHireDetail(m, selectedHireId);
  const myHires = hires().filter(h => h.managerId === m.id);
  const ids = myHires.map(h => h.id);
  const pendingTasks = DB.tasks.filter(t => t.status === "submitted" && ids.includes(t.userId));
  const pendingDocs = DB.documents.filter(d => d.status === "pending" && ids.includes(d.userId));
  const notifs = notifsFor(m.id);
  const unread = notifs.filter(n => !n.read).length;
  const avg = myHires.length ? Math.round(myHires.reduce((s, h) => s + progressFor(h.id), 0) / myHires.length) : 0;
  return '<div class="page-head"><h1>Manager dashboard</h1><p class="muted">Welcome back, ' + esc(m.name.split(" ")[0]) + '.</p></div>' +
    '<section class="stats">' +
    stat("👥", myHires.length, "New hires") +
    stat("⏳", pendingTasks.length, "Tasks to approve") +
    stat("📄", pendingDocs.length, "Docs to review") +
    stat("📈", avg + "%", "Avg. completion") + '</section>' +
    '<div class="grid-2">' +
    '<section class="card"><div class="card-head"><h2>🔔 Notifications ' +
    (unread ? '<span class="badge b-bad">' + unread + '</span>' : "") + '</h2>' +
    (notifs.length ? '<button class="btn small ghost" data-action="mark-all-read" data-id="' + m.id + '">Mark all read</button>' : "") + '</div>' +
    '<div class="noti-list">' + (notifs.length ? notifs.slice(0, 12).map(notiRow).join("") : '<p class="muted">No notifications.</p>') + '</div></section>' +
    '<section class="card"><div class="card-head"><h2>➕ Add new hire</h2></div>' +
    '<form id="add-hire-form" class="form">' +
    '<input name="name" placeholder="Full name" required>' +
    '<input name="email" type="email" placeholder="Email" required>' +
    '<select name="jobRole">' + Object.keys(ROLE_TEMPLATES).map(r => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join("") + '</select>' +
    '<input name="startDate" type="date">' +
    '<button class="btn" type="submit">Create & assign checklist</button></form></section></div>' +
    '<section class="card"><div class="card-head"><h2>⏳ Approval queue</h2></div>' +
    (pendingTasks.length ? pendingTasks.map(approvalRow).join("") : '<p class="muted">Nothing waiting for approval. 🎉</p>') + '</section>' +
    '<section class="card"><div class="card-head"><h2>📄 Document review</h2></div>' +
    (pendingDocs.length ? pendingDocs.map(docReviewRow).join("") : '<p class="muted">No documents to review.</p>') + '</section>' +
    '<section class="card"><div class="card-head"><h2>👥 New hires</h2></div>' +
    (myHires.length ? myHires.map(hireRow).join("") : '<p class="muted">No new hires yet. Add one above.</p>') + '</section>';
}
function renderHireDetail(m, id) {
  const h = byId(id);
  if (!h) { selectedHireId = null; return renderManager(m); }
  const ts = tasksFor(id), docs = docsFor(id), trs = trainingsFor(id), p = progressFor(id);
  const taskRows = ts.map(t => '<div class="row"><div class="row-main">' + esc(t.title) +
    ' <small class="muted">(' + esc(t.category) + ')</small></div><div class="row-side">' + statusBadge(t.status) +
    (t.status === "submitted" ? '<button class="btn tiny" data-action="approve-task" data-id="' + t.id + '">Approve</button><button class="btn tiny ghost danger" data-action="reject-task" data-id="' + t.id + '">Reject</button>' : "") +
    '</div></div>').join("");
  const docRows = docs.map(d => '<div class="row"><div class="row-main">' + esc(d.name) +
    ' <small class="muted">' + (d.fileName ? esc(d.fileName) : "") + '</small></div><div class="row-side">' + statusBadge(d.status) +
    (d.status !== "missing" ? '<button class="btn tiny ghost" data-action="view-doc" data-id="' + d.id + '">View</button>' : "") +
    (d.status === "pending" ? '<button class="btn tiny" data-action="approve-doc" data-id="' + d.id + '">Approve</button><button class="btn tiny ghost danger" data-action="reject-doc" data-id="' + d.id + '">Reject</button>' : "") +
    '</div></div>').join("");
  return '<button class="btn ghost small" data-action="back">← Back to dashboard</button>' +
    '<div class="page-head"><div><h1>' + esc(h.name) + '</h1><p class="muted">' + esc(h.jobRole) +
    ' · Start ' + fmtDate(h.startDate) + ' · ' + esc(h.email) + '</p></div></div>' +
    '<section class="card"><div class="card-head"><h2>Progress</h2><span class="big-pct">' + p + '%</span></div>' +
    '<div class="progress"><div class="progress-bar" style="width:' + p + '%"></div></div></section>' +
    '<section class="card"><div class="card-head"><h2>Tasks</h2></div>' + taskRows + '</section>' +
    '<section class="card"><div class="card-head"><h2>Documents</h2></div>' + docRows + '</section>' +
    '<section class="card"><div class="card-head"><h2>Training</h2></div>' + trs.map(trainRow).join("") + '</section>';
}

/* ---------- Root render ---------- */
const app = document.getElementById("app");
function render() {
  const user = byId(DB.session.currentUserId);
  if (!user) { app.innerHTML = renderLogin(); return; }
  app.innerHTML = user.role === "manager"
    ? renderShell(user, renderManager(user))
    : renderShell(user, renderNewHire(user));
}

/* ---------- Event delegation ---------- */
app.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action, id = el.dataset.id;
  const actions = {
    "login": () => login(id),
    "logout": () => logout(),
    "complete-task": () => completeTask(id),
    "resubmit-task": () => resubmitTask(id),
    "approve-task": () => approveTask(id),
    "reject-task": () => rejectTask(id),
    "approve-doc": () => approveDoc(id),
    "reject-doc": () => rejectDoc(id),
    "view-doc": () => viewDoc(id),
    "mark-read": () => markRead(id),
    "mark-all-read": () => markAllRead(id),
    "view-hire": () => viewHire(id),
    "back": () => { selectedHireId = null; render(); },
    "reset-demo": () => { if (confirm("Reset all demo data?")) { localStorage.removeItem(STORAGE_KEY); DB = loadDB(); selectedHireId = null; render(); } }
  };
  if (actions[a]) actions[a]();
});
app.addEventListener("change", e => {
  const el = e.target.closest("[data-upload]");
  if (el && el.files && el.files[0]) { uploadDoc(el.dataset.upload, el.files[0]); el.value = ""; }
});
app.addEventListener("submit", e => {
  const form = e.target.closest("#add-hire-form");
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const name = (fd.get("name") || "").toString().trim();
  const email = (fd.get("email") || "").toString().trim();
  const jobRole = (fd.get("jobRole") || "General").toString();
  const startRaw = (fd.get("startDate") || "").toString();
  if (!name || !email) return;
  const start = startRaw ? new Date(startRaw).toISOString() : nowISO();
  createHire(DB, { name, email, jobRole, managerId: DB.session.currentUserId, startDate: start });
  form.reset();
  saveDB(); render();
});

/* ---------- Boot ---------- */
render();
