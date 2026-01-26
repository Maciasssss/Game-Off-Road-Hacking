/*
 * ======================================================================================
 * PROJECT:      CYBER-WAR (RFID Capture the Flag)
 * FILE:         NodeCode.ino (Low-Level WebSocket Implementation)
 * HARDWARE:     ESP8266 (NodeMCU/Wemos), RC522 RFID, SSD1306 OLED (I2C)
 * AUTHOR:       [Macieasssss]
 * DESCRIPTION:  IoT Node firmware that handles RFID scanning and bidirectional 
 *               communication with a modern Flask-SocketIO server (Engine.IO v4).
 * 
 * ======================================================================================
 * 
 * REQUIRED LIBRARIES (Install via Arduino Library Manager):
 * 1. MFRC522        by GithubCommunity
 * 2. Adafruit GFX   by Adafruit
 * 3. Adafruit SSD1306 by Adafruit
 * 4. WebSockets     by Markus Sattler (Version 2.4.1 or newer)
 * ======================================================================================
 */

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h> // Core WebSocket library
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ======================================================================================
// [USER CONFIGURATION] - EDIT THIS SECTION
// ======================================================================================

// 1. WiFi Credentials
const char* WIFI_SSID = "YOUR_WIFI_NAME";      // <--- CHANGE THIS
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";  // <--- CHANGE THIS

// 2. Game Server Configuration
// IP Address of the computer running app.py (Run 'ipconfig' on Windows to find it)
const char* SERVER_IP = "192.168.1.X";         // <--- CHANGE THIS
const int   SERVER_PORT = 5000;

// 3. Node Identity
// Unique ID for this specific hardware box.
// OPTIONS: "node_alpha", "node_beta", "node_gamma", "base_station"
const String NODE_ID = "node_alpha";           // <--- CHANGE THIS FOR EACH BOARD

// ======================================================================================
// [HARDWARE WIRING]
// ======================================================================================

// RFID RC522 Pins (SPI)
#define RST_PIN  D3  // GPIO 0
#define SS_PIN   D4  // GPIO 2

// OLED Display Pins (I2C)
// SCL -> D1 (GPIO 5)
// SDA -> D2 (GPIO 4)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64  
#define OLED_RESET    -1  

// ======================================================================================
// [GLOBAL OBJECTS]
// ======================================================================================

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WebSocketsClient webSocket;
MFRC522 mfrc522(SS_PIN, RST_PIN);

bool isConnected = false;

// ======================================================================================
// [DISPLAY HELPER FUNCTIONS]
// ======================================================================================

void updateDisplay(String title, String subtitle = "", bool inverted = false) {
  display.clearDisplay();
  
  if (inverted) display.fillScreen(SSD1306_WHITE);
  
  display.setTextColor(inverted ? SSD1306_BLACK : SSD1306_WHITE);

  // Title
  display.setTextSize(2);
  display.setCursor(0, 10); // Left aligned for simplicity
  display.println(title);

  // Subtitle
  if (subtitle != "") {
    display.setTextSize(1);
    display.setCursor(0, 35);
    display.println(subtitle);
  }

  display.display();
}

// ======================================================================================
// [SOCKET.IO MANUAL PROTOCOL HANDLING]
// ======================================================================================

/**
 * Sends a Socket.IO Event (Type 42)
 * Format: 42["event_name", {json_data}]
 */
void sendSocketIOEvent(String eventName, String jsonPayload) {
  String msg = "42[\"" + eventName + "\"," + jsonPayload + "]";
  webSocket.sendTXT(msg);
}

