async function fetchGameCovers() {
    const gameGrid = document.getElementById('game-grid');
    if (!gameGrid) return;
    try {
        const response = await fetch("/api/games", { method: 'POST' });
        const games = await response.json();
        
        games.forEach(game => {
            if (game.cover) {
                const imageId = game.cover.image_id;
                const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;

                const slug = game.slug || slugify(game.name);
                
                const link = document.createElement('a');
                link.href = `/games/${slug}`;
                link.classList.add('game-link');
                
                const gameCard = document.createElement('div');
                gameCard.className = 'game-card';
                
                const img = document.createElement('img');
                img.src = coverUrl;
                img.alt = game.name;
                
                gameCard.appendChild(img);
                link.appendChild(gameCard);
                gameGrid.appendChild(link);
            }
        });
    } catch (error) {
        console.error('Error fetching games:', error);
    }
}

// Store all platforms for filtering
let allPlatforms = [];

async function loadMorePlatforms() {
    const list = document.querySelector('.all-platforms-list');
    if (!list) return;

    try {
        const response = await fetch('/api/platforms', { method: 'POST' });
        allPlatforms = await response.json();
        renderPlatformList(allPlatforms);
    } catch (error) {
        console.error('Error fetching platforms:', error);
    }
}

function renderPlatformList(platforms) {
    const list = document.querySelector('.all-platforms-list');
    if (!list) return;

    if (platforms.length === 0) {
        list.innerHTML = '<li class="no-results">No platforms found</li>';
        return;
    }

    list.innerHTML = '';
    platforms.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="/browse.html?platform=${p.slug}&name=${encodeURIComponent(p.name)}">${p.name}</a>`;
        list.appendChild(li);
    });
}

// Clears all right panels - works on both ul and div elements
function clearAllPanels() {
    document.querySelectorAll('[data-for]').forEach(el => el.classList.remove('active'));
}

// Search filter for All Platforms panel
const platformSearchInput = document.getElementById('platform-search-input');
if (platformSearchInput) {
    platformSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = query
            ? allPlatforms
                .filter(p => p.name.toLowerCase().includes(query))
                .sort((a, b) => {
                    const aStarts = a.name.toLowerCase().startsWith(query);
                    const bStarts = b.name.toLowerCase().startsWith(query);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;
                    return 0;
                })
            : allPlatforms;
        renderPlatformList(filtered);
    });

    platformSearchInput.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
}

// Platform panel hover switching
const platformsDetail = document.querySelector('.platforms-detail');

document.querySelectorAll('.platform-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        const platform = item.dataset.platform;

        document.querySelectorAll('.platform-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        clearAllPanels();

        if (!platform) {
            if (platformsDetail) platformsDetail.style.display = 'none';
            return;
        }

        if (platformsDetail) platformsDetail.style.display = 'block';
        const models = document.querySelector(`[data-for="${platform}"]`);
        if (models) models.classList.add('active');
    });
});

// Delay-based show/hide
const platformsDropdown = document.querySelector('.platforms-dropdown');
const platformsMenu = document.querySelector('.platforms-menu');
let hideTimeout = null;

function showMenu() {
    clearTimeout(hideTimeout);
    const rect = platformsDropdown.getBoundingClientRect();
    platformsMenu.style.top = (rect.bottom + 6) + 'px';
    platformsMenu.style.left = rect.left + 'px';
    platformsMenu.style.display = 'block';

    document.querySelectorAll('.platform-item').forEach(i => i.classList.remove('active'));
    clearAllPanels();
    if (platformsDetail) platformsDetail.style.display = 'block';
    const firstItem = document.querySelector('.platform-item[data-platform="playstation"]');
    const firstModels = document.querySelector('[data-for="playstation"]');
    if (firstItem) firstItem.classList.add('active');
    if (firstModels) firstModels.classList.add('active');
}

function scheduleHide() {
    hideTimeout = setTimeout(() => {
        platformsMenu.style.display = 'none';
    }, 100);
}

if (platformsDropdown && platformsMenu) {
    platformsDropdown.addEventListener('mouseenter', showMenu);
    platformsDropdown.addEventListener('mouseleave', scheduleHide);
    platformsMenu.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    platformsMenu.addEventListener('mouseleave', scheduleHide);
}

const genresDropdown = document.querySelector('.genres-dropdown');
const genresMenu = document.querySelector('.genres-menu');
let genresHideTimeout = null;

if (genresDropdown && genresMenu) {
    genresDropdown.addEventListener('mouseenter', () => {
        clearTimeout(genresHideTimeout);
        const rect = genresDropdown.getBoundingClientRect();
        genresMenu.style.top = (rect.bottom + 6) + 'px';
        genresMenu.style.left = rect.left + 'px';
        genresMenu.style.display = 'block';
    });

    genresDropdown.addEventListener('mouseleave', () => {
        genresHideTimeout = setTimeout(() => {
            genresMenu.style.display = 'none';
        }, 100);
    });

    genresMenu.addEventListener('mouseenter', () => clearTimeout(genresHideTimeout));
    genresMenu.addEventListener('mouseleave', () => {
        genresHideTimeout = setTimeout(() => {
            genresMenu.style.display = 'none';
        }, 100);
    });
}

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
}

async function populateGamePage() {
    const titleEl = document.querySelector('.game-title');
    if (!titleEl) return;

    const slug = window.location.pathname.split('/').pop();

    if (!slug) {
        titleEl.textContent = 'Game not found';
        titleEl.classList.remove('skeleton');
        return;
    }

    try {
        const response = await fetch(`/api/game-single?slug=${slug}`, { method: 'POST' });
        const games = await response.json();
        const game = games[0];

        if (!game) {
            console.error('Game not found for slug:', slug);
            titleEl.textContent = 'Game not found';
            titleEl.classList.remove('skeleton');
            return;
        }

        console.log('Loaded game:', game);

        const descriptionEl = document.querySelector('.game-description');
        const coverImg = document.querySelector('.game-image img');
        const genreTagsEl = document.getElementById('genre-tags');
        const platformTagsEl = document.getElementById('platform-tags');
        const publisherListEl = document.getElementById('publisher-list');
        const developerListEl = document.getElementById('developer-list');
        const starRatingEl = document.getElementById('star-rating');
        const reviewCountEl = document.getElementById('review-count');

        titleEl.textContent = game.name || 'Unknown Title';
        titleEl.classList.remove('skeleton');

        if (descriptionEl) {
            descriptionEl.textContent = game.summary || 'No description available.';
            descriptionEl.classList.remove('skeleton');
        }

        if (coverImg) {
            if (game.cover && game.cover.image_id) {
                coverImg.src = `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`;
                coverImg.alt = game.name || 'Game cover image';
                coverImg.onload = () => coverImg.classList.remove('skeleton');
            } else {
                coverImg.alt = 'No cover available';
                coverImg.classList.remove('skeleton');
            }
        }

        // ---------- Genres ----------
        if (genreTagsEl) {
            genreTagsEl.innerHTML = '';
            const combinedTags = [
                ...(Array.isArray(game.genres) ? game.genres : []),
                ...(Array.isArray(game.themes) ? game.themes : [])
            ];

            if (combinedTags.length === 0) {
                genreTagsEl.innerHTML = '<span class="tag">Unknown</span>';
            } else {
                const seen = new Set();
                combinedTags.forEach(tag => {
                    if (!tag || !tag.name) return;
                    const key = tag.name.toLowerCase();
                    if (seen.has(key)) return;
                    seen.add(key);
                    const link = document.createElement('a');
                    link.className = 'tag';
                    link.href = `/browse.html?genre=${tag.slug || slugifyQuery(tag.name)}`;
                    link.textContent = tag.name;
                    genreTagsEl.appendChild(link);
                });
            }
        }
        
        // ---------- Platforms ----------
        if (platformTagsEl) {
            platformTagsEl.innerHTML = '';
            const platforms = game.platforms || [];
            if (platforms.length === 0) {
                platformTagsEl.innerHTML = '<span class="tag">Unknown</span>';
            } else {
                platforms.forEach(platform => {
                    const link = document.createElement('a');
                    link.className = 'tag';
                    // Use the platform slug and name from the API
                    const slug = platform.slug || slugifyQuery(platform.name);
                    const name = platform.name;
                    link.href = `/browse.html?platform=${slug}&name=${encodeURIComponent(name)}`;
                    link.textContent = name;
                    platformTagsEl.appendChild(link);
                });
            }
        }

        // ---------- Publisher / Developer ----------
        if (publisherListEl) {
            const publishers = extractNames(
                game.publishers ||
                game.involved_companies?.filter(c => c.publisher).map(c => c.company)
            );
            publisherListEl.textContent = publishers.length ? publishers.join(', ') : 'Unknown';
            publisherListEl.classList.remove('skeleton');
        }

        if (developerListEl) {
            const developers = extractNames(
                game.developers ||
                game.involved_companies?.filter(c => c.developer).map(c => c.company)
            );
            developerListEl.textContent = developers.length ? developers.join(', ') : 'Unknown';
            developerListEl.classList.remove('skeleton');
        }

        // ---------- Rating ----------
        if (starRatingEl) {
            const ratingValue =
                typeof game.total_rating === 'number' ? game.total_rating :
                typeof game.rating === 'number' ? game.rating :
                null;

            if (ratingValue !== null) {
                const normalizedRating = ratingValue > 5
                    ? (ratingValue / 20).toFixed(1)
                    : ratingValue.toFixed(1);
                starRatingEl.textContent = `${normalizedRating}/5`;
            } else {
                starRatingEl.textContent = 'No rating yet';
            }
        }

        if (reviewCountEl) {
            const ratingCount =
                game.total_rating_count ??
                game.rating_count ??
                game.reviews_count ??
                null;
            reviewCountEl.textContent = ratingCount !== null ? `${ratingCount} ratings` : '';
        }

    } catch (error) {
        console.error('Error populating game page:', error);
        titleEl.textContent = 'Error loading game';
        titleEl.classList.remove('skeleton');
    }
}

function extractNames(items) {
    if (!items) return [];
    return items
        .map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item.name === 'string') return item.name;
            return null;
        })
        .filter(Boolean);
}

function slugifyQuery(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

// Live search autocomplete
const searchInput = document.querySelector('.search-bar input');
const searchDropdown = document.createElement('div');
searchDropdown.className = 'search-dropdown';
searchDropdown.style.display = 'none';

if (searchInput) {
    searchInput.parentElement.appendChild(searchDropdown);
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            searchDropdown.style.display = 'none';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
                    method: 'POST'
                });
                const games = await response.json();
                
                if (!Array.isArray(games) || games.length === 0) {
                    searchDropdown.style.display = 'none';
                    return;
                }
                
                searchDropdown.innerHTML = '';
                games.slice(0, 5).forEach(game => {
                    const item = document.createElement('a');
                    item.className = 'search-dropdown-item';
                    item.href = `/games/${game.slug}`;
                    
                    const coverUrl = game.cover 
                        ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.cover.image_id}.jpg`
                        : '';
                    
                    item.innerHTML = `
                        ${coverUrl ? `<img src="${coverUrl}" alt="${game.name}">` : ''}
                        <span>${game.name}</span>
                    `;
                    
                    searchDropdown.appendChild(item);
                });
                
                // Add "See all results" link
                const seeAll = document.createElement('a');
                seeAll.className = 'search-dropdown-see-all';
                seeAll.href = `/search.html?q=${encodeURIComponent(query)}`;
                seeAll.textContent = `See all results for "${query}"`;
                searchDropdown.appendChild(seeAll);
                
                searchDropdown.style.display = 'block';
            } catch (error) {
                console.error('Autocomplete error:', error);
            }
        }, 300);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.style.display = 'none';
        }
    });
    
    // Handle Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
            }
        }
    });
}

window.addEventListener('DOMContentLoaded', loadMorePlatforms);
window.addEventListener('DOMContentLoaded', fetchGameCovers);
window.addEventListener('DOMContentLoaded', populateGamePage);