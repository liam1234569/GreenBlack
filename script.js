// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAZEMNBokUfK42NHX6otedfSdVA43zK8PI",
  authDomain: "terminal-db-45473.firebaseapp.com",
  databaseURL: "https://terminal-db-45473-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "terminal-db-45473",
  storageBucket: "terminal-db-45473.firebasestorage.app",
  messagingSenderId: "378074867003",
  appId: "1:378074867003:web:e1c730184fe2a3ca1e431e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- VARIABLEN ---
let users = [];
let links = [];
let folders = [];
let folderRequests = [];
let currentUser = null;
let myRequestId = localStorage.getItem('pendingRequestId') || null;
const MAX_REQUESTS = 5;

// --- CLOUD SYNC ---
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    users = data.users || [{ name: "admin", pass: "1234", role: "admin" }];
    links = data.links || [];
    folders = data.folders || ["Allgemein"];
    folderRequests = data.folderRequests || [];

    if (currentUser) {
        updateFolderDropdown();
        renderLinks();
        if (currentUser.role === 'admin') {
            renderUsers();
            renderRequests();
            db.ref('accountRequests').once('value', (s) => renderAccountApps(s.val()));
        }
    }
});

function syncToCloud() {
    db.ref('/').update({ users, links, folders, folderRequests });
}

// --- AUTH ---
function login() {
    const uIn = document.getElementById('username').value;
    const pIn = document.getElementById('password').value;
    const user = users.find(u => u.name === uIn && u.pass === pIn);
    if (user) {
        currentUser = user;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('welcome-msg').innerText = `> USER: ${currentUser.name}`;
        if (currentUser.role === 'admin') document.getElementById('admin-section').style.display = 'block';
        updateFolderDropdown();
    } else { showModal("LOGIN FEHLGESCHLAGEN"); }
}

function logout() { location.reload(); }

// --- BEWERBUNGEN ---
function openRequestForm() {
    db.ref('accountRequests').once('value', (snap) => {
        const reqs = snap.val() || {};
        const count = Object.values(reqs).filter(r => r.status === 'pending').length;
        document.getElementById('login-section').style.display = 'none';
        if (count >= MAX_REQUESTS) document.getElementById('too-many-requests').style.display = 'block';
        else document.getElementById('request-section').style.display = 'block';
    });
}

function submitAccountRequest() {
    const name = document.getElementById('ans-name').value;
    const reason = document.getElementById('ans-reason').value;
    if (name && reason) {
        const newRef = db.ref('accountRequests').push();
        myRequestId = newRef.key;
        localStorage.setItem('pendingRequestId', myRequestId);
        newRef.set({ name, reason, status: 'pending' });
        showStatusScreen();
    }
}

function showStatusScreen() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('request-section').style.display = 'none';
    document.getElementById('status-section').style.display = 'block';
    db.ref('accountRequests/' + myRequestId).on('value', (s) => {
        const d = s.val();
        if (!d) return;
        const m = document.getElementById('status-message');
        if (d.status === 'pending') m.innerHTML = "STATUS: WARTEND...";
        else if (d.status === 'rejected') m.innerHTML = "STATUS: ABGELEHNT";
        else if (d.status === 'accepted') m.innerHTML = `GEWÄHRT!<br>U: ${d.generatedUser}<br>P: ${d.generatedPass}`;
    });
}

// --- ADMIN: USER & RECHTE ---
function createUser() {
    const n = document.getElementById('new-user').value;
    const p = document.getElementById('new-pass').value;
    if (n && p) {
        users.push({ name: n, pass: p, role: 'user' });
        syncToCloud();
        renderUsers();
    }
}

function renderUsers() {
    const list = document.getElementById('user-list');
    list.innerHTML = users.map(u => `
        <div style="border:1px solid #222; margin-bottom:5px; padding:5px;">
            <span onclick="toggleRoleMenu('${u.name}')" style="cursor:pointer;">${u.name} [${u.role}]</span>
            <div id="role-menu-${u.name}" style="display:none; gap:5px; margin-top:5px;">
                <button onclick="changeRole('${u.name}', 'user')">User</button>
                <button onclick="changeRole('${u.name}', 'moderator')">Mod</button>
                <button onclick="changeRole('${u.name}', 'admin')">Admin</button>
                <button onclick="deleteUser('${u.name}')" style="color:red;">KICK</button>
            </div>
        </div>`).join('');
}

