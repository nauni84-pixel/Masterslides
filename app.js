// GitHub Configuration
let githubUser = "nauni84-pixel";
let githubRepo = "MasterSlides";
let githubToken = "";
let currentDataset = "";
let dataSha = null;
let lockSha = null;

let allRules = [];
let locks = {};
let selectedRuleId = null;
let currentUser = "";
let isAdmin = false;

const ADMIN_USER = "nauni84-pixel";

// DOM Elements
const getEl = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    const saveConfigBtn = getEl('saveConfigBtn');
    if (saveConfigBtn) {
        saveConfigBtn.onclick = () => {
            githubToken = getEl('githubToken').value;
            if (!githubToken) return alert("Token required");
            const tokenModal = getEl('tokenModal');
            if (tokenModal) tokenModal.style.display = 'none';
            initApp();
        };
    }
});

async function initApp() {
    try {
        const userRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${githubToken}` }
        });

        if (!userRes.ok) throw new Error("Authentication failed");

        const userData = await userRes.json();
        currentUser = userData.login;
        isAdmin = (currentUser === ADMIN_USER);

        const currentUserDisplay = getEl('currentUserDisplay');
        if (currentUserDisplay) currentUserDisplay.innerText = currentUser;

        const adminControlsHome = getEl('adminControlsHome');
        if (isAdmin && adminControlsHome) adminControlsHome.style.display = 'block';

        await loadHome();
        setInterval(refreshData, 30000);
    } catch (e) {
        alert("GitHub Auth Failed: " + e.message);
        const tokenModal = getEl('tokenModal');
        if (tokenModal) tokenModal.style.display = 'flex';
    }
}

async function loadHome() {
    const homePage = getEl('homePage');
    const mainApp = getEl('mainApp');
    const datasetSummary = getEl('datasetSummary');

    if (homePage) homePage.style.display = 'block';
    if (mainApp) mainApp.style.display = 'none';
    if (datasetSummary) datasetSummary.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>Syncing Hub...</p></div>';

    const timestamp = new Date().getTime();
    const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/?t=${timestamp}`, {
        headers: { 'Authorization': `token ${githubToken}` }
    });

    if (!res.ok) {
        if (datasetSummary) datasetSummary.innerHTML = `<div class="alert alert-danger">Error loading repository files.</div>`;
        return;
    }

    const files = await res.json();
    const datasets = files.filter(f => f.name.endsWith('.json') && f.name !== 'lock.json');

    const cardsHtml = await Promise.all(datasets.map(async (d) => {
        try {
            const commitRes = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/commits?path=${d.name}&per_page=1&t=${timestamp}`, {
                headers: { 'Authorization': `token ${githubToken}` }
            });
            const commits = await commitRes.json();
            const lastCommit = commits[0];
            const date = lastCommit ? new Date(lastCommit.commit.author.date).toLocaleDateString() : "New";
            const author = lastCommit ? lastCommit.commit.author.name : currentUser;

            // Extract version correctly from filename like _V1_0
            let versionStr = "1.0";
            if (d.name.includes('_V')) {
                const vPart = d.name.split('_V').pop().split('.json')[0];
                versionStr = vPart.replace('_', '.');
            }

            return `
                <div class="col-md-4 mb-4">
                    <div class="card h-100 dataset-card border-0 shadow-sm" onclick="openDataset('${d.name}')">
                        <div class="card-body">
                            <h5 class="card-title text-primary"><i class="fas fa-file-alt"></i> ${d.name.replace('.json', '')}</h5>
                            <p class="card-text small text-muted mb-1"><strong>Last Updated:</strong> ${date}</p>
                            <p class="card-text small text-muted mb-3"><strong>By:</strong> ${author}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="badge bg-light text-dark border">Version: ${versionStr}</span>
                                <i class="fas fa-chevron-right text-secondary"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) { return ""; }
    }));

    if (datasetSummary) datasetSummary.innerHTML = cardsHtml.join('') || '<div class="col-12 text-center text-muted">No datasets found. Import one to start.</div>';
}

function showHome() {
    loadHome();
}

async function openDataset(name) {
    currentDataset = name;
    const currentDatasetTitle = getEl('currentDatasetTitle');
    if (currentDatasetTitle) currentDatasetTitle.innerText = name.replace('.json', '');

    getEl('homePage').style.display = 'none';
    getEl('mainApp').style.display = 'flex';
    await refreshData();
}

