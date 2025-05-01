// client.js - Client-side code for Bomberman-DOM game
// This file should be placed in the public directory so the server can serve it

// Import the socket from main.js
import socket from "../main.js";

// Game constants
const TILE_SIZE = 40; // Size of each tile in pixels
const PLAYER_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00']; // Red, Green, Blue, Yellow

// Game state
let playerId = null;
let roomId = null;
let gameState = 'login'; // 'login', 'waiting', 'countdown', 'playing', 'gameover'
let players = new Map();
let map = [];
let bombs = [];
let explosions = [];
let powerUps = [];
let myPlayer = null;

// DOM Elements
const gameContainer = document.getElementById('game-container');
const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const nicknameInput = document.getElementById('nickname-input');
const joinButton = document.getElementById('join-button');
const playerCounter = document.getElementById('player-counter');
const countdownTimer = document.getElementById('countdown-timer');
const gameBoard = document.getElementById('game-board'); // Will replace canvas
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatButton = document.getElementById('chat-button');
const winnerDisplay = document.getElementById('winner-display');
const playAgainButton = document.getElementById('play-again-button');

// Initialize game
function initGame() {
    // Set up event listeners
    joinButton.addEventListener('click', joinGame);
    chatButton.addEventListener('click', sendChatMessage);
    playAgainButton.addEventListener('click', resetGame);
    document.addEventListener('keydown', handleKeyDown);

    // Show login screen
    showScreen('login');
}

// Show only the specified screen
function showScreen(screen) {
    loginScreen.style.display = screen === 'login' ? 'block' : 'none';
    waitingScreen.style.display = screen === 'waiting' ? 'block' : 'none';
    gameScreen.style.display = screen === 'playing' ? 'block' : 'none';
    gameOverScreen.style.display = screen === 'gameover' ? 'block' : 'none';
    gameState = screen;
}

// Join the game
function joinGame() {
    const nickname = nicknameInput.value.trim() || `Player${Math.floor(Math.random() * 1000)}`;

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'join',
            nickname
        }));
        localStorage.setItem('nickname', nickname);
        showScreen('waiting');
    } else {
        console.error('WebSocket is not connected');
        // Try to reconnect
        setTimeout(() => {
            alert('Connection lost. Please refresh the page.');
        }, 500);
    }
}

