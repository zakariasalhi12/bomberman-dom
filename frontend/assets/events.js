// client.js - Client-side code for Bomberman-DOM game
// This file should be placed in the public directory so the server can serve it

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
let ws = null;

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

// Connect to WebSocket server
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        // Attempt to reconnect after a short delay
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Join the game
function joinGame() {
    const nickname = nicknameInput.value.trim() || `Player${Math.floor(Math.random() * 1000)}`;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        // Wait for connection to establish
        setTimeout(() => {
            sendJoinRequest(nickname);
        }, 500);
    } else {
        sendJoinRequest(nickname);
    }
}

// Send join request to server
function sendJoinRequest(nickname) {
    ws.send(JSON.stringify({
        type: 'join_game',
        nickname
    }));

    showScreen('waiting');
}

// Handle server messages
export function handleServerMessage(data) {
    switch (data.type) {
        case 'joined_game':
            playerId = data.playerId;
            roomId = data.roomId;

            // Initialize players
            players.clear();
            data.players.forEach(player => {
                players.set(player.id, {
                    id: player.id,
                    nickname: player.nickname,
                    x: 0,
                    y: 0,
                    lives: 3,
                    bombs: 1,
                    range: 1,
                    speed: 1,
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
                    x: 0,
                    y: 0,
                    lives: 3,
                    bombs: 1,
                    range: 1,
                    speed: 1,
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
            if (players.has(data.playerId) && data.playerId !== playerId) {
                const player = players.get(data.playerId);
                player.x = data.x;
                player.y = data.y;
                updatePlayerPosition(player);
            }
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
                    tile.style.backgroundColor = '#666666'; // Gray wall
                    break;
                case 2: // Block
                    tile.style.backgroundColor = '#a67c52'; // Brown block
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
    });

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
            event.preventDefault();
            break;

        case 'ArrowDown':
        case 'KeyS':
            keyState.ArrowDown = true;
            event.preventDefault();
            break;

        case 'ArrowLeft':
        case 'KeyA':
            keyState.ArrowLeft = true;
            event.preventDefault();
            break;

        case 'ArrowRight':
        case 'KeyD':
            keyState.ArrowRight = true;
            event.preventDefault();
            break;

        case 'Space':
            // Place bomb
            if (!keyState.Space) {
                placeBomb();
            }
            keyState.Space = true;
            event.preventDefault();
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
        if (!hasCollision) {
            myPlayer.x = newX;
            myPlayer.y = newY;

            // Update DOM position
            updatePlayerPosition(myPlayer);

            // Send position update to server
            ws.send(JSON.stringify({
                type: 'move',
                x: myPlayer.x,
                y: myPlayer.y
            }));

            // Check for power-up collection
            checkPowerUpCollection();
        }
    }
}

// Update player's DOM element position
function updatePlayerPosition(player) {
    if (player.element) {
        player.element.style.left = `${player.x * TILE_SIZE}px`;
        player.element.style.top = `${player.y * TILE_SIZE}px`;
    }
}

// Update player stats display
function updatePlayerStats() {
    if (!myPlayer) return;

    const livesElem = document.getElementById('player-lives');
    const bombsElem = document.getElementById('player-bombs');
    const rangeElem = document.getElementById('player-range');
    const speedElem = document.getElementById('player-speed');

    if (livesElem) livesElem.textContent = `Lives: ${myPlayer.lives}`;
    if (bombsElem) bombsElem.textContent = `Bombs: ${myPlayer.bombs}`;
    if (rangeElem) rangeElem.textContent = `Range: ${myPlayer.range}`;
    if (speedElem) speedElem.textContent = `Speed: ${myPlayer.speed.toFixed(1)}x`;

    // Update lives indicator on player element
    if (myPlayer.element) {
        const livesContainer = myPlayer.element.querySelector('.lives-container');
        if (livesContainer) {
            livesContainer.innerHTML = '';
            for (let i = 0; i < myPlayer.lives; i++) {
                const life = document.createElement('div');
                life.className = 'life-indicator';
                life.style.width = '8px';
                life.style.height = '8px';
                life.style.borderRadius = '50%';
                life.style.backgroundColor = '#ff0000';
                life.style.margin = '0 2px';
                livesContainer.appendChild(life);
            }
        }
    }
}

// Check if player is collecting a power-up
// Check if player is collecting a power-up
function checkPowerUpCollection() {
    if (!myPlayer) return;

    const playerTileX = Math.floor(myPlayer.x);
    const playerTileY = Math.floor(myPlayer.y);

    for (const powerUp of powerUps) {
        if (powerUp.x === playerTileX && powerUp.y === playerTileY) {
            // Power-up automatically collected by server logic
            // The server will send a 'powerup_collected' message
            break;
        }
    }
}

// Place bomb at current player position
function placeBomb() {
    if (!myPlayer) return;

    // Check if player can place more bombs
    const activeBombs = bombs.filter(bomb => bomb.playerId === playerId).length;
    if (activeBombs >= myPlayer.bombs) return;

    const bombX = Math.floor(myPlayer.x);
    const bombY = Math.floor(myPlayer.y);

    // Check if there's already a bomb at this position
    for (const bomb of bombs) {
        if (Math.floor(bomb.x) === bombX && Math.floor(bomb.y) === bombY) {
            return;
        }
    }

    // Send bomb placement to server
    ws.send(JSON.stringify({
        type: 'place_bomb',
        x: bombX,
        y: bombY
    }));
}

// Send chat message
function sendChatMessage() {
    const message = chatInput.value.trim();

    if (message && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'chat_message',
            message
        }));

        chatInput.value = '';
    }
}

// Add chat message to chat container
export function addChatMessage(nickname, message) {
    const msgElement = document.createElement('div');
    msgElement.className = 'chat-message';
    msgElement.innerHTML = `<span class="chat-nickname">${nickname}:</span> ${message}`;
    console.warn(message, nickname);
    chatMessages.appendChild(msgElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Visual feedback for player damage
function flashScreen(color) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.opacity = '0.5';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    document.body.appendChild(overlay);

    // Fade out and remove
    setTimeout(() => {
        overlay.style.transition = 'opacity 500ms';
        overlay.style.opacity = '0';

        setTimeout(() => {
            document.body.removeChild(overlay);
        }, 500);
    }, 100);
}

// Reset game and return to login screen
function resetGame() {
    playerId = null;
    roomId = null;
    players.clear();
    map = [];
    bombs = [];
    explosions = [];
    powerUps = [];
    myPlayer = null;

    // Close WebSocket connection
    if (ws) {
        ws.close();
        ws = null;
    }

    // Clear game board
    if (gameBoard) {
        gameBoard.innerHTML = '';
    }

    // Show login screen
    showScreen('login');
}

// Initialize WebSocket connection
connectWebSocket();

// Initialize game
window.onload = initGame;