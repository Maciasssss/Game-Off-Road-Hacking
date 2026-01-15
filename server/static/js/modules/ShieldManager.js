class ShieldManager {
    constructor(socket) {
        this.socket = socket;
        this.activeShields = new Map();
        
        // Start the countdown timer loop
        this.updateInterval = setInterval(() => this.tickTimers(), 100);

        this.setupListeners();
    }

    setupListeners() {
        // Listen for global state to update Node Colors & Shield Data
        this.socket.on('update_state', (state) => {
            if (state.nodes) {
                this.updateNodes(state.nodes);
            }
        });
    }

    updateNodes(nodesData) {
        const currentTime = Date.now() / 1000;

        Object.entries(nodesData).forEach(([nodeId, data]) => {
            // 1. Find Node Element
            const elementId = nodeId.replace('_', '-'); // node_alpha -> node-alpha
            const el = document.getElementById(elementId);
            if (!el) return;

            // 2. Update Color / Owner Class
            // Remove old classes first
            el.classList.remove('neutral', 'red', 'blue');
            el.classList.add(data.owner.toLowerCase());

            // 3. Update Status Text
            const statusEl = el.querySelector('.node-status');
            if (statusEl) {
                let txt = data.owner === 'NEUTRAL' ? 'NEUTRAL' : `${data.owner} TEAM`;
                if (data.capture_speed) txt += ` | ${data.capture_speed}`;
                statusEl.innerText = txt;
            }

            // 4. Handle Shield Logic
            const shieldRemaining = data.shield_end - currentTime;
            
            if (shieldRemaining > 0) {
                this.addShieldVisuals(el, nodeId, data.shield_end);
            } else {
                this.removeShieldVisuals(el, nodeId);
            }
        });
    }

    addShieldVisuals(el, nodeId, shieldEndTime) {
        el.classList.add('shield');
        
        // Track for the timer tick
        this.activeShields.set(nodeId, {
            endTime: shieldEndTime,
            element: el
        });

        // Ensure timer element exists
        let timer = el.querySelector('.shield-timer');
        if (!timer) {
            timer = document.createElement('div');
            timer.className = 'shield-timer';
            el.appendChild(timer);
        }
        
        // Ensure dot indicator exists
        if (!el.querySelector('.node-shield-indicator')) {
            const dot = document.createElement('div');
            dot.className = 'node-shield-indicator';
            el.appendChild(dot);
        }
    }

    removeShieldVisuals(el, nodeId) {
        el.classList.remove('shield');
        this.activeShields.delete(nodeId);
        
        const timer = el.querySelector('.shield-timer');
        if (timer) timer.remove();
        
        const dot = el.querySelector('.node-shield-indicator');
        if (dot) dot.remove();
    }

    // Updates the "45s" countdown locally for smoothness
    tickTimers() {
        const now = Date.now() / 1000;
        
        this.activeShields.forEach((data, nodeId) => {
            const remaining = Math.ceil(Math.max(0, data.endTime - now));
            const timerEl = data.element.querySelector('.shield-timer');
            
            if (remaining <= 0) {
                this.removeShieldVisuals(data.element, nodeId);
            } else if (timerEl) {
                timerEl.innerText = `🛡️ ${remaining}s`;
                if (remaining <= 5) timerEl.classList.add('shield-expiring');
                else timerEl.classList.remove('shield-expiring');
            }
        });
    }
}