
/*:
 * @target MZ
 * @plugindesc Arcade Cabinet Manager v1.3.0
 * @author Nocoldiz + Gemini + ChatGPT + Claude
 * @url 
 * @help
 * ============================================================================
 * Arcade Cabinet Manager Plugin
 * ============================================================================
 * This plugin manages an arcade cabinet system with CRT effects, coin system,
 * high scores, and support for arcade game cart plugins.
 * * Features:
 * - Full screen arcade scene with PIXI CRT overlay effects
 * - Coin insertion system using game variables
 * - Demo mode for games
 * - High score system with letter selection and default scores
 * - API for arcade cart plugins
 * - Game selection menu
 * - Sound effects for arcade experience
 * - Multi-language support (English/Italian)
 * - Custom font support
 * - Clean arcade-style UI without RPG Maker window graphics
 * * ============================================================================
 * Plugin Commands
 * ============================================================================
 * * Play Game - Plays a specific arcade game by ID
 * - Has a "Free Play" option to bypass the coin requirement.
 * * Show Game List - Shows a list of all registered games
 * * ============================================================================
 * Arcade Cart API
 * ============================================================================
 * * Game carts can access these methods:
 * * ArcadeManager.registerGame(id, name, cartPlugin)
 * - Register a new game cart
 * * ArcadeManager.getInput()
 * - Returns input object with these properties:
 * {
 * action: boolean,    // Primary button (OK/Space/Enter)
 * up: boolean,        // Up arrow or W
 * down: boolean,      // Down arrow or S  
 * left: boolean,      // Left arrow or A
 * right: boolean      // Right arrow or D
 * }
 * * ArcadeManager.startGame()
 * - Call when starting the game
 * * ArcadeManager.endGame(score)
 * - Call when ending the game with final score
 * * ArcadeManager.getCoins()
 * - Get current coin count
 * * ArcadeManager.useCoins(amount)
 * - Use coins (returns true if successful)
 * * ArcadeManager.isDemo()
 * - Check if in demo mode
 * * ArcadeManager.getHighScores(gameId)
 * - Get high scores for a game
 * * ArcadeManager.submitScore(gameId, score, initials)
 * - Submit a new high score with custom initials
 * * ArcadeManager.getText(key)
 * - Get localized text
 * * ArcadeManager.getArcadeFont()
 * - Get the arcade font family name
 * * ArcadeManager.exitToTitle()
 * - Exit current game and return to title screen
 * * @param coinVariable
 * @text Coin Variable
 * @type variable
 * @desc Variable that stores the player's coins
 * @default 1
 * * @param coinsPerPlay
 * @text Coins Per Play
 * @type number
 * @min 1
 * @desc Number of coins required to play a game
 * @default 1
 * * @param demoTime
 * @text Demo Time (seconds)
 * @type number
 * @min 3
 * @desc Time before demo mode starts (in seconds)
 * @default 3
 * * @param maxHighScores
 * @text Max High Scores
 * @type number
 * @min 5
 * @max 20
 * @desc Maximum number of high scores to save per game
 * @default 10
 * * @param crtIntensity
 * @text CRT Effect Intensity
 * @type number
 * @min 0
 * @max 100
 * @decimals 0
 * @desc Intensity of CRT effects (0-100)
 * @default 50
 * * @param arcadeFont
 * @text Arcade Font Family
 * @type string
 * @desc Custom font family name for arcade text
 * @default PressStart2P
 * * @param coinSound
 * @text Coin Insert Sound
 * @type file
 * @dir audio/se/
 * @desc Sound effect when inserting a coin
 * @default Coin
 * * @param menuSelectSound
 * @text Menu Select Sound
 * @type file
 * @dir audio/se/
 * @desc Sound effect for menu selection
 * @default Cursor1
 * * @param menuConfirmSound
 * @text Menu Confirm Sound
 * @type file
 * @dir audio/se/
 * @desc Sound effect for menu confirmation
 * @default Decision2
 * * @param menuCloseSound
 * @text Menu Close Sound
 * @type file
 * @dir audio/se/
 * @desc Sound effect for closing menus
 * @default Cancel1
 * * @command playGame
 * @text Play Game
 * @desc Play a specific arcade game by ID
 * * @arg gameId
 * @text Game ID
 * @type string
 * @desc ID of the game to play (plugin name)
 *
 * @arg freePlay
 * @text Free Play
 * @type boolean
 * @desc If true, no coins are required to play.
 * @default false
 * * @command showGameList
 * @text Show Game List
 * @desc Show a list of all available arcade games
 */

