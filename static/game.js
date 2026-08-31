const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#username-form");
const socket = io({
    transports: ['websocket', 'polling'],
    rememberUpgrade: true,
    secure: true
});


ctx.imageSmoothingEnabled = true;

// ============================================================
// WORLD CONFIGURATION
// ============================================================

const WORLD_WIDTH = 8000;
const WORLD_HEIGHT = 5000;

const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 10;

const PARTICLE_LIMIT = 3000;
const TRAIL_LIMIT = 900;

// ============================================================
// ASSETS
// ============================================================

const tankImage = new Image();
tankImage.src = "tank.png";

let tankImageReady = false;

tankImage.onload = () => {
    tankImageReady = true;
};

tankImage.onerror = () => {
    console.warn("Could not load tank.png");
};

// ============================================================
// ABILITIES CONFIGURATION
// ============================================================

const ABILITY_CONFIG = {
    dash: {
        key: "q",
        name: "DASH",
        color: "#00a8ff",
        cooldown: 3,
        icon: "➤"
    },
    nova: {
        key: "e",
        name: "NOVA",
        color: "#9b5de5",
        cooldown: 8,
        icon: "✦"
    },
    heal: {
        key: "f",
        name: "HEAL",
        color: "#20c997",
        cooldown: 10,
        icon: "+"
    },
    overdrive: {
        key: "r",
        name: "OVERDRIVE",
        color: "#f4a261",
        cooldown: 15,
        icon: "⚡"
    }
};

// ============================================================
// GAME STATE
// ============================================================

let myId = null;

let state = {
    players: {},
    bullets: [],
    effects: [],
    leaderboard: []
};

const renderPlayers = {};
const keys = {};

let mouse = {
    x: 0,
    y: 0,
    worldX: 0,
    worldY: 0,
    down: false
};

let camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    shake: 0,
    zoom: 1
};

// Effect arrays
let particles = [];
let shockwaves = [];
let rings = [];
let damageNumbers = [];
let floatingTexts = [];
let bulletTrails = [];
let muzzleFlashes = [];
let hitMarkers = [];
let abilityBursts = [];
let afterImages = [];
let screenParticles = [];

let abilityCooldowns = {
    dash: 0,
    nova: 0,
    heal: 0,
    overdrive: 0
};

let abilityTimers = {
    overdrive: 0
};

let localStats = {
    kills: 0,
    deaths: 0,
    damage: 0,
    streak: 0,
    bestStreak: 0,
    level: 1,
    xp: 0
};

let lastKills = 0;
let lastDeaths = 0;
let time = 0;
let lastFrame = performance.now();
let screenFlash = 0;
let leaderboardVisible = true;

// Recoil configuration
let recoil = {
    amount: 0,
    velocity: -1
};

const RECOIL_STRENGTH = 9.5;

// ============================================================
// ENVIRONMENT (OBSTACLES & BOTS)
// ============================================================

const obstacles = [
    { x: 900, y: 700, width: 300, height: 80 },
    { x: 1500, y: 1200, width: 100, height: 320 },
    { x: 2400, y: 600, width: 380, height: 90 },
    { x: 3300, y: 1700, width: 100, height: 400 },
    { x: 4200, y: 900, width: 350, height: 100 },
    { x: 5100, y: 2500, width: 100, height: 420 },
    { x: 6200, y: 1200, width: 400, height: 100 },
    { x: 7000, y: 3200, width: 100, height: 400 },
    { x: 3000, y: 3500, width: 450, height: 100 },
    { x: 1200, y: 3900, width: 100, height: 400 }
];

const obstacleBlocks = [
    { x: 700, y: 1800, size: 90 },
    { x: 1900, y: 2900, size: 120 },
    { x: 3700, y: 700, size: 110 },
    { x: 4700, y: 3600, size: 130 },
    { x: 5900, y: 2800, size: 90 },
    { x: 7300, y: 1700, size: 120 }
];

