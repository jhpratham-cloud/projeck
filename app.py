import eventlet
eventlet.monkey_patch()

import uuid
import math
import random
import time
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import threading

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Game Constants
WIDTH = 1600
HEIGHT = 1200
PLAYER_HEALTH = 100
BULLET_SPEED = 10

players = {}
bullets = []
bots = [
    {
        "id": "bot_1",
        "name": "BOT ALPHA",
        "x": 1200,
        "y": 900,
        "angle": 0,
        "health": 300,
        "maxHealth": 300,
        "speed": 1.2,
        "color": "#ef476f",
        "fireTimer": 1
    },
    {
        "id": "bot_2",
        "name": "BOT BRAVO",
        "x": 400,
        "y": 300,
        "angle": 0,
        "health": 300,
        "maxHealth": 300,
        "speed": 1.2,
        "color": "#ef476f",
        "fireTimer": 1
    },
    {
        "id": "bot_3",
        "name": "BOT CHARLIE",
        "x": 1000,
        "y": 300,
        "angle": 0,
        "health": 300,
        "maxHealth": 300,
        "speed": 1.2,
        "color": "#ef476f",
        "fireTimer": 1
    },
    {
        "id": "bot_4",
        "name": "BOT DELTA",
        "x": 400,
        "y": 900,
        "angle": 0,
        "health": 300,
        "maxHealth": 300,
        "speed": 1.2,
        "color": "#ef476f",
        "fireTimer": 1
    }
]

lock = threading.Lock()

@socketio.on("connect")
def handle_connect():
    with lock:
        players[request.sid] = {
            "x": random.randint(100, WIDTH - 100),
            "y": random.randint(100, HEIGHT - 100),
            "health": PLAYER_HEALTH,
            "score": 0
        }
    print(f"Player connected: {request.sid}")

@socketio.on("disconnect")
def handle_disconnect():
    with lock:
        if request.sid in players:
            del players[request.sid]
    print(f"Player disconnected: {request.sid}")

@socketio.on("shoot")
def handle_shoot(data):
    if not isinstance(data, dict):
        return
    with lock:
        player = players.get(request.sid)
        if not player:
            return
        target_x = data.get("x", 0)
        target_y = data.get("y", 0)
        dx = target_x - player["x"]
        dy = target_y - player["y"]
        distance = math.hypot(dx, dy)
        if distance == 0:
            return
        
        bullets.append({
            "id": uuid.uuid4().hex,  # Fixes multi-hit lag spike
            "owner": request.sid,
            "x": player["x"],
            "y": player["y"],
            "vx": (dx / distance) * BULLET_SPEED,
            "vy": (dy / distance) * BULLET_SPEED,
        })

@socketio.on("ability")
def handle_ability(data):
    if not isinstance(data, dict):
        return
    with lock:
        player = players.get(request.sid)
        if not player:
            return
        if data.get("ability") == "heal":
            player["health"] = min(PLAYER_HEALTH, player["health"] + 50)

def game_loop():
    global bullets
    while True:
        time.sleep(0.016)
        with lock:
            new_bullets = []
            for b in bullets:
                b["x"] += b["vx"]
                b["y"] += b["vy"]
                if 0 <= b["x"] <= WIDTH and 0 <= b["y"] <= HEIGHT:
                    new_bullets.append(b)
            bullets = new_bullets

            state = {
                "players": players,
                "bullets": [{"id": b["id"], "x": b["x"], "y": b["y"], "owner": b["owner"]} for b in bullets],
                "bots": bots
            }
        socketio.emit("game_state", state)

if __name__ == "__main__":
    threading.Thread(target=game_loop, daemon=True).start()
    socketio.run(app, host="0.0.0.0", port=5000)
        
        # Ensures health only regenerates using the heal key (F)
        if data.get("ability") == "heal":
            player["health"] = min(PLAYER_HEALTH, player["health"] + 50)
