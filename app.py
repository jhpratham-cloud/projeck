from gevent import monkey
monkey.patch_all()

import math
import random
import threading
import os

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="gevent",
    manage_session=False
)


players = {}
bullets = []
lock = threading.Lock()

WORLD_WIDTH = 8000
WORLD_HEIGHT = 5000

PLAYER_RADIUS = 20
PLAYER_HEALTH = 100

BULLET_SPEED = 9
BULLET_DAMAGE = 20
BULLET_RADIUS = 4

TICK_RATE = 0.02


def random_spawn():
    x = random.randint(PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS)
    y = random.randint(PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS)
    return x, y


def game_loop():
    while True:
        with lock:
            for bullet in bullets[:]:
                bullet["x"] += bullet["vx"]
                bullet["y"] += bullet["vy"]

                if (
                    bullet["x"] < 0
                    or bullet["x"] > WORLD_WIDTH
                    or bullet["y"] < 0
                    or bullet["y"] > WORLD_HEIGHT
                ):
                    bullets.remove(bullet)
                    continue

                for player_id, player in players.items():
                    if player_id == bullet["owner"]:
                        continue

                    distance = math.hypot(
                        player["x"] - bullet["x"],
                        player["y"] - bullet["y"],
                    )

                    if distance < PLAYER_RADIUS + BULLET_RADIUS:
                        player["health"] -= BULLET_DAMAGE
                        
                        if bullet in bullets:
                            bullets.remove(bullet)

                        if player["health"] <= 0:
                            player["x"], player["y"] = random_spawn()
                            player["health"] = PLAYER_HEALTH

                        break

            state = {
                "players": {
                    player_id: {
                        "name": player["name"],
                        "x": player["x"],
                        "y": player["y"],
                        "health": player["health"],
                    }
                    for player_id, player in players.items()
                },
                "bullets": [
                    {
                        "x": bullet["x"],
                        "y": bullet["y"],
                        "owner": bullet["owner"],
                    }
                    for bullet in bullets
                ],
            }

        socketio.emit("state", state)
        socketio.sleep(TICK_RATE)


@app.get("/")
def home():
    return render_template("index.html")


@socketio.on("join")
def join(username):
    name = str(username or "").strip()[:16]
    if not name:
        name = "Player"

    with lock:
        x, y = random_spawn()
        players[request.sid] = {
            "name": name,
            "x": x,
            "y": y,
            "health": PLAYER_HEALTH,
        }

    emit("joined", {"id": request.sid})


@socketio.on("move")
def move(data):
    if not isinstance(data, dict):
        return

    with lock:
        player = players.get(request.sid)
        if not player:
            return

        try:
            new_x = float(data.get("x", player["x"]))
            new_y = float(data.get("y", player["y"]))
        except (TypeError, ValueError):
            return

        if not math.isfinite(new_x) or not math.isfinite(new_y):
            return

        player["x"] = max(PLAYER_RADIUS, min(WORLD_WIDTH - PLAYER_RADIUS, new_x))
        player["y"] = max(PLAYER_RADIUS, min(WORLD_HEIGHT - PLAYER_RADIUS, new_y))


@socketio.on("shoot")
def shoot(target):
    if not isinstance(target, dict):
        return

    with lock:
        player = players.get(request.sid)
        if not player:
            return

        try:
            target_x = float(target["x"])
            target_y = float(target["y"])
        except (KeyError, TypeError, ValueError):
            return

        if not math.isfinite(target_x) or not math.isfinite(target_y):
            return

        dx = target_x - player["x"]
        dy = target_y - player["y"]
        distance = math.hypot(dx, dy)

        if distance < 0.001:
            return

        bullets.append(
            {
                "owner": request.sid,
                "x": player["x"],
                "y": player["y"],
                "vx": (dx / distance) * BULLET_SPEED,
                "vy": (dy / distance) * BULLET_SPEED,
            }
        )


@socketio.on("disconnect")
def disconnect():
    with lock:
        players.pop(request.sid, None)
        bullets[:] = [bullet for bullet in bullets if bullet["owner"] != request.sid]


if __name__ == "__main__":
    socketio.start_background_task(game_loop)
    port = int(os.environ.get("PORT", 8000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False, use_reloader=False)
