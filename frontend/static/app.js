document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadFeeds();

    // Event Listeners
    document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);
    document.getElementById('addFeedForm').addEventListener('submit', handleAddFeed);
    document.getElementById('checkNowBtn').addEventListener('click', triggerCheckFeeds);
});

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        document.getElementById('pushoverToken').value = settings.pushover_token || '';
        document.getElementById('pushoverUserKey').value = settings.pushover_user_key || '';
    } catch (e) {
        console.error("Error loading settings", e);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const token = document.getElementById('pushoverToken').value;
    const userKey = document.getElementById('pushoverUserKey').value;
    
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({pushover_token: token, pushover_user_key: userKey})
        });
        const msg = document.getElementById('settingsMsg');
        msg.textContent = "Settings saved!";
        msg.className = "msg success";
        setTimeout(() => msg.textContent = "", 3000);
    } catch (e) {
        console.error("Error saving settings", e);
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

        div.innerHTML = `
            <div class="feed-header">
                <div class="feed-info">
                    <h3>${feed.name}</h3>
                    <p><a href="${feed.url}" target="_blank" style="color: var(--primary); text-decoration: none;">${feed.url}</a></p>
                </div>
                <button class="btn danger" onclick="deleteFeed(${feed.id})" title="Delete Feed"><i class="fa-solid fa-trash"></i></button>
            </div>
            
            <div class="keywords-section">
                <h4>Keywords (Exact Match)</h4>
                <form class="keyword-form" onsubmit="handleAddKeyword(event, ${feed.id})">
                    <input type="text" id="kwInput-${feed.id}" placeholder="New keyword..." required>
                    <button type="submit" class="btn success"><i class="fa-solid fa-plus"></i></button>
                </form>
                <div class="keywords-list">
                    ${keywordsHTML || '<span style="font-size: 0.75rem; color: var(--text-secondary);">No keywords yet. Add exact words to trigger alerts.</span>'}
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
    
    try {
        await fetch('/api/feeds', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, url})
        });
        document.getElementById('addFeedForm').reset();
        loadFeeds();
    } catch (e) {
        console.error("Error adding feed", e);
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
        await fetch('/api/check', { method: 'POST' });
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Check Triggered';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        }, 500); 
    } catch (e) {
        console.error("Error triggering check", e);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
