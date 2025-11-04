const startBtn = document.getElementById("start-btn");
const canvas = document.getElementById("canvas");
const startScreen = document.querySelector(".start-screen");
const checkpointScreen = document.querySelector(".checkpoint-screen");
const gameContainer = document.querySelector(".game-container");
const checkpointCount = document.getElementById("checkpoint-count");
const gameStatus = document.getElementById("game-status");
const footerMode = document.getElementById("footer-mode");

const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 400;

const gravity = 0.8;
let isCheckpointCollisionDetectionActive = true;
let foundCheckpoints = 0;
let gameStarted = false;
let animationId;
let cameraOffset = 0;
const LEVEL_WIDTH = 5000;

// Deep Blue Ocean Theme
const theme = {
    player: "#00e5ff",      // Cyan
    platform: "#2962ff",    // Ocean blue
    checkpoint: "#ff6d00",  // Warning orange
    background: "#0a0a1a",  // Dark blue
    text: "#e0e8ff",        // Light blue
    goal: "#1de9b6"         // Success green
};

class Player {
    constructor() {
        this.position = { x: 50, y: 200 };
        this.velocity = { x: 0, y: 0 };
        this.width = 30;
        this.height = 40;
        this.jumpForce = -16;
        this.speed = 7;
        this.canJump = true;
        this.frozen = false;
    }
    
    draw() {
        // Player body
        ctx.fillStyle = theme.player;
        ctx.fillRect(this.position.x - cameraOffset, this.position.y, this.width, this.height);
        
        // Player details (eyes)
        ctx.fillStyle = theme.background;
        ctx.fillRect(this.position.x - cameraOffset + 8, this.position.y + 12, 4, 4);
        ctx.fillRect(this.position.x - cameraOffset + 18, this.position.y + 12, 4, 4);
        
        // Glow effect
        ctx.shadowColor = theme.player;
        ctx.shadowBlur = 15;
        ctx.fillRect(this.position.x - cameraOffset - 2, this.position.y - 2, this.width + 4, this.height + 4);
        ctx.shadowBlur = 0;
    }
    
    update() {
        // If frozen (game ended), don't update physics
        if (this.frozen) {
            this.draw();
            return;
        }
        
        this.draw();
        
        // Apply gravity
        this.velocity.y += gravity;
        
        // Update position
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        
        // Camera follow - move camera when player reaches screen edges
        const rightEdge = canvas.width * 0.7;
        const leftEdge = canvas.width * 0.3;
        
        // Move camera right when player goes beyond right edge
        if (this.position.x - cameraOffset > rightEdge && cameraOffset < LEVEL_WIDTH - canvas.width) {
            cameraOffset = this.position.x - rightEdge;
            if (cameraOffset > LEVEL_WIDTH - canvas.width) {
                cameraOffset = LEVEL_WIDTH - canvas.width;
            }
        }
        
        // Move camera left when player goes beyond left edge (and there's space to move left)
        if (this.position.x - cameraOffset < leftEdge && cameraOffset > 0) {
            cameraOffset = this.position.x - leftEdge;
            if (cameraOffset < 0) cameraOffset = 0;
        }
        
        // World boundaries - prevent player from going beyond level
        if (this.position.x < 0) {
            this.position.x = 0;
        }
        if (this.position.x > LEVEL_WIDTH - this.width) {
            this.position.x = LEVEL_WIDTH - this.width;
            this.velocity.x = 0;
        }
        
        // Floor collision
        if (this.position.y + this.height > canvas.height) {
            this.position.y = canvas.height - this.height;
            this.velocity.y = 0;
            this.canJump = true;
        }
    }
    
    jump() {
        if (this.canJump && !this.frozen) {
            this.velocity.y = this.jumpForce;
            this.canJump = false;
        }
    }
    
    freeze() {
        this.frozen = true;
        this.velocity.x = 0;
        this.velocity.y = 0;
    }
    
    unfreeze() {
        this.frozen = false;
    }
    
    reset() {
        this.position = { x: 50, y: 200 };
        this.velocity = { x: 0, y: 0 };
        this.canJump = true;
        this.frozen = false;
    }
}

