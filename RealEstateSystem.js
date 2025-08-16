/*:
 * @target MZ
 * @plugindesc Real Estate Management System v1.0.2
 * @author Nocoldiz + Gemini + ChatGPT + Claude
 * @url 
 * @help
 * ============================================================================
 * Real Estate Management Plugin for RPG Maker MZ
 * ============================================================================
 * * This plugin adds a comprehensive real estate system to your game where
 * players can buy, sell, and rent out properties across Europe.
 * * Features:
 * - 30 randomized properties across Europe
 * - Star rating system (1-5 stars)
 * - Real-time rent collection at midnight
 * - Market fluctuations affecting occupancy
 * - Different property types with varying capacities
 * - Currency conversion: 100 gold = 1 euro
 * - Pre-populated news history for immersive experience
 * - Daily hardcoded news events at 8AM
 * - Italian language support
 * * Plugin Commands:
 * - Open Real Estate Menu
 * - Check Daily Income
 * - Force Market Update (for testing)
 * * @param menuCommand
 * @text Menu Command Name
 * @desc Name of the real estate command in the menu
 * @default Real Estate
 * * @command openRealEstateMenu
 * @text Open Real Estate Menu
 * @desc Opens the real estate management interface
 * * @command checkDailyIncome
 * @text Check Daily Income
 * @desc Shows today's rental income summary
 * * @command checkNewsHistory
 * @text Check News History
 * @desc Shows recent market news
 * * @command forceNewsEvent
 * @text Force News Event
 * @desc Forces a news event to occur (for testing)
 */

