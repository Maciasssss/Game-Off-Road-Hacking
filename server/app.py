import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import logging
import time
import random
import json
from datetime import datetime

# Initialize Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = 'cyber_war_secret_key'

socketio = SocketIO(
    app, 
    cors_allowed_origins='*', 
    async_mode='eventlet', 
    logger=False, 
    engineio_logger=False
)

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("GameEngine")

NODE_SOCKETS = {} 

# --- CONFIGURATION DEFAULTS ---
DEFAULT_CONFIG = {
    "max_score": 1000,
    "max_ap": 400,
    "battery_drain_enabled": True, 
    "ability_cost_multiplier": 1.0, 
    "shield_duration_fast": 45,
    "shield_duration_normal": 15,
    "hack_bonus_fast": 10,
    "hack_bonus_normal": 5,
    "excluded_abilities": [] 
}

GAME_CONFIG = DEFAULT_CONFIG.copy()

ABILITY_COSTS_BASE = {
    'instant_charge': 150,
    'shield_break': 200,
    'global_shield': 250,
    'boost': 300,
    'freeze': 400
}

NODES = {
    "node_alpha": {"owner": "NEUTRAL", "points": 0, "shield_end": 0, "capture_speed": None},
    "node_beta":  {"owner": "NEUTRAL", "points": 0, "shield_end": 0, "capture_speed": None},
    "node_gamma": {"owner": "NEUTRAL", "points": 0, "shield_end": 0, "capture_speed": None}
}

SCORES = {"RED": 0, "BLUE": 0}
BONUS_SCORES = {"RED": 0, "BLUE": 0}

BASE_POINTS_PER_SECOND_FAST = 1.5
BASE_POINTS_PER_SECOND_NORMAL = 1.0
BASE_POINTS_PER_SECOND_SLOW = 0.5

DIFFICULTY_START_TIME = 300
DIFFICULTY_REDUCTION_RATE = 0.1
MIN_DIFFICULTY_MULTIPLIER = 0.3
CATCHUP_THRESHOLD = 150  

COMPLETION_REWARD_BASE = 50
COMPLETION_REWARD_MULTIPLIER = 0.1

CARD_MAPPING = {
    "77286D06": "R1", "55AE6C06": "R2", "16CA3253": "B1", "A6636D06": "B2"
}

PLAYERS = {}
RANKING = []

GAME_STATE = {
    "active": False,
    "start_time": time.time(),
    "game_master": None,
    "red_team_name": "RED TEAM",
    "blue_team_name": "BLUE TEAM",
    "last_score_update": time.time(),
    "results_saved": False,
    "modifiers": {
        "RED": {"score_boost_end": 0, "frozen_end": 0}, 
        "BLUE": {"score_boost_end": 0, "frozen_end": 0}
    }
}

# --- HELPERS ---

def get_difficulty_multiplier():
    if not GAME_STATE["active"]: return 1.0
    game_duration = time.time() - GAME_STATE["start_time"]
    if game_duration < DIFFICULTY_START_TIME: return 1.0
    
    minutes_over_start = (game_duration - DIFFICULTY_START_TIME) / 60.0
    reduction = minutes_over_start * DIFFICULTY_REDUCTION_RATE
    return max(MIN_DIFFICULTY_MULTIPLIER, 1.0 - reduction)

def broadcast_game_state():
    current_time = time.time()
    base_difficulty = get_difficulty_multiplier() if GAME_STATE["active"] else 1.0
    
    nodes_data = {}
    for node_id, node_data in NODES.items():
        shield_remaining = 0
        if node_data['shield_end'] > current_time:
            shield_remaining = round(node_data['shield_end'] - current_time, 1)
            
        nodes_data[node_id] = {
            "owner": node_data['owner'],
            "shield_end": node_data['shield_end'],
            "shield_remaining": shield_remaining,
            "capture_speed": node_data.get('capture_speed')
        }

    players_data = {
        code: {
            "name": p['name'], 
            "team": p['team'], 
            "charged": p['charged'],
            "ability_points": p.get('ability_points', 0), 
            "is_gm": p.get('is_gm', False),
            "is_team_lead": p.get('is_team_lead', False)
        } for code, p in PLAYERS.items()
    }

    state = {
        "nodes": nodes_data, 
        "scores": SCORES, 
        "bonus_scores": BONUS_SCORES,
        "players": players_data,
        "game_active": GAME_STATE["active"], 
        "game_master": GAME_STATE["game_master"],
        "red_team_name": GAME_STATE["red_team_name"], 
        "blue_team_name": GAME_STATE["blue_team_name"],
        "max_score": GAME_CONFIG["max_score"], 
        "max_ap": GAME_CONFIG["max_ap"],
        "game_duration": current_time - GAME_STATE["start_time"] if GAME_STATE["active"] else 0,
        "difficulty_multiplier": round(base_difficulty, 2), 
        "modifiers": GAME_STATE["modifiers"],
        "config": GAME_CONFIG
    }
    
    socketio.emit('update_state', state, room='web_clients')

