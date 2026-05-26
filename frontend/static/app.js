document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadFeeds();
    loadEntries();

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
        container.innerHTML = '<p class="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No feeds added yet.</p>';
        return;
    }

    feeds.forEach(feed => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4';

        const keywordsHTML = feed.keywords.map(kw => `
            <span class="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-700">
                ${kw.word}
                <i class="fa-solid fa-xmark cursor-pointer opacity-60 hover:opacity-100 hover:text-red-500 transition-colors" onclick="deleteKeyword(${kw.id})"></i>
            </span>
        `).join('');

        const filterSelectHTML = `
            <select onchange="updateFeedFilter(${feed.id}, this.value)"
                    class="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 outline-none focus:border-blue-600 transition-colors">
                <option value="title" ${feed.filter_target === 'title' ? 'selected' : ''}>Title only</option>
                <option value="description" ${feed.filter_target === 'description' ? 'selected' : ''}>Description only</option>
                <option value="both" ${feed.filter_target === 'both' ? 'selected' : ''}>Title &amp; Description</option>
            </select>
        `;

        div.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="font-semibold text-gray-900 dark:text-slate-100 mb-0.5">${feed.name}</h3>
                    <p class="text-xs text-gray-500 dark:text-slate-400">
                        <a href="${feed.url}" target="_blank" class="text-blue-600 hover:underline">${feed.url}</a>
                    </p>
                </div>
                <button onclick="deleteFeed(${feed.id})" title="Delete feed"
                        class="text-xs text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2.5 py-1 transition-colors">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="border-t border-gray-200 dark:border-slate-700 pt-3">
                <div class="flex items-center gap-2 mb-2.5 flex-wrap">
                    <span class="text-xs text-gray-600 dark:text-slate-400 font-medium">Trigger words to exact match within the feed's</span>
                    ${filterSelectHTML}
                </div>
                <form class="flex gap-2 mb-2.5" onsubmit="handleAddKeyword(event, ${feed.id})">
                    <input type="text" id="kwInput-${feed.id}" placeholder="New trigger word..." required
                           class="input-field flex-1 py-1.5">
                    <button type="submit"
                            class="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </form>
                <div class="flex flex-wrap gap-1.5">
                    ${keywordsHTML || '<span class="text-xs text-gray-400 dark:text-slate-500">No trigger words yet.</span>'}
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
                html = '<p class="text-gray-500 dark:text-slate-400">No feeds registered for preview.</p>';
            } else {
                data.previews.forEach(p => {
                    html += `<h3 class="font-semibold text-gray-900 dark:text-slate-100 mt-4 first:mt-0 mb-2">${p.feed_name}</h3>`;
                    if (p.entries.length === 0) {
                        html += '<p class="text-gray-500 dark:text-slate-400 text-sm">No entries found.</p>';
                    } else {
                        html += `<ul class="flex flex-col gap-2 mb-3">`;
                        p.entries.forEach(e => {
                            html += `
                                <li class="border-b border-gray-100 dark:border-slate-700 pb-2">
                                    <strong class="text-gray-700 dark:text-slate-300">Title:</strong>
                                    <a href="${e.url}" target="_blank" class="text-blue-600 hover:underline ml-1">${e.title}</a><br>
                                    <strong class="text-gray-700 dark:text-slate-300">Description:</strong>
                                    <span class="text-xs text-gray-600 dark:text-slate-400 ml-1">${e.description ? e.description.substring(0, 500) + (e.description.length > 500 ? '...' : '') : '<i>No description</i>'}</span>
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
        loadEntries();
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
        const entries = await res.json();
        renderEntries(entries);
    } catch (e) {
        console.error("Error loading entries", e);
    }
}

function renderEntries(entries) {
    const container = document.getElementById('entriesContainer');
    const countBadge = document.getElementById('entriesCount');
    container.innerHTML = '';

    if (entries.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No entries yet — run a feed check to populate.</p>';
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
            html += `<div class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide pt-3 pb-1 border-b border-gray-100 dark:border-slate-700">${dateLabel}</div>`;
            lastDate = dateLabel;
        }

        const timeStr = date ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
        const alertedClass = item.alerted
            ? 'border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10'
            : '';
        const alertBadge = item.alerted
            ? `<span class="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">
                   <i class="fa-solid fa-bell"></i> ${item.keyword}
               </span>`
            : '';

        html += `
            <div class="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 transition-colors ${alertedClass}">
                <div class="text-xs text-gray-400 dark:text-slate-500 mb-1 flex items-center gap-1.5 flex-wrap">
                    <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                    <span>&bull;</span>
                    <span>${item.feed_name}</span>
                    ${alertBadge}
                </div>
                <div class="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    <a href="${item.url}" target="_blank" class="hover:text-blue-600 transition-colors">${item.title || item.url}</a>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}