/**
 * Main WebSocket Event Handler
 * Parses raw text messages from the server to handle Socket.IO handshakes and events.
 */
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  String text = (char*)payload;

  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected!");
      isConnected = false;
      updateDisplay("ERROR", "No Server Conn");
      break;

    case WStype_CONNECTED:
      Serial.println("[WS] Connected to Server! Waiting for handshake...");
      break;

    case WStype_TEXT:
      // --- PACKET TYPE ANALYSIS ---
      
      // Type "0": Open/Handshake -> We must reply with "40" to connect to namespace
      if (text.startsWith("0")) {
        Serial.println("[WS] Handshake received. Sending Connect packet...");
        webSocket.sendTXT("40"); 
      }
      
      // Type "40": Connected to Namespace -> We are officially logged in
      else if (text.startsWith("40")) {
        Serial.println("[WS] Logged in! Registering Node...");
        isConnected = true;
        
        // Register node identity
        String json = "{\"node_id\":\"" + NODE_ID + "\"}";
        sendSocketIOEvent("register_node", json);

        if (NODE_ID == "base_station") updateDisplay("BASE", "Ready");
        else updateDisplay("SYSTEM", "Online");
      }
      
      // Type "42": Event Message -> ["event_name", data]
      else if (text.startsWith("42")) {
        Serial.println("[WS] Event: " + text);
        
        // Simple string parsing to avoid JSON overhead for simple commands
        if (text.indexOf("update_screen") > 0) {
            String msg = "";
            if (text.indexOf("RED") > 0) msg = "RED";
            else if (text.indexOf("BLUE") > 0) msg = "BLUE";
            else if (text.indexOf("HACK") > 0) msg = "HACK";
            else if (text.indexOf("NEUTRAL") > 0) msg = "NEUTRAL";
            else if (text.indexOf("CHARGED") > 0) msg = "CHARGED";
            else if (text.indexOf("WAIT") > 0) msg = "WAIT";

            if (msg == "RED") updateDisplay("RED TEAM", "Captured");
            else if (msg == "BLUE") updateDisplay("BLUE TEAM", "Captured");
            else if (msg == "HACK") updateDisplay("HACKING", "In Progress...", true);
            else if (msg == "NEUTRAL") updateDisplay("FREE", "Scan to Hack");
            else if (msg == "CHARGED") updateDisplay("ENERGY", "Full Power!");
            else if (msg == "WAIT") updateDisplay("WAIT", "Game Paused");
        }
      }
      
      // Type "2": Ping -> We must reply with "3" (Pong) to keep connection alive
      else if (text.startsWith("2")) {
        webSocket.sendTXT("3");
      }
      break;
  }
}

// ======================================================================================
// [MAIN SETUP]
// ======================================================================================

void setup() {
  Serial.begin(115200);
  
  // 1. Initialize OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("[ERROR] OLED Init Failed"));
    for(;;);
  }
  updateDisplay("BOOT...", "Init Hardware");

  // 2. Initialize WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  updateDisplay("WIFI OK", WiFi.localIP().toString());
  delay(1000);

  // 3. Initialize WebSocket (Manual Engine.IO v4 URL)
  // The query parameters "EIO=4" and "transport=websocket" are crucial for Flask-SocketIO 5.x
  webSocket.begin(SERVER_IP, SERVER_PORT, "/socket.io/?EIO=4&transport=websocket");
  webSocket.onEvent(webSocketEvent);
  
  // Keep-alive settings
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(15000, 3000, 2);

  // 4. Initialize RFID
  SPI.begin();
  mfrc522.PCD_Init();
}

// ======================================================================================
// [MAIN LOOP]
// ======================================================================================

void loop() {
  webSocket.loop();

  // Only scan if connected to server
  if (!isConnected) return;

  // RFID Scan Check
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  // Convert UID to Hex String
  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();
  
  Serial.println("[RFID] Tag: " + cardUid);
  
  // Instant visual feedback before server reply
  if (NODE_ID == "base_station") updateDisplay("CHARGING", "...", true);
  else updateDisplay("SCANNING", "Sending Data", true);

  // Send Data to Server
  String json = "{\"uid\":\"" + cardUid + "\",\"node_id\":\"" + NODE_ID + "\"}";
  sendSocketIOEvent("rfid_scan", json);

  // Halt card to prevent multi-read
  mfrc522.PICC_HaltA();
  delay(1000);
  
  // Revert to default screen (unless server overrides)
  if (NODE_ID == "base_station") updateDisplay("BASE", "Ready");
  else updateDisplay("SYSTEM", "Active");
}