const PLAYER_BULLET_DAMAGE = 25;
const BOT_BULLET_DAMAGE = 10;
const bulletHitRegistry = new Set();

const bots = [
    { id: "bot_1", name: "BOT ALPHA", x: 1200, y: 900, angle: 0, health: 100, maxHealth: 100, speed: 1.2, color: "#ef476f", fireTimer: 1 },
    { id: "bot_2", name: "BOT BRAVO", x: 2800, y: 1300, angle: Math.PI, health: 100, maxHealth: 100, speed: 1, color: "#e63946", fireTimer: 2 },
    { id: "bot_3", name: "BOT CHARLIE", x: 4500, y: 2200, angle: 0, health: 100, maxHealth: 100, speed: 1.4, color: "#d62828", fireTimer: 3 },
    { id: "bot_4", name: "BOT DELTA", x: 6500, y: 3800, angle: Math.PI, health: 100, maxHealth: 100, speed: 1.1, color: "#ff4d6d", fireTimer: 4 }
];

let botBullets = [];

// ============================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

form.addEventListener("submit", event => {
    event.preventDefault();
    const username = document.querySelector("#username").value.trim() || "Player";
    socket.emit("join", username);
    form.style.display = "none";
    canvas.style.display = "block";
});

socket.on("joined", data => {
    myId = data.id;
    createFloatingText(window.innerWidth / 2, window.innerHeight / 2, "WELCOME TO THE ARENA", "#20c997");
});

socket.on("state", newState => {
    state = {
        players: newState.players || {},
        bullets: newState.bullets || [],
        effects: newState.effects || [],
        leaderboard: newState.leaderboard || []
    };

    const me = state.players[myId];
    if (me) {
        localStats.kills = me.kills || 0;
        localStats.deaths = me.deaths || 0;
        localStats.damage = me.damage || 0;
        localStats.streak = me.streak || 0;
        localStats.bestStreak = me.best_streak || 0;
        localStats.level = me.level || 1;
        localStats.xp = me.xp || 0;

        if (me.cooldowns) {
            for (const ability of Object.keys(abilityCooldowns)) {
                if (typeof me.cooldowns[ability] === "number") {
                    abilityCooldowns[ability] = Math.max(abilityCooldowns[ability], me.cooldowns[ability]);
                }
            }
        }
    }

    if (localStats.kills > lastKills) {
        const amount = localStats.kills - lastKills;
        for (let i = 0; i < amount; i++) {
            triggerKillCelebration();
        }
    }

    if (localStats.deaths > lastDeaths) {
        triggerDeathEffect();
    }

    lastKills = localStats.kills;
    lastDeaths = localStats.deaths;
});

// Input Handlers
window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    keys[key] = true;

    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
    }

    if (key === "q") useAbility("dash");
    if (key === "e") useAbility("nova");
    if (key === "f") useAbility("heal");
    if (key === "r") useAbility("overdrive");
    if (key === "tab") leaderboardVisible = true;
});

window.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    keys[key] = false;
    if (key === "tab") leaderboardVisible = false;
});

canvas.addEventListener("mousemove", event => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    updateMouseWorld();
});

canvas.addEventListener("mousedown", event => {
    if (event.button === 0) {
        mouse.down = true;
        shoot();
    }
});

canvas.addEventListener("mouseup", event => {
    if (event.button === 0) mouse.down = false;
});

canvas.addEventListener("mouseleave", () => {
    mouse.down = false;
});

canvas.addEventListener("contextmenu", event => {
    event.preventDefault();
});

// ============================================================
// GAME MECHANICS & LOGIC
// ============================================================

let lastShot = 0;
const FIRE_RATE = 120;

