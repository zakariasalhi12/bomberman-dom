import { GlobalData } from "./globalconfig.js";



export function handleServerMessage(data) {
    switch (data.type) {
        case 'joined':
        case 'joined_game':
            GlobalData.playerId = data.playerId;
            GlobalData.roomId = data.roomId;

            // Initialize players
            GlobalData.players.clear();
            data.players.forEach(player => {
                GlobalData.players.set(player.id, {
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
            if (!GlobalData.players.has(data.playerId)) {
                GlobalData.players.set(data.playerId, {
                    id: data.playerId,
                    nickname: data.nickname,
                    x: data.x || 0,
                    y: data.y || 0,
                    lives: data.lives || 3,
                    bombs: data.bombs || 1,
                    range: data.range || 1,
                    speed: data.speed || 1,
                    color: PLAYER_COLORS[GlobalData.players.size % PLAYER_COLORS.length],
                    element: null // Will hold the DOM element for this player
                });

                updatePlayerCounter();
            }
            break;

        case 'player_left':
            // Remove player
            if (GlobalData.players.has(data.playerId) && GlobalData.players.get(data.playerId).element) {
                const playerElement = GlobalData.players.get(data.playerId).element;
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
            GlobalData.map = data.map;

            data.players.forEach(playerData => {
                if (GlobalData.players.has(playerData.id)) {
                    const player = GlobalData.players.get(playerData.id);
                    player.x = playerData.x;
                    player.y = playerData.y;
                    player.lives = playerData.lives;
                    player.bombs = playerData.bombs;
                    player.range = playerData.range;
                    player.speed = playerData.speed;

                    if (playerData.id === playerId) {
                        GlobalData.playerId = player;
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
            // if (GlobalData.players.has(data.playerId) && data.playerId !== playerId) {
            // }
            const player = GlobalData.players.get(data.playerId);
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
            GlobalData.bombs.push(bomb);
            addBombToBoard(bomb);
            break;

        case 'explosion':
            // Remove bomb
            const bombToRemove = GlobalData.bombs.find(b => b.x === data.x && b.y === data.y);
            if (bombToRemove && bombToRemove.element) {
                bombToRemove.element.remove();
            }
            GlobalData.bombs = GlobalData.bombs.filter(b => !(b.x === data.x && b.y === data.y));

            // Add explosion
            const explosion = {
                x: data.x,
                y: data.y,
                range: data.range,
                tiles: data.tiles,
                createdAt: Date.now(),
                elements: [] // Will hold DOM elements for this explosion
            };

            GlobalData.explosions.push(explosion);
            addExplosionToBoard(explosion);

            // Remove explosion after animation
            setTimeout(() => {
                explosion.elements.forEach(elem => {
                    if (elem && elem.parentNode) {
                        elem.parentNode.removeChild(elem);
                    }
                });
                GlobalData.explosions = GlobalData.explosions.filter(e => e !== explosion);
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
            if (data.playerId === GlobalData.playerId && GlobalData.players.has(GlobalData.playerId)) {
                const player = GlobalData.players.get(playerId);
                player.bombs = data.newStats.bombs;
                player.range = data.newStats.range;
                player.speed = data.newStats.speed;
                GlobalData.myplayer = player;
                updatePlayerStats();
            }
            break;

        case 'player_damaged':
            if (GlobalData.players.has(data.playerId)) {
                GlobalData.players.get(data.playerId).lives = data.livesLeft;

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
            if (GlobalData.players.has(data.playerId) && GlobalData.players.get(data.playerId).element) {
                const playerElement = GlobalData.players.get(data.playerId).element;
                if (playerElement && playerElement.parentNode) {
                    playerElement.parentNode.removeChild(playerElement);
                }
            }
            GlobalData.players.delete(data.playerId);
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