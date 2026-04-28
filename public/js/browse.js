function signalBars(rating) {
    const filled = Math.round(rating / 20); // 0–5 bars
    const heights = [0.3, 0.45, 0.62, 0.8, 1.0];
    const W = 15, H = 10, bW = 2, gap = 1;
    const rects = heights.map((ratio, i) => {
        const bH = Math.round(H * ratio);
        const x = i * (bW + gap);
        const y = H - bH;
        const fill = i < filled ? 'var(--accent)' : 'rgba(255,255,255,0.15)';
        return `<rect x="${x}" y="${y}" width="${bW}" height="${bH}" rx="0.5" fill="${fill}"/>`;
    }).join('');
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="signal-svg" aria-hidden="true">${rects}</svg>`;
}

// Map genre slugs to IGDB genre IDs
const GENRE_MAP = {
    'adventure': 31, 'arcade': 33, 'card-board-game': 35, 'fighting': 4,
    'hack-slash': 25, 'indie': 32, 'music': 7, 'platform': 8,
    'point-and-click': 2, 'puzzle': 9, 'quiz-trivia': 26, 'racing': 10,
    'real-time-strategy-rts': 11, 'role-playing-rpg': 12, 'shooter': 5,
    'simulator': 13, 'sport': 14, 'strategy': 15, 'tactical': 24,
    'turn-based-strategy-tbs': 16
};

const DISPLAY_NAMES = {
    'card-board-game': 'Card & Board Game',
    'hack-slash': 'Hack and Slash',
    'point-and-click': 'Point-and-click',
    'quiz-trivia': 'Quiz/Trivia',
    'real-time-strategy-rts': 'Real Time Strategy',
    'role-playing-rpg': 'RPG',
    'turn-based-strategy-tbs': 'Turn-based Strategy'
};

// Pagination state
let currentPage = 1;
const gamesPerPage = 42;
let totalPages = 1;
let totalResultCount = 0;

let allLoadedCards = []; // {el, year, rating}

async function fetchFilteredGames(sortBy = 'rating', page = 1) {
    const gameGrid = document.getElementById('game-grid');
    const titleEl = document.getElementById('browse-title');
    if (!gameGrid) return;

    currentPage = page;

    const params = new URLSearchParams(window.location.search);
    const genreSlugs = params.get('genre') ? params.get('genre').split(',') : [];
    const platformSlug = params.get('platform');
    const yearParam = params.get('year');
    const minRating = params.get('minRating') ? parseFloat(params.get('minRating')) : null;

    const genreIds = genreSlugs.map(s => GENRE_MAP[s]).filter(Boolean);

    const displayParts = [];
    if (genreSlugs.length) displayParts.push(genreSlugs.map(s => DISPLAY_NAMES[s] || s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', '));
    if (platformSlug) displayParts.push(params.get('name') || platformSlug);
    if (yearParam) displayParts.push(yearParam);
    if (titleEl) titleEl.textContent = displayParts.length ? displayParts.join(' · ') + ' Games' : 'All Games';

    gameGrid.innerHTML = '';
    allLoadedCards = [];

    try {
        const response = await fetch('/api/browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                genre: genreIds.length ? genreIds.join(',') : null,
                platform: platformSlug || null,
                year: yearParam || null,
                sortBy, page, limit: gamesPerPage, minRating
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const games = (data.games || data).filter(g => g.slug);
        if (data.totalPages) totalPages = data.totalPages;
        if (data.resultCount) totalResultCount = data.resultCount;
        if (data.error) throw new Error(data.error);
        if (!Array.isArray(games)) { gameGrid.innerHTML = '<p class="grid-empty">Invalid response from server.</p>'; return; }

        // If this page came back empty, we've gone past the real end
        if (games.length === 0) {
            totalPages = Math.max(1, page - 1);
            currentPage = totalPages;
            updatePagination();
            updateResultsCount();
            if (page === 1) gameGrid.innerHTML = '<p class="grid-empty">No games found.</p>';
            else fetchFilteredGames(sortBy, currentPage);
            return;
        }

        // Fewer results than a full page means this is the last page
        if (games.length < gamesPerPage) {
            totalPages = page;
        }

        const seen = new Set();
        let cardIndex = (page - 1) * gamesPerPage;
        games.forEach(game => {
            if (seen.has(game.slug)) return;
            seen.add(game.slug);
            cardIndex++;

            const year = game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : 0;
            const rating = game.rating || 0;
            const genre = game.genres?.[0]?.name || '';
            const coverUrl = game.cover?.image_id
                ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
                : null;
            const scoreDisplay = rating ? (rating / 20).toFixed(1) : null;

            const link = document.createElement('a');
            link.href = `/games/${game.slug}`;
            link.className = 'game-card';
            link.dataset.year = year;
            link.dataset.rating = rating;

            const cover = document.createElement('div');
            cover.className = 'cover' + (coverUrl ? '' : ' cover--no-image');
            if (coverUrl) {
                const img = document.createElement('img');
                img.src = coverUrl;
                img.alt = game.name;
                cover.appendChild(img);
            }

            const rankBadge = document.createElement('span');
            rankBadge.className = 'rank';
            rankBadge.textContent = String(cardIndex).padStart(2, '0');
            cover.appendChild(rankBadge);

            const meta = document.createElement('div');
            meta.className = 'meta';

            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = game.name;

            const ratingRow = document.createElement('div');
            ratingRow.className = 'card-rating-row';
            if (scoreDisplay) {
                ratingRow.innerHTML = `${signalBars(rating)}<span class="card-score">${scoreDisplay}</span>`;
            }

            const sub = document.createElement('div');
            sub.className = 'sub';
            sub.textContent = [genre, year || ''].filter(Boolean).join(' · ');

            meta.appendChild(title);
            if (scoreDisplay) meta.appendChild(ratingRow);
            meta.appendChild(sub);
            link.appendChild(cover);
            link.appendChild(meta);
            gameGrid.appendChild(link);

            allLoadedCards.push({ el: link, year, rating });
        });

        applyClientFilters();
        updateResultsCount();
        updatePagination();

    } catch (error) {
        console.error('Browse error:', error);
        gameGrid.innerHTML = '<p class="grid-empty">Error loading games.</p>';
    }
}

function applyClientFilters() {
    allLoadedCards.forEach(({ el }) => { el.style.display = ''; });
    updateResultsCount();
}

function updateResultsCount() {
    const countEl = document.getElementById('results-count');
    if (!countEl) return;
    const visible = allLoadedCards.filter(c => c.el.style.display !== 'none').length;
    const total = totalResultCount || totalPages * gamesPerPage;
    const from = (currentPage - 1) * gamesPerPage + 1;
    const to = Math.min(currentPage * gamesPerPage, total);
    const approx = totalResultCount ? '' : '~';
    countEl.innerHTML = `Showing <span class="num">${from}–${to}</span> of <span class="num">${approx}${total}</span> games`;
}

function slugify(name) {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ─── Sidebar filter wiring ────────────────────────────────────────────────────
function initSidebarFilters() {
    const params = new URLSearchParams(window.location.search);
    const activeGenre = params.get('genre');
    const activePlatform = params.get('platform');

    // Genre labels (multi-select)
    const activeGenres = params.get('genre') ? params.get('genre').split(',') : [];
    document.querySelectorAll('.filter-list label[data-genre]').forEach(label => {
        const genre = label.dataset.genre;
        if (activeGenres.includes(genre)) label.classList.add('checked');

        label.addEventListener('click', () => {
            const p = new URLSearchParams(window.location.search);
            const current = p.get('genre') ? p.get('genre').split(',') : [];
            const updated = label.classList.contains('checked')
                ? current.filter(g => g !== genre)
                : [...current, genre];
            if (updated.length) p.set('genre', updated.join(','));
            else p.delete('genre');
            p.delete('page');
            window.location.href = '/browse.html' + (p.toString() ? '?' + p.toString() : '');
        });
    });

    // Platform labels
    document.querySelectorAll('.filter-list label[data-platform]').forEach(label => {
        const platform = label.dataset.platform;
        const platformName = label.dataset.platformName || platform;
        if (platform === activePlatform) label.classList.add('checked');

        label.addEventListener('click', () => {
            const p = new URLSearchParams(window.location.search);
            if (label.classList.contains('checked')) { p.delete('platform'); p.delete('name'); }
            else { p.set('platform', platform); p.set('name', platformName); }
            p.delete('page');
            window.location.href = '/browse.html' + (p.toString() ? '?' + p.toString() : '');
        });
    });

    // Year labels
    const activeYear = params.get('year');
    document.querySelectorAll('#year-filters label[data-year]').forEach(label => {
        const year = label.dataset.year;
        if (year === activeYear) label.classList.add('checked');
        label.addEventListener('click', () => {
            const p = new URLSearchParams(window.location.search);
            if (label.classList.contains('checked')) { p.delete('year'); } else { p.set('year', year); }
            p.delete('page');
            window.location.href = '/browse.html' + (p.toString() ? '?' + p.toString() : '');
        });
    });

    // Custom year input
    const yearInput = document.getElementById('year-custom-input');
    if (yearInput) {
        if (activeYear) yearInput.value = activeYear;
        yearInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = yearInput.value.trim();
                if (val.length === 4 && !isNaN(val)) {
                    const p = new URLSearchParams(window.location.search);
                    p.set('year', val);
                    p.delete('page');
                    window.location.href = '/browse.html' + '?' + p.toString();
                }
            }
        });
    }

    // Rating labels (server-side navigation, stacks with other filters)
    const activeMinRating = params.get('minRating');
    document.querySelectorAll('#rating-filters label[data-min-rating]').forEach(label => {
        const val = label.dataset.minRating;
        if (val === activeMinRating) label.classList.add('checked');
        label.addEventListener('click', () => {
            const p = new URLSearchParams(window.location.search);
            if (label.classList.contains('checked')) {
                p.delete('minRating');
            } else {
                p.set('minRating', val);
            }
            p.delete('page');
            window.location.href = '/browse.html' + (p.toString() ? '?' + p.toString() : '');
        });
    });

}

// ─── Sidebar platform list ────────────────────────────────────────────────────
let sidebarPlatforms = [];

function renderSidebarPlatforms(platforms) {
    const list = document.getElementById('sidebar-platform-list');
    if (!list) return;
    list.innerHTML = '';
    const params = new URLSearchParams(window.location.search);
    const activePlatform = params.get('platform');
    platforms.forEach(p => {
        const li = document.createElement('li');
        const label = document.createElement('label');
        label.dataset.platform = p.slug;
        label.dataset.platformName = p.name;
        if (p.slug === activePlatform) label.classList.add('checked');
        const check = document.createElement('span');
        check.className = 'check';
        label.appendChild(check);
        label.appendChild(document.createTextNode(p.name));
        label.addEventListener('click', () => {
            const qs = new URLSearchParams(window.location.search);
            if (label.classList.contains('checked')) { qs.delete('platform'); qs.delete('name'); }
            else { qs.set('platform', p.slug); qs.set('name', p.name); }
            qs.delete('page');
            window.location.href = '/browse.html' + (qs.toString() ? '?' + qs.toString() : '');
        });
        li.appendChild(label);
        list.appendChild(li);
    });
}

async function loadSidebarPlatforms() {
    try {
        const response = await fetch('/api/platforms', { method: 'POST' });
        sidebarPlatforms = await response.json();
        renderSidebarPlatforms(sidebarPlatforms);
    } catch (e) { console.error('Sidebar platforms error:', e); }
}

const sidebarPlatformInput = document.getElementById('sidebar-platform-input');
if (sidebarPlatformInput) {
    sidebarPlatformInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = q ? sidebarPlatforms.filter(p => p.name.toLowerCase().includes(q)).sort((a, b) => {
            const aS = a.name.toLowerCase().startsWith(q), bS = b.name.toLowerCase().startsWith(q);
            return aS === bS ? 0 : aS ? -1 : 1;
        }) : sidebarPlatforms;
        renderSidebarPlatforms(filtered);
    });
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function makePaginationBtn(label, page, isActive = false, isDisabled = false) {
    const btn = document.createElement('button');
    btn.className = 'page-number' + (isActive ? ' active' : '') + (isDisabled ? ' disabled' : '');
    btn.textContent = label;
    btn.disabled = isDisabled;
    if (!isDisabled) {
        btn.addEventListener('click', () => {
            fetchFilteredGames(getSortValue(), page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    return btn;
}

function updatePagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageNumbers = document.getElementById('page-numbers');
    if (!prevBtn || !nextBtn || !pageNumbers) return;

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;

    pageNumbers.innerHTML = '';
    if (totalPages <= 1) return;

    const window_size = 2;
    const pages = new Set([1, totalPages]);
    for (let i = Math.max(1, currentPage - window_size); i <= Math.min(totalPages, currentPage + window_size); i++) {
        pages.add(i);
    }

    const sorted = [...pages].sort((a, b) => a - b);
    let prev = 0;
    sorted.forEach(p => {
        if (p - prev > 2) {
            pageNumbers.appendChild(makePageJumper());
        } else if (p - prev === 2) {
            pageNumbers.appendChild(makePaginationBtn(prev + 1, prev + 1, prev + 1 === currentPage));
        }
        pageNumbers.appendChild(makePaginationBtn(p, p, p === currentPage));
        prev = p;
    });
}

function makePageJumper() {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'page-jumper';
    input.placeholder = '…';
    input.min = 1;
    input.max = totalPages;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = Math.min(totalPages, Math.max(1, parseInt(input.value)));
            if (!isNaN(val)) {
                fetchFilteredGames(getSortValue(), val);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });
    return input;
}

function getSortValue() {
    const text = document.getElementById('current-sort')?.textContent || 'Highest Rated';
    return { 'Highest Rated': 'rating', 'Most Popular': 'rating_count', 'Newest First': 'release_date', 'Trending': 'trending' }[text] || 'rating';
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────
function initSortDropdown() {
    const sortMenu = document.querySelector('.sort-menu');
    const sortBtn = document.querySelector('.section-actions .sort-trigger');
    const currentSortEl = document.getElementById('current-sort');
    if (!sortMenu || !sortBtn) return;

    sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = sortBtn.getBoundingClientRect();
        sortMenu.style.top = (rect.bottom + 6) + 'px';
        sortMenu.style.left = rect.left + 'px';
        sortMenu.style.display = sortMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (!sortBtn.contains(e.target) && !sortMenu.contains(e.target)) {
            sortMenu.style.display = 'none';
        }
    });

    document.querySelectorAll('.sort-list a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentSortEl) currentSortEl.textContent = link.textContent;
            sortMenu.style.display = 'none';
            currentPage = 1;
            fetchFilteredGames(link.dataset.sort, 1);
        });
    });
}

// ─── Platforms dropdown (nav header) ─────────────────────────────────────────
let allPlatforms = [];

async function loadMorePlatforms() {
    const list = document.querySelector('.all-platforms-list');
    if (!list) return;
    try {
        const response = await fetch('/api/platforms', { method: 'POST' });
        allPlatforms = await response.json();
        renderPlatformList(allPlatforms);
    } catch (e) { console.error('Platforms error:', e); }
}

function renderPlatformList(platforms) {
    const list = document.querySelector('.all-platforms-list');
    if (!list) return;
    if (platforms.length === 0) { list.innerHTML = '<li class="no-results">No platforms found</li>'; return; }
    list.innerHTML = '';
    platforms.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="/browse.html?platform=${p.slug}&name=${encodeURIComponent(p.name)}">${p.name}</a>`;
        list.appendChild(li);
    });
}

