/*
 * ======================================================================================
 * PROJECT:      CYBER-WAR (RFID Capture the Flag)
 * FILE:         NodeFirmware.ino
 * HARDWARE:     ESP8266 (NodeMCU/Wemos), RC522 RFID, SSD1306 OLED (I2C)
 * AUTHOR:       [Maciej/Maciasssss]
 * DESCRIPTION:  IoT Node firmware that handles RFID scanning, bidirectional 
 *               WebSocket communication, and OLED status updates.
 * ======================================================================================
 * 
 * REQUIRED LIBRARIES (Install via Arduino Library Manager):
 * 1. MFRC522        by GithubCommunity
 * 2. Adafruit GFX   by Adafruit
 * 3. Adafruit SSD1306 by Adafruit
 * 4. SocketIoClient by Markus Sattler
 * 5. WebSockets     by Markus Sattler
 * 6. ArduinoJson    by Benoit Blanchon
 */

#include <ESP8266WiFi.h>
#include <SocketIoClient.h>
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
// IP Address of the computer running app.py (Run 'ipconfig' or 'ifconfig' on PC to find it)
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
#define SCREEN_HEIGHT 64  // Standard 0.96" OLED is 128x64 (Changed from 32 for better visibility)
#define OLED_RESET    -1  // Reset pin # (or -1 if sharing Arduino reset pin)

// ======================================================================================
// [GLOBAL OBJECTS]
// ======================================================================================

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
SocketIoClient socket;
MFRC522 mfrc522(SS_PIN, RST_PIN);

// ======================================================================================
// [DISPLAY HELPER FUNCTIONS]
// ======================================================================================

/**
 * Updates the OLED screen with centered text.
 * @param title    Main text (Large font)
 * @param subtitle Secondary text (Small font)
 * @param inverted If true, displays black text on white background
 */
void updateDisplay(String title, String subtitle = "", bool inverted = false) {
  display.clearDisplay();
  
  if (inverted) display.fillScreen(SSD1306_WHITE);
  
  // Set text color
  display.setTextColor(inverted ? SSD1306_BLACK : SSD1306_WHITE);

  // --- Draw Title (Large) ---
  display.setTextSize(2);
  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds(title, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 10);
  display.println(title);

  // --- Draw Subtitle (Small) ---
  if (subtitle != "") {
    display.setTextSize(1);
    display.getTextBounds(subtitle, 0, 0, &x1, &y1, &w, &h);
    display.setCursor((SCREEN_WIDTH - w) / 2, 35); // Adjusted Y for 64px height
    display.println(subtitle);
  }

  display.display();
}

// ======================================================================================
// [SOCKET.IO EVENT HANDLERS]
// ======================================================================================

/**
 * Triggered when ESP connects to the Python Server
 */
void onConnect(const char * payload, size_t length) {
  Serial.println("[SOCKET] Connected to Server!");
  
  // 1. Register this node's identity with the server
  String regData = "{\"node_id\":\"" + NODE_ID + "\"}";
  socket.emit("register_node", regData.c_str());

  // 2. Set default screen based on role
  if (NODE_ID == "base_station") {
    updateDisplay("BASE", "Ready to Charge");
  } else {
    updateDisplay("SYSTEM", "Online & Active");
  }
}

/**
 * Triggered when Server sends a visual update command
 * Payload examples: "RED", "BLUE", "HACK", "NEUTRAL"
 */
void onScreenUpdate(const char * payload, size_t length) {
  String msg = String(payload);
  msg.replace("\"", ""); // Clean up JSON quotes
  
  Serial.print("[COMMAND] Screen Update: ");
  Serial.println(msg);

  if (msg == "RED") {
    updateDisplay("RED TEAM", "Captured", false); // Regular
  } else if (msg == "BLUE") {
    updateDisplay("BLUE TEAM", "Captured", false);
  } else if (msg == "HACK") {
    updateDisplay("HACKING", "In Progress...", true); // Inverted flash effect
  } else if (msg == "NEUTRAL") {
    updateDisplay("NEUTRAL", "Scan to Hack");
  } else if (msg == "CHARGED") {
    updateDisplay("BATTERY", "FULL POWER!");
    delay(2000); 
    updateDisplay("BASE", "Ready to Charge");
  } else if (msg == "WAIT") {
    updateDisplay("WAIT", "Game Not Started");
  }
}

// ======================================================================================
// [MAIN SETUP]
// ======================================================================================

void setup() {
  Serial.begin(115200);
  
  // 1. Initialize OLED Display
  // Address 0x3C is standard for 128x64 OLEDs
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("[ERROR] OLED Allocation Failed"));
    for(;;); // Halt execution
  }
  updateDisplay("BOOTING...", "Init Hardware");
  delay(1000);

  // 2. Initialize WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  updateDisplay("WIFI OK", WiFi.localIP().toString());
  delay(1000);

  // 3. Initialize Socket.IO
  socket.on("connect", onConnect);
  socket.on("update_screen", onScreenUpdate);
  socket.begin(SERVER_IP, SERVER_PORT);

  // 4. Initialize RFID
  SPI.begin();
  mfrc522.PCD_Init();
  
  updateDisplay("READY", "Waiting for Server...");
}

// ======================================================================================
// [MAIN LOOP]
// ======================================================================================

void loop() {
  // Keep socket connection alive
  socket.loop();

  // Look for new RFID cards
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  // Convert UID bytes to Hex String (e.g., "E2A5C9")
  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();
  
  Serial.print("[RFID] Scanned: ");
  Serial.println(cardUid);

  // Visual Feedback for User
  if (NODE_ID != "base_station") {
    updateDisplay("SCANNING...", "Transmitting Data", true);
  } else {
    updateDisplay("CHARGING...", "Standby", true);
  }

  // Send Data to Python Server
  String jsonPayload = "{\"uid\":\"" + cardUid + "\", \"node_id\":\"" + NODE_ID + "\"}";
  socket.emit("rfid_scan", jsonPayload.c_str());

  // Stop reading the card and add delay to prevent spamming
  mfrc522.PICC_HaltA();
  delay(1000); 
  
  // Revert screen to previous state logic is handled by server "update_screen" events,
  // but we can default to Base status if we are the base.
  if (NODE_ID == "base_station") {
      updateDisplay("BASE", "Ready to Charge");
  }
}
