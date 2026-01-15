class MatrixEffect {
    constructor(canvasId, speed = 1) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.drops = [];
        this.speeds = []; 
        
        this.fontSize = 16;
        this.speed = speed; 
        this.chars = "01ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&*"; 
        
        this.glitchChars = "ヲァウェオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユラリルレロワン"; 
        this.glitchIntensity = 0.1;
        this.pulseIntensity = 0.3; 
        
        this.resize();
        this.init();
        
        window.addEventListener('resize', () => this.resize());
        
        this.animate();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        const columns = Math.floor(this.width / this.fontSize);
        
        this.drops = [];
        this.speeds = [];
        for (let i = 0; i < columns; i++) {
            this.drops[i] = Math.random() * -100; 
            this.speeds[i] = (0.3 + Math.random() * 1.2) * this.speed;
        }
    }

    init() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    animate() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#0F0'; 
        this.ctx.font = this.fontSize + 'px monospace';

        for (let i = 0; i < this.drops.length; i++) {
            let text = this.chars.charAt(Math.floor(Math.random() * this.chars.length));
            
            if (Math.random() < this.glitchIntensity) {
                text = this.glitchChars.charAt(Math.floor(Math.random() * this.glitchChars.length));
                this.ctx.fillStyle = '#F0F'; 
            } else {
                const pulse = Math.sin(Date.now() * 0.005 + i * 0.1) * this.pulseIntensity;
                const alpha = Math.max(0.5, 1 + pulse);
                this.ctx.globalAlpha = alpha;
                this.ctx.fillStyle = '#0F0'; 
            }
            
            this.ctx.fillText(text, i * this.fontSize, this.drops[i] * this.fontSize);
            this.ctx.globalAlpha = 1; 

            if (this.drops[i] * this.fontSize > this.height && Math.random() > 0.975) {
                this.drops[i] = 0;
                this.speeds[i] = (0.3 + Math.random() * 1.2) * this.speed;
            }

            this.drops[i] += this.speeds[i];
        }

        requestAnimationFrame(() => this.animate());
    }
}