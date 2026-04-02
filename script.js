// --- CONFIG & FIREBASE ---
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

let users = [], links = [], folders = [], logs = [];
let currentUser = null, lockdownMode = false;

// --- 1. BOOT SEQUENZ (Idee 1) ---
const bootLines = [
    "> INITIALIZING KERNEL...", "> LOADING NEURAL LINK...",
    "> CONNECTING TO FIREBASE SERVER...", "> BYPASSING FIREWALL...",
    "> SYSTEM READY. WELCOME BACK."
];

async function runBoot() {
    const bootText = document.getElementById('boot-text');
    for(let line of bootLines) {
        bootText.innerHTML += line + "<br>";
        await new Promise(r => setTimeout(r, 600));
    }
    document.getElementById('boot-screen').style.display = 'none';
    document.getElementById('terminal-container').style.display = 'block';
}

// --- 2. CLOUD SYNC & LOCKDOWN CHECK ---
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    users = data.users || [];
    links = data.links || [];
    folders = data.folders || ["Allgemein"];
    logs = data.logs || [];
    lockdownMode = data.lockdownMode || false;

    // Lockdown Check (Idee 3)
    if (lockdownMode && currentUser && currentUser.name !== 'admin') {
        logout();
        alert("SYSTEM LOCKDOWN INITIATED. DISCONNECTING...");
    }

    if (currentUser) {
        checkPermissions();
        renderLinks();
        renderLogs();
    }
});

function syncToCloud() {
    db.ref('/').update({ users, links, folders, logs, lockdownMode });
}

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    logs.unshift(`[${time}] ${msg}`);
    if(logs.length > 50) logs.pop();
    syncToCloud();
}

// --- 3. LOGIN & PERMISSIONS ---
function login() {
    const uIn = document.getElementById('username').value;
    const pIn = document.getElementById('password').value;
    const user = users.find(u => u.name === uIn && u.pass === pIn);
    
    if (user) {
        if (lockdownMode && user.name !== 'admin') {
            showModal("LOCKDOWN ACTIVE. ACCESS DENIED.");
            return;
        }
        currentUser = user;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('welcome-msg').innerText = `> USER: ${currentUser.name}`;
        addLog(`User ${currentUser.name} logged in.`);
        updateFolderDropdown();
    } else { showModal("ACCESS DENIED."); }
}

function logout() { location.reload(); }

// --- 4. DATABASE & CLICK TRACKER (Idee 4, 5, 6) ---
function addLink() {
    const n = document.getElementById('link-name').value;
    const u = document.getElementById('link-url').value;
    const f = document.getElementById('current-folder').value;
    const isPrivate = document.getElementById('link-private').checked;

    if(n && u && f) {
        links.push({ 
            name: n, url: u, author: currentUser.name, 
            folder: f, isPrivate: isPrivate, clicks: 0 
        });
        addLog(`Link '${n}' added to ${f} (Private: ${isPrivate})`);
        syncToCloud();
    }
}

function trackClick(idx) {
    links[idx].clicks = (links[idx].clicks || 0) + 1;
    syncToCloud();
}

function renderLinks() {
    const f = document.getElementById('current-folder').value;
    const search = document.getElementById('search-input').value.toLowerCase();
    const list = document.getElementById('link-list');
    
    let filtered = links.filter(l => {
        const matchesFolder = l.folder === f;
        const matchesSearch = l.name.toLowerCase().includes(search);
        const canSeePrivate = !l.isPrivate || l.author === currentUser.name || currentUser.name === 'admin';
        return matchesFolder && matchesSearch && canSeePrivate;
    });

    list.innerHTML = filtered.map(l => {
        const idx = links.indexOf(l);
        return `<li>
            <a href="${l.url}" target="_blank" onclick="trackClick(${idx})">${l.name}</a> 
            <span style="color:#333; font-size:0.7em;">[${l.clicks || 0} Clicks]</span>
            ${(currentUser.name === 'admin' || (currentUser.permissions && currentUser.permissions.canDeleteLinks)) ? 
              `<button onclick="deleteLink(${idx})" style="width:auto; background:red;">X</button>` : ''}
        </li>`;
    }).join('');
}

// --- 5. ADMIN TOOLS ---
function toggleLockdown() {
    lockdownMode = !lockdownMode;
    addLog(`LOCKDOWN ${lockdownMode ? 'ACTIVATED' : 'DEACTIVATED'} by admin.`);
    syncToCloud();
}

function renderLogs() {
    const logContainer = document.getElementById('system-logs');
    if(logContainer) logContainer.innerHTML = logs.map(l => `<div class="log-entry">${l}</div>`).join('');
}

// (Hier kommen deine anderen Funktionen wie renderUsers, updateFolderDropdown etc. aus dem vorherigen Script rein)

// --- START ---
runBoot();
