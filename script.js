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

// Verbindung zur Firebase Cloud herstellen
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- 2. GLOBALE VARIABLEN ---
let users = [];
let links = [];
let folders = [];
let folderRequests = [];
let currentUser = null;
let reviewIndex = 0;
const forbiddenKeywords = ["porn", "xxx", "sex", "nude", "adult", "warez", "gamble"];

// --- 3. ECHTZEIT-SYNCHRONISATION ---
// Diese Funktion lauscht live auf Änderungen in der Google Cloud
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    
    // Daten laden oder Standardwerte setzen
    users = data.users || [{ name: "admin", pass: "1234", role: "admin" }];
    links = data.links || [];
    folders = data.folders || ["Allgemein"];
    folderRequests = data.folderRequests || [];

    // Wenn eingeloggt, UI sofort aktualisieren
    if (currentUser) {
        updateFolderDropdown();
        renderLinks();
        if (currentUser.role === 'admin') {
            renderRequests();
            renderUsers();
        }
    }
});

// Hilfsfunktion: Schreibt den aktuellen Stand in die Cloud
function syncToCloud() {
    db.ref('/').set({
        users: users,
        links: links,
        folders: folders,
        folderRequests: folderRequests
    });
}

// --- 4. AUTHENTIFIZIERUNG ---

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
            renderUsers();
            renderRequests();
        }
        updateFolderDropdown();
    } else {
        showModal("ZUGRIFF VERWEIGERT: LOGIN FEHLGESCHLAGEN.");
    }
}

function logout() {
    currentUser = null;
    location.reload(); 
}

// --- 5. VERZEICHNIS-VERWALTUNG ---

function sendFolderRequest() {
    const name = document.getElementById('req-folder-name').value.trim();
    const reason = document.getElementById('req-folder-reason').value.trim();
    if (name && reason) {
        if (folders.includes(name)) {
            showModal("FEHLER: ORDNER EXISTIERT BEREITS.");
            return;
        }
        folderRequests.push({ name, reason, user: currentUser.name });
        syncToCloud();
        document.getElementById('req-folder-name').value = '';
        document.getElementById('req-folder-reason').value = '';
        showModal("ANFRAGE ÜBERMITTELT.");
    }
}

function updateFolderDropdown() {
    const select = document.getElementById('current-folder');
    if (!select) return;
    const currentVal = select.value;
    let options = '<option value="">-- Verzeichnis wählen --</option>';
    folders.forEach(f => {
        options += `<option value="${f}" ${f === currentVal ? 'selected' : ''}>${f}</option>`;
    });
    select.innerHTML = options;

    const adminBtn = document.getElementById('admin-folder-control');
    if (currentUser && currentUser.role === 'admin' && currentVal !== "" && currentVal !== "Allgemein") {
        adminBtn.style.display = 'inline-block';
    } else {
        adminBtn.style.display = 'none';
    }
}

function deleteFolder() {
    const folderName = document.getElementById('current-folder').value;
    if (!folderName || folderName === "Allgemein") return;

    showModal(`ORDNER "${folderName}" UND ALLE LINKS LÖSCHEN?`, () => {
        folders = folders.filter(f => f !== folderName);
        links = links.filter(l => l.folder !== folderName);
        syncToCloud();
        document.getElementById('current-folder').value = "";
    }, true);
}

// --- 6. LINK-MANAGEMENT ---

function addLink() {
    const name = document.getElementById('link-name').value.trim();
    const url = document.getElementById('link-url').value.trim();
    const folder = document.getElementById('current-folder').value;
    
    if (name && url && folder) {
        const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
        links.push({ name, url: formattedUrl, author: currentUser.name, folder: folder });
        syncToCloud();
        document.getElementById('link-name').value = '';
        document.getElementById('link-url').value = '';
    }
}

function renderLinks() {
    const folder = document.getElementById('current-folder').value;
    const list = document.getElementById('link-list');
    const form = document.getElementById('link-form');
    
    if (folder) {
        form.style.display = 'block';
        document.getElementById('active-folder-name').innerText = folder;
        const filtered = links.filter(l => l.folder === folder);
        list.innerHTML = filtered.length === 0 ? "<li>VERZEICHNIS LEER.</li>" : filtered.map((l) => `
            <li>
                <a href="${l.url}" target="_blank">${l.name}</a>
                <span class="author"> [User: ${l.author}]</span>
                ${currentUser.role === 'admin' ? `<button onclick="deleteLinkByIdx(${links.indexOf(l)})" class="delete-btn" style="width:auto; padding:2px 5px;">X</button>` : ''}
            </li>`).join('');
    } else {
        form.style.display = 'none';
        list.innerHTML = "<li>WARTE AUF VERZEICHNISWAHL...</li>";
    }
}