def save_current_ranking(winner_team, reason):
    if GAME_STATE["results_saved"]:
        return {"RED": 0, "BLUE": 0} 

    end_time = datetime.now()
    duration = time.time() - GAME_STATE["start_time"]
    
    final_red = SCORES["RED"] + BONUS_SCORES["RED"]
    final_blue = SCORES["BLUE"] + BONUS_SCORES["BLUE"]
    
    red_reward = COMPLETION_REWARD_BASE + (final_red * COMPLETION_REWARD_MULTIPLIER)
    blue_reward = COMPLETION_REWARD_BASE + (final_blue * COMPLETION_REWARD_MULTIPLIER)
    
    if winner_team == "RED": red_reward += COMPLETION_REWARD_BASE * 2
    elif winner_team == "BLUE": blue_reward += COMPLETION_REWARD_BASE * 2
    
    for code, player in PLAYERS.items():
        team_reward = red_reward if player['team'] == 'RED' else blue_reward
        team_final_score = final_red if player['team'] == 'RED' else final_blue
        
        ranking_entry = {
            "player_code": code, 
            "player_name": player['name'], 
            "team": player['team'],
            "score": team_final_score, 
            "reward": round(team_reward, 1),
            "winner": winner_team, 
            "timestamp": end_time.isoformat(), 
            "duration": duration, 
            "reason": reason
        }
        RANKING.append(ranking_entry)
    
    GAME_STATE["results_saved"] = True
    return {"RED": round(red_reward, 1), "BLUE": round(blue_reward, 1)}

def continuous_scoring():
    print("--- SCORING ENGINE STARTED ---")
    while True:
        socketio.sleep(1.0)
        
        if not GAME_STATE["active"]: 
            broadcast_game_state()
            continue
            
        current_time = time.time()
        base_difficulty = get_difficulty_multiplier()
        
        total_red = SCORES["RED"] + BONUS_SCORES["RED"]
        total_blue = SCORES["BLUE"] + BONUS_SCORES["BLUE"]
        
        for team in ["RED", "BLUE"]:
            if GAME_STATE["modifiers"][team]["frozen_end"] > current_time: 
                continue 
            
            multiplier = base_difficulty
            if GAME_STATE["modifiers"][team]["score_boost_end"] > current_time:
                multiplier *= 2.0
            
            my_score = total_red if team == "RED" else total_blue
            enemy_score = total_blue if team == "RED" else total_red
            
            if (enemy_score - my_score) > CATCHUP_THRESHOLD:
                multiplier *= 1.5 
            
            points_this_second = 0
            for node in NODES.values():
                if node['owner'] == team:
                    capture_speed = node.get('capture_speed')
                    if capture_speed:
                        base = 0
                        if capture_speed == 'FAST': base = BASE_POINTS_PER_SECOND_FAST
                        elif capture_speed == 'NORMAL': base = BASE_POINTS_PER_SECOND_NORMAL
                        elif capture_speed == 'SLOW': base = BASE_POINTS_PER_SECOND_SLOW
                        
                        points_this_second += base * multiplier
            
            if points_this_second > 0: 
                SCORES[team] = round(SCORES[team] + points_this_second, 1)

        if SCORES["RED"] >= GAME_CONFIG["max_score"] or SCORES["BLUE"] >= GAME_CONFIG["max_score"]:
            winner = "RED" if SCORES["RED"] >= GAME_CONFIG["max_score"] else "BLUE"
            GAME_STATE["active"] = False
            rewards = save_current_ranking(winner, "score_limit_reached")
            
            socketio.emit('game_ended', {
                'winner': winner, 
                'final_scores': SCORES, 
                'bonus_scores': BONUS_SCORES, 
                'rewards': rewards, 
                'ranking': RANKING, 
                'reason': 'score_limit_reached'
            }, room='web_clients')
        
        broadcast_game_state()

