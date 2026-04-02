// =====================================================================
// TERMINAL DATABASE V3.0 - CLOUD EDITION (WITH PERMISSION SYSTEM)
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
let currentUser = null;
let myRequestId = localStorage.getItem('pendingRequestId') || null;

const MAX_REQUESTS = 5;
const forbiddenKeywords = ["porn", "xxx", "sex", "nude", "adult", "warez", "gamble"];

// --- 3. CLOUD SYNCHRONISATION ---
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    
    // Standard-Root-Admin, falls DB leer ist
    users = data.users || [{ name: "admin", pass: "1234", role: "admin" }];
    links = data.links || [];
    folders = data.folders || ["Allgemein"];
    folderRequests = data.folderRequests || [];

    // UI für eingeloggten User aktualisieren
    if (currentUser) {
        // Aktuelle Rechte aus der Cloud neu laden
        const updatedUser = users.find(u => u.name === currentUser.name);
        if (updatedUser) currentUser = updatedUser;

        updateFolderDropdown();
        renderLinks();
        checkPermissions(); // Passt UI anhand der Rechte an
    }
});

function syncToCloud() {
    db.ref('/').update({ users, links, folders, folderRequests });
}

// --- 4. AUTH & BERECHTIGUNGSPRÜFUNG ---
function login() {
    const uIn = document.getElementById('username').value.trim();
    const pIn = document.getElementById('password').value.trim();
    const user = users.find(u => u.name === uIn && u.pass === pIn);
    
    if (user) {
        currentUser = user;
        
        // Falls alte User keine Rechte-Objekte haben, generieren
        if (!currentUser.permissions && currentUser.name !== 'admin') {
            currentUser.permissions = { canDeleteLinks: false, canManageFolders: false, canManageUsers: false, isMod: false };
        }

        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('welcome-msg').innerText = `> SYSTEM ONLINE. USER: ${currentUser.name}`;
        
        checkPermissions();
        updateFolderDropdown();
    } else { 
        showModal("ZUGRIFF VERWEIGERT: LOGINDATEN INKORREKT."); 
    }
}

function logout() { 
    location.reload(); 
}

function checkPermissions() {
    if (!currentUser) return;
    
    const p = currentUser.permissions || {};
    const isAdmin = (currentUser.name === 'admin');

    // Zeige Admin-Bereich nur, wenn man Rechte dazu hat
    const adminSection = document.getElementById('admin-section');
    if (adminSection) {
        adminSection.style.display = (isAdmin || p.canManageUsers || p.isMod || p.canManageFolders) ? 'block' : 'none';
    }

    // Wenn man User verwalten darf
    if (isAdmin || p.canManageUsers) {
        renderUsers();
        db.ref('accountRequests').once('value', (s) => renderAccountApps(s.val()));
    }
    
    // Wenn man Ordneranfragen bearbeiten darf
    if (isAdmin || p.canManageFolders) {
        renderRequests();
    }
}

// --- 5. BEWERBUNGSSYSTEM (GÄSTE) ---
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
    } else {
        showModal("BITTE ALLE FELDER AUSFÜLLEN.");
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
        
        if (d.status === 'pending') {
            m.innerHTML = `<span style="color:yellow;">> STATUS: WARTEND...</span>`;
        } else if (d.status === 'rejected') {
            m.innerHTML = `<span style="color:red;">> STATUS: ABGELEHNT</span>`;
        } else if (d.status === 'accepted') {
            m.innerHTML = `
                <span style="color:#0f0;">> ZUGRIFF GEWÄHRT!</span><br><br>
                USER: <strong style="color:white;">${d.generatedUser}</strong><br>
                PASS: <strong style="color:white;">${d.generatedPass}</strong>
            `;
        }
    });
}

// --- 6. ADMIN: USER-MANAGEMENT & RECHTE ---
function createUser() {
    const n = document.getElementById('new-user').value.trim();
    const p = document.getElementById('new-pass').value.trim();
    if (n && p) {
        if (users.find(u => u.name === n)) {
            showModal("USER EXISTIERT BEREITS.");
            return;
        }
        users.push({ 
            name: n, 
            pass: p, 
            role: 'user',
            permissions: { canDeleteLinks: false, canManageFolders: false, canManageUsers: false, isMod: false }
        });
        syncToCloud();
        document.getElementById('new-user').value = '';
        document.getElementById('new-pass').value = '';
        showModal(`USER ${n} ERSTELLT.`);
    }
}

