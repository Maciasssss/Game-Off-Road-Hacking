/**
 * Abstract Base Class for all Minigames.
 * Handles common functionality like timers, cleanup, and completion callbacks.
 */
class MinigameBase {
    constructor(container, onComplete) {
        this.container = container;
        this.onComplete = onComplete; 
        this.activeInterval = null;
        this.activeTimeouts = [];
        this.isFinished = false;
    }

    /**
     * Entry point. Must be implemented by subclasses.
     */
    start() {
        console.error("Minigame start() method not implemented");
    }

    /**
     * Ends the game and triggers the callback.
     */
    finish(success, msg) {
        if (this.isFinished) return;
        this.isFinished = true;
        this.cleanup();
        this.onComplete(success, msg);
    }

    /**
     * Clears all running timers and intervals.
     */
    cleanup() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeTimeouts.forEach(t => clearTimeout(t));
        this.activeTimeouts = [];
    }

    /**
     * Registers a timeout so it can be auto-cleared on cleanup.
     */
    setTimeout(fn, delay) {
        const id = setTimeout(fn, delay);
        this.activeTimeouts.push(id);
        return id;
    }

    /**
     * Starts the countdown timer.
     */
    startTimer(seconds, failMsg = "TIMEOUT") {
        const timerEl = document.getElementById('game-timer-display');
        let timeLeft = seconds;
        
        if (timerEl) timerEl.innerText = timeLeft;

        this.activeInterval = setInterval(() => {
            timeLeft--;
            if (timerEl) timerEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                this.finish(false, failMsg);
            }
        }, 1000);
    }
}

/* ==========================================================================
   SPECIFIC GAME IMPLEMENTATIONS
   ========================================================================== */

class CodeBreakerGame extends MinigameBase {
    start() {
        const codes = ["A7X9", "B3TA", "R00T", "HACK", "N30N", "CYBER", "SHELL"];
        const target = codes[Math.floor(Math.random() * codes.length)];
        let attempts = 3;

        this.container.innerHTML = `
            <div class="game-instruction">DECRYPT CODE</div>
            <div class="game-stats">Attempts: <span id="attempts">${attempts}</span> | Time: <span id="game-timer-display">15</span>s</div>
            <div class="game-target">${target}</div>
            <input type="text" id="game-input" autocomplete="off" placeholder="INPUT CODE" maxlength="6">
            <button id="game-submit">EXECUTE</button>
        `;

        const input = document.getElementById('game-input');
        input.focus();
        this.startTimer(15);

        const check = () => {
            if (input.value.toUpperCase() === target) {
                this.finish(true, "ACCESS GRANTED");
            } else {
                attempts--;
                document.getElementById('attempts').innerText = attempts;
                input.value = "";
                input.classList.add('wrong');
                this.setTimeout(() => input.classList.remove('wrong'), 300);
                if (attempts <= 0) this.finish(false, "LOCKOUT");
            }
        };

        document.getElementById('game-submit').onclick = check;
        input.onkeypress = (e) => { if (e.key === 'Enter') check(); };
    }
}

class MathHackGame extends MinigameBase {
    start() {
        const a = Math.floor(Math.random() * 20) + 5;
        const b = Math.floor(Math.random() * 15) + 2;
        const result = a + b;
        let currentInput = "";

        this.container.innerHTML = `
            <div class="game-instruction">CALCULATE SUM</div>
            <div class="game-stats">Time: <span id="game-timer-display">12</span>s</div>
            <div class="game-target">${a} + ${b}</div>
            <div class="math-display" id="math-out">_</div>
            <div class="numpad">
                ${[1,2,3,4,5,6,7,8,9,0].map(n => `<button class="num-btn" data-val="${n}">${n}</button>`).join('')}
                <button class="num-btn action" id="btn-clr">C</button>
                <button class="num-btn action" id="btn-ok">OK</button>
            </div>
        `;

        this.startTimer(12);

        this.container.querySelectorAll('.num-btn[data-val]').forEach(btn => {
            btn.onclick = (e) => {
                if (currentInput.length < 5) {
                    currentInput += e.target.dataset.val;
                    document.getElementById('math-out').innerText = currentInput;
                }
            };
        });

        document.getElementById('btn-clr').onclick = () => {
            currentInput = "";
            document.getElementById('math-out').innerText = "_";
        };

        document.getElementById('btn-ok').onclick = () => {
            if (parseInt(currentInput) === result) this.finish(true, "VERIFIED");
            else this.finish(false, "ERROR");
        };
    }
}