function deleteLinkByIdx(index) {
    showModal("DATENSATZ ENTFERNEN?", () => {
        links.splice(index, 1);
        syncToCloud();
    }, true);
}

// --- 7. ADMIN-TOOLS ---

function renderRequests() {
    const list = document.getElementById('request-list');
    if (folderRequests.length === 0) {
        list.innerHTML = "<p style='color:#555;'>KEINE OFFENEN ANFRAGEN.</p>";
        return;
    }
    list.innerHTML = folderRequests.map((req, i) => `
        <div style="border:1px solid #f00; padding:10px; margin-bottom:5px; background:rgba(255,0,0,0.1);">
            <strong>${req.name}</strong> (von ${req.user})<br>
            <small>${req.reason}</small><br>
            <button onclick="approveFolder(${i})" class="modal-btn" style="width:auto; margin-top:5px;">[ OK ]</button>
            <button onclick="rejectReq(${i})" class="delete-btn" style="width:auto; margin-top:5px;">[ X ]</button>
        </div>`).join('');
}

function approveFolder(i) {
    const req = folderRequests[i];
    if (!folders.includes(req.name)) folders.push(req.name);
    folderRequests.splice(i, 1);
    syncToCloud();
}

function rejectReq(i) {
    folderRequests.splice(i, 1);
    syncToCloud();
}

function createUser() {
    const name = document.getElementById('new-user').value.trim();
    const pass = document.getElementById('new-pass').value.trim();
    if (name && pass) {
        if (users.find(u => u.name === name)) {
            showModal("FEHLER: USER EXISTIERT BEREITS.");
            return;
        }
        users.push({ name, pass, role: 'user' });
        syncToCloud();
        document.getElementById('new-user').value = '';
        document.getElementById('new-pass').value = '';
        showModal(`USER "${name}" REGISTRIERT.`);
    }
}

