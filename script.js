// --- 1. FIREBASE INITIALISIERUNG ---
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

// --- 2. GLOBALE VARIABLEN ---
let users = [];
let links = [];
let folders = [];
let folderRequests = [];
let currentUser = null;
let reviewIndex = 0;
let myRequestId = localStorage.getItem('pendingRequestId') || null;
const MAX_REQUESTS = 5; // Limit für offene Bewerbungen
const forbiddenKeywords = ["porn", "xxx", "sex", "nude", "adult", "warez", "gamble"];

// --- 3. ECHTZEIT-SYNCHRONISATION ---
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
            renderRequests();
            renderUsers();
            // Bewerbungen für Admin laden
            db.ref('accountRequests').once('value', (snap) => renderAccountApplications(snap.val()));
        }
    }
});

function syncToCloud() {
    db.ref('/').update({
        users: users,
        links: links,
        folders: folders,
        folderRequests: folderRequests
    });
}

// --- 4. LOGIN & AUTH ---
function login() {
    const userIn = document.getElementById('username').value;
    const passIn = document.getElementById('password').value;
    const user = users.find(u => u.name === userIn && u.pass === passIn);
    
    if (user) {
        currentUser = user;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('welcome-msg').innerText = `> SYSTEM ONLINE. USER: ${currentUser.name}`;
        
        if (currentUser.role === 'admin') {
            document.getElementById('admin-section').style.display = 'block';
        }
        updateFolderDropdown();
    } else {
        showModal("ZUGRIFF VERWEIGERT.");
    }
}

function logout() {
    currentUser = null;
    location.reload(); 
}

// --- 5. ACCOUNT-BEWERBUNG (GÄSTE) ---
function openRequestForm() {
    db.ref('accountRequests').once('value', (snapshot) => {
        const allRequests = snapshot.val() || {};
        const pendingCount = Object.values(allRequests).filter(req => req.status === 'pending').length;
        document.getElementById('login-section').style.display = 'none';

        if (pendingCount >= MAX_REQUESTS) {
            document.getElementById('too-many-requests').style.display = 'block';
        } else {
            document.getElementById('request-section').style.display = 'block';
        }
    });
}

function closeTooManyRequests() {
    document.getElementById('too-many-requests').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
}

function submitAccountRequest() {
    const name = document.getElementById('ans-name').value.trim();
    const reason = document.getElementById('ans-reason').value.trim();
    if (name && reason) {
        const newReqRef = db.ref('accountRequests').push();
        myRequestId = newReqRef.key;
        localStorage.setItem('pendingRequestId', myRequestId);
        newReqRef.set({ name, reason, status: 'pending', timestamp: Date.now() });
        showStatusScreen();
    }
}

function showStatusScreen() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('request-section').style.display = 'none';
    document.getElementById('status-section').style.display = 'block';
    
    db.ref('accountRequests/' + myRequestId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        const msgBox = document.getElementById('status-message');
        if (data.status === 'pending') {
            msgBox.innerHTML = `<span style="color:yellow;">> STATUS: IN BEARBEITUNG...</span>`;
        } else if (data.status === 'rejected') {
            msgBox.innerHTML = `<span style="color:red;">> STATUS: ABGELEHNT</span>`;
        } else if (data.status === 'accepted') {
            msgBox.innerHTML = `<span style="color:#0f0;">> ZUGRIFF GEWÄHRT!</span><br>USER: ${data.generatedUser}<br>PASS: ${data.generatedPass}`;
        }
    });
}