class WireCutGame extends MinigameBase {
    start() {
        const colors = ['red', 'blue', 'green', 'yellow'];
        const targetColor = colors[Math.floor(Math.random() * colors.length)];
        
        this.container.innerHTML = `
            <div class="game-instruction">CUT THE <span style="color:var(--color-${targetColor === 'red' ? 'red' : 'primary'}); text-transform:uppercase;">${targetColor}</span> WIRE</div>
            <div class="game-stats">Time: <span id="game-timer-display">10</span>s</div>
            <div class="wires-container">
                ${colors.map(c => `
                    <div class="wire" data-color="${c}" 
                         style="background: ${c}; box-shadow: 0 0 10px ${c}; border: 2px solid #fff;">
                    </div>
                `).join('')}
            </div>
        `;

        this.startTimer(10, "BOOM!");

        this.container.querySelectorAll('.wire').forEach(wire => {
            wire.onclick = (e) => {
                if (e.target.dataset.color === targetColor) this.finish(true, "DEFUSED");
                else this.finish(false, "WRONG WIRE");
            };
        });
    }
}

class ReflexHitGame extends MinigameBase {
    start() {
        let attempts = 2;
        let hasFlashed = false;

        this.container.innerHTML = `
            <div class="game-instruction">TAP WHEN GREEN</div>
            <div class="game-stats">Attempts: <span id="attempts">${attempts}</span> | Time: <span id="game-timer-display">8</span>s</div>
            <div class="reflex-target" id="reflex-target">●</div>
        `;

        const target = document.getElementById('reflex-target');
        this.startTimer(8, "TOO SLOW");

        // Random delay 2-5s
        const delay = Math.random() * 3000 + 2000;
        this.setTimeout(() => {
            hasFlashed = true;
            target.classList.add('flashing'); 
            target.innerText = "HIT!";
        }, delay);

        target.onclick = () => {
            if (!hasFlashed) {
                attempts--;
                document.getElementById('attempts').innerText = attempts;
                target.classList.add('early'); 
                this.setTimeout(() => target.classList.remove('early'), 300);
                if (attempts <= 0) this.finish(false, "FAILED");
            } else {
                this.finish(true, "EXCELLENT");
            }
        };
    }
}

class SliderLockGame extends MinigameBase {
    start() {
        const targetZone = Math.random() * 60 + 20; // 20% to 80%

        this.container.innerHTML = `
            <div class="game-instruction">STOP IN ZONE</div>
            <div class="game-stats">Time: <span id="game-timer-display">8</span>s</div>
            <div class="slider-track">
                <div class="slider-zone" style="left: ${targetZone}%; width: 20%;"></div>
                <div class="slider-marker" id="marker"></div>
            </div>
            <button id="stop-btn">STOP</button>
        `;

        this.startTimer(8);

        document.getElementById('stop-btn').onclick = () => {
            const marker = document.getElementById('marker');
            const zone = document.querySelector('.slider-zone');
            
            // Visual freeze
            const mRect = marker.getBoundingClientRect();
            const zRect = zone.getBoundingClientRect();
            const tRect = document.querySelector('.slider-track').getBoundingClientRect();

            marker.style.animation = 'none';
            marker.style.left = (mRect.left - tRect.left) + 'px';

            if (mRect.left >= zRect.left && mRect.right <= zRect.right) {
                this.finish(true, "LOCKED");
            } else {
                this.finish(false, "MISSED");
            }
        };
    }
}

