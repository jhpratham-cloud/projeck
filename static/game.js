const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#username-form");
const socket = io();

ctx.imageSmoothingEnabled = true;

// ============================================================
// WORLD
// ============================================================

const WORLD_WIDTH = 8000;
const WORLD_HEIGHT = 5000;

const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 10;

const PARTICLE_LIMIT = 3000;
const TRAIL_LIMIT = 900;

// ============================================================
// TANK IMAGE
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
// ABILITIES
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

// ============================================================
// EFFECT ARRAYS
// ============================================================

let particles = [];
let shockwaves = [];
let rings = [];
let damageNumbers = [];
let floatingTexts = [];
let bulletTrails = [];
let muzzleFlashes = [];
let hitMarkers = [];
let killFeed = [];
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

// ============================================================
// RECOIL
// ============================================================

let recoil = {
    amount: 0,
    velocity: 0
};

const RECOIL_STRENGTH = 9.5;

// ============================================================
// OBSTACLES
// ============================================================

const obstacles = [
    {
        x: 900,
        y: 700,
        width: 300,
        height: 80
    },

    {
        x: 1500,
        y: 1200,
        width: 100,
        height: 320
    },

    {
        x: 2400,
        y: 600,
        width: 380,
        height: 90
    },

    {
        x: 3300,
        y: 1700,
        width: 100,
        height: 400
    },

    {
        x: 4200,
        y: 900,
        width: 350,
        height: 100
    },

    {
        x: 5100,
        y: 2500,
        width: 100,
        height: 420
    },

    {
        x: 6200,
        y: 1200,
        width: 400,
        height: 100
    },

    {
        x: 7000,
        y: 3200,
        width: 100,
        height: 400
    },

    {
        x: 3000,
        y: 3500,
        width: 450,
        height: 100
    },

    {
        x: 1200,
        y: 3900,
        width: 100,
        height: 400
    }
];

const obstacleBlocks = [
    {
        x: 700,
        y: 1800,
        size: 90
    },

    {
        x: 1900,
        y: 2900,
        size: 120
    },

    {
        x: 3700,
        y: 700,
        size: 110
    },

    {
        x: 4700,
        y: 3600,
        size: 130
    },

    {
        x: 5900,
        y: 2800,
        size: 90
    },

    {
        x: 7300,
        y: 1700,
        size: 120
    }
];

// ============================================================
// BOTS
// ============================================================

const bots = [
    {
        id: "bot_1",
        name: "BOT ALPHA",
        x: 1200,
        y: 900,
        angle: 0,
        health: 100,
        maxHealth: 100,
        speed: 1.2,
        color: "#ef476f",
        fireTimer: 1
    },

    {
        id: "bot_2",
        name: "BOT BRAVO",
        x: 2800,
        y: 1300,
        angle: Math.PI,
        health: 100,
        maxHealth: 100,
        speed: 1,
        color: "#e63946",
        fireTimer: 2
    },

    {
        id: "bot_3",
        name: "BOT CHARLIE",
        x: 4500,
        y: 2200,
        angle: 0,
        health: 100,
        maxHealth: 100,
        speed: 1.4,
        color: "#d62828",
        fireTimer: 3
    },

    {
        id: "bot_4",
        name: "BOT DELTA",
        x: 6500,
        y: 3800,
        angle: Math.PI,
        health: 100,
        maxHealth: 100,
        speed: 1.1,
        color: "#ff4d6d",
        fireTimer: 4
    }
];

let botBullets = [];

// ============================================================
// RESIZE
// ============================================================

function resizeCanvas() {

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        window.innerWidth * dpr;

    canvas.height =
        window.innerHeight * dpr;

    canvas.style.width =
        window.innerWidth + "px";

    canvas.style.height =
        window.innerHeight + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}

window.addEventListener(
    "resize",
    resizeCanvas
);

resizeCanvas();

// ============================================================
// JOIN
// ============================================================

form.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        const username =
            document
                .querySelector("#username")
                .value
                .trim() ||
            "Player";

        socket.emit(
            "join",
            username
        );

        form.style.display =
            "none";

        canvas.style.display =
            "block";
    }
);

socket.on(
    "joined",
    data => {

        myId = data.id;

        createFloatingText(
            window.innerWidth / 2,
            window.innerHeight / 2,
            "WELCOME TO THE ARENA",
            "#20c997"
        );
    }
);

// ============================================================
// SOCKET STATE
// ============================================================

socket.on(
    "state",
    newState => {

        state = {
            players:
                newState.players || {},

            bullets:
                newState.bullets || [],

            effects:
                newState.effects || [],

            leaderboard:
                newState.leaderboard || []
        };

        const me =
            state.players[myId];

        if (me) {

            localStats.kills =
                me.kills || 0;

            localStats.deaths =
                me.deaths || 0;

            localStats.damage =
                me.damage || 0;

            localStats.streak =
                me.streak || 0;

            localStats.bestStreak =
                me.best_streak || 0;

            localStats.level =
                me.level || 1;

            localStats.xp =
                me.xp || 0;

            if (me.cooldowns) {

                for (
                    const ability
                    of Object.keys(
                        abilityCooldowns
                    )
                ) {

                    if (
                        typeof me.cooldowns[
                            ability
                        ] === "number"
                    ) {

                        abilityCooldowns[
                            ability
                        ] =
                            Math.max(
                                abilityCooldowns[
                                    ability
                                ],

                                me.cooldowns[
                                    ability
                                ]
                            );
                    }
                }
            }
        }

        if (
            localStats.kills >
            lastKills
        ) {

            const amount =
                localStats.kills -
                lastKills;

            for (
                let i = 0;
                i < amount;
                i++
            ) {

                triggerKillCelebration();
            }
        }

        if (
            localStats.deaths >
            lastDeaths
        ) {

            triggerDeathEffect();
        }

        lastKills =
            localStats.kills;

        lastDeaths =
            localStats.deaths;
    }
);

// ============================================================
// KEYBOARD
// ============================================================

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();

        keys[key] = true;

        if (
            [
                "w",
                "a",
                "s",
                "d",
                "arrowup",
                "arrowdown",
                "arrowleft",
                "arrowright",
                " "
            ].includes(key)
        ) {

            event.preventDefault();
        }

        if (key === "q") {
            useAbility("dash");
        }

        if (key === "e") {
            useAbility("nova");
        }

        if (key === "f") {
            useAbility("heal");
        }

        if (key === "r") {
            useAbility("overdrive");
        }

        if (key === "tab") {
            leaderboardVisible = true;
        }
    }
);

window.addEventListener(
    "keyup",
    event => {

        const key =
            event.key.toLowerCase();

        keys[key] = false;

        if (key === "tab") {
            leaderboardVisible = false;
        }
    }
);

// ============================================================
// MOUSE
// ============================================================

canvas.addEventListener(
    "mousemove",
    event => {

        const rect =
            canvas.getBoundingClientRect();

        mouse.x =
            event.clientX -
            rect.left;

        mouse.y =
            event.clientY -
            rect.top;

        updateMouseWorld();
    }
);

canvas.addEventListener(
    "mousedown",
    event => {

        if (event.button === 0) {

            mouse.down = true;

            shoot();
        }
    }
);

canvas.addEventListener(
    "mouseup",
    event => {

        if (event.button === 0) {
            mouse.down = false;
        }
    }
);

canvas.addEventListener(
    "mouseleave",
    () => {
        mouse.down = false;
    }
);

canvas.addEventListener(
    "contextmenu",
    event => {
        event.preventDefault();
    }
);

// ============================================================
// SHOOTING
// ============================================================

let lastShot = 0;

const FIRE_RATE = 120;

function shoot() {

    const now =
        performance.now();

    if (
        now - lastShot <
        FIRE_RATE
    ) {
        return;
    }

    lastShot = now;

    const player =
        renderPlayers[myId] ||
        state.players[myId];

    if (!player) {
        return;
    }

    const dx =
        mouse.worldX -
        player.x;

    const dy =
        mouse.worldY -
        player.y;

    const distance =
        Math.hypot(
            dx,
            dy
        );

    if (distance < 1) {
        return;
    }

    const angle =
        Math.atan2(
            dy,
            dx
        );

    socket.emit(
        "shoot",
        {
            x: mouse.worldX,
            y: mouse.worldY
        }
    );

    // Recoil
    recoil.velocity +=
        RECOIL_STRENGTH;

    // Muzzle flash
    muzzleFlashes.push({
        x:
            player.x +
            dx / distance *
            28,

        y:
            player.y +
            dy / distance *
            28,

        angle,
        life: 1
    });

    createMuzzleParticles(
        player.x +
            dx / distance *
            28,

        player.y +
            dy / distance *
            28,

        angle
    );

    // Screen shake
    camera.shake += 3.5;

    // Camera kick
    camera.x -=
        Math.cos(angle) *
        2.5;

    camera.y -=
        Math.sin(angle) *
        2.5;
}

// ============================================================
// RECOIL
// ============================================================

function updateRecoil(dt) {

    recoil.amount +=
        recoil.velocity *
        dt;

    recoil.velocity *=
        Math.pow(
            0.001,
            dt
        );

    recoil.amount *=
        Math.pow(
            0.0001,
            dt
        );

    if (
        recoil.amount < 0.01
    ) {

        recoil.amount = 0;
        recoil.velocity = 0;
    }
}

// ============================================================
// ABILITIES
// ============================================================

