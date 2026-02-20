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

async function loadMorePlatforms() {
    const flyout = document.querySelector('.platform-models[data-for="more"]');
    if (!flyout) return;

    try {
        const response = await fetch('/api/platforms', { method: 'POST' });
        const platforms = await response.json();

        flyout.innerHTML = '';
        platforms.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#">${p.name}</a>`;
            flyout.appendChild(li);
        });
    } catch (error) {
        console.error('Error fetching platforms:', error);
    }
}

// Platform panel hover switching
document.querySelectorAll('.platform-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        const platform = item.dataset.platform;
        if (!platform) return;

        document.querySelectorAll('.platform-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.platform-models').forEach(m => m.classList.remove('active'));
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

    // Default to Nintendo
    document.querySelectorAll('.platform-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.platform-models').forEach(m => m.classList.remove('active'));
    const firstItem = document.querySelector('.platform-item[data-platform="nintendo"]');
    const firstModels = document.querySelector('.platform-models[data-for="nintendo"]');
    if (firstItem) firstItem.classList.add('active');
    if (firstModels) firstModels.classList.add('active');
}

function scheduleHide() {
    hideTimeout = setTimeout(() => {
        platformsMenu.style.display = 'none';
    }, 100); // 100ms grace period — enough to move mouse down into menu
}

if (platformsDropdown && platformsMenu) {
    platformsDropdown.addEventListener('mouseenter', showMenu);
    platformsDropdown.addEventListener('mouseleave', scheduleHide);
    platformsMenu.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    platformsMenu.addEventListener('mouseleave', scheduleHide);
}

window.addEventListener('DOMContentLoaded', loadMorePlatforms);
window.addEventListener('DOMContentLoaded', fetchGameCovers);