function shoot() {
    const now = performance.now();
    if (now - lastShot < FIRE_RATE) return;
    lastShot = now;

    const player = renderPlayers[myId] || state.players[myId];
    if (!player) return;

    const dx = mouse.worldX - player.x;
    const dy = mouse.worldY - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;

    const angle = Math.atan2(dy, dx);
    socket.emit("shoot", { x: mouse.worldX, y: mouse.worldY });

    recoil.velocity += RECOIL_STRENGTH;

    muzzleFlashes.push({
        x: player.x + (dx / distance) * 28,
        y: player.y + (dy / distance) * 28,
        angle,
        life: 1
    });

    createMuzzleParticles(player.x + (dx / distance) * 28, player.y + (dy / distance) * 28, angle);

    camera.shake += 3.5;
    camera.x -= Math.cos(angle) * 2.5;
    camera.y -= Math.sin(angle) * 2.5;
}

function updateRecoil(dt) {
    recoil.amount += recoil.velocity * dt;
    recoil.velocity *= Math.pow(0.001, dt);
    recoil.amount *= Math.pow(0.0001, dt);

    if (recoil.amount < 0.01) {
        recoil.amount = 0;
        recoil.velocity = 0;
    }
}

function useAbility(name) {
    const player = renderPlayers[myId] || state.players[myId];
    if (!player || abilityCooldowns[name] > 0) return;

    const config = ABILITY_CONFIG[name];
    if (!config) return;

    abilityCooldowns[name] = config.cooldown;
    socket.emit("ability", { ability: name, x: mouse.worldX, y: mouse.worldY });

    if (name === "dash") abilityDash(player);
    if (name === "nova") abilityNova(player);
    if (name === "heal") abilityHeal(player);
    if (name === "overdrive") abilityOverdrive(player);
}

function abilityDash(player) {
    const dx = mouse.worldX - player.x;
    const dy = mouse.worldY - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;

    const angle = Math.atan2(dy, dx);
    const dashDistance = 280;
    const startX = player.x;
    const startY = player.y;
    const targetX = player.x + Math.cos(angle) * dashDistance;
    const targetY = player.y + Math.sin(angle) * dashDistance;

    if (!collidesWithObstacle(targetX, targetY, PLAYER_RADIUS)) {
        player.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, targetX));
        player.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, targetY));
    }

    camera.shake += 9;
    camera.zoom = 1.04;

    for (let i = 0; i < 10; i++) {
        afterImages.push({
            x: startX + (player.x - startX) * (i / 10),
            y: startY + (player.y - startY) * (i / 10),
            life: 0.7
        });
    }

    burst(startX, startY, "#00a8ff", 0.7);
    burst(player.x, player.y, "#00a8ff", 1);
    createFloatingText(player.x, player.y - 50, "DASH!", "#00a8ff");
}

function abilityNova(player) {
    const radius = 320;
    camera.shake += 18;
    camera.zoom = 1.08;

    shockwaves.push({ x: player.x, y: player.y, radius: 10, maxRadius: radius, life: 1, color: "#9b5de5", width: 10 });
    burst(player.x, player.y, "#9b5de5", 3);
    createFloatingText(player.x, player.y - 60, "NOVA!", "#9b5de5");
}

function abilityHeal(player) {
    camera.shake += 2;
    rings.push({ x: player.x, y: player.y, radius: 10, maxRadius: 80, life: 1, color: "#20c997" });
    createFloatingText(player.x, player.y - 55, "+HEAL", "#20c997");
}

function abilityOverdrive(player) {
    abilityTimers.overdrive = 5;
    camera.shake += 7;
    camera.zoom = 1.05;
    burst(player.x, player.y, "#f4a261", 2);
    createFloatingText(player.x, player.y - 60, "OVERDRIVE!", "#f4a261");
}

// Collisions
function circleIntersectsRect(cx, cy, radius, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < radius * radius;
}

function collidesWithObstacle(x, y, radius = PLAYER_RADIUS) {
    if (obstacles.some(obstacle => circleIntersectsRect(x, y, radius, obstacle))) return true;
    return obstacleBlocks.some(block => circleIntersectsRect(x, y, radius, { x: block.x, y: block.y, width: block.size, height: block.size }));
}

