// GitHub Configuration
let githubUser = "nauni84-pixel";
let githubRepo = "MasterSlides";
let githubToken = "";
let currentDataset = ""; // Filename in repo
let dataSha = null;
let lockSha = null;

let allRules = [];
let locks = {};
let selectedRuleId = null;
let currentUser = "";
let isAdmin = false;

const ADMIN_USER = "nauni84-pixel"; // Set your username here

// DOM Elements
const tagList = document.getElementById('tagList');
const searchInput = document.getElementById('searchInput');
const editorArea = document.getElementById('editorArea');
const historyArea = document.getElementById('historyArea');
const historyList = document.getElementById('historyList');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const tokenModal = document.getElementById('tokenModal');
const excelImport = document.getElementById('excelImport');
const datasetSelect = document.getElementById('datasetSelect');
const adminControls = document.getElementById('adminControls');

document.getElementById('saveConfigBtn').onclick = () => {
    githubToken = document.getElementById('githubToken').value;
    if (!githubToken) return alert("Token required");
    tokenModal.style.display = 'none';
    initApp();
};

async function initApp() {
    try {
        const userRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${githubToken}` }
        });
        if (!userRes.ok) throw new Error("Invalid Token");
        const userData = await userRes.json();
        currentUser = userData.login;
        isAdmin = (currentUser === ADMIN_USER);

        document.getElementById('currentUserDisplay').innerText = currentUser;
        if (isAdmin) adminControls.style.display = 'block';

        await loadDatasetList();
        setInterval(refreshData, 30000);
    } catch (e) {
        alert("GitHub Auth Failed: " + e.message);
        tokenModal.style.display = 'flex';
    }
}

async function loadDatasetList() {
    const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/`, {
        headers: { 'Authorization': `token ${githubToken}` }
    });
    const files = await res.json();
    const datasets = files.filter(f => f.name.endsWith('.json') && f.name !== 'lock.json');

    datasetSelect.innerHTML = '<option value="">Select Dataset</option>' +
        datasets.map(d => `<option value="${d.name}">${d.name.replace('.json', '')}</option>`).join('');
}

datasetSelect.onchange = (e) => {
    currentDataset = e.target.value;
    if (currentDataset) refreshData();
};