// --- 6. ADMIN: USER & RECHTE ---
function renderUsers() {
    const list = document.getElementById('user-list');
    list.innerHTML = users.map(u => `
        <div class="user-card" style="border:1px solid #222; padding:5px; margin-bottom:5px;">
            <div onclick="toggleRoleMenu('${u.name}')" style="cursor:pointer;">
                ${u.name} <strong style="color:#0f0;">[${u.role}]</strong>
            </div>
            <div id="role-menu-${u.name}" style="display:none; gap:5px; margin-top:5px;">
                <button onclick="changeUserRole('${u.name}', 'user')" class="mini-btn">User</button>
                <button onclick="changeUserRole('${u.name}', 'moderator')" class="mini-btn">Mod</button>
                <button onclick="changeUserRole('${u.name}', 'admin')" class="mini-btn">Admin</button>
                <button onclick="deleteUser('${u.name}')" style="background:red;">KICK</button>
            </div>
        </div>`).join('');
}

function toggleRoleMenu(name) {
    const m = document.getElementById(`role-menu-${name}`);
    if(m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

function changeUserRole(name, role) {
    const idx = users.findIndex(u => u.name === name);
    if (idx !== -1 && name !== 'admin') {
        users[idx].role = role;
        syncToCloud();
        showModal(`${name} ist nun ${role}`);
    }
}

function renderAccountApplications(requests) {
    const list = document.getElementById('account-request-list');
    if (!list || !requests) return;
    list.innerHTML = Object.keys(requests).map(id => {
        const r = requests[id];
        if (r.status !== 'pending') return '';
        return `
            <div style="border:1px solid #00f; padding:5px; margin-bottom:10px;">
                <strong>${r.name}</strong>: ${r.reason}<br>
                <input type="text" id="gen-u-${id}" placeholder="User">
                <input type="text" id="gen-p-${id}" placeholder="Pass">
                <button onclick="processApp('${id}', 'accepted')">OK</button>
                <button onclick="processApp('${id}', 'rejected')">X</button>
            </div>`;
    }).join('');
}

function processApp(id, action) {
    if (action === 'accepted') {
        const u = document.getElementById(`gen-u-${id}`).value;
        const p = document.getElementById(`gen-p-${id}`).value;
        users.push({ name: u, pass: p, role: 'user' });
        syncToCloud();
        db.ref('accountRequests/' + id).update({ status: 'accepted', generatedUser: u, generatedPass: p });
    } else {
        db.ref('accountRequests/' + id).update({ status: 'rejected' });
    }
}

// --- 7. LINKS & ORDNER ---
function addLink() {
    const name = document.getElementById('link-name').value;
    const url = document.getElementById('link-url').value;
    const folder = document.getElementById('current-folder').value;
    if (name && url && folder) {
        links.push({ name, url: url.includes('http') ? url : 'https://'+url, author: currentUser.name, folder });
        syncToCloud();
    }
}

function renderLinks() {
    const folder = document.getElementById('current-folder').value;
    const list = document.getElementById('link-list');
    if (!folder) { list.innerHTML = "Wähle Verzeichnis..."; return; }
    const filtered = links.filter(l => l.folder === folder);
    list.innerHTML = filtered.map((l, i) => `
        <li><a href="${l.url}" target="_blank">${l.name}</a> [${l.author}]
        ${currentUser.role === 'admin' ? `<button onclick="deleteLink(${links.indexOf(l)})">X</button>` : ''}</li>
    `).join('');
}

function deleteLink(idx) { links.splice(idx, 1); syncToCloud(); }

function updateFolderDropdown() {
    const s = document.getElementById('current-folder');
    const val = s.value;
    s.innerHTML = '<option value="">-- Wählen --</option>' + folders.map(f => `<option value="${f}" ${f===val?'selected':''}>${f}</option>`).join('');
}

// --- 8. SYSTEM-MODAL ---
function showModal(text, callback = null, showCancel = false) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-text').innerHTML = `> ${text}`;
    overlay.style.display = 'flex';
    const btnContainer = document.getElementById('modal-buttons');
    btnContainer.innerHTML = '';
    const ok = document.createElement('button');
    ok.innerText = '[ OK ]';
    ok.onclick = () => { overlay.style.display = 'none'; if(callback) callback(); };
    btnContainer.appendChild(ok);
}

// Initialer Check beim Laden
window.onload = () => { if(myRequestId) showStatusScreen(); };
