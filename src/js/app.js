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
                console.log('Setting initial slider position to:', activeMarker.dataset.value);
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
        const viewLeaderboardBtn = document.getElementById('view-leaderboard');
        const backHomeBtn = document.getElementById('back-home');
        const shareLeaderboardBtn = document.getElementById('share-leaderboard');

        getRecommendationsBtn.addEventListener('click', () => this.getRecommendations());
        if (getNewPicksBtn) {
            getNewPicksBtn.addEventListener('click', () => this.showSelectionView());
        }
        if (shareListBtn) {
            shareListBtn.addEventListener('click', () => this.shareList());
        }
        if (viewLeaderboardBtn) {
            viewLeaderboardBtn.addEventListener('click', () => this.showLeaderboard());
        }
        if (backHomeBtn) {
            backHomeBtn.addEventListener('click', () => this.showSelectionView());
        }
        if (shareLeaderboardBtn) {
            shareLeaderboardBtn.addEventListener('click', () => this.shareLeaderboard());
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

        // Slider handle dragging
        this.initSliderDrag();
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

    trackGameClick(gameId) {
        try {
            const clicks = JSON.parse(localStorage.getItem('gameClickCounts') || '{}');
            clicks[gameId] = (clicks[gameId] || 0) + 1;
            localStorage.setItem('gameClickCounts', JSON.stringify(clicks));
            console.log(`Tracked click for game: ${gameId}, total clicks: ${clicks[gameId]}`);
        } catch (error) {
            console.warn('Failed to track game click:', error);
        }
    }

    getLeaderboard() {
        try {
            let clicks = JSON.parse(localStorage.getItem('gameClickCounts') || '{}');
            
            // If no click data exists, add some sample data for demonstration
            if (Object.keys(clicks).length === 0 && this.games.length > 0) {
                // Add sample click data for the first few games
                const sampleClicks = {};
                this.games.slice(0, 10).forEach((game, index) => {
                    sampleClicks[game.id] = Math.floor(Math.random() * 50) + 1; // 1-50 clicks
                });
                clicks = sampleClicks;
                localStorage.setItem('gameClickCounts', JSON.stringify(clicks));
            }
            
            // Convert to array with game info and sort by clicks
            const leaderboard = Object.entries(clicks)
                .map(([gameId, clickCount]) => {
                    const game = this.games.find(g => g.id === gameId);
                    return game ? { ...game, clickCount } : null;
                })
                .filter(Boolean)
                .sort((a, b) => b.clickCount - a.clickCount)
                .slice(0, 10); // Top 10
            
            return leaderboard;
        } catch (error) {
            console.warn('Failed to get leaderboard:', error);
            return [];
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
        const resultsContent = document.getElementById('results-content');
        if (resultsContent.style.display !== 'none') {
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
        const resultsList = document.getElementById('results-list');
        
        resultsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #6c757d;">
                <h3>No games found!</h3>
                <p>Try adjusting your preferences - maybe increase your time commitment or select different game types.</p>
            </div>
        `;
        
        // Use the same transition as displayRecommendations but with no games message
        this.displayRecommendations([]);
    }

    displayRecommendations(games) {
        // Get elements
        const mainContainer = document.getElementById('main-container');
        const selectionContent = document.getElementById('selection-content');
        const resultsContent = document.getElementById('results-content');
        const resultsList = document.getElementById('results-list');
        const resultsTitle = resultsContent.querySelector('h2');

        // Get current time selection and update header
        const preferences = this.getPreferences();
        const timeText = preferences.timeCommitment >= 60 ? 'all day' : `${preferences.timeCommitment} min`;
        resultsTitle.textContent = `Your ${timeText} play list`;

        // Prepare results content
        const sortedGames = this.sortGamesByDifficulty(games);
        resultsList.innerHTML = sortedGames.map((game, index) => this.createResultCard(game, index + 1)).join('');
        
        // Measure current height
        const currentHeight = mainContainer.offsetHeight;
        
        // Temporarily show results content to measure its height
        resultsContent.style.display = 'flex';
        resultsContent.style.visibility = 'hidden';
        const newHeight = mainContainer.scrollHeight;
        resultsContent.style.visibility = '';
        resultsContent.style.display = 'none';
        
        // Only animate height if new content is taller
        const shouldAnimateHeight = newHeight > currentHeight;
        
        if (shouldAnimateHeight) {
            // Set explicit height and start transition
            mainContainer.style.height = currentHeight + 'px';
        }
        
        // Staggered fade out of selection elements
        this.staggeredFadeOut();
        
        setTimeout(() => {
            // Hide selection and show results
            selectionContent.style.display = 'none';
            resultsContent.style.display = 'flex';
            
            // Animate height change only if needed
            if (shouldAnimateHeight) {
                mainContainer.style.height = newHeight + 'px';
                
                // Remove explicit height after animation
                setTimeout(() => {
                    mainContainer.style.height = 'auto';
                }, 1200);
            }
            
            // Staggered fade in of results elements
            this.staggeredFadeIn();
        }, 800);
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
                    <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="play-now-btn" onclick="gamePicker.trackGameClick('${game.id}')">
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
        const mainContainer = document.getElementById('main-container');
        const selectionContent = document.getElementById('selection-content');
        const resultsContent = document.getElementById('results-content');
        const leaderboardContent = document.getElementById('leaderboard-content');
        
        // Reset all animation classes
        this.resetAnimationClasses();
        
        setTimeout(() => {
            // Hide results and leaderboard, show selection
            resultsContent.style.display = 'none';
            leaderboardContent.style.display = 'none';
            selectionContent.style.display = 'flex';
            
            // Let container naturally adjust to selection content size
            mainContainer.style.height = 'auto';
        }, 300);
    }
    
    resetAnimationClasses() {
        // Reset selection elements
        document.querySelector('.theme-section').classList.remove('fade-out');
        document.querySelector('.time-section').classList.remove('fade-out');
        document.querySelector('.reveal-button').classList.remove('fade-out');
        
        // Reset results elements
        document.querySelector('.results-title').classList.remove('fade-in');
        document.querySelector('.results-subtitle').classList.remove('fade-in');
        document.querySelector('.results-list').classList.remove('fade-in');
        document.querySelector('.results-actions').classList.remove('fade-in');
        
        // Reset result cards
        document.querySelectorAll('.result-card').forEach(card => {
            card.classList.remove('fade-in');
        });
    }

    staggeredFadeOut() {
        const themeSection = document.querySelector('.theme-section');
        const timeSection = document.querySelector('.time-section');
        const revealButton = document.querySelector('.reveal-button');
        
        // Fade out elements with delays
        setTimeout(() => themeSection.classList.add('fade-out'), 0);
        setTimeout(() => timeSection.classList.add('fade-out'), 150);
        setTimeout(() => revealButton.classList.add('fade-out'), 300);
    }
    
    staggeredFadeIn() {
        const resultsTitle = document.querySelector('.results-title');
        const resultsSubtitle = document.querySelector('.results-subtitle');
        const resultsList = document.querySelector('.results-list');
        const resultsActions = document.querySelector('.results-actions');
        
        // Fade in elements with delays
        setTimeout(() => resultsTitle.classList.add('fade-in'), 0);
        setTimeout(() => resultsSubtitle.classList.add('fade-in'), 200);
        setTimeout(() => {
            resultsList.classList.add('fade-in');
            // Fade in individual result cards with staggered timing
            const resultCards = document.querySelectorAll('.result-card');
            resultCards.forEach((card, index) => {
                setTimeout(() => card.classList.add('fade-in'), 100 + (index * 150));
            });
        }, 400);
        setTimeout(() => resultsActions.classList.add('fade-in'), 600 + (document.querySelectorAll('.result-card').length * 150));
    }

    updateSliderPosition(timeValue) {
        const sliderHandle = document.querySelector('.slider-handle');
        if (!sliderHandle) {
            console.warn('Slider handle not found in updateSliderPosition');
            return;
        }

        // Get the time markers to calculate exact positions
        const markers = document.querySelectorAll('.time-marker');
        const container = document.querySelector('.time-slider-container');
        
        if (markers.length === 0 || !container) {
            console.warn('Markers or container not found in updateSliderPosition');
            return;
        }

        // Find the target marker
        const targetMarker = Array.from(markers).find(marker => marker.dataset.value === timeValue);
        if (!targetMarker) {
            console.warn('Target marker not found for value:', timeValue);
            return;
        }

        // Get positions relative to container
        const containerRect = container.getBoundingClientRect();
        const markerRect = targetMarker.getBoundingClientRect();
        
        // Calculate center position of the marker relative to container
        const markerCenter = markerRect.left + markerRect.width / 2 - containerRect.left;
        const handleOffset = 26; // Half of handle width (52px / 2)
        
        const newLeft = markerCenter - handleOffset;
        console.log('Setting slider position to:', newLeft, 'for time value:', timeValue);
        sliderHandle.style.left = `${newLeft}px`;
        sliderHandle.dataset.value = timeValue;
    }

    initSliderDrag() {
        const sliderHandle = document.querySelector('.slider-handle');
        const container = document.querySelector('.time-slider-container');
        
        if (!sliderHandle || !container) {
            console.warn('Slider elements not found');
            return;
        }

        let isDragging = false;
        let startX = 0;
        let startLeft = 0;
        
        console.log('Initializing slider drag functionality');
        
        // Mouse events
        sliderHandle.addEventListener('mousedown', (e) => {
            console.log('Mouse down on slider handle');
            isDragging = true;
            startX = e.clientX;
            
            // Get current left position, accounting for computed style if inline style isn't set
            const currentLeft = sliderHandle.style.left ? parseInt(sliderHandle.style.left) : 0;
            startLeft = currentLeft;
            console.log('Starting drag from position:', startLeft);
            
            // Disable transition during drag for immediate response
            sliderHandle.style.transition = 'none';
            sliderHandle.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none'; // Prevent text selection
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const newLeft = startLeft + deltaX;
            
            // Constrain to slider bounds
            const containerRect = container.getBoundingClientRect();
            const handleWidth = 52;
            const minLeft = 0;
            const maxLeft = containerRect.width - handleWidth;
            
            const constrainedLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
            sliderHandle.style.left = `${constrainedLeft}px`;
            
            // Debug: log position changes occasionally
            if (Math.abs(deltaX) % 10 === 0) {
                console.log('Dragging to position:', constrainedLeft);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                console.log('Mouse up - snapping to nearest marker');
                isDragging = false;
                
                // Re-enable transition for smooth snapping
                sliderHandle.style.transition = 'all 0.2s ease';
                sliderHandle.style.cursor = 'grab';
                document.body.style.userSelect = ''; // Re-enable text selection
                this.snapToNearestMarker();
            }
        });

        // Touch events for mobile
        sliderHandle.addEventListener('touchstart', (e) => {
            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startLeft = parseInt(sliderHandle.style.left) || 0;
            
            // Disable transition during drag for immediate response
            sliderHandle.style.transition = 'none';
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const newLeft = startLeft + deltaX;
            
            // Constrain to slider bounds
            const containerRect = container.getBoundingClientRect();
            const handleWidth = 52;
            const minLeft = 0;
            const maxLeft = containerRect.width - handleWidth;
            
            const constrainedLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
            sliderHandle.style.left = `${constrainedLeft}px`;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                
                // Re-enable transition for smooth snapping
                sliderHandle.style.transition = 'all 0.2s ease';
                this.snapToNearestMarker();
            }
        });
    }

    snapToNearestMarker() {
        const sliderHandle = document.querySelector('.slider-handle');
        const container = document.querySelector('.time-slider-container');
        const markers = document.querySelectorAll('.time-marker');
        
        if (!sliderHandle || !container || markers.length === 0) return;

        const containerRect = container.getBoundingClientRect();
        const handleRect = sliderHandle.getBoundingClientRect();
        const handleCenter = handleRect.left + handleRect.width / 2 - containerRect.left;
        
        let nearestMarker = null;
        let nearestDistance = Infinity;
        
        // Find the nearest marker
        markers.forEach(marker => {
            const markerRect = marker.getBoundingClientRect();
            const markerCenter = markerRect.left + markerRect.width / 2 - containerRect.left;
            const distance = Math.abs(handleCenter - markerCenter);
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestMarker = marker;
            }
        });
        
        if (nearestMarker) {
            // Update active state
            document.querySelectorAll('.time-marker').forEach(m => m.classList.remove('active'));
            nearestMarker.classList.add('active');
            
            // Snap to marker position
            const value = nearestMarker.dataset.value;
            this.updateSliderPosition(value);
            this.savePreferences();
        }
    }

    showLeaderboard() {
        console.log('Showing leaderboard...');
        const mainContainer = document.getElementById('main-container');
        const selectionContent = document.getElementById('selection-content');
        const resultsContent = document.getElementById('results-content');
        const leaderboardContent = document.getElementById('leaderboard-content');
        const leaderboardList = document.getElementById('leaderboard-list');
        
        console.log('Elements found:', {
            mainContainer: !!mainContainer,
            selectionContent: !!selectionContent, 
            resultsContent: !!resultsContent,
            leaderboardContent: !!leaderboardContent,
            leaderboardList: !!leaderboardList
        });
        
        // Get leaderboard data
        const leaderboard = this.getLeaderboard();
        console.log('Leaderboard data:', leaderboard);
        console.log('Leaderboard length:', leaderboard.length);
        console.log('First game:', leaderboard[0]);
        
        // Create leaderboard cards
        if (leaderboard.length === 0) {
            leaderboardList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6c757d;">
                    <h3>No data yet!</h3>
                    <p>Play some games first to see the leaderboard.</p>
                </div>
            `;
        } else {
            const html = leaderboard.map((game, index) => 
                this.createLeaderboardCard(game, index + 1)
            ).join('');
            console.log('Generated HTML:', html);
            leaderboardList.innerHTML = html;
        }
        
        // Hide other content and show leaderboard immediately 
        selectionContent.style.display = 'none';
        resultsContent.style.display = 'none';
        leaderboardContent.style.display = 'flex';
        
        // Let container naturally adjust to leaderboard content size
        mainContainer.style.height = 'auto';
        
        // Debug the visibility
        console.log('Leaderboard content style:', leaderboardContent.style.display);
        console.log('Leaderboard content offsetHeight:', leaderboardContent.offsetHeight);
        console.log('Leaderboard list innerHTML length:', leaderboardList.innerHTML.length);
        
        console.log('Leaderboard should now be visible');
        
        // Force visibility of result cards (they might have opacity: 0 from CSS)
        setTimeout(() => {
            const resultCards = leaderboardContent.querySelectorAll('.result-card');
            resultCards.forEach(card => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            });
        }, 100);
    }

    createLeaderboardCard(game, rank) {
        const isSaved = this.savedGames.includes(game.id);
        const saveButtonText = isSaved ? '❤️ SAVED' : 'SAVE GAME';
        const saveButtonClass = isSaved ? 'saved' : '';
        
        return `
            <div class="result-card">
                <div class="leaderboard-rank">
                    <span>${rank}</span>
                </div>
                <div class="result-info">
                    <div class="result-header">
                        <h3 class="result-title">${game.name}</h3>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="save-btn ${saveButtonClass}" onclick="gamePicker.toggleSavedGame('${game.id}')">
                        ${saveButtonText}
                    </button>
                    <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="play-now-btn" onclick="gamePicker.trackGameClick('${game.id}')">
                        PLAY NOW
                    </a>
                </div>
            </div>
        `;
    }

    shareLeaderboard() {
        const leaderboard = this.getLeaderboard();
        
        if (leaderboard.length === 0) {
            alert('No leaderboard data to share!');
            return;
        }

        // Create a shareable text
        const gamesList = leaderboard.map((game, index) => 
            `${index + 1}. ${game.name} (${game.clickCount} clicks)\n   ${game.url}`
        ).join('\n\n');
        
        const shareText = `Top 10 Most Popular Games:\n\n${gamesList}\n\nGenerated by Daily Puzzle Picker`;
        
        // Try to use Web Share API if available
        if (navigator.share) {
            navigator.share({
                title: 'Top 10 Most Popular Games',
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
}

// Global reference for onclick handlers
let gamePicker;

document.addEventListener('DOMContentLoaded', () => {
    gamePicker = new GamePicker();
});