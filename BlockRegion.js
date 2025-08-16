/*:
 * @target MZ
 * @plugindesc Blocks player movement into specific region IDs and forces passage through others. Compatible with FogOfWar.
 * @author You
 *
 * @param Blocked Regions
 * @type number[]
 * @desc List of region IDs that are impassable.
 * @default [10]
 *
 * @param Always Passable Regions
 * @type number[]
 * @desc List of region IDs that are always passable.
 * @default [4, 11]
 *
 * @param Upper Floor Region
 * @type number
 * @desc Region ID that represents upper floors. Can only be accessed via ladders, other upper floor regions, or always passable regions.
 * @default 7
 *
 * @param Non-Blocking Vision Regions
 * @type number[]
 * @desc Region IDs that don't block vision in FogOfWar system.
 * @default [4, 30]
 *
 * @param Extended Vision Region
 * @type number
 * @desc Region ID that increases vision range and allows seeing through terrain tag 4 walls.
 * @default 7
 *
 * @param Extended Vision Range
 * @type number
 * @desc How much to extend vision range when standing on the Extended Vision Region.
 * @default 5
 *
 * @param Vision Blocking Regions
 * @type number[]
 * @desc Region IDs that block vision in FogOfWar system.
 * @default [10]
 *
 */

(() => {
  const params = PluginManager.parameters("BlockRegion");
  const blockedRegions = JSON.parse(params["Blocked Regions"] || "[10]").map(Number);
  // Ensure region ID 4 and 11 are always included in passable regions
  const alwaysPassableRegions = JSON.parse(params["Always Passable Regions"] || "[5]").map(Number);
  if (!alwaysPassableRegions.includes(4)) {
    alwaysPassableRegions.push(4);
  }
  if (!alwaysPassableRegions.includes(11)) {
    alwaysPassableRegions.push(11);
  }
  
  // Get the upper floor region ID (default is 7)
  const upperFloorRegion = Number(params["Upper Floor Region"] || 7);
  
  // New parameters for FogOfWar compatibility
  const nonBlockingVisionRegions = JSON.parse(params["Non-Blocking Vision Regions"] || "[4, 30]").map(Number);
  const extendedVisionRegion = Number(params["Extended Vision Region"] || 7);
  const extendedVisionRange = Number(params["Extended Vision Range"] || 5);
  
  // New parameter for Vision Blocking Regions
  const visionBlockingRegions = JSON.parse(params["Vision Blocking Regions"] || "[11]").map(Number);

  // Helper function to check if MZ3D is disabled in map notes
  function isMZ3DDisabled() {
    if (!$dataMap || !$dataMap.note) {
      return false;
    }
    return $dataMap.note.includes('<mz3d>disable()</mz3d>');
  }

  const _Game_Player_canPass = Game_Player.prototype.canPass;
  Game_Player.prototype.canPass = function(x, y, d) {
    // If MZ3D is disabled in map notes, ignore all passability rules and use default behavior
    if (isMZ3DDisabled()) {
      return _Game_Player_canPass.call(this, x, y, d);
    }

    const newX = $gameMap.roundXWithDirection(x, d);
    const newY = $gameMap.roundYWithDirection(y, d);
    const regionId = $gameMap.regionId(newX, newY);
    const currentRegionId = $gameMap.regionId(x, y);
    
    // Always allow passage through specified passable regions
    if (alwaysPassableRegions.includes(regionId)) {
      return true;
    }
    
    // Block passage through specified regions
    if (blockedRegions.includes(regionId)) {
      return false;
    }
    
    // Check if coming FROM an upper floor region (region ID 7 by default)
    if (currentRegionId === upperFloorRegion) {
      // Can exit upper floor region only if:
      // 1. Going to another upper floor region
      // 2. Going to a ladder tile
      // 3. Going to an always passable region
      const isDestinationLadder = $gameMap.isLadder(newX, newY);
      if (regionId === upperFloorRegion || 
          isDestinationLadder || 
          alwaysPassableRegions.includes(regionId)) {
        return true;
      }
      return false;
    }
    
    // Check if going TO an upper floor region
    if (regionId === upperFloorRegion) {
      // Can enter upper floor region only if:
      // 1. Coming from another upper floor region (already handled above)
      // 2. Current tile is a ladder
      // 3. Coming from an always passable region
      if (this.isOnLadder() || 
          alwaysPassableRegions.includes(currentRegionId)) {
        return true;
      }
      return false;
    }
    
    // Default behavior for other regions
    return _Game_Player_canPass.call(this, x, y, d);
  };

  const _Game_CharacterBase_canPass = Game_CharacterBase.prototype.canPass;
  Game_CharacterBase.prototype.canPass = function(x, y, d) {
    // If MZ3D is disabled in map notes, ignore all passability rules and use default behavior
    if (isMZ3DDisabled()) {
      return _Game_CharacterBase_canPass.call(this, x, y, d);
    }

    const newX    = $gameMap.roundXWithDirection(x, d);
    const newY    = $gameMap.roundYWithDirection(y, d);
    const regionId = $gameMap.regionId(newX, newY);

    // Always allow passage through specified passable regions (e.g. region 5)
    if (alwaysPassableRegions.includes(regionId)) {
      return true;
    }

    // Block passage through specified blocked regions (e.g. region 10)
    if (blockedRegions.includes(regionId)) {
      return false;
    }

    // Fallback to the original behavior for everything else
    return _Game_CharacterBase_canPass.call(this, x, y, d);
  };

  // Additional check for events that might teleport the player
  const _Game_Player_reserveTransfer = Game_Player.prototype.reserveTransfer;
  Game_Player.prototype.reserveTransfer = function(mapId, x, y, d, fadeType) {
    _Game_Player_reserveTransfer.call(this, mapId, x, y, d, fadeType);
    // If teleporting to a new location on the same map
    if ($gameMap.mapId() === mapId) {
      const regionId = $gameMap.regionId(x, y);
      // If teleporting to an upper floor region, ensure it's valid
      if (regionId === upperFloorRegion) {
        // You could add additional logic here if needed
        console.log("Teleporting to upper floor region");
      }
    }
  };
  
  //=============================================================================
  // FogOfWar Compatibility
  //=============================================================================
  
  // Only modify FogOfWar functions if the plugin exists
  if (typeof Game_Map.prototype.isVisionBlocking === 'function') {
    // Override the isVisionBlocking method to check for non-blocking region IDs
    const _Game_Map_isVisionBlocking = Game_Map.prototype.isVisionBlocking;
    Game_Map.prototype.isVisionBlocking = function(x, y) {
      // Check if the tile's region is in the non-blocking vision regions list
      const regionId = this.regionId(x, y);
      
      // First check if it's a region that should block vision (e.g., region 10)
      if (visionBlockingRegions.includes(regionId)) {
        return true;
      }
      
      // Then check if it's a region that should NOT block vision
      if (nonBlockingVisionRegions.includes(regionId)) {
        return false;
      }
      
      // Default to original behavior
      return _Game_Map_isVisionBlocking.call(this, x, y);
    };
    
    // Modify the calculateVision method to check for extended vision on region 7
    const _Game_Map_calculateVision = Game_Map.prototype.calculateVision;
    Game_Map.prototype.calculateVision = function(centerX, centerY, direction) {
      // Store the original vision range
      const originalVisionRange = this._visionRange;
      
      // Check if player is standing on an extended vision region
      const playerRegionId = this.regionId(Math.floor(centerX), Math.floor(centerY));
      
      if (playerRegionId === extendedVisionRegion) {
        // Temporarily increase vision range
        this._visionRange += extendedVisionRange;
        
        // Call the original vision calculation with extended range
        _Game_Map_calculateVision.call(this, centerX, centerY, direction);
        
        // Restore original vision range
        this._visionRange = originalVisionRange;
      } else {
        // Normal vision calculation
        _Game_Map_calculateVision.call(this, centerX, centerY, direction);
      }
    };
    
    // Modify the castRay method to see through terrain tag 4 when on region 7
    const _Game_Map_castRay = Game_Map.prototype.castRay;
    Game_Map.prototype.castRay = function(startX, startY, angle, maxDistance) {
      // Check if we are standing on an extended vision region
      const playerX = Math.floor(startX);
      const playerY = Math.floor(startY);
      const playerRegionId = this.regionId(playerX, playerY);
      
      if (playerRegionId === extendedVisionRegion) {
        // Custom implementation that can see through terrain tag 4
        const stepSize = 0.5; // Larger steps for better performance
        const dx = Math.cos(angle) * stepSize;
        const dy = Math.sin(angle) * stepSize;
        
        let currentX = startX;
        let currentY = startY;
        let distance = 0;
        
        while (distance < maxDistance) {
          currentX += dx;
          currentY += dy;
          distance += stepSize;
          
          let tileX = Math.floor(currentX);
          let tileY = Math.floor(currentY);
          
          // Handle map looping for ray casting
          if (this.isLoopHorizontal()) {
            tileX = (tileX + this.width()) % this.width();
          }
          if (this.isLoopVertical()) {
            tileY = (tileY + this.height()) % this.height();
          }
          
          // Check boundaries after adjusting for looping
          if (tileX < 0 || tileY < 0 || tileX >= this.width() || tileY >= this.height()) {
            break;
          }
          
          // Mark tile as visible
          this.setFogOfWarState(tileX, tileY, 2);
          
          // Apply edge feathering if the function exists
          if (typeof this.applyEdgeFeathering === 'function' && 
              distance > maxDistance - (maxDistance * 0.3)) { // Using default EDGE_FEATHERING value
            this.applyEdgeFeathering(tileX, tileY);
          }
          
          // Check for vision blocking regions (like region 10)
          const tileRegionId = this.regionId(tileX, tileY);
          if (visionBlockingRegions.includes(tileRegionId)) {
            break;
          }
          
          // When on region 7, only stop at vision-blocking events, not terrain tag 4
          const events = this.eventsXy(tileX, tileY);
          let isBlockedByEvent = false;
          
          for (const event of events) {
            if (this.isVisionBlockingEvent(event)) {
              isBlockedByEvent = true;
              break;
            }
          }
          
          if (isBlockedByEvent || (!this.isPassable(tileX, tileY, 0) && this.terrainTag(tileX, tileY) !== 4)) {
            break;
          }
        }
      } else {
        // For normal vision (not on extended vision region), we need to also check for region 10
        // Custom implementation similar to the default but with region 10 check
        const stepSize = 0.5;
        const dx = Math.cos(angle) * stepSize;
        const dy = Math.sin(angle) * stepSize;
        
        let currentX = startX;
        let currentY = startY;
        let distance = 0;
        
        while (distance < maxDistance) {
          currentX += dx;
          currentY += dy;
          distance += stepSize;
          
          let tileX = Math.floor(currentX);
          let tileY = Math.floor(currentY);
          
          // Handle map looping for ray casting
          if (this.isLoopHorizontal()) {
            tileX = (tileX + this.width()) % this.width();
          }
          if (this.isLoopVertical()) {
            tileY = (tileY + this.height()) % this.height();
          }
          
          // Check boundaries after adjusting for looping
          if (tileX < 0 || tileY < 0 || tileX >= this.width() || tileY >= this.height()) {
            break;
          }
          
          // Mark tile as visible
          this.setFogOfWarState(tileX, tileY, 2);
          
          // Apply edge feathering if the function exists
          if (typeof this.applyEdgeFeathering === 'function' && 
              distance > maxDistance - (maxDistance * 0.3)) {
            this.applyEdgeFeathering(tileX, tileY);
          }
          
          // Check for vision blocking regions
          const tileRegionId = this.regionId(tileX, tileY);
          if (visionBlockingRegions.includes(tileRegionId)) {
            // Ray stops at vision blocking regions (like region 10)
            break;
          }
          
          // Check if this tile blocks vision (terrain tag 4 or vision blocking event)
          if (this.isVisionBlocking(tileX, tileY)) {
            break;
          }
        }
      }
    };
  }
})();