(() => {
    'use strict';
    
    const pluginName = 'RealEstateSystem';
    
    // Language check function
    function isItalian() {
        return ConfigManager.language === "it";
    }
    const { News, Translations, RealNews } = window.NewsData;

    // Translation object

    
    // Get translation function
    function t(key, replacements = {}) {
        const lang = isItalian() ? 'it' : 'en';
        let text = Translations[lang][key] || Translations.en[key] || key;
        
        // Handle replacements
        Object.keys(replacements).forEach(placeholder => {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
        });
        
        return text;
    }
    
    // Property types with their characteristics
    const PROPERTY_TYPES = {
        'Simple House': { minCap: 1, maxCap: 4, basePrice: [15000, 25000, 40000, 60000, 85000] },
        'Apartment': { minCap: 1, maxCap: 6, basePrice: [20000, 35000, 55000, 80000, 110000] },
        'Villa': { minCap: 2, maxCap: 8, basePrice: [40000, 70000, 120000, 180000, 250000] },
        'Hotel': { minCap: 10, maxCap: 150, basePrice: [200000, 400000, 700000, 1200000, 2000000] },
        'Hostel': { minCap: 8, maxCap: 80, basePrice: [80000, 150000, 250000, 400000, 600000] },
        'Castle': { minCap: 5, maxCap: 30, basePrice: [300000, 600000, 1000000, 1800000, 3000000] },
        'Yacht': { minCap: 2, maxCap: 12, basePrice: [150000, 300000, 500000, 800000, 1500000] },
        'Restaurant': { minCap: 0, maxCap: 60, basePrice: [100000, 200000, 350000, 550000, 850000] },
        'Camper Van': { minCap: 1, maxCap: 4, basePrice: [25000, 40000, 60000, 85000, 120000] },
        'B&B': { minCap: 2, maxCap: 16, basePrice: [60000, 120000, 200000, 320000, 500000] }
    };
    
    // European locations with Italian Translations
    const LOCATIONS = {
        en: [
            'Paris, France', 'Rome, Italy', 'Barcelona, Spain', 'Berlin, Germany',
            'Amsterdam, Netherlands', 'Prague, Czech Republic', 'Vienna, Austria',
            'Lisbon, Portugal', 'Athens, Greece', 'Budapest, Hungary',
            'Copenhagen, Denmark', 'Stockholm, Sweden', 'Dublin, Ireland',
            'Brussels, Belgium', 'Warsaw, Poland', 'Zurich, Switzerland',
            'Edinburgh, Scotland', 'Oslo, Norway', 'Helsinki, Finland',
            'Venice, Italy', 'Nice, France', 'Munich, Germany',
            'Santorini, Greece', 'Dubrovnik, Croatia', 'Reykjavik, Iceland',
            'Malta', 'Luxembourg', 'Monaco', 'Ljubljana, Slovenia', 'Tallinn, Estonia'
        ],
        it: [
            'Parigi, Francia', 'Roma, Italia', 'Barcellona, Spagna', 'Berlino, Germania',
            'Amsterdam, Paesi Bassi', 'Praga, Repubblica Ceca', 'Vienna, Austria',
            'Lisbona, Portogallo', 'Atene, Grecia', 'Budapest, Ungheria',
            'Copenaghen, Danimarca', 'Stoccolma, Svezia', 'Dublino, Irlanda',
            'Bruxelles, Belgio', 'Varsavia, Polonia', 'Zurigo, Svizzera',
            'Edimburgo, Scozia', 'Oslo, Norvegia', 'Helsinki, Finlandia',
            'Venezia, Italia', 'Nizza, Francia', 'Monaco, Germania',
            'Santorini, Grecia', 'Dubrovnik, Croazia', 'Reykjavik, Islanda',
            'Malta', 'Lussemburgo', 'Monaco', 'Lubiana, Slovenia', 'Tallinn, Estonia'
        ]
    };
    
    function getLocations() {
        return isItalian() ? LOCATIONS.it : LOCATIONS.en;
    }

    // Real Estate Manager Class
    class RealEstateManager {
        constructor() {
            this.properties = [];
            this.ownedProperties = [];
            this.lastUpdateTime = null;
            this.lastHourlyUpdate = null;
            this.dailyIncome = 0;
            this.totalIncome = 0;
            this.newsHistory = [];
            this.activeEffects = [];
            this.currentHour = new Date().getHours();
            this.lastDailyNewsCheck = null; // Track last daily news check
            this.usedRealNewsIds = new Set(); // Track used real news to avoid duplicates
        }
        
        initialize() {
            this.generateProperties();
            this.generateInitialNews();
            this.lastUpdateTime = new Date();
            this.lastHourlyUpdate = new Date();
            this.lastDailyNewsCheck = new Date();
            this.startDailyUpdates();
            this.startHourlyUpdates();
        }
        
        // Parse date from DD/MM/YYYY format
        parseDateString(dateString) {
            const [day, month, year] = dateString.split('/').map(num => parseInt(num, 10));
            return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
        }
        
        // Parse date and create current year version (ignoring original year)
        parseDateToCurrentYear(dateString) {
            const [day, month, year] = dateString.split('/').map(num => parseInt(num, 10));
            const currentYear = new Date().getFullYear();
            return new Date(currentYear, month - 1, day); // Use current year instead
        }
        
        // Check if a date (MM/DD format) matches today
        isDateToday(dateString) {
            const [day, month] = dateString.split('/').map(num => parseInt(num, 10));
            const today = new Date();
            return today.getDate() === day && (today.getMonth() + 1) === month;
        }
        
        // Check if a date (MM/DD format) is within the last week
        isDateInLastWeek(dateString) {
            const newsDate = this.parseDateToCurrentYear(dateString);
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 3600000));
            
            // Also check previous year's date in case we're at year boundary
            const prevYearDate = new Date(newsDate.getFullYear() - 1, newsDate.getMonth(), newsDate.getDate());
            
            return (newsDate >= oneWeekAgo && newsDate <= now) || 
                   (prevYearDate >= oneWeekAgo && prevYearDate <= now);
        }
        
        // Check if we need to process daily news (at 8 AM)
        shouldProcessDailyNews() {
            const now = new Date();
            const today8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
            
            // If it's past 8 AM today and we haven't checked today yet
            if (now >= today8AM && 
                (!this.lastDailyNewsCheck || 
                 this.lastDailyNewsCheck < today8AM)) {
                return true;
            }
            
            return false;
        }
        
        // Process daily hardcoded news
        processDailyNews() {
            if (!RealNews || !Array.isArray(RealNews)) return;
            
            // Find news for today (ignoring year) that we haven't used yet
            const todaysNews = RealNews.filter(newsItem => {
                return this.isDateToday(newsItem.date) && !this.usedRealNewsIds.has(newsItem.title);
            });
            
            // Process each news item for today
            todaysNews.forEach(newsItem => {
                this.addRealNewsItem(newsItem);
                this.usedRealNewsIds.add(newsItem.title);
            });
            
            // Update the last check time
            this.lastDailyNewsCheck = new Date();
        }
        
        // Add a real news item to the news history
        addRealNewsItem(newsItem) {
            const lang = isItalian() ? 'it' : 'en';
            const title = lang === 'it' && newsItem.titleIt ? newsItem.titleIt : newsItem.title;
            const description = lang === 'it' && newsItem.desc_it ? newsItem.desc_it : newsItem.desc;
            
            // Determine location - use provided city or random location
            let location;
            if (newsItem.city && newsItem.city.trim() !== '') {
                location = newsItem.city;
            } else {
                const locations = getLocations();
                location = locations[Math.floor(Math.random() * locations.length)];
            }
            
            // Calculate effects based on soul tendency
            const soulEffect = newsItem.soul || 0;
            let priceEffect = 1;
            let occupancyEffect = 1;
            
            // Convert soul tendency to market effects
            if (soulEffect > 0) {
                // Positive soul = positive market effects
                priceEffect = 1 + (soulEffect * 0.02); // 2% per soul point
                occupancyEffect = 1 + (soulEffect * 0.03); // 3% per soul point
            } else if (soulEffect < 0) {
                // Negative soul = negative market effects
                priceEffect = 1 + (soulEffect * 0.02); // 2% per soul point (negative)
                occupancyEffect = 1 + (soulEffect * 0.03); // 3% per soul point (negative)
            }
            
            // Create the news entry
            const news = {
                text: title,
                fullText: description, // Store full description for detailed view
                location: location,
                category: 'real', // Mark as real news
                type: 'daily',
                timestamp: new Date(),
                priceEffect: priceEffect,
                occupancyEffect: occupancyEffect,
                soulTendencyModifier: soulEffect,
                isRealNews: true,
                isHistorical: false // Mark as current news
            };
            
            // Add to history
            this.newsHistory.unshift(news);
            if (this.newsHistory.length > 100) { // Increased limit for week-long storage
                this.newsHistory.pop();
            }
            
            // Apply effects to properties (1 week duration for real news - 168 hours)
            this.applyNewsEffects(news, 168);
            
            // Show notification if player is in game
            if (SceneManager._scene instanceof Scene_Map) {
                this.showNewsNotification(title);
            }
        }
        
        // Show news notification
        showNewsNotification(title) {
            $gameMessage.setBackground(1);
            $gameMessage.setPositionType(0);
            $gameMessage.add(`\\c[6]===== ${t('breakingNews')} =====\\c[0]`);
            $gameMessage.add(title);
        }
        
        generateInitialNews() {
            // Generate 3 days worth of procedural news (72 hours)
            const now = new Date();
            
            // Generate 15-20 news events over 3 days
            const newsCount = 15 + Math.floor(Math.random() * 6);
            
            for (let i = 0; i < newsCount; i++) {
                // Spread events across 3 days
                const hoursAgo = Math.floor(Math.random() * 72);
                const timestamp = new Date(now.getTime() - (hoursAgo * 3600000));
                
                const locations = getLocations();
                const location = locations[Math.floor(Math.random() * locations.length)];
                const eventCategory = this.selectEventCategory();
                const eventType = this.selectEventType(eventCategory);
                const event = News[eventCategory][eventType];
                
                // Generate news text
                let newsText = this.generateNewsText(event, location, eventType);
                
                // Create news entry
                const news = {
                    text: newsText,
                    location: location,
                    category: eventCategory,
                    type: eventType,
                    timestamp: timestamp,
                    priceEffect: event.priceEffect,
                    occupancyEffect: event.occupancyEffect,
                    isRealNews: false
                };
                
                this.newsHistory.push(news);
                
                // Apply effects if they're still active
                const hoursRemaining = event.duration - hoursAgo;
                if (hoursRemaining > 0) {
                    this.applyNewsEffects(news, hoursRemaining);
                }
            }
            
            // Add past real news (last 3 days)
            this.generatePastRealNews();
            
            // Sort news by timestamp (newest first)
            this.newsHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        
        // Generate past real news for the last week
        generatePastRealNews() {
            if (!RealNews || !Array.isArray(RealNews)) return;
            
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 3600000));
            
            RealNews.forEach(newsItem => {
                const newsDate = this.parseDateString(newsItem.date);
                
                // Only include news from the last week
                if (newsDate >= oneWeekAgo && newsDate <= now) {
                    // Set timestamp to 8 AM of that day
                    const timestamp = new Date(newsDate.getFullYear(), newsDate.getMonth(), newsDate.getDate(), 8, 0, 0);
                    
                    const lang = isItalian() ? 'it' : 'en';
                    const title = lang === 'it' && newsItem.titleIt ? newsItem.titleIt : newsItem.title;
                    const description = lang === 'it' && newsItem.desc_it ? newsItem.desc_it : newsItem.desc;
                    
                    // Determine location
                    let location;
                    if (newsItem.city && newsItem.city.trim() !== '') {
                        location = newsItem.city;
                    } else {
                        const locations = getLocations();
                        location = locations[Math.floor(Math.random() * locations.length)];
                    }
                    
                    // Calculate effects
                    const soulEffect = newsItem.soul || 0;
                    let priceEffect = 1;
                    let occupancyEffect = 1;
                    
                    if (soulEffect !== 0) {
                        priceEffect = 1 + (soulEffect * 0.02);
                        occupancyEffect = 1 + (soulEffect * 0.03);
                    }
                    
                    const news = {
                        text: title,
                        fullText: description,
                        location: location,
                        category: 'real',
                        type: 'daily',
                        timestamp: timestamp,
                        priceEffect: priceEffect,
                        occupancyEffect: occupancyEffect,
                        soulTendencyModifier: soulEffect,
                        isRealNews: true,
                        isHistorical: true // Mark as historical for initialization
                    };
                    
                    this.newsHistory.push(news);
                    this.usedRealNewsIds.add(newsItem.title);
                    
                    // Apply effects only if still active (168 hours = 1 week duration)
                    const hoursElapsed = (now - timestamp) / 3600000;
                    const hoursRemaining = 168 - hoursElapsed; // 1 week duration
                    if (hoursRemaining > 0) {
                        this.applyNewsEffects(news, hoursRemaining);
                    }
                }
            });
        }
        
        generateProperties() {
            const usedCombinations = new Set();
            
            for (let i = 0; i < 30; i++) {
                let property;
                do {
                    property = this.createRandomProperty(i);
                } while (usedCombinations.has(`${property.type}-${property.location}`));
                
                usedCombinations.add(`${property.type}-${property.location}`);
                this.properties.push(property);
            }
        }
        
        createRandomProperty(id) {
            const types = Object.keys(PROPERTY_TYPES);
            const type = types[Math.floor(Math.random() * types.length)];
            const locations = getLocations();
            const location = locations[Math.floor(Math.random() * locations.length)];
            const stars = Math.floor(Math.random() * 5) + 1;
            const typeData = PROPERTY_TYPES[type];
            const basePrice = typeData.basePrice[stars - 1];
            const priceVariation = 0.8 + Math.random() * 0.4; // ±20% variation
            
            return {
                id: id,
                name: this.generatePropertyName(type, location, stars),
                type: type,
                location: location,
                stars: stars,
                price: Math.floor(basePrice * priceVariation),
                maxOccupants: typeData.maxCap,
                currentOccupants: 0,
                rentPerOccupant: Math.floor((basePrice * priceVariation * 0.001) / 30), // ~0.1% daily
                isOwned: false,
                isForSale: true,
                isForRent: true,
                marketTrend: 0 // -1 to 1, affects occupancy changes
            };
        }
        calculateCombinedSoulTendency() {
            let totalModifier = 0;
            
            // Sum all active effects' soul tendency modifiers
            // Only count non-historical real news for soul tendency
            this.activeEffects.forEach(effect => {
                // Find the corresponding news item to check if it's historical
                const newsItem = this.newsHistory.find(news => news.timestamp === effect.newsId);
                const isHistorical = newsItem && newsItem.isHistorical;
                
                // Only apply soul tendency for non-historical news
                if (!isHistorical) {
                    if (effect.soulTendencyModifier) {
                        totalModifier += effect.soulTendencyModifier;
                    } else if (effect.category && effect.type && News[effect.category] && News[effect.category][effect.type]) {
                        const soulModifier = News[effect.category][effect.type].soulTendencyModifier || 0;
                        totalModifier += soulModifier;
                    }
                }
            });
            
            return totalModifier;
        }
        updateSoulTendencyVariable() {
            const totalModifier = this.calculateCombinedSoulTendency();
            const currentValue = $gameVariables.value(53) || 66666;
            
            // Calculate percentage change
            const percentageChange = totalModifier;
            const newValue = currentValue + (currentValue * percentageChange / 100);
            
            // Update variable 53
            $gameVariables.setValue(53, Math.round(newValue * 100) / 100); // Round to 2 decimal places
        }
        
        findEventCategoryByEffect(effect) {
            // Since we don't store category/type in activeEffects, we need to match by news timestamp
            const newsItem = this.newsHistory.find(news => news.timestamp === effect.newsId);
            return newsItem ? newsItem.category : null;
        }
        
        // Add this helper method to find event type by effect
        findEventTypeByEffect(effect) {
            // Since we don't store category/type in activeEffects, we need to match by news timestamp
            const newsItem = this.newsHistory.find(news => news.timestamp === effect.newsId);
            return newsItem ? newsItem.type : null;
        }
        generatePropertyName(type, location, stars) {
            const starNames = t('starLevels');
            const prefix = starNames[stars - 1];
            
            const suffixes = t('propertySuffixes');
            const suffix = suffixes[type][Math.floor(Math.random() * suffixes[type].length)];
            return `${prefix} ${suffix}`;
        }
        
        generateNewsText(event, location, eventType) {
            const lang = isItalian() ? 'it' : 'en';
            const templates = event.templates[lang];
            let text = templates[Math.floor(Math.random() * templates.length)];
            
            // Replace location
            text = text.replace(/{location}/g, location);
            
            // Handle specific replacements based on event arrays
            if (text.includes('{festival}') && event.festivals) {
                const festival = event.festivals[lang][Math.floor(Math.random() * event.festivals[lang].length)];
                text = text.replace(/{festival}/g, festival);
            }
            
            if (text.includes('{discovery}') && event.discoveries) {
                const discovery = event.discoveries[lang][Math.floor(Math.random() * event.discoveries[lang].length)];
                text = text.replace(/{discovery}/g, discovery);
            }
            
            if (text.includes('{disaster}') && event.disasters) {
                const disaster = event.disasters[lang][Math.floor(Math.random() * event.disasters[lang].length)];
                text = text.replace(/{disaster}/g, disaster);
            }
            
            if (text.includes('{celebrity}') && event.celebrities) {
                const celebrity = event.celebrities[lang][Math.floor(Math.random() * event.celebrities[lang].length)];
                text = text.replace(/{celebrity}/g, celebrity);
            }
            
            if (text.includes('{phenomenon}') && event.phenomenon) {
                const phenomenon = event.phenomenon[lang][Math.floor(Math.random() * event.phenomenon[lang].length)];
                text = text.replace(/{phenomenon}/g, phenomenon);
            }
            
            if (text.includes('{color}') && event.colors) {
                const color = event.colors[lang][Math.floor(Math.random() * event.colors[lang].length)];
                text = text.replace(/{color}/g, color);
            }
            
            if (text.includes('{food}') && event.foods) {
                const food = event.foods[lang][Math.floor(Math.random() * event.foods[lang].length)];
                text = text.replace(/{food}/g, food);
            }
            
            if (text.includes('{action}') && event.actions) {
                const action = event.actions[lang][Math.floor(Math.random() * event.actions[lang].length)];
                text = text.replace(/{action}/g, action);
            }
            
            if (text.includes('{animal}') && event.animals) {
                const animal = event.animals[lang][Math.floor(Math.random() * event.animals[lang].length)];
                text = text.replace(/{animal}/g, animal);
            }
            
            if (text.includes('{amount}')) {
                const amount = Math.floor(Math.random() * 450) + 50;
                text = text.replace(/{amount}/g, amount);
            }
            
            if (text.includes('{number}')) {
                if (text.includes(isItalian() ? 'licenziamenti' : 'layoffs')) {
                    const number = (Math.floor(Math.random() * 9) + 1) * 100;
                    text = text.replace(/{number}/, number);
                } else if (text.includes(isItalian() ? 'paperelle' : 'ducks')) {
                    const number = Math.floor(Math.random() * 9000) + 1000;
                    text = text.replace(/{number}/, number);
                } else {
                    const number = Math.floor(Math.random() * 100) + 1;
                    text = text.replace(/{number}/g, number);
                }
            }
            
            if (text.includes('{rank}')) {
                const rank = Math.floor(Math.random() * 10) + 1;
                text = text.replace(/{rank}/g, '#' + rank);
            }
            
            return text;
        }
        
        buyProperty(propertyId) {
            const property = this.properties.find(p => p.id === propertyId);
            if (!property || property.isOwned) return false;
            
            const effectivePrice = this.calculateEffectivePrice(property);
            const goldCost = effectivePrice * 100; // Convert euros to gold
            if ($gameParty.gold() < goldCost) return false;
            
            $gameParty.loseGold(goldCost);
            property.isOwned = true;
            property.isForSale = false;
            property.isForRent = true;
            property.currentOccupants = Math.floor(Math.random() * property.maxOccupants * 0.3);
            this.ownedProperties.push(property.id);
            
            return true;
        }
        
        sellProperty(propertyId) {
            const property = this.properties.find(p => p.id === propertyId);
            if (!property || !property.isOwned) return false;
            
            const effectivePrice = this.calculateEffectivePrice(property);
            const salePrice = Math.floor(effectivePrice * 0.9); // 90% of current market price
            const goldGain = salePrice * 100;
            
            $gameParty.gainGold(goldGain);
            property.isOwned = false;
            property.isForSale = true;
            property.isForRent = false;
            property.currentOccupants = 0;
            
            const index = this.ownedProperties.indexOf(property.id);
            if (index > -1) this.ownedProperties.splice(index, 1);
            
            return true;
        }
        
        toggleRentStatus(propertyId) {
            const property = this.properties.find(p => p.id === propertyId);
            if (!property || !property.isOwned) return false;
            
            property.isForRent = !property.isForRent;
            if (!property.isForRent) {
                property.currentOccupants = 0;
            }
            
            return true;
        }
        
        startDailyUpdates() {
            // For real game, you'd want to tie this to the game's time system
            // For now, this is just a placeholder
        }
        
        startHourlyUpdates() {
            // Check every minute if we've hit a new hour
            setInterval(() => {
                const now = new Date();
                if (now.getHours() !== this.currentHour) {
                    this.currentHour = now.getHours();
                    this.processHourlyUpdate();
                }
                
                // Check for daily news at 8 AM
                if (this.shouldProcessDailyNews()) {
                    this.processDailyNews();
                }
            }, 60000); // Check every minute
        }
        
        processHourlyUpdate() {
            // Clean up expired effects
            this.activeEffects = this.activeEffects.filter(effect => {
                effect.remainingHours--;
                return effect.remainingHours > 0;
            });
            
            // Chance for procedural news event (30% per hour)
            if (Math.random() < 0.3) {
                this.generateNewsEvent();
            }
            
            // Show news window if there are recent news
            if (SceneManager._scene instanceof Scene_Map && this.newsHistory.length > 0) {
                const recentNews = this.newsHistory.filter(news => {
                    const newsTime = new Date(news.timestamp);
                    const now = new Date();
                    return (now - newsTime) < 3600000; // Last hour
                });
                
                if (recentNews.length > 0) {
                    $gameMessage.setBackground(1);
                    $gameMessage.setPositionType(0);
                    $gameMessage.add(`\\c[6]===== ${t('breakingNews')} =====\\c[0]`);
                    recentNews.forEach(news => {
                        $gameMessage.add(news.text);
                    });
                }
            }
            
            this.save();
        }
        
        generateNewsEvent() {
            const locations = getLocations();
            const location = locations[Math.floor(Math.random() * locations.length)];
            const eventCategory = this.selectEventCategory();
            const eventType = this.selectEventType(eventCategory);
            const event = News[eventCategory][eventType];
            
            // Generate news text
            let newsText = this.generateNewsText(event, location, eventType);
            
            // Create news entry
            const news = {
                text: newsText,
                location: location,
                category: eventCategory,
                type: eventType,
                timestamp: new Date(),
                priceEffect: event.priceEffect,
                occupancyEffect: event.occupancyEffect,
                isRealNews: false
            };
            
            // Add to history
            this.newsHistory.unshift(news);
            if (this.newsHistory.length > 50) {
                this.newsHistory.pop();
            }
            
            // Apply effects to properties
            this.applyNewsEffects(news, event.duration);
        }
        
        selectEventCategory() {
            const rand = Math.random();
            if (rand < 0.35) return 'positive';
            if (rand < 0.60) return 'negative';
            if (rand < 0.75) return 'neutral';
            return 'surreal'; // 25% chance for surreal events
        }
        
        selectEventType(category) {
            const types = Object.keys(News[category]);
            return types[Math.floor(Math.random() * types.length)];
        }
        
        applyNewsEffects(news, duration) {
            // Create active effect
            const effect = {
                newsId: news.timestamp,
                location: news.location,
                priceEffect: news.priceEffect,
                occupancyEffect: news.occupancyEffect,
                remainingHours: duration,
                category: news.category,
                type: news.type,
                soulTendencyModifier: news.soulTendencyModifier || 0,
                isHistorical: news.isHistorical || false // Track if this is historical news
            };
            
            this.activeEffects.push(effect);
            
            // Apply immediate occupancy effects to affected properties
            this.properties.forEach(property => {
                if (property.location === news.location) {
                    if (news.occupancyEffect < 1) {
                        // Negative effect - people leave
                        const reduction = Math.floor(property.currentOccupants * (1 - news.occupancyEffect));
                        property.currentOccupants = Math.max(0, property.currentOccupants - reduction);
                    } else if (news.occupancyEffect > 1 && property.isForRent) {
                        // Positive effect - people arrive
                        const increase = Math.floor(property.maxOccupants * (news.occupancyEffect - 1) * 0.3);
                        property.currentOccupants = Math.min(property.maxOccupants, property.currentOccupants + increase);
                    }
                    
                    // Update market trend
                    property.marketTrend = Math.max(-1, Math.min(1, property.marketTrend + (news.priceEffect - 1)));
                }
            });
        }
        
        getActiveEffectsForLocation(location) {
            return this.activeEffects.filter(effect => effect.location === location);
        }
        
        calculateEffectivePrice(property) {
            const effects = this.getActiveEffectsForLocation(property.location);
            let priceMultiplier = 1;
            
            effects.forEach(effect => {
                priceMultiplier *= effect.priceEffect;
            });
            
            return Math.floor(property.price * priceMultiplier);
        }
        
        processDailyUpdate() {
            this.dailyIncome = 0;
            
            // Update market trends
            this.properties.forEach(property => {
                property.marketTrend = (Math.random() - 0.5) * 2; // -1 to 1
            });
            
            // Process owned properties
            this.ownedProperties.forEach(propertyId => {
                const property = this.properties.find(p => p.id === propertyId);
                if (!property || !property.isForRent) return;
                
                // Update occupancy based on market and property characteristics
                this.updateOccupancy(property);
                
                // Collect rent
                const dailyRent = property.currentOccupants * property.rentPerOccupant;
                this.dailyIncome += dailyRent;
                this.totalIncome += dailyRent;
            });
            
            // Convert euros to gold and add to party
            const goldIncome = Math.floor(this.dailyIncome * 100);
            $gameParty.gainGold(goldIncome);
            
            // Save the update
            this.save();
        }
        
        updateOccupancy(property) {
            const occupancyRate = property.currentOccupants / property.maxOccupants;
            let changeChance = 0.1; // Base 10% chance of change
            
            // Higher occupancy = higher turnover
            changeChance += occupancyRate * 0.3;
            
            // Property size affects stability (smaller = more stable)
            const sizeModifier = property.maxOccupants / 150;
            changeChance *= (0.5 + sizeModifier * 0.5);
            
            // Star rating affects attractiveness
            const starModifier = property.stars / 5;
            
            if (Math.random() < changeChance) {
                // Determine if occupants move in or out
                const marketInfluence = property.marketTrend * 0.3;
                const attractiveness = starModifier * 0.5 + marketInfluence;
                
                if (Math.random() < 0.5 + attractiveness) {
                    // Occupants move in
                    const maxIncrease = Math.ceil(property.maxOccupants * 0.2);
                    const increase = Math.floor(Math.random() * maxIncrease) + 1;
                    property.currentOccupants = Math.min(
                        property.currentOccupants + increase,
                        property.maxOccupants
                    );
                } else {
                    // Occupants move out
                    const maxDecrease = Math.ceil(property.currentOccupants * 0.3);
                    const decrease = Math.floor(Math.random() * maxDecrease) + 1;
                    property.currentOccupants = Math.max(
                        property.currentOccupants - decrease,
                        0
                    );
                }
            }
        }
        
        calculateDailyIncome() {
            let income = 0;
            this.ownedProperties.forEach(propertyId => {
                const property = this.properties.find(p => p.id === propertyId);
                if (property && property.isForRent) {
                    income += property.currentOccupants * property.rentPerOccupant;
                }
            });
            return income;
        }
        
        save() {
            $gameSystem.realEstateData = {
                properties: this.properties,
                ownedProperties: this.ownedProperties,
                lastUpdateTime: this.lastUpdateTime,
                lastHourlyUpdate: this.lastHourlyUpdate,
                dailyIncome: this.dailyIncome,
                totalIncome: this.totalIncome,
                newsHistory: this.newsHistory,
                activeEffects: this.activeEffects,
                currentHour: this.currentHour,
                lastDailyNewsCheck: this.lastDailyNewsCheck,
                usedRealNewsIds: Array.from(this.usedRealNewsIds)
            };
        }
        
        load() {
            const data = $gameSystem.realEstateData;
            if (data) {
                this.properties = data.properties || [];
                this.ownedProperties = data.ownedProperties || [];
                this.lastUpdateTime = data.lastUpdateTime ? new Date(data.lastUpdateTime) : new Date();
                this.lastHourlyUpdate = data.lastHourlyUpdate ? new Date(data.lastHourlyUpdate) : new Date();
                this.dailyIncome = data.dailyIncome || 0;
                this.totalIncome = data.totalIncome || 0;
                this.newsHistory = data.newsHistory || [];
                this.activeEffects = data.activeEffects || [];
                this.currentHour = data.currentHour !== undefined ? data.currentHour : new Date().getHours();
                this.lastDailyNewsCheck = data.lastDailyNewsCheck ? new Date(data.lastDailyNewsCheck) : null;
                this.usedRealNewsIds = new Set(data.usedRealNewsIds || []);
                
                // Clean up old news (older than 1 week)
                this.cleanupOldNews();
                
                // If no properties exist, initialize
                if (this.properties.length === 0) {
                    this.initialize();
                }
                
                // Check for missed daily news on load
                if (this.shouldProcessDailyNews()) {
                    this.processDailyNews();
                }
            } else {
                this.initialize();
            }
        }
        
        // Clean up news older than 1 week
        cleanupOldNews() {
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 3600000));
            
            // Remove old news from history
            this.newsHistory = this.newsHistory.filter(news => {
                const newsTime = new Date(news.timestamp);
                return newsTime >= oneWeekAgo;
            });
            
            // Remove expired effects
            this.activeEffects = this.activeEffects.filter(effect => {
                return effect.remainingHours > 0;
            });
            
            // Clean up used real news IDs for news older than 1 week
            if (RealNews && Array.isArray(RealNews)) {
                const validNewsIds = new Set();
                RealNews.forEach(newsItem => {
                    // Check if this news date (ignoring year) could still be relevant
                    if (this.isDateInLastWeek(newsItem.date)) {
                        validNewsIds.add(newsItem.title);
                    }
                });
                
                // Only keep IDs for news that could still be within the week window
                this.usedRealNewsIds = new Set([...this.usedRealNewsIds].filter(id => validNewsIds.has(id)));
            }
        }
    }
    
    // Scene_RealEstate - Main UI Scene
    class Scene_RealEstate extends Scene_MenuBase {
        create() {
            super.create();
            this.createHelpWindow();
            this.createGoldWindow();
            this.createPropertyListWindow();
            this.createPropertyDetailsWindow();
            this.createCommandWindow();
        }
        
        createHelpWindow() {
            const rect = this.helpWindowRect();
            this._helpWindow = new Window_Help(rect);
            this._helpWindow.setText(t('menuTitle'));
            this.addWindow(this._helpWindow);
        }
        
        createGoldWindow() {
            const rect = this.goldWindowRect();
            this._goldWindow = new Window_Gold(rect);
            this.addWindow(this._goldWindow);
        }
        
        goldWindowRect() {
            const ww = this.mainCommandWidth();
            const wh = this.calcWindowHeight(1, true);
            const wx = Graphics.boxWidth - ww;
            const wy = this.mainAreaTop();
            return new Rectangle(wx, wy, ww, wh);
        }
        
        createPropertyListWindow() {
            const rect = this.propertyListWindowRect();
            this._propertyListWindow = new Window_PropertyList(rect);
            this._propertyListWindow.setHandler('ok', this.onPropertyOk.bind(this));
            this._propertyListWindow.setHandler('cancel', this.popScene.bind(this));
            this._propertyListWindow.setHelpWindow(this._helpWindow);
            this.addWindow(this._propertyListWindow);
        }
        
        propertyListWindowRect() {
            const wx = 0;
            const wy = this.mainAreaTop() + this._goldWindow.height;
            const ww = Graphics.boxWidth / 2;
            const wh = this.mainAreaHeight() - this._goldWindow.height;
            return new Rectangle(wx, wy, ww, wh);
        }
        
        createPropertyDetailsWindow() {
            const rect = this.propertyDetailsWindowRect();
            this._propertyDetailsWindow = new Window_PropertyDetails(rect);
            this.addWindow(this._propertyDetailsWindow);
        }
        
        propertyDetailsWindowRect() {
            const wx = this._propertyListWindow.width;
            const wy = this.mainAreaTop() + this._goldWindow.height;
            const ww = Graphics.boxWidth - wx;
            const wh = this.mainAreaHeight() - this._goldWindow.height - this.calcWindowHeight(1, true);
            return new Rectangle(wx, wy, ww, wh);
        }
        
        createCommandWindow() {
            const rect = this.commandWindowRect();
            this._commandWindow = new Window_PropertyCommand(rect);
            this._commandWindow.setHandler('buy', this.commandBuy.bind(this));
            this._commandWindow.setHandler('sell', this.commandSell.bind(this));
            this._commandWindow.setHandler('info', this.commandInfo.bind(this));
            this._commandWindow.setHandler('cancel', this.onCommandCancel.bind(this));
            this._commandWindow.close();
            this._commandWindow.deactivate();
            this.addWindow(this._commandWindow);
        }
        
        commandWindowRect() {
            const wx = this._propertyDetailsWindow.x;
            const wy = this._propertyDetailsWindow.y + this._propertyDetailsWindow.height;
            const ww = this._propertyDetailsWindow.width;
            const wh = this.calcWindowHeight(1, true);
            return new Rectangle(wx, wy, ww, wh);
        }
        
        start() {
            super.start();
            // Ensure the manager is available
            ensureRealEstateManager();
            // Ensure property list window is focused and shows properties
            this._propertyListWindow.setDetailsWindow(this._propertyDetailsWindow);
            this._propertyListWindow.refresh();
            this._propertyListWindow.activate();
            this._propertyListWindow.select(0);
        }
        
        onPropertyOk() {
            const property = this._propertyListWindow.property();
            if (property) {
                this._commandWindow.setProperty(property);
                this._commandWindow.refresh();
                this._commandWindow.open();
                this._commandWindow.activate();
                this._commandWindow.select(0);
            }
        }
        
        commandBuy() {
            const property = this._propertyListWindow.property();
            if ($realEstateManager.buyProperty(property.id)) {
                SoundManager.playShop();
                this.refreshAllWindows();
                this.returnToPropertyList();
            } else {
                SoundManager.playBuzzer();
                this.returnToPropertyList();
            }
        }
        
        commandInfo() {
            const property = this._propertyListWindow.property();
            if (property) {
                $gameTemp.realEstateReturnScene = 'realEstate';
                $gameTemp.realEstateFilterLocation = property.location;
                SceneManager.push(Scene_RealEstateNews);
            }
        }
        
        commandSell() {
            const property = this._propertyListWindow.property();
            if ($realEstateManager.sellProperty(property.id)) {
                SoundManager.playShop();
                this.refreshAllWindows();
                this.returnToPropertyList();
            } else {
                SoundManager.playBuzzer();
            }
        }

        onCommandCancel() {
            this.returnToPropertyList();
        }
        
        returnToPropertyList() {
            this._commandWindow.close();
            this._commandWindow.deactivate();
            this._propertyListWindow.activate();
        }
        
        refreshAllWindows() {
            this._propertyListWindow.refresh();
            this._propertyDetailsWindow.refresh();
            this._goldWindow.refresh();
        }
    }
    
    // Scene_RealEstateNews - Separate News Scene
    class Scene_RealEstateNews extends Scene_MenuBase {
        create() {
            super.create();
            this.createHelpWindow();
            this.createNewsWindow();
        }

        createHelpWindow() {
            const rect = this.helpWindowRect();
            this._helpWindow = new Window_Help(rect);
            this._helpWindow.setText("");
            this.addWindow(this._helpWindow);
        }

        helpWindowRect() {
            const ww = Graphics.boxWidth;
            const wh = this.calcWindowHeight(4, false);
            const wx = 0;
            const wy = Graphics.boxHeight - wh;
            return new Rectangle(wx, wy, ww, wh);
        }

        createNewsWindow() {
            const rect = this.newsWindowRect();
            this._newsWindow = new Window_RealEstateNewsDetailed(rect);
            this._newsWindow.setHandler("cancel", this.popScene.bind(this));
            this._newsWindow.setHelpWindow(this._helpWindow);
            this.addWindow(this._newsWindow);
        }
        
        popScene() {
            if ($gameTemp.realEstateReturnScene === 'realEstate') {
                $gameTemp.realEstateReturnScene = null;
                $gameTemp.realEstateFilterLocation = null;
                SceneManager.goto(Scene_RealEstate);
            } else {
                super.popScene();
            }
        }
        
        newsWindowRect() {
            const helpWindowRect = this.helpWindowRect();
            const wx = 0;
            const wy = this.mainAreaTop();
            const ww = Graphics.boxWidth;
            const wh = helpWindowRect.y - wy;
            return new Rectangle(wx, wy, ww, wh);
        }

        start() {
            super.start();
            ensureRealEstateManager();
            
            $realEstateManager.updateSoulTendencyVariable();
            
            if ($gameTemp.realEstateFilterLocation) {
                this._newsWindow.setLocationFilter($gameTemp.realEstateFilterLocation);
            }
            
            this._newsWindow.activate();
            this._newsWindow.select(0);
            this._newsWindow.updateHelp();
        }
    }
    
    // Window_RealEstateNewsDetailed - Detailed news window with real news support
    class Window_RealEstateNewsDetailed extends Window_Selectable {
        initialize(rect) {
            super.initialize(rect);
            this._data = [];
            this.refresh();
            this.select(0);
        }

        maxItems() {
            return this._data ? this._data.length : 0;
        }
        
        setLocationFilter(location) {
            this._locationFilter = location;
            this.refresh();
            this.select(0);
        }
        
        item() {
            return this.maxItems() > 0 ? this._data[this.index()] : null;
        }

        makeItemList() {
            ensureRealEstateManager();
            const allNews = $realEstateManager ? $realEstateManager.newsHistory.slice(0, 50) : [];
            
            if (this._locationFilter) {
                this._data = allNews.filter(news => news.location === this._locationFilter);
            } else {
                this._data = allNews;
            }
        }

        drawItem(index) {
            const news = this._data[index];
            if (news) {
                const rect = this.itemLineRect(index);
                const timeDiff = new Date() - new Date(news.timestamp);
                const hoursAgo = Math.floor(timeDiff / 3600000);
                const timeText = hoursAgo === 0 ? t('justNow') : 
                                hoursAgo < 24 ? `${hoursAgo}${t('hoursAgo')}` : 
                                `${Math.floor(hoursAgo / 24)}${t('daysAgo')}`;
                
                // Draw time
                this.changeTextColor(ColorManager.systemColor());
                this.drawText(timeText, rect.x, rect.y, 100);
                
                // Draw news with color based on category or if it's real news
                if (news.isRealNews) {
                    this.changeTextColor(ColorManager.textColor(6)); // Yellow for real news
                } else if (news.category === 'positive') {
                    this.changeTextColor(ColorManager.powerUpColor());
                } else if (news.category === 'negative') {
                    this.changeTextColor(ColorManager.deathColor());
                } else if (news.category === 'surreal') {
                    this.changeTextColor(ColorManager.textColor(23)); // Purple for surreal
                } else {
                    this.resetTextColor();
                }
                
                // Clip headline text
                let headlineText = news.text;
                const maxChars = 32;
                if (headlineText.length > maxChars) {
                    headlineText = headlineText.substring(0, maxChars) + "...";
                }
                const headlineX = rect.x + 110;
                const headlineWidth = rect.width - 110;
                this.drawText(headlineText, headlineX, rect.y, headlineWidth);
            }
        }
        
        refresh() {
            this.makeItemList();
            super.refresh();
        }

        updateHelp() {
            if (this._helpWindow) {
                const newsItem = this.item();
                if (newsItem) {
                    // Use full text for real news if available, otherwise use regular text
                    const displayText = newsItem.fullText || newsItem.text;
                    const wrappedText = this.wordWrapText(displayText, this._helpWindow);
                    this._helpWindow.setText(wrappedText);
                } else {
                    this._helpWindow.setText("");
                }
            }
        }

        wordWrapText(text, window) {
            if (!text || !window) {
                return text || "";
            }
            const maxLineWidth = window.contentsWidth();
            const words = text.split(' ');
            let currentLine = '';
            let result = '';

            for (const word of words) {
                const testLine = currentLine.length > 0 ? currentLine + ' ' + word : word;
                if (window.textWidth(testLine) > maxLineWidth && currentLine.length > 0) {
                    result += currentLine + '\n';
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            result += currentLine;
            return result;
        }
    }

    // Window_PropertyList
    class Window_PropertyList extends Window_Selectable {
        initialize(rect) {
            super.initialize(rect);
            this._data = [];
            this._detailsWindow = null;
            this.refresh();
            this.select(0);
        }
        
        setDetailsWindow(detailsWindow) {
            this._detailsWindow = detailsWindow;
            this.updateDetails();
        }
        
        maxItems() {
            return this._data ? this._data.length : 0;
        }
        
        property() {
            return this._data && this.index() >= 0 ? this._data[this.index()] : null;
        }
        
        makeItemList() {
            ensureRealEstateManager();
            this._data = $realEstateManager ? $realEstateManager.properties : [];
        }
        
        drawItem(index) {
            const property = this._data[index];
            if (property) {
                const rect = this.itemLineRect(index);
                this.resetTextColor();
                if (property.isOwned) {
                    this.changeTextColor(ColorManager.powerUpColor());
                }
                this.drawText(property.name, rect.x, rect.y, rect.width - 60);
                this.drawText(this.getStars(property.stars), rect.x + rect.width - 60, rect.y, 60);
            }
        }
        
        getStars(rating) {
            return '★'.repeat(rating) + '☆'.repeat(5 - rating);
        }
        
        refresh() {
            this.makeItemList();
            super.refresh();
        }
        
        updateHelp() {
            if (this._helpWindow && this.property()) {
                const property = this.property();
                const status = property.isOwned ? t('owned') : t('available');
                this._helpWindow.setText(`${property.location} - ${status}`);
            }
        }
        
        select(index) {
            super.select(index);
            this.updateDetails();
        }
        
        updateDetails() {
            if (this._detailsWindow) {
                this._detailsWindow.setProperty(this.property());
            }
        }
    }
    
    // Window_PropertyDetails
    class Window_PropertyDetails extends Window_Base {
        initialize(rect) {
            super.initialize(rect);
            this._property = null;
        }
        
        setProperty(property) {
            if (this._property !== property) {
                this._property = property;
                this.refresh();
            }
        }
        
        refresh() {
            this.contents.clear();
            if (this._property) {
                this.drawPropertyDetails();
            }
        }
        
        drawPropertyDetails() {
            const lineHeight = this.lineHeight();
            const property = this._property;
            let y = 0;
            
            // Property name and type
            this.drawText(property.name, 0, y, this.innerWidth, 'center');
            y += lineHeight;
            
            this.drawText(`${t('type')}: ${t('propertyTypes')[property.type]}`, 0, y, this.innerWidth);
            y += lineHeight;
            
            // Location
            this.drawText(`${t('location')}: ${property.location}`, 0, y, this.innerWidth);
            y += lineHeight;
            
            // Stars
            this.drawText(`${t('rating')}: ` + this.getStars(property.stars), 0, y, this.innerWidth);
            y += lineHeight;
            
            // Price with market effects
            const effectivePrice = $realEstateManager.calculateEffectivePrice(property);
            this.changeTextColor(ColorManager.systemColor());
            this.drawText(`${t('price')}:`, 0, y, 120);
            this.resetTextColor();
            if (effectivePrice !== property.price) {
                this.drawText(`€${effectivePrice.toLocaleString()}`, 120, y, this.innerWidth - 240);
                this.changeTextColor(effectivePrice > property.price ? ColorManager.powerUpColor() : ColorManager.deathColor());
                const percentChange = Math.round(((effectivePrice - property.price) / property.price) * 100);
                this.drawText(`(${percentChange > 0 ? '+' : ''}${percentChange}%)`, this.innerWidth - 120, y, 120, 'right');
            } else {
                this.drawText(`€${property.price.toLocaleString()}`, 120, y, this.innerWidth - 120);
            }
            y += lineHeight;
            
            // Occupancy
            if (property.isOwned) {
                this.changeTextColor(ColorManager.systemColor());
                this.drawText(`${t('occupancy')}:`, 0, y, 120);
                this.resetTextColor();
                this.drawText(`${property.currentOccupants}/${property.maxOccupants}`, 120, y, this.innerWidth - 120);
                y += lineHeight;
                
                // Daily income
                this.changeTextColor(ColorManager.systemColor());
                this.drawText(`${t('dailyIncome')}:`, 0, y, 120);
                this.resetTextColor();
                const dailyIncome = property.currentOccupants * property.rentPerOccupant;
                this.drawText(`€${dailyIncome.toLocaleString()}`, 120, y, this.innerWidth - 120);
                y += lineHeight;
            }
            
            // Market trend and active effects
            this.changeTextColor(ColorManager.systemColor());
            this.drawText(`${t('market')}:`, 0, y, 120);
            const trend = property.marketTrend;
            const effects = $realEstateManager.getActiveEffectsForLocation(property.location);
            
            if (effects.length > 0) {
                this.changeTextColor(ColorManager.textColor(17)); // Light blue
                this.drawText(`${effects.length} ${t('activeEvents')}`, 120, y, this.innerWidth - 120);
            } else if (trend > 0.5) {
                this.changeTextColor(ColorManager.powerUpColor());
                this.drawText(t('hot'), 120, y, this.innerWidth - 120);
            } else if (trend < -0.5) {
                this.changeTextColor(ColorManager.deathColor());
                this.drawText(t('cold'), 120, y, this.innerWidth - 120);
            } else {
                this.resetTextColor();
                this.drawText(t('stable'), 120, y, this.innerWidth - 120);
            }
        }
        
        getStars(rating) {
            return '★'.repeat(rating) + '☆'.repeat(5 - rating);
        }
    }
    
    // Window_PropertyCommand
    class Window_PropertyCommand extends Window_HorzCommand {
        initialize(rect) {
            super.initialize(rect);
            this._property = null;
        }
        
        setProperty(property) {
            this._property = property;
            this.refresh();
        }
        
        makeCommandList() {
            if (this._property) {
                if (this._property.isOwned) {
                    this.addCommand(t('sell'), 'sell');
                } else {
                    this.addCommand(t('buy'), 'buy');
                }
                
                if ($realEstateManager) {
                    const effects = $realEstateManager.getActiveEffectsForLocation(this._property.location);
                    if (effects.length > 0) {
                        this.addCommand(t('info'), 'info');
                    }
                }
            }
        }
        
        maxCols() {
            if (this._property && $realEstateManager) {
                const effects = $realEstateManager.getActiveEffectsForLocation(this._property.location);
                const baseCommands = this._property.isOwned ? 2 : 1;
                return effects.length > 0 ? baseCommands + 1 : baseCommands;
            }
            return 2;
        }
    }
    
    // Global instance
    let $realEstateManager = null;
    
    // Plugin commands
    PluginManager.registerCommand(pluginName, 'openRealEstateMenu', args => {
        ensureRealEstateManager();
        SceneManager.push(Scene_RealEstate);
    });
    
    PluginManager.registerCommand(pluginName, 'checkDailyIncome', args => {
        ensureRealEstateManager();
        const income = $realEstateManager.calculateDailyIncome();
        const goldIncome = Math.floor(income * 100);
        $gameMessage.add(t('dailyIncomeMsg', { income: income, gold: goldIncome }));
        $gameMessage.add(t('propertiesOwnedMsg', { count: $realEstateManager.ownedProperties.length }));
    });
    
    PluginManager.registerCommand(pluginName, 'forceMarketUpdate', args => {
        ensureRealEstateManager();
        $realEstateManager.processDailyUpdate();
        $gameMessage.add(t('marketUpdatedMsg'));
    });
    
    PluginManager.registerCommand(pluginName, 'checkNewsHistory', args => {
        ensureRealEstateManager();
        SceneManager.push(Scene_RealEstateNews);
    });
    
    PluginManager.registerCommand(pluginName, 'forceNewsEvent', args => {
        ensureRealEstateManager();
        $realEstateManager.generateNewsEvent();
        $gameMessage.add(t('newsEventMsg'));
    });
    
    // Ensure Real Estate Manager exists
    function ensureRealEstateManager() {
        if (!$realEstateManager) {
            $realEstateManager = new RealEstateManager();
            $realEstateManager.load();
        }
    }
    
    // Initialize on new game
    const _DataManager_createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function() {
        _DataManager_createGameObjects.call(this);
        $realEstateManager = new RealEstateManager();
        $realEstateManager.initialize();
    };
    
    // Save/Load
    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        const contents = _DataManager_makeSaveContents.call(this);
        if ($realEstateManager) {
            $realEstateManager.save();
        }
        return contents;
    };
    
    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.call(this, contents);
        $realEstateManager = new RealEstateManager();
        $realEstateManager.load();
    };
    
})();