// =====================================================================
// TERMINAL DATABASE V3.0 - MASTER SCRIPT (LOCKDOWN & PERMISSIONS)
// =====================================================================

// --- 1. FIREBASE CONFIG ---
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
let lockdownMode = false; // Neuer Status
let currentUser = null;
let myRequestId = localStorage.getItem('pendingRequestId') || null;

const MAX_REQUESTS = 5;
const forbiddenKeywords = ["porn", "xxx", "sex", "nude", "adult", "warez", "gamble"];

// --- 3. ECHTZEIT CLOUD SYNC ---
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    
    // Daten laden
    users = data.users || [{ name: "admin", pass: "1234", role: "admin" }];
    links = data.links || [];
    folders = data.folders || ["Allgemein"];
    folderRequests = data.folderRequests || [];
    lockdownMode = data.lockdownMode || false;

    // --- LOCKDOWN LOGIK ---
    // Wenn Lockdown aktiv ist und ein normaler User eingeloggt ist -> KICK
    if (lockdownMode && currentUser && currentUser.name !== 'admin') {
        alert("!!! SYSTEM LOCKDOWN INITIATED !!!\nYour session has been terminated.");
        logout();
        return;
    }

    // UI für eingeloggte Personen aktualisieren
    if (currentUser) {
        // Rechte des aktuellen Users frisch aus der Cloud ziehen
        const updatedUser = users.find(u => u.name === currentUser.name);
        if (updatedUser) currentUser = updatedUser;

        updateFolderDropdown();
        renderLinks();
        checkPermissions();
        
        // Lockdown-Button Text anpassen
        const lb = document.getElementById('lockdown-btn');
        if (lb) {
            lb.innerText = lockdownMode ? "[ DISABLE LOCKDOWN ]" : "[ INITIATE LOCKDOWN ]";
            lb.style.background = lockdownMode ? "#0f0" : "#a00";
            lb.style.color = lockdownMode ? "black" : "white";
        }
    }
});

function syncToCloud() {
    db.ref('/').update({ 
        users, 
        links, 
        folders, 
        folderRequests, 
        lockdownMode 
    });
}

// --- 4. AUTHENTIFIZIERUNG ---
function login() {
    const uIn = document.getElementById('username').value.trim();
    const pIn = document.getElementById('password').value.trim();
    
    // Lockdown Prüfung beim Login
    if (lockdownMode && uIn !== 'admin') {
        showModal("ZUGRIFF VERWEIGERT: SYSTEM BEFINDET SICH IM LOCKDOWN.");
        return;
    }

    const user = users.find(u => u.name === uIn && u.pass === pIn);
    
    if (user) {
        currentUser = user;
        // Standard-Rechte vergeben falls keine existieren
        if (!currentUser.permissions && currentUser.name !== 'admin') {
            currentUser.permissions = { canDeleteLinks: false, canManageFolders: false, canManageUsers: false, isMod: false };
        }

        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('welcome-msg').innerText = `> USER: ${currentUser.name}`;
        
        checkPermissions();
        updateFolderDropdown();
    } else { 
        showModal("LOGIN FEHLGESCHLAGEN."); 
    }
}

function logout() { 
    location.reload(); 
}

function checkPermissions() {
    if (!currentUser) return;
    
    const p = currentUser.permissions || {};
    const isAdmin = (currentUser.name === 'admin');

    const adminSection = document.getElementById('admin-section');
    if (adminSection) {
        // Admin-Bereich sichtbar, wenn man IRGENDEIN Recht hat
        adminSection.style.display = (isAdmin || p.canManageUsers || p.isMod || p.canManageFolders) ? 'block' : 'none';
    }

    if (isAdmin || p.canManageUsers) {
        renderUsers();
        db.ref('accountRequests').once('value', (s) => renderAccountApps(s.val()));
    }
    
    if (isAdmin || p.canManageFolders) {
        renderRequests();
    }
}

