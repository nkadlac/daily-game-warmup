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
        
        // Initialize slider position after everything is loaded
        setTimeout(() => {
            const activeMarker = document.querySelector('.time-marker.active');
            if (activeMarker) {
                this.updateSliderPosition(activeMarker.dataset.value);
            }
        }, 100);
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
        const getNewPicksBtn = document.getElementById('get-new-picks');
        const shareListBtn = document.getElementById('share-list');

        getRecommendationsBtn.addEventListener('click', () => this.getRecommendations());
        if (getNewPicksBtn) {
            getNewPicksBtn.addEventListener('click', () => this.showSelectionView());
        }
        if (shareListBtn) {
            shareListBtn.addEventListener('click', () => this.shareList());
        }

        // Theme button selection (allow multiple)
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Toggle active class on clicked button
                btn.classList.toggle('active');
                this.savePreferences();
            });
        });

        // Time marker selection
        document.querySelectorAll('.time-marker').forEach(marker => {
            marker.addEventListener('click', () => {
                // Remove active class from all markers
                document.querySelectorAll('.time-marker').forEach(m => m.classList.remove('active'));
                // Add active class to clicked marker
                marker.classList.add('active');
                
                // Update slider handle position
                const value = marker.dataset.value;
                this.updateSliderPosition(value);
                this.savePreferences();
            });
        });
    }

    getPreferences() {
        // Get all selected themes
        const activeThemes = document.querySelectorAll('.theme-btn.active');
        const gameTypes = Array.from(activeThemes).map(btn => btn.dataset.theme);
        
        // If no themes selected, default to word
        if (gameTypes.length === 0) {
            gameTypes.push('word');
        }
        
        // Get selected time from active marker
        const activeTimeMarker = document.querySelector('.time-marker.active');
        const timeValue = activeTimeMarker ? activeTimeMarker.dataset.value : '10';
        const timeCommitment = timeValue === 'all' ? 60 : parseInt(timeValue);
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
            // Map theme names to game types
            const themeToTypeMap = {
                'word': 'word',
                'number': 'math',
                'logic': 'logic', 
                'geography': 'geography',
                'trivia': 'trivia'
            };
            
            const mappedTypes = preferences.gameTypes.map(theme => themeToTypeMap[theme] || theme);
            return mappedTypes.includes(game.type);
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
                    
                    // Mark if we've included a Hey Good Game from saved games
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

        // Third pass: fill remaining time with non-Hey Good Game games
        for (const game of sortedGames) {
            const gameBase = this.getGameBaseName(game.id);
            
            // Skip Hey Good Games if we already have one
            if (hasHeyGoodGame && game.publisher === 'Hey Good Game') {
                continue;
            }
            
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
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            // Check if last part is a difficulty level
            if (['easy', 'normal', 'medium', 'hard', 'advanced', 'killer', 'daily', 'master'].includes(lastPart)) {
                return parts.slice(0, -1).join('-');
            }
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
        // Set active theme button
        if (preferences.gameTypes && preferences.gameTypes.length > 0) {
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.toggle('active', preferences.gameTypes.includes(btn.dataset.theme));
            });
        }

        // Set active time marker and slider position
        if (preferences.timeCommitment) {
            const timeValue = preferences.timeCommitment >= 60 ? 'all' : preferences.timeCommitment.toString();
            document.querySelectorAll('.time-marker').forEach(marker => {
                marker.classList.toggle('active', marker.dataset.value === timeValue);
            });
            this.updateSliderPosition(timeValue);
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
        
        // Refresh the current view to update the UI
        const resultsView = document.getElementById('results-view');
        if (resultsView.style.display !== 'none') {
            const currentGames = Array.from(document.querySelectorAll('.result-card')).map(card => {
                const title = card.querySelector('.result-title').textContent;
                return this.games.find(game => game.name === title);
            }).filter(Boolean);
            this.displayRecommendations(currentGames);
        }
    }

    shareList() {
        // Get current games from results view
        const currentGames = Array.from(document.querySelectorAll('.result-card')).map(card => {
            const title = card.querySelector('.result-title').textContent;
            return this.games.find(game => game.name === title);
        }).filter(Boolean);

        if (currentGames.length === 0) {
            alert('No games to share!');
            return;
        }

        // Create a shareable text
        const gamesList = currentGames.map((game, index) => 
            `${index + 1}. ${game.name} (${game.timeMinutes} min, ${game.difficulty})\n   ${game.url}`
        ).join('\n\n');
        
        const shareText = `My Daily Puzzle Picks:\n\n${gamesList}\n\nGenerated by Daily Puzzle Picker`;
        
        // Try to use Web Share API if available
        if (navigator.share) {
            navigator.share({
                title: 'My Daily Puzzle Picks',
                text: shareText
            }).catch(() => {
                // Fallback to clipboard
                this.copyToClipboard(shareText);
            });
        } else {
            // Fallback to clipboard
            this.copyToClipboard(shareText);
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Game list copied to clipboard!');
            }).catch(() => {
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    }

    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert('Game list copied to clipboard!');
        } catch (err) {
            alert('Unable to copy to clipboard. Please copy manually:\n\n' + text);
        }
        document.body.removeChild(textArea);
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
        const mainCard = document.querySelector('.main-card');
        const resultsView = document.getElementById('results-view');
        const resultsList = document.getElementById('results-list');
        
        resultsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #6c757d;">
                <h3>No games found!</h3>
                <p>Try adjusting your preferences - maybe increase your time commitment or select different game types.</p>
            </div>
        `;
        
        mainCard.style.display = 'none';
        resultsView.style.display = 'flex';
    }

    displayRecommendations(games) {
        // Hide the main card and show results view
        const mainCard = document.querySelector('.main-card');
        const resultsView = document.getElementById('results-view');
        const resultsList = document.getElementById('results-list');
        const resultsTitle = resultsView.querySelector('h2');

        // Get current time selection and update header
        const preferences = this.getPreferences();
        const timeText = preferences.timeCommitment >= 60 ? 'all day' : `${preferences.timeCommitment} min`;
        resultsTitle.textContent = `Your ${timeText} play list`;

        const sortedGames = this.sortGamesByDifficulty(games);
        resultsList.innerHTML = sortedGames.map((game, index) => this.createResultCard(game, index + 1)).join('');
        
        mainCard.style.display = 'none';
        resultsView.style.display = 'flex';
    }

    sortGamesByDifficulty(games) {
        const difficultyOrder = { 'easy': 1, 'medium': 2, 'hard': 3, 'advanced': 4 };
        return [...games].sort((a, b) => {
            return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        });
    }

    createResultCard(game, number) {
        const isSaved = this.savedGames.includes(game.id);
        const starIcon = isSaved ? '⭐️' : '☆';
        
        return `
            <div class="result-card">
                <div class="result-number">
                    <span>${number}</span>
                </div>
                <div class="result-info">
                    <div class="result-header">
                        <h3 class="result-title">${game.name}</h3>
                        <p class="result-description">${game.description}</p>
                    </div>
                    <div class="result-tags">
                        <span class="result-tag">${game.timeMinutes} MIN</span>
                        <span class="result-tag">${game.difficulty.toUpperCase()}</span>
                        <span class="result-tag">${game.type.toUpperCase()}</span>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="star-btn" onclick="gamePicker.toggleSavedGame('${game.id}')">
                        ${starIcon}
                    </button>
                    <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="play-now-btn">
                        PLAY NOW
                    </a>
                </div>
            </div>
        `;
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
        // Content is now static based on Figma design, no need to update dynamically
    }

    showSelectionView() {
        const mainCard = document.querySelector('.main-card');
        const resultsView = document.getElementById('results-view');
        
        resultsView.style.display = 'none';
        mainCard.style.display = 'flex';
    }

    updateSliderPosition(timeValue) {
        const sliderHandle = document.querySelector('.slider-handle');
        if (!sliderHandle) return;

        // Get the time markers to calculate exact positions
        const markers = document.querySelectorAll('.time-marker');
        const container = document.querySelector('.time-slider-container');
        
        if (markers.length === 0 || !container) return;

        // Find the target marker
        const targetMarker = Array.from(markers).find(marker => marker.dataset.value === timeValue);
        if (!targetMarker) return;

        // Get positions relative to container
        const containerRect = container.getBoundingClientRect();
        const markerRect = targetMarker.getBoundingClientRect();
        
        // Calculate center position of the marker relative to container
        const markerCenter = markerRect.left + markerRect.width / 2 - containerRect.left;
        const handleOffset = 26; // Half of handle width (52px / 2)
        
        sliderHandle.style.left = `${markerCenter - handleOffset}px`;
        sliderHandle.dataset.value = timeValue;
    }
}

// Global reference for onclick handlers
let gamePicker;

document.addEventListener('DOMContentLoaded', () => {
    gamePicker = new GamePicker();
});