// Handle server messages
export function handleServerMessage(data) {
    console.warn(data)
    switch (data.type) {
        case 'joined':
        case 'joined_game':
            playerId = data.playerId;
            roomId = data.roomId;

            // Initialize players
            players.clear();
            data.players.forEach(player => {
                players.set(player.id, {
                    id: player.id,
                    nickname: player.nickname,
                    x: player.x || 0,
                    y: player.y || 0,
                    lives: player.lives || 3,
                    bombs: player.bombs || 1,
                    range: player.range || 1,
                    speed: player.speed || 1,
                    color: PLAYER_COLORS[players.size % PLAYER_COLORS.length],
                    element: null // Will hold the DOM element for this player
                });
            });

            // Update UI
            updatePlayerCounter();
            break;

        case 'player_joined':
            // Add new player
            if (!players.has(data.playerId)) {
                players.set(data.playerId, {
                    id: data.playerId,
                    nickname: data.nickname,
                    x: data.x || 0,
                    y: data.y || 0,
                    lives: data.lives || 3,
                    bombs: data.bombs || 1,
                    range: data.range || 1,
                    speed: data.speed || 1,
                    color: PLAYER_COLORS[players.size % PLAYER_COLORS.length],
                    element: null // Will hold the DOM element for this player
                });

                updatePlayerCounter();
            }
            break;

        case 'player_left':
            // Remove player
            if (players.has(data.playerId) && players.get(data.playerId).element) {
                const playerElement = players.get(data.playerId).element;
                if (playerElement && playerElement.parentNode) {
                    playerElement.parentNode.removeChild(playerElement);
                }
            }
            players.delete(data.playerId);
            updatePlayerCounter();
            break;

        case 'countdown_started':
        case 'countdown':
            startCountdown(data.duration);
            break;

        case 'game_started':
            // Update map and player positions
            map = data.map;

            data.players.forEach(playerData => {
                if (players.has(playerData.id)) {
                    const player = players.get(playerData.id);
                    player.x = playerData.x;
                    player.y = playerData.y;
                    player.lives = playerData.lives;
                    player.bombs = playerData.bombs;
                    player.range = playerData.range;
                    player.speed = playerData.speed;

                    if (playerData.id === playerId) {
                        myPlayer = player;
                    }
                }
            });

            // Start game
            showScreen('playing');
            initializeGameBoard();
            startGameLoop();
            break;

        case 'player_moved':
            console.warn("moved");
            // if (players.has(data.playerId) && data.playerId !== playerId) {
            // }
            const player = players.get(data.playerId);
            player.x = data.x;
            player.y = data.y;
            updatePlayerPosition(player);
            break;

        case 'bomb_placed':
            const bomb = {
                id: data.bombId,
                x: data.x,
                y: data.y,
                playerId: data.playerId,
                placedAt: Date.now(),
                element: null // Will hold the DOM element
            };
            bombs.push(bomb);
            addBombToBoard(bomb);
            break;

        case 'explosion':
            // Remove bomb
            const bombToRemove = bombs.find(b => b.x === data.x && b.y === data.y);
            if (bombToRemove && bombToRemove.element) {
                bombToRemove.element.remove();
            }
            bombs = bombs.filter(b => !(b.x === data.x && b.y === data.y));

            // Add explosion
            const explosion = {
                x: data.x,
                y: data.y,
                range: data.range,
                tiles: data.tiles,
                createdAt: Date.now(),
                elements: [] // Will hold DOM elements for this explosion
            };

            explosions.push(explosion);
            addExplosionToBoard(explosion);

            // Remove explosion after animation
            setTimeout(() => {
                explosion.elements.forEach(elem => {
                    if (elem && elem.parentNode) {
                        elem.parentNode.removeChild(elem);
                    }
                });
                explosions = explosions.filter(e => e !== explosion);
            }, 500);
            break;

        case 'powerup_collected':
            // Remove power-up from the board
            const powerUpToRemove = powerUps.find(p => p.x === data.x && p.y === data.y);
            if (powerUpToRemove && powerUpToRemove.element) {
                powerUpToRemove.element.remove();
            }
            powerUps = powerUps.filter(p => !(p.x === data.x && p.y === data.y));

            // Update player stats if it's us
            if (data.playerId === playerId && players.has(playerId)) {
                const player = players.get(playerId);
                player.bombs = data.newStats.bombs;
                player.range = data.newStats.range;
                player.speed = data.newStats.speed;
                myPlayer = player;
                updatePlayerStats();
            }
            break;

        case 'player_damaged':
            if (players.has(data.playerId)) {
                players.get(data.playerId).lives = data.livesLeft;

                if (data.playerId === playerId) {
                    // Player hit animation or feedback
                    flashScreen('red');
                    updatePlayerStats();
                }
            }
            break;

        case 'player_eliminated':
            if (data.playerId === playerId) {
                // Own player eliminated
                alert("You've been eliminated!");
            }

            // Remove player element from board
            if (players.has(data.playerId) && players.get(data.playerId).element) {
                const playerElement = players.get(data.playerId).element;
                if (playerElement && playerElement.parentNode) {
                    playerElement.parentNode.removeChild(playerElement);
                }
            }
            players.delete(data.playerId);
            break;

        case 'game_over':
            gameState = 'gameover';
            showScreen('gameover');

            if (data.winner) {
                const winnerNickname = data.winnerNickname || "Unknown player";
                winnerDisplay.textContent = `Winner: ${winnerNickname}`;

                if (data.winner === playerId) {
                    winnerDisplay.textContent += " (You won!)";
                }
            } else {
                winnerDisplay.textContent = "Game over! No winner.";
            }
            break;

        case 'chat_message':
        case 'chat':
            addChatMessage(data.nickname, data.message);
            break;
    }
}

