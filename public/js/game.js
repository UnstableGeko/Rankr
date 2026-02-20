async function fetchGameCovers() {
    const gameGrid = document.getElementById('game-grid');
    
    try {
        const response = await fetch("/api/games", { method: 'POST' });
        const games = await response.json();
        
        games.forEach(game => {
            if (game.cover) {
                const gameCard = document.createElement('div');
                gameCard.className = 'game-card';
                const imageId = game.cover.image_id;
                const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
                gameCard.innerHTML = `<img src="${coverUrl}" alt="${game.name}">`;
                gameGrid.appendChild(gameCard);
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
        li.innerHTML = `<a href="#">${p.name}</a>`;
        list.appendChild(li);
    });
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

    // Prevent the menu from closing when clicking the search input
    platformSearchInput.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
}

// Platform panel hover switching
document.querySelectorAll('.platform-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        const platform = item.dataset.platform;

        document.querySelectorAll('.platform-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.platform-models').forEach(m => m.classList.remove('active'));

        if (!platform) return;
        const models = document.querySelector(`.platform-models[data-for="${platform}"]`);
        if (models) models.classList.add('active');
    });
});

// Delay-based show/hide so mouse can travel from pill to menu without it closing
const platformsDropdown = document.querySelector('.platforms-dropdown');
const platformsMenu = document.querySelector('.platforms-menu');
let hideTimeout = null;

function showMenu() {
    clearTimeout(hideTimeout);
    const rect = platformsDropdown.getBoundingClientRect();
    platformsMenu.style.top = (rect.bottom + 6) + 'px';
    platformsMenu.style.left = rect.left + 'px';
    platformsMenu.style.display = 'block';

    // Default to PlayStation
    document.querySelectorAll('.platform-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.platform-models').forEach(m => m.classList.remove('active'));
    const firstItem = document.querySelector('.platform-item[data-platform="playstation"]');
    const firstModels = document.querySelector('.platform-models[data-for="playstation"]');
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

window.addEventListener('DOMContentLoaded', loadMorePlatforms);
window.addEventListener('DOMContentLoaded', fetchGameCovers);