function moveWithCollision(player, dx, dy) {
    const nextX = player.x + dx;
    if (nextX >= PLAYER_RADIUS && nextX <= WORLD_WIDTH - PLAYER_RADIUS && !collidesWithObstacle(nextX, player.y, PLAYER_RADIUS)) {
        player.x = nextX;
    }
    const nextY = player.y + dy;
    if (nextY >= PLAYER_RADIUS && nextY <= WORLD_HEIGHT - PLAYER_RADIUS && !collidesWithObstacle(player.x, nextY, PLAYER_RADIUS)) {
        player.y = nextY;
    }
}

function updateMovement(dt) {
    const player = state.players[myId];
    if (!player) return;

    let moveX = 0;
    let moveY = 0;

    if (keys["w"] || keys["arrowup"]) moveY--;
    if (keys["s"] || keys["arrowdown"]) moveY++;
    if (keys["a"] || keys["arrowleft"]) moveX--;
    if (keys["d"] || keys["arrowright"]) moveX++;

    const length = Math.hypot(moveX, moveY);
    if (length > 0) {
        moveX /= length;
        moveY /= length;
        const speed = abilityTimers.overdrive > 0 ? PLAYER_SPEED * 1.8 : PLAYER_SPEED;
        moveWithCollision(player, moveX * speed, moveY * speed);
    }

    socket.emit("move", { x: player.x, y: player.y });
}

function updateRenderPlayers(dt) {
    for (const [id, player] of Object.entries(state.players)) {
        if (!renderPlayers[id]) {
            renderPlayers[id] = {
                x: player.x,
                y: player.y,
                health: player.health,
                angle: 0,
                pulse: Math.random() * 10,
                hurt: 0,
                scale: 1,
                lastHealth: player.health
            };
        }

        const visual = renderPlayers[id];
        const oldX = visual.x;
        const oldY = visual.y;

        visual.x += (player.x - visual.x) * 0.3;
        visual.y += (player.y - visual.y) * 0.3;
        visual.health += (player.health - visual.health) * 0.18;
        visual.hurt *= 0.86;
        visual.pulse += dt * 4;

        const vx = visual.x - oldX;
        const vy = visual.y - oldY;
        if (Math.abs(vx) + Math.abs(vy) > 0.01) {
            visual.angle = Math.atan2(vy, vx);
        }

        if (player.health < visual.lastHealth) visual.hurt = 1;
        visual.lastHealth = player.health;
    }

    for (const id of Object.keys(renderPlayers)) {
        if (!state.players[id]) delete renderPlayers[id];
    }
}

function updateCamera() {
    const player = renderPlayers[myId] || state.players[myId];
    if (!player) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.targetX = player.x - width / 2;
    camera.targetY = player.y - height / 2;

    camera.targetX = Math.max(0, Math.min(WORLD_WIDTH - width, camera.targetX));
    camera.targetY = Math.max(0, Math.min(WORLD_HEIGHT - height, camera.targetY));

    camera.x += (camera.targetX - camera.x) * 0.12;
    camera.y += (camera.targetY - camera.y) * 0.12;
    camera.shake *= 0.88;
    camera.zoom += (1 - camera.zoom) * 0.08;

    if (camera.shake < 0.05) camera.shake = 0;
}

function updateMouseWorld() {
    mouse.worldX = camera.x + mouse.x / camera.zoom;
    mouse.worldY = camera.y + mouse.y / camera.zoom;
}

// ============================================================
// PARTICLES & VISUAL EFFECTS
// ============================================================