# --- ROUTES ---

@app.route('/')
def index(): 
    return render_template('index.html')

# --- SOCKET EVENTS ---

@socketio.on('disconnect')
def handle_disconnect():
    """
    Handle client disconnection.
    Marks the player as offline but keeps their data/score.
    """
    sid = request.sid
    disconnected_player_code = None

    for code, p in PLAYERS.items():
        if p.get('socket_id') == sid:
            p['socket_id'] = None 
            disconnected_player_code = code
            print(f"--- PLAYER {code} DISCONNECTED ---")
            break
    
    if disconnected_player_code:
        broadcast_game_state()

@socketio.on('player_login')
def handle_login(data):
    join_room('web_clients')
    code = data.get('shortCode', '').upper()
    
    if not code: return 

    # 1. Check for Duplicate Active Login
    if code in PLAYERS:
        existing_player = PLAYERS[code]
        if existing_player.get('socket_id') is not None:
            emit('error_msg', {'msg': f'IDENTITY {code} IS ACTIVE!'}, room=request.sid)
            return
        else:
            # Reconnection logic
            existing_player['socket_id'] = request.sid
            
            # --- HOSTILE TAKEOVER CHECK (For Reconnecting Players) ---
            # If I'm reconnecting, and the current GM is offline (or None), maybe I should become GM?
            # Current rule: If GM is None, I take it.
            if GAME_STATE["game_master"] is None:
                GAME_STATE["game_master"] = code
                existing_player['is_gm'] = True
            
            emit('login_success', {
                'shortCode': code, 
                'team': existing_player['team'], 
                'is_gm': existing_player['is_gm'], 
                'is_team_lead': existing_player['is_team_lead'],
                'playerName': existing_player['name'], 
                'charged': existing_player.get('charged', True),
                'has_custom_name': True,
                'red_name': GAME_STATE['red_team_name'],
                'blue_name': GAME_STATE['blue_team_name']
            })
            broadcast_game_state()
            return

    # 2. New Player Registration
    team = "RED" if code.startswith("R") else "BLUE"
    if not code.startswith("R") and not code.startswith("B"): team = "SPECTATOR"

    # --- GM ASSIGNMENT LOGIC  ---
    is_gm = False
    
    # Check if a GM exists
    current_gm_code = GAME_STATE["game_master"]
    
    # Scenario A: No GM defined
    if current_gm_code is None:
        is_gm = True
        GAME_STATE["game_master"] = code
        print(f"--- NEW GM ASSIGNED: {code} (Slot was empty) ---")
        
    # Scenario B: GM is defined, but that player is OFFLINE (disconnected/crashed)
    elif current_gm_code in PLAYERS and PLAYERS[current_gm_code]['socket_id'] is None:
        # Check if any OTHER active players exist. 
        # If I am the only one logging in now, I take over.
        active_others = [p for c, p in PLAYERS.items() if p['socket_id'] is not None]
        
        if not active_others:
            print(f"--- GM TAKEOVER: {code} taking over from offline {current_gm_code} ---")
            is_gm = True
            GAME_STATE["game_master"] = code
            PLAYERS[current_gm_code]['is_gm'] = False 

    # Determine Team Lead
    is_team_lead = False
    if team in ["RED", "BLUE"]:
        existing = any(p['team'] == team for p in PLAYERS.values())
        if not existing: is_team_lead = True

    PLAYERS[code] = {
        "socket_id": request.sid, 
        "team": team, 
        "charged": True,
        "name": f"Agent {code}", 
        "is_gm": is_gm, 
        "is_team_lead": is_team_lead, 
        "ability_points": 0
    }
    
    emit('login_success', {
        'shortCode': code, 
        'team': team, 
        'is_gm': is_gm, 
        'is_team_lead': is_team_lead,
        'playerName': f"Agent {code}", 
        'charged': True,
        'has_custom_name': False,
        'red_name': GAME_STATE['red_team_name'],
        'blue_name': GAME_STATE['blue_team_name']
    })
    broadcast_game_state()
    
@socketio.on('release_identity')
def handle_release_identity(data):
    """
    Explicit logout: Wipes the player from memory.
    """
    code = data.get('shortCode')
    if not code: return

    if code in PLAYERS:
        player = PLAYERS[code]
        
        # 1. If this player was GM, set GM to None so next login takes it
        if player.get('is_gm'):
            GAME_STATE["game_master"] = None
            print(f"--- GM SLOT FREED (Player {code} logged out) ---")

        # 2. Delete the player data entirely
        del PLAYERS[code]
        print(f"--- PLAYER {code} DELETED FROM MEMORY ---")
        
        broadcast_game_state()