function renderUsers() {
    const list = document.getElementById('user-list');
    if (!list) return;

    list.innerHTML = users.map(u => {
        if (u.name === 'admin') {
            return `<div style="border:1px solid #555; padding:10px; margin-bottom:5px; color:#aaa;"><strong>[ROOT-ADMIN] ${u.name}</strong></div>`;
        }

        if (!u.permissions) {
            u.permissions = { canDeleteLinks: false, canManageFolders: false, canManageUsers: false, isMod: false };
        }

        return `
            <div style="border:1px solid #333; padding:10px; margin-bottom:10px; background:rgba(0,255,0,0.02);">
                <div onclick="toggleRoleMenu('${u.name}')" style="cursor:pointer; font-weight:bold;">
                    > ${u.name} <span style="color:#555; font-size:0.8em; font-weight:normal;">(Klicken für Rechte)</span>
                </div>
                
                <div id="role-menu-${u.name}" style="display:none; flex-direction:column; gap:5px; margin-top:10px; padding:10px; border-top:1px dashed #0f0;">
                    <label style="cursor:pointer;"><input type="checkbox" ${u.permissions.canDeleteLinks ? 'checked' : ''} onchange="updatePermission('${u.name}', 'canDeleteLinks')"> Links löschen</label>
                    <label style="cursor:pointer;"><input type="checkbox" ${u.permissions.canManageFolders ? 'checked' : ''} onchange="updatePermission('${u.name}', 'canManageFolders')"> Ordner verwalten</label>
                    <label style="cursor:pointer;"><input type="checkbox" ${u.permissions.canManageUsers ? 'checked' : ''} onchange="updatePermission('${u.name}', 'canManageUsers')"> User verwalten</label>
                    <label style="cursor:pointer;"><input type="checkbox" ${u.permissions.isMod ? 'checked' : ''} onchange="updatePermission('${u.name}', 'isMod')"> Moderator (Auto-Scan)</label>
                    
                    <button onclick="deleteUser('${u.name}')" style="background:red; color:white; margin-top:10px; width:auto; border:none;">[ USER KICKEN ]</button>
                </div>
            </div>
        `;
    }).join('');
}