// --- 5. BEWERBUNGEN (GÄSTE) ---
function openRequestForm() {
    db.ref('accountRequests').once('value', (snap) => {
        const reqs = snap.val() || {};
        const count = Object.values(reqs).filter(r => r.status === 'pending').length;
        document.getElementById('login-section').style.display = 'none';
        
        if (count >= MAX_REQUESTS) {
            document.getElementById('too-many-requests').style.display = 'block';
        } else {
            document.getElementById('request-section').style.display = 'block';
        }
    });
}

function submitAccountRequest() {
    const name = document.getElementById('ans-name').value.trim();
    const reason = document.getElementById('ans-reason').value.trim();
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
        if (d.status === 'pending') m.innerHTML = "STATUS: IN BEARBEITUNG...";
        else if (d.status === 'rejected') m.innerHTML = "STATUS: ABGELEHNT";
        else if (d.status === 'accepted') {
            m.innerHTML = `ZUGRIFF GEWÄHRT!<br><br>USER: ${d.generatedUser}<br>PASS: ${d.generatedPass}`;
        }
    });
}

// --- 6. ADMIN: USER & RECHTE ---
function createUser() {
    const n = document.getElementById('new-user').value.trim();
    const p = document.getElementById('new-pass').value.trim();
    if (n && p) {
        users.push({ 
            name: n, pass: p, 
            permissions: { canDeleteLinks: false, canManageFolders: false, canManageUsers: false, isMod: false }
        });
        syncToCloud();
    }
}

function renderUsers() {
    const list = document.getElementById('user-list');
    if (!list) return;
    list.innerHTML = users.map(u => {
        if (u.name === 'admin') return `<div style="color:#555; padding:5px;">[ROOT] ${u.name}</div>`;
        const p = u.permissions || {};
        return `
            <div style="border:1px solid #333; padding:5px; margin-bottom:5px;">
                <div onclick="toggleRoleMenu('${u.name}')" style="cursor:pointer;">> ${u.name}</div>
                <div id="role-menu-${u.name}" style="display:none; flex-direction:column; font-size:0.8em; padding:5px;">
                    <label><input type="checkbox" ${p.canDeleteLinks?'checked':''} onchange="updatePerm('${u.name}','canDeleteLinks')"> Links löschen</label>
                    <label><input type="checkbox" ${p.canManageFolders?'checked':''} onchange="updatePerm('${u.name}','canManageFolders')"> Ordner verwalten</label>
                    <label><input type="checkbox" ${p.canManageUsers?'checked':''} onchange="updatePerm('${u.name}','canManageUsers')"> User verwalten</label>
                    <label><input type="checkbox" ${p.isMod?'checked':''} onchange="updatePerm('${u.name}','isMod')"> Moderator (Scan)</label>
                    <button onclick="deleteUser('${u.name}')" style="background:red; color:white; border:none; margin-top:5px;">KICK</button>
                </div>
            </div>`;
    }).join('');
}

