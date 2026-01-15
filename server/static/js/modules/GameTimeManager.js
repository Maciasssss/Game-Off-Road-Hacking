class GameTimeManager {
    constructor(socket) {
        this.socket = socket;
        this.timerEl = document.getElementById('game-timer');
        this.startTime = null;
        this.isActive = false;
        
        this.interval = setInterval(() => this.tick(), 1000);

        this.setupListeners();
    }

    setupListeners() {
        this.socket.on('update_state', (state) => {
            // Sync state
            const wasActive = this.isActive;
            this.isActive = state.game_active;

            // If game just started or we reconnected, sync the start time
            if (state.game_active) {
                // Calculate when the game theoretically started based on server duration
                // start_time = Now - Elapsed_Seconds
                const derivedStartTime = Date.now() - (state.game_duration * 1000);
                
                // Only update local reference if it's significantly off (drift correction)
                // or if we didn't have one.
                if (!this.startTime || Math.abs(this.startTime - derivedStartTime) > 2000) {
                    this.startTime = derivedStartTime;
                }
            } else {
                this.startTime = null;
                this.updateDisplay(0); // Reset to 00:00 when stopped
            }
        });

        this.socket.on('game_restarted', () => {
            this.isActive = false;
            this.startTime = null;
            this.updateDisplay(0);
        });
    }

    tick() {
        if (!this.isActive || !this.startTime || !this.timerEl) return;

        const now = Date.now();
        const elapsedMS = now - this.startTime;
        this.updateDisplay(elapsedMS);
    }

    updateDisplay(elapsedMS) {
        if (!this.timerEl) return;

        const totalSeconds = Math.floor(elapsedMS / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);

        // Format: MM:SS
        const text = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.timerEl.textContent = text;
    }
}