function toggleRoleMenu(n) {
    const m = document.getElementById(`role-menu-${n}`);
    if(m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

function updatePermission(username, permKey) {
    const u = users.find(user => user.name === username);
    if (u && u.name !== 'admin') {
        if (!u.permissions) u.permissions = {};
        u.permissions[permKey] = !u.permissions[permKey]; // Wert umkehren (true/false)
        syncToCloud();
    }
}

function deleteUser(n) {
    if(n === 'admin') return;
    showModal(`USER "${n}" KICKEN?`, () => {
        users = users.filter(u => u.name !== n);
        syncToCloud();
    }, true);
}

// --- 7. ADMIN: BEWERBUNGEN BEARBEITEN ---
function renderAccountApps(reqs) {
    const list = document.getElementById('account-request-list');
    if(!list || !reqs) return;
    
    list.innerHTML = Object.keys(reqs).map(id => {
        const r = reqs[id];
        if(r.status !== 'pending') return '';
        
        return `
            <div style="border:1px solid #00f; padding:10px; margin-bottom:10px; background:rgba(0,0,255,0.05);">
                <strong>Name: ${r.name}</strong><br>
                <small>Grund: ${r.reason}</small><br><br>
                <div style="display:flex; gap:5px; margin-bottom:5px;">
                    <input type="text" id="u-${id}" placeholder="Username" style="margin:0;"> 
                    <input type="text" id="p-${id}" placeholder="Passwort" style="margin:0;">
                </div>
                <button onclick="processApp('${id}', 'accepted')" style="width:auto; background:#0a0; color:white; border:none;">OK</button>
                <button onclick="processApp('${id}', 'rejected')" style="width:auto; background:#a00; color:white; border:none;">X</button>
            </div>
        `;
    }).join('');
}

function processApp(id, stat) {
    if(stat === 'accepted') {
        const u = document.getElementById(`u-${id}`).value.trim();
        const p = document.getElementById(`p-${id}`).value.trim();
        if(!u || !p) { showModal("LOGINDATEN FEHLEN!"); return; }
        
        users.push({ 
            name: u, 
            pass: p, 
            role: 'user',
            permissions: { canDeleteLinks: false, canManageFolders: false, canManageUsers: false, isMod: false }
        });
        syncToCloud();
        db.ref('accountRequests/'+id).update({ status: 'accepted', generatedUser: u, generatedPass: p });
    } else { 
        db.ref('accountRequests/'+id).update({ status: 'rejected' }); 
    }
}

// --- 8. LINKS & VERZEICHNISSE ---
function addLink() {
    const n = document.getElementById('link-name').value.trim();
    const u = document.getElementById('link-url').value.trim();
    const f = document.getElementById('current-folder').value;
    
    if(n && u && f) {
        links.push({ name: n, url: u.startsWith('http')?u:'https://'+u, author: currentUser.name, folder: f });
        syncToCloud();
        document.getElementById('link-name').value = '';
        document.getElementById('link-url').value = '';
    }
}

function renderLinks() {
    const f = document.getElementById('current-folder').value;
    const list = document.getElementById('link-list');
    const form = document.getElementById('link-form');
    const delBtn = document.getElementById('admin-folder-control');
    
    const p = currentUser.permissions || {};
    const isAdmin = currentUser.name === 'admin';
    const canDeleteLnk = isAdmin || p.canDeleteLinks;
    const canDeleteFld = isAdmin || p.canManageFolders;

    if (form) form.style.display = f ? 'block' : 'none';
    if (delBtn) delBtn.style.display = (f && f !== "Allgemein" && canDeleteFld) ? 'block' : 'none';

    if(!f) { list.innerHTML = "<li>Wähle ein Verzeichnis.</li>"; return; }
    
    const filtered = links.filter(l => l.folder === f);
    list.innerHTML = filtered.length === 0 ? "<li>Ordner ist leer.</li>" : filtered.map(l => `
        <li>
            <a href="${l.url}" target="_blank">${l.name}</a> 
            <span style="color:#555; font-size:0.9em;">[${l.author}]</span>
            ${canDeleteLnk ? `<button onclick="deleteLinkByIdx(${links.indexOf(l)})" style="width:auto; padding:2px 5px; margin-left:10px; background:#500; color:white; border:1px solid red;">X</button>` : ''}
        </li>
    `).join('');
}

function deleteLinkByIdx(idx) {
    showModal("LINK LÖSCHEN?", () => {
        links.splice(idx, 1);
        syncToCloud();
    }, true);
}

function updateFolderDropdown() {
    const s = document.getElementById('current-folder');
    if (!s) return;
    const v = s.value;
    s.innerHTML = '<option value="">-- Verzeichnis wählen --</option>' + folders.map(f => `<option value="${f}" ${f===v?'selected':''}>${f}</option>`).join('');
}

function sendFolderRequest() {
    const n = document.getElementById('req-folder-name').value.trim();
    if(n) { 
        folderRequests.push({ name: n, user: currentUser.name }); 
        syncToCloud(); 
        document.getElementById('req-folder-name').value = '';
        document.getElementById('req-folder-reason').value = '';
        showModal("ANFRAGE GESENDET.");
    }
}

function renderRequests() {
    const list = document.getElementById('request-list');
    if (!list) return;
    if (folderRequests.length === 0) { list.innerHTML = "<p style='color:#555;'>KEINE ANFRAGEN.</p>"; return; }
    
    list.innerHTML = folderRequests.map((r, i) => `
        <div style="border:1px dashed #0f0; padding:5px; margin-bottom:5px;">
            <strong>${r.name}</strong> <small>(von ${r.user})</small><br>
            <button onclick="approveFolder(${i})" style="width:auto; margin-top:5px;">OK</button> 
            <button onclick="rejectFolder(${i})" style="width:auto; background:red; margin-top:5px;">X</button>
        </div>`).join('');
}

function approveFolder(i) {
    const r = folderRequests[i];
    if(!folders.includes(r.name)) folders.push(r.name);
    folderRequests.splice(i, 1);
    syncToCloud();
}

function rejectFolder(i) {
    folderRequests.splice(i, 1);
    syncToCloud();
}

function deleteFolder() {
    const f = document.getElementById('current-folder').value;
    if(f && f !== "Allgemein") {
        showModal(`ORDNER "${f}" UND ALLE LINKS LÖSCHEN?`, () => {
            folders = folders.filter(fol => fol !== f);
            links = links.filter(l => l.folder !== f);
            syncToCloud();
            document.getElementById('current-folder').value = "";
        }, true);
    }
}

// --- 9. JUGENDSCHUTZ (AUTO-SCAN) ---
function startAutoScan() {
    const p = currentUser.permissions || {};
    if (currentUser.name !== 'admin' && !p.isMod) {
        showModal("ZUGRIFF VERWEIGERT: FEHLENDE RECHTE.");
        return;
    }

    let deleted = 0;
    links = links.filter(link => {
        const content = (link.name + link.url).toLowerCase();
        const isForbidden = forbiddenKeywords.some(kw => content.includes(kw));
        if (isForbidden) { deleted++; return false; }
        return true;
    });
    
    if (deleted > 0) syncToCloud();
    showModal(`SCAN BEENDET: ${deleted} VERBOTENE LINKS ENTFERNT.`);
}

// --- 10. MODAL & UI HELPER ---
function closeTooManyRequests() {
    document.getElementById('too-many-requests').style.display = 'none';
    document.getElementById('request-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
}

function showModal(text, callback = null, showCancel = false) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-text').innerHTML = `> ${text}`;
    overlay.style.display = 'flex';
    
    const btnContainer = document.getElementById('modal-buttons');
    btnContainer.innerHTML = '';
    
    const okBtn = document.createElement('button');
    okBtn.innerText = '[ BESTÄTIGEN ]';
    okBtn.style.marginRight = '10px';
    okBtn.onclick = () => {
        overlay.style.display = 'none';
        if (callback) callback();
    };
    btnContainer.appendChild(okBtn);
    
    if (showCancel) {
        const cBtn = document.createElement('button');
        cBtn.className = 'delete-btn';
        cBtn.innerText = '[ ABBRECHEN ]';
        cBtn.onclick = () => overlay.style.display = 'none';
        btnContainer.appendChild(cBtn);
    }
}

// INIT: Check Wartezimmer
window.onload = () => { if(myRequestId) showStatusScreen(); };
