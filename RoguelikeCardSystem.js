/*:
 * @target MZ
 * @plugindesc RoguelikeCardSystem v1.2.0
 * @author YourName
 * @help
 * ============================================================================
 * Roguelike Card System for RPGMaker MZ
 * ============================================================================
 * 
 * This plugin adds a card-based battle system that activates when Switch 45
 * is ON. Players draw cards representing skills and items from a 40-card deck.
 * 
 * Features:
 * - Deck of 40 cards (skills + items)
 * - Hand of 5 cards with Hearthstone-style animations
 * - Energy system: cards cost energy instead of MP/TP
 * - Energy cost = (MP + TP) / 10, capped at 10
 * - Player starts with 1 energy, gains +1 max energy per turn (up to 10)
 * - Navigate cards with Left/Right arrows or A/D keys
 * - Visual card display with name, icon, and description
 * - Smooth animations and hover effects
 * 
 * @param cardWidth
 * @text Card Width
 * @type number
 * @default 150
 * @desc Width of each card in pixels
 * 
 * @param cardHeight
 * @text Card Height
 * @type number
 * @default 220
 * @desc Height of each card in pixels
 * 
 * @param handY
 * @text Hand Y Position
 * @type number
 * @default 380
 * @desc Y position of the card hand
 * 
 * @param deckX
 * @text Deck X Position
 * @type number
 * @default 700
 * @desc X position of the deck display
 * 
 * @param deckY
 * @text Deck Y Position
 * @type number
 * @default 50
 * @desc Y position of the deck display
 */