class MemoryMatrixGame extends MinigameBase {
    start() {
        const seqLength = 5;
        const pattern = [];
        while(pattern.length < seqLength) {
            const r = Math.floor(Math.random() * 9);
            if(!pattern.includes(r)) pattern.push(r);
        }

        this.container.innerHTML = `
            <div class="game-instruction">WATCH PATTERN</div>
            <div class="game-stats">Seq: <span id="seq-count">0</span>/${seqLength}</div>
            <div class="memory-grid">
                ${[...Array(9).keys()].map(i => `<div class="memory-cell" data-i="${i}"></div>`).join('')}
            </div>
        `;

        const cells = document.querySelectorAll('.memory-cell');
        
        // Play Pattern sequence
        let delay = 500;
        pattern.forEach((idx) => {
            this.setTimeout(() => cells[idx].classList.add('active'), delay);
            this.setTimeout(() => cells[idx].classList.remove('active'), delay + 400);
            delay += 600;
        });

        // Enable Input after pattern plays
        this.setTimeout(() => {
            if (this.isFinished) return; 
            document.querySelector('.game-instruction').innerText = "REPEAT PATTERN";
            
            // Start timer ONLY after pattern is shown
            this.startTimer(8);

            let clicks = 0;
            cells.forEach(cell => {
                cell.onclick = (e) => {
                    const idx = parseInt(e.target.dataset.i);
                    if (pattern[clicks] === idx) {
                        clicks++;
                        e.target.classList.add('success');
                        this.setTimeout(()=>e.target.classList.remove('success'), 200);
                        document.getElementById('seq-count').innerText = clicks;
                        
                        if (clicks === seqLength) this.finish(true, "MEMORY MATCH");
                    } else {
                        e.target.classList.add('fail');
                        this.finish(false, "CORRUPTED");
                    }
                };
            });
        }, delay);
    }
}

class BruteForceGame extends MinigameBase {
    start() {
        const goal = 25;
        let current = 0;

        this.container.innerHTML = `
            <div class="game-instruction">TAP FAST!</div>
            <div class="game-stats">Time: <span id="game-timer-display">7</span>s</div>
            <div class="bf-progress-bar"><div id="bf-fill"></div></div>
            <button id="bf-btn">BREACH</button>
        `;

        this.startTimer(7, "WALL INTACT");

        document.getElementById('bf-btn').onclick = () => {
            current++;
            const pct = (current / goal) * 100;
            document.getElementById('bf-fill').style.width = `${pct}%`;
            
            if (navigator.vibrate) navigator.vibrate(20);

            if (current >= goal) this.finish(true, "BREACHED");
        };
    }
}

class BinarySwitchesGame extends MinigameBase {
    start() {
        const target = Array.from({length: 5}, () => Math.round(Math.random())); // [0,1,0,1,1]
        const state = [0,0,0,0,0];

        const targetHtml = target.map(b => `<span style="color:${b?'#0f0':'#f00'}">${b}</span>`).join(' ');

        this.container.innerHTML = `
            <div class="game-instruction">MATCH BINARY</div>
            <div class="game-target" style="letter-spacing:10px;">${targetHtml}</div>
            <div class="game-stats">Time: <span id="game-timer-display">10</span>s</div>
            <div class="wires-container"> 
                ${state.map((_, i) => `
                    <button class="num-btn switch-btn" data-i="${i}" style="width:50px; height:50px;">0</button>
                `).join('')}
            </div>
            <button id="check-btn" style="margin-top:20px;">CHECK</button>
        `;

        this.startTimer(10);

        const btns = document.querySelectorAll('.switch-btn');
        btns.forEach(btn => {
            btn.onclick = () => {
                const i = btn.dataset.i;
                state[i] = state[i] ? 0 : 1;
                btn.innerText = state[i];
                btn.style.color = state[i] ? '#0f0' : 'var(--color-secondary)';
                btn.style.borderColor = state[i] ? '#0f0' : 'var(--color-secondary)';
            };
        });

        document.getElementById('check-btn').onclick = () => {
            if (JSON.stringify(state) === JSON.stringify(target)) this.finish(true, "SYNCED");
            else this.finish(false, "MISMATCH");
        };
    }
}

class SequenceOrderGame extends MinigameBase {
    start() {
        const count = 5;
        let next = 1;

        this.container.innerHTML = `
            <div class="game-instruction">ORDER 1 - ${count}</div>
            <div class="game-stats">Next: <span id="next-num">1</span> | Time: <span id="game-timer-display">8</span>s</div>
            <div class="memory-grid" style="grid-template-columns: repeat(3, 1fr);"></div>
        `;

        const grid = document.querySelector('.memory-grid');
        const nums = Array.from({length: count}, (_, i) => i + 1);
        
        const slots = Array(9).fill(null);
        let placed = 0;
        while(placed < count) {
            const r = Math.floor(Math.random() * 9);
            if(slots[r] === null) {
                slots[r] = nums[placed++];
            }
        }

        slots.forEach(val => {
            const cell = document.createElement('div');
            cell.className = 'memory-cell';
            if (val !== null) {
                cell.innerText = val;
                cell.onclick = () => {
                    if (val === next) {
                        cell.style.background = '#00ff00';
                        cell.style.visibility = 'hidden'; 
                        next++;
                        document.getElementById('next-num').innerText = next;
                        if (next > count) this.finish(true, "SORTED");
                    } else {
                        this.finish(false, "WRONG ORDER");
                    }
                };
            } else {
                cell.style.border = 'none';
                cell.style.cursor = 'default';
            }
            grid.appendChild(cell);
        });

        this.startTimer(8);
    }
}