// Initialize the game board
function initializeGameBoard() {
    // Clear any existing board
    gameBoard.innerHTML = '';

    // Set the board size based on the map dimensions
    gameBoard.style.width = `${map[0].length * TILE_SIZE}px`;
    gameBoard.style.height = `${map.length * TILE_SIZE}px`;
    gameBoard.style.position = 'relative';

    // Create the map tiles
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const tile = document.createElement('div');
            tile.className = 'map-tile';
            tile.setAttribute("type", `${map[y][x]}`)
            tile.id = `tile-${x}-${y}`;
            tile.style.position = 'absolute';
            tile.style.left = `${x * TILE_SIZE}px`;
            tile.style.top = `${y * TILE_SIZE}px`;
            tile.style.width = `${TILE_SIZE}px`;
            tile.style.height = `${TILE_SIZE}px`;

            // Set tile type
            switch (map[y][x]) {
                case 0: // Empty
                    tile.style.backgroundColor = '#8aac70'; // Green grass
                    break;
                case 1: // Wall
                    tile.style.backgroundColor = '#a67c52'; // Gray wall
                    break;
                case 2: // Block
                    tile.style.backgroundColor = '#666666'; // Brown block
                    break;
            }

            // Add grid lines
            tile.style.boxSizing = 'border-box';
            tile.style.border = '1px solid rgba(0, 0, 0, 0.2)';

            gameBoard.appendChild(tile);
        }
    }

    // Create player stats UI
    const statsUI = document.createElement('div');
    statsUI.id = 'player-stats';
    statsUI.style.position = 'absolute';
    statsUI.style.top = '10px';
    statsUI.style.left = '10px';
    statsUI.style.padding = '10px';
    statsUI.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    statsUI.style.borderRadius = '5px';
    statsUI.style.color = 'white';
    statsUI.style.zIndex = '1000';
    statsUI.innerHTML = '<div id="player-lives">Lives: 3</div>' +
        '<div id="player-bombs">Bombs: 1</div>' +
        '<div id="player-range">Range: 1</div>' +
        '<div id="player-speed">Speed: 1.0x</div>';
    gameBoard.appendChild(statsUI);

    // Create player elements
    players.forEach(player => {
        createPlayerElement(player);
    });
}

// Create a player element
function createPlayerElement(player) {
    // Remove existing element if any
    if (player.element && player.element.parentNode) {
        player.element.parentNode.removeChild(player.element);
    }

    // Create player container
    const playerContainer = document.createElement('div');
    playerContainer.className = 'player-container';
    playerContainer.style.position = 'absolute';
    playerContainer.style.left = `${player.x * TILE_SIZE}px`;
    playerContainer.style.top = `${player.y * TILE_SIZE}px`;
    playerContainer.style.width = `${TILE_SIZE}px`;
    playerContainer.style.height = `${TILE_SIZE}px`;
    playerContainer.style.display = 'flex';
    playerContainer.style.flexDirection = 'column';
    playerContainer.style.alignItems = 'center';
    playerContainer.style.justifyContent = 'center';
    playerContainer.style.transition = 'left 0.1s, top 0.1s';
    playerContainer.style.zIndex = '10';

    // Create player avatar
    const playerAvatar = document.createElement('div');
    playerAvatar.className = 'player-avatar';
    playerAvatar.style.width = `${TILE_SIZE * 2 / 3}px`;
    playerAvatar.style.height = `${TILE_SIZE * 2 / 3}px`;
    playerAvatar.style.borderRadius = '50%';
    playerAvatar.style.backgroundColor = player.color;
    playerAvatar.style.border = '2px solid black';

    // Create player name
    const playerName = document.createElement('div');
    playerName.className = 'player-name';
    playerName.textContent = player.nickname;
    playerName.style.position = 'absolute';
    playerName.style.top = '-20px';
    playerName.style.width = '100px';
    playerName.style.textAlign = 'center';
    playerName.style.color = 'white';
    playerName.style.fontSize = '12px';
    playerName.style.transform = 'translateX(-30px)';
    playerName.style.textShadow = '1px 1px 2px black';

    // Create lives indicator
    const livesContainer = document.createElement('div');
    livesContainer.className = 'lives-container';
    livesContainer.style.position = 'absolute';
    livesContainer.style.bottom = '-15px';
    livesContainer.style.display = 'flex';
    livesContainer.style.justifyContent = 'center';

    for (let i = 0; i < player.lives; i++) {
        const life = document.createElement('div');
        life.className = 'life-indicator';
        life.style.width = '8px';
        life.style.height = '8px';
        life.style.borderRadius = '50%';
        life.style.backgroundColor = '#ff0000';
        life.style.margin = '0 2px';
        livesContainer.appendChild(life);
    }

    // Add elements to container
    playerContainer.appendChild(playerName);
    playerContainer.appendChild(playerAvatar);
    playerContainer.appendChild(livesContainer);

    // Add to game board
    gameBoard.appendChild(playerContainer);

    // Store reference to DOM element
    player.element = playerContainer;
}

