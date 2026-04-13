async function performSearch() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    
    const titleEl = document.getElementById('search-title');
    const resultsEl = document.getElementById('search-results');
    
    if (!query) {
        titleEl.textContent = 'No search query provided';
        return;
    }
    
    titleEl.textContent = `Search Results for "${query}"`;
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
            method: 'POST'
        });
        
        const games = await response.json();
        
        if (!Array.isArray(games) || games.length === 0) {
            resultsEl.innerHTML = '<p style="color: white;">No results found.</p>';
            return;
        }
        
        resultsEl.innerHTML = '';
        games.forEach(game => {
            const resultCard = document.createElement('div');
            resultCard.className = 'search-result-card';
            
            const coverUrl = game.cover 
                ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
                : '/images/no-cover.png';
            
            resultCard.innerHTML = `
                <a href="/games/${game.slug}" class="search-result-link">
                    <img src="${coverUrl}" alt="${game.name}">
                    <div class="search-result-info">
                        <h3>${game.name}</h3>
                        <p>${game.summary ? game.summary.substring(0, 200) + '...' : 'No description available.'}</p>
                    </div>
                </a>
            `;
            
            resultsEl.appendChild(resultCard);
        });
    } catch (error) {
        console.error('Search error:', error);
        resultsEl.innerHTML = '<p style="color: white;">Error loading results.</p>';
    }
}

window.addEventListener('DOMContentLoaded', performSearch);