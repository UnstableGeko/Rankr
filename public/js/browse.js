// Map genre slugs to IGDB genre IDs
const GENRE_MAP = {
    'adventure': 31,
    'arcade': 33,
    'card-board-game': 35,
    'fighting': 4,
    'hack-slash': 25,
    'indie': 32,
    'music': 7,
    'platform': 8,
    'point-and-click': 2,
    'puzzle': 9,
    'quiz-trivia': 26,
    'racing': 10,
    'real-time-strategy-rts': 11,
    'role-playing-rpg': 12,
    'shooter': 5,
    'simulator': 13,
    'sport': 14,
    'strategy': 15,
    'tactical': 24,
    'turn-based-strategy-tbs': 16
};

// Display name mapping for special formatting
const DISPLAY_NAMES = {
    'card-board-game': 'Card & Board Game',
    'hack-slash': 'Hack and Slash/Beat \'em up',
    'point-and-click': 'Point-and-click',
    'quiz-trivia': 'Quiz/Trivia',
    'real-time-strategy-rts': 'Real Time Strategy (RTS)',
    'role-playing-rpg': 'Role-playing (RPG)',
    'turn-based-strategy-tbs': 'Turn-based Strategy (TBS)'
};

// Pagination state
let currentPage = 1;
const gamesPerPage = 40;
let totalPages = 1;

async function fetchFilteredGames(sortBy = 'rating', page = 1) {
    const gameGrid = document.getElementById('game-grid');
    const titleEl = document.getElementById('browse-title');
    
    if (!gameGrid) return;

    const params = new URLSearchParams(window.location.search);
    const genreSlug = params.get('genre');
    const platformSlug = params.get('platform');

    let filterType = null;
    let filterValue = null;
    let displayName = 'All Games';

    if (genreSlug) {
        filterType = 'genre';
        filterValue = GENRE_MAP[genreSlug];
        
        if (DISPLAY_NAMES[genreSlug]) {
            displayName = DISPLAY_NAMES[genreSlug] + ' Games';
        } else {
            displayName = genreSlug
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ') + ' Games';
        }
    } else if (platformSlug) {
        filterType = 'platform';
        filterValue = platformSlug;
        
        const platformName = params.get('name');
        if (platformName) {
            displayName = platformName + ' Games';
        } else {
            displayName = platformSlug
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ') + ' Games';
        }
    }

    if (titleEl) {
        titleEl.textContent = displayName;
    }

    gameGrid.innerHTML = ''; // Clear existing games

    try {
        const response = await fetch("/api/browse", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filterType: filterType,
                filterValue: filterValue,
                sortBy: sortBy,
                page: page,
                limit: gamesPerPage
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const games = data.games || data; // Support both formats
        
        // Update total pages if provided
        if (data.totalPages) {
            totalPages = data.totalPages;
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!Array.isArray(games)) {
            console.error('Expected array but got:', games);
            gameGrid.innerHTML = '<p style="color: white; text-align: center; width: 100%; margin-top: 50px;">Error: Invalid response from server.</p>';
            return;
        }
        
        if (games.length === 0) {
            gameGrid.innerHTML = '<p style="color: white; text-align: center; width: 100%; margin-top: 50px;">No games found for this filter.</p>';
            return;
        }

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
                
                // Add game name overlay
                const nameOverlay = document.createElement('div');
                nameOverlay.className = 'game-name-overlay';
                nameOverlay.textContent = game.name;
                
                gameCard.appendChild(img);
                gameCard.appendChild(nameOverlay);
                link.appendChild(gameCard);
                gameGrid.appendChild(link);
            }
        });
        
        updatePagination(); // Update pagination UI
        
    } catch (error) {
        console.error('Error fetching games:', error);
        gameGrid.innerHTML = '<p style="color: white; text-align: center; width: 100%; margin-top: 50px;">Error loading games. Check console for details.</p>';
    }
}

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
}

// ========== DROPDOWN MENU FUNCTIONALITY ==========

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

const platformsDropdown = document.querySelector('.platforms-dropdown');
const platformsMenu = document.querySelector('.platforms-menu');
const platformsDetail = document.querySelector('.platforms-detail');
let hideTimeout = null;

function clearAllPanels() {
    document.querySelectorAll('[data-for]').forEach(el => el.classList.remove('active'));
}

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
        li.innerHTML = `<a href="browse.html?platform=${p.slug}&name=${encodeURIComponent(p.name)}">${p.name}</a>`;
        list.appendChild(li);
    });
}

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

// Sort dropdown menu functionality
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

    // Handle sort selection
    document.querySelectorAll('.sort-list a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sortValue = link.getAttribute('data-sort');
            currentSort.textContent = link.textContent;
            sortMenu.style.display = 'none';
            
            currentPage = 1; // Reset to page 1 when sorting
            fetchFilteredGames(sortValue, currentPage);
        });
    });
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
            fetchFilteredGames(sortValue, currentPage);
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
        'Trending': 'trending'
    };
    return sortMap[text] || 'rating';
}

// Add pagination button listeners
document.addEventListener('DOMContentLoaded', () => {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                const currentSortText = document.getElementById('current-sort')?.textContent || 'Highest Rated';
                const sortValue = getSortValue(currentSortText);
                fetchFilteredGames(sortValue, currentPage);
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
                fetchFilteredGames(sortValue, currentPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
});

window.addEventListener('DOMContentLoaded', () => {
    fetchFilteredGames();
    loadMorePlatforms();
});