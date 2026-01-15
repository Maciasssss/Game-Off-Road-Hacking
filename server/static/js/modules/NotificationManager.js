/**
 * NotificationManager
 * Handles toast notifications, system alerts, and confirmation dialogs.
 */
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.createContainer();
        }
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        document.body.appendChild(this.container);
    }

    /**
     * Core method to create and display a notification
     */
    show(type, title, message, duration = 3500) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        let icon = '📢';
        if (type === 'success') icon = '✅';
        if (type === 'warning') icon = '⚠️';
        if (type === 'error') icon = '❌';
        if (type === 'system') icon = '📟';
        if (type === 'critical') icon = '☣️';
        if (type === 'ability') icon = '⚡';

        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div class="notif-icon" style="font-size: 1.5em; line-height: 1;">${icon}</div>
                <div style="flex: 1;">
                    <div class="notif-title" style="font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">${title}</div>
                    <div class="notif-msg" style="font-size: 0.9em; opacity: 0.9; word-break: break-word;">${message}</div>
                </div>
            </div>
        `;

        this.container.appendChild(notification);

        // --- TRIGGER ANIMATION ---
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }

        // Heavy vibration for critical alerts
        if (type === 'critical' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    /**
     * Interactive Confirmation Dialog
     */
    confirm(title, message, onYes, onNo) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-confirm';

        notification.innerHTML = `
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <div style="font-size: 1.5em;">❓</div>
                <div>
                    <div style="font-weight: bold; color: #ff9900;">${title}</div>
                    <div style="font-size: 0.9em; color: #ccc;">${message}</div>
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="btn-no" style="background:transparent; border:1px solid #ff3333; color:#ff3333; padding:5px 15px; font-size:0.8em; cursor:pointer;">NO</button>
                <button id="btn-yes" style="background:rgba(0,255,0,0.2); border:1px solid #00ff00; color:#00ff00; padding:5px 15px; font-size:0.8em; cursor:pointer;">YES</button>
            </div>
        `;

        this.container.appendChild(notification);

        // Trigger animation for confirm dialog appearance
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        const btnYes = notification.querySelector('#btn-yes');
        const btnNo = notification.querySelector('#btn-no');

        btnYes.onclick = () => {
            this.dismiss(notification);
            if (onYes) onYes();
        };

        btnNo.onclick = () => {
            this.dismiss(notification);
            if (onNo) onNo();
        };
    }

    /**
     * Removes element with animation
     */
    dismiss(element) {
        // Slide out animation
        element.style.opacity = '0';
        element.style.transform = 'translateX(100px)';
        
        // Wait for CSS transition (0.3s) to finish before removing from DOM
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }

    info(title, message) { this.show('info', title, message); }
    success(title, message) { this.show('success', title, message); }
    warning(title, message) { this.show('warning', title, message, 5000); }
    error(title, message) { this.show('error', title, message, 5000); }
    system(title, message) { this.show('system', title, message); }
    ability(title, message) { this.show('ability', title, message, 2500); }
    critical(title, message) { this.show('critical', title, message, 6000); }
}