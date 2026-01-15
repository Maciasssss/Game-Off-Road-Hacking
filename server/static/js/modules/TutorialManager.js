class TutorialManager {
    constructor() {
        this.container = document.querySelector('.login-container');
        // Only run if on the login screen
        if (!this.container) return;

        this.injectButton();
        this.injectModal();
        this.bindEvents();
    }

    injectButton() {
        if (document.getElementById('btn-show-tutorial')) return;

        const btn = document.createElement('button');
        btn.id = 'btn-show-tutorial';
        btn.className = 'tutorial-trigger-btn';
        btn.innerHTML = '❓ AGENT MANUAL / HELP';
        
        // Append button to login container
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn && loginBtn.parentNode) {
            loginBtn.parentNode.appendChild(btn);
        } else {
            this.container.appendChild(btn);
        }
    }

    injectModal() {
        if (document.getElementById('screen-tutorial')) return;

        const modal = document.createElement('div');
        modal.id = 'screen-tutorial';
        modal.innerHTML = `
            <div class="tutorial-box">
                <div class="tutorial-header">
                    <h2>OPERATIONAL GUIDE</h2>
                    <button id="btn-close-tutorial" class="close-tut-btn">✕</button>
                </div>
                
                <div class="tut-tabs">
                    <button class="tut-tab-btn active" data-tab="basics">MISSION</button>
                    <button class="tut-tab-btn" data-tab="gm">MENU & GM</button>
                    <button class="tut-tab-btn" data-tab="faq">FAQ</button>
                </div>

                <div class="tut-content-area">
                    <!-- TAB 1: BASICS -->
                    <div id="tab-basics" class="tut-section active">
                        <div class="tut-block">
                            <div class="tut-title"><span class="icon-badge">🎯</span> THE OBJECTIVE</div>
                            <p>You are an Agent for <span style="color:#ff3333">RED</span> or <span style="color:#3366ff">BLUE</span> team.</p>
                            <p>Your goal is to Hack Nodes (Alpha, Beta, Gamma). The game ends when a team reaches the <strong>Score Limit</strong> (Default: 1000 pts).</p>
                        </div>

                        <div class="tut-block">
                            <div class="tut-title"><span class="icon-badge">⚡</span> THE LOOP</div>
                            <ol style="margin-left: 20px; line-height: 1.8;">
                                <li><strong>CHARGE:</strong> Scan your card at the Base Station.</li>
                                <li><strong>RUN:</strong> Go to a Node (A, B, or C).</li>
                                <li><strong>SCAN:</strong> Tap your card on the reader.</li>
                                <li><strong>HACK:</strong> Solve the minigame on your phone!</li>
                            </ol>
                        </div>

                        <div class="tut-block">
                            <div class="tut-title"><span class="icon-badge">💎</span> BONUS POINTS</div>
                            <p>Not all hacks are equal! You get extra points based on your speed:</p>
                            <ul style="margin-left: 20px;">
                                <li><span style="color:#00ff00; font-weight:bold;">FAST (&lt;3s):</span> Maximum Points + Longest Shield time.</li>
                                <li><span style="color:#ffff00; font-weight:bold;">NORMAL (3-8s):</span> Standard Points.</li>
                                <li><span style="color:#ff3333; font-weight:bold;">SLOW (&gt;8s):</span> Low Points + No Shield.</li>
                            </ul>
                        </div>
                    </div>

                    <!-- TAB 2: GM & SETTINGS -->
                    <div id="tab-gm" class="tut-section">
                        <div class="tut-block">
                            <div class="tut-title"><span class="icon-badge">⚙️</span> THE MENU</div>
                            <p><strong>Every player</strong> can open the Game Menu (the gear icon) to:</p>
                            <ul style="margin-left: 20px;">
                                <li>Change their <strong>Codename</strong>.</li>
                                <li>View the <strong>Leaderboard</strong>.</li>
                                <li>Disconnect safely.</li>
                            </ul>
                        </div>

                        <div class="tut-block">
                            <div class="tut-title"><span class="icon-badge">👑</span> GAME MASTER (GM)</div>
                            <p>The GM is usually the first person who logged in. They have special privileges:</p>
                            <ul style="margin-left: 20px;">
                                <li><strong>Start/End Game:</strong> Controls the match state.</li>
                                <li><strong>Configure Rules:</strong> Change max score or AP costs.</li>
                                <li><strong>Team Names:</strong> Rename Red/Blue teams.</li>
                            </ul>
                            <div class="qa-item" style="border-left-color: #00ff00;">
                                <div class="question">How do I become GM?</div>
                                <div class="answer">If the current GM leaves or disconnects, the "throne" becomes empty. The next person to <strong>Login or Refresh</strong> will claim the GM role automatically.</div>
                            </div>
                        </div>

                        <div class="tut-block">
                            <div class="tut-title"><span class="icon-badge">💾</span> SAVING & RESTARTING</div>
                            <p>When the match ends (score limit reached), results are saved automatically.</p>
                            <p>If the GM clicks <strong>"RESTART GAME"</strong>, the current match data is <strong>SAVED</strong> to the Leaderboard history immediately, and then the scores are reset to 0 for the next round.</p>
                        </div>
                    </div>

                    <!-- TAB 3: FAQ -->
                    <div id="tab-faq" class="tut-section">
                        <div class="qa-item">
                            <div class="question">Q: I got disconnected! Did I lose my points?</div>
                            <div class="answer">A: <strong>No.</strong> Your score belongs to your team. Your Ability Points (AP) are saved on the server. Just re-enter your Card Code to rejoin exactly where you left off.</div>
                        </div>

                        <div class="qa-item">
                            <div class="question">Q: How do I get Abilities?</div>
                            <div class="answer">A: Every successful hack gives you AP. Click the <strong>Book Icon (📖)</strong> on the dashboard to spend AP on powers like Instant Charge or EMP.</div>
                        </div>

                        <div class="qa-item">
                            <div class="question">Q: My screen says "BATTERY EMPTY"?</div>
                            <div class="answer">A: You cannot hack without power. Run to the Base Station to recharge, or use the "Instant Charge" ability if you have enough AP saved up.</div>
                        </div>

                        <div class="qa-item">
                            <div class="question">Q: Can I switch teams?</div>
                            <div class="answer">A: Your team (Red/Blue) is tied to your physical Card ID. To switch teams, you need to swap cards with someone physically.</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    bindEvents() {
        const openBtn = document.getElementById('btn-show-tutorial');
        const closeBtn = document.getElementById('btn-close-tutorial');
        const modal = document.getElementById('screen-tutorial');
        
        openBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            modal.classList.add('active');
        });

        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.remove('active');
        });

        // Tab Switching Logic
        const tabs = modal.querySelectorAll('.tut-tab-btn');
        const sections = modal.querySelectorAll('.tut-section');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));

                // Activate clicked
                tab.classList.add('active');
                const targetId = `tab-${tab.dataset.tab}`;
                const targetSection = document.getElementById(targetId);
                if(targetSection) targetSection.classList.add('active');
            });
        });
    }
}