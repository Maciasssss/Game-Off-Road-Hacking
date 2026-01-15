class AbilityManager {
    constructor(socket) {
        this.socket = socket;
        this.currentAP = 0;
        this.MAX_AP = 400; 
        
        // Configuration for Abilities
        this.abilities = [
            { id: 'instant_charge', name: 'INSTANT CHARGE', cost: 150, icon: '🔋', color: '#00ff00' },
            { id: 'shield_break', name: 'EMP BLAST', cost: 200, icon: '💥', color: '#ffcc00' },
            { id: 'global_shield', name: 'GLOBAL SHIELD', cost: 250, icon: '🛡️', color: '#00ccff' },
            { id: 'boost', name: 'OVERCLOCK (2x)', cost: 300, icon: '⚡', color: '#ff6600' },
            { id: 'freeze', name: 'JAMMER', cost: 400, icon: '❄️', color: '#00ffff' }
        ];

        // Store config to calculate dynamic costs
        this.gameConfig = {
            ability_cost_multiplier: 1.0,
            excluded_abilities: []
        };

        // UI References
        this.menu = document.getElementById('ability-menu');
        this.menuBtn = document.getElementById('btn-ability-menu');
        this.closeBtn = document.getElementById('btn-close-ability-menu');
        this.apFill = document.getElementById('ap-fill');
        this.apText = document.getElementById('ap-text');

        if (!this.menu || !this.menuBtn) return;

        this.abilityListContainer = this.getOrCreateListContainer();
        this.bindEvents();
        this.setupListeners();
        
        // Initial Draw
        this.renderAbilities();
    }

    getOrCreateListContainer() {
        // Look for existing container created by previous renders
        let list = this.menu.querySelector('.dynamic-ability-list');
        
        // If not found, look for content area and create it
        if (!list) {
            list = document.createElement('div');
            list.className = 'dynamic-ability-list';
            const content = this.menu.querySelector('.ability-menu-content');
            if(content) content.appendChild(list);
        }
        return list;
    }

    // Helper to calculate dynamic cost
    getCost(baseCost) {
        let cost = Math.floor(baseCost * this.gameConfig.ability_cost_multiplier);
        const maxLimit = this.gameConfig.max_ap || 400; 
        return Math.min(cost, maxLimit);
    }

    renderAbilities() {
        if (!this.abilityListContainer) return;
        this.abilityListContainer.innerHTML = '';

        this.abilities.forEach(ability => {
            if (this.gameConfig.excluded_abilities.includes(ability.id)) {
                return;
            }

            const currentCost = this.getCost(ability.cost);

            const btn = document.createElement('button');
            btn.className = 'ability-card';
            btn.dataset.id = ability.id;
            btn.dataset.baseCost = ability.cost;
            btn.dataset.color = ability.color; 
            
            btn.innerHTML = `
                <div class="ability-icon" style="color: ${ability.color}">${ability.icon}</div>
                <div class="ability-info">
                    <span class="ability-name">${ability.name}</span>
                    <span class="ability-cost">COST: ${currentCost} AP</span>
                </div>
            `;

            btn.onclick = (e) => {
                e.stopPropagation(); 
                this.cast(ability.id, currentCost, ability.name);
            };
            
            this.abilityListContainer.appendChild(btn);
        });
        
        this.updateAP(this.currentAP);
    }

    bindEvents() {
        this.menuBtn.onclick = (e) => {
            e.stopPropagation();
            this.menu.classList.add('open');
        };

        if (this.closeBtn) {
            this.closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.menu.classList.remove('open');
            };
        }

        document.addEventListener('click', (e) => {
            if (this.menu.classList.contains('open')) {
                if (!this.menu.contains(e.target) && !this.menuBtn.contains(e.target)) {
                    this.menu.classList.remove('open');
                }
            }
        });
    }

    setupListeners() {
        this.socket.on('energy_charged', (data) => {
            this.updateAP(data.current_ap);
        });
        
        this.socket.on('ability_success', (data) => {
            this.updateAP(data.current_ap);
            this.menu.classList.remove('open');
            if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
        });
        
        this.socket.on('update_state', (state) => {
            if (state.config) {
                let needsRender = false;
                
                if (state.config.ability_cost_multiplier !== this.gameConfig.ability_cost_multiplier ||
                    state.config.max_ap !== this.gameConfig.max_ap ||
                    JSON.stringify(state.config.excluded_abilities) !== JSON.stringify(this.gameConfig.excluded_abilities)) {
                    needsRender = true;
                }

                this.gameConfig.ability_cost_multiplier = state.config.ability_cost_multiplier;
                this.gameConfig.max_ap = state.config.max_ap;
                this.gameConfig.excluded_abilities = state.config.excluded_abilities || [];
                
                this.MAX_AP = this.gameConfig.max_ap; 

                if (needsRender) {
                    this.renderAbilities();
                }
            }

            // 2. Update AP
            if(window.myPlayerId && state.players && state.players[window.myPlayerId]) {
                const sAP = state.players[window.myPlayerId].ability_points || 0;
                if(Math.abs(sAP - this.currentAP) > 0 || (this.currentAP === 0 && sAP === 0)) {
                    this.updateAP(sAP);
                }
            }
        });
    }

    updateAP(newAmount) {
        this.currentAP = newAmount;
        const percent = this.MAX_AP > 0 ? Math.min((this.currentAP / this.MAX_AP) * 100, 100) : 0;
        
        if(this.apFill) this.apFill.style.width = `${percent}%`;
        if(this.apText) this.apText.innerText = `${Math.floor(this.currentAP)}/${this.MAX_AP}`;
        
        const activeAbilities = this.abilities.filter(a => !this.gameConfig.excluded_abilities.includes(a.id));
        const canAffordAny = activeAbilities.some(a => this.currentAP >= this.getCost(a.cost));
        
        if (this.menuBtn) {
            if (canAffordAny) this.menuBtn.classList.add('ready');
            else this.menuBtn.classList.remove('ready');
        }

        // Update Button Visuals
        if (this.abilityListContainer) {
            const buttons = this.abilityListContainer.querySelectorAll('.ability-card');
            buttons.forEach(btn => {
                const baseCost = parseInt(btn.dataset.baseCost);
                const currentCost = this.getCost(baseCost);
                const abilityColor = btn.dataset.color || '#fff';
                
                // Update text
                const costSpan = btn.querySelector('.ability-cost');
                if(costSpan) costSpan.innerText = `COST: ${currentCost} AP`;

                if (this.currentAP >= currentCost) {
                    btn.classList.add('ready');
                    btn.disabled = false;
                    btn.style.borderColor = abilityColor;
                    btn.style.boxShadow = `0 0 10px ${abilityColor}`;
                } else {
                    btn.classList.remove('ready');
                    btn.disabled = true;
                    btn.style.borderColor = '#334455'; 
                    btn.style.boxShadow = 'none';
                }
            });
        }
    }

    cast(type, cost, name) {
        if(this.currentAP < cost) {
            if(window.notificationManager) {
                window.notificationManager.error(
                    'INSUFFICIENT AP', 
                    `Required: ${cost} | Current: ${this.currentAP}`
                );
            }
            return;
        }
        
        if (window.notificationManager) {
            window.notificationManager.confirm(
                `ACTIVATE ${name}?`,
                `This will consume ${cost} AP. Initialize protocol?`,
                () => {
                    window.notificationManager.ability(
                        'INITIALIZING...', 
                        `Injecting ${name} protocol into network...`
                    );
                    this.socket.emit('cast_ability', {
                        shortCode: window.myPlayerId,
                        type: type
                    });
                },
                () => { console.log("Ability cancelled"); }
            );
        } else {
            if(confirm(`ACTIVATE ${name}?\nCost: ${cost} AP`)) {
                this.socket.emit('cast_ability', {
                    shortCode: window.myPlayerId,
                    type: type
                });
            }
        }
    }
}