function toggleRoleMenu(n) {
    const m = document.getElementById(`role-menu-${n}`);
    if(m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

function changeRole(n, r) {
    const i = users.findIndex(u => u.name === n);
    if(i !== -1 && n !== 'admin') { users[i].role = r; syncToCloud(); renderUsers(); }
}

function deleteUser(n) {
    if(n==='admin') return;
    users = users.filter(u => u.name !== n);
    syncToCloud();
    renderUsers();
}

// --- ADMIN: BEWERBUNGEN BEARBEITEN ---
function renderAccountApps(reqs) {
    const list = document.getElementById('account-request-list');
    if(!list || !reqs) return;
    list.innerHTML = Object.keys(reqs).map(id => {
        const r = reqs[id];
        if(r.status !== 'pending') return '';
        return `<div style="border:1px solid blue; padding:5px; margin-bottom:5px;">
            ${r.name}: ${r.reason}<br>
            <input id="u-${id}" placeholder="User" style="width:40%"> <input id="p-${id}" placeholder="Pass" style="width:40%">
            <button onclick="processApp('${id}', 'accepted')">OK</button>
            <button onclick="processApp('${id}', 'rejected')">X</button>
        </div>`;
    }).join('');
}

function processApp(id, stat) {
    if(stat === 'accepted') {
        const u = document.getElementById(`u-${id}`).value;
        const p = document.getElementById(`p-${id}`).value;
        users.push({ name: u, pass: p, role: 'user' });
        syncToCloud();
        db.ref('accountRequests/'+id).update({ status: 'accepted', generatedUser: u, generatedPass: p });
    } else { db.ref('accountRequests/'+id).update({ status: 'rejected' }); }
}

// --- LINKS & ORDNER ---
function addLink() {
    const n = document.getElementById('link-name').value;
    const u = document.getElementById('link-url').value;
    const f = document.getElementById('current-folder').value;
    if(n && u && f) {
        links.push({ name: n, url: u.startsWith('http')?u:'https://'+u, author: currentUser.name, folder: f });
        syncToCloud();
    }
}

function renderLinks() {
    const f = document.getElementById('current-folder').value;
    const list = document.getElementById('link-list');
    document.getElementById('link-form').style.display = f ? 'block' : 'none';
    if(!f) { list.innerHTML = "Wähle Ordner."; return; }
    const filtered = links.filter(l => l.folder === f);
    list.innerHTML = filtered.map(l => `<li><a href="${l.url}" target="_blank">${l.name}</a> [${l.author}]</li>`).join('');
}

function updateFolderDropdown() {
    const s = document.getElementById('current-folder');
    const v = s.value;
    s.innerHTML = '<option value="">-- Wählen --</option>' + folders.map(f => `<option value="${f}" ${f===v?'selected':''}>${f}</option>`).join('');
}

function sendFolderRequest() {
    const n = document.getElementById('req-folder-name').value;
    if(n) { folderRequests.push({ name: n, user: currentUser.name }); syncToCloud(); }
}

function renderRequests() {
    const list = document.getElementById('request-list');
    list.innerHTML = folderRequests.map((r, i) => `<div>${r.name} <button onclick="approveFolder(${i})">OK</button></div>`).join('');
}

function approveFolder(i) {
    const r = folderRequests[i];
    if(!folders.includes(r.name)) folders.push(r.name);
    folderRequests.splice(i, 1);
    syncToCloud();
}

function deleteFolder() {
    const f = document.getElementById('current-folder').value;
    if(f && f !== "Allgemein") {
        folders = folders.filter(fol => fol !== f);
        links = links.filter(l => l.folder !== f);
        syncToCloud();
    }
}

function closeTooManyRequests() {
    document.getElementById('too-many-requests').style.display = 'none';
    document.getElementById('request-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
}

function showModal(t) {
    document.getElementById('modal-text').innerText = t;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-buttons').innerHTML = '<button onclick="document.getElementById(\'modal-overlay\').style.display=\'none\'">OK</button>';
}

window.onload = () => { if(myRequestId) showStatusScreen(); };
