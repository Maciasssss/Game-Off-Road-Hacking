/**
 * Game Master Manager
 * Handles GM-exclusive features, game configuration, and shared player features.
 */
class GMManager {
    constructor(socket, authManager) {
        this.socket = socket;
        this.authManager = authManager;
        this.isGM = false;
        this.isTeamLead = false;
        this.currentPlayer = null;
        this.currentTeam = null;
        this.teamNames = { RED: "RED TEAM", BLUE: "BLUE TEAM" };
        this.leaderboardData = [];
        
        this.bindEvents();
        this.setupSocketListeners();
        this.bindConfigEvents();
    }

    bindEvents() {
        // --- MENU TOGGLING ---
        const menuBtn = document.getElementById('btn-gm-menu');
        const menu = document.getElementById('gm-menu');
        const closeMenuBtn = document.getElementById('btn-close-gm-menu');

        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.add('open');
            });
        }

        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', () => {
                menu.classList.remove('open');
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (menu && menu.classList.contains('open')) {
                if (!menu.contains(e.target) && e.target !== menuBtn) {
                    menu.classList.remove('open');
                }
            }
        });

        // --- TEAM NAMING ---
        const setRedTeamBtn = document.getElementById('btn-set-red-team');
        const setBlueTeamBtn = document.getElementById('btn-set-blue-team');

        if (setRedTeamBtn) setRedTeamBtn.addEventListener('click', () => this.setTeamName('RED'));
        if (setBlueTeamBtn) setBlueTeamBtn.addEventListener('click', () => this.setTeamName('BLUE'));

        // --- PLAYER MANAGEMENT ---
        const changeNameBtn = document.getElementById('btn-change-name');
        if (changeNameBtn) changeNameBtn.addEventListener('click', () => this.showNameChangeDialog());

        // --- LEADERBOARD ---
        const viewLeaderboardBtn = document.getElementById('btn-view-leaderboard');
        if (viewLeaderboardBtn) viewLeaderboardBtn.addEventListener('click', () => this.showLeaderboard());

        const leaderboardModal = document.getElementById('leaderboard-modal');
        const closeLeaderboardBtn = document.getElementById('btn-close-leaderboard');

        if (closeLeaderboardBtn) closeLeaderboardBtn.addEventListener('click', () => leaderboardModal.classList.add('hidden'));
        if (leaderboardModal) leaderboardModal.addEventListener('click', (e) => {
            if (e.target === leaderboardModal) leaderboardModal.classList.add('hidden');
        });

        // --- GAME CONTROLS ---
        const restartGameBtn = document.getElementById('btn-restart-game-menu');
        const endGameBtn = document.getElementById('btn-end-game-menu');
        const startGameBtn = document.getElementById('btn-start-game-menu');

        if (restartGameBtn) restartGameBtn.addEventListener('click', () => this.restartGame());
        if (endGameBtn) endGameBtn.addEventListener('click', () => this.endGame());
        if (startGameBtn) startGameBtn.addEventListener('click', () => this.startGameNow());

        // --- SYSTEM / LOGOUT ---
        const logoutBtn = document.getElementById('btn-menu-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.performLogout());
        }
    }

    // --- CONFIGURATION EVENT BINDING ---
    bindConfigEvents() {
        const saveBtn = document.getElementById('btn-save-config');
        const rangeInput = document.getElementById('conf-cost-mult');
        const rangeVal = document.getElementById('conf-cost-val');

        // Live update for range slider value
        if(rangeInput && rangeVal) {
            rangeInput.addEventListener('input', (e) => {
                rangeVal.innerText = e.target.value;
            });
        }

        if(saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfig());
        }
    }

    // --- SAVE CONFIG TO SERVER ---
    saveConfig() {
        if(!this.isGM) return;

        // Visual feedback
        const saveBtn = document.getElementById('btn-save-config');
        if(saveBtn) {
            saveBtn.innerText = "SAVING...";
            saveBtn.disabled = true;
        }

        // Helper to safely get value (Fixes button freezing if ID is missing)
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? parseInt(el.value) : 0;
        };
        const getFloat = (id) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) : 1.0;
        };
        const getCheck = (id) => {
            const el = document.getElementById(id);
            return el ? el.checked : false;
        };

        // Gather Excluded Abilities (Safety check included)
        const excluded = [];
        const checkboxes = document.querySelectorAll('.ability-toggle');
        checkboxes.forEach(cb => {
            if(!cb.checked) excluded.push(cb.dataset.ability);
        });

        // Safe extraction of config values
        const config = {
            max_score: getVal('conf-max-score') || 1000,
            max_ap: getVal('conf-max-ap') || 400,
            ability_cost_multiplier: getFloat('conf-cost-mult') || 1.0,
            shield_duration_fast: getVal('conf-shield-fast') || 45,
            shield_duration_normal: getVal('conf-shield-normal') || 15,
            hack_bonus_fast: getVal('conf-bonus-fast') || 10,
            hack_bonus_normal: getVal('conf-bonus-normal') || 5,
            battery_drain_enabled: getCheck('conf-battery-drain'),
            excluded_abilities: excluded
        };

        console.log("Saving Config:", config);

        this.socket.emit('update_game_config', {
            shortCode: this.currentPlayer,
            config: config
        });

        // Reset button text after 1s
        setTimeout(() => {
            if(saveBtn) {
                saveBtn.innerText = "SAVE CONFIGURATION";
                saveBtn.disabled = false;
            }
        }, 1000);
    }

    setupSocketListeners() {
        this.socket.on('login_success', (data) => {
            this.currentPlayer = data.shortCode;
            this.currentTeam = data.team;
            this.isGM = data.is_gm;
            this.isTeamLead = data.is_team_lead;
            
            if (data.red_name) this.teamNames.RED = data.red_name;
            if (data.blue_name) this.teamNames.BLUE = data.blue_name;
            
            const menuBtn = document.getElementById('btn-gm-menu');
            if (menuBtn) {
                if (this.isGM || this.isTeamLead) {
                    menuBtn.classList.add('visible');
                    menuBtn.style.display = 'flex'; 
                } else {
                    menuBtn.style.display = 'none';
                }
            }

            this.updateMenuState();
        });

        this.socket.on('team_names_set', (data) => {
            this.teamNames = { RED: data.red_name, BLUE: data.blue_name };
            this.updateMenuState(); 
            if (window.notificationManager) {
                window.notificationManager.system('DATABASE UPDATED', `RED: ${data.red_name}\nBLUE: ${data.blue_name}`);
            }
            this.closeMenu();
        });

        this.socket.on('leaderboard_data', (data) => {
            this.leaderboardData = data.ranking;
            this.displayLeaderboard();
        });

        this.socket.on('game_ended', (data) => {
            this.leaderboardData = data.ranking;
        });

        this.socket.on('game_restarted', () => {
            this.closeMenu();
        });

        this.socket.on('update_state', (state) => {
            if (state.config && this.isGM) {
                this.updateConfigUI(state.config, state.game_active);
            }
        });

        this.socket.on('config_updated', (data) => {
            if(window.notificationManager) window.notificationManager.success("CONFIG SAVED", data.msg);
        });
        
        this.socket.on('error_msg', (data) => {
             if(data.msg.includes('Cannot change settings')) {
                 if(window.notificationManager) window.notificationManager.error("ACTION BLOCKED", data.msg);
             }
        });
    }

    // --- UPDATE CONFIG UI (LOCK/UNLOCK & SYNC) ---
    updateConfigUI(config, isGameActive) {
        // 1. Sync Values (Only if user is NOT currently typing)
        if(document.activeElement.tagName !== 'INPUT') {
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
            const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
            const setCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val; };

            setVal('conf-max-score', config.max_score);
            setVal('conf-max-ap', config.max_ap);
            setVal('conf-cost-mult', config.ability_cost_multiplier);
            setText('conf-cost-val', config.ability_cost_multiplier);
            setVal('conf-shield-fast', config.shield_duration_fast);
            setVal('conf-shield-normal', config.shield_duration_normal);
            setVal('conf-bonus-fast', config.hack_bonus_fast);
            setVal('conf-bonus-normal', config.hack_bonus_normal);
            setCheck('conf-battery-drain', config.battery_drain_enabled);
           
            const excludedList = config.excluded_abilities || [];
            const toggles = document.querySelectorAll('.ability-toggle');
            toggles.forEach(toggle => {
                const abilityId = toggle.dataset.ability;
                toggle.checked = !excludedList.includes(abilityId);
            });
        }

        // 2. Lock inputs if game active
        const idsToLock = [
            'conf-max-score', 'conf-max-ap', 'conf-cost-mult', 
            'conf-shield-fast', 'conf-shield-normal', 
            'conf-bonus-fast', 'conf-bonus-normal',
            'conf-battery-drain', 'btn-save-config'
        ];

        idsToLock.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.disabled = isGameActive;
                if(el.parentElement) el.parentElement.style.opacity = isGameActive ? '0.5' : '1';
            }
        });
        
        const toggles = document.querySelectorAll('.ability-toggle');
        toggles.forEach(t => {
            t.disabled = isGameActive;
            if(t.parentElement) t.parentElement.style.opacity = isGameActive ? '0.5' : '1';
        });

        // 3. Swap Start/Restart Buttons
        const startBtn = document.getElementById('btn-start-game-menu');
        const restartBtn = document.getElementById('btn-restart-game-menu');
        if(startBtn) startBtn.style.display = isGameActive ? 'none' : 'block';
        if(restartBtn) restartBtn.style.display = isGameActive ? 'block' : 'none';

        // 4. Update Status Message
        const statusMsg = document.getElementById('config-status-msg');
        const lockIcon = document.getElementById('config-lock-icon');
        
        if(statusMsg) {
            if(isGameActive) {
                statusMsg.innerText = "⚠ Game in progress. Restart to unlock.";
                statusMsg.style.color = "#ff6600";
                if(lockIcon) lockIcon.style.display = 'inline';
            } else {
                statusMsg.innerText = "Settings unlocked.";
                statusMsg.style.color = "#00ff00";
                if(lockIcon) lockIcon.style.display = 'none';
            }
        }
    }

    performLogout() {
        if(window.notificationManager) {
            window.notificationManager.confirm(
                'DISCONNECT?',
                'Are you sure you want to log out?',
                () => {
                    this.socket.emit('release_identity', { shortCode: this.currentPlayer });
                    localStorage.removeItem('playerCode');
                    window.location.reload();
                },
                () => {}
            );
        } else {
            if(confirm("Log out?")) {
                this.socket.emit('release_identity', { shortCode: this.currentPlayer });
                localStorage.removeItem('playerCode');
                window.location.reload();
            }
        }
    }

    updateMenuState() {
        const teamSection = document.getElementById('gm-section-teams');
        const configSection = document.getElementById('gm-config-section');
        const controlSection = document.getElementById('gm-section-control');
        const playerSection = document.getElementById('gm-section-player');
        const leaderboardSection = document.getElementById('gm-section-leaderboard');
        const systemSection = document.getElementById('gm-section-system');

        // VISIBLE TO EVERYONE
        if (playerSection) playerSection.style.display = 'block';
        if (leaderboardSection) leaderboardSection.style.display = 'block';
        if (systemSection) systemSection.style.display = 'block';

        // GM ONLY
        if (configSection) configSection.style.display = this.isGM ? 'block' : 'none';
        if (controlSection) controlSection.style.display = this.isGM ? 'block' : 'none';

        // TEAM NAMES (GM or Team Lead)
        if (teamSection) {
            const redInput = document.getElementById('input-red-team-name');
            const blueInput = document.getElementById('input-blue-team-name');
            const redGroup = redInput ? redInput.closest('.team-name-group') : null;
            const blueGroup = blueInput ? blueInput.closest('.team-name-group') : null;

            let redVisible = false;
            let blueVisible = false;

            if (redGroup) {
                const canSeeRed = this.isGM || (this.isTeamLead && this.currentTeam === 'RED');
                redGroup.style.display = canSeeRed ? 'flex' : 'none';
                if(canSeeRed) redVisible = true;
            }
            if (blueGroup) {
                const canSeeBlue = this.isGM || (this.isTeamLead && this.currentTeam === 'BLUE');
                blueGroup.style.display = canSeeBlue ? 'flex' : 'none';
                if(canSeeBlue) blueVisible = true;
            }

            teamSection.style.display = (redVisible || blueVisible) ? 'block' : 'none';
        }

        const redInput = document.getElementById('input-red-team-name');
        const blueInput = document.getElementById('input-blue-team-name');
        if (redInput) redInput.value = this.teamNames.RED;
        if (blueInput) blueInput.value = this.teamNames.BLUE;
    }

    closeMenu() {
        const menu = document.getElementById('gm-menu');
        if (menu) {
            menu.classList.remove('open');
        }
    }

    setTeamName(team) {
        const authorized = (this.isTeamLead && this.currentTeam === team) || this.isGM;
        if (!authorized) {
             if(window.notificationManager) window.notificationManager.warning('ACCESS DENIED', 'You cannot rename this team.');
             return;
        }

        const inputId = team === 'RED' ? 'input-red-team-name' : 'input-blue-team-name';
        const input = document.getElementById(inputId);
        const newName = input.value.trim().toUpperCase();
        
        if (!newName) {
            if(window.notificationManager) window.notificationManager.warning('SYNTAX ERROR', `Enter a valid name for ${team} team.`);
            return;
        }
        this.socket.emit('set_team_name', {
            shortCode: this.currentPlayer,
            team: team,
            name: input.value.trim().toUpperCase()
        });
    }

    showNameChangeDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'input-modal-overlay';
        overlay.innerHTML = `
            <div class="input-modal-box">
                <div class="input-modal-title">IDENTITY RECONFIGURATION</div>
                <input type="text" class="input-modal-field" id="new-name-input" maxlength="12" placeholder="ENTER NEW ALIAS" autocomplete="off">
                <div class="input-modal-buttons">
                    <button class="btn-modal-cancel" id="cancel-name-btn">CANCEL</button>
                    <button class="btn-modal-confirm" id="confirm-name-btn">CONFIRM</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('new-name-input');
        const confirmBtn = document.getElementById('confirm-name-btn');
        const cancelBtn = document.getElementById('cancel-name-btn');
        input.focus();

        const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };
        const submit = () => {
            const newName = input.value.trim().toUpperCase();
            if (!newName) return;
            this.socket.emit('set_player_name', { shortCode: this.currentPlayer, name: newName });
            close();
            this.closeMenu();
        };

        confirmBtn.onclick = submit;
        cancelBtn.onclick = close;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') close();
        });
    }

    showLeaderboard() {
        this.socket.emit('get_leaderboard', { shortCode: this.currentPlayer });
    }

    displayLeaderboard() {
        const modal = document.getElementById('leaderboard-modal');
        const container = document.getElementById('leaderboard-table-container');
        if (!modal || !container) return;

        if (!this.leaderboardData || this.leaderboardData.length === 0) {
            container.innerHTML = '<p style="color: #00ff00; text-align: center; padding: 20px;">NO BATTLE DATA RECORDED.</p>';
            modal.classList.remove('hidden');
            return;
        }

        // 1. Group data by timestamp (Match ID)
        const grouping = {};
        this.leaderboardData.forEach(entry => {
            if (!grouping[entry.timestamp]) {
                grouping[entry.timestamp] = [];
            }
            grouping[entry.timestamp].push(entry);
        });

        // 2. Process matches and calculate High Scores
        const matchesArray = Object.keys(grouping).map(timestamp => {
            const entries = grouping[timestamp];
            
            let redScore = 0;
            let blueScore = 0;
            const redPlayers = [];
            const bluePlayers = [];

            entries.forEach(e => {
                if (e.team === 'RED') {
                    if (e.player_name === 'TOTAL') redScore = e.score;
                    else {
                        redPlayers.push(e);
                        // Fallback if TOTAL row missing
                        if (e.player_name !== 'TOTAL') redScore = Math.max(redScore, e.score); 
                    }
                } else if (e.team === 'BLUE') {
                    if (e.player_name === 'TOTAL') blueScore = e.score;
                    else {
                        bluePlayers.push(e);
                        if (e.player_name !== 'TOTAL') blueScore = Math.max(blueScore, e.score);
                    }
                }
            });

            // Sort roster by score
            redPlayers.sort((a,b) => b.score - a.score);
            bluePlayers.sort((a,b) => b.score - a.score);

            // Determine the highest score of this match for sorting purposes
            const highestScore = Math.max(redScore, blueScore);

            return {
                timestamp: timestamp,
                redScore: redScore,
                blueScore: blueScore,
                highestScore: highestScore,
                redPlayers: redPlayers,
                bluePlayers: bluePlayers,
                dateStr: new Date(timestamp).toLocaleString()
            };
        });

        // 3. SORT LOGIC: Highest Score First (Best Match at Top)
        matchesArray.sort((a, b) => b.highestScore - a.highestScore);

        // 4. Generate HTML
        let fullHtml = '';
        matchesArray.forEach((match, index) => {
            const winner = match.redScore > match.blueScore ? 'RED' : (match.blueScore > match.redScore ? 'BLUE' : 'DRAW');
            const toggleId = `match-details-${index}`;
            const rank = index + 1;

            // Rank Styling
            let rankBadge = `<span style="background:#333; color:#aaa; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8em;">#${rank}</span>`;
            let borderStyle = '1px solid #444';
            
            if (rank === 1) {
                borderStyle = '2px solid #FFD700'; // Gold
                rankBadge = `<span style="background:#FFD700; color:#000; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8em;">🏆 RANK #1</span>`;
            } else if (rank === 2) {
                borderStyle = '2px solid #C0C0C0'; // Silver
                rankBadge = `<span style="background:#C0C0C0; color:#000; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8em;">🥈 RANK #2</span>`;
            } else if (rank === 3) {
                borderStyle = '2px solid #CD7F32'; // Bronze
                rankBadge = `<span style="background:#CD7F32; color:#000; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8em;">🥉 RANK #3</span>`;
            }

            const redOpacity = winner === 'BLUE' ? '0.5' : '1';
            const blueOpacity = winner === 'RED' ? '0.5' : '1';

            fullHtml += `
                <div style="background: rgba(0, 10, 0, 0.9); border: ${borderStyle}; border-radius: 8px; margin-bottom: 25px; padding: 0; box-shadow: 0 5px 15px rgba(0,0,0,0.5); overflow: hidden;">
                    
                    <!-- MATCH HEADER -->
                    <div style="background: rgba(255,255,255,0.05); padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333;">
                        <div>${rankBadge}</div>
                        <span style="color: #888; font-size: 0.8em; font-family: monospace;">${match.dateStr}</span>
                    </div>

                    <!-- SCORES DISPLAY -->
                    <div style="display: flex; padding: 20px 0;">
                        <!-- RED TEAM -->
                        <div style="flex: 1; text-align: center; opacity: ${redOpacity}; border-right: 1px solid #333;">
                            <h3 style="color: #ff3333; margin: 0 0 5px 0; font-size: 1.1em; letter-spacing: 1px;">${this.teamNames.RED}</h3>
                            <div style="font-size: 2.5em; font-weight: bold; color: #fff; text-shadow: 0 0 10px rgba(255, 51, 51, 0.5);">
                                ${Math.floor(match.redScore)}
                            </div>
                            ${winner === 'RED' ? '<div style="background:#ff3333; color:#000; display:inline-block; padding:2px 8px; font-size:0.7em; font-weight:bold; border-radius:4px; margin-top:5px;">VICTORY</div>' : ''}
                        </div>

                        <!-- VS -->
                        <div style="display: flex; align-items: center; justify-content: center; width: 40px; color: #555; font-weight: bold; font-style: italic;">
                            VS
                        </div>

                        <!-- BLUE TEAM -->
                        <div style="flex: 1; text-align: center; opacity: ${blueOpacity}; border-left: 1px solid #333;">
                            <h3 style="color: #3366ff; margin: 0 0 5px 0; font-size: 1.1em; letter-spacing: 1px;">${this.teamNames.BLUE}</h3>
                            <div style="font-size: 2.5em; font-weight: bold; color: #fff; text-shadow: 0 0 10px rgba(51, 102, 255, 0.5);">
                                ${Math.floor(match.blueScore)}
                            </div>
                             ${winner === 'BLUE' ? '<div style="background:#3366ff; color:#000; display:inline-block; padding:2px 8px; font-size:0.7em; font-weight:bold; border-radius:4px; margin-top:5px;">VICTORY</div>' : ''}
                        </div>
                    </div>

                    <!-- TOGGLE BUTTON -->
                    <button class="lb-toggle-btn" data-target="${toggleId}" style="
                        width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: none; border-top: 1px solid #333; 
                        color: #aaa; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 0.8em;
                        transition: all 0.2s;">
                        ▼ VIEW AGENT PERFORMANCE ▼
                    </button>

                    <!-- COLLAPSIBLE ROSTER -->
                    <div id="${toggleId}" style="display: none; background: rgba(0,0,0,0.3); padding: 15px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                            <!-- Red Players -->
                            <div style="flex: 1; min-width: 140px;">
                                <h4 style="color: #ff3333; margin:0 0 10px 0; font-size:0.8em; border-bottom: 1px solid #ff3333; padding-bottom:5px;">RED AGENTS</h4>
                                ${this.generatePlayerList(match.redPlayers)}
                            </div>
                            <!-- Blue Players -->
                            <div style="flex: 1; min-width: 140px;">
                                <h4 style="color: #3366ff; margin:0 0 10px 0; font-size:0.8em; border-bottom: 1px solid #3366ff; padding-bottom:5px;">BLUE AGENTS</h4>
                                ${this.generatePlayerList(match.bluePlayers)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = fullHtml;
        modal.classList.remove('hidden');

        // Re-bind Toggle Events
        const toggles = container.querySelectorAll('.lb-toggle-btn');
        toggles.forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.getAttribute('data-target');
                const targetDiv = document.getElementById(targetId);
                
                if (targetDiv.style.display === 'none') {
                    targetDiv.style.display = 'block';
                    btn.innerText = '▲ HIDE AGENT PERFORMANCE ▲';
                    btn.style.background = 'rgba(255, 255, 255, 0.05)';
                    btn.style.color = '#fff';
                } else {
                    targetDiv.style.display = 'none';
                    btn.innerText = '▼ VIEW AGENT PERFORMANCE ▼';
                    btn.style.background = 'rgba(0, 0, 0, 0.5)';
                    btn.style.color = '#aaa';
                }
            };
        });
    }

    generatePlayerList(players) {
        if (!players || players.length === 0) return '<div style="color:#555; font-size:0.8em; font-style:italic;">No data available</div>';
        
        let html = `<ul style="list-style:none; padding:0; margin:0; font-size:0.85em;">`;
        players.forEach(p => {
            if(p.player_name === 'TOTAL') return;

            html += `
                <li style="padding: 5px 0; border-bottom: 1px dashed #333; color:#ccc; display:flex; justify-content:space-between; align-items:center;">
                    <span>${p.player_name}</span>
                    <span style="font-weight:bold; color:#fff;">${Math.floor(p.score)} pts</span>
                </li>`;
        });
        html += `</ul>`;
        return html;
    }

    startGameNow() {
        if (!this.isGM) return;
        this.socket.emit('start_game_now', { shortCode: this.currentPlayer });
    }

    restartGame() {
        if (!this.isGM) return;
        window.notificationManager.confirm(
            'RESTART MATCH?',
            'Save scores?',
            () => { this.socket.emit('restart_game', { shortCode: this.currentPlayer, save: true }); },
            () => {}
        );
    }

    endGame() {
        if (!this.isGM) return;
        window.notificationManager.confirm(
            'END SESSION?',
            'Log out all players?',
            () => { this.socket.emit('end_session', { shortCode: this.currentPlayer }); },
            () => {}
        );
    }
}