function toggleRoleMenu(n) {
    const m = document.getElementById(`role-menu-${n}`);
    if(m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

function updatePerm(name, key) {
    const u = users.find(user => user.name === name);
    if(u) {
        if(!u.permissions) u.permissions = {};
        u.permissions[key] = !u.permissions[key];
        syncToCloud();
    }
}

function deleteUser(n) {
    if(n==='admin') return;
    users = users.filter(u => u.name !== n);
    syncToCloud();
}

// --- 7. ADMIN: BEWERBUNGEN ---
function renderAccountApps(reqs) {
    const list = document.getElementById('account-request-list');
    if(!list || !reqs) return;
    list.innerHTML = Object.keys(reqs).map(id => {
        const r = reqs[id];
        if(r.status !== 'pending') return '';
        return `<div style="border:1px solid blue; padding:5px; margin-bottom:5px;">
            ${r.name}: ${r.reason}<br>
            <input id="u-${id}" placeholder="User" style="width:45%"> <input id="p-${id}" placeholder="Pass" style="width:45%">
            <button onclick="processApp('${id}', 'accepted')" style="width:auto;">OK</button>
            <button onclick="processApp('${id}', 'rejected')" style="width:auto; background:red;">X</button>
        </div>`;
    }).join('');
}

function processApp(id, stat) {
    if(stat === 'accepted') {
        const u = document.getElementById(`u-${id}`).value;
        const p = document.getElementById(`p-${id}`).value;
        users.push({ name: u, pass: p, permissions: { canDeleteLinks: false, canManageFolders: false, canManageUsers: false, isMod: false } });
        syncToCloud();
        db.ref('accountRequests/'+id).update({ status: 'accepted', generatedUser: u, generatedPass: p });
    } else { db.ref('accountRequests/'+id).update({ status: 'rejected' }); }
}

// --- 8. LINKS & ORDNER ---
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
    const p = currentUser.permissions || {};
    const canDel = (currentUser.name === 'admin' || p.canDeleteLinks);
    
    if(!f) { list.innerHTML = "Wähle Verzeichnis."; return; }
    const filtered = links.filter(l => l.folder === f);
    list.innerHTML = filtered.map(l => `<li><a href="${l.url}" target="_blank">${l.name}</a> 
        ${canDel ? `<button onclick="deleteLink(${links.indexOf(l)})" style="width:auto; background:red; margin-left:10px;">X</button>` : ''}</li>`).join('');
}

function deleteLink(idx) { links.splice(idx, 1); syncToCloud(); }

function updateFolderDropdown() {
    const s = document.getElementById('current-folder');
    if(s) {
        const v = s.value;
        s.innerHTML = '<option value="">-- Wählen --</option>' + folders.map(f => `<option value="${f}" ${f===v?'selected':''}>${f}</option>`).join('');
    }
}

function sendFolderRequest() {
    const n = document.getElementById('req-folder-name').value;
    if(n) { folderRequests.push({ name: n, user: currentUser.name }); syncToCloud(); }
}

function renderRequests() {
    const list = document.getElementById('request-list');
    if(list) list.innerHTML = folderRequests.map((r, i) => `<div>${r.name} <button onclick="approveFolder(${i})">OK</button> <button onclick="rejectFolder(${i})">X</button></div>`).join('');
}

function approveFolder(i) {
    const r = folderRequests[i];
    if(!folders.includes(r.name)) folders.push(r.name);
    folderRequests.splice(i, 1);
    syncToCloud();
}

function rejectFolder(i) { folderRequests.splice(i, 1); syncToCloud(); }

function deleteFolder() {
    const f = document.getElementById('current-folder').value;
    if(f && f !== "Allgemein") {
        folders = folders.filter(fol => fol !== f);
        links = links.filter(l => l.folder !== f);
        syncToCloud();
    }
}

// --- 9. SECURITY TOOLS ---
function toggleLockdown() {
    if (currentUser.name !== 'admin') return;
    lockdownMode = !lockdownMode;
    syncToCloud();
    showModal(lockdownMode ? "SYSTEM LOCKDOWN ACTIVATED" : "SYSTEM SECURED - LOCKDOWN DEACTIVATED");
}

function startAutoScan() {
    const p = currentUser.permissions || {};
    if (currentUser.name !== 'admin' && !p.isMod) return;
    let del = 0;
    links = links.filter(l => {
        const check = (l.name + l.url).toLowerCase();
        if(forbiddenKeywords.some(k => check.includes(k))) { del++; return false; }
        return true;
    });
    if(del > 0) syncToCloud();
    showModal(`SCAN COMPLETE: ${del} REMOVED.`);
}

// --- 10. MODAL ---
function showModal(t) {
    document.getElementById('modal-text').innerText = t;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-buttons').innerHTML = '<button onclick="document.getElementById(\'modal-overlay\').style.display=\'none\'">OK</button>';
}

function closeTooManyRequests() {
    document.getElementById('too-many-requests').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
}

window.onload = () => { if(myRequestId) showStatusScreen(); };
