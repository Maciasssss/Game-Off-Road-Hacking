/**
 * Scoreboard Manager
 * Handles dynamic score updates, slow fill animations, and player feedback display
 */

class ScoreboardManager {
    constructor(socket) {
        this.socket = socket;
        this.maxScore = 1000;
        
        this.redScoreBox = document.querySelector('.score-box.red');
        this.blueScoreBox = document.querySelector('.score-box.blue');
        
        this.state = {
            redScore: 0,
            blueScore: 0,
            redBonus: 0,
            blueBonus: 0
        };

        this.initVisuals();
        this.setupListeners();
    }

    setupListeners() {
        // 1. Listen for global Game State (Score numbers)
        this.socket.on('update_state', (state) => {
            if (!state.scores) return;
            
            if (state.max_score) this.maxScore = state.max_score;
            this.updateScores(state.scores, state.bonus_scores);
        });

        // 2. Listen for 'energy_charged' to show capture feedback messages
        // This event is only sent to the player who hacked the node.
        this.socket.on('energy_charged', (data) => {
            if (data.team) {
                const playerData = {
                    playerName: window.myPlayerId || "ME", 
                    speedCategory: data.speed_category,
                    energyGain: data.energy_gain
                };
                this.updateCaptureFeedback(data.team, playerData);
            }
        });
    }
    initVisuals() {
        if (this.redScoreBox) {
            this.ensureBonusIndicator(this.redScoreBox, 'red');
            this.updateFillBar(this.redScoreBox, 0);
        }
        if (this.blueScoreBox) {
            this.ensureBonusIndicator(this.blueScoreBox, 'blue');
            this.updateFillBar(this.blueScoreBox, 0);
        }
    }

    ensureBonusIndicator(scoreBox, team) {
        let valueContainer = scoreBox.querySelector('.score-box-value');
        if (!valueContainer) return;

        // Ensure container styling for side-by-side layout
        valueContainer.style.display = 'flex';
        valueContainer.style.alignItems = 'baseline';
        valueContainer.style.justifyContent = 'center';
        valueContainer.style.gap = '10px';

        // Check if bonus element exists
        let bonusEl = document.getElementById(`score-bonus-${team}`);
        if (!bonusEl) {
            bonusEl = document.createElement('span');
            bonusEl.id = `score-bonus-${team}`;
            bonusEl.className = 'bonus-indicator';
            bonusEl.style.fontSize = '0.6em';
            bonusEl.style.color = '#ffff00';
            bonusEl.style.opacity = '0';
            bonusEl.style.transition = 'all 0.3s ease';
            valueContainer.appendChild(bonusEl);
        }
    }

    init(initialScores) {
        if (initialScores) {
            this.state.redScore = initialScores.RED || 0;
            this.state.blueScore = initialScores.BLUE || 0;
            this.updateDisplay();
        }
    }
    
    updateScores(scores, bonusScores) {
        let changed = false;

        // Update Base Scores
        if (scores) {
            if (this.state.redScore !== (scores.RED || 0)) {
                this.state.redScore = scores.RED || 0;
                changed = true;
            }
            if (this.state.blueScore !== (scores.BLUE || 0)) {
                this.state.blueScore = scores.BLUE || 0;
                changed = true;
            }
        }

        // Update Bonus Scores
        if (bonusScores) {
            if (this.state.redBonus !== (bonusScores.RED || 0)) {
                this.state.redBonus = bonusScores.RED || 0;
                changed = true;
            }
            if (this.state.blueBonus !== (bonusScores.BLUE || 0)) {
                this.state.blueBonus = bonusScores.BLUE || 0;
                changed = true;
            }
        }

        if (changed) {
            this.updateDisplay();
        }
    }

    updateDisplay() {
        // Update Text
        const redMain = document.getElementById('score-red');
        const blueMain = document.getElementById('score-blue');
        if (redMain) redMain.innerText = this.state.redScore.toFixed(1);
        if (blueMain) blueMain.innerText = this.state.blueScore.toFixed(1);

        // Update Bars
        if (this.redScoreBox) this.updateFillBar(this.redScoreBox, this.state.redScore);
        if (this.blueScoreBox) this.updateFillBar(this.blueScoreBox, this.state.blueScore);

        // Update Bonuses
        this.renderBonus('red', this.state.redBonus);
        this.renderBonus('blue', this.state.blueBonus);
    }

    updateFillBar(box, score) {
        const fill = box.querySelector('.score-box-fill');
        if (fill) {
            const pct = Math.min((score / this.maxScore) * 100, 100);
            fill.style.width = `${pct}%`;
            fill.innerText = `${score.toFixed(1)}/${this.maxScore}`;
        }
    }

    renderBonus(team, value) {
        const el = document.getElementById(`score-bonus-${team}`);
        if (el) {
            el.innerText = value > 0 ? `+${Math.floor(value)}` : '';
            el.style.opacity = value > 0 ? '1' : '0';
        }
    }

    /**
     * Shows: "AGENT X | FAST" under the score bar
     */
    updateCaptureFeedback(team, playerData) {
        const scoreBox = team === 'RED' ? this.redScoreBox : this.blueScoreBox;
        if (!scoreBox) return;

        let feedbackSection = scoreBox.querySelector('.score-feedback');
        if (!feedbackSection) {
            feedbackSection = document.createElement('div');
            feedbackSection.className = 'score-feedback';
            scoreBox.appendChild(feedbackSection);
        }
        
        // Create new log entry
        const entry = document.createElement('div');
        entry.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; color:#fff; font-size:0.8em; margin-top:5px;">
                <span style="font-weight:bold; color:#00ff00;">${playerData.playerName}</span> 
                <span style="color:${this.getSpeedColor(playerData.speedCategory)};">${playerData.speedCategory}</span>
            </div>
        `;
        
        // Add to DOM
        feedbackSection.innerHTML = ''; 
        feedbackSection.appendChild(entry);

        // Auto-clear after 3 seconds
        setTimeout(() => {
            if(feedbackSection.contains(entry)) entry.remove();
        }, 3000);
    }

    getSpeedColor(category) {
        if (category === 'FAST') return '#00ff00';
        if (category === 'NORMAL') return '#ffff00';
        return '#ff3333';
    }
}