(() => {
    'use strict';
    
    const pluginName = 'RoguelikeCardSystem';
    const parameters = PluginManager.parameters(pluginName);
    const cardWidth = Number(parameters['cardWidth'] || 150);
    const cardHeight = Number(parameters['cardHeight'] || 220);
    const handY = Number(parameters['handY'] || 380);
    const deckX = Number(parameters['deckX'] || 700);
    const deckY = Number(parameters['deckY'] || 50);
    let _originalPartyMembers = [];
    let _actor2Skills = [];
    let _actor3Skills = [];
    // Energy Manager
    class EnergyManager {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.currentEnergy = 1;
            this.maxEnergy = 10;
            this.turnCount = 0;
        }
        
        startTurn() {
            this.turnCount++;
            // Gain 2 energy at start of each turn, capped at max
            this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + 2);
        }
        
        canAfford(cost) {
            return this.currentEnergy >= cost;
        }
        
        spendEnergy(cost) {
            if (this.canAfford(cost)) {
                this.currentEnergy -= cost;
                return true; 
            }
            return false;
        }
        
        addEnergy(amount) {
            this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + amount);
        }
        
        gainDrawEnergy() {
            // Gain 4 energy when using draw command
            this.addEnergy(4);
        }
    }
    
    // Card Class
    class Card {
        constructor(type, id, data) {
            this.type = type; // 'skill' or 'item'
            this.id = id;
            this.data = data;
            this.name = data.name;
            this.iconIndex = data.iconIndex;
            this.description = data.description;
            this.energyCost = this.calculateEnergyCost();
        }
        
        calculateEnergyCost() {
            let cost = 0;
            
            if (this.type === 'skill') {
                const skill = $dataSkills[this.id];
                cost = Math.floor((skill.mpCost + skill.tpCost) / 10);
            } else if (this.type === 'item') {
                const item = $dataItems[this.id];
                // Items have base cost of 1, but can be modified based on price
                cost = Math.max(1, Math.floor(item.price / 1000));
            }
            
            // Cap energy cost at 10
            return Math.min(10, Math.max(0, cost));
        }
        
        canUse(actor) {
            // Check if we have enough energy
            if (!window.$energyManager || !window.$energyManager.canAfford(this.energyCost)) {
                return false;
            }
            
            if (this.type === 'skill') {
                const skill = $dataSkills[this.id];
                if (!skill) return false;
                
                // Check if skill is usable (not just if actor knows it)
                if (skill.occasion === 3) return false; // Never usable
                if (skill.occasion === 2) return false; // Menu only
                
                // For battle, allow both "always" (0) and "battle only" (1) skills
                return skill.occasion === 0 || skill.occasion === 1;
            } else if (this.type === 'item') {
                const item = $dataItems[this.id];
                if (!item) return false;
                
                // Check item usability
                if (item.occasion === 3) return false; // Never usable
                if (item.occasion === 2) return false; // Menu only
                
                return item.occasion === 0 || item.occasion === 1;
            }
            
            return false;
        }
        
        needsTarget() {
            if (this.type === 'skill') {
                const skill = $dataSkills[this.id];
                return skill.scope === 1 || skill.scope === 3 || skill.scope === 7;
            } else if (this.type === 'item') {
                const item = $dataItems[this.id];
                return item.scope === 1 || item.scope === 3 || item.scope === 7;
            }
            return true;
        }
        
        createAction(actor) {
            const action = new Game_Action(actor);
    
            if (this.type === 'skill') {
                const skill = $dataSkills[this.id];
                if (!skill) {
                    console.log(`Error: Skill ${this.id} not found for card ${this.name}`);
                    return null;
                }
                action.setSkill(this.id);
            } else if (this.type === 'item') {
                const item = $dataItems[this.id];
                if (!item) {
                    console.log(`Error: Item ${this.id} not found for card ${this.name}`);
                    return null;
                }
                action.setItem(this.id);
            } else {
                console.log(`Error: Unknown card type ${this.type} for card ${this.name}`);
                return null;
            }
            
            // Ensure the action is marked as valid
            action._forcing = false;
            
            // Verify the action has the required data
            if (!action._item || !action._item.object()) {
                console.log(`Warning: Action created but item/skill data missing for ${this.name}`);
            }
            
            return action;
        }
    }
    
    // Enhanced Card Sprite Class with Animations
    class Sprite_Card extends Sprite {
        constructor(card, index, isSelected) {
            super();
            this.card = card;
            this.index = index;
            this._selected = isSelected;
            this._hover = false;
            this._animationTime = 0;
            this._targetX = 0;
            this._targetY = 0;
            this._targetRotation = 0;
            this._targetScale = 1;
            this._currentScale = 0.1;
            this._drawAnimation = 0;
            this._floating = Math.random() * Math.PI * 2;
            this._shakeAnimation = 0;
            this._particles = [];
            
            this.anchor.x = 0.5;
            this.anchor.y = 0.5;
            
            this.createBitmap();
            this.createParticleContainer();
            this.refresh();
            
            // Start with card scaled down for draw animation
            this.scale.x = 0.1;
            this.scale.y = 0.1;
            
            // Add initial particles for new card
            this.createDrawParticles();
        }
        
        createBitmap() {
            this.bitmap = new Bitmap(cardWidth, cardHeight);
        }
        
        createParticleContainer() {
            this._particleContainer = new Sprite();
            this._particleContainer.z = 200;
            this.addChild(this._particleContainer);
        }
        
        createDrawParticles() {
            for (let i = 0; i < 10; i++) {
                const particle = new Sprite();
                particle.bitmap = new Bitmap(8, 8);
                particle.bitmap.drawCircle(4, 4, 4, '#ffeb3b');
                particle.anchor.x = 0.5;
                particle.anchor.y = 0.5;
                particle.x = (Math.random() - 0.5) * 100;
                particle.y = (Math.random() - 0.5) * 100;
                particle.vx = (Math.random() - 0.5) * 4;
                particle.vy = (Math.random() - 0.5) * 4;
                particle.life = 30;
                particle.maxLife = 30;
                this._particles.push(particle);
                this._particleContainer.addChild(particle);
            }
        }
        
        refresh() {
            this.bitmap.clear();
            
            // Check if card can be afforded
            const canAfford = window.$energyManager && window.$energyManager.canAfford(this.card.energyCost);
            
            // Determine card rarity/type colors
            let frameGradient1 = '#666666';
            let frameGradient2 = '#333333';
            let bgGradient1 = '#ffffff';
            let bgGradient2 = '#e0e0e0';
            
            if (this.card.type === 'skill') {
                const skill = $dataSkills[this.card.id];
                // Color based on energy cost
                if (this.card.energyCost >= 7) {
                    // Epic skills (high energy cost)
                    frameGradient1 = '#9c27b0';
                    frameGradient2 = '#6a1b9a';
                    bgGradient1 = '#f3e5f5';
                    bgGradient2 = '#e1bee7';
                } else if (this.card.energyCost >= 4) {
                    // Rare skills
                    frameGradient1 = '#2196f3';
                    frameGradient2 = '#1565c0';
                    bgGradient1 = '#e3f2fd';
                    bgGradient2 = '#bbdefb';
                } else {
                    // Common skills
                    frameGradient1 = '#757575';
                    frameGradient2 = '#424242';
                    bgGradient1 = '#fafafa';
                    bgGradient2 = '#e0e0e0';
                }
            }
            
            if (this._selected) {
                // Golden highlight for selected
                frameGradient1 = '#ffc107';
                frameGradient2 = '#f57c00';
                bgGradient1 = '#fff8e1';
                bgGradient2 = '#ffecb3';
            }
            
            // Card shadow (multiple layers for depth)
            for (let i = 5; i > 0; i--) {
                const alpha = 0.05 * (6 - i);
                this.bitmap.fillRect(i, i, cardWidth - i, cardHeight - i, `rgba(0, 0, 0, ${alpha})`);
            }
            
            // Card background with gradient
            this.bitmap.gradientFillRect(0, 0, cardWidth, cardHeight, bgGradient1, bgGradient2, true);
            
            // Card frame with gradient
            for (let i = 0; i < 4; i++) {
                const alpha = 1 - (i * 0.2);
                this.bitmap.gradientFillRect(i, i, cardWidth - i * 2, cardHeight - i * 2, 
                    this.adjustColorAlpha(frameGradient1, alpha), 
                    this.adjustColorAlpha(frameGradient2, alpha), true);
            }
            
            // Inner card area
            this.bitmap.fillRect(6, 6, cardWidth - 12, cardHeight - 12, bgGradient1);
            
            // Card name section with ornate border
            this.bitmap.gradientFillRect(8, 8, cardWidth - 16, 40, 'rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.1)', false);
            this.bitmap.strokeRect(8, 8, cardWidth - 16, 40, frameGradient2, 1);
            
            // Card name
            this.bitmap.fontSize = 18;
            this.bitmap.fontBold = true;
            this.bitmap.outlineWidth = 3;
            this.bitmap.outlineColor = 'rgba(0, 0, 0, 0.5)';
            this.bitmap.textColor = '#ffffff';
            this.bitmap.drawText(this.card.name, 10, 14, cardWidth - 20, 30, 'center');
            
            // Decorative separator
            this.drawOrnatePattern(52, frameGradient1);
            
            // Icon section with glow effect
            const iconBgX = cardWidth / 2;
            const iconBgY = 85;
            
            // Icon glow
            for (let i = 30; i > 20; i--) {
                const alpha = 0.02 * (31 - i);
                this.bitmap.drawCircle(iconBgX, iconBgY, i, `rgba(255, 255, 255, ${alpha})`);
            }
            
            // Icon background circle
            this.bitmap.drawCircle(iconBgX, iconBgY, 28, 'rgba(0, 0, 0, 0.2)');
            this.bitmap.drawCircle(iconBgX, iconBgY, 25, 'rgba(255, 255, 255, 0.9)');
            
            // Icon
            const iconBitmap = ImageManager.loadSystem('IconSet');
            const pw = ImageManager.iconWidth;
            const ph = ImageManager.iconHeight;
            const sx = this.card.iconIndex % 16 * pw;
            const sy = Math.floor(this.card.iconIndex / 16) * ph;
            const dx = (cardWidth - pw) / 2;
            const dy = 68;
            
            iconBitmap.addLoadListener(() => {
                this.bitmap.blt(iconBitmap, sx, sy, pw, ph, dx, dy);
            });
            
            // Decorative separator
            this.drawOrnatePattern(118, frameGradient1);
            
            // Description box with inner shadow
            this.bitmap.fillRect(12, 125, cardWidth - 24, cardHeight - 140, 'rgba(0, 0, 0, 0.05)');
            this.bitmap.strokeRect(12, 125, cardWidth - 24, cardHeight - 140, 'rgba(255, 255, 255, 0.5)', 1);
            
            // Description
            this.bitmap.fontSize = 11;
            this.bitmap.fontBold = false;
            this.bitmap.outlineWidth = 2;
            this.bitmap.textColor = '#000000';
            const desc = this.card.description || '';
            const lines = this.wrapText(desc, cardWidth - 34);
            let y = 130;
            for (const line of lines) {
                if (y > cardHeight - 25) break;
                this.bitmap.drawText(line, 17, y, cardWidth - 34, 18, 'left');
                y += 18;
            }
            
            // Energy cost indicator with glow
            if (this.card.energyCost >= 0) {
                const costX = cardWidth - 25;
                const costY = 15;
                
                // Determine cost color based on affordability
                let costColor1 = canAfford ? '#00bcd4' : '#f44336';
                let costColor2 = canAfford ? '#0097a7' : '#c62828';
                let glowColor = canAfford ? 'rgba(0, 188, 212, 0.3)' : 'rgba(244, 67, 54, 0.3)';
                
                // Energy crystal glow
                for (let i = 18; i > 12; i--) {
                    const alpha = 0.05 * (19 - i);
                    this.bitmap.drawCircle(costX, costY, i, glowColor.replace('0.3', alpha.toString()));
                }
                
                // Energy crystal shape
                this.bitmap.drawCircle(costX, costY, 12, costColor2);
                this.bitmap.drawCircle(costX, costY, 10, costColor1);
                
                // Energy cost text
                this.bitmap.fontSize = 14;
                this.bitmap.fontBold = true;
                this.bitmap.textColor = '#ffffff';
                this.bitmap.outlineWidth = 2;
                this.bitmap.outlineColor = costColor2;
                this.bitmap.drawText(this.card.energyCost, costX - 12, costY - 10, 24, 20, 'center');
            }
            
            // Card type indicator
            this.bitmap.fontSize = 9;
            this.bitmap.fontBold = false;
            this.bitmap.textColor = frameGradient2;
            this.bitmap.outlineWidth = 0;
            this.bitmap.drawText('SKILL', 10, cardHeight - 20, 60, 15, 'left');
            
            // Show grayed out overlay if can't afford energy
            const actor = BattleManager.actor();
            if (actor && !canAfford) {
                this.bitmap.fillRect(0, 0, cardWidth, cardHeight, 'rgba(64, 64, 64, 0.5)');
                
                // Show energy requirement
                this.bitmap.fontSize = 12;
                this.bitmap.fontBold = true;
                this.bitmap.textColor = '#ff6b6b';
                this.bitmap.outlineWidth = 2;
                this.bitmap.outlineColor = '#000000';
                this.bitmap.drawText(`Need ${this.card.energyCost} Energy`, 0, cardHeight - 40, cardWidth, 20, 'center');
            }
        }
        
        adjustColorAlpha(color, alpha) {
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
            return color;
        }
        
        drawOrnatePattern(y, color) {
            const centerX = cardWidth / 2;
            const width = cardWidth - 40;
            
            // Main line
            this.bitmap.fillRect(20, y, width, 2, color);
            
            // Diamond decoration in center
            this.bitmap.drawCircle(centerX, y + 1, 4, color);
            this.bitmap.drawCircle(centerX, y + 1, 3, '#ffffff');
            
            // Side decorations
            this.bitmap.drawCircle(25, y + 1, 2, color);
            this.bitmap.drawCircle(cardWidth - 25, y + 1, 2, color);
        }
        
        wrapText(text, maxWidth) {
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            
            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const testWidth = this.bitmap.measureTextWidth(testLine);
                
                if (testWidth > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
            
            return lines;
        }
        
        update() {
            super.update();
            super.update();
    
            // Update animations
            this._animationTime += 0.016;
            this._drawAnimation = Math.min(1, this._drawAnimation + 0.08); // Slightly faster draw
            this._floating += 0.015; // Slower floating for less jitter
            
            // Update particles
            for (let i = this._particles.length - 1; i >= 0; i--) {
                const particle = this._particles[i];
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.vx *= 0.98;
                particle.vy *= 0.98;
                particle.life--;
                particle.opacity = (particle.life / particle.maxLife) * 255;
                particle.scale.x = particle.scale.y = particle.life / particle.maxLife;
                
                if (particle.life <= 0) {
                    this._particleContainer.removeChild(particle);
                    this._particles.splice(i, 1);
                }
            }
            
            // Much stiffer spring physics with higher damping
            const springStrength = 0.20; // Increased for faster settling
            const damping = 0.75; // Increased damping to reduce bounce
            const velocityThreshold = 0.5; // Stop micro-movements
            
            const dx = this._targetX - this.x;
            const dy = this._targetY - this.y;
            
            // Initialize velocities if they don't exist
            this._velocityX = this._velocityX || 0;
            this._velocityY = this._velocityY || 0;
            
            // Apply spring force with damping
            this._velocityX = this._velocityX * damping + dx * springStrength;
            this._velocityY = this._velocityY * damping + dy * springStrength;
            
            // Stop micro-movements to prevent jitter
            if (Math.abs(this._velocityX) < velocityThreshold && Math.abs(dx) < 2) {
                this._velocityX = 0;
                this.x = this._targetX;
            } else {
                this.x += this._velocityX;
            }
            
            if (Math.abs(this._velocityY) < velocityThreshold && Math.abs(dy) < 2) {
                this._velocityY = 0;
                this.y = this._targetY;
            } else {
                this.y += this._velocityY;
            }
            
            // Stiffer rotation with higher damping
            const rotationDiff = this._targetRotation - this.rotation;
            this._rotationVelocity = (this._rotationVelocity || 0) * 0.7 + rotationDiff * 0.25; // Higher damping
            
            // Stop micro-rotations
            if (Math.abs(this._rotationVelocity) < 0.01 && Math.abs(rotationDiff) < 0.02) {
                this._rotationVelocity = 0;
                this.rotation = this._targetRotation;
            } else {
                this.rotation += this._rotationVelocity;
            }
            
            // Stiffer scale animation with reduced overshoot
            const scaleDiff = this._targetScale - this._currentScale;
            this._scaleVelocity = (this._scaleVelocity || 0) * 0.6 + scaleDiff * 0.35; // Higher damping
            this._currentScale += this._scaleVelocity;
            
            // Stop micro-scaling
            if (Math.abs(this._scaleVelocity) < 0.01 && Math.abs(scaleDiff) < 0.01) {
                this._scaleVelocity = 0;
                this._currentScale = this._targetScale;
            }
            
            // Apply draw animation with reduced overshoot
            const drawProgress = this._drawAnimation;
            const overshoot = 1.1; // Reduced overshoot from 1.2 to 1.1
            const drawScale = drawProgress < 0.6 // Changed threshold
                ? this._currentScale * (0.1 + 1.5 * drawProgress * overshoot) // Reduced multiplier
                : this._currentScale * (overshoot - (overshoot - 1) * (drawProgress - 0.6) * 2.5); // Adjusted for new threshold
            
            this.scale.x = drawScale;
            this.scale.y = drawScale;
            
            // More controlled floating animation for selected cards
            const actor = BattleManager.actor();
            const canAfford = window.$energyManager && window.$energyManager.canAfford(this.card.energyCost);
            
            if (this._selected && canAfford) {
                // Smaller, more controlled floating effect
                const floatY = Math.sin(this._floating) * 2; // Reduced from 4 to 2
                const wobbleX = Math.sin(this._floating * 1.5) * 1; // Reduced from 2 to 1
                
                // Only apply floating if we're close to target position (prevents fighting with spring)
                if (Math.abs(this.x - this._targetX) < 5 && Math.abs(this.y - this._targetY) < 5) {
                    this.y = this._targetY + floatY;
                    this.x = this._targetX + wobbleX;
                    
                    // Smaller rotation wobble
                    this.rotation = this._targetRotation + Math.sin(this._floating * 2) * 0.01; // Reduced from 0.02
                }
                
                // Add selection particles less frequently
                if (Math.random() < 0.05) { // Reduced from 0.1
                    this.createSelectionParticle();
                }
            } else if (this._selected && !canAfford) {
                // Even more subtle pulse for unaffordable cards
                const pulse = Math.sin(this._floating * 3) * 0.02; // Reduced from 0.05
                this.scale.x = drawScale * (1 + pulse);
                this.scale.y = drawScale * (1 + pulse);
                
                // No position changes, just stay at target position
                this.x = this._targetX;
                this.y = this._targetY;
                this.rotation = this._targetRotation;
            }
        }
        
        createSelectionParticle() {
            if (this._particles.length > 20) return;
            
            const particle = new Sprite();
            particle.bitmap = new Bitmap(6, 6);
            
            // Star-shaped particle
            const ctx = particle.bitmap._context;
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
                const x = 3 + Math.cos(angle) * 3;
                const y = 3 + Math.sin(angle) * 3;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            
            particle.anchor.x = 0.5;
            particle.anchor.y = 0.5;
            particle.x = (Math.random() - 0.5) * cardWidth;
            particle.y = cardHeight / 2 + (Math.random() - 0.5) * 20;
            particle.vx = (Math.random() - 0.5) * 2;
            particle.vy = -Math.random() * 3 - 1;
            particle.life = 40;
            particle.maxLife = 40;
            particle.blendMode = 1;
            
            this._particles.push(particle);
            this._particleContainer.addChild(particle);
        }        
        
        setPosition(x, y, rotation = 0) {
            this._targetX = x;
            this._targetY = y;
            this._targetRotation = rotation;
            
            // Initialize velocities to prevent undefined behavior
            if (this._velocityX === undefined) this._velocityX = 0;
            if (this._velocityY === undefined) this._velocityY = 0;
            if (this._rotationVelocity === undefined) this._rotationVelocity = 0;
            if (this._scaleVelocity === undefined) this._scaleVelocity = 0;
            if (this._currentScale === undefined) this._currentScale = 1;
        }
        
        setSelected(selected) {
            const wasSelected = this._selected;
            this._selected = selected;
            this._targetScale = selected ? 1.1 : 1;
            
            // If selection changed, immediately stop any conflicting animations
            if (wasSelected !== selected) {
                this._velocityX = 0;
                this._velocityY = 0;
                this._rotationVelocity = 0;
                this._scaleVelocity = 0;
            }
            
            this.refresh();
        }
    }
    
    // Card Manager
    class CardManager {
        constructor() {
            this.deck = [];
            this.hand = [];
            this.discardPile = [];
            this.selectedIndex = 0;
        }
        
        initializeDeck() {
            this.deck = [];
            this.hand = [];
            this.discardPile = [];
            this.selectedIndex = 0;
            
            // Store original party and temporarily remove actors 2 and 3
            _originalPartyMembers = $gameParty._actors.slice();
            const actor2 = $gameParty.members()[1];
            const actor3 = $gameParty.members()[2];
            
            // Temporarily remove actors 2 and 3 from battle party
            if (actor2) {
                $gameParty.removeActor(actor2.actorId());
            }
            if (actor3) {
                $gameParty.removeActor(actor3.actorId());
            }
            
            // Clear previous skill selections
            _actor2Skills = [];
            _actor3Skills = [];
            
            // Check if we have a custom deck configuration from deck builder
            const customDeck = $dataSystem.deckBuilder;
            
            if (customDeck && customDeck.length > 0) {
                // Use custom deck from deck builder
                for (const cardConfig of customDeck) {
                    for (let i = 0; i < cardConfig.count; i++) {
                        const skill = $dataSkills[cardConfig.skillId];
                        if (skill) {
                            this.deck.push(new Card('skill', cardConfig.skillId, skill));
                        }
                    }
                }
            }
            
            // If no custom deck OR custom deck has less than 40 cards, fill with basic attack (skill 1)
            while (this.deck.length < 40) {
                const basicAttack = $dataSkills[1];
                if (basicAttack) {
                    this.deck.push(new Card('skill', 1, basicAttack));
                } else {
                    break; // Prevent infinite loop if basic attack doesn't exist
                }
            }
            
            // Shuffle deck
            this.shuffleDeck();
            
            // Draw initial hand with guaranteed low-cost card
            this.drawInitialHand();
        }

        getAllSkillsForActor(actor) {
            const skills = [];
            
            // Add class learnings
            const actorClass = $dataClasses[actor._classId];
            if (actorClass && actorClass.learnings) {
                for (const learning of actorClass.learnings) {
                    const skill = $dataSkills[learning.skillId];
                    if (skill && this.isSkillUsableInBattle(skill)) {
                        skills.push(skill);
                    }
                }
            }
            
            // Add already learned skills
            for (const skillId of actor._skills) {
                const skill = $dataSkills[skillId];
                if (skill && this.isSkillUsableInBattle(skill) && 
                    !skills.some(s => s.id === skillId)) {
                    skills.push(skill);
                }
            }
            
            return skills;
        }
        
        selectRandomSkills(skillArray, count) {
            if (skillArray.length === 0) return [];
            
            const selected = [];
            const available = skillArray.slice(); // Copy array
            
            for (let i = 0; i < count && available.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * available.length);
                selected.push(available[randomIndex]);
                available.splice(randomIndex, 1);
            }
            
            // If we need more skills but don't have enough unique ones, repeat
            while (selected.length < count && skillArray.length > 0) {
                const randomSkill = skillArray[Math.floor(Math.random() * skillArray.length)];
                selected.push(randomSkill);
            }
            
            return selected;
        }
        isSkillUsableInBattle(skill) {
            if (!skill) return false;
    
            // Filter out never usable and menu-only skills
            if (skill.occasion === 3) return false; // Never usable
            if (skill.occasion === 2) return false; // Menu only
            
            // Allow skills that are usable in battle (occasion 0 = always, occasion 1 = battle only)
            return skill.occasion === 0 || skill.occasion === 1;
        }
        drawInitialHand() {
            // First, try to find and guarantee at least one low-cost card (0-1 energy)
            const lowCostCards = [];
            const otherCards = [];
            
            // Separate deck into low-cost and other cards
            for (let i = 0; i < this.deck.length; i++) {
                const card = this.deck[i];
                if (card.energyCost <= 1) {
                    lowCostCards.push({card: card, index: i});
                } else {
                    otherCards.push({card: card, index: i});
                }
            }
            
            // Ensure we have at least one low-cost card
            if (lowCostCards.length === 0) {
                // If no low-cost cards exist, create a basic attack card
                const basicAttack = $dataSkills[1];
                if (basicAttack) {
                    const basicCard = new Card('skill', 1, basicAttack);
                    // Force energy cost to 1 if it's higher
                    if (basicCard.energyCost > 1) {
                        basicCard.energyCost = 1;
                    }
                    this.deck.unshift(basicCard); // Add to front of deck
                    lowCostCards.push({card: basicCard, index: 0});
                }
            }
            
            // Draw one guaranteed low-cost card first
            if (lowCostCards.length > 0) {
                const randomLowCost = lowCostCards[Math.floor(Math.random() * lowCostCards.length)];
                this.hand.push(randomLowCost.card);
                this.deck.splice(randomLowCost.index, 1);
                
                // Update indices for remaining cards after removal
                for (let i = 0; i < otherCards.length; i++) {
                    if (otherCards[i].index > randomLowCost.index) {
                        otherCards[i].index--;
                    }
                }
                for (let i = 0; i < lowCostCards.length; i++) {
                    if (lowCostCards[i].index > randomLowCost.index) {
                        lowCostCards[i].index--;
                    }
                }
            }
            
            // Draw the remaining 2 cards normally
            this.drawCards(2);
            
            // Verify we have at least one playable card (just in case)
            let hasPlayableCard = false;
            for (const card of this.hand) {
                if (card.energyCost <= 1) {
                    hasPlayableCard = true;
                    break;
                }
            }
            
            // If somehow we still don't have a playable card, force one
            if (!hasPlayableCard && this.hand.length > 0) {
                // Replace the highest cost card with a basic attack
                let highestCostIndex = 0;
                let highestCost = this.hand[0].energyCost;
                
                for (let i = 1; i < this.hand.length; i++) {
                    if (this.hand[i].energyCost > highestCost) {
                        highestCost = this.hand[i].energyCost;
                        highestCostIndex = i;
                    }
                }
                
                // Replace with basic attack
                const basicAttack = $dataSkills[1];
                if (basicAttack) {
                    const basicCard = new Card('skill', 1, basicAttack);
                    basicCard.energyCost = 1;
                    
                    // Put the replaced card back in deck
                    this.deck.push(this.hand[highestCostIndex]);
                    this.hand[highestCostIndex] = basicCard;
                    
                    // Reshuffle deck
                    this.shuffleDeck();
                }
            }
        }
        
        shuffleDeck() {
            for (let i = this.deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
            }
        }
        
        drawCards(count) {
            for (let i = 0; i < count; i++) {
                if (this.deck.length === 0) {
                    // Reshuffle discard pile into deck
                    this.deck = this.discardPile;
                    this.discardPile = [];
                    this.shuffleDeck();
                }
                
                if (this.deck.length > 0 && this.hand.length < 5) {
                    this.hand.push(this.deck.pop());
                }
            }
        }
        
        playCard(index) {
            if (index >= 0 && index < this.hand.length) {
                const card = this.hand[index];
                this.hand.splice(index, 1);
                this.discardPile.push(card);
                
                if (this.selectedIndex >= this.hand.length) {
                    this.selectedIndex = Math.max(0, this.hand.length - 1);
                }
                
                return card;
            }
            return null;
        }
        
        getCurrentCard() {
            return this.hand[this.selectedIndex] || null;
        }
        initializeCustomDeck(){
            this.deck = [];
            this.hand = [];
            this.discardPile = [];
            this.selectedIndex = 0;
            
            // Store original party and remove actors 2 and 3 for battle
            _originalPartyMembers = $gameParty._actors.slice();
            const actor2 = $gameParty.members()[1];
            const actor3 = $gameParty.members()[2];
            
            if (actor2) {
                $gameParty.removeActor(actor2.actorId());
            }
            if (actor3) {
                $gameParty.removeActor(actor3.actorId());
            }
            
            // Load custom deck from game variables
            const customDeck = $gameSystem.deckBuilderData || this.getDefaultDeck();
            
            // Create cards from custom deck configuration
            for (const cardConfig of customDeck) {
                for (let i = 0; i < cardConfig.count; i++) {
                    const skill = $dataSkills[cardConfig.skillId];
                    if (skill) {
                        this.deck.push(new Card('skill', cardConfig.skillId, skill));
                    }
                }
            }
            
            // Ensure we have exactly 40 cards
            while (this.deck.length < 40) {
                const basicAttack = $dataSkills[1];
                if (basicAttack) {
                    this.deck.push(new Card('skill', 1, basicAttack));
                }
            }
            
            this.shuffleDeck();
            this.drawInitialHand();
        }
        getDefaultDeck () {
            const defaultDeck = [];
            const actor1 = $gameParty.members()[0];
            
            if (actor1) {
                const actor1Skills = this.getAllSkillsForActor(actor1);
                for (const skill of actor1Skills) {
                    defaultDeck.push({
                        skillId: skill.id,
                        count: 3,
                        learnedBy: [actor1.actorId()]
                    });
                }
            }
            
            // Fill remaining slots with basic attack
            const basicAttackCount = Math.max(0, 40 - (defaultDeck.length * 3));
            if (basicAttackCount > 0) {
                defaultDeck.push({
                    skillId: 1,
                    count: basicAttackCount,
                    learnedBy: [1] // Assuming actor 1 is ID 1
                });
            }
            
            return defaultDeck;       
        }
        selectNext() {
            if (this.hand.length > 0) {
                this.selectedIndex = (this.selectedIndex + 1) % this.hand.length;
            }
        }
        
        selectPrevious() {
            if (this.hand.length > 0) {
                this.selectedIndex = (this.selectedIndex - 1 + this.hand.length) % this.hand.length;
            }
        }
    }
    
    // Store managers globally for scene access
    window.$cardManager = null;
    window.$energyManager = null;
    function restoreOriginalParty() {
        if (_originalPartyMembers.length > 0) {
            // Restore original party members
            $gameParty._actors = _originalPartyMembers.slice();
            
            // Give experience to actors 2 and 3 if they were in the original party
            const exp = BattleManager._rewards ? BattleManager._rewards.exp : 0;
            if (exp > 0) {
                const actor2 = $gameParty.members()[1];
                const actor3 = $gameParty.members()[2];
                
                if (actor2) {
                    actor2.gainExp(exp);
                }
                if (actor3) {
                    actor3.gainExp(exp);
                }
            }
            
            // Clear stored data
            _originalPartyMembers = [];
            _actor2Skills = [];
            _actor3Skills = [];
        }
    }
    
    // Battle Scene modifications
    const _Scene_Battle_create = Scene_Battle.prototype.create;
    Scene_Battle.prototype.create = function() {
        _Scene_Battle_create.call(this);
        
        if ($gameSwitches.value(45)) {
            window.$cardManager = new CardManager();
            window.$energyManager = new EnergyManager();
            this._cardSprites = [];
            this.createCardDisplay();
        }
    };
    
    const _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function() {
        _Scene_Battle_start.call(this);
        
        if ($gameSwitches.value(45) && window.$cardManager && window.$energyManager) {
            window.$cardManager.initializeDeck();
            window.$energyManager.reset();
            this.refreshCardDisplay();
        }
    };
    
