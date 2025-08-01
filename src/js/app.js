class GamePicker {
    constructor() {
        this.games = [];
        this.savedGames = [];
        this.init();
    }

    async init() {
        await this.loadGames();
        this.loadPreferences();
        this.loadSavedGames();
        this.updateTimeBasedContent();
        this.bindEvents();
    }

    async loadGames() {
        try {
            const response = await fetch('src/data/games.json');
            this.games = await response.json();
        } catch (error) {
            console.error('Failed to load games:', error);
            this.games = [];
        }
    }

    bindEvents() {
        const getRecommendationsBtn = document.getElementById('get-recommendations');
        const getNewRecommendationsBtn = document.getElementById('get-new-recommendations');

        getRecommendationsBtn.addEventListener('click', () => this.getRecommendations());
        getNewRecommendationsBtn.addEventListener('click', () => this.getRecommendations());

        // Save preferences when they change
        document.querySelectorAll('input[name="gameType"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.savePreferences());
        });

        document.getElementById('time-commitment').addEventListener('change', () => this.savePreferences());
    }

    getPreferences() {
        const gameTypes = Array.from(document.querySelectorAll('input[name="gameType"]:checked'))
            .map(input => input.value);
        
        const timeCommitment = parseInt(document.getElementById('time-commitment').value);
        const gameCount = this.calculateGameCount(timeCommitment);

        return {
            gameTypes,
            timeCommitment,
            gameCount
        };
    }

    calculateGameCount(timeCommitment) {
        if (timeCommitment <= 5) return 1;
        if (timeCommitment <= 15) return 3;
        return 5;
    }

    filterGames(preferences) {
        return this.games.filter(game => {
            return preferences.gameTypes.includes(game.type);
        });
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    selectGamesWithinTimeLimit(games, timeLimit) {
        const sortedGames = [...games].sort((a, b) => a.timeMinutes - b.timeMinutes);
        const selectedGames = [];
        const usedGameBases = new Set();
        let totalTime = 0;
        let hasHeyGoodGame = false;

        // First pass: always include saved games that fit
        for (const gameId of this.savedGames) {
            const game = this.games.find(g => g.id === gameId);
            if (game && totalTime + game.timeMinutes <= timeLimit) {
                const gameBase = this.getGameBaseName(game.id);
                if (!usedGameBases.has(gameBase)) {
                    selectedGames.push(game);
                    usedGameBases.add(gameBase);
                    totalTime += game.timeMinutes;
                    
                    if (game.publisher === 'Hey Good Game') {
                        hasHeyGoodGame = true;
                    }
                }
            }
        }

        // Second pass: try to include one Hey Good Game (if not already included)
        if (!hasHeyGoodGame) {
            const heyGoodGames = sortedGames.filter(game => game.publisher === 'Hey Good Game');
            for (const game of heyGoodGames) {
                const gameBase = this.getGameBaseName(game.id);
                
                if (totalTime + game.timeMinutes <= timeLimit && !usedGameBases.has(gameBase)) {
                    selectedGames.push(game);
                    usedGameBases.add(gameBase);
                    totalTime += game.timeMinutes;
                    hasHeyGoodGame = true;
                    break; // Only add one Hey Good Game
                }
            }
        }

        // Third pass: fill remaining time with other games
        for (const game of sortedGames) {
            const gameBase = this.getGameBaseName(game.id);
            
            if (totalTime + game.timeMinutes <= timeLimit && !usedGameBases.has(gameBase)) {
                selectedGames.push(game);
                usedGameBases.add(gameBase);
                totalTime += game.timeMinutes;
            }
        }

        return this.shuffleArray(selectedGames);
    }

    getGameBaseName(gameId) {
        // Extract base game name (e.g., "mathler-easy" -> "mathler")
        const parts = gameId.split('-');
        if (parts.length > 1 && ['easy', 'normal', 'medium', 'hard', 'advanced'].includes(parts[parts.length - 1])) {
            return parts.slice(0, -1).join('-');
        }
        return gameId;
    }

    savePreferences() {
        const preferences = this.getPreferences();
        localStorage.setItem('gameWarmupPreferences', JSON.stringify({
            gameTypes: preferences.gameTypes,
            timeCommitment: preferences.timeCommitment
        }));
    }

    loadPreferences() {
        try {
            const saved = localStorage.getItem('gameWarmupPreferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                this.applyPreferences(preferences);
            }
        } catch (error) {
            console.warn('Failed to load saved preferences:', error);
        }
    }

    applyPreferences(preferences) {
        // Set game type checkboxes
        document.querySelectorAll('input[name="gameType"]').forEach(checkbox => {
            checkbox.checked = preferences.gameTypes.includes(checkbox.value);
        });

        // Set time commitment
        if (preferences.timeCommitment) {
            document.getElementById('time-commitment').value = preferences.timeCommitment;
        }
    }

    loadSavedGames() {
        try {
            const saved = localStorage.getItem('gameWarmupSavedGames');
            if (saved) {
                this.savedGames = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Failed to load saved games:', error);
            this.savedGames = [];
        }
    }

    saveSavedGames() {
        localStorage.setItem('gameWarmupSavedGames', JSON.stringify(this.savedGames));
    }

    toggleSavedGame(gameId) {
        const index = this.savedGames.indexOf(gameId);
        if (index > -1) {
            this.savedGames.splice(index, 1);
        } else {
            this.savedGames.push(gameId);
        }
        this.saveSavedGames();
        
        // Refresh the current recommendations to update the UI
        const recommendations = document.getElementById('recommendations');
        if (recommendations.style.display !== 'none') {
            const currentGames = Array.from(document.querySelectorAll('.game-card')).map(card => {
                const title = card.querySelector('.game-title').textContent;
                return this.games.find(game => game.name === title);
            }).filter(Boolean);
            this.displayRecommendations(currentGames);
        }
    }

    getRecommendations() {
        const preferences = this.getPreferences();
        
        if (preferences.gameTypes.length === 0) {
            alert('Please select at least one game type!');
            return;
        }

        const filteredGames = this.filterGames(preferences);
        
        if (filteredGames.length === 0) {
            this.showNoGamesMessage();
            return;
        }

        const shuffledGames = this.shuffleArray(filteredGames);
        const recommendedGames = this.selectGamesWithinTimeLimit(shuffledGames, preferences.timeCommitment);

        if (recommendedGames.length === 0) {
            this.showNoGamesMessage();
            return;
        }

        this.displayRecommendations(recommendedGames);
    }

    showNoGamesMessage() {
        const recommendationsSection = document.getElementById('recommendations');
        const gameList = document.getElementById('game-list');
        
        gameList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #6c757d;">
                <h3>No games found!</h3>
                <p>Try adjusting your preferences - maybe increase your time commitment or select different game types.</p>
            </div>
        `;
        
        recommendationsSection.style.display = 'block';
        recommendationsSection.scrollIntoView({ behavior: 'smooth' });
    }

    displayRecommendations(games) {
        const recommendationsSection = document.getElementById('recommendations');
        const gameList = document.getElementById('game-list');

        const sortedGames = this.sortGamesByDifficulty(games);
        gameList.innerHTML = sortedGames.map(game => this.createGameCard(game)).join('');
        
        recommendationsSection.style.display = 'block';
        recommendationsSection.scrollIntoView({ behavior: 'smooth' });
    }

    sortGamesByDifficulty(games) {
        const difficultyOrder = { 'easy': 1, 'medium': 2, 'hard': 3, 'advanced': 4 };
        return [...games].sort((a, b) => {
            return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        });
    }

    createGameCard(game) {
        const isSaved = this.savedGames.includes(game.id);
        const saveButtonText = isSaved ? 'Saved ✓' : 'Save';
        const saveButtonClass = isSaved ? 'saved' : '';
        const savedIndicator = isSaved ? '<span class="game-tag saved-tag">Saved</span>' : '';
        
        return `
            <div class="game-card">
                <h3 class="game-title">${game.name}</h3>
                <div class="game-meta">
                    <span class="game-tag type-${game.type}">${game.type}</span>
                    <span class="game-tag difficulty-${game.difficulty}">${game.difficulty}</span>
                    <span class="game-tag">${game.timeMinutes} min</span>
                    ${savedIndicator}
                </div>
                <p class="game-description">${game.description}</p>
                <div class="game-actions">
                    <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="play-button">
                        Play Now
                    </a>
                    <button class="save-button ${saveButtonClass}" onclick="gamePicker.toggleSavedGame('${game.id}')">
                        ${saveButtonText}
                    </button>
                </div>
            </div>
        `;
    }

    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        return 'night';
    }

    getTimeBasedContent() {
        const timeOfDay = this.getTimeOfDay();
        
        const content = {
            morning: {
                title: 'Daily Game Warm-Up',
                subtitle: 'Start your day with brain-boosting games tailored to your morning routine',
                sectionTitle: 'Customize Your Morning Routine',
                buttonText: 'Start My Warm-Up!',
                resultsTitle: 'Your Morning Brain Boost',
                newGamesButton: 'Try Different Warm-Up'
            },
            afternoon: {
                title: 'Afternoon Game Break',
                subtitle: 'Take a mental break with engaging games to refresh your mind',
                sectionTitle: 'Choose Your Break Activities',
                buttonText: 'Start My Break!',
                resultsTitle: 'Your Afternoon Refresher',
                newGamesButton: 'Try Different Break'
            },
            night: {
                title: 'Evening Game Wind-Down',
                subtitle: 'Unwind with relaxing games to help transition into your evening',
                sectionTitle: 'Set Your Wind-Down Preferences',
                buttonText: 'Start Winding Down!',
                resultsTitle: 'Your Evening Relaxation',
                newGamesButton: 'Try Different Wind-Down'
            }
        };
        
        return content[timeOfDay];
    }

    updateTimeBasedContent() {
        const content = this.getTimeBasedContent();
        
        // Update header
        document.querySelector('header h1').textContent = content.title;
        document.querySelector('header p').textContent = content.subtitle;
        
        // Update section title
        document.querySelector('.preferences h2').textContent = content.sectionTitle;
        
        // Update buttons
        document.getElementById('get-recommendations').textContent = content.buttonText;
        document.getElementById('get-new-recommendations').textContent = content.newGamesButton;
        
        // Update results title
        document.querySelector('.recommendations h2').textContent = content.resultsTitle;
    }
}

// Global reference for onclick handlers
let gamePicker;

document.addEventListener('DOMContentLoaded', () => {
    gamePicker = new GamePicker();
});