function spawnParticle(options = {}) {
    if (particles.length >= PARTICLE_LIMIT) particles.splice(0, Math.floor(PARTICLE_LIMIT * 0.05));
    const angle = options.angle ?? Math.random() * Math.PI * 2;
    const speed = options.speed ?? Math.random() * 4 + 1;

    particles.push({
        x: options.x ?? 0,
        y: options.y ?? 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: options.size ?? Math.random() * 3 + 1,
        life: options.life ?? 1,
        maxLife: options.life ?? 1,
        color: options.color ?? "#ffffff",
        gravity: options.gravity ?? 0,
        drag: options.drag ?? 0.96,
        glow: options.glow ?? true
    });
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.life -= dt * 2.5;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function burst(x, y, color, power = 1) {
    shockwaves.push({ x, y, radius: 5, maxRadius: 75 * power, life: 1, color, width: 5 });
    for (let i = 0; i < 60 * power; i++) {
        spawnParticle({ x, y, angle: Math.random() * Math.PI * 2, speed: Math.random() * 8 * power + 2, size: Math.random() * 4 + 1, color, life: Math.random() * 0.8 + 0.2 });
    }
}

function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.radius += (s.maxRadius - s.radius) * 0.16;
        s.life -= dt * 2;
        if (s.life <= 0) shockwaves.splice(i, 1);
    }
}

function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.radius += (r.maxRadius - r.radius) * 0.12;
        r.life -= dt * 1.8;
        if (r.life <= 0) rings.splice(i, 1);
    }
}

function updateBulletTrails() {
    for (const bullet of state.bullets) {
        bulletTrails.push({ x: bullet.x, y: bullet.y, owner: bullet.owner, life: 1 });
    }
    if (bulletTrails.length > TRAIL_LIMIT) bulletTrails.splice(0, bulletTrails.length - TRAIL_LIMIT);
    for (let i = bulletTrails.length - 1; i >= 0; i--) {
        bulletTrails[i].life -= 0.12;
        if (bulletTrails[i].life <= 0) bulletTrails.splice(i, 1);
    }
}

function createMuzzleParticles(x, y, angle) {
    for (let i = 0; i < 22; i++) {
        spawnParticle({ x, y, angle: angle + (Math.random() - 0.5) * 0.8, speed: Math.random() * 8 + 2, size: Math.random() * 3 + 1, life: Math.random() * 0.35 + 0.15, color: Math.random() > 0.3 ? "#f4b942" : "#ffffff", gravity: 0.04 });
    }
}

function updateMuzzleFlashes(dt) {
    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        muzzleFlashes[i].life -= dt * 9;
        if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
    }
}

function updateAfterImages(dt) {
    for (let i = afterImages.length - 1; i >= 0; i--) {
        afterImages[i].life -= dt * 2;
        if (afterImages[i].life <= 0) afterImages.splice(i, 1);
    }
}

// ============================================================
// BOTS & DAMAGE HANDLING
// ============================================================

function updatePlayerBulletDamage() {
    for (const bullet of state.bullets) {
        const isMyBullet = bullet.owner === myId || bullet.owner === socket.id;
        if (!isMyBullet) continue;

        const bulletId = bullet.id ?? `${bullet.owner}_${bullet.x}_${bullet.y}`;
        if (bulletHitRegistry.has(bulletId)) continue;

        for (const bot of bots) {
            if (bot.health <= 0) continue;
            const distance = Math.hypot(bot.x - bullet.x, bot.y - bullet.y);
            if (distance <= PLAYER_RADIUS + 10) {
                bulletHitRegistry.add(bulletId);
                const damage = abilityTimers.overdrive > 0 ? PLAYER_BULLET_DAMAGE * 1.5 : PLAYER_BULLET_DAMAGE;
                bot.health = Math.max(0, bot.health - damage);

                addDamageNumber(bot.x, bot.y - 25, Math.round(damage));
                burst(bot.x, bot.y, "#ef476f", 0.6);
                addHitMarker(bot.x, bot.y);
                camera.shake += 3;
                localStats.damage += damage;

                if (bot.health <= 0) {
                    localStats.kills++;
                    localStats.streak++;
                    localStats.bestStreak = Math.max(localStats.bestStreak, localStats.streak);
                    triggerKillCelebration();
                    burst(bot.x, bot.y, "#f4b942", 2);
                    createFloatingText(bot.x, bot.y - 50, "ELIMINATED", "#d58b00");
                }
                break;
            }
        }
    }
    if (bulletHitRegistry.size > 1000) bulletHitRegistry.clear();
}