// Modify the Scene_Battle terminate method (replace the existing one)
const _Scene_Battle_terminate = Scene_Battle.prototype.terminate;
Scene_Battle.prototype.terminate = function() {
    // Restore party before terminating if card system was active
    if ($gameSwitches.value(45)) {
        restoreOriginalParty();
    }
    
    _Scene_Battle_terminate.call(this);
    window.$cardManager = null;
    window.$energyManager = null;
};
const _BattleManager_makeRewards = BattleManager.makeRewards;
BattleManager.makeRewards = function() {
    _BattleManager_makeRewards.call(this);
    
    // If card system is active, ensure actors 2 and 3 get experience
    if ($gameSwitches.value(45) && _originalPartyMembers.length > 1) {
        const exp = this._rewards.exp;
        
        // Temporarily restore party to give experience
        const currentParty = $gameParty._actors.slice();
        $gameParty._actors = _originalPartyMembers.slice();
        
        // Give experience to all original party members
        for (const member of $gameParty.allMembers()) {
            if (member) {
                member.gainExp(exp);
            }
        }
        
        // Restore the modified party for display purposes
        $gameParty._actors = currentParty;
    }
};
    // Hook into turn start to refresh energy
    const _BattleManager_startTurn = BattleManager.startTurn;
    BattleManager.startTurn = function() {
        _BattleManager_startTurn.call(this);
        
        if ($gameSwitches.value(45) && window.$energyManager && this._subject && this._subject.isActor()) {
            window.$energyManager.startTurn();
            // Refresh card display to update energy costs
            if (SceneManager._scene instanceof Scene_Battle) {
                SceneManager._scene.refreshCardDisplay();
            }
        }
    };
    Scene_Battle.prototype.createCardDisplay = function() {
    
        // Create deck overlay
        this._deckSprite = new Sprite();
        this._deckSprite.bitmap = new Bitmap(120, 80);
        this._deckSprite.x = deckX;
        this._deckSprite.y = deckY;
        this._deckSprite.z = -10; // Set low z-index
        this._spriteset.addChild(this._deckSprite); // Add to spriteset instead of scene
        
        // Create energy display (replaces discard pile display)
        this._energySprite = new Sprite();
        this._energySprite.bitmap = new Bitmap(120, 80);
        this._energySprite.x = deckX;
        this._energySprite.y = deckY + 90;
        this._energySprite.z = -10; // Set low z-index
        this._spriteset.addChild(this._energySprite); // Add to spriteset instead of scene
    
        // Create health display
        this._healthSprite = new Sprite();
        this._healthSprite.bitmap = new Bitmap(120, 80);
        this._healthSprite.x = deckX;
        this._healthSprite.y = deckY + 180; // Position below energy display
        this._healthSprite.z = -10; // Set low z-index
        this._spriteset.addChild(this._healthSprite); // Add to spriteset instead of scene
                
        // Create hand container
        this._handContainer = new Sprite();
        this._handContainer.y = handY;
        this._handContainer.z = -10; // Set low z-index
        this._spriteset.addChild(this._handContainer); // Add to spriteset instead of scene
    };
    
    Scene_Battle.prototype.refreshCardDisplay = function() {
        if (!window.$cardManager || !window.$energyManager) return;
        
        // Update deck display
        this._deckSprite.bitmap.clear();
        this._deckSprite.bitmap.fontSize = 18;
        this._deckSprite.bitmap.fillRect(0, 0, 120, 80, '#2c3e50');
        this._deckSprite.bitmap.strokeRect(0, 0, 120, 80, '#34495e', 3);
        this._deckSprite.bitmap.textColor = '#ecf0f1';
        this._deckSprite.bitmap.fontBold = true;
        this._deckSprite.bitmap.drawText('DECK', 0, 10, 120, 30, 'center');
        this._deckSprite.bitmap.fontSize = 24;
        this._deckSprite.bitmap.drawText(window.$cardManager.deck.length, 0, 35, 120, 30, 'center');
        
        // Update energy display
        this.refreshEnergyDisplay();
        this.refreshHealthDisplay();
        // Clear existing card sprites
        for (const sprite of this._cardSprites) {
            this._handContainer.removeChild(sprite);
        }
        this._cardSprites = [];
        
        // Create card sprites for hand
        const cardCount = window.$cardManager.hand.length;
        
        for (let i = 0; i < cardCount; i++) {
            const card = window.$cardManager.hand[i];
            const isSelected = i === window.$cardManager.selectedIndex;
            
            // Create card sprite
            const sprite = new Sprite_Card(card, i, isSelected);
            
            // Position the card properly from the start
            this.positionCard(sprite, i, cardCount, isSelected);
            
            // Set initial position immediately (no animation for refresh)
            sprite.x = sprite._targetX;
            sprite.y = sprite._targetY;
            sprite.rotation = sprite._targetRotation;
            
            this._handContainer.addChild(sprite);
            this._cardSprites.push(sprite);
        }
        
        // Sort sprites by z-order
        this._handContainer.children.sort((a, b) => (a.z || 0) - (b.z || 0));
    };
    Scene_Battle.prototype.refreshHealthDisplay = function() {
        if (!this._healthSprite) return;
        
        const actor = BattleManager.actor();
        if (!actor) return;
        
        // Update health display
        this._healthSprite.bitmap.clear();
        this._healthSprite.bitmap.fontSize = 18;
        
        // Health bar gradient background
        const healthRatio = actor.hp / actor.mhp;
        let healthColor1, healthColor2;
        
        if (healthRatio > 0.7) {
            healthColor1 = '#4caf50'; // Green
            healthColor2 = '#388e3c';
        } else if (healthRatio > 0.3) {
            healthColor1 = '#ff9800'; // Orange
            healthColor2 = '#f57c00';
        } else {
            healthColor1 = '#f44336'; // Red
            healthColor2 = '#c62828';
        }
        
        this._healthSprite.bitmap.gradientFillRect(0, 0, 120, 80, healthColor1, healthColor2, true);
        this._healthSprite.bitmap.strokeRect(0, 0, 120, 80, healthColor2, 3);
        
        // Health heart glow effect
        for (let i = 60; i > 40; i -= 2) {
            const alpha = 0.02 * (61 - i);
            this._healthSprite.bitmap.drawCircle(60, 40, i, `rgba(255, 255, 255, ${alpha})`);
        }
        
        this._healthSprite.bitmap.textColor = '#ffffff';
        this._healthSprite.bitmap.fontBold = true;
        this._healthSprite.bitmap.outlineWidth = 2;
        this._healthSprite.bitmap.outlineColor = '#000000';
        this._healthSprite.bitmap.drawText('HEALTH', 0, 5, 120, 20, 'center');
        
        // Current/Max health display
        this._healthSprite.bitmap.fontSize = 20;
        const healthText = `${actor.hp}/${actor.mhp}`;
        this._healthSprite.bitmap.drawText(healthText, 0, 25, 120, 30, 'center');
        
        // Health bar visualization
        const barWidth = 80;
        const barHeight = 8;
        const barX = 20;
        const barY = 60;
        
        // Background bar
        this._healthSprite.bitmap.fillRect(barX, barY, barWidth, barHeight, '#333333');
        this._healthSprite.bitmap.strokeRect(barX, barY, barWidth, barHeight, '#666666', 1);
        
        // Health bar fill
        const fillWidth = Math.floor(barWidth * healthRatio);
        if (fillWidth > 0) {
            this._healthSprite.bitmap.gradientFillRect(barX, barY, fillWidth, barHeight, 
                healthColor1, healthColor2, false);
        }
    };
    Scene_Battle.prototype.positionCard = function(sprite, index, cardCount, isSelected) {
        const centerX = Graphics.width / 2;
        const baseY = 0;
        const cardSpacing = 120; // Increased spacing for better fan effect
        const fanAngle = 15; // Increased fan angle
        const arcHeight = 40; // Height of the arc for non-selected cards
        
        // Calculate position - create proper fan spread
        let normalizedPos, x, y, rotation;
        
        if (cardCount === 1) {
            // Single card - center it
            normalizedPos = 0;
            x = centerX;
            y = isSelected ? baseY - 60 : baseY;
            rotation = 0;
        } else {
            // Multiple cards - fan them out
            normalizedPos = (index / (cardCount - 1)) - 0.5; // Range from -0.5 to 0.5
            
            // X position with proper spacing
            x = centerX + normalizedPos * cardSpacing * Math.min(cardCount / 2, 2);
            
            // Y position with arc effect
            if (isSelected) {
                y = baseY - 60; // Selected card elevated
            } else {
                // Create arc - cards at edges are lower
                const arcProgress = Math.abs(normalizedPos) * 2; // 0 at center, 1 at edges
                y = baseY + arcHeight * arcProgress;
            }
            
            // Rotation for fan effect
            if (isSelected) {
                rotation = 0; // Selected card upright
            } else {
                rotation = normalizedPos * fanAngle * Math.PI / 180;
            }
        }
        
        sprite.setPosition(x, y, rotation);
        
        // Set z-order (selected card on top)
        if (isSelected) {
            sprite.z = 1000;
        } else {
            // Cards closer to center have higher z-order
            sprite.z = 100 - Math.abs(normalizedPos) * 50;
        }
    };
    
    Scene_Battle.prototype.updateCardSelection = function() {
        if (!window.$cardManager || !$gameSwitches.value(45)) return;
        
        const cardCount = window.$cardManager.hand.length;
        
        // Update card positions and selection
        for (let i = 0; i < this._cardSprites.length; i++) {
            const isSelected = i === window.$cardManager.selectedIndex;
            const sprite = this._cardSprites[i];
            
            sprite.setSelected(isSelected);
            
            // Recalculate position using the same logic as positionCard
            this.positionCard(sprite, i, cardCount, isSelected);
        }
        
        // Re-sort for z-order changes
        this._handContainer.children.sort((a, b) => (a.z || 0) - (b.z || 0));
        
        // Refresh energy display in case energy costs changed
        this.refreshEnergyDisplay();
    };
    
    Scene_Battle.prototype.refreshEnergyDisplay = function() {
        if (!window.$energyManager) return;
        
        // Update energy display
        this._energySprite.bitmap.clear();
        this._energySprite.bitmap.fontSize = 18;
        
        // Energy orb gradient background
        const energyRatio = window.$energyManager.currentEnergy / window.$energyManager.maxEnergy;
        let energyColor1, energyColor2;
        
        if (energyRatio > 0.7) {
            energyColor1 = '#00bcd4'; // Cyan
            energyColor2 = '#0097a7';
        } else if (energyRatio > 0.3) {
            energyColor1 = '#ff9800'; // Orange
            energyColor2 = '#f57c00';
        } else {
            energyColor1 = '#f44336'; // Red
            energyColor2 = '#c62828';
        }
        
        this._energySprite.bitmap.gradientFillRect(0, 0, 120, 80, energyColor1, energyColor2, true);
        this._energySprite.bitmap.strokeRect(0, 0, 120, 80, energyColor2, 3);
        
        // Energy orb glow effect
        for (let i = 60; i > 40; i -= 2) {
            const alpha = 0.02 * (61 - i);
            this._energySprite.bitmap.drawCircle(60, 40, i, `rgba(255, 255, 255, ${alpha})`);
        }
        
        this._energySprite.bitmap.textColor = '#ffffff';
        this._energySprite.bitmap.fontBold = true;
        this._energySprite.bitmap.outlineWidth = 2;
        this._energySprite.bitmap.outlineColor = '#000000';
        this._energySprite.bitmap.drawText('ENERGY', 0, 5, 120, 20, 'center');
        
        // Current/Max energy display
        this._energySprite.bitmap.fontSize = 20;
        const energyText = `${window.$energyManager.currentEnergy}/${window.$energyManager.maxEnergy}`;
        this._energySprite.bitmap.drawText(energyText, 0, 25, 120, 30, 'center');
        
        // Energy crystals visualization
        const crystalSize = 6;
        const crystalSpacing = 8;
        const maxCrystalsPerRow = 5;
        const rows = Math.ceil(window.$energyManager.maxEnergy / maxCrystalsPerRow);
        
        for (let i = 0; i < window.$energyManager.maxEnergy; i++) {
            const row = Math.floor(i / maxCrystalsPerRow);
            const col = i % maxCrystalsPerRow;
            const rowCrystals = Math.min(maxCrystalsPerRow, window.$energyManager.maxEnergy - row * maxCrystalsPerRow);
            
            const x = 60 - (rowCrystals * crystalSpacing) / 2 + col * crystalSpacing;
            const y = 55 + row * (crystalSize + 2);
            
            if (i < window.$energyManager.currentEnergy) {
                // Filled crystal
                this._energySprite.bitmap.drawCircle(x, y, crystalSize, '#ffffff');
                this._energySprite.bitmap.drawCircle(x, y, crystalSize - 1, energyColor1);
            } else {
                // Empty crystal
                this._energySprite.bitmap.strokeRect(x - crystalSize/2, y - crystalSize/2, crystalSize, crystalSize, '#666666', 1);
            }
        }
    };
    
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        
        if ($gameSwitches.value(45) && window.$cardManager && this._actorCommandWindow && this._actorCommandWindow.active) {
            if (Input.isTriggered('left') || Input.isTriggered('pageup')) {
                window.$cardManager.selectPrevious();
                this.updateCardSelection();
                SoundManager.playCursor();
            } else if (Input.isTriggered('right') || Input.isTriggered('pagedown')) {
                window.$cardManager.selectNext();
                this.updateCardSelection();
                SoundManager.playCursor();
            }
        }
    };
    
    // Override actor command selection when card system is active
    const _Scene_Battle_commandAttack = Scene_Battle.prototype.commandAttack;
    
    // PASTE THIS CODE to replace the old commandAttack function

