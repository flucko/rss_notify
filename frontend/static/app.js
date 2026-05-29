let allEntries = [];
let allCompanies = [];
let activeCompany = null;
let feedMode = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    loadSettings();
    loadFeeds();
    loadEntries();
    loadCompanies();

    document.getElementById('darkModeBtn').addEventListener('click', toggleDarkMode);
    document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);
    document.getElementById('addFeedForm').addEventListener('submit', handleAddFeed);
    document.getElementById('checkNowBtn').addEventListener('click', triggerCheckFeeds);
    document.getElementById('testPushoverBtn').addEventListener('click', testPushover);

    // Settings modal
    document.getElementById('settingsBtn').addEventListener('click', () =>
        document.getElementById('settingsModal').classList.add('active'));
    document.getElementById('closeSettingsBtn').addEventListener('click', () =>
        document.getElementById('settingsModal').classList.remove('active'));

    // Feeds modal
    document.getElementById('feedsBtn').addEventListener('click', () =>
        document.getElementById('feedsModal').classList.add('active'));
    document.getElementById('closeFeedsBtn').addEventListener('click', () =>
        document.getElementById('feedsModal').classList.remove('active'));

    // Close any modal on backdrop click
    ['settingsModal', 'feedsModal', 'previewModal'].forEach(id => {
        document.getElementById(id).addEventListener('click', (e) => {
            if (e.target.id === id) document.getElementById(id).classList.remove('active');
        });
    });
});

function initDarkMode() {
    // Icon visibility is handled by CSS .dark-sun / .dark-moon classes
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('rss-dark', String(isDark));
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        document.getElementById('pushoverToken').value = settings.pushover_token || '';
        document.getElementById('pushoverUserKey').value = settings.pushover_user_key || '';
        document.getElementById('checkFrequency').value = settings.check_frequency_minutes || 5;
    } catch (e) {
        console.error("Error loading settings", e);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const token = document.getElementById('pushoverToken').value;
    const userKey = document.getElementById('pushoverUserKey').value;
    const frequency = parseInt(document.getElementById('checkFrequency').value, 10);

    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                pushover_token: token,
                pushover_user_key: userKey,
                check_frequency_minutes: frequency
            })
        });
        showMsg('settingsMsg', 'Settings saved!', 'success');
    } catch (e) {
        console.error("Error saving settings", e);
    }
}

async function testPushover() {
    const btn = document.getElementById('testPushoverBtn');
    await handleSaveSettings(new Event('submit', {cancelable: true}));

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/test-pushover', { method: 'POST' });
        if (res.ok) {
            showMsg('settingsMsg', 'Test notification sent!', 'success');
        } else {
            const err = await res.json();
            showMsg('settingsMsg', `Error: ${err.detail || 'Failed to send test'}`, 'error');
        }
    } catch (e) {
        showMsg('settingsMsg', 'Failed to communicate with server.', 'error');
        console.error(e);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

function showMsg(id, text, type) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = type === 'success'
        ? 'mt-3 text-sm text-center text-green-600'
        : 'mt-3 text-sm text-center text-red-600';
    setTimeout(() => { el.textContent = ''; el.className = 'mt-3 text-sm text-center'; }, 4000);
}

async function loadFeeds() {
    try {
        const res = await fetch('/api/feeds');
        const feeds = await res.json();
        renderFeeds(feeds);
    } catch (e) {
        console.error("Error loading feeds", e);
    }
}

