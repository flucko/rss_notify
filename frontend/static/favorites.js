document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('darkModeBtn').addEventListener('click', toggleDarkMode);
    loadCompanies();
});

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('rss-dark', String(isDark));
}

async function loadCompanies() {
    try {
        const res = await fetch('/api/companies?all_favorites=true');
        const companies = await res.json();
        renderCompanies(companies);
    } catch (e) {
        console.error("Error loading companies", e);
        document.getElementById('companiesContainer').innerHTML =
            '<div class="card"><p class="text-sm text-center py-6" style="color:var(--color-text-muted)">Failed to load companies.</p></div>';
    }
}

function renderCompanies(companies) {
    const container = document.getElementById('companiesContainer');

    if (companies.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p class="text-sm text-center py-8" style="color:var(--color-text-muted)">
                    No companies found in recent feed data.<br>
                    Run a feed check from the <a href="/" style="color:var(--color-accent)">main page</a> to populate entries.
                </p>
            </div>`;
        return;
    }

    const favorites = companies.filter(c => c.is_favorite);
    const others = companies.filter(c => !c.is_favorite);

    let html = '';

    if (favorites.length > 0) {
        html += `
            <div class="card" style="margin-bottom:0">
                <div class="flex items-center gap-2 mb-3 pb-2" style="border-bottom:1px solid var(--color-border)">
                    <i class="fa-solid fa-star text-amber-400 text-sm"></i>
                    <span class="text-sm font-semibold" style="color:var(--color-text-muted)">YOUR FAVORITES</span>
                    <span class="text-xs px-1.5 py-0.5 rounded-full font-semibold" style="background:var(--color-accent-bg);color:var(--color-accent)">${favorites.length}</span>
                </div>
                <div class="flex flex-col">
                    ${favorites.map(renderCompanyRow).join('')}
                </div>
            </div>`;
    }

    if (others.length > 0) {
        html += `
            <div class="card" style="margin-bottom:0">
                <div class="flex items-center gap-2 mb-3 pb-2" style="border-bottom:1px solid var(--color-border)">
                    <i class="fa-regular fa-building text-sm" style="color:var(--color-text-faint)"></i>
                    <span class="text-sm font-semibold" style="color:var(--color-text-muted)">ALL COMPANIES</span>
                    <span class="text-xs" style="color:var(--color-text-faint)">from the last 7 days</span>
                </div>
                <div class="flex flex-col">
                    ${others.map(renderCompanyRow).join('')}
                </div>
            </div>`;
    }

    container.innerHTML = `<div class="flex flex-col gap-4">${html}</div>`;
}

function renderCompanyRow(c) {
    const btnClass = c.is_favorite ? 'fav-btn lit' : 'fav-btn';
    const btnLabel = c.is_favorite
        ? '<i class="fa-solid fa-star text-xs"></i> Favorited'
        : '<i class="fa-regular fa-star text-xs"></i> Add';
    const safeName = c.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `
        <div class="company-row" id="row-${CSS.escape(c.name)}">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    <span class="font-medium text-sm">${c.name}</span>
                    <span class="text-xs" style="color:var(--color-text-faint)">${c.count} ${c.count === 1 ? 'entry' : 'entries'}</span>
                </div>
                <button class="${btnClass}" onclick="toggleFavorite('${safeName}')">${btnLabel}</button>
            </div>
        </div>`;
}

async function toggleFavorite(name) {
    try {
        const res = await fetch(`/api/companies/${encodeURIComponent(name)}/favorite`, { method: 'POST' });
        const data = await res.json();
        // Reload to re-sort into correct section
        loadCompanies();
    } catch (e) {
        console.error("Error toggling favorite", e);
    }
}