@socketio.on('set_player_name')
def handle_set_player_name(data):
    code = data.get('shortCode', '').upper()
    name = data.get('name', '').strip()
    if code in PLAYERS and name:
        PLAYERS[code]['name'] = name
        emit('name_updated', {'name': name})
        broadcast_game_state()

@socketio.on('set_team_name')
def handle_set_team_name(data):
    code = data.get('shortCode', '').upper()
    team_to_rename = data.get('team')
    name = data.get('name', '').strip()
    player = PLAYERS.get(code)
    if not player: return
    
    is_authorized = False
    if player.get('is_team_lead') and player.get('team') == team_to_rename: is_authorized = True
    if player.get('is_gm') and player.get('team') == 'SPECTATOR': is_authorized = True

    if not is_authorized: return
    
    if team_to_rename == 'RED': GAME_STATE['red_team_name'] = name
    elif team_to_rename == 'BLUE': GAME_STATE['blue_team_name'] = name
    emit('team_names_set', {
        'red_name': GAME_STATE['red_team_name'], 
        'blue_name': GAME_STATE['blue_team_name']
    }, broadcast=True)

@socketio.on('update_game_config')
def handle_update_game_config(data):
    code = data.get('shortCode', '').upper()
    new_config = data.get('config', {})
    player = PLAYERS.get(code)
    
    if not player or not player['is_gm']: return
    if GAME_STATE["active"]:
        emit('error_msg', {'msg': 'Cannot change settings while game is running!'}, room=player['socket_id'])
        return

    for key in DEFAULT_CONFIG.keys():
        if key in new_config:
            if key == "battery_drain_enabled":
                GAME_CONFIG[key] = bool(new_config[key])
            elif key == "ability_cost_multiplier":
                GAME_CONFIG[key] = float(new_config[key])
            elif key == "excluded_abilities":
                GAME_CONFIG[key] = list(new_config[key]) 
            else:
                GAME_CONFIG[key] = int(new_config[key])
    
    emit('config_updated', {'msg': 'Game Configuration Saved.'}, room=player['socket_id'])
    broadcast_game_state()

@socketio.on('start_game_now')
def handle_start_game_now(data):
    code = data.get('shortCode', '').upper()
    player = PLAYERS.get(code)
    if not player or not player['is_gm']: return
    
    if not GAME_STATE["active"]:
        GAME_STATE["active"] = True
        GAME_STATE["start_time"] = time.time()
        emit('game_restarted', {'message': 'Game Started! GO GO GO!'}, room='web_clients')
        broadcast_game_state()

@socketio.on('get_leaderboard')
def handle_get_leaderboard(data): 
    emit('leaderboard_data', {'ranking': RANKING})

@socketio.on('restart_game')
def handle_restart_game(data):
    global NODES, SCORES, BONUS_SCORES, GAME_STATE
    code = data.get('shortCode', '').upper()
    save_data = data.get('save', False)
    player = PLAYERS.get(code)
    if not player or not player['is_gm']: return
    
    if save_data:
        winner = "DRAW"
        t_red = SCORES["RED"] + BONUS_SCORES["RED"]
        t_blue = SCORES["BLUE"] + BONUS_SCORES["BLUE"]
        if t_red > t_blue: winner = "RED"
        elif t_blue > t_red: winner = "BLUE"
        save_current_ranking(winner, "manual_restart")

    NODES = {k: {"owner": "NEUTRAL", "points": 0, "shield_end": 0, "capture_speed": None} for k in NODES}
    SCORES = {"RED": 0, "BLUE": 0}
    BONUS_SCORES = {"RED": 0, "BLUE": 0}
    for p in PLAYERS.values():
        p['charged'] = True
        p['ability_points'] = 0 
    
    GAME_STATE["active"] = False
    GAME_STATE["start_time"] = time.time()
    GAME_STATE["results_saved"] = False
    GAME_STATE["modifiers"] = {"RED": {"score_boost_end": 0, "frozen_end": 0}, "BLUE": {"score_boost_end": 0, "frozen_end": 0}}
    
    emit('game_restarted', {'message': 'Match Reset. Waiting for GM to Start...'}, room='web_clients')
    broadcast_game_state()

