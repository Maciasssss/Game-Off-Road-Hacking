class VisualFXManager {
    constructor() {
        this.activeBoosts = { RED: false, BLUE: false };
        this.activeJams = { RED: false, BLUE: false };
        this.injectContainer();
    }

    injectContainer() {
        // Container for popups (center screen)
        this.container = document.createElement('div');
        this.container.id = 'vfx-container';
        document.body.appendChild(this.container);

        // Jammer Overlay (Full screen freeze effect)
        this.jammerOverlay = document.createElement('div');
        this.jammerOverlay.id = 'jammer-overlay';
        document.body.appendChild(this.jammerOverlay);
    }

    /**
     * Trigger a "Kill Feed" style announcement
     */
    showAnnouncement(abilityType, team, msg) {
        const popup = document.createElement('div');
        popup.className = `vfx-popup ${team.toLowerCase()} ${abilityType}`;
        
        let icon = '';
        if (abilityType === 'boost') icon = '🚀';
        if (abilityType === 'shield_break') icon = '💥';
        if (abilityType === 'global_shield') icon = '🛡️';
        if (abilityType === 'freeze') icon = '❄️';
        if (abilityType === 'instant_charge') icon = '🔋';

        popup.innerHTML = `
            <div class="vfx-icon">${icon}</div>
            <div class="vfx-text">
                <div class="vfx-title">${abilityType.replace('_', ' ').toUpperCase()}</div>
                <div class="vfx-desc">${msg}</div>
            </div>
        `;

        this.container.appendChild(popup);

        // Animation Entrance
        requestAnimationFrame(() => {
            popup.classList.add('show');
        });

        // Auto remove
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 500);
        }, 3000);
        
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }

    /**
     * Updates persistent effects based on game state
     */
    updateState(modifiers, myTeam) {
        if (!modifiers) return;

        const now = Date.now() / 1000;

        // 1. HANDLE BOOST (2x Points)
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

        // 2. HANDLE JAMMER (Freeze)
        // If MY team is frozen, show overlay
        if (myTeam && myTeam !== 'SPECTATOR') {
            const isFrozen = modifiers[myTeam].frozen_end > now;
            
            if (this.activeJams[myTeam] !== isFrozen) {
                this.activeJams[myTeam] = isFrozen;
                if (isFrozen) {
                    this.jammerOverlay.classList.add('active');
                    this.jammerOverlay.innerHTML = '<div class="jammer-text">SYSTEM JAMMED</div>';
                } else {
                    this.jammerOverlay.classList.remove('active');
                }
            }
        }
    }
}