class Platform {
    constructor(x, y, width = 150) {
        this.position = { x, y };
        this.width = width;
        this.height = 20;
    }
    
    draw() {
        const screenX = this.position.x - cameraOffset;
        
        // Only draw if platform is visible on screen
        if (screenX + this.width > 0 && screenX < canvas.width) {
            ctx.fillStyle = theme.platform;
            ctx.fillRect(screenX, this.position.y, this.width, this.height);
            
            // Platform details
            ctx.fillStyle = "#1a237e";
            for (let i = 0; i < this.width; i += 25) {
                ctx.fillRect(screenX + i, this.position.y + 2, 2, 3);
            }
            
            // Subtle glow effect
            ctx.shadowColor = theme.platform;
            ctx.shadowBlur = 8;
            ctx.fillRect(screenX - 1, this.position.y - 1, this.width + 2, this.height + 2);
            ctx.shadowBlur = 0;
        }
    }
    
    checkCollision(player) {
        return player.position.x < this.position.x + this.width &&
               player.position.x + player.width > this.position.x &&
               player.position.y + player.height > this.position.y &&
               player.position.y < this.position.y + this.height;
    }
}

class CheckPoint {
    constructor(x, y) {
        this.position = { x, y };
        this.width = 30;
        this.height = 40;
        this.claimed = false;
    }

    draw() {
        if (this.claimed) return;
        
        const screenX = this.position.x - cameraOffset;
        
        if (screenX + this.width > 0 && screenX < canvas.width) {
            ctx.fillStyle = theme.checkpoint;
            ctx.fillRect(screenX, this.position.y, this.width, this.height);
            
            // Pulsing glow effect
            const pulse = Math.sin(Date.now() * 0.01) * 5 + 10;
            ctx.shadowColor = theme.checkpoint;
            ctx.shadowBlur = pulse;
            ctx.fillRect(screenX - 5, this.position.y - 5, this.width + 10, this.height + 10);
            ctx.shadowBlur = 0;
        }
    }
    
    checkCollision(player) {
        return !this.claimed &&
               player.position.x < this.position.x + this.width &&
               player.position.x + player.width > this.position.x &&
               player.position.y < this.position.y + this.height &&
               player.position.y + player.height > this.position.y;
    }
    
    claim() {
        if (!this.claimed) {
            this.claimed = true;
            foundCheckpoints++;
            checkpointCount.textContent = `${foundCheckpoints}/3`;
            return true;
        }
        return false;
    }
    
    reset() {
        this.claimed = false;
    }
}

class Goal {
    constructor(x, y) {
        this.position = { x, y };
        this.width = 60;
        this.height = 80;
        this.reached = false;
    }

    draw() {
        const screenX = this.position.x - cameraOffset;
        
        if (screenX + this.width > 0 && screenX < canvas.width) {
            // Goal platform
            ctx.fillStyle = theme.goal;
            ctx.fillRect(screenX, this.position.y + 40, this.width, 20);
            
            // Goal flag
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(screenX + 40, this.position.y, 5, 40);
            ctx.fillStyle = "#00c853";
            ctx.beginPath();
            ctx.moveTo(screenX + 45, this.position.y);
            ctx.lineTo(screenX + 45, this.position.y + 20);
            ctx.lineTo(screenX + 60, this.position.y + 10);
            ctx.closePath();
            ctx.fill();
            
            // Glow effect
            ctx.shadowColor = theme.goal;
            ctx.shadowBlur = 15;
            ctx.fillRect(screenX - 2, this.position.y + 38, this.width + 4, 24);
            ctx.shadowBlur = 0;
        }
    }
    
    checkCollision(player) {
        return !this.reached &&
               player.position.x < this.position.x + this.width &&
               player.position.x + player.width > this.position.x &&
               player.position.y < this.position.y + this.height &&
               player.position.y + player.height > this.position.y;
    }
    
    reach() {
        if (!this.reached) {
            this.reached = true;
            return true;
        }
        return false;
    }
    
    reset() {
        this.reached = false;
    }
}

// Create game objects
const player = new Player();