@socketio.on('end_session')
def handle_end_session(data):
    global NODES, SCORES, BONUS_SCORES, GAME_STATE, PLAYERS
    code = data.get('shortCode', '').upper()
    player = PLAYERS.get(code)
    if not player or not player['is_gm']: return
    
    t_red = SCORES["RED"] + BONUS_SCORES["RED"]
    t_blue = SCORES["BLUE"] + BONUS_SCORES["BLUE"]
    winner = "DRAW"
    if t_red > t_blue: winner = "RED"
    elif t_blue > t_red: winner = "BLUE"
    if t_red > 0 or t_blue > 0: save_current_ranking(winner, "session_end")

    NODES = {k: {"owner": "NEUTRAL", "points": 0, "shield_end": 0, "capture_speed": None} for k in NODES}
    SCORES = {"RED": 0, "BLUE": 0}
    BONUS_SCORES = {"RED": 0, "BLUE": 0}
    GAME_STATE = {
        "active": False, "start_time": time.time(), "game_master": None,
        "red_team_name": "RED TEAM", "blue_team_name": "BLUE TEAM", "last_score_update": time.time(),
        "results_saved": False,
        "modifiers": {"RED": {"score_boost_end": 0, "frozen_end": 0}, "BLUE": {"score_boost_end": 0, "frozen_end": 0}}
    }
    PLAYERS.clear()
    emit('force_logout', {'message': 'Session Ended.'}, room='web_clients')

@socketio.on('game_finish')
def handle_game_finish(data):
    handle_end_session(data)

@socketio.on('register_node')
def handle_node_registration(data):
    if isinstance(data, str):
        try: data = json.loads(data)
        except: pass
    node_id = data.get('node_id')
    if node_id:
        NODE_SOCKETS[node_id] = request.sid
        if node_id in NODES: emit('update_screen', NODES[node_id]['owner'], room=request.sid)

@socketio.on('rfid_scan')
def handle_rfid_scan(data):
    uid = data.get('uid')
    node_id = data.get('node_id')
    short_code = CARD_MAPPING.get(uid)
    if not short_code: return
    player = PLAYERS.get(short_code)
    if not player: return

    if node_id == "base_station": 
        player['charged'] = True
        socketio.emit('energy_update', {'charged': True}, room=player['socket_id'])
        if "base_station" in NODE_SOCKETS: socketio.emit('update_screen', "CHARGED", room=NODE_SOCKETS["base_station"])
        return

    if not GAME_STATE["active"]:
        socketio.emit('error_msg', {'msg': 'GAME NOT STARTED!'}, room=player['socket_id'])
        if node_id in NODE_SOCKETS: socketio.emit('update_screen', "WAIT", room=NODE_SOCKETS[node_id])
        return

    has_battery = player['charged']
    if not GAME_CONFIG["battery_drain_enabled"]:
        has_battery = True 

    if has_battery:
        game_types = ['code_breaker', 'math_hack', 'wire_cut', 'reflex_hit', 'slider_lock', 'memory_matrix', 'brute_force', 'binary_switches', 'sequence_order', 'frequency_match']
        socketio.emit('start_minigame', {
            'node': node_id, 'gameType': random.choice(game_types), 'difficulty': 'normal'
        }, room=player['socket_id'])
        if node_id in NODE_SOCKETS: socketio.emit('update_screen', "HACK", room=NODE_SOCKETS[node_id])
        
        if GAME_CONFIG["battery_drain_enabled"]:
            player['charged'] = False
            socketio.emit('energy_update', {'charged': False}, room=player['socket_id'])
    else:
        socketio.emit('error_msg', {'msg': 'BATTERY EMPTY!'}, room=player['socket_id'])