function updateBots(dt) {
    const player = renderPlayers[myId] || state.players[myId];
    if (!player) return;

    for (const bot of bots) {
        if (bot.health <= 0) continue;
        const dx = player.x - bot.x;
        const dy = player.y - bot.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) continue;

        bot.angle = Math.atan2(dy, dx);

        if (distance > 450 || distance < 250) {
            const dir = distance > 450 ? 1 : -1;
            const moveX = Math.cos(bot.angle) * bot.speed * dir;
            const moveY = Math.sin(bot.angle) * bot.speed * dir;
            if (!collidesWithObstacle(bot.x + moveX, bot.y + moveY, 22)) {
                bot.x += moveX;
                bot.y += moveY;
            }
        }

        bot.fireTimer -= dt;
        if (bot.fireTimer <= 0 && distance < 1000) {
            bot.fireTimer = 1.2 + Math.random() * 1.5;
            const shotAngle = bot.angle + (Math.random() - 0.5) * 0.08;

            botBullets.push({
                x: bot.x + Math.cos(shotAngle) * 28,
                y: bot.y + Math.sin(shotAngle) * 28,
                vx: Math.cos(shotAngle) * 7,
                vy: Math.sin(shotAngle) * 7,
                life: 1.5
            });

            muzzleFlashes.push({ x: bot.x, y: bot.y, angle: shotAngle, life: 1 });
        }
    }
}

function updateBotBullets(dt) {
    const playerState = state.players[myId];
    if (!playerState || playerState.health <= 0) return;

    for (let i = botBullets.length - 1; i >= 0; i--) {
        const bullet = botBullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life -= dt;

        if (collidesWithObstacle(bullet.x, bullet.y, 4)) {
            burst(bullet.x, bullet.y, "#ef476f", 0.35);
            botBullets.splice(i, 1);
            continue;
        }

        const distance = Math.hypot(playerState.x - bullet.x, playerState.y - bullet.y);
        if (distance < PLAYER_RADIUS) {
            playerState.health = Math.max(0, playerState.health - BOT_BULLET_DAMAGE);
            burst(bullet.x, bullet.y, "#ef476f", 0.5);
            addDamageNumber(playerState.x, playerState.y - 25, BOT_BULLET_DAMAGE);
            screenFlash = 0.8;
            camera.shake += 5;

            const visual = renderPlayers[myId];
            if (visual) visual.hurt = 1;

            if (playerState.health <= 0) {
                localStats.deaths++;
                localStats.streak = 0;
                triggerDeathEffect();
                setTimeout(() => {
                    if (state.players[myId]) {
                        state.players[myId].health = 100;
                        state.players[myId].x = WORLD_WIDTH / 2;
                        state.players[myId].y = WORLD_HEIGHT / 2;
                    }
                }, 1500);
            }
            botBullets.splice(i, 1);
            continue;
        }

        if (bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > WORLD_WIDTH || bullet.y > WORLD_HEIGHT) {
            botBullets.splice(i, 1);
        }
    }
}

// ============================================================
// RENDERING FUNCTIONS
// ============================================================

function drawWorld() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const gradient = ctx.createLinearGradient(camera.x, camera.y, camera.x, camera.y + height);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, "#f7f9fb");
    gradient.addColorStop(1, "#e8edf2");

    ctx.fillStyle = gradient;
    ctx.fillRect(camera.x, camera.y, width, height);

    drawArenaGrid();
    drawObstacles();
}