async function refreshData() {
    if (!currentDataset) return;
    try {
        const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${currentDataset}?t=${new Date().getTime()}`, {
            headers: { 'Authorization': `token ${githubToken}` }
        });
        const data = await res.json();
        dataSha = data.sha;
        allRules = JSON.parse(atob(data.content));

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
    const filter = getEl('searchInput').value.toLowerCase();
    const tagList = getEl('tagList');
    if (tagList) {
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

    const editorArea = getEl('editorArea');
    if (editorArea) {
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
                                `<button onclick="saveChanges()" class="btn btn-success btn-sm">Commit Changes</button>
                                 <button onclick="toggleLock('${rule.id}', false)" class="btn btn-link btn-sm text-muted">Cancel</button>` :
                                `<button class="btn btn-secondary btn-sm" disabled>View Only</button>`)
                        }
                    </div>
                </div>
            </div>
        `;
    }
}

async function toggleLock(id, lock) {
    if (lock) locks[id] = currentUser;
    else delete locks[id];
    await updateFile('lock.json', JSON.stringify(locks), lockSha, lock ? "Locking tag" : "Unlocking tag");
    await refreshData();
}

function incrementVersion(filename) {
    // Correctly split filename to find _V suffix
    const parts = filename.split('_V');
    if (parts.length < 2) return filename.replace('.json', '') + "_V1_1.json";

    const base = parts[0];
    const versionPart = parts[1].replace('.json', '');
    const versionNums = versionPart.split('_');

    let major = parseInt(versionNums[0]);
    let minor = parseInt(versionNums[1]);

    // Safety check for NaN
    if (isNaN(major)) major = 1;
    if (isNaN(minor)) minor = 0;

    minor++;
    if (minor > 9) {
        minor = 0;
        major++;
    }

    return `${base}_V${major}_${minor}.json`;
}

async function saveChanges() {
    const rule = allRules.find(r => r.id === selectedRuleId);
    rule.stdInContentRules = getEl('stdIn').value;
    rule.stdOutContentRules = getEl('stdOut').value;
    delete locks[rule.id];

    const newDatasetName = incrementVersion(currentDataset);

    // 1. Create new version file
    await updateFile(newDatasetName, JSON.stringify(allRules, null, 2), null, `Update ${rule.iso20022XmlTag} - New Version`);

    // 2. Update locks
    await updateFile('lock.json', JSON.stringify(locks), lockSha, "Releasing lock");

    alert(`Changes saved! New version created: ${newDatasetName}`);
    showHome();
}

async function updateFile(path, content, sha, message) {
    const body = { message: message, content: btoa(content) };
    if (sha) body.sha = sha;

    return fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${path}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const excelImport = getEl('excelImport');
    if (excelImport) {
        excelImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            let fileName = file.name.replace(/\.[^/.]+$/, "");
            // Ensure first import uses _V1_0
            if (!fileName.includes('_V')) fileName += "_V1_0";
            fileName += ".json";

            const reader = new FileReader();
            reader.onload = async (evt) => {
                const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
                const newRules = json.slice(1).map((row, index) => ({
                    id: 'rule_' + index,
                    iso20022XmlTag: row[3] || "Unnamed Tag",
                    iso20022XmlPath: row[4] || "No Path",
                    stdInContentRules: row[8] || "",
                    stdOutContentRules: row[10] || ""
                })).filter(r => r.iso20022XmlTag !== "Unnamed Tag");

                const res = await updateFile(fileName, JSON.stringify(newRules, null, 2), null, "Import from Excel");
                if (res.ok) alert("Import successful!");
                else alert("Import failed - file might already exist.");
                loadHome();
            };
            reader.readAsBinaryString(file);
        });
    }

    getEl('viewHistoryBtn').onclick = async () => {
        getEl('historyArea').style.display = (getEl('historyArea').style.display === 'none') ? 'block' : 'none';
        getEl('editorArea').style.display = (getEl('historyArea').style.display === 'block') ? 'none' : 'block';
        if (getEl('historyArea').style.display === 'block') {
            getEl('historyList').innerHTML = '<div class="spinner-border spinner-border-sm"></div> Loading commits...';
            const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/commits?t=${new Date().getTime()}`, {
                headers: { 'Authorization': `token ${githubToken}` }
            });
            const commits = await res.json();
            getEl('historyList').innerHTML = commits.map(c => `
                <div class="card history-card p-2 mb-2 shadow-sm border-start border-primary border-4">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-dark"><i class="fas fa-user-edit"></i> ${c.commit.author.name}</span>
                        <span class="text-muted" style="font-size:0.75rem">${new Date(c.commit.author.date).toLocaleString()}</span>
                    </div>
                    <div class="mt-2 text-secondary small">${c.commit.message}</div>
                    <div class="mt-1 d-flex justify-content-between">
                        <span class="badge bg-light text-dark border">SHA: ${c.sha.substring(0,7)}</span>
                    </div>
                </div>
            `).join('');
        }
    };

    getEl('searchInput').oninput = renderTags;
});