function renderFeeds(feeds) {
    const container = document.getElementById('feedsContainer');
    container.innerHTML = '';

    if (feeds.length === 0) {
        container.innerHTML = '<p class="text-sm text-center py-8" style="color:var(--color-text-muted)">No feeds added yet.</p>';
        return;
    }

    feeds.forEach(feed => {
        const div = document.createElement('div');
        div.className = 'card';

        const keywordsHTML = feed.keywords.map(kw => `
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style="background:var(--color-accent-bg);color:var(--color-accent);border:1px solid var(--color-accent-ring)">
                ${kw.word}
                <i class="fa-solid fa-xmark cursor-pointer opacity-60 hover:opacity-100 hover:text-red-500 transition-colors" onclick="deleteKeyword(${kw.id})"></i>
            </span>
        `).join('');

        const filterSelectHTML = `
            <select onchange="updateFeedFilter(${feed.id}, this.value)"
                    class="input-field" style="width:auto;padding:0.25rem 0.5rem;font-size:0.75rem;">
                <option value="title" ${feed.filter_target === 'title' ? 'selected' : ''}>Title only</option>
                <option value="description" ${feed.filter_target === 'description' ? 'selected' : ''}>Description only</option>
                <option value="both" ${feed.filter_target === 'both' ? 'selected' : ''}>Title &amp; Description</option>
            </select>
        `;

        div.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="font-semibold mb-0.5">${feed.name}</h3>
                    <p class="text-xs" style="color:var(--color-text-muted)">
                        <a href="${feed.url}" target="_blank" class="text-blue-600 hover:underline">${feed.url}</a>
                    </p>
                </div>
                <button onclick="deleteFeed(${feed.id})" title="Delete feed" class="btn-danger btn-sm">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="pt-3" style="border-top:1px solid var(--color-border)">
                <div class="flex items-center gap-2 mb-2.5 flex-wrap">
                    <span class="text-xs font-medium" style="color:var(--color-text-muted)">Trigger words to exact match within the feed's</span>
                    ${filterSelectHTML}
                </div>
                <form class="flex gap-2 mb-2.5" onsubmit="handleAddKeyword(event, ${feed.id})">
                    <input type="text" id="kwInput-${feed.id}" placeholder="New trigger word..." required
                           class="input-field flex-1" style="padding:0.375rem 0.625rem">
                    <button type="submit"
                            class="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </form>
                <div class="flex flex-wrap gap-1.5">
                    ${keywordsHTML || '<span class="text-xs" style="color:var(--color-text-faint)">No trigger words yet.</span>'}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

async function handleAddFeed(e) {
    e.preventDefault();
    const name = document.getElementById('feedName').value;
    const url = document.getElementById('feedUrl').value;
    const filter_target = document.getElementById('feedFilterTarget').value;

    try {
        await fetch('/api/feeds', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, url, filter_target})
        });
        document.getElementById('addFeedForm').reset();
        loadFeeds();
    } catch (e) {
        console.error("Error adding feed", e);
    }
}