@socketio.on('minigame_result')
def handle_minigame_result(data):
    success = data.get('success')
    node_id = data.get('node')
    player_code = data.get('shortCode')
    duration = data.get('duration')
    player = PLAYERS.get(player_code)
    
    if not player: return

    if success:
        if not GAME_STATE["active"]:
            return

        team = player['team']
        
        if duration < 3.0: speed = "FAST"
        elif duration <= 8.0: speed = "NORMAL"
        else: speed = "SLOW"
        
        if speed == "FAST": 
            gain = 100
            shield = GAME_CONFIG["shield_duration_fast"]
            points_reward = GAME_CONFIG["hack_bonus_fast"] + 40 
        elif speed == "NORMAL": 
            gain = 60
            shield = GAME_CONFIG["shield_duration_normal"]
            points_reward = GAME_CONFIG["hack_bonus_normal"] + 20
        else: 
            gain = 30
            shield = 0
            points_reward = 10
        
        player['ability_points'] = min(GAME_CONFIG["max_ap"], player.get('ability_points', 0) + gain)
        
        BONUS_SCORES[player['team']] = round(BONUS_SCORES[player['team']] + points_reward, 1)

        current_time = time.time()
        node = NODES[node_id]
        if node['shield_end'] > current_time and node['owner'] != player['team']:
            emit('error_msg', {'msg': 'SHIELD ACTIVE!'}, room=player['socket_id'])
            return

        node['owner'] = player['team']
        node['shield_end'] = current_time + shield
        node['capture_speed'] = speed
        if node_id in NODE_SOCKETS: socketio.emit('update_screen', player['team'], room=NODE_SOCKETS[node_id])

        emit('energy_charged', {
            'energy_gain': gain, 
            'current_ap': player['ability_points'],
            'speed_category': speed, 
            'duration': duration, 
            'animation_duration': 2.5,
            'charged': False, 
            'team': player['team'], 
            'points': points_reward
        }, room=player['socket_id'])
        
        emit('ability_announcement', {
            'team': player['team'], 
            'type': 'hack_bonus', 
            'msg': f"+{points_reward} BONUS PTS (Pending)"
        }, room='web_clients')
    else:
        if node_id in NODE_SOCKETS: socketio.emit('update_screen', NODES[node_id]['owner'], room=NODE_SOCKETS[node_id])
        emit('energy_charged', {
            'energy_gain': 0, 'current_ap': player.get('ability_points', 0),
            'speed_category': 'FAILED', 'duration': duration, 'animation_duration': 0, 'charged': False
        }, room=player['socket_id'])
    broadcast_game_state()

@socketio.on('cast_ability')
def handle_cast_ability(data):
    code = data.get('shortCode')
    ability_type = data.get('type')
    player = PLAYERS.get(code)
    if not player: return
    
    if not GAME_STATE["active"]:
        emit('error_msg', {'msg': 'GAME NOT STARTED!'}, room=player['socket_id'])
        return

    if ability_type in GAME_CONFIG.get('excluded_abilities', []):
        emit('error_msg', {'msg': 'ABILITY DISABLED!'}, room=player['socket_id'])
        return

    base_cost = ABILITY_COSTS_BASE.get(ability_type, 300)
    
    calc_cost = int(base_cost * GAME_CONFIG["ability_cost_multiplier"])
    final_cost = min(calc_cost, GAME_CONFIG["max_ap"])

    if player.get('ability_points', 0) < final_cost:
        emit('error_msg', {'msg': f'NEED {final_cost} AP!'}, room=player['socket_id'])
        return
        
    team = player['team']
    enemy_team = "BLUE" if team == "RED" else "RED"
    current_time = time.time()
    msg = ""
    
    if ability_type == 'instant_charge':
        player['charged'] = True
        emit('energy_update', {'charged': True}, room=player['socket_id'])
        msg = "BATTERY RECHARGED!"
    elif ability_type == 'shield_break':
        count = 0
        for node in NODES.values():
            if node['owner'] == enemy_team and node['shield_end'] > current_time:
                node['shield_end'] = 0
                count += 1
        msg = f"EMP! {count} SHIELDS BROKEN!"
    elif ability_type == 'global_shield':
        count = 0
        for node in NODES.values():
            if node['owner'] == team:
                node['shield_end'] = current_time + 60
                count += 1
        msg = f"DEFENSE! {count} NODES SHIELDED!"
    elif ability_type == 'boost':
        GAME_STATE["modifiers"][team]["score_boost_end"] = current_time + 60
        msg = "OVERCLOCK! 2x POINTS (60s)!"
    elif ability_type == 'freeze':
        GAME_STATE["modifiers"][enemy_team]["frozen_end"] = current_time + 25
        msg = "JAMMER! ENEMY FROZEN (25s)!"

    player['ability_points'] -= final_cost
    emit('ability_success', {'msg': msg, 'current_ap': player['ability_points']}, room=player['socket_id'])
    emit('ability_announcement', {'team': team, 'type': ability_type, 'msg': msg}, room='web_clients')
    broadcast_game_state()

if __name__ == '__main__':
    socketio.start_background_task(continuous_scoring)
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)