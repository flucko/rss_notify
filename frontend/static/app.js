document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadFeeds();
    loadEntries();

    document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);
    document.getElementById('addFeedForm').addEventListener('submit', handleAddFeed);
    document.getElementById('checkNowBtn').addEventListener('click', triggerCheckFeeds);
    document.getElementById('testPushoverBtn').addEventListener('click', testPushover);

    // Collapsible keyword setup panel
    document.getElementById('feedsPanelHeader').addEventListener('click', (e) => {
        if (e.target.closest('button') && !e.target.closest('#feedsToggleBtn')) return;
        const body = document.getElementById('feedsPanelBody');
        const btn = document.getElementById('feedsToggleBtn');
        const expanded = body.style.display !== 'none';
        body.style.display = expanded ? 'none' : 'block';
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.querySelector('i').className = expanded ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
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
        const msg = document.getElementById('settingsMsg');
        msg.textContent = "Settings saved!";
        msg.className = "msg success";
        setTimeout(() => msg.textContent = "", 3000);
    } catch (e) {
        console.error("Error saving settings", e);
    }
}

async function testPushover() {
    const btn = document.getElementById('testPushoverBtn');
    const msg = document.getElementById('settingsMsg');

    await handleSaveSettings(new Event('submit', {cancelable: true}));

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/test-pushover', { method: 'POST' });
        if (res.ok) {
            msg.textContent = "Test notification sent!";
            msg.className = "msg success";
        } else {
            const err = await res.json();
            msg.textContent = `Error: ${err.detail || 'Failed to send test'}`;
            msg.className = "msg danger";
        }
    } catch (e) {
        msg.textContent = "Failed to communicate with server.";
        msg.className = "msg danger";
        console.error(e);
    } finally {
        setTimeout(() => msg.textContent = "", 4000);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No feeds added yet.</p>';
        return;
    }

    feeds.forEach(feed => {
        const div = document.createElement('div');
        div.className = 'feed-item';

        let keywordsHTML = feed.keywords.map(kw => `
            <span class="keyword-tag">
                ${kw.word}
                <i class="fa-solid fa-xmark" onclick="deleteKeyword(${kw.id})"></i>
            </span>
        `).join('');

        let filterSelectHTML = `
            <select onchange="updateFeedFilter(${feed.id}, this.value)" style="width: auto; padding: 0.25rem 0.5rem; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: rgba(0,0,0,0.3); font-size: 0.85rem;">
                <option value="title" ${feed.filter_target === 'title' ? 'selected' : ''}>Title only</option>
                <option value="description" ${feed.filter_target === 'description' ? 'selected' : ''}>Description only</option>
                <option value="both" ${feed.filter_target === 'both' ? 'selected' : ''}>Title and Description</option>
            </select>
        `;

        div.innerHTML = `
            <div class="feed-header">
                <div class="feed-info">
                    <h3>${feed.name}</h3>
                    <p><a href="${feed.url}" target="_blank" style="color: var(--primary); text-decoration: none;">${feed.url}</a></p>
                </div>
                <button class="btn danger" onclick="deleteFeed(${feed.id})" title="Delete Feed"><i class="fa-solid fa-trash"></i></button>
            </div>

            <div class="keywords-section">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">Trigger words to exact match within the feed's</h4>
                    ${filterSelectHTML}
                </div>
                <form class="keyword-form" onsubmit="handleAddKeyword(event, ${feed.id})">
                    <input type="text" id="kwInput-${feed.id}" placeholder="New trigger word..." required>
                    <button type="submit" class="btn success"><i class="fa-solid fa-plus"></i></button>
                </form>
                <div class="keywords-list">
                    ${keywordsHTML || '<span style="font-size: 0.75rem; color: var(--text-secondary);">No trigger words yet. Add words to monitor this feed snippet.</span>'}
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
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/check', { method: 'POST' });
        const data = await res.json();

        if (data.previews) {
            let html = '';
            if (data.previews.length === 0) {
                html = '<p>No feeds registered for preview.</p>';
            } else {
                data.previews.forEach(p => {
                    html += `<h3>${p.feed_name}</h3>`;
                    if (p.entries.length === 0) {
                        html += '<p>No entries found.</p>';
                    } else {
                        html += `<ul style="list-style: none; padding: 0; margin-bottom: 1rem;">`;
                        p.entries.forEach(e => {
                            html += `
                                <li style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0.5rem 0;">
                                    <strong>Title:</strong> <a href="${e.url}" target="_blank" style="color: var(--primary);">${e.title}</a><br/>
                                    <strong>Description:</strong> <span style="font-size: 0.85em; opacity: 0.8;">${e.description ? e.description.substring(0, 500) + (e.description.length > 500 ? '...' : '') : '<i>No description</i>'}</span>
                                </li>
                            `;
                        });
                        html += `</ul>`;
                    }
                });
            }
            document.getElementById('previewContent').innerHTML = html;
            document.getElementById('previewModal').classList.add('active');
        }

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Check Complete';
        loadEntries();
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    } catch (e) {
        console.error("Error triggering check", e);
        btn.innerHTML = originalText;
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
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No entries yet — run a feed check to populate.</p>';
        countBadge.textContent = '';
        return;
    }

    countBadge.textContent = entries.length;

    let html = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
    let lastDate = null;

    entries.forEach(item => {
        const date = item.published_at ? new Date(item.published_at) : null;
        const dateLabel = date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;

        if (dateLabel && dateLabel !== lastDate) {
            html += `<div class="date-separator">${dateLabel}</div>`;
            lastDate = dateLabel;
        }

        const timeStr = date ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
        const alertedClass = item.alerted ? ' entry-alerted' : '';
        const alertBadge = item.alerted
            ? `<span class="alert-badge"><i class="fa-solid fa-bell"></i> ${item.keyword}</span>`
            : '';

        html += `
            <div class="feed-item${alertedClass}">
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                    <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                    <span style="color: var(--text-secondary);">&bull;</span>
                    <span style="color: var(--text-secondary);">${item.feed_name}</span>
                    ${alertBadge}
                </div>
                <div style="font-size: 1rem; font-weight: 600;">
                    <a href="${item.url}" target="_blank" style="color: var(--text-primary); text-decoration: none;">${item.title || item.url}</a>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}