const platforms = [
    new Platform(100, 320, 200),
    new Platform(400, 280, 150),
    new Platform(650, 240, 120),
    new Platform(900, 200, 180),
    new Platform(1200, 280, 160),
    new Platform(1500, 240, 140),
    new Platform(1800, 320, 200),
    new Platform(2100, 280, 150),
    new Platform(2400, 200, 120),
    new Platform(2700, 320, 250),
    new Platform(3100, 280, 180),
    new Platform(3400, 240, 160),
    new Platform(3700, 320, 200),
    new Platform(4000, 280, 150),
    new Platform(4300, 200, 120),
    new Platform(4600, 320, 200)
];

const checkpoints = [
    new CheckPoint(300, 280),
    new CheckPoint(1600, 160),
    new CheckPoint(3500, 160)
];

const goal = new Goal(4800, 280);

// Input handling - SIMPLIFIED to prevent conflicts
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    " ": false
};

function handleCollisions() {
    let onGround = false;
    
    platforms.forEach(platform => {
        if (platform.checkCollision(player)) {
            if (player.velocity.y > 0 && 
                player.position.y + player.height - player.velocity.y <= platform.position.y) {
                player.position.y = platform.position.y - player.height;
                player.velocity.y = 0;
                player.canJump = true;
                onGround = true;
            }
            else if (player.velocity.y < 0 && 
                     player.position.y - player.velocity.y >= platform.position.y + platform.height) {
                player.position.y = platform.position.y + platform.height;
                player.velocity.y = 0;
            }
            else if (player.velocity.x > 0) {
                player.position.x = platform.position.x - player.width;
            } else if (player.velocity.x < 0) {
                player.position.x = platform.position.x + platform.width;
            }
        }
    });

    if (!onGround && player.position.y + player.height >= canvas.height) {
        player.canJump = true;
    }

    checkpoints.forEach((checkpoint, index) => {
        if (checkpoint.checkCollision(player)) {
            if (checkpoint.claim()) {
                showCheckpointScreen(`Artifact ${index + 1} acquired!`);
            }
        }
    });

    if (goal.checkCollision(player)) {
        if (goal.reach()) {
            gameComplete();
        }
    }
}

function gameComplete() {
    isCheckpointCollisionDetectionActive = false;
    gameStatus.textContent = "MISSION_COMPLETE";
    footerMode.textContent = "VICTORY";
    
    // Freeze the player in place instead of letting them fall
    player.freeze();
    
    showCheckpointScreen("Congratulations! You reached the end and completed your mission!");
}

function handleMovement() {
    if (!isCheckpointCollisionDetectionActive || player.frozen) {
        player.velocity.x = 0;
        return;
    }
    
    if (keys.ArrowLeft) {
        player.velocity.x = -player.speed;
    } else if (keys.ArrowRight) {
        player.velocity.x = player.speed;
    } else {
        player.velocity.x = 0;
    }
    
    // Handle jumping separately in the game loop, not in key events
}