const platformSearchInput = document.getElementById('platform-search-input');
if (platformSearchInput) {
    platformSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = q ? allPlatforms.filter(p => p.name.toLowerCase().includes(q)).sort((a, b) => {
            const aS = a.name.toLowerCase().startsWith(q), bS = b.name.toLowerCase().startsWith(q);
            return aS === bS ? 0 : aS ? -1 : 1;
        }) : allPlatforms;
        renderPlatformList(filtered);
    });
}

const platformsDetail = document.querySelector('.platforms-detail');
function clearAllPanels() {
    document.querySelectorAll('[data-for]').forEach(el => el.classList.remove('active'));
}

document.querySelectorAll('.platform-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        document.querySelectorAll('.platform-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        clearAllPanels();
        const platform = item.dataset.platform;
        if (!platform) { if (platformsDetail) platformsDetail.style.display = 'none'; return; }
        if (platformsDetail) platformsDetail.style.display = 'block';
        const models = document.querySelector(`[data-for="${platform}"]`);
        if (models) models.classList.add('active');
    });
});

// ─── Nav search ───────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-search-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = input.value.trim();
            if (q) window.location.href = `/search.html?q=${encodeURIComponent(q)}`;
        }
    });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    fetchFilteredGames();
    loadMorePlatforms();
    loadSidebarPlatforms();
    initSidebarFilters();
    initSortDropdown();

    document.getElementById('prev-btn')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; fetchFilteredGames(getSortValue(), currentPage); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('next-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) { currentPage++; fetchFilteredGames(getSortValue(), currentPage); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
});