function useAbility(name) {

    const player =
        renderPlayers[myId] ||
        state.players[myId];

    if (!player) {
        return;
    }

    if (
        abilityCooldowns[name] > 0
    ) {
        return;
    }

    const config =
        ABILITY_CONFIG[name];

    if (!config) {
        return;
    }

    abilityCooldowns[name] =
        config.cooldown;

    socket.emit(
        "ability",
        {
            ability: name,
            x: mouse.worldX,
            y: mouse.worldY
        }
    );

    if (name === "dash") {
        abilityDash(player);
    }

    if (name === "nova") {
        abilityNova(player);
    }

    if (name === "heal") {
        abilityHeal(player);
    }

    if (name === "overdrive") {
        abilityOverdrive(player);
    }
}

// ============================================================
// DASH
// ============================================================

function abilityDash(player) {

    const dx =
        mouse.worldX -
        player.x;

    const dy =
        mouse.worldY -
        player.y;

    const distance =
        Math.hypot(
            dx,
            dy
        );

    if (distance < 1) {
        return;
    }

    const angle =
        Math.atan2(
            dy,
            dx
        );

    const dashDistance = 280;

    const startX =
        player.x;

    const startY =
        player.y;

    const targetX =
        player.x +
        Math.cos(angle) *
        dashDistance;

    const targetY =
        player.y +
        Math.sin(angle) *
        dashDistance;

    if (
        !collidesWithObstacle(
            targetX,
            targetY,
            PLAYER_RADIUS
        )
    ) {

        player.x =
            Math.max(
                PLAYER_RADIUS,
                Math.min(
                    WORLD_WIDTH -
                        PLAYER_RADIUS,
                    targetX
                )
            );

        player.y =
            Math.max(
                PLAYER_RADIUS,
                Math.min(
                    WORLD_HEIGHT -
                        PLAYER_RADIUS,
                    targetY
                )
            );
    }

    camera.shake += 9;

    camera.zoom = 1.04;

    for (
        let i = 0;
        i < 10;
        i++
    ) {

        afterImages.push({
            x:
                startX +
                (player.x -
                    startX) *
                (i / 10),

            y:
                startY +
                (player.y -
                    startY) *
                (i / 10),

            life: 0.7
        });
    }

    burst(
        startX,
        startY,
        "#00a8ff",
        0.7
    );

    burst(
        player.x,
        player.y,
        "#00a8ff",
        1
    );

    for (
        let i = 0;
        i < 70;
        i++
    ) {

        spawnParticle({
            x: startX,
            y: startY,

            angle:
                angle +
                Math.PI +
                (
                    Math.random() -
                    0.5
                ) *
                0.8,

            speed:
                Math.random() *
                10 +
                3,

            size:
                Math.random() *
                4 +
                1,

            color:
                i % 3 === 0
                    ? "#ffffff"
                    : "#00a8ff",

            life:
                Math.random() *
                0.7 +
                0.3
        });
    }

    createFloatingText(
        player.x,
        player.y - 50,
        "DASH!",
        "#00a8ff"
    );
}

// ============================================================
// NOVA
// ============================================================

function abilityNova(player) {

    const radius = 320;

    camera.shake += 18;

    camera.zoom = 1.08;

    shockwaves.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius: radius,
        life: 1,
        color: "#9b5de5",
        width: 10
    });

    shockwaves.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius:
            radius * 0.72,
        life: 1,
        color: "#ffffff",
        width: 3
    });

    burst(
        player.x,
        player.y,
        "#9b5de5",
        3
    );

    for (
        let i = 0;
        i < 180;
        i++
    ) {

        const angle =
            Math.random() *
            Math.PI *
            2;

        spawnParticle({
            x: player.x,
            y: player.y,

            angle,

            speed:
                Math.random() *
                13 +
                3,

            size:
                Math.random() *
                5 +
                1,

            color:
                Math.random() > 0.3
                    ? "#9b5de5"
                    : "#ffffff",

            life:
                Math.random() *
                1.2 +
                0.4,

            gravity: 0
        });
    }

    createFloatingText(
        player.x,
        player.y - 60,
        "NOVA!",
        "#9b5de5"
    );
}

// ============================================================
// HEAL
// ============================================================

function abilityHeal(player) {

    camera.shake += 2;

    rings.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius: 80,
        life: 1,
        color: "#20c997"
    });

    for (
        let i = 0;
        i < 90;
        i++
    ) {

        const angle =
            Math.random() *
            Math.PI *
            2;

        spawnParticle({
            x:
                player.x +
                (
                    Math.random() -
                    0.5
                ) *
                40,

            y:
                player.y +
                (
                    Math.random() -
                    0.5
                ) *
                40,

            angle:
                -Math.PI / 2 +
                (
                    Math.random() -
                    0.5
                ) *
                1.2,

            speed:
                Math.random() *
                2 +
                0.5,

            size:
                Math.random() *
                4 +
                1,

            color:
                Math.random() > 0.25
                    ? "#20c997"
                    : "#ffffff",

            life:
                Math.random() *
                1.4 +
                0.5,

            gravity: -0.05
        });
    }

    createFloatingText(
        player.x,
        player.y - 55,
        "+HEAL",
        "#20c997"
    );
}

// ============================================================
// OVERDRIVE
// ============================================================

function abilityOverdrive(player) {

    abilityTimers.overdrive = 5;

    camera.shake += 7;

    camera.zoom = 1.05;

    burst(
        player.x,
        player.y,
        "#f4a261",
        2
    );

    for (
        let i = 0;
        i < 100;
        i++
    ) {

        spawnParticle({
            x: player.x,
            y: player.y,

            angle:
                Math.random() *
                Math.PI *
                2,

            speed:
                Math.random() *
                6 +
                2,

            size:
                Math.random() *
                4 +
                1,

            color:
                Math.random() > 0.3
                    ? "#f4a261"
                    : "#ffffff",

            life:
                Math.random() *
                1 +
                0.4
        });
    }

    createFloatingText(
        player.x,
        player.y - 60,
        "OVERDRIVE!",
        "#f4a261"
    );
}

// ============================================================
// COLLISION
// ============================================================

function circleIntersectsRect(
    cx,
    cy,
    radius,
    rect
) {

    const closestX =
        Math.max(
            rect.x,
            Math.min(
                cx,
                rect.x +
                    rect.width
            )
        );

    const closestY =
        Math.max(
            rect.y,
            Math.min(
                cy,
                rect.y +
                    rect.height
            )
        );

    const dx =
        cx - closestX;

    const dy =
        cy - closestY;

    return (
        dx * dx +
        dy * dy <
        radius * radius
    );
}

function collidesWithObstacle(
    x,
    y,
    radius = PLAYER_RADIUS
) {

    if (
        obstacles.some(
            obstacle =>
                circleIntersectsRect(
                    x,
                    y,
                    radius,
                    obstacle
                )
        )
    ) {
        return true;
    }

    return obstacleBlocks.some(
        block =>
            circleIntersectsRect(
                x,
                y,
                radius,
                {
                    x: block.x,
                    y: block.y,
                    width: block.size,
                    height: block.size
                }
            )
    );
}

function moveWithCollision(
    player,
    dx,
    dy
) {

    const nextX =
        player.x + dx;

    if (
        nextX >= PLAYER_RADIUS &&
        nextX <=
            WORLD_WIDTH -
            PLAYER_RADIUS &&
        !collidesWithObstacle(
            nextX,
            player.y,
            PLAYER_RADIUS
        )
    ) {

        player.x = nextX;
    }

    const nextY =
        player.y + dy;

    if (
        nextY >= PLAYER_RADIUS &&
        nextY <=
            WORLD_HEIGHT -
            PLAYER_RADIUS &&
        !collidesWithObstacle(
            player.x,
            nextY,
            PLAYER_RADIUS
        )
    ) {

        player.y = nextY;
    }
}

// ============================================================
// MOVEMENT
// ============================================================

function updateMovement(dt) {

    const player =
        state.players[myId];

    if (!player) {
        return;
    }

    let moveX = 0;
    let moveY = 0;

    if (
        keys["w"] ||
        keys["arrowup"]
    ) {
        moveY--;
    }

    if (
        keys["s"] ||
        keys["arrowdown"]
    ) {
        moveY++;
    }

    if (
        keys["a"] ||
        keys["arrowleft"]
    ) {
        moveX--;
    }

    if (
        keys["d"] ||
        keys["arrowright"]
    ) {
        moveX++;
    }

    const length =
        Math.hypot(
            moveX,
            moveY
        );

    if (length > 0) {

        moveX /= length;
        moveY /= length;

        const speed =
            abilityTimers.overdrive > 0
                ? PLAYER_SPEED * 1.8
                : PLAYER_SPEED;

        moveWithCollision(
            player,
            moveX * speed,
            moveY * speed
        );

        if (
            abilityTimers.overdrive > 0 &&
            Math.random() < 0.6
        ) {

            spawnParticle({
                x: player.x,
                y: player.y,

                angle:
                    Math.atan2(
                        moveY,
                        moveX
                    ) +
                    Math.PI,

                speed: 1,

                size:
                    Math.random() *
                    3 +
                    1,

                color: "#f4a261",

                life: 0.5
            });
        }
    }

    socket.emit(
        "move",
        {
            x: player.x,
            y: player.y
        }
    );
}

// ============================================================
// RENDER PLAYER INTERPOLATION
// ============================================================

