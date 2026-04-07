// GitHub Configuration
let githubUser = "nauni84-pixel";
let githubRepo = "MasterSlides";
let githubToken = "";
let dataSha = null;
let lockSha = null;

let allRules = [];
let locks = {};
let selectedRuleId = null;
let currentUser = "";

// DOM Elements
const tagList = document.getElementById('tagList');
const searchInput = document.getElementById('searchInput');
const editorArea = document.getElementById('editorArea');
const historyArea = document.getElementById('historyArea');
const historyList = document.getElementById('historyList');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const tokenModal = document.getElementById('tokenModal');

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
        document.getElementById('currentUserDisplay').innerText = currentUser;

        await refreshData();
        setInterval(refreshData, 30000);
    } catch (e) {
        alert("GitHub Auth Failed: " + e.message);
        tokenModal.style.display = 'flex';
    }
}

async function refreshData() {
    try {
        const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/data.json`, {
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
    } catch (e) {
        console.error("Sync error:", e);
    }
}

function renderTags() {
    const filter = searchInput.value.toLowerCase();
    tagList.innerHTML = allRules
        .filter(r => r.iso20022XmlTag.toLowerCase().includes(filter))
        .map(rule => `
            <div class="tag-item ${rule.id === selectedRuleId ? 'active' : ''}" onclick="selectTag('${rule.id}')">
                <div class="fw-bold">${rule.iso20022XmlTag}</div>
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
                            `<button onclick="saveChanges()" class="btn btn-success btn-sm">Commit Changes</button>
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

    await updateFile('data.json', JSON.stringify(allRules, null, 2), dataSha, `Update rule for ${rule.iso20022XmlTag}`);
    await updateFile('lock.json', JSON.stringify(locks), lockSha, "Releasing lock");

    alert("Changes committed to GitHub!");
    await refreshData();
}

async function updateFile(path, content, sha, message) {
    const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${path}`, {
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
    return res;
}

viewHistoryBtn.onclick = async () => {
    const isHistory = historyArea.style.display === 'block';
    historyArea.style.display = isHistory ? 'none' : 'block';
    editorArea.style.display = isHistory ? 'block' : 'none';

    if (!isHistory) {
        const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/commits`, {
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
