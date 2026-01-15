// Global variables
window.myPlayerId = "";

// Logger helper
window.logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`)
};

document.addEventListener("DOMContentLoaded", () => {
    // --- 1. VISUALS ---
    if (typeof MatrixEffect !== 'undefined') {
        new MatrixEffect('matrix-bg', 0.75); 
    }

    // --- 2. CORE INFRASTRUCTURE ---
    const socketClient = new SocketClient(); 
    const uiManager = new UIManager();
    window.notificationManager = new NotificationManager();

    // --- 3. MANAGERS ---
    const authManager = new AuthManager(socketClient, uiManager);
    const gmManager = new GMManager(socketClient, authManager);
    
    // Game Logic
    const gameEngine = new GameEngine(socketClient, uiManager);
    
    // HUD Elements
    window.energyBarManager = new EnergyBarManager(socketClient); 
    window.scoreboardManager = new ScoreboardManager(socketClient);
    window.shieldManager = new ShieldManager(socketClient);
    const timeManager = new GameTimeManager(socketClient);
    
    // Optional Modules
    if (typeof AbilityManager !== 'undefined') {
        new AbilityManager(socketClient);
    }
    if (typeof TutorialManager !== 'undefined') {
        new TutorialManager();
    }
    if (typeof VisualFXManager !== 'undefined') {
        window.vfxManager = new VisualFXManager(socketClient);
    }

    // --- 4. GLOBAL SOCKET EVENTS ---
    
    socketClient.on('connect', () => {
        logger.info("Connected to server");
        const savedPlayerId = localStorage.getItem('playerCode');
        if (savedPlayerId && !window.myPlayerId) {
            socketClient.emit('player_login', { shortCode: savedPlayerId });
        }
    });

    socketClient.on('login_success', (data) => {
        window.myPlayerId = data.shortCode;
        localStorage.setItem('playerCode', data.shortCode);
        uiManager.updateDashboard(data); 
    });

    socketClient.on('start_minigame', (data) => {
        gameEngine.startGame(data);
    });

    socketClient.on('force_logout', () => {
        localStorage.removeItem('playerCode');
        window.location.reload();
    });

    socketClient.on('error_msg', (data) => {
        if (window.notificationManager) {
            window.notificationManager.error('SYSTEM ERROR', data.msg);
        }
    });
});