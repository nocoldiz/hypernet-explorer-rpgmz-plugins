/*:
 * @target MZ
 * @plugindesc Party Member Cycle v1.0.0
 * @author Nocoldiz + Gemini + ChatGPT + Claude
 * @version 1.0.0
 * @description v1.0.0 Allows cycling through party members in status menu using left/right keys
 *
 * @help PartyCycle.js
 * 
 * This plugin allows you to cycle through party members in the status menu
 * by pressing the left or right arrow keys.
 * 
 * Features:
 * - Press Left Arrow to go to previous party member
 * - Press Right Arrow to go to next party member
 * - Wraps around (last member -> first member, first member -> last member)
 * - Works in the character status menu
 * 
 * No plugin parameters needed.
 * 
 * Terms of Use:
 * Free for commercial and non-commercial use.
 */

(() => {
    'use strict';

    // Store original Scene_Status methods
    const _Scene_Status_create = Scene_Status.prototype.create;
    const _Scene_Status_update = Scene_Status.prototype.update;

    // Override Scene_Status create method
    Scene_Status.prototype.create = function() {
        _Scene_Status_create.call(this);
        this._currentActorIndex = this._actor ? $gameParty.allMembers().indexOf(this._actor) : 0;
    };

    // Override Scene_Status update method to handle input
    Scene_Status.prototype.update = function() {
        _Scene_Status_update.call(this);
        this.updatePartyCycle();
    };

    // New method to handle party member cycling
    Scene_Status.prototype.updatePartyCycle = function() {
        if (Input.isTriggered('left')) {
            this.cycleToPreviousMember();
        } else if (Input.isTriggered('right')) {
            this.cycleToNextMember();
        }
    };

    // Cycle to previous party member
    Scene_Status.prototype.cycleToPreviousMember = function() {
        const partyMembers = $gameParty.allMembers();
        if (partyMembers.length <= 1) return;

        this._currentActorIndex--;
        if (this._currentActorIndex < 0) {
            this._currentActorIndex = partyMembers.length - 1;
        }

        this.changeActor(partyMembers[this._currentActorIndex]);
        SoundManager.playCursor();
    };

    // Cycle to next party member
    Scene_Status.prototype.cycleToNextMember = function() {
        const partyMembers = $gameParty.allMembers();
        if (partyMembers.length <= 1) return;

        this._currentActorIndex++;
        if (this._currentActorIndex >= partyMembers.length) {
            this._currentActorIndex = 0;
        }

        this.changeActor(partyMembers[this._currentActorIndex]);
        SoundManager.playCursor();
    };

    // Method to change the displayed actor
    Scene_Status.prototype.changeActor = function(newActor) {
        this._actor = newActor;
        this._statusWindow.setActor(newActor);
        this._statusParamsWindow.setActor(newActor);
        this._statusEquipWindow.setActor(newActor);
    };

})();