async function updateFeedFilter(id, value) {
    try {
        await fetch(`/api/feeds/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({filter_target: value})
        });
    } catch (e) {
        console.error("Error updating feed filter", e);
    }
}

async function deleteFeed(id) {
    if (!confirm('Are you sure you want to delete this feed?')) return;
    try {
        await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
        loadFeeds();
    } catch (e) {
        console.error("Error deleting feed", e);
    }
}

async function handleAddKeyword(e, feedId) {
    e.preventDefault();
    const input = document.getElementById(`kwInput-${feedId}`);
    const word = input.value;

    try {
        await fetch(`/api/feeds/${feedId}/keywords`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({word})
        });
        input.value = '';
        loadFeeds();
    } catch (e) {
        console.error("Error adding keyword", e);
    }
}

async function deleteKeyword(id) {
    try {
        await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
        loadFeeds();
    } catch (e) {
        console.error("Error deleting keyword", e);
    }
}

async function triggerCheckFeeds() {
    const btn = document.getElementById('checkNowBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/check', { method: 'POST' });
        const data = await res.json();

        if (data.previews) {
            let html = '';
            if (data.previews.length === 0) {
                html = '<p style="color:var(--color-text-muted)">No feeds registered for preview.</p>';
            } else {
                data.previews.forEach(p => {
                    html += `<h3 class="font-semibold mt-4 first:mt-0 mb-2">${p.feed_name}</h3>`;
                    if (p.entries.length === 0) {
                        html += '<p class="text-sm" style="color:var(--color-text-muted)">No entries found.</p>';
                    } else {
                        html += `<ul class="flex flex-col gap-2 mb-3">`;
                        p.entries.forEach(e => {
                            html += `
                                <li class="pb-2" style="border-bottom:1px solid var(--color-border-subtle)">
                                    <strong style="color:var(--color-text-sec)">Title:</strong>
                                    <a href="${e.url}" target="_blank" class="text-blue-600 hover:underline ml-1">${e.title}</a><br>
                                    <strong style="color:var(--color-text-sec)">Description:</strong>
                                    <span class="text-xs ml-1" style="color:var(--color-text-muted)">${e.description ? e.description.substring(0, 500) + (e.description.length > 500 ? '...' : '') : '<i>No description</i>'}</span>
                                </li>
                            `;
                        });
                        html += '</ul>';
                    }
                });
            }
            document.getElementById('previewContent').innerHTML = html;
            document.getElementById('previewModal').classList.add('active');
        }

        btn.innerHTML = '<i class="fa-solid fa-check text-sm"></i>';
        await loadEntries();
        await loadCompanies();
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }, 2000);
    } catch (e) {
        console.error("Error triggering check", e);
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

async function loadEntries() {
    try {
        const res = await fetch('/api/entries');
        allEntries = await res.json();
        applyFilters();
    } catch (e) {
        console.error("Error loading entries", e);
    }
}

async function loadCompanies() {
    try {
        const res = await fetch('/api/companies');
        allCompanies = await res.json();
        if (feedMode === 'favorites') renderFavoriteCompanyPills();
        applyFilters();
    } catch (e) {
        console.error("Error loading companies", e);
    }
}

function setFeedMode(mode) {
    feedMode = mode;
    activeCompany = null;
    document.getElementById('modeAll').classList.toggle('active', mode === 'all');
    document.getElementById('modeFavorites').classList.toggle('active', mode === 'favorites');
    const pillsEl = document.getElementById('favoriteCompanyPills');
    if (mode === 'favorites') {
        pillsEl.style.display = '';
        renderFavoriteCompanyPills();
    } else {
        pillsEl.style.display = 'none';
    }
    applyFilters();
}

function setActiveCompany(name) {
    activeCompany = name;
    renderFavoriteCompanyPills();
    applyFilters();
}

function applyFilters() {
    let filtered = allEntries;
    if (feedMode === 'favorites') {
        const favNames = new Set(allCompanies.filter(c => c.is_favorite).map(c => c.name));
        filtered = allEntries.filter(e => favNames.has(e.company));
        if (activeCompany) filtered = filtered.filter(e => e.company === activeCompany);
    }
    renderEntries(filtered);
}

function renderFavoriteCompanyPills() {
    const container = document.getElementById('favoriteCompanyPills');
    const favs = allCompanies.filter(c => c.is_favorite);
    if (favs.length === 0) {
        container.innerHTML = `<span class="text-xs" style="color:var(--color-text-muted)">No favorites yet — <a href="/favorites" style="color:var(--color-accent)">add some</a></span>`;
        return;
    }
    const total = favs.reduce((s, c) => s + c.count, 0);
    const allPill = `<button class="company-pill${activeCompany === null ? ' active' : ''}" onclick="setActiveCompany(null)">All Favorites <span class="pill-count">${total}</span></button>`;
    const pills = favs.map(c =>
        `<button class="company-pill is-favorite${activeCompany === c.name ? ' active' : ''}" onclick="setActiveCompany('${c.name.replace(/'/g,"\\'")}')">
            ${c.name} <span class="pill-count">${c.count}</span>
        </button>`
    ).join('');
    container.innerHTML = allPill + pills;
}

function renderEntries(entries) {
    const container = document.getElementById('entriesContainer');
    const countBadge = document.getElementById('entriesCount');
    container.innerHTML = '';

    if (entries.length === 0) {
        const msg = feedMode === 'favorites'
            ? `No entries from your favorite companies in the last 7 days. <a href="/favorites" style="color:var(--color-accent)">Manage favorites</a>`
            : 'No entries yet — run a feed check to populate.';
        container.innerHTML = `<p class="text-sm text-center py-8" style="color:var(--color-text-muted)">${msg}</p>`;
        countBadge.textContent = '';
        return;
    }

    countBadge.textContent = entries.length;

    let html = '<div class="flex flex-col gap-2">';
    let lastDate = null;

    entries.forEach(item => {
        const date = item.published_at ? new Date(item.published_at) : null;
        const dateLabel = date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;

        if (dateLabel && dateLabel !== lastDate) {
            html += `<div class="text-xs font-semibold uppercase tracking-wide pt-3 pb-1" style="color:var(--color-text-faint);border-bottom:1px solid var(--color-border-subtle)">${dateLabel}</div>`;
            lastDate = dateLabel;
        }

        const timeStr = date ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
        const isFavCompany = item.company && allCompanies.some(c => c.name === item.company && c.is_favorite);
        const entryClasses = ['card', item.alerted ? 'entry-alerted' : (isFavCompany ? 'entry-favorite' : '')].filter(Boolean).join(' ');
        const alertBadge = item.alerted
            ? `<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">
                   <i class="fa-solid fa-bell"></i> ${item.keyword}
               </span>`
            : '';

        const companyBadge = item.company
            ? `<span class="text-xs px-1.5 py-0.5 rounded" style="background:var(--color-bg-subtle);color:var(--color-text-muted);border:1px solid var(--color-border)">[${item.company}]</span>`
            : '';

        html += `
            <div class="${entryClasses}">
                <div class="text-xs mb-1 flex items-center gap-1.5 flex-wrap" style="color:var(--color-text-faint)">
                    <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                    <span>&bull;</span>
                    <span>${item.feed_name}</span>
                    ${companyBadge}
                    ${alertBadge}
                </div>
                <div class="text-sm font-semibold">
                    <a href="${item.url}" target="_blank" class="hover:text-blue-600 transition-colors">${item.title || item.url}</a>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}
