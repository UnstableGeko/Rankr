// Pagination state
let currentPage = 1;
const gamesPerPage = 40;
let totalPages = 1;

async function fetchGameCovers(sortBy = 'rating', page = 1) {
    const gameGrid = document.getElementById('game-grid');
    if (!gameGrid) return;
    
    gameGrid.innerHTML = ''; // Clear existing games
    
    try {
        const response = await fetch("/api/games", { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sortBy: sortBy,
                page: page,
                limit: gamesPerPage
            })
        });
        const data = await response.json();
        const games = data.games || data;
        
        if (data.totalPages) {
            totalPages = data.totalPages;
        }
        
        const seenGames = new Set();

        games.forEach(game => {
            if (game.cover && game.slug) {
                if (seenGames.has(game.slug)) return;
                seenGames.add(game.slug);

                const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`;
                const slug = game.slug || slugify(game.name);

                const link = document.createElement('a');
                link.href = `/games/${slug}`;
                link.className = 'game-card';

                const cover = document.createElement('div');
                cover.className = 'cover';

                const img = document.createElement('img');
                img.src = coverUrl;
                img.alt = game.name;
                cover.appendChild(img);

                const meta = document.createElement('div');
                meta.className = 'meta';

                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = game.name;

                const sub = document.createElement('div');
                sub.className = 'sub';
                const genres = game.genres?.map(g => g.name).slice(0, 1).join('') || '';
                const year = game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : '';
                sub.textContent = [genres, year].filter(Boolean).join(' · ');

                meta.appendChild(title);
                meta.appendChild(sub);
                link.appendChild(cover);
                link.appendChild(meta);
                gameGrid.appendChild(link);
            }
        });

        updatePagination();
        
    } catch (error) {
        console.error('Error fetching games:', error);
    }
}

function updatePagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageNumbers = document.getElementById('page-numbers');
    
    if (!prevBtn || !nextBtn || !pageNumbers) return;
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    pageNumbers.innerHTML = '';
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'page-number';
        pageBtn.textContent = i;
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            const currentSortText = document.getElementById('current-sort')?.textContent || 'Highest Rated';
            const sortValue = getSortValue(currentSortText);
            fetchGameCovers(sortValue, currentPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        pageNumbers.appendChild(pageBtn);
    }
}

function getSortValue(text) {
    const sortMap = {
        'Highest Rated': 'rating',
        'Most Popular': 'rating_count',
        'Newest First': 'release_date',
        'Newest': 'release_date',
        'Trending': 'trending'
    };
    return sortMap[text] || 'rating';
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

        // Also populate the main h1
        const h1El = document.querySelector('.game-info h1');
        if (h1El) {
            h1El.textContent = game.name || 'Unknown Title';
            h1El.style.display = '';
        }

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
        // Normalize to 0-5 scale
        const normalizedRating = ratingValue > 5
            ? (ratingValue / 20)
            : ratingValue;
        
        // Create star HTML
        const fullStars = Math.floor(normalizedRating);
        const hasHalfStar = (normalizedRating % 1) >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let starsHTML = '';
        
        // Full stars
        for (let i = 0; i < fullStars; i++) {
            starsHTML += '<i class="fa-solid fa-star"></i>';
        }
        
        // Half star
        if (hasHalfStar) {
            starsHTML += '<i class="fa-solid fa-star-half-alt"></i>';
        }
        
        // Empty stars
        for (let i = 0; i < emptyStars; i++) {
            starsHTML += '<i class="fa-regular fa-star"></i>';
        }
        
        starRatingEl.innerHTML = starsHTML;
        
        // Update rating number text
        const ratingNumberEl = document.getElementById('rating-number');
        if (ratingNumberEl) {
            ratingNumberEl.textContent = normalizedRating.toFixed(1) + '/5';
        }
    } else {
        starRatingEl.innerHTML = '<span style="color: #666;">No rating yet</span>';
        const ratingNumberEl = document.getElementById('rating-number');
        if (ratingNumberEl) {
            ratingNumberEl.textContent = 'N/A';
        }
    }
}

        if (reviewCountEl) {
            const ratingCount =
                game.total_rating_count ??
                game.rating_count ??
                game.reviews_count ??
                null;
            
            if (ratingCount !== null) {
                reviewCountEl.textContent = `(${ratingCount.toLocaleString()} ratings)`;
            } else {
                reviewCountEl.textContent = '(0 ratings)';
            }
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

// Nav search — Enter key navigates to search page
document.querySelectorAll('.nav-search-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = input.value.trim();
            if (q) window.location.href = `/search.html?q=${encodeURIComponent(q)}`;
        }
    });
});

// Live search autocomplete
const searchInput = document.querySelector('.search input:not(.nav-search-input)');
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

// Sort dropdown menu functionality for home page
const sortDropdown = document.querySelector('.sort-dropdown');
const sortMenu = document.querySelector('.sort-menu');
const sortTrigger = document.querySelector('.sort-trigger');
const currentSort = document.getElementById('current-sort');
let sortHideTimeout = null;

if (sortDropdown && sortMenu && sortTrigger) {
    sortTrigger.addEventListener('click', (e) => {
        e.preventDefault();
    });
    
    sortDropdown.addEventListener('mouseenter', () => {
        clearTimeout(sortHideTimeout);
        const rect = sortTrigger.getBoundingClientRect();
        sortMenu.style.top = (rect.bottom + 6) + 'px';
        sortMenu.style.left = rect.left + 'px';
        sortMenu.style.display = 'block';
    });

    sortDropdown.addEventListener('mouseleave', () => {
        sortHideTimeout = setTimeout(() => {
            sortMenu.style.display = 'none';
        }, 100);
    });

    sortMenu.addEventListener('mouseenter', () => clearTimeout(sortHideTimeout));
    sortMenu.addEventListener('mouseleave', () => {
        sortHideTimeout = setTimeout(() => {
            sortMenu.style.display = 'none';
        }, 100);
    });

}

    // Handle sort selection
    document.querySelectorAll('.sort-list a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sortValue = link.getAttribute('data-sort');
            const sortText = link.textContent;
            
            currentSort.textContent = sortText;
            
            sortMenu.style.display = 'none';
            
            currentPage = 1; // Reset to page 1 when sorting
            fetchGameCovers(sortValue, currentPage);
        });
    });

async function fetchLeaderboard() {
    const featured = document.getElementById('leaderboard-featured');
    const list = document.getElementById('leaderboard-list');
    if (!featured || !list) return;

    try {
        const response = await fetch('/api/trending', {
            method: 'POST'
        });
        const data = await response.json();
        const games = (data.games || data).filter(g => g.cover && g.slug);
        if (games.length === 0) return;

        const scoreFn = g => g.total_rating ?? g.rating ?? null;
        const tierFn = s => s >= 90 ? 'S' : s >= 75 ? 'A' : s >= 60 ? 'B' : 'C';

        // Featured #1
        const top = games[0];
        const topScore = scoreFn(top);
        const topYear = top.first_release_date ? new Date(top.first_release_date * 1000).getFullYear() : '';
        const topGenre = top.genres?.[0]?.name || '';
        featured.innerHTML = `
          <a href="/games/${top.slug}" class="leaderboard-featured-inner">
            <div class="leaderboard-rank-badge">#1</div>
            <div class="leaderboard-cover">
              <img src="https://images.igdb.com/igdb/image/upload/t_cover_big/${top.cover.image_id}.jpg" alt="${top.name}">
            </div>
            <div class="leaderboard-info">
              <div class="leaderboard-meta">${[topGenre, topYear].filter(Boolean).join(' · ')}</div>
              <div class="leaderboard-title">${top.name}</div>
              ${topScore ? `<div class="leaderboard-score">
                <span class="leaderboard-score-num">${(topScore / 10).toFixed(1)}</span>
                <span class="leaderboard-score-out">/10</span>
                <span class="tier-badge" data-tier="${tierFn(topScore)}">${tierFn(topScore)}</span>
              </div>` : ''}
            </div>
          </a>`;

        // Ranked list #2-10
        list.innerHTML = '';
        games.slice(1, 10).forEach((game, i) => {
            const score = scoreFn(game);
            const year = game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : '';
            const genre = game.genres?.[0]?.name || '';
            const row = document.createElement('a');
            row.href = `/games/${game.slug}`;
            row.className = 'leaderboard-row';
            row.innerHTML = `
              <span class="leaderboard-row-rank">#${i + 2}</span>
              <img class="leaderboard-row-cover" src="https://images.igdb.com/igdb/image/upload/t_cover_small/${game.cover.image_id}.jpg" alt="${game.name}">
              <div>
                <div class="leaderboard-row-title">${game.name}</div>
                <div class="leaderboard-row-sub">${[genre, year].filter(Boolean).join(' · ')}</div>
              </div>
              ${score ? `<span class="tier-badge" data-tier="${tierFn(score)}">${tierFn(score)}</span>` : ''}`;
            list.appendChild(row);
        });
    } catch (e) {
        console.error('Leaderboard error:', e);
    }
}

// DOMContentLoaded - Initialize everything
window.addEventListener('DOMContentLoaded', () => {
    loadMorePlatforms();
    fetchGameCovers();
    fetchLeaderboard();
    populateGamePage();
    
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                const currentSortText = document.getElementById('current-sort')?.textContent || 'Highest Rated';
                const sortValue = getSortValue(currentSortText);
                fetchGameCovers(sortValue, currentPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                const currentSortText = document.getElementById('current-sort')?.textContent || 'Highest Rated';
                const sortValue = getSortValue(currentSortText);
                fetchGameCovers(sortValue, currentPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
});