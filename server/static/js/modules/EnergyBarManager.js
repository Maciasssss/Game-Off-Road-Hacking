class EnergyBarManager {
    constructor(socket) {
        this.socket = socket;
        this.MAX_ENERGY = 100;
        this.currentEnergy = 100;
        
        this.bar = document.getElementById('battery-fill');
        this.text = document.getElementById('battery-percent');

        this.setupListeners();
    }

    setupListeners() {
        // Listen for the capture result
        this.socket.on('energy_charged', (data) => {
            this.animateFill(data);
        });

        this.socket.on('energy_update', (data) => {
            if (data.charged) this.setFull();
            else this.setEmpty();
        });
    }

    setFull() {
        this.currentEnergy = 100;
        this.updateDOM(100, '');
        if(this.bar) this.bar.className = 'battery-fill'; 
    }

    setEmpty() {
        this.currentEnergy = 0;
        this.updateDOM(0, 'critical');
    }

    animateFill(data) {
        if (!this.bar) return;

        const { energy_gain, speed_category, charged } = data;

        if (!charged || speed_category === 'FAILED') {
            this.bar.classList.add('failed');
            setTimeout(() => this.bar.classList.remove('failed'), 500);
            return;
        }

        this.currentEnergy = Math.min(this.currentEnergy + energy_gain, 100);
        
        // Add specific class for animation (fast/normal/slow) defined in CSS
        this.bar.className = `battery-fill ${speed_category.toLowerCase()}`;
        this.text.innerText = `${Math.round(this.currentEnergy)}%`;
        this.bar.style.width = `${this.currentEnergy}%`;

        // Reset class after animation (approx 2s)
        setTimeout(() => {
            this.bar.className = 'battery-fill'; 
            if (this.currentEnergy <= 20) this.bar.classList.add('critical');
            else if (this.currentEnergy <= 50) this.bar.classList.add('low');
        }, 2000);
    }

    updateDOM(percent, extraClass) {
        if (this.bar) {
            this.bar.style.width = `${percent}%`;
            this.bar.className = `battery-fill ${extraClass}`;
        }
        if (this.text) this.text.innerText = `${percent}%`;
    }
}