function drawBackground() {
    // Clean gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#0a0a1a");
    gradient.addColorStop(1, "#1a1a3a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Subtle stars
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    for (let i = 0; i < 30; i++) {
        const x = ((i * 67) + cameraOffset * 0.2) % (canvas.width + 800);
        const y = (i * 31) % canvas.height;
        const size = Math.random() * 1.2;
        ctx.fillRect(x, y, size, size);
    }
}

function drawUI() {
    // All three stats: Position, Progress %, and Artifacts
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "12px monospace";
    ctx.fillText(`Position: ${Math.floor(player.position.x)}/${LEVEL_WIDTH}`, 10, 20);
    ctx.fillText(`Progress: ${Math.floor((player.position.x / LEVEL_WIDTH) * 100)}%`, 10, 35);
    ctx.fillText(`Artifacts: ${foundCheckpoints}/3`, 10, 50);
    
    // Goal indicator when near end
    if (player.position.x > LEVEL_WIDTH - 500 && isCheckpointCollisionDetectionActive) {
        ctx.fillStyle = theme.goal;
        ctx.font = "12px monospace";
        ctx.fillText("🎯 GOAL AHEAD", canvas.width - 120, 25);
    }
}

function handleJump() {
    // Handle jumping in the game loop to prevent key conflict issues
    if ((keys[" "] || keys.ArrowUp) && player.canJump && !player.frozen) {
        player.jump();
    }
}

function animate() {
    if (!gameStarted) return;
    
    animationId = requestAnimationFrame(animate);
    
    drawBackground();
    
    platforms.forEach(platform => platform.draw());
    checkpoints.forEach(checkpoint => checkpoint.draw());
    goal.draw();
    
    handleMovement();
    handleJump(); // Handle jumping in game loop instead of key events
    
    // Only handle collisions if game is active
    if (isCheckpointCollisionDetectionActive) {
        handleCollisions();
    }
    
    player.update();
    drawUI();
}

function showCheckpointScreen(message = "Artifact found!") {
    checkpointScreen.innerHTML = `
        <h2>SUCCESS</h2>
        <p>${message}</p>
        <p>${foundCheckpoints}/3 artifacts collected</p>
    `;
    checkpointScreen.style.display = "block";
    setTimeout(() => {
        checkpointScreen.style.display = "none";
    }, 2000);
}

function startGame() {
    startScreen.style.display = "none";
    gameContainer.style.display = "block";
    gameStatus.textContent = "EXPLORING";
    footerMode.textContent = "ACTIVE";
    gameStarted = true;
    
    foundCheckpoints = 0;
    checkpointCount.textContent = "0/3";
    isCheckpointCollisionDetectionActive = true;
    cameraOffset = 0;
    
    // Reset player to start position
    player.reset();
    
    // Reset checkpoints and goal
    checkpoints.forEach(checkpoint => {
        checkpoint.reset();
    });
    goal.reset();
    
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    keys.ArrowUp = false;
    keys[" "] = false;
    
    canvas.width = gameContainer.clientWidth - 40;
    canvas.height = 400;
    
    animate();
}

function resetGame() {
    // Instead of exiting to menu, restart the game from beginning
    cancelAnimationFrame(animationId);
    
    // Reset all game state
    foundCheckpoints = 0;
    checkpointCount.textContent = "0/3";
    isCheckpointCollisionDetectionActive = true;
    cameraOffset = 0;
    gameStatus.textContent = "EXPLORING";
    footerMode.textContent = "ACTIVE";
    
    // Reset player to start position
    player.reset();
    
    // Reset checkpoints and goal
    checkpoints.forEach(checkpoint => {
        checkpoint.reset();
    });
    goal.reset();
    
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    keys.ArrowUp = false;
    keys[" "] = false;
    
    // Restart the game loop
    animate();
}

// Event Listeners - SIMPLIFIED: Just track key states, no jump logic here
startBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
    // Track key states without preventing default (except for spacebar)
    if (event.key === 'ArrowLeft') {
        keys.ArrowLeft = true;
    } else if (event.key === 'ArrowRight') {
        keys.ArrowRight = true;
    } else if (event.key === 'ArrowUp') {
        keys.ArrowUp = true;
    } else if (event.key === ' ') {
        keys[" "] = true;
        event.preventDefault(); // Only prevent default for spacebar to avoid page scrolling
    } else if (event.key === 'r' || event.key === 'R') {
        resetGame();
    } else if (event.key === 'Escape') {
        // Escape still exits to menu
        cancelAnimationFrame(animationId);
        gameStarted = false;
        startScreen.style.display = "block";
        gameContainer.style.display = "none";
        footerMode.textContent = "READY";
        gameStatus.textContent = "READY";
    }
});

window.addEventListener("keyup", (event) => {
    if (event.key === 'ArrowLeft') {
        keys.ArrowLeft = false;
    } else if (event.key === 'ArrowRight') {
        keys.ArrowRight = false;
    } else if (event.key === 'ArrowUp') {
        keys.ArrowUp = false;
    } else if (event.key === ' ') {
        keys[" "] = false;
    }
});

// Also prevent context menu on right click
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

window.addEventListener("resize", () => {
    if (gameStarted) {
        canvas.width = gameContainer.clientWidth - 40;
        cancelAnimationFrame(animationId);
        animate();
    }
});

// Initialize
checkpointCount.textContent = "0/3";
gameStatus.textContent = "READY";
footerMode.textContent = "READY";