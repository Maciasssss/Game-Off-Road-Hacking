class VisualFXManager {
    // 1. The constructor must accept 'socket' to listen to the server
    constructor(socket) {
        this.socket = socket;
        this.activeBoosts = { RED: false, BLUE: false };
        this.activeJams = { RED: false, BLUE: false };
       
        this.injectContainer();
       
        // 2. Start event listening
        this.setupListeners();
    }
 
    injectContainer() {
        // Notification container (center of the screen)
        this.container = document.createElement('div');
        this.container.id = 'vfx-container';
        document.body.appendChild(this.container);
 
        // Jammer overlay (screen freeze effect)
        this.jammerOverlay = document.createElement('div');
        this.jammerOverlay.id = 'jammer-overlay';
        document.body.appendChild(this.jammerOverlay);
    }
 
    setupListeners() {
        // --- LISTENER 1: GAME STATE (Here we fix the Jammer) ---
        this.socket.on('update_state', (state) => {
            let myTeam = null;
 
            // Check which team the current player is in (based on window.myPlayerId from main.js)
            if (window.myPlayerId && state.players && state.players[window.myPlayerId]) {
                myTeam = state.players[window.myPlayerId].team;
            }
 
            if (state.modifiers) {
                this.updateState(state.modifiers, myTeam);
            }
        });
 
        // --- LISTENER 2: NOTIFICATIONS (Popups) ---
        this.socket.on('ability_announcement', (data) => {
            this.showAnnouncement(data.type, data.team, data.msg);
        });
    }
 
    /**
     * Displays a "Kill Feed" type notification in the center of the screen
     */
    showAnnouncement(abilityType, team, msg) {
        const popup = document.createElement('div');
        popup.className = `vfx-popup ${team ? team.toLowerCase() : 'gray'} ${abilityType}`;
       
        let icon = '';
        if (abilityType === 'boost') icon = '⚡';
        else if (abilityType === 'shield_break') icon = '💥';
        else if (abilityType === 'global_shield') icon = '🛡️';
        else if (abilityType === 'freeze') icon = '❄️';
        else if (abilityType === 'instant_charge') icon = '🔋';
        else if (abilityType === 'hack_bonus') icon = '💰';
 
        popup.innerHTML = `
            <div class="vfx-icon">${icon}</div>
            <div class="vfx-text">
                <div class="vfx-title">${abilityType.replace('_', ' ').toUpperCase()}</div>
                <div class="vfx-desc">${msg}</div>
            </div>
        `;
 
        this.container.appendChild(popup);
 
        // Entry animation
        requestAnimationFrame(() => {
            popup.classList.add('show');
        });
 
        // Auto removal
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 500);
        }, 4000);
       
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
 
    /**
     * Updates persistent effects (Boost / Jammer) based on game state
     */
    updateState(modifiers, myTeam) {
        if (!modifiers) return;
 
        const now = Date.now() / 1000;
 
        // 1. BOOST HANDLING (Score flashing 2x Points)
        ['RED', 'BLUE'].forEach(team => {
            const isBoosted = modifiers[team].score_boost_end > now;
           
            if (this.activeBoosts[team] !== isBoosted) {
                this.activeBoosts[team] = isBoosted;
                const scoreBox = document.querySelector(`.score-box.${team.toLowerCase()}`);
               
                if (scoreBox) {
                    if (isBoosted) {
                        scoreBox.classList.add('vfx-boost-active');
                        if(!scoreBox.querySelector('.boost-badge')) {
                            const badge = document.createElement('div');
                            badge.className = 'boost-badge';
                            badge.innerText = '2x POINTS';
                            scoreBox.appendChild(badge);
                        }
                    } else {
                        scoreBox.classList.remove('vfx-boost-active');
                        const badge = scoreBox.querySelector('.boost-badge');
                        if(badge) badge.remove();
                    }
                }
            }
        });
 
        // 2. JAMMER HANDLING (Freeze)
        // Works only if the team is known
        if (myTeam && (myTeam === 'RED' || myTeam === 'BLUE')) {
            const isFrozen = modifiers[myTeam].frozen_end > now;
           
            if (this.activeJams[myTeam] !== isFrozen) {
                this.activeJams[myTeam] = isFrozen;
                if (isFrozen) {
                    this.jammerOverlay.classList.add('active');
                    this.jammerOverlay.innerHTML = `
                        <div class="jammer-text">
                            SYSTEM JAMMED<br>
                            <span style="font-size:0.4em; color:white;">REBOOTING...</span>
                        </div>
                    `;
                } else {
                    this.jammerOverlay.classList.remove('active');
                }
            }
        }
    }
}
