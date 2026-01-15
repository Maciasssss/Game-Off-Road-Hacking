class SocketClient {
    constructor() {
        this.socket = io();
        this.callbacks = {}; 
    }

    // Rejestracja nasłuchu
    on(event, callback) {
        this.socket.on(event, callback);
    }

    // Wysyłanie
    emit(event, data) {
        this.socket.emit(event, data);
    }
}