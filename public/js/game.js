async function fetchGameCovers() {
    const gameGrid = document.getElementById('game-grid');
    
    try {
        const response = await fetch("/api/games", {
            method: 'POST'
        });
        
        const games = await response.json();
        
        games.forEach(game => {
            if (game.cover) {
                const gameCard = document.createElement('div');
                gameCard.className = 'game-card';
                
                const imageId = game.cover.image_id;
                const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
                
                gameCard.innerHTML = `
                    <img src="${coverUrl}" alt="${game.name}">
                `;
                
                gameGrid.appendChild(gameCard);
            }
        });
        
    } catch (error) {
        console.error('Error fetching games:', error);
    }
}

window.addEventListener('DOMContentLoaded', fetchGameCovers);