function drawArenaGrid() {
    const size = 100;
    const startX = Math.floor(camera.x / size) * size;
    const startY = Math.floor(camera.y / size) * size;

    ctx.lineWidth = 1;
    for (let x = startX; x <= camera.x + window.innerWidth; x += size) {
        ctx.strokeStyle = "rgba(50,65,85,0.07)";
        ctx.beginPath();
        ctx.moveTo(x, camera.y);
        ctx.lineTo(x, camera.y + window.innerHeight);
        ctx.stroke();
    }
    for (let y = startY; y <= camera.y + window.innerHeight; y += size) {
        ctx.strokeStyle = "rgba(50,65,85,0.07)";
        ctx.beginPath();
        ctx.moveTo(camera.x, y);
        ctx.lineTo(camera.x + window.innerWidth, y);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(40,50,65,0.45)";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.strokeStyle = "#aeb8c4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 12);
        ctx.fill();
        ctx.stroke();
    }
}

function drawPlayer(id, player) {
    const visual = renderPlayers[id];
    if (!visual) return;

    const x = visual.x;
    const y = visual.y;
    const isMe = id === myId;
    const primary = isMe ? "#00a8ff" : "#ef476f";

    ctx.save();
    const dx = mouse.worldX - x;
    const dy = mouse.worldY - y;
    const angle = Math.atan2(dy, dx);
    const tankX = x - Math.cos(angle) * recoil.amount;
    const tankY = y - Math.sin(angle) * recoil.amount;

    ctx.translate(tankX, tankY);
    ctx.rotate(angle);

    if (tankImageReady) {
        ctx.drawImage(tankImage, -34, -34, 68, 68);
    } else {
        ctx.fillStyle = "#e8edf2";
        ctx.strokeStyle = primary;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-22, -16, 44, 32, 8);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();

    drawHealthBar(x, y, visual.health);
}

function drawHealthBar(x, y, health) {
    const width = 52;
    const height = 6;
    const bx = x - width / 2;
    const by = y - 37;

    ctx.fillStyle = "rgba(25,35,45,0.2)";
    ctx.beginPath();
    ctx.roundRect(bx, by, width, height, 3);
    ctx.fill();

    const amount = Math.max(0, Math.min(100, health || 0));
    ctx.fillStyle = amount > 60 ? "#20c997" : amount > 30 ? "#f4b942" : "#ef476f";
    ctx.beginPath();
    ctx.roundRect(bx, by, (width * amount) / 100, height, 3);
    ctx.fill();
}

function drawBullets() {
    for (const bullet of state.bullets) {
        const color = bullet.owner === myId ? "#f4b942" : "#ef476f";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawBots() {
    for (const bot of bots) {
        if (bot.health <= 0) continue;
        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.rotate(bot.angle);
        ctx.fillStyle = "#ffe3e7";
        ctx.strokeStyle = bot.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-22, -16, 44, 32, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

function drawCrosshair() {
    ctx.strokeStyle = "rgba(30,40,50,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
    ctx.stroke();
}

function draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height);

    updateCamera();
    updateMouseWorld();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-width / 2, -height / 2);
    ctx.translate(-camera.x, -camera.y);

    drawWorld();
    drawBullets();
    drawBots();

    for (const [id, player] of Object.entries(state.players)) {
        drawPlayer(id, player);
    }

    ctx.restore();
    drawCrosshair();
}

// ============================================================
// MAIN LOOP
// ============================================================

function loop(now) {
    const dt = Math.min(0.033, (now - lastFrame) / 1000);
    lastFrame = now;
    time += dt;

    for (const ability of Object.keys(abilityCooldowns)) {
        if (abilityCooldowns[ability] > 0) {
            abilityCooldowns[ability] -= dt;
            if (abilityCooldowns[ability] < 0) abilityCooldowns[ability] = 0;
        }
    }

    updateMovement(dt);
    updateBots(dt);
    updatePlayerBulletDamage();
    updateBotBullets(dt);
    updateRenderPlayers(dt);
    updateParticles(dt);
    updateShockwaves(dt);
    updateRings(dt);
    updateBulletTrails();
    updateMuzzleFlashes(dt);
    updateAfterImages(dt);
    updateRecoil(dt);

    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
