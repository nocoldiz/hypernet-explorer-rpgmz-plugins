/*:
 * @target MZ
 * @plugindesc v1.0 Simple parallax overlay system controlled via map notes.
 * @author Claude
 * @help 
 * ParallaxOverlay.js
 * 
 * This plugin creates overlays on maps using images from the pictures folder.
 * The overlays can move with the player or stay fixed, with scrolling options.
 * 
 * === Map Notes Format ===
 * <overlay: filename>           - Basic overlay that moves with player
 * <overlay: filename, fixed>    - Fixed overlay that doesn't move with player
 * <overlay: filename, scrollX:value, scrollY:value> - Add scrolling (use values like 0.5, 1, 2)
 * <overlay: filename, opacity:value> - Set opacity (0-255)
 * <overlay: filename, z:value>  - Set z-order (higher appears on top, default is 9)
 * 
 * You can combine parameters:
 * <overlay: forest_tops, scrollX:0.5, scrollY:0.5, opacity:200>
 * 
 * Multiple overlays:
 * <overlay: trees_top>
 * <overlay: fog, scrollX:0.3, fixed>
 * 
 * === Examples ===
 * <overlay: trees_top>          - Basic overlay that moves with player
 * <overlay: buildings, fixed>    - Fixed overlay that doesn't move
 * <overlay: clouds, scrollX:0.5, scrollY:0.3, fixed> - Slow moving clouds
 * <overlay: fog, opacity:150>   - Semi-transparent fog effect
 */

(function() {
    "use strict";
    
    // Parse Map Notes for overlay parameters
    function parseMapNotes() {
        if (!$dataMap || !$dataMap.note) return [];
        
        const notes = $dataMap.note;
        const regex = /<overlay:\s*([^,>]+)(?:\s*,\s*([^>]*))?>/gi;
        let match;
        let overlays = [];
        
        while (match = regex.exec(notes)) {
            // Create basic overlay object
            const filename = match[1].trim();
            let overlay = {
                filename: filename,
                fixed: false,
                scrollX: 0,
                scrollY: 0,
                opacity: 255,
                z: 9
            };
            
            // Parse additional parameters if they exist
            if (match[2]) {
                const params = match[2].split(',');
                
                params.forEach(param => {
                    param = param.trim();
                    
                    // Check for 'fixed' parameter
                    if (param === 'fixed') {
                        overlay.fixed = true;
                    } 
                    // Check for parameters with values
                    else if (param.includes(':')) {
                        const [key, value] = param.split(':');
                        const trimmedKey = key.trim();
                        
                        switch (trimmedKey) {
                            case 'scrollX':
                                overlay.scrollX = parseFloat(value);
                                break;
                            case 'scrollY':
                                overlay.scrollY = parseFloat(value);
                                break;
                            case 'opacity':
                                overlay.opacity = parseInt(value);
                                break;
                            case 'z':
                                overlay.z = parseInt(value);
                                break;
                        }
                    }
                });
            }
            
            overlays.push(overlay);
        }
        
        return overlays;
    }
    
    // Extend the Spriteset_Map class to add overlay sprites
    const _Spriteset_Map_createParallax = Spriteset_Map.prototype.createParallax;
    Spriteset_Map.prototype.createParallax = function() {
        _Spriteset_Map_createParallax.call(this);
        this.createOverlays();
    };
    
    Spriteset_Map.prototype.createOverlays = function() {
        this._overlays = [];
        this._overlayData = parseMapNotes();
        
        for (let i = 0; i < this._overlayData.length; i++) {
            const data = this._overlayData[i];
            const sprite = new Sprite();
            
            // Load the image from pictures folder
            sprite.bitmap = ImageManager.loadPicture(data.filename);
            sprite.z = data.z;
            sprite.opacity = data.opacity;
            sprite.data = data;
            
            // Store initial map display position
            sprite._baseX = $gameMap.displayX();
            sprite._baseY = $gameMap.displayY();
            
            this._overlays.push(sprite);
            this.addChild(sprite);
        }
    };
    
    // Update the overlays - called every frame
    const _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        this.updateOverlays();
    };
    
    Spriteset_Map.prototype.updateOverlays = function() {
        if (!this._overlays) return;
        
        const tileWidth = $gameMap.tileWidth();
        const tileHeight = $gameMap.tileHeight();
        
        for (let i = 0; i < this._overlays.length; i++) {
            const sprite = this._overlays[i];
            const data = sprite.data;
            
            if (!sprite.bitmap.isReady()) continue;
            
            if (data.fixed) {
                // For fixed overlays, apply only scrolling
                sprite.x = -data.scrollX * $gameMap.displayX() * tileWidth;
                sprite.y = -data.scrollY * $gameMap.displayY() * tileHeight;
            } else {
                // For overlays that move with the player
                sprite.x = -($gameMap.displayX() * tileWidth + data.scrollX * $gameMap.displayX() * tileWidth);
                sprite.y = -($gameMap.displayY() * tileHeight + data.scrollY * $gameMap.displayY() * tileHeight);
            }
        }
    };
    
    // Clean up overlays when leaving map
    const _Spriteset_Map_destroy = Spriteset_Map.prototype.destroy;
    Spriteset_Map.prototype.destroy = function() {
        if (this._overlays) {
            for (let i = 0; i < this._overlays.length; i++) {
                this.removeChild(this._overlays[i]);
            }
            this._overlays = null;
        }
        _Spriteset_Map_destroy.call(this);
    };
    
})();