Scene_Battle.prototype.commandAttack = function() {
    if ($gameSwitches.value(45) && window.$cardManager && window.$energyManager) {
        const card = window.$cardManager.getCurrentCard();
        const actor = BattleManager.actor();

        // --- 1. Validation Checks ---
        if (!card) {
            SoundManager.playBuzzer();
            return; // Do nothing if no card is selected.
        }

        if (!actor) {
            console.error("RoguelikeCardSystem Error: No active actor to use a card.");
            SoundManager.playBuzzer();
            return;
        }

        if (!card.canUse(actor)) {
            SoundManager.playBuzzer();

            return; // Exit if the card is not usable for any reason.
        }

        // --- 2. Action Setup & Automated Targeting ---
        this._pendingCard = card;
        const action = card.createAction(actor);

        if (!action || !action.item()) {
            console.error(`RoguelikeCardSystem Error: Failed to create a valid action for card ${card.name}`);
            this._pendingCard = null;
            return;
        }

        // Automatically target the first (and only) enemy if needed.
        if (card.needsTarget()) {
            const targetIndex = 0; // Index for the first enemy.
            action.setTarget(targetIndex);
        }

        actor.setAction(0, action);

        // Set last skill used for animations.
        if (card.type === 'skill') {
            actor.setLastBattleSkill($dataSkills[card.id]);
        }
        
        // --- 3. Execute Card & End Turn ---
        // This helper function will now reliably spend energy and remove the card.
        this.executeCard();

    } else {
        // Fallback to the original method if the card system isn't active.
        _Scene_Battle_commandAttack.call(this);
    }
};
    
    Scene_Battle.prototype.executeCard = function() {
        if (this._pendingCard && window.$cardManager && window.$energyManager) {
            const actor = BattleManager.actor();
            
            // Double-check energy before spending
            if (!window.$energyManager.canAfford(this._pendingCard.energyCost)) {
                SoundManager.playBuzzer();
                this._pendingCard = null;
                return;
            }
            
            // Verify the action is properly set
            const currentAction = actor.currentAction();
            if (!currentAction || !currentAction._item) {
                console.log("Warning: No valid action set for card execution");
                // Try to recreate the action
                const action = this._pendingCard.createAction(actor);
                actor.setAction(0, action);
            }
            
            // Spend energy AFTER confirming action is valid
            if (window.$energyManager.spendEnergy(this._pendingCard.energyCost)) {
                // Remove the card from hand
                const cardToPlay = window.$cardManager.playCard(window.$cardManager.selectedIndex);
                if (cardToPlay) {
                    // Immediately refresh display to show proper positioning
                    this.refreshCardDisplay();
                    SoundManager.playMagicEvasion();
                    
                    // Log for debugging
                    console.log(`Used card: ${cardToPlay.name}, Energy cost: ${cardToPlay.energyCost}`);
                }
            } else {
                console.log("Failed to spend energy for card");
                SoundManager.playBuzzer();
            }
            
            this._pendingCard = null;
        }
        
        // Proceed with the next command
        this.selectNextCommand();
    };
    
    // New Draw Card command
    Scene_Battle.prototype.commandDrawCard = function() {
        if ($gameSwitches.value(45) && window.$cardManager && window.$energyManager) {
            const actor = BattleManager.actor();
            
            // Check if hand is already full
            if (window.$cardManager.hand.length >= 5) {
                SoundManager.playBuzzer();
                return;
            }
            
            // Draw a card
            const oldHandSize = window.$cardManager.hand.length;
            window.$cardManager.drawCards(1);
            const newHandSize = window.$cardManager.hand.length;
            
            if (newHandSize > oldHandSize) {
                // Successfully drew a card
                SoundManager.playMagicEvasion();
                this.refreshCardDisplay();
                
                // Gain 4 energy from drawing
                window.$energyManager.gainDrawEnergy();
                
                // Set up guard action
                const action = new Game_Action(actor);
                action.setGuard();
                actor.setAction(0, action);
                
                // Show draw effect
                this.showDrawCardEffect();
                
                // Refresh energy display to show gained energy
                this.refreshEnergyDisplay();
                
                // End turn
                this.selectNextCommand();
            } else {
                // No cards to draw
                SoundManager.playBuzzer();
            }
        }
    };
    
    Scene_Battle.prototype.showDrawCardEffect = function() {
        // Refresh the entire display to properly position the new card
        this.refreshCardDisplay();
        
        // Create a visual effect for drawing a card
        if (this._cardSprites.length > 0) {
            const lastCardSprite = this._cardSprites[this._cardSprites.length - 1];
            if (lastCardSprite) {
                // Reset draw animation for the new card
                lastCardSprite._drawAnimation = 0;
                
                // Add sparkle effect to the newly drawn card
                for (let i = 0; i < 15; i++) {
                    setTimeout(() => {
                        if (lastCardSprite.createDrawParticles) {
                            lastCardSprite.createDrawParticles();
                        }
                    }, i * 50);
                }
            }
        }
    };
    function Scene_DeckBuilder() {
        this.initialize(...arguments);
    }
    
    Scene_DeckBuilder.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_DeckBuilder.prototype.constructor = Scene_DeckBuilder;
    
    Scene_DeckBuilder.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
        this._availableSkills = [];
        this._currentDeck = [];
        this._selectedSkillIndex = 0;
        this.loadAvailableSkills();
        this.loadCurrentDeck();
    };
    
    Scene_DeckBuilder.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.createWindows();
    };
    
    Scene_DeckBuilder.prototype.createWindows = function() {
        this.createHelpWindow();
        this.createSkillListWindow();
        this.createDeckWindow();
        this.createCommandWindow();
        this.createQuantityWindow();
    };
    
    Scene_DeckBuilder.prototype.createHelpWindow = function() {
        const rect = this.helpWindowRect();
        this._helpWindow = new Window_Help(rect);
        this._helpWindow.setText("Select skills to build your 40-card deck. Press OK to set quantity (max 3 copies).");
        this.addWindow(this._helpWindow);
    };
    
    Scene_DeckBuilder.prototype.createSkillListWindow = function() {
        const rect = this.skillListWindowRect();
        this._skillListWindow = new Window_DeckBuilderSkillList(rect);
        this._skillListWindow.setHandler('ok', this.onSkillOk.bind(this));
        this._skillListWindow.setHandler('cancel', this.onSkillCancel.bind(this));
        this._skillListWindow.setAvailableSkills(this._availableSkills);
        this._skillListWindow.setCurrentDeck(this._currentDeck);
        this._skillListWindow.activate();
        this._skillListWindow.select(0);
        this.addWindow(this._skillListWindow);
    };
    
    Scene_DeckBuilder.prototype.createDeckWindow = function() {
        const rect = this.deckWindowRect();
        this._deckWindow = new Window_DeckBuilderDeck(rect);
        this._deckWindow.setCurrentDeck(this._currentDeck);
        this.addWindow(this._deckWindow);
    };
    Scene_DeckBuilder.prototype.onExit = function() {
        // Auto-save deck configuration regardless of card count
        if (!$dataSystem.deckBuilder) {
            $dataSystem.deckBuilder = [];
        }
        $dataSystem.deckBuilder = JSON.parse(JSON.stringify(this._currentDeck));
        
        // Auto-save the game
        SoundManager.playSave();
        
        // Exit the scene
        this.popScene();
    };
    
    Scene_DeckBuilder.prototype.createCommandWindow = function() {
        const rect = this.commandWindowRect();
        this._commandWindow = new Window_DeckBuilderCommand(rect);
        this._commandWindow.setHandler('randomize', this.onRandomizeDeck.bind(this));
        this._commandWindow.setHandler('reset', this.onResetDeck.bind(this));
        this._commandWindow.setHandler('cancel', this.onExit.bind(this));
        this.addWindow(this._commandWindow);
    };
    
    Scene_DeckBuilder.prototype.createQuantityWindow = function() {
        const rect = this.quantityWindowRect();
        this._quantityWindow = new Window_DeckBuilderQuantity(rect);
        this._quantityWindow.setHandler('ok', this.onQuantityOk.bind(this));
        this._quantityWindow.setHandler('cancel', this.onQuantityCancel.bind(this));
        this._quantityWindow.hide();
        this._quantityWindow.deactivate();
        this.addWindow(this._quantityWindow);
    };
    
    Scene_DeckBuilder.prototype.helpWindowRect = function() {
        return new Rectangle(0, 0, Graphics.boxWidth, this.calcWindowHeight(2, false));
    };
    
    Scene_DeckBuilder.prototype.skillListWindowRect = function() {
        const wy = this.helpWindowRect().height;
        const ww = Math.floor(Graphics.boxWidth * 0.6);
        const wh = Graphics.boxHeight - wy - this.calcWindowHeight(1, false);
        return new Rectangle(0, wy, ww, wh);
    };
    
    Scene_DeckBuilder.prototype.deckWindowRect = function() {
        const skillRect = this.skillListWindowRect();
        const wx = skillRect.width;
        const wy = skillRect.y;
        const ww = Graphics.boxWidth - skillRect.width;
        const wh = skillRect.height;
        return new Rectangle(wx, wy, ww, wh);
    };
    
    Scene_DeckBuilder.prototype.commandWindowRect = function() {
        const wy = Graphics.boxHeight - this.calcWindowHeight(1, false);
        return new Rectangle(0, wy, Graphics.boxWidth, this.calcWindowHeight(1, false));
    };
    
    Scene_DeckBuilder.prototype.quantityWindowRect = function() {
        const width = 200;
        const height = this.calcWindowHeight(4, false);
        const x = (Graphics.boxWidth - width) / 2;
        const y = (Graphics.boxHeight - height) / 2;
        return new Rectangle(x, y, width, height);
    };
    
    Scene_DeckBuilder.prototype.loadAvailableSkills = function() {
        const skillsMap = new Map();
        
        // Get all party members (including those who might have died)
        for (let i = 1; i <= $dataActors.length - 1; i++) {
            const actor = $gameActors.actor(i);
            if (!actor || !$gameParty.allMembers().some(member => member.actorId() === i)) continue;
            
            const skills = this.getAllSkillsForActor(actor);
            for (const skill of skills) {
                if (!skillsMap.has(skill.id)) {
                    skillsMap.set(skill.id, {
                        skill: skill,
                        learnedBy: []
                    });
                }
                skillsMap.get(skill.id).learnedBy.push(actor.actorId());
            }
        }
        
        this._availableSkills = Array.from(skillsMap.values());
    };
    
    Scene_DeckBuilder.prototype.getAllSkillsForActor = function(actor) {
        const skills = [];
        
        // For actor 1, get all skills from class learnings
        if (actor.actorId() === 1) {
            const actorClass = $dataClasses[actor._classId];
            if (actorClass && actorClass.learnings) {
                for (const learning of actorClass.learnings) {
                    const skill = $dataSkills[learning.skillId];
                    if (skill && this.isSkillUsableInBattle(skill)) {
                        skills.push(skill);
                    }
                }
            }
        }
        
        // For all actors, add currently learned skills
        for (const skillId of actor._skills) {
            const skill = $dataSkills[skillId];
            if (skill && this.isSkillUsableInBattle(skill) && 
                !skills.some(s => s.id === skillId)) {
                skills.push(skill);
            }
        }
        
        return skills;
    };
    
    Scene_DeckBuilder.prototype.isSkillUsableInBattle = function(skill) {
        if (!skill) return false;
        if (skill.occasion === 3) return false; // Never usable
        if (skill.occasion === 2) return false; // Menu only
        return skill.occasion === 0 || skill.occasion === 1;
    };
    
    Scene_DeckBuilder.prototype.loadCurrentDeck = function() {
        // Load from saved data or create empty deck
        this._currentDeck = $dataSystem.deckBuilder ? 
            JSON.parse(JSON.stringify($dataSystem.deckBuilder)) : 
            [];
    };
    
    Scene_DeckBuilder.prototype.onSkillOk = function() {
        const skill = this._skillListWindow.currentSkill();
        if (skill) {
            this._selectedSkill = skill;
            const deckCard = this._currentDeck.find(card => card.skillId === skill.skill.id);
            const currentCount = deckCard ? deckCard.count : 0;
            this._quantityWindow.setup(skill.skill, currentCount);
            this._quantityWindow.show();
            this._quantityWindow.activate();
            this._skillListWindow.deactivate();
            this._commandWindow.deactivate(); // Deactivate command window too
        }
    };
    
    Scene_DeckBuilder.prototype.onSkillCancel = function() {
        this._commandWindow.activate();
        this._skillListWindow.deactivate();
    };
    
    Scene_DeckBuilder.prototype.onQuantityOk = function() {
        const skill = this._selectedSkill;
        const newQuantity = this._quantityWindow.currentQuantity();
        this.setSkillQuantity(skill.skill.id, newQuantity);
        this._quantityWindow.hide();
        this._quantityWindow.deactivate();
        this._skillListWindow.activate();
        this._commandWindow.deactivate(); // Keep command window deactivated
    };
    
    Scene_DeckBuilder.prototype.onQuantityCancel = function() {
        this._quantityWindow.hide();
        this._quantityWindow.deactivate();
        this._skillListWindow.activate();
        this._commandWindow.deactivate(); // Keep command window deactivated
    };
    
    Scene_DeckBuilder.prototype.setSkillQuantity = function(skillId, quantity) {
        const existingCard = this._currentDeck.find(card => card.skillId === skillId);
        
        if (quantity === 0) {
            // Remove card from deck
            if (existingCard) {
                const index = this._currentDeck.indexOf(existingCard);
                this._currentDeck.splice(index, 1);
            }
        } else {
            // Check if adding this quantity would exceed 40 cards
            const currentTotal = this.getTotalDeckCount();
            const currentCardCount = existingCard ? existingCard.count : 0;
            const difference = quantity - currentCardCount;
            
            if (currentTotal + difference > 40) {
                const maxAllowed = Math.max(0, 40 - (currentTotal - currentCardCount));
                quantity = Math.min(quantity, maxAllowed);
                
                if (quantity === currentCardCount) {
                    SoundManager.playBuzzer();
                    this._helpWindow.setText("Cannot add more cards - deck would exceed 40 cards!");
                    return;
                }
            }
            
            if (existingCard) {
                existingCard.count = quantity;
            } else {
                const skillData = this._availableSkills.find(s => s.skill.id === skillId);
                this._currentDeck.push({
                    skillId: skillId,
                    count: quantity,
                    learnedBy: skillData ? skillData.learnedBy : [1]
                });
            }
        }
        
        this.refreshWindows();
        SoundManager.playOk();
    };
    
    Scene_DeckBuilder.prototype.getTotalDeckCount = function() {
        return this._currentDeck.reduce((total, card) => total + card.count, 0);
    };
    
    Scene_DeckBuilder.prototype.refreshWindows = function() {
        this._skillListWindow.setCurrentDeck(this._currentDeck);
        this._skillListWindow.refresh();
        this._deckWindow.setCurrentDeck(this._currentDeck);
        this._deckWindow.refresh();
        const totalCards = this.getTotalDeckCount();
        this._helpWindow.setText(`Deck: ${totalCards}/40 cards. Select skills and press OK to set quantity.`);
    };
    
    Scene_DeckBuilder.prototype.onRandomizeDeck = function() {
        // Clear current deck
        this._currentDeck = [];
        
        // Create a pool of all available skills
        const skillPool = [];
        for (const skillData of this._availableSkills) {
            // Add each skill up to 3 times to the pool
            for (let i = 0; i < 3; i++) {
                skillPool.push(skillData);
            }
        }
        
        // Shuffle the skill pool
        for (let i = skillPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [skillPool[i], skillPool[j]] = [skillPool[j], skillPool[i]];
        }
        
        // Fill deck with random skills up to 40 cards
        const usedSkills = new Map();
        let cardsAdded = 0;
        
        for (const skillData of skillPool) {
            if (cardsAdded >= 40) break;
            
            const skillId = skillData.skill.id;
            const currentCount = usedSkills.get(skillId) || 0;
            
            if (currentCount < 3) {
                usedSkills.set(skillId, currentCount + 1);
                cardsAdded++;
                
                // Add to deck or update existing entry
                const existingCard = this._currentDeck.find(card => card.skillId === skillId);
                if (existingCard) {
                    existingCard.count++;
                } else {
                    this._currentDeck.push({
                        skillId: skillId,
                        count: 1,
                        learnedBy: skillData.learnedBy
                    });
                }
            }
        }
        
        this.refreshWindows();
        SoundManager.playMagicEvasion();
        this._helpWindow.setText(`Deck randomized! Generated ${cardsAdded} cards.`);
        this._commandWindow.activate();
    };
    
    Scene_DeckBuilder.prototype.onResetDeck = function() {
        this._currentDeck = []; // Empty the deck completely
        this.refreshWindows();
        SoundManager.playCancel();
        this._helpWindow.setText("Deck reset! All cards removed.");
        this._commandWindow.activate();
    };
    
    // Window for skill list
    function Window_DeckBuilderSkillList() {
        this.initialize(...arguments);
    }
    
    Window_DeckBuilderSkillList.prototype = Object.create(Window_Selectable.prototype);
    Window_DeckBuilderSkillList.prototype.constructor = Window_DeckBuilderSkillList;
    
    Window_DeckBuilderSkillList.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._availableSkills = [];
        this._currentDeck = [];
    };
    
    Window_DeckBuilderSkillList.prototype.setAvailableSkills = function(skills) {
        this._availableSkills = skills;
        this.refresh();
    };
    
    Window_DeckBuilderSkillList.prototype.setCurrentDeck = function(deck) {
        this._currentDeck = deck;
    };
    
    Window_DeckBuilderSkillList.prototype.maxItems = function() {
        return this._availableSkills.length;
    };
    
    Window_DeckBuilderSkillList.prototype.currentSkill = function() {
        return this._availableSkills[this.index()];
    };
    
    Window_DeckBuilderSkillList.prototype.drawItem = function(index) {
        const skillData = this._availableSkills[index];
        if (!skillData) return;
        
        const skill = skillData.skill;
        const rect = this.itemRectWithPadding(index);
        const deckCard = this._currentDeck.find(card => card.skillId === skill.id);
        const count = deckCard ? deckCard.count : 0;
        
        // Draw skill icon
        this.drawIcon(skill.iconIndex, rect.x, rect.y);
        
        // Draw skill name
        this.contents.fontSize = 18;
        this.changeTextColor(ColorManager.normalColor());
        this.drawText(skill.name, rect.x + 36, rect.y, rect.width - 100);
        
        // Draw count in deck
        this.contents.fontSize = 16;
        if (count > 0) {
            this.changeTextColor(ColorManager.powerUpColor());
            this.drawText(`${count}/3`, rect.x + rect.width - 60, rect.y + 2, 50, 'right');
        } else {
            this.changeTextColor(ColorManager.deathColor());
            this.drawText("0/3", rect.x + rect.width - 60, rect.y + 2, 50, 'right');
        }
    };
    
    // Window for current deck display
    function Window_DeckBuilderDeck() {
        this.initialize(...arguments);
    }
    
    Window_DeckBuilderDeck.prototype = Object.create(Window_Base.prototype);
    Window_DeckBuilderDeck.prototype.constructor = Window_DeckBuilderDeck;
    
    Window_DeckBuilderDeck.prototype.initialize = function(rect) {
        Window_Base.prototype.initialize.call(this, rect);
        this._currentDeck = [];
    };
    
    Window_DeckBuilderDeck.prototype.setCurrentDeck = function(deck) {
        this._currentDeck = deck;
        this.refresh();
    };
    
    Window_DeckBuilderDeck.prototype.refresh = function() {
        this.contents.clear();
        
        const totalCards = this._currentDeck.reduce((total, card) => total + card.count, 0);
        
        // Draw header
        this.contents.fontSize = 20;
        this.changeTextColor(ColorManager.systemColor());
        this.drawText(`Current Deck (${totalCards}/40)`, 0, 0, this.contents.width, 'center');
        
        // Draw deck contents
        let y = 40;
        this.contents.fontSize = 16;
        
        if (this._currentDeck.length === 0) {
            this.changeTextColor(ColorManager.deathColor());
            this.drawText("Empty Deck", 0, y, this.contents.width, 'center');
        } else {
            for (const cardData of this._currentDeck) {
                const skill = $dataSkills[cardData.skillId];
                if (!skill) continue;
                
                // Draw skill info
                this.drawIcon(skill.iconIndex, 0, y);
                this.changeTextColor(ColorManager.normalColor());
                this.drawText(skill.name, 36, y, this.contents.width - 80);
                
                // Draw count
                this.changeTextColor(ColorManager.powerUpColor());
                this.drawText(`×${cardData.count}`, this.contents.width - 40, y, 40, 'right');
                
                y += 32;
                
                if (y > this.contents.height - 32) break;
            }
        }
    };
    
    // Window for command buttons
    function Window_DeckBuilderCommand() {
        this.initialize(...arguments);
    }
    
    Window_DeckBuilderCommand.prototype = Object.create(Window_HorzCommand.prototype);
    Window_DeckBuilderCommand.prototype.constructor = Window_DeckBuilderCommand;
    
    Window_DeckBuilderCommand.prototype.makeCommandList = function() {
        this.addCommand("Randomize", 'randomize');
        this.addCommand("Reset", 'reset');
        this.addCommand("Exit", 'cancel');
    };
    
    Window_DeckBuilderCommand.prototype.maxCols = function() {
        return 3;
    };
    
    // New quantity selection window
    function Window_DeckBuilderQuantity() {
        this.initialize(...arguments);
    }
    
    Window_DeckBuilderQuantity.prototype = Object.create(Window_Selectable.prototype);
    Window_DeckBuilderQuantity.prototype.constructor = Window_DeckBuilderQuantity;
    
    Window_DeckBuilderQuantity.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._skill = null;
        this._quantity = 0;
        this._maxQuantity = 3;
    };
    
    Window_DeckBuilderQuantity.prototype.setup = function(skill, currentQuantity) {
        this._skill = skill;
        this._quantity = currentQuantity;
        this.select(0);
        this.refresh();
    };
    
    Window_DeckBuilderQuantity.prototype.maxItems = function() {
        return 1;
    };
    
    Window_DeckBuilderQuantity.prototype.currentQuantity = function() {
        return this._quantity;
    };
    
    Window_DeckBuilderQuantity.prototype.cursorRight = function() {
        if (this._quantity < this._maxQuantity) {
            this._quantity++;
            SoundManager.playCursor();
            this.refresh();
        } else {
            SoundManager.playBuzzer();
        }
    };
    
    Window_DeckBuilderQuantity.prototype.cursorLeft = function() {
        if (this._quantity > 0) {
            this._quantity--;
            SoundManager.playCursor();
            this.refresh();
        } else {
            SoundManager.playBuzzer();
        }
    };
    
    Window_DeckBuilderQuantity.prototype.isOkEnabled = function() {
        return true;
    };
    
    Window_DeckBuilderQuantity.prototype.isCancelEnabled = function() {
        return true;
    };
    
    // Override to prevent other cursor movements
    Window_DeckBuilderQuantity.prototype.cursorDown = function() {
        // Do nothing - prevent default behavior
    };
    
    Window_DeckBuilderQuantity.prototype.cursorUp = function() {
        // Do nothing - prevent default behavior
    };
    
    Window_DeckBuilderQuantity.prototype.cursorPagedown = function() {
        // Do nothing - prevent default behavior
    };
    
    Window_DeckBuilderQuantity.prototype.cursorPageup = function() {
        // Do nothing - prevent default behavior
    };
    
    Window_DeckBuilderQuantity.prototype.refresh = function() {
        this.contents.clear();
        
        if (!this._skill) return;
        
        // Draw skill info
        this.drawIcon(this._skill.iconIndex, 12, 12);
        this.contents.fontSize = 18;
        this.changeTextColor(ColorManager.normalColor());
        this.drawText(this._skill.name, 0, 48, this.contents.width, 'center');
        
        // Draw quantity controls
        this.contents.fontSize = 16;
        this.changeTextColor(ColorManager.systemColor());
        this.drawText("Quantity:", 0, 80, this.contents.width, 'center');
        
        // Draw quantity with arrows
        const quantityText = `< ${this._quantity} >`;
        this.contents.fontSize = 20;
        this.changeTextColor(ColorManager.powerUpColor());
        this.drawText(quantityText, 0, 100, this.contents.width, 'center');
    };
    
    // Menu integration
    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        if ($gameSwitches.value(45)) {
            this.addCommand("Deck Builder", 'deckBuilder', true);
        }
    };
    
    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler('deckBuilder', this.commandDeckBuilder.bind(this));
    };
    
    Scene_Menu.prototype.commandDeckBuilder = function() {
        SceneManager.push(Scene_DeckBuilder);
    };


    // Modify window to show card info and draw command
    const _Window_ActorCommand_makeCommandList = Window_ActorCommand.prototype.makeCommandList;
    Window_ActorCommand.prototype.makeCommandList = function() {
        if ($gameSwitches.value(45) && window.$cardManager) {
            if (this._actor) {
                this.addCommand("Use Card", 'attack', true);
                this.addCommand("Draw Card", 'drawCard', true);
                this.addGuardCommand();
                this.addItemCommand();
                // Hide items command when card system is active
            }
        } else {
            _Window_ActorCommand_makeCommandList.call(this);
        }
    };
    // Move enemies up when card system is active
    const _Sprite_Enemy_setBattler = Sprite_Enemy.prototype.setBattler;
    Sprite_Enemy.prototype.setBattler = function(battler) {
        _Sprite_Enemy_setBattler.call(this, battler);
        if ($gameSwitches.value(45) && battler) {
            this.y -= 100;
        }
    };

const _Sprite_Enemy_updatePosition = Sprite_Enemy.prototype.updatePosition;
Sprite_Enemy.prototype.updatePosition = function() {
    _Sprite_Enemy_updatePosition.call(this);
    if ($gameSwitches.value(45)) {
        this.y -= 100;
    }
};
    // Handle the draw card command
    const _Scene_Battle_createActorCommandWindow = Scene_Battle.prototype.createActorCommandWindow;
    Scene_Battle.prototype.createActorCommandWindow = function() {
        _Scene_Battle_createActorCommandWindow.call(this);
        this._actorCommandWindow.setHandler('drawCard', this.commandDrawCard.bind(this));
    };
    
    // Input mapping for A and D keys
    Input.keyMapper[65] = 'pageup';    // A key
    Input.keyMapper[68] = 'pagedown';  // D key
    
})();