async function refreshData() {
    if (!currentDataset) return;
    try {
        const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${currentDataset}`, {
            headers: { 'Authorization': `token ${githubToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            dataSha = data.sha;
            allRules = JSON.parse(atob(data.content));
        }

        const lockRes = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/lock.json`, {
            headers: { 'Authorization': `token ${githubToken}` }
        });
        if (lockRes.ok) {
            const lockData = await lockRes.json();
            lockSha = lockData.sha;
            locks = JSON.parse(atob(lockData.content));
        } else {
            locks = {};
            lockSha = null;
        }

        renderTags();
        if (selectedRuleId) renderEditor();
    } catch (e) { console.error("Sync error:", e); }
}

function renderTags() {
    const filter = searchInput.value.toLowerCase();
    tagList.innerHTML = allRules
        .filter(r => r.iso20022XmlTag.toLowerCase().includes(filter))
        .map(rule => `
            <div class="tag-item ${rule.id === selectedRuleId ? 'active' : ''}" onclick="selectTag('${rule.id}')">
                <div class="fw-bold text-dark">${rule.iso20022XmlTag}</div>
                <div class="small text-muted" style="font-size: 0.75rem;">${rule.iso20022XmlPath.substring(0, 40)}...</div>
                ${locks[rule.id] ? `<span class="badge bg-danger lock-badge"><i class="fas fa-lock"></i> ${locks[rule.id]}</span>` : ''}
            </div>
        `).join('');
}

function selectTag(id) {
    selectedRuleId = id;
    renderEditor();
    renderTags();
}

function renderEditor() {
    const rule = allRules.find(r => r.id === selectedRuleId);
    if (!rule) return;
    const isLockedByMe = locks[rule.id] === currentUser;
    const isLockedByOther = locks[rule.id] && locks[rule.id] !== currentUser;

    editorArea.innerHTML = `
        <div class="card shadow-sm">
            <div class="card-body">
                <h3>${rule.iso20022XmlTag}</h3>
                <p class="text-muted small">${rule.iso20022XmlPath}</p>
                <hr>
                ${isLockedByOther ? `<div class="alert alert-warning py-1 small">Locked by ${locks[rule.id]}</div>` : ''}

                <div class="mb-3">
                    <label class="form-label small">Group B: STD IN</label>
                    <textarea id="stdIn" class="form-control" ${!isLockedByMe ? 'disabled' : ''}>${rule.stdInContentRules || ''}</textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label small">Group C: STD OUT</label>
                    <textarea id="stdOut" class="form-control" ${!isLockedByMe ? 'disabled' : ''}>${rule.stdOutContentRules || ''}</textarea>
                </div>

                <div class="mt-3">
                    ${!locks[rule.id] ?
                        `<button onclick="toggleLock('${rule.id}', true)" class="btn btn-primary btn-sm">Start Editing</button>` :
                        (isLockedByMe ?
                            `<button onclick="saveChanges()" class="btn btn-success btn-sm">Commit Changes (New Version)</button>
                             <button onclick="toggleLock('${rule.id}', false)" class="btn btn-link btn-sm text-muted">Cancel</button>` :
                            `<button class="btn btn-secondary btn-sm" disabled>View Only</button>`)
                    }
                </div>
            </div>
        </div>
    `;
}

async function toggleLock(id, lock) {
    if (lock) locks[id] = currentUser;
    else delete locks[id];

    await updateFile('lock.json', JSON.stringify(locks), lockSha, lock ? "Locking tag" : "Unlocking tag");
    await refreshData();
}

async function saveChanges() {
    const rule = allRules.find(r => r.id === selectedRuleId);
    rule.stdInContentRules = document.getElementById('stdIn').value;
    rule.stdOutContentRules = document.getElementById('stdOut').value;

    delete locks[rule.id];

    // Every save creates a commit on GitHub automatically (Version Control)
    await updateFile(currentDataset, JSON.stringify(allRules, null, 2), dataSha, `Update ${rule.iso20022XmlTag} in ${currentDataset}`);
    await updateFile('lock.json', JSON.stringify(locks), lockSha, "Releasing lock");

    alert("Changes committed as a new version on GitHub!");
    await refreshData();
}

async function updateFile(path, content, sha, message) {
    return fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${path}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            content: btoa(content),
            sha: sha
        })
    });
}

// Excel Import Logic
excelImport.addEventListener('change', (e) => {
    if (!isAdmin) return alert("Only Admin can import Excel files.");

    const file = e.target.files[0];
    const fileName = file.name.replace(/\.[^/.]+$/, "") + ".json";

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const newRules = json.slice(1).map((row, index) => ({
            id: 'rule_' + index,
            iso20022XmlTag: row[3] || "Unnamed Tag",
            iso20022XmlPath: row[4] || "No Path",
            stdInContentRules: row[8] || "",
            stdOutContentRules: row[10] || ""
        })).filter(r => r.iso20022XmlTag !== "Unnamed Tag");

        // Check if exists
        const check = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${fileName}`, {
            headers: { 'Authorization': `token ${githubToken}` }
        });

        if (check.ok) {
            if (!confirm(`Warning: Dataset "${fileName}" already exists. Overwrite?`)) return;
            const existing = await check.json();
            await updateFile(fileName, JSON.stringify(newRules, null, 2), existing.sha, "Overwriting dataset");
        } else {
            await updateFile(fileName, JSON.stringify(newRules, null, 2), null, "Initial import");
        }

        alert("Import successful!");
        loadDatasetList();
    };
    reader.readAsBinaryString(file);
});

viewHistoryBtn.onclick = async () => {
    const isHistory = historyArea.style.display === 'block';
    historyArea.style.display = isHistory ? 'none' : 'block';
    editorArea.style.display = isHistory ? 'block' : 'none';
    if (!isHistory) {
        const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/commits?path=${currentDataset}`, {
            headers: { 'Authorization': `token ${githubToken}` }
        });
        const commits = await res.json();
        historyList.innerHTML = commits.map(c => `
            <div class="card history-card p-2 mb-2">
                <div class="fw-bold">${c.commit.author.name}</div>
                <div class="small">${c.commit.message}</div>
                <div class="text-muted" style="font-size:0.7rem">${new Date(c.commit.author.date).toLocaleString()}</div>
            </div>
        `).join('');
    }
};

searchInput.oninput = renderTags;