(() => {
    'use strict';
    
    const pluginName = 'ArcadeCabinetManager';
    const parameters = PluginManager.parameters(pluginName);
    
    const coinVariable = Number(parameters['coinVariable'] || 1);
    const coinsPerPlay = Number(parameters['coinsPerPlay'] || 1);
    const demoTime = Number(parameters['demoTime'] || 3) * 1000; // Convert to ms
    const maxHighScores = Number(parameters['maxHighScores'] || 10);
    const crtIntensity = Number(parameters['crtIntensity'] || 50) / 100;
    const arcadeFont = parameters['arcadeFont'] || 'PressStart2P';
    
    // Sound parameters
    const coinSound = parameters['coinSound'] || 'Coin';
    const menuSelectSound = parameters['menuSelectSound'] || 'Cursor1';
    const menuConfirmSound = parameters['menuConfirmSound'] || 'Decision2';
    const menuCloseSound = parameters['menuCloseSound'] || 'Cancel1';

    // ============================================================================
    // Default High Scores Configuration
    // ============================================================================
    const defaultHighScores = {
        // Example: Replace 'MyCoolGame' with the actual game ID (e.g., plugin name).
        'MyCoolGame': [
            { initials: 'ACE', score: 50000, date: new Date().toISOString() },
            { initials: 'KNG', score: 42000, date: new Date().toISOString() },
            { initials: 'PRO', score: 35000, date: new Date().toISOString() },
            { initials: 'DUD', score: 28000, date: new Date().toISOString() },
            { initials: 'TOP', score: 21000, date: new Date().toISOString() },
            { initials: 'MID', score: 15000, date: new Date().toISOString() },
            { initials: 'NUB', score: 10000, date: new Date().toISOString() },
            { initials: 'ROK', score: 7500, date: new Date().toISOString() },
            { initials: 'GUY', score: 5000, date: new Date().toISOString() },
            { initials: 'LOW', score: 2500, date: new Date().toISOString() },
        ]
    };
    
    // ============================================================================
    // Localization
    // ============================================================================
    
    const texts = {
        en: {
            coins: 'COINS',
            insertCoin: 'INSERT COIN',
            gameStart: 'GAME START!',
            demoMode: 'DEMO MODE',
            gameOver: 'GAME OVER',
            demoEnd: 'DEMO END',
            highScores: 'HIGH SCORES',
            enterInitials: 'ENTER YOUR INITIALS',
            selectLetter: 'SELECT LETTER',
            confirm: 'CONFIRM',
            cancel: 'CANCEL',
            toPlay: 'TO PLAY',
            coin: 'COIN',
            coins_plural: 'COINS',
            pressStart: 'PRESS START',
            gameSelect: 'GAME SELECT'
        },
        it: {
            coins: 'GETTONI',
            insertCoin: 'INSERISCI GETTONE',
            gameStart: 'INIZIO GIOCO!',
            demoMode: 'MODALITÀ DEMO',
            gameOver: 'FINE PARTITA',
            demoEnd: 'FINE DEMO',
            highScores: 'PUNTEGGI MIGLIORI',
            enterInitials: 'INSERISCI LE TUE INIZIALI',
            selectLetter: 'SELEZIONA LETTERA',
            confirm: 'CONFERMA',
            cancel: 'ANNULLA',
            toPlay: 'PER GIOCARE',
            coin: 'GETTONE',
            coins_plural: 'GETTONI',
            pressStart: 'PREMI START',
            gameSelect: 'SELEZIONE GIOCO'
        }
    };
    
    // ============================================================================
    // ArcadeManager - Global API
    // ============================================================================
    
    window.ArcadeManager = {
        _games: {},
        _currentGame: null,
        _demoMode: false,
        _scene: null,
        _freePlay: false,
        
        // Register a new game cart
        registerGame(id, name, cartPlugin) {
            this._games[id] = {
                id: id,
                name: name,
                plugin: cartPlugin
            };
        },
        
        // Get current input state - simplified for arcade games
        getInput() {
            return {
                action: Input.isPressed('ok') || TouchInput.isPressed(),
                up: Input.isPressed('up'),
                down: Input.isPressed('down'),
                left: Input.isPressed('left'),
                right: Input.isPressed('right')
            };
        },
        
        // Start game
        startGame() {
            if (this._scene) {
                this._scene.onGameStart();
            }
        },
        
        // End game
        endGame(score) {
            if (this._scene) {
                this._scene.onGameEnd(score);
            }
        },
        
        // Exit to title screen
        exitToTitle() {
            if (this._scene) {
                this._scene.exitToTitle();
            }
        },
        
        // Get coin count
        getCoins() {
            return $gameVariables.value(coinVariable) || 0;
        },
        
        // Use coins
        useCoins(amount) {
            const current = this.getCoins();
            if (current >= amount) {
                $gameVariables.setValue(coinVariable, current - amount);
                return true;
            }
            return false;
        },

        // Set free play mode
        setFreePlay(isFree) {
            this._freePlay = !!isFree;
        },

        // Check if in free play mode
        isFreePlay() {
            return this._freePlay;
        },
        
        // Check if in demo mode
        isDemo() {
            return this._demoMode;
        },
        
        // Get high scores for a game
        getHighScores(gameId) {
            const key = `arcade_highscores_${gameId}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                return JSON.parse(saved);
            }
            if (defaultHighScores[gameId]) {
                // Return a deep copy to prevent mutation of the default object
                return JSON.parse(JSON.stringify(defaultHighScores[gameId]));
            }
            return [];
        },
        
        // Submit a high score with custom initials
        submitScore(gameId, score, initials = null) {
            let scores = this.getHighScores(gameId);
            const playerInitials = initials || this._getPlayerInitials();
            
            scores.push({
                score: score,
                initials: playerInitials,
                date: new Date().toISOString()
            });
            
            // Sort and limit scores
            scores.sort((a, b) => b.score - a.score);
            scores = scores.slice(0, maxHighScores);
            
            // Save to localStorage
            const key = `arcade_highscores_${gameId}`;
            localStorage.setItem(key, JSON.stringify(scores));
            
            return scores;
        },
        
        // Get localized text
        getText(key) {
            const lang = window.selectedLanguage === 'it' ? 'it' : 'en';
            return texts[lang][key] || texts['en'][key] || key;
        },
        
        // Get arcade font
        getArcadeFont() {
            return arcadeFont;
        },
        
        // Play arcade sound effects
        playSound(type) {
            let se = null;
            switch(type) {
                case 'coin':
                    se = { name: coinSound, volume: 90, pitch: 100, pan: 0 };
                    break;
                case 'select':
                    se = { name: menuSelectSound, volume: 90, pitch: 100, pan: 0 };
                    break;
                case 'confirm':
                    se = { name: menuConfirmSound, volume: 90, pitch: 100, pan: 0 };
                    break;
                case 'close':
                    se = { name: menuCloseSound, volume: 90, pitch: 100, pan: 0 };
                    break;
            }
            if (se) {
                AudioManager.playSe(se);
            }
        },
        
        // Get player initials from first actor
        _getPlayerInitials() {
            const actor = $gameParty.members()[0];
            if (actor) {
                const name = actor.name();
                return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 3);
            }
            return 'AAA';
        }
    };
    
    // ============================================================================
    // Scene_Arcade
    // ============================================================================
    
    class Scene_Arcade extends Scene_Base {
        initialize() {
            super.initialize();
            ArcadeManager._scene = this;
            this._gameId = null;
            this._demoTimer = 0;
            this._gameActive = false;
            this._crtFilter = null;
            this._onTitleScreen = true;
        }

        prepare(gameId) {
            this._gameId = gameId;
        }

        resume() {
            super.resume();
            // When returning from a sub-scene (scores, initial entry), reset to the title screen.
            this.exitToTitle();
            this.updateCoinDisplay();
        }
        
        create() {
            super.create();
            this.createBackground();
            this.createCRTEffect();
            this.createUI();
            this.setupGame();
            this.showTitleScreen();
        }
        
        createBackground() {
            this._backgroundSprite = new Sprite();
            this._backgroundSprite.bitmap = new Bitmap(Graphics.width, Graphics.height);
            this._backgroundSprite.bitmap.fillAll('black');
            this.addChild(this._backgroundSprite);
        }
        
        createCRTEffect() {
            // Create CRT filter
            this._crtFilter = new PIXI.filters.CRTFilter({
                curvature: 2.0,
                lineWidth: 3.0,
                lineContrast: 0.3,
                verticalLine: false,
                noise: 0.2 * crtIntensity,
                noiseSize: 1.0,
                seed: Math.random(),
                vignetting: 0.3 * crtIntensity,
                vignettingAlpha: 1.0,
                vignettingBlur: 0.3,
                time: 0
            });
            
            // Add glow filter for golden phosphor effect
            this._glowFilter = new PIXI.filters.GlowFilter({
                distance: 10,
                outerStrength: 0.5 * crtIntensity,
                innerStrength: 0,
                color: 0xffd700, // Golden color
                quality: 0.5
            });
            
            // Apply filters to the scene
            this.filters = [this._crtFilter, this._glowFilter];
            
            // Create scanline overlay
            this._scanlines = new TilingSprite();
            this._scanlines.bitmap = this.createScanlineBitmap();
            this._scanlines.move(0, 0, Graphics.width, Graphics.height);
            this._scanlines.opacity = 50 * crtIntensity;
            this.addChild(this._scanlines);
        }
        
        createScanlineBitmap() {
            const bitmap = new Bitmap(1, 4);
            bitmap.fillRect(0, 0, 1, 2, 'black');
            return bitmap;
        }
        
        createUI() {
            // Create game container
            this._gameContainer = new PIXI.Container();
            this.addChild(this._gameContainer);
            
            // Title screen elements
            this._titleSprite = new Sprite();
            this._titleSprite.bitmap = new Bitmap(Graphics.width, Graphics.height);
            this._titleSprite.bitmap.fontFace = arcadeFont;
            this.addChild(this._titleSprite);
            
            // Coin display (no window graphics)
            this._coinSprite = new Sprite();
            this._coinSprite.bitmap = new Bitmap(250, 50);
            this._coinSprite.bitmap.fontFace = arcadeFont;
            this._coinSprite.bitmap.fontSize = 16;
            this._coinSprite.x = Graphics.width - 250;
            this._coinSprite.y = 10;
            this.addChild(this._coinSprite);
            
            // Info display (no window graphics)
            this._infoSprite = new Sprite();
            this._infoSprite.bitmap = new Bitmap(Graphics.width, 100);
            this._infoSprite.bitmap.fontFace = arcadeFont;
            this._infoSprite.x = 0;
            this._infoSprite.y = Graphics.height - 100;
            this.addChild(this._infoSprite);
        }
        
        setupGame() {
            if (this._gameId) {
                const game = ArcadeManager._games[this._gameId];
                if (game) {
                    ArcadeManager._currentGame = game;
                }
            }
        }
        
        showTitleScreen() {
            this._onTitleScreen = true;
            this._demoTimer = 0;
            this.updateTitleScreen();
            this.updateCoinDisplay();
            this.updateInfoDisplay();
        }
        
        updateTitleScreen() {
            if (!this._onTitleScreen) return;
            
            this._titleSprite.bitmap.clear();
            
            if (ArcadeManager._currentGame) {
                // Game title
                this._titleSprite.bitmap.fontSize = 48;
                this._titleSprite.bitmap.textColor = '#ffd700'; // Golden color
                const titleY = Graphics.height / 2 - 100;
                this._titleSprite.bitmap.drawText(
                    ArcadeManager._currentGame.name,
                    0, titleY, Graphics.width, 80, 'center'
                );
                
                // Press start text (blinking)
                if (Graphics.frameCount % 60 < 30) {
                    this._titleSprite.bitmap.fontSize = 24;
                    this._titleSprite.bitmap.textColor = '#ffffff';
                    const startY = Graphics.height / 2 + 50;
                    this._titleSprite.bitmap.drawText(
                        ArcadeManager.getText('pressStart'),
                        0, startY, Graphics.width, 40, 'center'
                    );
                }
            }
        }
        
        updateCoinDisplay() {
            this._coinSprite.bitmap.clear();
            this._coinSprite.bitmap.textColor = '#ffff00';
            const coins = ArcadeManager.getCoins();
            const text = `${ArcadeManager.getText('coins')}: ${coins}`;
            this._coinSprite.bitmap.drawText(text, 0, 0, 250, 50, 'center');
        }
        
        updateInfoDisplay() {
            this._infoSprite.bitmap.clear();
            
            if (this._onTitleScreen && ArcadeManager._currentGame) {
                this._infoSprite.bitmap.fontSize = 20;
                this._infoSprite.bitmap.textColor = '#ffffff';
                const coinText = coinsPerPlay === 1 ? 
                    ArcadeManager.getText('coin') : 
                    ArcadeManager.getText('coins_plural');
                const text = ArcadeManager.isFreePlay() ? "FREE PLAY" : `${coinsPerPlay} ${coinText} ${ArcadeManager.getText('toPlay')}`;
                this._infoSprite.bitmap.drawText(text, 0, 20, Graphics.width, 40, 'center');
            }
        }
        
        update() {
            super.update();
            
            if (this._crtFilter) {
                this._crtFilter.time += 0.1;
            }
            
            if (this._onTitleScreen && Graphics.frameCount % 60 === 0) {
                this.updateTitleScreen();
            }
            
            if (Graphics.frameCount % 30 === 0) {
                this.updateCoinDisplay();
            }
            
            if (this._onTitleScreen && !this._gameActive && !ArcadeManager._demoMode) {
                this._demoTimer += 16.67; // ~60fps
                if (this._demoTimer >= demoTime) {
                    this.startDemoMode();
                }
            }
            
            if (this._gameActive && (Input.isTriggered('cancel') || Input.isTriggered('escape'))) {
                this.exitToTitle();
                return;
            }
            
            if (this._onTitleScreen && Input.isTriggered('ok') && !this._gameActive && !ArcadeManager._demoMode) {
                this.tryStartGame();
            }
            
            if (this._onTitleScreen && Input.isTriggered('cancel') && !this._gameActive) {
                ArcadeManager.playSound('close');
                this.popScene();
            }
        }
        
        tryStartGame() {
            if (ArcadeManager.isFreePlay() || ArcadeManager.useCoins(coinsPerPlay)) {
                if (ArcadeManager.isFreePlay()) {
                    ArcadeManager.playSound('confirm');
                } else {
                    ArcadeManager.playSound('coin');
                }
                this.startGame();
            } else {
                SoundManager.playBuzzer();
                this.showMessage(ArcadeManager.getText('insertCoin'));
            }
        }
        
        startGame() {
            this._gameActive = true;
            this._onTitleScreen = false;
            this._demoTimer = 0;
            ArcadeManager._demoMode = false;
            
            this._titleSprite.visible = false;
            this._infoSprite.bitmap.clear();
                        
            if (ArcadeManager._currentGame && ArcadeManager._currentGame.plugin.start) {
                ArcadeManager._currentGame.plugin.start(this._gameContainer);
            }
        }
        
        startDemoMode() {
            ArcadeManager._demoMode = true;
            this._onTitleScreen = false;
            this._titleSprite.visible = false;
            
            this.showMessage(ArcadeManager.getText('demoMode'));
            
            if (ArcadeManager._currentGame && ArcadeManager._currentGame.plugin.startDemo) {
                ArcadeManager._currentGame.plugin.startDemo(this._gameContainer);
            }
        }
        
        showMessage(message) {
            this._infoSprite.bitmap.clear();
            this._infoSprite.bitmap.fontSize = 28;
            this._infoSprite.bitmap.textColor = '#ffd700'; // Golden color
            this._infoSprite.bitmap.drawText(message, 0, 20, Graphics.width, 60, 'center');
            
            setTimeout(() => {
                if (this._onTitleScreen) {
                    this.updateInfoDisplay();
                }
            }, 2000);
        }
        
        onGameStart() {
            this._gameActive = true;
        }
        
        onGameEnd(score) {
            this._gameActive = false;
            this._demoTimer = 0;

            if (ArcadeManager._demoMode) {
                this.showMessage(ArcadeManager.getText('demoEnd'));
                setTimeout(() => this.exitToTitle(), 2000);
                return;
            }

            const scores = ArcadeManager.getHighScores(this._gameId);
            const isHighScore = score > 0 && (scores.length < maxHighScores || score > (scores[scores.length - 1]?.score || 0));

            if (isHighScore) {
                SceneManager.push(Scene_InitialEntry);
                SceneManager.prepareNextScene(this._gameId, score);
            } else {
                this.showMessage(ArcadeManager.getText('gameOver'));
                setTimeout(() => {
                    SceneManager.push(Scene_HighScores);
                    SceneManager.prepareNextScene(this._gameId);
                }, 2000);
            }
        }
        
        exitToTitle() {
            this._gameActive = false;
            ArcadeManager._demoMode = false;
            
            this._gameContainer.removeChildren();
            
            this._titleSprite.visible = true;
            this.showTitleScreen();
        }
        
        terminate() {
            super.terminate();
            ArcadeManager._scene = null;
            ArcadeManager._currentGame = null;
            ArcadeManager._demoMode = false;
            ArcadeManager.setFreePlay(false);
        }
    }
    
    // ============================================================================
    // Scene_InitialEntry
    // ============================================================================
    
    class Scene_InitialEntry extends Scene_Base {
        initialize() {
            super.initialize();
            this._gameId = null;
            this._score = 0;
            this._initials = ['A', 'A', 'A'];
            this._currentIndex = 0;
            this._letterIndex = 0;
            this._letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        }

        prepare(gameId, score) {
            this._gameId = gameId;
            this._score = score;
        }
        
        create() {
            super.create();
            this.createBackground();
            this.createUI();
        }
        
        createBackground() {
            this._backgroundSprite = new Sprite();
            this._backgroundSprite.bitmap = new Bitmap(Graphics.width, Graphics.height);
            this._backgroundSprite.bitmap.fillAll('black');
            this.addChild(this._backgroundSprite);
        }
        
        createUI() {
            this._titleSprite = new Sprite();
            this._titleSprite.bitmap = new Bitmap(Graphics.width, 100);
            this._titleSprite.bitmap.fontFace = arcadeFont;
            this._titleSprite.bitmap.fontSize = 24;
            this._titleSprite.bitmap.textColor = '#ffd700'; // Golden color
            this._titleSprite.bitmap.drawText(
                ArcadeManager.getText('enterInitials'),
                0, 20, Graphics.width, 60, 'center'
            );
            this._titleSprite.y = 50;
            this.addChild(this._titleSprite);
            
            this._scoreSprite = new Sprite();
            this._scoreSprite.bitmap = new Bitmap(Graphics.width, 80);
            this._scoreSprite.bitmap.fontFace = arcadeFont;
            this._scoreSprite.bitmap.fontSize = 20;
            this._scoreSprite.bitmap.textColor = '#ffffff';
            this._scoreSprite.bitmap.drawText(
                `SCORE: ${this._score}`,
                0, 20, Graphics.width, 40, 'center'
            );
            this._scoreSprite.y = 160;
            this.addChild(this._scoreSprite);
            
            this._initialSprite = new Sprite();
            this._initialSprite.bitmap = new Bitmap(Graphics.width, 120);
            this._initialSprite.bitmap.fontFace = arcadeFont;
            this._initialSprite.y = 260;
            this.addChild(this._initialSprite);
            
            this._letterSprite = new Sprite();
            this._letterSprite.bitmap = new Bitmap(Graphics.width, 200);
            this._letterSprite.bitmap.fontFace = arcadeFont;
            this._letterSprite.y = 400;
            this.addChild(this._letterSprite);
            
            this.refreshDisplay();
        }
        
        refreshDisplay() {
            this.refreshInitials();
            this.refreshLetters();
        }
        
        refreshInitials() {
            this._initialSprite.bitmap.clear();
            this._initialSprite.bitmap.fontSize = 48;
            
            const spacing = 80;
            const startX = (Graphics.width - spacing * 2) / 2;
            
            for (let i = 0; i < 3; i++) {
                const x = startX + i * spacing;
                const y = 10;
                
                if (i === this._currentIndex && Graphics.frameCount % 30 < 15) {
                    this._initialSprite.bitmap.fillRect(x - 5, y + 50, 50, 4, '#ffd700'); // Golden color
                }
                
                this._initialSprite.bitmap.textColor = i === this._currentIndex ? '#ffd700' : '#ffffff'; // Golden color
                this._initialSprite.bitmap.drawText(this._initials[i], x, y, 40, 40, 'center');
            }
        }
        
        refreshLetters() {
            this._letterSprite.bitmap.clear();
            this._letterSprite.bitmap.fontSize = 24;
            
            const cols = 9;
            const cellWidth = Graphics.width / cols;
            const cellHeight = 40;
            
            for (let i = 0; i < this._letters.length; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                this._letterSprite.bitmap.textColor = i === this._letterIndex ? '#ffd700' : '#ffffff'; // Golden
                this._letterSprite.bitmap.drawText(this._letters[i], col * cellWidth, row * cellHeight, cellWidth, cellHeight, 'center');
            }
            
            const delIndex = this._letters.length;
            const endIndex = this._letters.length + 1;
            
            this._letterSprite.bitmap.textColor = this._letterIndex === delIndex ? '#ffd700' : '#ffffff'; // Golden
            this._letterSprite.bitmap.drawText('DEL', (delIndex % cols) * cellWidth, Math.floor(delIndex / cols) * cellHeight, cellWidth, cellHeight, 'center');
            
            this._letterSprite.bitmap.textColor = this._letterIndex === endIndex ? '#ffd700' : '#ffffff'; // Golden
            this._letterSprite.bitmap.drawText('END', (endIndex % cols) * cellWidth, Math.floor(endIndex / cols) * cellHeight, cellWidth, cellHeight, 'center');
        }
        
        update() {
            super.update();
            
            if (Graphics.frameCount % 30 === 0) {
                this.refreshInitials();
            }
            
            if (Input.isTriggered('left')) {
                this._letterIndex = Math.max(0, this._letterIndex - 1);
                ArcadeManager.playSound('select');
                this.refreshDisplay();
            } else if (Input.isTriggered('right')) {
                this._letterIndex = Math.min(this._letters.length + 1, this._letterIndex + 1);
                ArcadeManager.playSound('select');
                this.refreshDisplay();
            } else if (Input.isTriggered('up')) {
                const cols = 9;
                this._letterIndex = Math.max(0, this._letterIndex - cols);
                ArcadeManager.playSound('select');
                this.refreshDisplay();
            } else if (Input.isTriggered('down')) {
                const cols = 9;
                this._letterIndex = Math.min(this._letters.length + 1, this._letterIndex + cols);
                ArcadeManager.playSound('select');
                this.refreshDisplay();
            } else if (Input.isTriggered('ok')) {
                this.onLetterSelect();
            } else if (Input.isTriggered('cancel')) {
                this.onCancel();
            }
        }
        
        onLetterSelect() {
            if (this._letterIndex < this._letters.length) {
                this._initials[this._currentIndex] = this._letters[this._letterIndex];
                if (this._currentIndex < 2) {
                    this._currentIndex++;
                    ArcadeManager.playSound('select');
                } else {
                    ArcadeManager.playSound('confirm');
                }
                this.refreshDisplay();
            } else if (this._letterIndex === this._letters.length) { // DEL
                if (this._currentIndex > 0) {
                    this._currentIndex--;
                    this._initials[this._currentIndex] = 'A';
                    ArcadeManager.playSound('select');
                    this.refreshDisplay();
                }
            } else { // END
                const initials = this._initials.join('');
                ArcadeManager.submitScore(this._gameId, this._score, initials);
                ArcadeManager.playSound('confirm');
                SceneManager.goto(Scene_HighScores);
                SceneManager.prepareNextScene(this._gameId);
            }
        }
        
        onCancel() {
            if (this._currentIndex > 0) {
                this._currentIndex--;
                this.refreshDisplay();
                ArcadeManager.playSound('close');
            } else {
                this.popScene();
            }
        }
    }
    
    // ============================================================================
    // Scene_GameSelect
    // ============================================================================
    
    class Scene_GameSelect extends Scene_Base {
        initialize() {
            super.initialize();
            this._gameList = [];
            this._selectedIndex = 0;
        }
        
        create() {
            super.create();
            this.createBackground();
            this.createCRTEffect();
            this.createUI();
            this.setupGameList();
        }
        
        createBackground() {
            this._backgroundSprite = new Sprite();
            this._backgroundSprite.bitmap = new Bitmap(Graphics.width, Graphics.height);
            this._backgroundSprite.bitmap.fillAll('black');
            this.addChild(this._backgroundSprite);
        }
        
        createCRTEffect() {
            this._crtFilter = new PIXI.filters.CRTFilter({
                curvature: 2.0, lineWidth: 3.0, lineContrast: 0.3, verticalLine: false,
                noise: 0.2 * crtIntensity, noiseSize: 1.0, seed: Math.random(),
                vignetting: 0.3 * crtIntensity, vignettingAlpha: 1.0, vignettingBlur: 0.3, time: 0
            });
            
            this._glowFilter = new PIXI.filters.GlowFilter({
                distance: 10, outerStrength: 0.5 * crtIntensity, innerStrength: 0,
                color: 0xffd700, quality: 0.5 // Golden color
            });
            
            this.filters = [this._crtFilter, this._glowFilter];
            
            this._scanlines = new TilingSprite();
            this._scanlines.bitmap = this.createScanlineBitmap();
            this._scanlines.move(0, 0, Graphics.width, Graphics.height);
            this._scanlines.opacity = 50 * crtIntensity;
            this.addChild(this._scanlines);
        }
        
        createScanlineBitmap() {
            const bitmap = new Bitmap(1, 4);
            bitmap.fillRect(0, 0, 1, 2, 'black');
            return bitmap;
        }
        
        createUI() {
            this._titleSprite = new Sprite();
            this._titleSprite.bitmap = new Bitmap(Graphics.width, 100);
            this._titleSprite.bitmap.fontFace = arcadeFont;
            this._titleSprite.bitmap.fontSize = 32;
            this._titleSprite.bitmap.textColor = '#ffd700'; // Golden color
            this._titleSprite.bitmap.drawText(
                ArcadeManager.getText('gameSelect'), 0, 20, Graphics.width, 60, 'center'
            );
            this._titleSprite.y = 50;
            this.addChild(this._titleSprite);
            
            this._listSprite = new Sprite();
            this._listSprite.bitmap = new Bitmap(Graphics.width, 400);
            this._listSprite.bitmap.fontFace = arcadeFont;
            this._listSprite.y = 200;
            this.addChild(this._listSprite);
        }
        
        setupGameList() {
            this._gameList = Object.values(ArcadeManager._games);
            this.refreshGameList();
        }
        
        refreshGameList() {
            this._listSprite.bitmap.clear();
            this._listSprite.bitmap.fontSize = 24;
            
            const itemHeight = 50;
            const maxVisible = 6;
            const startIndex = Math.max(0, this._selectedIndex - Math.floor(maxVisible / 2));
            
            for (let i = 0; i < this._gameList.length; i++) {
                const game = this._gameList[i];
                const y = (i - startIndex) * itemHeight + 50;

                if(y < 0 || y > 400) continue; // Simple culling
                
                if (i === this._selectedIndex) {
                    this._listSprite.bitmap.fillRect(50, y - 5, Graphics.width - 100, itemHeight - 10, '#444400');
                    this._listSprite.bitmap.textColor = '#ffd700'; // Golden color
                } else {
                    this._listSprite.bitmap.textColor = '#ffffff';
                }
                
                this._listSprite.bitmap.drawText(game.name, 0, y, Graphics.width, itemHeight, 'center');
            }
        }
        
        update() {
            super.update();
            
            if (this._crtFilter) {
                this._crtFilter.time += 0.1;
            }
            
            if (Input.isTriggered('up')) {
                this._selectedIndex = Math.max(0, this._selectedIndex - 1);
                ArcadeManager.playSound('select');
                this.refreshGameList();
            } else if (Input.isTriggered('down')) {
                this._selectedIndex = Math.min(this._gameList.length - 1, this._selectedIndex + 1);
                ArcadeManager.playSound('select');
                this.refreshGameList();
            } else if (Input.isTriggered('ok')) {
                if (this._gameList[this._selectedIndex]) {
                    ArcadeManager.playSound('confirm');
                    this.playGame(this._gameList[this._selectedIndex].id);
                }
            } else if (Input.isTriggered('cancel')) {
                ArcadeManager.playSound('close');
                this.popScene();
            }
        }
        
        playGame(gameId) {
            SceneManager.push(Scene_Arcade);
            SceneManager.prepareNextScene(gameId);
        }
    }
    
    // ============================================================================
    // Scene_HighScores
    // ============================================================================
    
    class Scene_HighScores extends Scene_Base {
        initialize() {
            super.initialize();
            this._gameId = null;
            this._scores = [];
        }

        prepare(gameId) {
            this._gameId = gameId;
            this._scores = ArcadeManager.getHighScores(gameId);
        }
        
        create() {
            super.create();
            this.createBackground();
            this.createCRTEffect();
            this.createUI();
        }
        
        createBackground() {
            this._backgroundSprite = new Sprite();
            this._backgroundSprite.bitmap = new Bitmap(Graphics.width, Graphics.height);
            this._backgroundSprite.bitmap.fillAll('black');
            this.addChild(this._backgroundSprite);
        }
        
        createCRTEffect() {
            this._crtFilter = new PIXI.filters.CRTFilter({
                curvature: 2.0, lineWidth: 3.0, lineContrast: 0.3, verticalLine: false,
                noise: 0.2 * crtIntensity, noiseSize: 1.0, seed: Math.random(),
                vignetting: 0.3 * crtIntensity, vignettingAlpha: 1.0, vignettingBlur: 0.3, time: 0
            });
            
            this._glowFilter = new PIXI.filters.GlowFilter({
                distance: 10, outerStrength: 0.5 * crtIntensity, innerStrength: 0,
                color: 0xffd700, quality: 0.5 // Golden color
            });
            
            this.filters = [this._crtFilter, this._glowFilter];
            
            this._scanlines = new TilingSprite();
            this._scanlines.bitmap = this.createScanlineBitmap();
            this._scanlines.move(0, 0, Graphics.width, Graphics.height);
            this._scanlines.opacity = 50 * crtIntensity;
            this.addChild(this._scanlines);
        }
        
        createScanlineBitmap() {
            const bitmap = new Bitmap(1, 4);
            bitmap.fillRect(0, 0, 1, 2, 'black');
            return bitmap;
        }
        
        createUI() {
            this._titleSprite = new Sprite();
            this._titleSprite.bitmap = new Bitmap(Graphics.width, 100);
            this._titleSprite.bitmap.fontFace = arcadeFont;
            this._titleSprite.bitmap.fontSize = 28;
            this._titleSprite.bitmap.textColor = '#ffd700'; // Golden color
            this._titleSprite.bitmap.drawText(
                ArcadeManager.getText('highScores'), 0, 20, Graphics.width, 60, 'center'
            );
            this._titleSprite.y = 50;
            this.addChild(this._titleSprite);
            
            this._scoresSprite = new Sprite();
            this._scoresSprite.bitmap = new Bitmap(Graphics.width, 500);
            this._scoresSprite.bitmap.fontFace = arcadeFont;
            this._scoresSprite.y = 150;
            this.addChild(this._scoresSprite);
            
            this.refreshScores();
        }
        
        refreshScores() {
            this._scoresSprite.bitmap.clear();
            this._scoresSprite.bitmap.fontSize = 20;
            this._scoresSprite.bitmap.textColor = '#ffffff';
            
            const lineHeight = 40;
            
            this._scores.forEach((score, index) => {
                const y = index * lineHeight + 50;
                const rank = (index + 1).toString().padStart(2, ' ');
                
                this._scoresSprite.bitmap.drawText(`${rank}.`, 50, y, 50, lineHeight);
                this._scoresSprite.bitmap.drawText(score.initials, 150, y, 100, lineHeight);
                this._scoresSprite.bitmap.drawText(score.score.toString(), 300, y, 300, lineHeight, 'right');
            });
            
            if (this._scores.length === 0) {
                this._scoresSprite.bitmap.drawText('NO SCORES YET', 0, 100, Graphics.width, lineHeight, 'center');
            }
        }
        
        update() {
            super.update();
            
            if (this._crtFilter) {
                this._crtFilter.time += 0.1;
            }
            
            if (Input.isTriggered('ok') || Input.isTriggered('cancel') || TouchInput.isTriggered()) {
                ArcadeManager.playSound('close');
                this.popScene();
            }
        }
    }
    
    // ============================================================================
    // Plugin Commands
    // ============================================================================
    
    PluginManager.registerCommand(pluginName, 'playGame', args => {
        const gameId = args.gameId;
        const freePlay = args.freePlay === 'true';
        if (ArcadeManager._games[gameId]) {
            ArcadeManager.setFreePlay(freePlay);
            SceneManager.push(Scene_Arcade);
            SceneManager.prepareNextScene(gameId);
        } else {
            console.warn(`Arcade game not found: ${gameId}`);
        }
    });
    
    PluginManager.registerCommand(pluginName, 'showGameList', args => {
        SceneManager.push(Scene_GameSelect);
    });
    
    PluginManager.registerCommand(pluginName, 'showHighScores', args => {
        const gameId = args.gameId;
        if (ArcadeManager._games[gameId]) {
            SceneManager.push(Scene_HighScores);
            SceneManager.prepareNextScene(gameId);
        } else {
            // If no game is registered, maybe show a warning or a blank screen.
            // For now, log a warning.
            console.warn(`Cannot show high scores. Arcade game not found: ${gameId}`);
        }
    });
    
})();