function updateRenderPlayers(dt) {

    for (
        const [id, player]
        of Object.entries(
            state.players
        )
    ) {

        if (
            !renderPlayers[id]
        ) {

            renderPlayers[id] = {
                x: player.x,
                y: player.y,
                health: player.health,
                angle: 0,
                pulse:
                    Math.random() * 10,
                hurt: 0,
                scale: 1,
                lastHealth:
                    player.health
            };
        }

        const visual =
            renderPlayers[id];

        const oldX =
            visual.x;

        const oldY =
            visual.y;

        visual.x +=
            (
                player.x -
                visual.x
            ) *
            0.3;

        visual.y +=
            (
                player.y -
                visual.y
            ) *
            0.3;

        visual.health +=
            (
                player.health -
                visual.health
            ) *
            0.18;

        visual.hurt *=
            0.86;

        visual.pulse +=
            dt * 4;

        const vx =
            visual.x -
            oldX;

        const vy =
            visual.y -
            oldY;

        if (
            Math.abs(vx) +
            Math.abs(vy) >
            0.01
        ) {

            visual.angle =
                Math.atan2(
                    vy,
                    vx
                );
        }

        if (
            player.health <
            visual.lastHealth
        ) {

            visual.hurt = 1;
        }

        visual.lastHealth =
            player.health;
    }

    for (
        const id of
        Object.keys(
            renderPlayers
        )
    ) {

        if (
            !state.players[id]
        ) {

            delete renderPlayers[id];
        }
    }
}

// ============================================================
// CAMERA
// ============================================================

function updateCamera() {

    const player =
        renderPlayers[myId] ||
        state.players[myId];

    if (!player) {
        return;
    }

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    camera.targetX =
        player.x -
        width / 2;

    camera.targetY =
        player.y -
        height / 2;

    camera.targetX =
        Math.max(
            0,
            Math.min(
                WORLD_WIDTH -
                    width,
                camera.targetX
            )
        );

    camera.targetY =
        Math.max(
            0,
            Math.min(
                WORLD_HEIGHT -
                    height,
                camera.targetY
            )
        );

    camera.x +=
        (
            camera.targetX -
            camera.x
        ) *
        0.12;

    camera.y +=
        (
            camera.targetY -
            camera.y
        ) *
        0.12;

    camera.shake *= 0.88;

    camera.zoom +=
        (
            1 -
            camera.zoom
        ) *
        0.08;

    if (
        camera.shake < 0.05
    ) {
        camera.shake = 0;
    }
}

function updateMouseWorld() {

    mouse.worldX =
        camera.x +
        mouse.x /
        camera.zoom;

    mouse.worldY =
        camera.y +
        mouse.y /
        camera.zoom;
}

// ============================================================
// PARTICLES
// ============================================================

function spawnParticle(
    options = {}
) {

    if (
        particles.length >=
        PARTICLE_LIMIT
    ) {

        particles.splice(
            0,
            Math.floor(
                PARTICLE_LIMIT *
                0.05
            )
        );
    }

    const angle =
        options.angle ??
        Math.random() *
        Math.PI *
        2;

    const speed =
        options.speed ??
        Math.random() *
        4 +
        1;

    particles.push({
        x:
            options.x ?? 0,

        y:
            options.y ?? 0,

        vx:
            Math.cos(angle) *
            speed,

        vy:
            Math.sin(angle) *
            speed,

        size:
            options.size ??
            Math.random() *
            3 +
            1,

        life:
            options.life ??
            1,

        maxLife:
            options.life ??
            1,

        color:
            options.color ??
            "#ffffff",

        gravity:
            options.gravity ??
            0,

        drag:
            options.drag ??
            0.96,

        glow:
            options.glow ??
            true
    });
}

function updateParticles(dt) {

    for (
        let i =
            particles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            particles[i];

        p.x += p.vx;
        p.y += p.vy;

        p.vx *= p.drag;
        p.vy *= p.drag;

        p.vy += p.gravity;

        p.life -=
            dt * 2.5;

        if (
            p.life <= 0
        ) {

            particles.splice(
                i,
                1
            );
        }
    }
}