// Add bomb to the game board
function addBombToBoard(bomb) {
    const bombElement = document.createElement('div');
    bombElement.className = 'bomb';
    bombElement.style.position = 'absolute';
    bombElement.style.left = `${bomb.x * TILE_SIZE}px`;
    bombElement.style.top = `${bomb.y * TILE_SIZE}px`;
    bombElement.style.width = `${TILE_SIZE}px`;
    bombElement.style.height = `${TILE_SIZE}px`;
    bombElement.style.display = 'flex';
    bombElement.style.justifyContent = 'center';
    bombElement.style.alignItems = 'center';
    bombElement.style.zIndex = '5';

    const bombInner = document.createElement('div');
    bombInner.className = 'bomb-inner';
    bombInner.style.width = `${TILE_SIZE * 0.8}px`;
    bombInner.style.height = `${TILE_SIZE * 0.8}px`;
    bombInner.style.borderRadius = '50%';
    bombInner.style.backgroundColor = '#000';
    bombInner.style.position = 'relative';
    bombInner.style.animation = 'pulse 1s infinite';

    // Add fuse
    const fuse = document.createElement('div');
    fuse.className = 'bomb-fuse';
    fuse.style.position = 'absolute';
    fuse.style.top = '-5px';
    fuse.style.left = '50%';
    fuse.style.transform = 'translateX(-50%)';
    fuse.style.width = '2px';
    fuse.style.height = '10px';
    fuse.style.backgroundColor = '#fff';

    bombInner.appendChild(fuse);
    bombElement.appendChild(bombInner);
    gameBoard.appendChild(bombElement);

    // Add animation style if not already present
    if (!document.getElementById('bomb-animations')) {
        const style = document.createElement('style');
        style.id = 'bomb-animations';
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    // Store reference to DOM element
    bomb.element = bombElement;
}

// Add explosion to the game board
function addExplosionToBoard(explosion) {
    explosion.tiles.forEach(tile => {
        const explosionTile = document.createElement('div');
        explosionTile.className = 'explosion-tile';
        explosionTile.style.position = 'absolute';
        explosionTile.style.left = `${tile.x * TILE_SIZE}px`;
        explosionTile.style.top = `${tile.y * TILE_SIZE}px`;
        explosionTile.style.width = `${TILE_SIZE}px`;
        explosionTile.style.height = `${TILE_SIZE}px`;
        explosionTile.style.backgroundColor = 'rgba(255, 200, 0, 0.8)';
        explosionTile.style.zIndex = '4';
        explosionTile.style.animation = 'fade-out 0.5s forwards';

        gameBoard.appendChild(explosionTile);
        explosion.elements.push(explosionTile);
        map[tile.y][tile.x]--;
    });
    explosion.tiles.forEach(tile => {
        const brick = document.querySelector(`#tile-${tile.x}-${tile.y}`);
        const type = brick.getAttribute('type');
        brick.type = type - 1;
        // console.warn(type);
        switch (type - 1) {
            case 0: // Empty
                brick.style.backgroundColor = '#8aac70'; // Green grass
                break;
            case 1: // Wall
                brick.style.backgroundColor = '#a67c52'; // Gray wall
                break;
            case 2: // Block
                brick.style.backgroundColor = '#666666'; // Brown block
                break;
        }
    })

    // Add animation style if not already present
    if (!document.getElementById('explosion-animations')) {
        const style = document.createElement('style');
        style.id = 'explosion-animations';
        style.textContent = `
            @keyframes fade-out {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Add power-up to the game board
function addPowerUpToBoard(powerUp) {
    const powerUpElement = document.createElement('div');
    powerUpElement.className = 'power-up';
    powerUpElement.style.position = 'absolute';
    powerUpElement.style.left = `${powerUp.x * TILE_SIZE}px`;
    powerUpElement.style.top = `${powerUp.y * TILE_SIZE}px`;
    powerUpElement.style.width = `${TILE_SIZE}px`;
    powerUpElement.style.height = `${TILE_SIZE}px`;
    powerUpElement.style.display = 'flex';
    powerUpElement.style.justifyContent = 'center';
    powerUpElement.style.alignItems = 'center';
    powerUpElement.style.zIndex = '3';

    const powerUpInner = document.createElement('div');
    powerUpInner.className = 'power-up-inner';
    powerUpInner.style.width = `${TILE_SIZE * 0.5}px`;
    powerUpInner.style.height = `${TILE_SIZE * 0.5}px`;
    powerUpInner.style.borderRadius = '50%';
    powerUpInner.style.border = '2px solid black';

    // Set color based on power-up type
    switch (powerUp.type) {
        case 'bomb':
            powerUpInner.style.backgroundColor = '#ff0000'; // Red
            break;
        case 'flame':
            powerUpInner.style.backgroundColor = '#ff9900'; // Orange
            break;
        case 'speed':
            powerUpInner.style.backgroundColor = '#00ff00'; // Green
            break;
    }

    powerUpElement.appendChild(powerUpInner);
    gameBoard.appendChild(powerUpElement);

    // Store reference to DOM element
    powerUp.element = powerUpElement;
}

// Update player counter
function updatePlayerCounter() {
    playerCounter.textContent = `Players: ${players.size}/${4}`;
}

// Start countdown timer
function startCountdown(seconds) {
    let timeLeft = seconds;

    function updateTimer() {
        countdownTimer.textContent = `Game starting in: ${timeLeft}`;

        if (timeLeft <= 0) {
            countdownTimer.textContent = "Get ready!";
            return;
        }

        timeLeft--;
        setTimeout(updateTimer, 1000);
    }

    updateTimer();
}

// Game loop for animation and updates
let lastFrameTime = 0;
function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = (timestamp - lastFrameTime) / 1000; // Convert to seconds
    lastFrameTime = timestamp;

    if (gameState === 'playing') {
        // Update player position based on key state
        updatePlayerMovement(deltaTime);

        // Animate bombs (pulsing effect is handled by CSS animation)

        // Request next frame
        requestAnimationFrame(gameLoop);
    }
}

// Start the game loop
function startGameLoop() {
    lastFrameTime = 0;
    requestAnimationFrame(gameLoop);
}

// Player movement - key states
const keyState = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

// Handle key down events
function handleKeyDown(event) {
    if (gameState !== 'playing') return;

    // Update key state
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            keyState.ArrowUp = true;
            // event.preventDefault();
            break;

        case 'ArrowDown':
        case 'KeyS':
            keyState.ArrowDown = true;
            // event.preventDefault();
            break;

        case 'ArrowLeft':
        case 'KeyA':
            keyState.ArrowLeft = true;
            // event.preventDefault();
            break;

        case 'ArrowRight':
        case 'KeyD':
            keyState.ArrowRight = true;
            // event.preventDefault();
            break;

        case 'Space':
            // Place bomb
            if (!keyState.Space) {
                placeBomb();
            }
            keyState.Space = true;
            // event.preventDefault();
            break;
    }
}

// Handle key up events
document.addEventListener('keyup', (event) => {
    // Update key state
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            keyState.ArrowUp = false;
            break;

        case 'ArrowDown':
        case 'KeyS':
            keyState.ArrowDown = false;
            break;

        case 'ArrowLeft':
        case 'KeyA':
            keyState.ArrowLeft = false;
            break;

        case 'ArrowRight':
        case 'KeyD':
            keyState.ArrowRight = false;
            break;

        case 'Space':
            keyState.Space = false;
            break;
    }
});

// Update player movement based on key state
function updatePlayerMovement(deltaTime) {
    if (!myPlayer) return;

    const speed = myPlayer.speed * 3 * deltaTime; // Adjust base speed
    let movedX = 0;
    let movedY = 0;

    if (keyState.ArrowUp) movedY -= speed;
    if (keyState.ArrowDown) movedY += speed;
    if (keyState.ArrowLeft) movedX -= speed;
    if (keyState.ArrowRight) movedX += speed;

    // If movement detected, check collision and send update
    if (movedX !== 0 || movedY !== 0) {
        // Calculate new position
        let newX = myPlayer.x + movedX;
        let newY = myPlayer.y + movedY;

        // Check collision with map boundaries
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX > map[0].length - 1) newX = map[0].length - 1;
        if (newY > map.length - 1) newY = map.length - 1;

        // Check collision with walls and blocks
        const tileX1 = Math.floor(newX);
        const tileY1 = Math.floor(newY);
        const tileX2 = Math.ceil(newX);
        const tileY2 = Math.ceil(newY);

        // Check all corners of player for collisions
        const corners = [
            { x: tileX1, y: tileY1 },
            { x: tileX2, y: tileY1 },
            { x: tileX1, y: tileY2 },
            { x: tileX2, y: tileY2 }
        ];

        let hasCollision = false;
        for (const corner of corners) {
            if (corner.x >= 0 && corner.x < map[0].length && corner.y >= 0 && corner.y < map.length) {
                const tile = map[corner.y][corner.x];
                if (tile === 1 || tile === 2) { // Wall or block
                    hasCollision = true;
                    break;
                }
            }
        }

        // Check collision with bombs
        for (const bomb of bombs) {
            const bombTileX = Math.floor(bomb.x);
            const bombTileY = Math.floor(bomb.y);

            for (const corner of corners) {
                if (corner.x === bombTileX && corner.y === bombTileY) {
                    // Allow player to exit from their own bomb's position
                    const isOnOwnBomb = bombTileX === Math.floor(myPlayer.x) && bombTileY === Math.floor(myPlayer.y);
                    if (!isOnOwnBomb) {
                        hasCollision = true;
                        break;
                    }
                }
            }

            if (hasCollision) break;
        }

        // Update position if no collision
        // if (!hasCollision) {
        myPlayer.x = newX;
        myPlayer.y = newY;

        // Update DOM position
        // updatePlayerPosition(myPlayer);

        // Send position update to server - align with backend's expected format
        socket.send(JSON.stringify({
            type: 'move',
            direction: getDirectionFromMovement(movedX, movedY),
            x: myPlayer.x,
            y: myPlayer.y
        }));
        // console.warn("move", JSON.stringify({
        //     type: 'move',
        //     direction: getDirectionFromMovement(movedX, movedY),
        //     x: myPlayer.x,
        //     y: myPlayer.y
        // }))
        // Check for power-up collection
        checkPowerUpCollection();
        // }
    }
}

function getDirectionFromMovement(x, y) {
    if (Math.abs(x) > Math.abs(y)) {
        // Movement is primarily horizontal
        return x > 0 ? 'right' : 'left';
    } else {
        // Movement is primarily vertical
        return y > 0 ? 'down' : 'up';
    }
}

// Update player position in the DOM
function updatePlayerPosition(player) {
    if (player.element) {
        player.element.style.left = `${player.x * TILE_SIZE}px`;
        player.element.style.top = `${player.y * TILE_SIZE}px`;
    }
}

// Place bomb at player's position
function placeBomb() {
    if (!myPlayer || !socket) return;

    // Round the position to get the tile coordinates
    const bombX = Math.floor(myPlayer.x);
    const bombY = Math.floor(myPlayer.y);

    // Check if there's already a bomb at this position
    const existingBomb = bombs.find(b => Math.floor(b.x) === bombX && Math.floor(b.y) === bombY);
    if (existingBomb) return;

    // Send bomb placement to server
    socket.send(JSON.stringify({
        type: 'placeBomb',
        x: bombX,
        y: bombY
    }));
}

// Check if player has collected a power-up
function checkPowerUpCollection() {
    if (!myPlayer) return;

    const playerTileX = Math.floor(myPlayer.x);
    const playerTileY = Math.floor(myPlayer.y);

    for (let i = 0; i < powerUps.length; i++) {
        const powerUp = powerUps[i];
        if (Math.floor(powerUp.x) === playerTileX && Math.floor(powerUp.y) === playerTileY) {
            // Send power-up collection to server
            socket.send(JSON.stringify({
                type: 'collectPowerUp',
                powerUpId: powerUp.id
            }));
            break;
        }
    }
}

// Update player stats display
function updatePlayerStats() {
    if (!myPlayer) return;

    const livesElement = document.getElementById('player-lives');
    const bombsElement = document.getElementById('player-bombs');
    const rangeElement = document.getElementById('player-range');
    const speedElement = document.getElementById('player-speed');

    if (livesElement) livesElement.textContent = `Lives: ${myPlayer.lives}`;
    if (bombsElement) bombsElement.textContent = `Bombs: ${myPlayer.bombs}`;
    if (rangeElement) rangeElement.textContent = `Range: ${myPlayer.range}`;
    if (speedElement) speedElement.textContent = `Speed: ${myPlayer.speed.toFixed(1)}x`;
}

// Flash the screen for visual feedback
function flashScreen(color) {
    const flashOverlay = document.createElement('div');
    flashOverlay.style.position = 'absolute';
    flashOverlay.style.top = '0';
    flashOverlay.style.left = '0';
    flashOverlay.style.width = '100%';
    flashOverlay.style.height = '100%';
    flashOverlay.style.backgroundColor = color;
    flashOverlay.style.opacity = '0.3';
    flashOverlay.style.pointerEvents = 'none';
    flashOverlay.style.zIndex = '100';
    flashOverlay.style.animation = 'flash-animation 0.5s forwards';

    // Add animation if not already present
    if (!document.getElementById('flash-animation')) {
        const style = document.createElement('style');
        style.id = 'flash-animation';
        style.textContent = `
            @keyframes flash-animation {
                0% { opacity: 0.3; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    gameBoard.appendChild(flashOverlay);

    // Remove after animation completes
    setTimeout(() => {
        if (flashOverlay.parentNode) {
            flashOverlay.parentNode.removeChild(flashOverlay);
        }
    }, 500);
}

// Send chat message
function sendChatMessage() {
    const message = chatInput.value.trim();
    console.log("message", message)
    if (message && socket) {
        socket.send(JSON.stringify({
            type: 'chat',
            message: message
        }));
        chatInput.value = '';
    }
}

// Add chat message to chat container
function addChatMessage(nickname, message) {
    const chatMsg = document.createElement('div');
    chatMsg.className = 'chat-message';
    chatMsg.innerHTML = `<strong>${nickname}:</strong> ${message}`;
    chatMessages.appendChild(chatMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Limit chat history
    while (chatMessages.childNodes.length > 50) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

// Reset game to join a new one
function resetGame() {
    // Clear all game data
    players.clear();
    map = [];
    bombs = [];
    explosions = [];
    powerUps = [];
    myPlayer = null;

    // Clear DOM elements
    gameBoard.innerHTML = '';

    // Go back to login screen
    showScreen('login');

    // Restore nickname from local storage if available
    const savedNickname = localStorage.getItem('nickname');
    if (savedNickname) {
        nicknameInput.value = savedNickname;
    }
}

// Add event listeners for touch controls (mobile support)
function setupTouchControls() {
    // Create touch controls container
    const touchControls = document.createElement('div');
    touchControls.id = 'touch-controls';
    touchControls.style.position = 'absolute';
    touchControls.style.bottom = '10px';
    touchControls.style.left = '50%';
    touchControls.style.transform = 'translateX(-50%)';
    touchControls.style.display = 'flex';
    touchControls.style.flexDirection = 'column';
    touchControls.style.alignItems = 'center';
    touchControls.style.zIndex = '1000';

    // Create D-pad
    const dpad = document.createElement('div');
    dpad.className = 'dpad';
    dpad.style.display = 'grid';
    dpad.style.gridTemplateColumns = 'repeat(3, 50px)';
    dpad.style.gridTemplateRows = 'repeat(3, 50px)';
    dpad.style.gap = '2px';

    // Create d-pad buttons
    const buttonStyles = {
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: '5px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '24px',
        userSelect: 'none',
        cursor: 'pointer'
    };

    // Add buttons to the d-pad
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        Object.assign(cell.style, buttonStyles);

        if (i === 1) { // Up
            cell.innerHTML = '&uarr;';
            cell.addEventListener('touchstart', () => { keyState.ArrowUp = true; });
            cell.addEventListener('touchend', () => { keyState.ArrowUp = false; });
        } else if (i === 3) { // Left
            cell.innerHTML = '&larr;';
            cell.addEventListener('touchstart', () => { keyState.ArrowLeft = true; });
            cell.addEventListener('touchend', () => { keyState.ArrowLeft = false; });
        } else if (i === 5) { // Right
            cell.innerHTML = '&rarr;';
            cell.addEventListener('touchstart', () => { keyState.ArrowRight = true; });
            cell.addEventListener('touchend', () => { keyState.ArrowRight = false; });
        } else if (i === 7) { // Down
            cell.innerHTML = '&darr;';
            cell.addEventListener('touchstart', () => { keyState.ArrowDown = true; });
            cell.addEventListener('touchend', () => { keyState.ArrowDown = false; });
        } else if (i === 4) { // Center - Bomb
            cell.innerHTML = '💣';
            cell.addEventListener('touchstart', () => {
                placeBomb();
                keyState.Space = true;
            });
            cell.addEventListener('touchend', () => { keyState.Space = false; });
        } else {
            cell.style.backgroundColor = 'transparent';
        }

        dpad.appendChild(cell);
    }

    touchControls.appendChild(dpad);
    gameScreen.appendChild(touchControls);

    // Only show touch controls on mobile
    if (isMobile()) {
        touchControls.style.display = 'flex';
    } else {
        touchControls.style.display = 'none';
    }
}

// Check if device is mobile
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Handle window resize
function handleResize() {
    // Only scale the game board if it's larger than the viewport
    const gameContainer = document.getElementById('game-container');
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (gameBoard && map.length > 0) {
        const boardWidth = map[0].length * TILE_SIZE;
        const boardHeight = map.length * TILE_SIZE;

        // Calculate scale to fit the game in the viewport
        let scale = 1;
        if (boardWidth > viewportWidth * 0.9 || boardHeight > viewportHeight * 0.8) {
            const scaleX = (viewportWidth * 0.9) / boardWidth;
            const scaleY = (viewportHeight * 0.8) / boardHeight;
            scale = Math.min(scaleX, scaleY);
        }

        // Apply scale transform
        gameBoard.style.transform = `scale(${scale})`;
        gameBoard.style.transformOrigin = 'top left';

        // Adjust container size
        if (gameContainer) {
            gameContainer.style.width = `${boardWidth * scale}px`;
            gameContainer.style.height = `${boardHeight * scale}px`;
        }
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    initGame();
    setupTouchControls();
    window.addEventListener('resize', handleResize);
});

// Export functions to be used in other modules
export {
    updatePlayerPosition,
    placeBomb,
    addChatMessage
};