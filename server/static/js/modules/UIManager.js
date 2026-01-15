class UIManager {
    constructor() {
        this.screens = {
            login: document.getElementById('screen-login'),
            dashboard: document.getElementById('screen-dashboard'),
            game: document.getElementById('screen-game')
        };
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(el => el.classList.remove('active'));
        if (this.screens[screenName]) this.screens[screenName].classList.add('active');
    }

    updateDashboard(data) {
        if(data.shortCode) {
            document.getElementById('display-player-id').innerText = `AGENT: ${data.shortCode}`;
        }
        if(data.team) {
            document.body.className = data.team.toLowerCase();
        }
    }
}