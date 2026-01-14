# 🌐 CYBER-WAR: RFID Capture the Flag

![Version](https://img.shields.io/badge/version-1.0.0-green)
![Python](https://img.shields.io/badge/python-3.x-blue)
![Hardware](https://img.shields.io/badge/hardware-ESP8266-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

**Cyber-War** is a pervasive, real-world team game that blends physical hardware with a digital web interface. Players acting as "Agents" use physical RFID cards to interact with hardware Nodes (ESP8266), triggering hacking minigames on their smartphones to capture points, earn abilities, and dominate the network.

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Hardware Requirements](#-hardware-requirements)
3. [Wiring Guide](#-wiring-guide-construction)
4. [Server Installation](#-server-installation-pc)
5. [Node Configuration](#-node-configuration-esp8266)
6. [How to Play](#-how-to-play)
7. [Troubleshooting](#-troubleshooting)

---

## 🔭 Project Overview

*   **The Server:** A Python Flask application running on a laptop or Raspberry Pi. It hosts the game interface, manages scores, and handles real-time communication via WebSockets.
*   **The Nodes:** ESP8266 microcontrollers connected to RFID readers and OLED screens. These act as "Capture Points" (Alpha, Beta, Gamma) and "Base Stations".
*   **The Client:** Players use their smartphones to log in. When they tap their card on a physical Node, the server pushes a minigame to their phone instantly.

---

## 🛒 Hardware Requirements

To build the full system (1 Base Station + 3 Game Nodes), you will need:

*   **4x ESP8266 Boards** (NodeMCU V3 or Wemos D1 Mini recommended)
*   **4x MFRC522 RFID Readers** (RC522)
*   **4x OLED Screens** (0.96" I2C SSD1306 128x64)
*   **RFID Cards/Tags** (13.56MHz MIFARE)
*   **Jumper Wires** (Female-to-Female and Male-to-Female)
*   **Micro USB Cables** (for power and programming)
*   **Power Banks** (optional, to make nodes portable)

Then you can put it all together into a nice model, e.g.: terminals :) 
---

## ⚡ Wiring Guide (Construction)

Connect the components to the ESP8266 (NodeMCU) as follows.
> **Note:** Pin labels (D1, D2, etc.) refer to the NodeMCU silk screen.

### 1. Connecting the OLED Display (I2C)
| OLED Pin | ESP8266 Pin | Notes |
| :---    | :---         | :--- |
| **VCC** | 3.3V (or 5V) | Power |
| **GND** | GND | Ground |
| **SCL** | D1 (GPIO 5)  | Clock Line |
| **SDA** | D2 (GPIO 4)  | Data Line |

Warning!!! remember if you have oled or the rfid working on 3.3V do not directly connect them into ESP in 5V, it will most-likly burn whole plates. Instead use the resistor or some kind of adapter. 

### 2. Connecting the RFID Reader (SPI)
| RC522 Pin | ESP8266 Pin | Notes |
| :---     | :---            | :--- |
| **3.3V** | 3.3V            |⚠️ **Do NOT use 5V** |
| **RST**  | D3 (GPIO 0)     | Reset |
| **GND**  | GND | Ground    |
| **IRQ**  | *Not Connected* | Interrupt (Unused) |
| **MISO** | D6 (GPIO 12)    | Master In Slave Out |
| **MOSI** | D7 (GPIO 13)    | Master Out Slave In |
| **SCK**  | D5 (GPIO 14)    | Serial Clock |
| **SDA (SS)** | D4 (GPIO 2) | Slave Select |

### 3. Construction Tips
1.  **Breadboard First:** Assemble everything on a breadboard to test connections before soldering.
2.  **Power:** The ESP8266 can power the OLED and RFID reader via its 3.3V pin, but ensure your USB power source is stable.
3.  **Housing:** Use small plastic boxes or 3D printed cases to protect the electronics during gameplay.

---

## 💻 Server Installation (PC)

Run the game server on a Laptop or Raspberry Pi connected to the same Wi-Fi network as the ESP8266 nodes.

### 1. Prerequisites
*   Install [Python 3.8+](https://www.python.org/downloads/).
*   Install [Git](https://git-scm.com/downloads).

### 2. Installation Steps
Open your terminal (Command Prompt or PowerShell) and run:

```bash
# 1. Clone the repository
git clone https://github.com/Maciasssss/Game-Off-Road-Hacking.git
cd Game-Off-Road-Hacking

# 2. Create a virtual environment (Recommended)
python -m venv venv

# Activate venv (Windows):
venv\Scripts\activate
# Activate venv (Mac/Linux):
source venv/bin/activate

# 3. Install dependencies
pip install flask flask-socketio eventlet

# 4. Run the server
python app.py

# 5. Find your Local IP
Windows: Open CMD, type ipconfig. Look for "IPv4 Address" (e.g., 192.168.1.15).
Mac/Linux: Open Terminal, type ifconfig or ip a.
Important: Your players and the ESP8266 nodes must connect to http://YOUR_IP_ADDRESS:5000.
```
## 📡 Node Configuration (ESP8266)
You need to upload code to the ESP8266s so they can talk to the server.
1. Setup Arduino IDE
  *  Download and install the Arduino IDE.
2. Go to File > Preferences. In "Additional Boards Manager URLs", add:
  *  http://arduino.esp8266.com/stable/package_esp8266com_index.json
3. Go to Tools > Board > Boards Manager, search for esp8266, and install it.
4. Go to Tools > Manage Libraries, search for and install:
  *  MFRC522 (by GithubCommunity)
  *  Adafruit SSD1306
  *  Adafruit GFX Library
  *  ArduinoJson
  *  SocketIoClient (by Markus Sattler)
2. Configure the Code
Open the NodeCode.ino file (located in the /arduino folder of this repo).
Edit the following lines at the top of the file:

const char* ssid     = "YOUR_WIFI_NAME";      // Your WiFi Name
const char* password = "YOUR_WIFI_PASSWORD";  // Your WiFi Password

// IP of the computer running app.py
char host[] = "192.168.1.X"; 
int port = 5000;

// Set the ID for this specific node (Change this for each board!)
// Options: "node_alpha", "node_beta", "node_gamma", "base_station"
String nodeId = "node_alpha";
---

3.Upload
  1.Connect your ESP8266 via USB.
  2.Select the correct COM port in Tools > Port.
  3.Click Upload (Arrow icon).
  4.Repeat for all 4 nodes, ensuring you change nodeId for each one.

##🎮 How to Play
1. The Goal
Two teams (RED and BLUE) compete to control nodes. The first team to reach 1000 Points wins.
2. Join the Game
Connect your phone to the same WiFi as the server.
Open your browser and go to http://YOUR_SERVER_IP:5000.
Enter your Card Code (e.g., R1, B1) printed on your physical card.
The Game Master (GM) (the first person to log in) must click START MATCH in the settings menu.
3. The Gameplay Loop
CHARGE: Your battery drains when you hack. Run to the Base Station node and scan your card to recharge.
SCAN: Run to a Node (Alpha, Beta, or Gamma). Tap your card on the RFID reader.
HACK: A minigame appears on your phone (Code breaking, wiring, math, etc.). Solve it fast!
FAST (<3s): High Points + Long Shield.
NORMAL (3-8s): Standard Points.
SLOW (>8s): Low Points.
4. Abilities (AP)
Successful hacks earn Ability Points (AP). Open the Book Menu (📖) on your phone to spend AP:
🔋 Instant Charge: Fill battery remotely.
💥 EMP: Destroy enemy shields.
❄️ Jammer: Freeze enemy screens.
5. Game Master & Saving
The GM can rename teams and adjust scoring rules via the Gear Menu (⚙️).
If the GM clicks Restart Match, the current game data is saved to the Leaderboard history, and the match resets.
If the GM disconnects, the next player to log in or refresh claims the GM role automatically.


##🔧 Troubleshooting
1. "Connection Refused" or Site won't load?
Ensure the computer and phones/nodes are on the exact same WiFi.
Check if your computer's Firewall is blocking Python. Allow access for python.exe on public/private networks.
2. Node Screen says "WiFi Connecting..." forever?
Check the SSID and Password in the Arduino code.
Ensure the WiFi signal is strong enough at the node's location.
3. Node says "Connected" but card scans don't do anything?
Check the host[] IP address in the Arduino code. It must match your computer's current IP.
Ensure the server (app.py) is actually running.
Check the wiring of the RFID reader (SDA connected to D4, not D2).
4. "Card ID Unknown"?
You need to register the card UIDs in app.py. Look for the CARD_MAPPING dictionary and add your specific card UIDs there. You can see the UID in the Serial Monitor of the Arduino IDE when you tap a card.