function renderUsers() {
    const list = document.getElementById('user-list');
    list.innerHTML = users.map(u => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom:1px solid #222;">
            <span>${u.name} [${u.role}]</span>
            ${u.name !== 'admin' ? `<button onclick="deleteUser('${u.name}')" class="delete-btn" style="width:auto;">Kick</button>` : '<span>[ROOT]</span>'}
        </div>`).join('');
}

function deleteUser(name) {
    showModal(`USER "${name}" ENTFERNEN?`, () => {
        users = users.filter(u => u.name !== name);
        syncToCloud();
    }, true);
}

// --- 8. CONTENT SAFETY ---

function startAutoScan() {
    let deleted = 0;
    links = links.filter(link => {
        const content = (link.name + link.url).toLowerCase();
        const forbidden = forbiddenKeywords.some(kw => content.includes(kw));
        if (forbidden) { deleted++; return false; }
        return true;
    });
    if (deleted > 0) syncToCloud();
    showModal(`AUTO-SCAN FERTIG: ${deleted} LINKS ENTFERNT.`);
}

function startContentReview() {
    reviewIndex = 0;
    if (links.length === 0) { showModal("KEINE LINKS VORHANDEN."); return; }
    processNextReview();
}

function processNextReview() {
    if (reviewIndex >= links.length) { showModal("PRÜFUNG BEENDET."); return; }
    const l = links[reviewIndex];
    showModal(`CHECK: ${l.name}<br><small>${l.url}</small>`, () => {
        reviewIndex++;
        processNextReview();
    }, true);
}

// --- 9. MODAL SYSTEM ---

function showModal(text, callback = null, showCancel = false) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-text').innerHTML = `> ${text}`;
    overlay.style.display = 'flex';
    const btnContainer = document.getElementById('modal-buttons');
    btnContainer.innerHTML = '';
    
    const okBtn = document.createElement('button');
    okBtn.className = 'modal-btn';
    okBtn.innerText = '[ BESTÄTIGEN ]';
    okBtn.onclick = () => {
        overlay.style.display = 'none';
        if (callback) callback();
    };
    btnContainer.appendChild(okBtn);
    
    if (showCancel) {
        const cBtn = document.createElement('button');
        cBtn.className = 'modal-btn cancel';
        cBtn.innerText = '[ ABBRECHEN ]';
        cBtn.onclick = () => overlay.style.display = 'none';
        btnContainer.appendChild(cBtn);
    }
}
let myRequestId = localStorage.getItem('pendingRequestId') || null;

// Beim Start prüfen, ob der Gast noch auf eine Antwort wartet
window.onload = () => {
    if (myRequestId) {
        showStatusScreen();
    }
};

function openRequestForm() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('request-section').style.display = 'block';
}

function closeRequestForm() {
    document.getElementById('request-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
}

function submitAccountRequest() {
    const name = document.getElementById('ans-name').value;
    const reason = document.getElementById('ans-reason').value;

    if (name && reason) {
        const newReqRef = db.ref('accountRequests').push();
        myRequestId = newReqRef.key;
        localStorage.setItem('pendingRequestId', myRequestId);

        newReqRef.set({
            name: name,
            reason: reason,
            status: 'pending',
            timestamp: Date.now()
        });
        showStatusScreen();
    }
}

function showStatusScreen() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('request-section').style.display = 'none';
    document.getElementById('status-section').style.display = 'block';

    // Live-Update für diesen speziellen Antrag aktivieren
    db.ref('accountRequests/' + myRequestId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const msgBox = document.getElementById('status-message');
        if (data.status === 'pending') {
            msgBox.innerHTML = `<span style="color:yellow;">ANTRAG IN BEARBEITUNG...</span><br>Bitte dieses Fenster nicht schließen.`;
        } else if (data.status === 'rejected') {
            msgBox.innerHTML = `<span style="color:red;">ZUGRIFF ABGELEHNT.</span><br>Der Admin hat deine Anfrage nicht akzeptiert.`;
        } else if (data.status === 'accepted') {
            msgBox.innerHTML = `
                <span style="color:#0f0; font-size:1.5em;">ZUGRIFF GEWÄHRT!</span><br><br>
                DEIN LOGIN:<br>
                <strong>USER: ${data.generatedUser}</strong><br>
                <strong>PASS: ${data.generatedPass}</strong><br><br>
                Notiere dir diese Daten und logge dich ein.
            `;
            // Optional: Button zum Login einblenden
        }
    });
}

function cancelWaiting() {
    localStorage.removeItem('pendingRequestId');
    location.reload();
}
// Listener für Bewerbungen (nur für Admin relevant)
db.ref('accountRequests').on('value', (snapshot) => {
    const requests = snapshot.val();
    const list = document.getElementById('account-request-list');
    if (!list || !currentUser || currentUser.role !== 'admin') return;

    if (!requests) {
        list.innerHTML = "<p>Keine neuen Bewerbungen.</p>";
        return;
    }

    list.innerHTML = Object.keys(requests).map(id => {
        const r = requests[id];
        if (r.status !== 'pending') return ''; // Nur offene zeigen

        return `
            <div style="border:1px solid #00f; padding:10px; margin-bottom:10px;">
                <strong>${r.name}</strong> will beitreten.<br>
                <small>Grund: ${r.reason}</small><br><br>
                <input type="text" id="user-${id}" placeholder="Benutzername vergeben" style="width:45%;">
                <input type="text" id="pass-${id}" placeholder="Passwort vergeben" style="width:45%;"><br>
                <button onclick="handleRequest('${id}', 'accepted')" style="background:green;">[ ANNEHMEN ]</button>
                <button onclick="handleRequest('${id}', 'rejected')" style="background:red;">[ ABLEHNEN ]</button>
            </div>
        `;
    }).join('');
});

function handleRequest(id, action) {
    if (action === 'accepted') {
        const u = document.getElementById(`user-${id}`).value;
        const p = document.getElementById(`pass-${id}`).value;

        if (!u || !p) {
            showModal("Bitte User und Pass für den Gast eingeben!");
            return;
        }

        // 1. In die User-Datenbank einfügen
        users.push({ name: u, pass: p, role: 'user' });
        
        // 2. Den Antrag aktualisieren
        db.ref('accountRequests/' + id).update({
            status: 'accepted',
            generatedUser: u,
            generatedPass: p
        });
        
        syncToCloud();
        showModal("User wurde freigeschaltet!");
    } else {
        db.ref('accountRequests/' + id).update({ status: 'rejected' });
    }
}
// Konfiguration: Wie viele Anfragen sind maximal erlaubt?
const MAX_REQUESTS = 1; 

function openRequestForm() {
    // 1. Zuerst in der Cloud prüfen, wie viele Anfragen es gibt
    db.ref('accountRequests').once('value', (snapshot) => {
        const allRequests = snapshot.val() || {};
        
        // Zähle nur die Anfragen, die noch den Status 'pending' haben
        const pendingCount = Object.values(allRequests).filter(req => req.status === 'pending').length;

        document.getElementById('login-section').style.display = 'none';

        if (pendingCount >= MAX_REQUESTS) {
            // SPERRE: Zu viele Anfragen
            document.getElementById('too-many-requests').style.display = 'block';
        } else {
            // FREI: Formular anzeigen
            document.getElementById('request-section').style.display = 'block';
        }
    });
}

// Funktion für den weißen "Zurück"-Button im Sperr-Bildschirm
function closeTooManyRequests() {
    document.getElementById('too-many-requests').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
}