class FrequencyMatchGame extends MinigameBase {
    start() {
        const target = Math.floor(Math.random() * 80) + 10;
        
        this.container.innerHTML = `
            <div class="game-instruction">TUNE FREQUENCY</div>
            <div class="game-target" style="font-size:1.5em; color:#0f0;">TARGET: ${target} MHz</div>
            <div class="game-stats">Current: <span id="current-freq">50</span> MHz</div>
            <div class="game-stats">Time: <span id="game-timer-display">10</span>s</div>
            <input type="range" id="freq-slider" min="0" max="100" value="50" class="freq-slider">
            <button id="lock-btn">LOCK SIGNAL</button>
        `;

        this.startTimer(10, "SIGNAL LOST");

        const slider = document.getElementById('freq-slider');
        const display = document.getElementById('current-freq');

        slider.oninput = (e) => {
            display.innerText = e.target.value;
        };

        document.getElementById('lock-btn').onclick = () => {
            const val = parseInt(slider.value);
            const diff = Math.abs(val - target);
            if (diff <= 3) this.finish(true, "LOCKED");
            else this.finish(false, "NOISY SIGNAL");
        };
    }
}

/* ==========================================================================
   GAME ENGINE (CONTEXT)
   ========================================================================== */

class GameEngine {
    constructor(socket, ui) {
        this.socket = socket;
        this.ui = ui;
        this.container = document.getElementById('game-container');
        this.activeNode = null;
        this.startTime = 0;
        this.currentGame = null;

        // Registry maps string keys from Server to Class References
        this.gameRegistry = {
            'code_breaker': CodeBreakerGame,
            'math_hack': MathHackGame,
            'wire_cut': WireCutGame,
            'reflex_hit': ReflexHitGame,
            'slider_lock': SliderLockGame,
            'memory_matrix': MemoryMatrixGame,
            'brute_force': BruteForceGame,
            'binary_switches': BinarySwitchesGame,
            'sequence_order': SequenceOrderGame,
            'frequency_match': FrequencyMatchGame
        };
    }

    /**
     * Called when 'start_minigame' socket event occurs
     */
    startGame(data) {
        // Cleanup existing game if any (edge case)
        if (this.currentGame) {
            this.currentGame.cleanup();
            this.currentGame = null;
        }

        this.activeNode = data.node;
        this.startTime = Date.now();
        this.ui.showScreen('game');
        
        const GameClass = this.gameRegistry[data.gameType] || CodeBreakerGame; 
        
        // Instantiate and start
        this.currentGame = new GameClass(
            this.container, 
            (success, msg) => this.handleEnd(success, msg)
        );
        
        try {
            this.currentGame.start();
        } catch (e) {
            console.error("Failed to start game:", e);
            this.handleEnd(false, "CLIENT ERROR");
        }
        
        if (navigator.vibrate) navigator.vibrate(200);
    }

    /**
     * Handles the visual feedback after a game finishes, then communicates to server
     */
    handleEnd(success, msg) {
        // Stop the game logic immediately
        if (this.currentGame) this.currentGame.cleanup();

        // 1. Show Feedback UI
        this.container.innerHTML = ''; 
        const feedback = document.createElement('div');
        feedback.id = 'feedback';
        feedback.innerText = msg;
        feedback.style.color = success ? "var(--color-primary)" : "var(--color-red)";
        feedback.style.marginTop = "20px";
        feedback.style.fontSize = "1.5em";
        feedback.style.fontWeight = "bold";
        
        this.container.appendChild(feedback);
        
        // 2. Wait 1 second then switch screens
        setTimeout(() => {
            const duration = (Date.now() - this.startTime) / 1000;
            
            this.socket.emit('minigame_result', {
                node: this.activeNode,
                success: success,
                duration: duration,
                shortCode: window.myPlayerId 
            });

            this.ui.showScreen('dashboard');
            this.currentGame = null;
        }, 1000);
    }
}