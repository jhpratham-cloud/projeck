const socket = io();

const PLAYER_BULLET_DAMAGE = 25;
const BOT_BULLET_DAMAGE = 30; // Increased damage config

const bots = [
    {
        id: "bot_1",
        name: "BOT ALPHA",
        x: 1200,
        y: 900,
        angle: 0,
        health: 300,
        maxHealth: 300,
        speed: 1.2,
        color: "#ef476f",
        fireTimer: 1
    },
    {
        id: "bot_2",
        name: "BOT BRAVO",
        x: 400,
        y: 300,
        angle: 0,
        health: 300,
        maxHealth: 300,
        speed: 1.2,
        color: "#ef476f",
        fireTimer: 1
    },
    {
        id: "bot_3",
        name: "BOT CHARLIE",
        x: 1000,
        y: 300,
        angle: 0,
        health: 300,
        maxHealth: 300,
        speed: 1.2,
        color: "#ef476f",
        fireTimer: 1
    },
    {
        id: "bot_4",
        name: "BOT DELTA",
        x: 400,
        y: 900,
        angle: 0,
        health: 300,
        maxHealth: 300,
        speed: 1.2,
        color: "#ef476f",
        fireTimer: 1
    }
];

// Listen for ability key press (F key)
window.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") {
        socket.emit("ability", { ability: "heal" });
    }
});

// Canvas and rendering setup integration point
socket.on("game_state", (data) => {
    // Handle game rendering state updates here
});
