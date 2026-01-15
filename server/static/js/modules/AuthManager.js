class AuthManager {
    constructor(socket, ui) {
        this.socket = socket;
        this.ui = ui;
        this.currentPlayer = null;
        this.isGameMaster = false;
        this.bindEvents();
        this.setupSocketListeners();
        this.setupDelegatedEvents(); 
    }

    bindEvents() {
        const btn = document.getElementById('btn-login');
        if(btn) btn.addEventListener('click', () => this.attemptLogin());
    }

    setupDelegatedEvents() {
        // Event delegation for dynamically created buttons (End Screen)
        document.body.addEventListener('click', (e) => {
            // Restart Match Button
            const restartBtn = e.target.closest('#restart-match-btn');
            if (restartBtn) {
                e.stopImmediatePropagation();
                if (!this.isGameMaster) {
                    if(window.notificationManager) window.notificationManager.error("ACCESS DENIED", "Only Game Master can restart.");
                    return;
                }
                window.notificationManager.confirm('RESTART MATCH?', 'Save scores?', 
                    () => { 
                        this.socket.emit('restart_game', { shortCode: this.currentPlayer, save: true }); 
                    }, 
                    () => { 
                        window.notificationManager.confirm('DISCARD DATA?', 'Really wipe scores?', 
                            () => { this.socket.emit('restart_game', { shortCode: this.currentPlayer, save: false }); }, () => {}); 
                    }
                );
            }

            // End Session Button
            const endSessionBtn = e.target.closest('#end-session-btn');
            if (endSessionBtn) {
                e.stopImmediatePropagation();
                if (!this.isGameMaster) {
                    if(window.notificationManager) window.notificationManager.error("ACCESS DENIED", "Only Game Master can end session.");
                    return;
                }
                window.notificationManager.confirm('TERMINATE SESSION?', 'Log out all players?', 
                    () => { this.socket.emit('end_session', { shortCode: this.currentPlayer }); }, () => {});
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('login_success', (data) => {
            this.currentPlayer = data.shortCode;
            this.isGameMaster = data.is_gm;
            
            console.log(`[AUTH] Logged in. GM: ${this.isGameMaster}. Custom Name: ${data.has_custom_name}`);

            if (data.has_custom_name) {
                // If name exists, close dialog if open and show dashboard
                const dialog = document.getElementById('name-dialog');
                if(dialog) dialog.remove();
                this.ui.showScreen('dashboard');
            } else {
                // If server reset (no name), show dialog to set name
                this.showNameDialog(data.shortCode, data.is_gm);
            }
        });

        this.socket.on('name_updated', (data) => {
            if (window.notificationManager) window.notificationManager.success('IDENTITY VERIFIED', `Alias: ${data.name.toUpperCase()}`);
            const displayEl = document.getElementById('display-player-id');
            if (displayEl) displayEl.innerText = `AGENT: ${data.name.toUpperCase()}`;
        });

        this.socket.on('game_ended', (data) => this.handleGameEnded(data));

        this.socket.on('game_restarted', (data) => {
            const endScreen = document.getElementById('game-end-screen');
            if (endScreen) endScreen.remove();
            const leaderboard = document.getElementById('leaderboard-modal');
            if (leaderboard) leaderboard.classList.add('hidden');
            this.ui.showScreen('dashboard');
            if(navigator.vibrate) navigator.vibrate(200);
        });
    }

    attemptLogin() {
        const input = document.getElementById('input-card-code');
        const code = input.value.toUpperCase();
        if (code.length < 2) {
            if(window.notificationManager) window.notificationManager.warning('ERROR', 'Input card code.');
            return;
        }
        this.socket.emit('player_login', { shortCode: code });
    }

    showNameDialog(shortCode, isGmNow) {
        // Prevent duplicate dialogs
        if(document.getElementById('name-dialog')) return;

        const modal = document.createElement('div');
        modal.id = 'name-dialog';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95); border: 2px solid #00ff00; border-radius: 10px;
            padding: 30px; z-index: 10000; text-align: center; min-width: 350px;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
        `;

        // GM Status Indicator inside the dialog
        let gmStatusHtml = '';
        if (isGmNow) {
            gmStatusHtml = `<div style="color: #00ff00; border: 1px solid #00ff00; background: rgba(0,255,0,0.1); padding: 5px; margin-bottom: 15px; font-weight: bold;">⚠️ ACCESS LEVEL: GAME MASTER</div>`;
        }

        modal.innerHTML = `
            <h2 style="color: #00ff00; margin-top: 0; text-shadow: 0 0 10px #00ff00;">IDENTIFICATION REQUIRED</h2>
            <p style="color: #00aa00; font-size: 14px; margin-bottom: 20px;">Server Reset detected. Re-enter alias.</p>
            ${gmStatusHtml}
            <input type="text" id="player-name-input" placeholder="CODENAME..." 
                   style="width: 100%; padding: 12px; background: rgba(0, 50, 0, 0.6); 
                          border: 2px solid #00ff00; color: #00ff00; font-size: 16px; 
                          margin-bottom: 20px; border-radius: 5px; text-transform: uppercase;">
            
            <div style="display:flex; gap:10px; justify-content:center;">
                <button id="logout-btn" style="flex:1; padding: 12px; background: transparent; color: #ff3333; border: 1px solid #ff3333; font-weight: bold; cursor: pointer; border-radius: 5px; font-size: 14px;">EXIT / LOGOUT</button>
                <button id="confirm-name-btn" style="flex:1; padding: 12px; background: #00ff00; color: black; border: none; font-weight: bold; cursor: pointer; border-radius: 5px; font-size: 16px;">CONFIRM</button>
            </div>
        `;

        document.body.appendChild(modal);

        const confirmBtn = document.getElementById('confirm-name-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const input = document.getElementById('player-name-input');

        const submitName = () => {
            const name = input.value.trim();
            if (!name) return;
            this.socket.emit('set_player_name', { shortCode: shortCode, name: name });
            modal.remove();
            this.ui.showScreen('dashboard');
        };

        // 1. LOGOUT (Back to Login Screen)
        logoutBtn.addEventListener('click', () => {
            // Tell server to delete this player so GM/Team Lead slots are freed
            this.socket.emit('release_identity', { shortCode: shortCode });
            
            // Clear local storage and reload
            localStorage.removeItem('playerCode');
            window.location.reload();
        });

        confirmBtn.addEventListener('click', submitName);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitName(); });
        input.focus();
    }

    handleGameEnded(data) {
        const existing = document.getElementById('game-end-screen');
        if (existing) existing.remove();

        const endScreen = document.createElement('div');
        endScreen.id = 'game-end-screen';
        endScreen.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.98); z-index: 15000; display: flex;
            flex-direction: column; justify-content: center; align-items: center;
            color: #00ff00; text-align: center; overflow-y: auto; padding: 20px;
        `;

        let rankingHtml = '<h2 style="text-shadow: 0 0 10px #00ff00;">RANKING</h2><table style="margin: 20px auto; border-collapse: collapse; color: #00ff00;">';
        const sorted = [...data.ranking].sort((a, b) => b.score - a.score);
        sorted.forEach((entry, index) => {
            const teamColor = entry.team === 'RED' ? '#ff3333' : '#3366ff';
            rankingHtml += `
                <tr style="border-bottom: 1px solid ${teamColor}; padding: 10px;">
                    <td style="padding: 10px;"><strong>#${index + 1}</strong></td>
                    <td style="padding: 10px;">${entry.player_name}</td>
                    <td style="padding: 10px; color: ${teamColor};">${entry.team}</td>
                    <td style="padding: 10px;"><strong>${entry.score} pts</strong></td>
                </tr>`;
        });
        rankingHtml += '</table>';

        let gmButtonsHtml = '';
        if (this.isGameMaster) {
            gmButtonsHtml = `
                <div style="margin-top: 30px; display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                    <button id="restart-match-btn" style="padding: 15px 30px; background: transparent; color: #ffff00; border: 2px solid #ffff00; font-weight: bold; cursor: pointer; border-radius: 5px; pointer-events: auto;">↺ RESTART MATCH</button>
                    <button id="end-session-btn" style="padding: 15px 30px; background: #ff0000; color: white; border: none; font-weight: bold; cursor: pointer; border-radius: 5px; pointer-events: auto;">⚠ END SESSION</button>
                </div>`;
        } else {
            gmButtonsHtml = `<div style="margin-top: 30px; color: #666;">Waiting for Game Master...</div>`;
        }

        const finalRedBase = data.final_scores.RED;
        const finalBlueBase = data.final_scores.BLUE;
        const redBonus = data.bonus_scores ? data.bonus_scores.RED : 0;
        const blueBonus = data.bonus_scores ? data.bonus_scores.BLUE : 0;

        endScreen.innerHTML = `
            <div style="max-width: 800px; background: rgba(0, 0, 0, 0.95); border: 2px solid #00ff00; padding: 30px;">
                <h1 style="color: ${data.winner === 'DRAW' ? '#ffff00' : (data.winner === 'RED' ? '#ff3333' : '#3366ff')}">
                    ${data.winner === 'DRAW' ? 'DRAW!' : `WINNER: ${data.winner}`}
                </h1>
                <div style="display:flex; justify-content:space-around; margin:20px 0;">
                    <div style="color:#ff3333">RED: ${(finalRedBase + redBonus).toFixed(1)}</div>
                    <div style="color:#3366ff">BLUE: ${(finalBlueBase + blueBonus).toFixed(1)}</div>
                </div>
                ${rankingHtml}
                ${gmButtonsHtml}
            </div>
        `;
        document.body.appendChild(endScreen);
    }
}