function drawParticles() {

    ctx.save();

    for (
        const p of particles
    ) {

        const alpha =
            Math.max(
                0,
                p.life /
                p.maxLife
            );

        ctx.globalAlpha =
            alpha;

        if (p.glow) {

            ctx.shadowBlur = 14;

            ctx.shadowColor =
                p.color;
        }

        ctx.fillStyle =
            p.color;

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            p.size * alpha,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

// ============================================================
// BURSTS
// ============================================================

function burst(
    x,
    y,
    color,
    power = 1
) {

    shockwaves.push({
        x,
        y,
        radius: 5,
        maxRadius:
            75 * power,
        life: 1,
        color,
        width: 5
    });

    // ============================================================
// BURSTS (Continued)
// ============================================================

    for (
        let i = 0;
        i < 60 * power;
        i++
    ) {
        const angle =
            Math.random() *
            Math.PI *
            2;

        spawnParticle({
            x,
            y,
            angle,
            speed:
                Math.random() *
                8 *
                power +
                2,
            size:
                Math.random() *
                4 +
                1,
            color,
            life:
                Math.random() *
                0.8 +
                0.2
        });
    }
}

// ============================================================
// SHOCKWAVES
// ============================================================

function updateShockwaves(dt) {

    for (
        let i =
            shockwaves.length - 1;
        i >= 0;
        i--
    ) {

        const s =
            shockwaves[i];

        s.radius +=
            (
                s.maxRadius -
                s.radius
            ) *
            0.16;

        s.life -=
            dt * 2;

        if (
            s.life <= 0
        ) {

            shockwaves.splice(
                i,
                1
            );
        }
    }
}

function drawShockwaves() {

    ctx.save();

    for (
        const s of shockwaves
    ) {

        ctx.globalAlpha =
            s.life * 0.9;

        ctx.strokeStyle =
            s.color;

        ctx.lineWidth =
            s.width || 4;

        ctx.shadowBlur = 25;

        ctx.shadowColor =
            s.color;

        ctx.beginPath();

        ctx.arc(
            s.x,
            s.y,
            s.radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    ctx.restore();
}

// ============================================================
// RINGS
// ============================================================

function updateRings(dt) {

    for (
        let i =
            rings.length - 1;
        i >= 0;
        i--
    ) {

        const r =
            rings[i];

        r.radius +=
            (
                r.maxRadius -
                r.radius
            ) *
            0.12;

        r.life -=
            dt * 1.8;

        if (
            r.life <= 0
        ) {

            rings.splice(
                i,
                1
            );
        }
    }
}

function drawRings() {

    ctx.save();

    for (
        const r of rings
    ) {

        ctx.globalAlpha =
            r.life;

        ctx.strokeStyle =
            r.color;

        ctx.lineWidth = 4;

        ctx.shadowBlur = 20;

        ctx.shadowColor =
            r.color;

        ctx.beginPath();

        ctx.arc(
            r.x,
            r.y,
            r.radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    ctx.restore();
}

// ============================================================
// BULLET TRAILS
// ============================================================

function updateBulletTrails() {

    for (
        const bullet of
        state.bullets
    ) {

        bulletTrails.push({
            x: bullet.x,
            y: bullet.y,
            owner: bullet.owner,
            life: 1
        });
    }

    if (
        bulletTrails.length >
        TRAIL_LIMIT
    ) {

        bulletTrails.splice(
            0,
            bulletTrails.length -
                TRAIL_LIMIT
        );
    }

    for (
        let i =
            bulletTrails.length - 1;
        i >= 0;
        i--
    ) {

        bulletTrails[i].life -=
            0.12;

        if (
            bulletTrails[i].life <= 0
        ) {

            bulletTrails.splice(
                i,
                1
            );
        }
    }
}

function drawBulletTrails() {

    ctx.save();

    for (
        const trail of
        bulletTrails
    ) {

        const color =
            trail.owner === myId
                ? "#f4b942"
                : "#ef476f";

        ctx.globalAlpha =
            trail.life *
            0.45;

        ctx.fillStyle =
            color;

        ctx.shadowBlur = 15;

        ctx.shadowColor =
            color;

        ctx.beginPath();

        ctx.arc(
            trail.x,
            trail.y,
            trail.life * 4,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

// ============================================================
// MUZZLE PARTICLES
// ============================================================

function createMuzzleParticles(
    x,
    y,
    angle
) {

    for (
        let i = 0;
        i < 22;
        i++
    ) {

        spawnParticle({
            x,
            y,

            angle:
                angle +
                (
                    Math.random() -
                    0.5
                ) *
                0.8,

            speed:
                Math.random() *
                8 +
                2,

            size:
                Math.random() *
                3 +
                1,

            life:
                Math.random() *
                0.35 +
                0.15,

            color:
                Math.random() >
                0.3
                    ? "#f4b942"
                    : "#ffffff",

            gravity: 0.04
        });
    }
}

// ============================================================
// MUZZLE FLASH
// ============================================================

function updateMuzzleFlashes(dt) {

    for (
        let i =
            muzzleFlashes.length - 1;
        i >= 0;
        i--
    ) {

        muzzleFlashes[i].life -=
            dt * 9;

        if (
            muzzleFlashes[i].life <= 0
        ) {

            muzzleFlashes.splice(
                i,
                1
            );
        }
    }
}

function drawMuzzleFlashes() {

    ctx.save();

    for (
        const flash of
        muzzleFlashes
    ) {

        const size =
            30 +
            (
                1 -
                flash.life
            ) *
            15;

        ctx.globalAlpha =
            flash.life;

        ctx.translate(
            flash.x -
                Math.cos(
                    flash.angle
                ) *
                recoil.amount *
                0.55,

            flash.y -
                Math.sin(
                    flash.angle
                ) *
                recoil.amount *
                0.55
        );

        ctx.rotate(
            flash.angle
        );

        ctx.fillStyle =
            "#fff3a3";

        ctx.shadowBlur = 35;

        ctx.shadowColor =
            "#f4a261";

        ctx.beginPath();

        ctx.moveTo(
            size,
            0
        );

        ctx.lineTo(
            -size * 0.3,
            -size * 0.4
        );

        ctx.lineTo(
            -size * 0.12,
            0
        );

        ctx.lineTo(
            -size * 0.3,
            size * 0.4
        );

        ctx.closePath();

        ctx.fill();

        ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );
    }

    ctx.restore();
}

// ============================================================
// AFTER IMAGES
// ============================================================

function updateAfterImages(dt) {

    for (
        let i =
            afterImages.length - 1;
        i >= 0;
        i--
    ) {

        afterImages[i].life -=
            dt * 2;

        if (
            afterImages[i].life <= 0
        ) {

            afterImages.splice(
                i,
                1
            );
        }
    }
}

function drawAfterImages() {

    ctx.save();

    for (
        const image of
        afterImages
    ) {

        ctx.globalAlpha =
            image.life * 0.5;

        ctx.fillStyle =
            "#00a8ff";

        ctx.shadowBlur = 30;

        ctx.shadowColor =
            "#00a8ff";

        ctx.beginPath();

        ctx.arc(
            image.x,
            image.y,
            20,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

// ============================================================
// WORLD
// ============================================================

function drawWorld() {

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    const gradient =
        ctx.createLinearGradient(
            camera.x,
            camera.y,
            camera.x,
            camera.y +
                height
        );

    gradient.addColorStop(
        0,
        "#ffffff"
    );

    gradient.addColorStop(
        0.5,
        "#f7f9fb"
    );

    gradient.addColorStop(
        1,
        "#e8edf2"
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        camera.x,
        camera.y,
        width,
        height
    );

    drawArenaGrid();

    drawWorldDecorations();

    drawObstacles();
}

// ============================================================
// GRID
// ============================================================

function drawArenaGrid() {

    const size = 100;

    const startX =
        Math.floor(
            camera.x / size
        ) *
        size;

    const startY =
        Math.floor(
            camera.y / size
        ) *
        size;

    ctx.lineWidth = 1;

    for (
        let x = startX;
        x <=
        camera.x +
            window.innerWidth;
        x += size
    ) {

        ctx.strokeStyle =
            "rgba(50,65,85,0.07)";

        ctx.beginPath();

        ctx.moveTo(
            x,
            camera.y
        );

        ctx.lineTo(
            x,
            camera.y +
                window.innerHeight
        );

        ctx.stroke();
    }

    for (
        let y = startY;
        y <=
        camera.y +
            window.innerHeight;
        y += size
    ) {

        ctx.strokeStyle =
            "rgba(50,65,85,0.07)";

        ctx.beginPath();

        ctx.moveTo(
            camera.x,
            y
        );

        ctx.lineTo(
            camera.x +
                window.innerWidth,
            y
        );

        ctx.stroke();
    }

    for (
        let x = startX;
        x <=
        camera.x +
            window.innerWidth;
        x +=
            size * 5
    ) {

        ctx.strokeStyle =
            "rgba(50,65,85,0.14)";

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.moveTo(
            x,
            camera.y
        );

        ctx.lineTo(
            x,
            camera.y +
                window.innerHeight
        );

        ctx.stroke();
    }

    for (
        let y = startY;
        y <=
        camera.y +
            window.innerHeight;
        y +=
            size * 5
    ) {

        ctx.strokeStyle =
            "rgba(50,65,85,0.14)";

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.moveTo(
            camera.x,
            y
        );

        ctx.lineTo(
            camera.x +
                window.innerWidth,
            y
        );

        ctx.stroke();
    }

    // Arena border
    ctx.strokeStyle =
        "rgba(40,50,65,0.45)";

    ctx.lineWidth = 5;

    ctx.shadowBlur = 18;

    ctx.shadowColor =
        "rgba(0,0,0,0.12)";

    ctx.strokeRect(
        0,
        0,
        WORLD_WIDTH,
        WORLD_HEIGHT
    );

    ctx.shadowBlur = 0;
}

// ============================================================
// WORLD DECORATIONS
// ============================================================

function drawWorldDecorations() {

    const points = [
        [500, 500],
        [
            WORLD_WIDTH - 500,
            500
        ],
        [
            500,
            WORLD_HEIGHT - 500
        ],
        [
            WORLD_WIDTH - 500,
            WORLD_HEIGHT - 500
        ],
        [
            WORLD_WIDTH / 2,
            WORLD_HEIGHT / 2
        ]
    ];

    for (
        const [x, y] of points
    ) {

        if (
            x <
                camera.x - 200 ||
            x >
                camera.x +
                    window.innerWidth +
                    200 ||
            y <
                camera.y - 200 ||
            y >
                camera.y +
                    window.innerHeight +
                    200
        ) {
            continue;
        }

        ctx.save();

        ctx.globalAlpha =
            0.25;

        ctx.strokeStyle =
            "#9aa7b5";

        ctx.lineWidth = 2;

        ctx.shadowBlur = 15;

        ctx.shadowColor =
            "rgba(0,0,0,0.12)";

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            80 +
                Math.sin(
                    time * 2 + x
                ) *
                8,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            55,
            time,
            time + Math.PI
        );

        ctx.stroke();

        ctx.restore();
    }
}

// ============================================================
// OBSTACLES
// ============================================================

function drawObstacles() {

    for (
        const obstacle of
        obstacles
    ) {

        ctx.save();

        ctx.fillStyle =
            "rgba(255,255,255,0.96)";

        ctx.strokeStyle =
            "#aeb8c4";

        ctx.lineWidth = 2;

        ctx.shadowBlur = 16;

        ctx.shadowColor =
            "rgba(0,0,0,0.12)";

        roundRect(
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height,
            12
        );

        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.strokeStyle =
            "rgba(80,95,110,0.28)";

        ctx.lineWidth = 1;

        roundRect(
            obstacle.x + 8,
            obstacle.y + 8,
            obstacle.width - 16,
            obstacle.height - 16,
            8
        );

        ctx.stroke();

        ctx.strokeStyle =
            "rgba(80,95,110,0.18)";

        ctx.beginPath();

        if (
            obstacle.width >
            obstacle.height
        ) {

            ctx.moveTo(
                obstacle.x + 20,
                obstacle.y +
                    obstacle.height /
                        2
            );

            ctx.lineTo(
                obstacle.x +
                    obstacle.width -
                    20,

                obstacle.y +
                    obstacle.height /
                        2
            );

        } else {

            ctx.moveTo(
                obstacle.x +
                    obstacle.width /
                        2,

                obstacle.y + 20
            );

            ctx.lineTo(
                obstacle.x +
                    obstacle.width /
                        2,

                obstacle.y +
                    obstacle.height -
                    20
            );
        }

        ctx.stroke();

        ctx.restore();
    }

    // Small blocks
    for (
        const block of
        obstacleBlocks
    ) {

        ctx.save();

        ctx.fillStyle =
            "#eef1f5";

        ctx.strokeStyle =
            "#aeb8c4";

        ctx.lineWidth = 2;

        ctx.shadowBlur = 12;

        ctx.shadowColor =
            "rgba(0,0,0,0.1)";

        roundRect(
            block.x,
            block.y,
            block.size,
            block.size,
            10
        );

        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.strokeStyle =
            "rgba(80,95,110,0.25)";

        ctx.beginPath();

        ctx.moveTo(
            block.x + 12,
            block.y + 12
        );

        ctx.lineTo(
            block.x +
                block.size -
                12,

            block.y +
                block.size -
                12
        );

        ctx.moveTo(
            block.x +
                block.size -
                12,

            block.y + 12
        );

        ctx.lineTo(
            block.x + 12,

            block.y +
                block.size -
                12
        );

        ctx.stroke();

        ctx.restore();
    }
}

// ============================================================
// PLAYER
// ============================================================

function drawPlayer(
    id,
    player
) {

    const visual =
        renderPlayers[id];

    if (!visual) {
        return;
    }

    const x =
        visual.x;

    const y =
        visual.y;

    const isMe =
        id === myId;

    const primary =
        isMe
            ? "#00a8ff"
            : "#ef476f";

    const secondary =
        isMe
            ? "#0077cc"
            : "#d62839";

    const overdrive =
        abilityTimers.overdrive > 0 &&
        isMe;

    // Shadow
    ctx.save();

    ctx.globalAlpha = 0.18;

    ctx.fillStyle =
        "#000000";

    ctx.beginPath();

    ctx.ellipse(
        x,
        y + 17,
        30,
        10,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    // Overdrive ring
    if (overdrive) {

        ctx.save();

        ctx.globalAlpha =
            0.4 +
            Math.sin(
                time * 10
            ) *
            0.15;

        ctx.strokeStyle =
            "#f4a261";

        ctx.lineWidth = 5;

        ctx.shadowBlur = 30;

        ctx.shadowColor =
            "#f4a261";

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            36 +
                Math.sin(
                    time * 8
                ) *
                5,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.restore();
    }

    // Tank glow
    ctx.save();

    const pulse =
        1 +
        Math.sin(
            visual.pulse
        ) *
        0.06;

    ctx.globalAlpha =
        0.18;

    ctx.fillStyle =
        primary;

    ctx.shadowBlur = 35;

    ctx.shadowColor =
        primary;

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        30 * pulse,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    // Tank rotation
    const dx =
        mouse.worldX - x;

    const dy =
        mouse.worldY - y;

    const angle =
        Math.atan2(
            dy,
            dx
        );

    // Tank recoil position
    const recoilOffset =
        recoil.amount;

    const tankX =
        x -
        Math.cos(angle) *
        recoilOffset;

    const tankY =
        y -
        Math.sin(angle) *
        recoilOffset;

    // Tank sprite
    ctx.save();

    ctx.translate(
        tankX,
        tankY
    );

    ctx.rotate(
        angle
    );

    // White glow underneath sprite
    ctx.globalAlpha =
        0.2;

    ctx.fillStyle =
        primary;

    ctx.shadowBlur = 30;

    ctx.shadowColor =
        primary;

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        30,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha = 1;

    if (tankImageReady) {

        const tankSize = 68;

        ctx.drawImage(
            tankImage,
            -tankSize / 2,
            -tankSize / 2,
            tankSize,
            tankSize
        );

    } else {

        // Fallback tank
        ctx.fillStyle =
            "#e8edf2";

        ctx.strokeStyle =
            primary;

        ctx.lineWidth = 3;

        roundRect(
            -22,
            -16,
            44,
            32,
            8
        );

        ctx.fill();
        ctx.stroke();

        ctx.fillStyle =
            "#9aa7b5";

        ctx.fillRect(
            0,
            -4,
            27,
            8
        );
    }

    ctx.restore();

    // Damage flash
    if (
        visual.hurt > 0.1
    ) {

        ctx.save();

        ctx.globalAlpha =
            visual.hurt *
            0.4;

        ctx.fillStyle =
            "#ffffff";

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            28,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }

    // Health
    drawHealthBar(
        x,
        y,
        visual.health
    );

    // Name
    ctx.save();

    ctx.font =
        "700 13px Inter,system-ui,sans-serif";

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "#26313d";

    ctx.shadowBlur = 5;

    ctx.shadowColor =
        "#ffffff";

    ctx.fillText(
        `${player.name}`,
        x,
        y - 48
    );

    if (player.level) {

        ctx.font =
            "600 10px Inter,system-ui,sans-serif";

        ctx.fillStyle =
            primary;

        ctx.fillText(
            `LVL ${player.level}`,
            x,
            y - 58
        );
    }

    ctx.restore();
}

// ============================================================
// HEALTH BAR
// ============================================================

function drawHealthBar(
    x,
    y,
    health
) {

    const width = 52;
    const height = 6;

    const bx =
        x -
        width / 2;

    const by =
        y - 37;

    ctx.fillStyle =
        "rgba(25,35,45,0.2)";

    roundRect(
        bx,
        by,
        width,
        height,
        3
    );

    ctx.fill();

    const amount =
        Math.max(
            0,
            Math.min(
                100,
                health || 0
            )
        );

    const color =
        amount > 60
            ? "#20c997"
            : amount > 30
                ? "#f4b942"
                : "#ef476f";

    ctx.fillStyle =
        color;

    ctx.shadowBlur = 8;

    ctx.shadowColor =
        color;

    roundRect(
        bx,
        by,
        width *
            amount /
            100,
        height,
        3
    );

    ctx.fill();

    ctx.shadowBlur = 0;
}

// ============================================================
// PLAYER BULLETS
// ============================================================

function drawBullets() {

    for (
        const bullet of
        state.bullets
    ) {

        const color =
            bullet.owner === myId
                ? "#f4b942"
                : "#ef476f";

        ctx.save();

        ctx.fillStyle =
            color;

        ctx.shadowBlur = 25;

        ctx.shadowColor =
            color;

        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            5,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            "#ffffff";

        ctx.beginPath();

        ctx.arc(
            bullet.x - 1,
            bullet.y - 1,
            2,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}
// ============================================================
// PLAYER BULLET DAMAGE TO BOTS
// ============================================================

function updatePlayerBulletDamage() {

    for (const bullet of state.bullets) {

        // Create a unique-ish ID for the bullet.
        // If your server already sends bullet.id, that is preferred.
        const bulletId =
            bullet.id ??
            `${bullet.owner}_${bullet.x.toFixed(1)}_${bullet.y.toFixed(1)}`;

        // Only bullets fired by this client damage local bots.
        if (bullet.owner !== myId) {
            continue;
        }

        if (bulletHitRegistry.has(bulletId)) {
            continue;
        }

        for (const bot of bots) {

            if (bot.health <= 0) {
                continue;
            }

            const distance = Math.hypot(
                bot.x - bullet.x,
                bot.y - bullet.y
            );

            if (distance <= PLAYER_RADIUS + 5) {

                bulletHitRegistry.add(bulletId);

                const damage =
                    abilityTimers.overdrive > 0
                        ? PLAYER_BULLET_DAMAGE * 1.5
                        : PLAYER_BULLET_DAMAGE;

                bot.health = Math.max(
                    0,
                    bot.health - damage
                );

                // Damage visual
                addDamageNumber(
                    bot.x,
                    bot.y - 25,
                    Math.round(damage)
                );

                burst(
                    bot.x,
                    bot.y,
                    "#ef476f",
                    0.6
                );

                addHitMarker(
                    bot.x,
                    bot.y
                );

                camera.shake += 3;

                // Track local damage
                localStats.damage += damage;

                // Bot died
                if (bot.health <= 0) {

                    localStats.kills++;
                    localStats.streak++;
                    localStats.bestStreak =
                        Math.max(
                            localStats.bestStreak,
                            localStats.streak
                        );

                    triggerKillCelebration();

                    burst(
                        bot.x,
                        bot.y,
                        "#f4b942",
                        2
                    );

                    createFloatingText(
                        bot.x,
                        bot.y - 50,
                        "ELIMINATED",
                        "#d58b00"
                    );
                }

                break;
            }
        }
    }

    // Prevent registry from growing forever.
    if (bulletHitRegistry.size > 2000) {
        bulletHitRegistry.clear();
    }
}

// ============================================================
// BOTS
// ============================================================
// ============================================================
// DAMAGE
// ============================================================

const PLAYER_BULLET_DAMAGE = 25;
const BOT_BULLET_DAMAGE = 10;

const bulletHitRegistry = new Set();

function updateBots(dt) {

    const player =
        renderPlayers[myId] ||
        state.players[myId];

    if (!player) {
        return;
    }

    for (
        const bot of bots
    ) {

        if (
            bot.health <= 0
        ) {
            continue;
        }

        const dx =
            player.x -
            bot.x;

        const dy =
            player.y -
            bot.y;

        const distance =
            Math.hypot(
                dx,
                dy
            );

        if (distance < 1) {
            continue;
        }

        bot.angle =
            Math.atan2(
                dy,
                dx
            );

        // Follow player while keeping distance
        if (
            distance > 450
        ) {

            const moveX =
                Math.cos(
                    bot.angle
                ) *
                bot.speed;

            const moveY =
                Math.sin(
                    bot.angle
                ) *
                bot.speed;

            const nextX =
                bot.x + moveX;

            const nextY =
                bot.y + moveY;

            if (
                !collidesWithObstacle(
                    nextX,
                    nextY,
                    22
                )
            ) {

                bot.x = nextX;
                bot.y = nextY;
            }
        }

        // Back away if too close
        if (
            distance < 250
        ) {

            const moveX =
                Math.cos(
                    bot.angle
                ) *
                -bot.speed;

            const moveY =
                Math.sin(
                    bot.angle
                ) *
                -bot.speed;

            const nextX =
                bot.x + moveX;

            const nextY =
                bot.y + moveY;

            if (
                !collidesWithObstacle(
                    nextX,
                    nextY,
                    22
                )
            ) {

                bot.x = nextX;
                bot.y = nextY;
            }
        }

        // Fire
        bot.fireTimer -= dt;

        if (
            bot.fireTimer <= 0 &&
            distance < 1000
        ) {

            bot.fireTimer =
                1.2 +
                Math.random() *
                1.5;

            const spread =
                (
                    Math.random() -
                    0.5
                ) *
                0.08;

            const shotAngle =
                bot.angle +
                spread;

            botBullets.push({
                x:
                    bot.x +
                    Math.cos(
                        shotAngle
                    ) *
                    28,

                y:
                    bot.y +
                    Math.sin(
                        shotAngle
                    ) *
                    28,

                vx:
                    Math.cos(
                        shotAngle
                    ) *
                    7,

                vy:
                    Math.sin(
                        shotAngle
                    ) *
                    7,

                life: 1.5
            });

            muzzleFlashes.push({
                x:
                    bot.x +
                    Math.cos(
                        shotAngle
                    ) *
                    28,

                y:
                    bot.y +
                    Math.sin(
                        shotAngle
                    ) *
                    28,

                angle: shotAngle,
                life: 1
            });

            createMuzzleParticles(
                bot.x +
                    Math.cos(
                        shotAngle
                    ) *
                    28,

                bot.y +
                    Math.sin(
                        shotAngle
                    ) *
                    28,

                shotAngle
            );
        }
    }
}

// ============================================================
// BOT BULLETS
// ============================================================

function updateBotBullets(dt) {

    for (
        let i =
            botBullets.length - 1;
        i >= 0;
        i--
    ) {

        const bullet =
            botBullets[i];

        bullet.x +=
            bullet.vx;

        bullet.y +=
            bullet.vy;

        bullet.life -= dt;

        // Obstacle collision
        if (
            collidesWithObstacle(
                bullet.x,
                bullet.y,
                4
            )
        ) {

            burst(
                bullet.x,
                bullet.y,
                "#ef476f",
                0.35
            );

            botBullets.splice(
                i,
                1
            );

            continue;
        }

        const player =
            renderPlayers[myId] ||
            state.players[myId];

        if (player) {

            const distance =
                Math.hypot(
                    player.x -
                        bullet.x,

                    player.y -
                        bullet.y
                );

            if (
    distance <
    PLAYER_RADIUS
) {

    const damage =
        BOT_BULLET_DAMAGE;

    // Apply damage to local player
    if (
        typeof player.health === "number"
    ) {

        player.health = Math.max(
            0,
            player.health - damage
        );
    }

    // Visual feedback
    burst(
        bullet.x,
        bullet.y,
        "#ef476f",
        0.5
    );

    addDamageNumber(
        player.x,
        player.y - 25,
        damage
    );

    screenFlash = 0.8;

    camera.shake += 5;

    // Hurt animation
    const visual =
        renderPlayers[myId];

    if (visual) {
        visual.hurt = 1;
    }

    // Player died
    if (
        player.health <= 0
    ) {

        localStats.deaths++;

        localStats.streak = 0;

        triggerDeathEffect();

        // Respawn locally after a short delay
        setTimeout(() => {

            const currentPlayer =
                state.players[myId];

            if (!currentPlayer) {
                return;
            }

            currentPlayer.health = 100;

            currentPlayer.x =
                WORLD_WIDTH / 2;

            currentPlayer.y =
                WORLD_HEIGHT / 2;

        }, 1500);
    }

    botBullets.splice(
        i,
        1
    );

    continue;
}

        }

        if (
            bullet.life <= 0 ||
            bullet.x < 0 ||
            bullet.y < 0 ||
            bullet.x >
                WORLD_WIDTH ||
            bullet.y >
                WORLD_HEIGHT
        ) {

            botBullets.splice(
                i,
                1
            );
        }
    }
}

function drawBotBullets() {

    ctx.save();

    for (
        const bullet of
        botBullets
    ) {

        ctx.fillStyle =
            "#ef476f";

        ctx.shadowBlur = 18;

        ctx.shadowColor =
            "#ef476f";

        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            5,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

// ============================================================
// DRAW BOTS
// ============================================================

function drawBots() {

    for (
        const bot of bots
    ) {

        if (
            bot.health <= 0
        ) {
            continue;
        }

        const x =
            bot.x;

        const y =
            bot.y;

        ctx.save();

        // Shadow
        ctx.fillStyle =
            "rgba(0,0,0,0.16)";

        ctx.beginPath();

        ctx.ellipse(
            x,
            y + 18,
            28,
            9,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        // Tank
        ctx.translate(
            x,
            y
        );

        ctx.rotate(
            bot.angle
        );

        // Enemy glow
        ctx.globalAlpha = 0.16;

        ctx.fillStyle =
            bot.color;

        ctx.shadowBlur = 30;

        ctx.shadowColor =
            bot.color;

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            34,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.globalAlpha = 1;

        if (tankImageReady) {

            const tankSize = 68;

            ctx.drawImage(
                tankImage,
                -tankSize / 2,
                -tankSize / 2,
                tankSize,
                tankSize
            );

        } else {

            ctx.fillStyle =
                "#ffe3e7";

            ctx.strokeStyle =
                bot.color;

            ctx.lineWidth = 3;

            roundRect(
                -22,
                -16,
                44,
                32,
                8
            );

            ctx.fill();
            ctx.stroke();

            ctx.fillStyle =
                bot.color;

            ctx.fillRect(
                0,
                -4,
                27,
                8
            );
        }

        ctx.restore();

        // Bot health
        const hp =
            Math.max(
                0,
                bot.health /
                    bot.maxHealth
            );

        ctx.fillStyle =
            "rgba(25,35,45,0.18)";

        roundRect(
            x - 27,
            y - 43,
            54,
            6,
            3
        );

        ctx.fill();

        ctx.fillStyle =
            bot.color;

        roundRect(
            x - 27,
            y - 43,
            54 * hp,
            6,
            3
        );

        ctx.fill();

        // Name
        ctx.save();

        ctx.font =
            "700 10px Inter,system-ui,sans-serif";

        ctx.textAlign =
            "center";

        ctx.fillStyle =
            "#4b5563";

        ctx.fillText(
            bot.name,
            x,
            y - 50
        );

        ctx.restore();
    }
}

// ============================================================
// DAMAGE NUMBERS
// ============================================================

function addDamageNumber(
    x,
    y,
    amount
) {

    damageNumbers.push({
        x,
        y,
        amount,
        life: 1,
        vy: -1.5
    });
}

function updateDamageNumbers(dt) {

    for (
        let i =
            damageNumbers.length - 1;
        i >= 0;
        i--
    ) {

        const d =
            damageNumbers[i];

        d.y += d.vy;

        d.vy *= 0.96;

        d.life -=
            dt * 1.7;

        if (
            d.life <= 0
        ) {

            damageNumbers.splice(
                i,
                1
            );
        }
    }
}

function drawDamageNumbers() {

    ctx.save();

    ctx.textAlign =
        "center";

    ctx.font =
        "900 19px Inter,system-ui,sans-serif";

    for (
        const d of
        damageNumbers
    ) {

        ctx.globalAlpha =
            d.life;

        ctx.fillStyle =
            "#ef476f";

        ctx.strokeStyle =
            "#ffffff";

        ctx.lineWidth = 4;

        ctx.strokeText(
            `-${d.amount}`,
            d.x,
            d.y
        );

        ctx.fillText(
            `-${d.amount}`,
            d.x,
            d.y
        );
    }

    ctx.restore();
}

// ============================================================
// FLOATING TEXT
// ============================================================

function createFloatingText(
    x,
    y,
    text,
    color = "#26313d"
) {

    floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1
    });
}

function updateFloatingTexts(dt) {

    for (
        let i =
            floatingTexts.length - 1;
        i >= 0;
        i--
    ) {

        const text =
            floatingTexts[i];

        text.y -= 0.7;

        text.life -= dt;

        if (
            text.life <= 0
        ) {

            floatingTexts.splice(
                i,
                1
            );
        }
    }
}

function drawFloatingTexts() {

    ctx.save();

    ctx.textAlign =
        "center";

    ctx.font =
        "900 25px Inter,system-ui,sans-serif";

    for (
        const text of
        floatingTexts
    ) {

        ctx.globalAlpha =
            Math.min(
                1,
                text.life * 2
            );

        ctx.fillStyle =
            text.color;

        ctx.shadowBlur = 15;

        ctx.shadowColor =
            "#ffffff";

        ctx.fillText(
            text.text,
            text.x,
            text.y
        );
    }

    ctx.restore();
}

// ============================================================
// HIT MARKERS
// ============================================================

function addHitMarker(
    x,
    y
) {

    hitMarkers.push({
        x,
        y,
        life: 1
    });
}

function updateHitMarkers(dt) {

    for (
        let i =
            hitMarkers.length - 1;
        i >= 0;
        i--
    ) {

        hitMarkers[i].life -=
            dt * 6;

        if (
            hitMarkers[i].life <= 0
        ) {

            hitMarkers.splice(
                i,
                1
            );
        }
    }
}

function drawHitMarkers() {

    ctx.save();

    for (
        const hit of
        hitMarkers
    ) {

        ctx.globalAlpha =
            hit.life;

        ctx.strokeStyle =
            "#ffffff";

        ctx.lineWidth = 3;

        const size = 13;

        for (
            let i = 0;
            i < 4;
            i++
        ) {

            const angle =
                i *
                Math.PI /
                2;

            ctx.beginPath();

            ctx.moveTo(
                hit.x +
                    Math.cos(
                        angle
                    ) *
                    4,

                hit.y +
                    Math.sin(
                        angle
                    ) *
                    4
            );

            ctx.lineTo(
                hit.x +
                    Math.cos(
                        angle
                    ) *
                    size,

                hit.y +
                    Math.sin(
                        angle
                    ) *
                    size
            );

            ctx.stroke();
        }
    }

    ctx.restore();
}

// ============================================================
// CROSSHAIR
// ============================================================

function drawCrosshair() {

    const x =
        mouse.x;

    const y =
        mouse.y;

    ctx.save();

    ctx.translate(
        x,
        y
    );

    const pulse =
        1 +
        Math.sin(
            time * 8
        ) *
        0.08;

    ctx.scale(
        pulse,
        pulse
    );

    ctx.strokeStyle =
        "rgba(30,40,50,0.9)";

    ctx.lineWidth = 2;

    ctx.shadowBlur = 8;

    ctx.shadowColor =
        "#ffffff";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        10,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        -19,
        0
    );

    ctx.lineTo(
        -6,
        0
    );

    ctx.moveTo(
        6,
        0
    );

    ctx.lineTo(
        19,
        0
    );

    ctx.moveTo(
        0,
        -19
    );

    ctx.lineTo(
        0,
        -6
    );

    ctx.moveTo(
        0,
        6
    );

    ctx.lineTo(
        0,
        19
    );

    ctx.stroke();

    ctx.restore();
}

// ============================================================
// LEADERBOARD
// ============================================================

function getLeaderboard() {

    if (
        Array.isArray(
            state.leaderboard
        ) &&
        state.leaderboard.length
    ) {

        return [
            ...state.leaderboard
        ].sort(
            (a, b) =>
                (b.kills || 0) -
                (a.kills || 0)
        );
    }

    return Object.entries(
        state.players
    )
        .map(
            ([id, player]) => ({
                id,
                name:
                    player.name,
                kills:
                    player.kills || 0,
                deaths:
                    player.deaths || 0,
                damage:
                    player.damage || 0,
                level:
                    player.level || 1,
                streak:
                    player.streak || 0
            })
        )
        .sort(
            (a, b) =>
                b.kills -
                a.kills
        );
}

function drawLeaderboard() {

    if (!leaderboardVisible) {
        return;
    }

    const leaderboard =
        getLeaderboard();

    const width = 270;

    const x =
        window.innerWidth -
        width -
        20;

    const y = 20;

    const rowHeight = 34;

    const height =
        62 +
        Math.min(
            8,
            leaderboard.length
        ) *
        rowHeight;

    ctx.save();

    ctx.fillStyle =
        "rgba(255,255,255,0.94)";

    ctx.strokeStyle =
        "rgba(70,85,100,0.25)";

    ctx.lineWidth = 1;

    roundRect(
        x,
        y,
        width,
        height,
        14
    );

    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 20;

    ctx.shadowColor =
        "rgba(0,0,0,0.1)";

    ctx.strokeStyle =
        "rgba(70,85,100,0.12)";

    roundRect(
        x,
        y,
        width,
        height,
        14
    );

    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.font =
        "900 16px Inter,system-ui,sans-serif";

    ctx.textAlign =
        "left";

    ctx.fillStyle =
        "#26313d";

    ctx.fillText(
        "🏆  LEADERBOARD",
        x + 16,
        y + 25
    );

    ctx.font =
        "600 10px Inter,system-ui,sans-serif";

    ctx.fillStyle =
        "#7b8794";

    ctx.fillText(
        "TOP PLAYERS",
        x + 16,
        y + 43
    );

    leaderboard
        .slice(0, 8)
        .forEach(
            (player, index) => {

                const ry =
                    y +
                    58 +
                    index *
                    rowHeight;

                const isMe =
                    player.id ===
                    myId;

                if (isMe) {

                    ctx.fillStyle =
                        "rgba(0,168,255,0.08)";

                    roundRect(
                        x + 7,
                        ry - 18,
                        width - 14,
                        29,
                        7
                    );

                    ctx.fill();
                }

                const medals = [
                    "🥇",
                    "🥈",
                    "🥉"
                ];

                ctx.font =
                    "700 13px Inter,system-ui,sans-serif";

                ctx.fillStyle =
                    index < 3
                        ? "#f4a261"
                        : "#7b8794";

                ctx.fillText(
                    medals[index] ||
                        `#${index + 1}`,
                    x + 14,
                    ry
                );

                ctx.fillStyle =
                    isMe
                        ? "#008ccc"
                        : "#26313d";

                ctx.font =
                    "700 12px Inter,system-ui,sans-serif";

                ctx.fillText(
                    truncate(
                        player.name ||
                            "Player",
                        15
                    ),
                    x + 48,
                    ry
                );

                ctx.textAlign =
                    "right";

                ctx.fillStyle =
                    "#d58b00";

                ctx.fillText(
                    `${player.kills || 0} K`,
                    x + width - 15,
                    ry
                );

                ctx.textAlign =
                    "left";
            }
        );

    ctx.restore();
}

// ============================================================
// HUD
// ============================================================

function drawHUD() {

    const me =
        state.players[myId];

    if (!me) {
        return;
    }

    drawPlayerStats(me);

    drawAbilities();

    drawKillStreak();
}

// ============================================================
// PLAYER STATS
// ============================================================

function drawPlayerStats(
    player
) {

    const x = 20;

    const y =
        window.innerHeight -
        150;

    const width = 310;

    const height = 125;

    ctx.save();

    ctx.fillStyle =
        "rgba(255,255,255,0.94)";

    ctx.strokeStyle =
        "rgba(0,168,255,0.22)";

    roundRect(
        x,
        y,
        width,
        height,
        15
    );

    ctx.fill();
    ctx.stroke();

    ctx.font =
        "900 17px Inter,system-ui,sans-serif";

    ctx.fillStyle =
        "#26313d";

    ctx.fillText(
        player.name,
        x + 16,
        y + 25
    );

    ctx.font =
        "700 11px Inter,system-ui,sans-serif";

    ctx.fillStyle =
        "#008ccc";

    ctx.fillText(
        `LEVEL ${
            player.level || 1
        }`,
        x + 16,
        y + 43
    );

    const hp =
        Math.max(
            0,
            Math.min(
                100,
                player.health
            )
        );

    ctx.fillStyle =
        "rgba(25,35,45,0.12)";

    roundRect(
        x + 16,
        y + 55,
        width - 32,
        13,
        6
    );

    ctx.fill();

    ctx.fillStyle =
        hp > 60
            ? "#20c997"
            : hp > 30
                ? "#f4b942"
                : "#ef476f";

    roundRect(
        x + 16,
        y + 55,
        (
            width - 32
        ) *
            hp /
            100,
        13,
        6
    );

    ctx.fill();

    ctx.font =
        "800 10px Inter,system-ui,sans-serif";

    ctx.fillStyle =
        "#26313d";

    ctx.fillText(
        `${Math.ceil(hp)} / 100`,
        x + width - 60,
        y + 65
    );

    ctx.font =
        "700 11px Inter,system-ui,sans-serif";

    ctx.fillStyle =
        "#d58b00";

    ctx.fillText(
        `⚔ ${
            player.kills || 0
        }`,
        x + 16,
        y + 91
    );

    ctx.fillStyle =
        "#ef476f";

    ctx.fillText(
        `☠ ${
            player.deaths || 0
        }`,
        x + 85,
        y + 91
    );

    ctx.fillStyle =
        "#607d9a";

    ctx.fillText(
    `DMG ${
        Math.round(
            localStats.damage
        )
    }`,
    x + 155,
    y + 91
);


    ctx.fillStyle =
        "#9b5de5";

    ctx.fillText(
        `🔥 ${
            player.streak || 0
        }`,
        x + 235,
        y + 91
    );

    ctx.fillStyle =
        "rgba(25,35,45,0.1)";

    roundRect(
        x + 16,
        y + 103,
        width - 32,
        5,
        3
    );

    ctx.fill();

    const xp =
        player.xp || 0;

    const needed =
        (
            player.level || 1
        ) *
        100;

    ctx.fillStyle =
        "#9b5de5";

    roundRect(
        x + 16,
        y + 103,
        (
            width - 32
        ) *
            Math.min(
                1,
                xp / needed
            ),
        5,
        3
    );

    ctx.fill();

    ctx.restore();
}

// ============================================================
// ABILITY HUD
// ============================================================

function drawAbilities() {

    const abilities =
        Object.entries(
            ABILITY_CONFIG
        );

    const boxWidth = 100;

    const gap = 10;

    const total =
        abilities.length *
            boxWidth +
        (
            abilities.length -
            1
        ) *
            gap;

    const startX =
        window.innerWidth / 2 -
        total / 2;

    const y =
        window.innerHeight -
        105;

    abilities.forEach(
        (
            [name, ability],
            index
        ) => {

            const x =
                startX +
                index *
                    (
                        boxWidth +
                        gap
                    );

            const cooldown =
                abilityCooldowns[
                    name
                ] || 0;

            const ready =
                cooldown <= 0;

            ctx.save();

            ctx.fillStyle =
                ready
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(240,243,247,0.95)";

            ctx.strokeStyle =
                ready
                    ? ability.color
                    : "rgba(100,120,140,0.25)";

            ctx.lineWidth =
                ready
                    ? 2
                    : 1;

            roundRect(
                x,
                y,
                boxWidth,
                70,
                12
            );

            ctx.fill();
            ctx.stroke();

            if (ready) {

                ctx.shadowBlur = 15;

                ctx.shadowColor =
                    ability.color;
            }

            ctx.font =
                "900 22px Inter,system-ui,sans-serif";

            ctx.textAlign =
                "center";

            ctx.fillStyle =
                ready
                    ? ability.color
                    : "#8b98a6";

            ctx.fillText(
                ability.icon,
                x +
                    boxWidth / 2,
                y + 28
            );

            ctx.font =
                "800 10px Inter,system-ui,sans-serif";

            ctx.fillStyle =
                ready
                    ? "#26313d"
                    : "#8b98a6";

            ctx.fillText(
                ability.name,
                x +
                    boxWidth / 2,
                y + 45
            );

            ctx.font =
                "800 9px Inter,system-ui,sans-serif";

            ctx.fillStyle =
                ability.color;

            ctx.fillText(
                ability.key.toUpperCase(),
                x + 15,
                y + 60
            );

            if (!ready) {

                ctx.fillStyle =
                    "#64748b";

                ctx.font =
                    "800 10px Inter,system-ui,sans-serif";

                ctx.fillText(
                    cooldown.toFixed(1),
                    x +
                        boxWidth -
                        17,
                    y + 60
                );

            } else {

                ctx.fillStyle =
                    ability.color;

                ctx.font =
                    "800 9px Inter,system-ui,sans-serif";

                ctx.fillText(
                    "READY",
                    x +
                        boxWidth -
                        21,
                    y + 60
                );
            }

            ctx.restore();
        }
    );
}

// ============================================================
// KILL STREAK
// ============================================================

function drawKillStreak() {

    const streak =
        localStats.streak;

    if (
        !streak ||
        streak < 2
    ) {
        return;
    }

    ctx.save();

    const x =
        window.innerWidth / 2;

    const y = 90;

    ctx.textAlign =
        "center";

    ctx.font =
        "900 28px Inter,system-ui,sans-serif";

    ctx.fillStyle =
        "#d58b00";

    ctx.shadowBlur = 20;

    ctx.shadowColor =
        "#f4a261";

    ctx.fillText(
        `${streak} KILL STREAK`,
        x,
        y
    );

    ctx.font =
        "700 10px Inter,system-ui,sans-serif";

    ctx.fillStyle =
        "#26313d";

    ctx.shadowBlur = 0;

    ctx.fillText(
        "KEEP GOING",
        x,
        y + 17
    );

    ctx.restore();
}

// ============================================================
// KILL CELEBRATION
// ============================================================

function triggerKillCelebration() {

    camera.shake += 8;

    createFloatingText(
        window.innerWidth / 2,
        window.innerHeight / 2 - 100,
        "ELIMINATION!",
        "#d58b00"
    );

    for (
        let i = 0;
        i < 70;
        i++
    ) {

        spawnScreenParticle(
            window.innerWidth / 2,
            window.innerHeight / 2,
            "#f4b942"
        );
    }
}

// ============================================================
// DEATH
// ============================================================

function triggerDeathEffect() {

    camera.shake += 15;

    camera.zoom = 1.08;

    createFloatingText(
        window.innerWidth / 2,
        window.innerHeight / 2,
        "YOU WERE ELIMINATED",
        "#ef476f"
    );

    screenFlash = 1;
}

// ============================================================
// SCREEN PARTICLES
// ============================================================

function spawnScreenParticle(
    x,
    y,
    color
) {

    screenParticles.push({
        x,
        y,

        vx:
            (
                Math.random() -
                0.5
            ) *
            10,

        vy:
            (
                Math.random() -
                0.5
            ) *
            10,

        life: 1,

        color
    });
}

function updateScreenParticles(
    dt
) {

    for (
        let i =
            screenParticles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            screenParticles[i];

        p.x += p.vx;
        p.y += p.vy;

        p.vx *= 0.96;
        p.vy *= 0.96;

        p.life -=
            dt * 2;

        if (
            p.life <= 0
        ) {

            screenParticles.splice(
                i,
                1
            );
        }
    }
}

function drawScreenParticles() {

    ctx.save();

    for (
        const p of
        screenParticles
    ) {

        ctx.globalAlpha =
            p.life;

        ctx.fillStyle =
            p.color;

        ctx.shadowBlur = 15;

        ctx.shadowColor =
            p.color;

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            3,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

// ============================================================
// SCREEN FLASH
// ============================================================

function updateScreenFlash(dt) {

    screenFlash *=
        Math.pow(
            0.01,
            dt
        );

    if (
        screenFlash < 0.01
    ) {

        screenFlash = 0;
    }
}

function drawScreenFlash() {

    if (
        screenFlash <= 0
    ) {
        return;
    }

    ctx.save();

    ctx.globalAlpha =
        screenFlash *
        0.2;

    ctx.fillStyle =
        "#ef476f";

    ctx.fillRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );

    ctx.restore();
}

// ============================================================
// MINIMAP
// ============================================================

function drawMinimap() {

    const size = 155;

    const x =
        window.innerWidth -
        size -
        20;

    const y =
        window.innerHeight -
        size -
        20;

    ctx.save();

    ctx.fillStyle =
        "rgba(255,255,255,0.94)";

    ctx.strokeStyle =
        "rgba(70,85,100,0.3)";

    roundRect(
        x,
        y,
        size,
        size,
        12
    );

    ctx.fill();
    ctx.stroke();

    // Obstacles
    for (
        const obstacle of
        obstacles
    ) {

        ctx.fillStyle =
            "#c7ced6";

        ctx.fillRect(
            x +
                (
                    obstacle.x /
                    WORLD_WIDTH
                ) *
                size,

            y +
                (
                    obstacle.y /
                    WORLD_HEIGHT
                ) *
                size,

            (
                obstacle.width /
                WORLD_WIDTH
            ) *
                size,

            (
                obstacle.height /
                WORLD_HEIGHT
            ) *
                size
        );
    }

    // Players
    for (
        const [id, player]
        of Object.entries(
            state.players
        )
    ) {

        const px =
            x +
            (
                player.x /
                WORLD_WIDTH
            ) *
            size;

        const py =
            y +
            (
                player.y /
                WORLD_HEIGHT
            ) *
            size;

        const color =
            id === myId
                ? "#00a8ff"
                : "#ef476f";

        ctx.fillStyle =
            color;

        ctx.shadowBlur = 8;

        ctx.shadowColor =
            color;

        ctx.beginPath();

        ctx.arc(
            px,
            py,
            id === myId
                ? 4
                : 3,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    // Bots
    for (
        const bot of bots
    ) {

        if (
            bot.health <= 0
        ) {
            continue;
        }

        const px =
            x +
            (
                bot.x /
                WORLD_WIDTH
            ) *
            size;

        const py =
            y +
            (
                bot.y /
                WORLD_HEIGHT
            ) *
            size;

        ctx.fillStyle =
            "#ef476f";

        ctx.beginPath();

        ctx.arc(
            px,
            py,
            2.5,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

// ============================================================
// VIGNETTE
// ============================================================

function drawVignette() {

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    const gradient =
        ctx.createRadialGradient(
            width / 2,
            height / 2,
            height * 0.15,
            width / 2,
            height / 2,
            height * 0.8
        );

    gradient.addColorStop(
        0,
        "rgba(255,255,255,0)"
    );

    gradient.addColorStop(
        1,
        "rgba(20,30,40,0.12)"
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        width,
        height
    );
}

// ============================================================
// SERVER EFFECTS
// ============================================================

function processEffects() {

    if (
        !Array.isArray(
            state.effects
        )
    ) {
        return;
    }

    for (
        const effect of
        state.effects
    ) {

        if (
            typeof effect !==
                "object" ||
            effect === null
        ) {
            continue;
        }

        if (
            effect._clientProcessed
        ) {
            continue;
        }

        effect._clientProcessed =
            true;

        if (
            effect.type === "hit"
        ) {

            burst(
                effect.x,
                effect.y,
                "#ef476f",
                0.6
            );

            addDamageNumber(
                effect.x,
                effect.y - 20,
                effect.damage || 20
            );

            addHitMarker(
                effect.x,
                effect.y
            );

            camera.shake += 3;

            if (
                effect.killer ===
                myId
            ) {

                camera.shake += 4;
            }
        }

        if (
            effect.type === "kill"
        ) {

            burst(
                effect.x,
                effect.y,
                "#ef476f",
                2
            );

            createFloatingText(
                effect.x,
                effect.y - 40,
                "ELIMINATED",
                "#ef476f"
            );

            camera.shake += 10;
        }

        if (
            effect.type ===
            "explosion"
        ) {

            burst(
                effect.x,
                effect.y,
                "#ef476f",
                effect.power || 1
            );
        }

        if (
            effect.type === "dash"
        ) {

            burst(
                effect.x,
                effect.y,
                "#00a8ff",
                1
            );
        }

        if (
            effect.type === "nova"
        ) {

            shockwaves.push({
                x: effect.x,
                y: effect.y,
                radius: 10,

                maxRadius:
                    effect.radius ||
                    300,

                life: 1,
                color: "#9b5de5",
                width: 8
            });

            burst(
                effect.x,
                effect.y,
                "#9b5de5",
                3
            );

            camera.shake += 15;
        }

        if (
            effect.type === "heal"
        ) {

            rings.push({
                x: effect.x,
                y: effect.y,
                radius: 10,
                maxRadius: 90,
                life: 1,
                color: "#20c997"
            });
        }

        if (
            effect.type ===
            "overdrive"
        ) {

            burst(
                effect.x,
                effect.y,
                "#f4a261",
                2
            );
        }
    }
}

// ============================================================
// HELPERS
// ============================================================

function roundRect(
    x,
    y,
    width,
    height,
    radius
) {

    ctx.beginPath();

    ctx.roundRect(
        x,
        y,
        width,
        height,
        radius
    );
}

function truncate(
    text,
    max
) {

    text = String(text);

    if (
        text.length <= max
    ) {
        return text;
    }

    return (
        text.substring(
            0,
            max - 1
        ) +
        "…"
    );
}

// ============================================================
// DRAW
// ============================================================

function draw() {

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    updateCamera();

    updateMouseWorld();

    const shakeX =
        (
            Math.random() -
            0.5
        ) *
        camera.shake;

    const shakeY =
        (
            Math.random() -
            0.5
        ) *
        camera.shake;

    ctx.save();

    // Camera zoom
    ctx.translate(
        width / 2,
        height / 2
    );

    ctx.scale(
        camera.zoom,
        camera.zoom
    );

    ctx.translate(
        -width / 2,
        -height / 2
    );

    // Camera shake
    ctx.translate(
        shakeX,
        shakeY
    );

    // World camera
    ctx.translate(
        -camera.x,
        -camera.y
    );

    drawWorld();

    drawAfterImages();

    drawBulletTrails();

    drawShockwaves();

    drawRings();

    drawBullets();

    drawBotBullets();

    drawBots();

    for (
        const [id, player]
        of Object.entries(
            state.players
        )
    ) {

        drawPlayer(
            id,
            player
        );
    }

    drawParticles();

    drawMuzzleFlashes();

    drawDamageNumbers();

    drawFloatingTexts();

    drawHitMarkers();

    ctx.restore();

    // Screen UI
    drawHUD();

    drawLeaderboard();

    drawMinimap();

    drawCrosshair();

    drawScreenParticles();

    drawScreenFlash();

    drawVignette();
}

// ============================================================
// MAIN LOOP
// ============================================================

function loop(now) {

    const dt =
        Math.min(
            0.033,
            (
                now -
                lastFrame
            ) / 1000
        );

    lastFrame = now;

    time += dt;

    // Cooldowns
    for (
        const ability of
        Object.keys(
            abilityCooldowns
        )
    ) {

        if (
            abilityCooldowns[
                ability
            ] > 0
        ) {

            abilityCooldowns[
                ability
            ] -= dt;

            if (
                abilityCooldowns[
                    ability
                ] < 0
            ) {

                abilityCooldowns[
                    ability
                ] = 0;
            }
        }
    }

    // Ability timers
    if (
        abilityTimers.overdrive >
        0
    ) {

        abilityTimers.overdrive -=
            dt;

        if (
            abilityTimers.overdrive <
            0
        ) {

            abilityTimers.overdrive =
                0;
        }
    }

    // Gameplay
    updateMovement(dt);

    updateBots(dt);

    updatePlayerBulletDamage();

    updateBotBullets(dt);

    updateRenderPlayers(dt);


    // Effects
    updateParticles(dt);

    updateShockwaves(dt);

    updateRings(dt);

    updateBulletTrails();

    updateMuzzleFlashes(dt);

    updateAfterImages(dt);

    updateDamageNumbers(dt);

    updateFloatingTexts(dt);

    updateHitMarkers(dt);

    updateScreenParticles(dt);

    updateScreenFlash(dt);

    updateRecoil(dt);

    processEffects();

    // Render
    draw();

    requestAnimationFrame(
        loop
    );
}

// ============================================================
// START
// ============================================================

requestAnimationFrame(
    loop
);
