import { GAME_STATES, LIVES } from '../game/constants.js';
import { getStartingPosition } from '../game/utils.js';

export default class GameService {
    constructor() {
        this.games = new Map();
        this.powerUpTypes = ['bomb', 'flame', 'speed'];
    }

    handlePlayerJoin(room, player) {
        // Initialize game state for the room if it doesn't exist
        if (!this.games.has(room.id)) {
            this.games.set(room.id, {
                state: GAME_STATES.WAITING,
                players: new Map(),
                bombs: [],
                powerUps: [],
                map: this.generateMap(15, 15)
            });
        }

        const game = this.games.get(room.id);
        const playerIndex = game.players.size;
        const position = this.getStartingPosition(playerIndex, 15, 15);

        game.players.set(player.id, {
            id: player.id,
            nickname: player.nickname,
            x: position.x,
            y: position.y,
            lives: LIVES,
            bombs: 1,
            range: 1,
            speed: 1
        });

        // Broadcast updated player list
        this.broadcastToRoom(room, {
            type: 'player_joined',
            playerId: player.id,
            nickname: player.nickname,
            x: position.x,
            y: position.y,
            lives: LIVES,
            bombs: 1,
            range: 1,
            speed: 1
        });
    }

    startGame(room) {
        const game = this.games.get(room.id);
        if (!game || game.state !== GAME_STATES.COUNTDOWN) return;

        game.state = GAME_STATES.PLAYING;
        game.startTime = Date.now();

        // Assign starting positions
        let playerIndex = 0;
        for (const [playerId, player] of game.players.entries()) {
            const position = this.getStartingPosition(playerIndex, game.map[0].length, game.map.length);
            player.x = position.x;
            player.y = position.y;
            playerIndex++;
        }

        // Start game loop
        game.gameInterval = setInterval(() => {
            this.updateGame(room);
        }, 1000 / 60); // 60 FPS

        // Broadcast game start
        this.broadcastToRoom(room, {
            type: 'game_started',
            players: Array.from(game.players.entries()).map(([id, p]) => ({
                id,
                nickname: p.nickname,
                x: p.x,
                y: p.y,
                lives: p.lives,
                bombs: p.bombs,
                range: p.range,
                speed: p.speed
            })),
            map: game.map
        });
    }

    updateGame(room) {
        const game = this.games.get(room.id);
        if (!game || game.state !== GAME_STATES.PLAYING) return;

        // Update bomb timers and handle explosions
        const explodedBombs = [];
        for (let i = 0; i < game.bombs.length; i++) {
            const bomb = game.bombs[i];
            if (Date.now() >= bomb.placedAt + bomb.timer) {
                explodedBombs.push(bomb);
                game.bombs.splice(i, 1);
                i--;

                // Handle explosion
                const affectedTiles = this.getExplosionTiles(game, bomb);
                this.handleExplosion(game, room, bomb, affectedTiles);
            }
        }

        // Check power-up collection
        for (let i = 0; i < game.powerUps.length; i++) {
            const powerUp = game.powerUps[i];
            for (const [playerId, player] of game.players.entries()) {
                if (Math.floor(player.x) === powerUp.x && Math.floor(player.y) === powerUp.y) {
                    this.handlePowerUpCollection(game, room, playerId, powerUp);
                    game.powerUps.splice(i, 1);
                    i--;
                    break;
                }
            }
        }

        // Check win condition
        if (game.players.size <= 1 && game.state === GAME_STATES.PLAYING) {
            this.endGame(room);
        }
    }

    handleExplosion(game, room, bomb, affectedTiles) {
        // Check player damage
        for (const [playerId, player] of game.players.entries()) {
            for (const tile of affectedTiles) {
                if (Math.floor(player.x) === tile.x && Math.floor(player.y) === tile.y) {
                    player.lives--;
                    if (player.lives <= 0) {
                        game.players.delete(playerId);
                        this.broadcastToRoom(room, {
                            type: 'player_eliminated',
                            playerId
                        });
                    } else {
                        this.broadcastToRoom(room, {
                            type: 'player_damaged',
                            playerId,
                            livesLeft: player.lives
                        });
                    }
                    break;
                }
            }
        }

        // Destroy blocks and spawn power-ups
        for (const tile of affectedTiles) {
            if (game.map[tile.y][tile.x] === 1) {
                game.map[tile.y][tile.x] = 0;
                if (Math.random() < 0.3) {
                    const powerType = ['bomb', 'flame', 'speed'][Math.floor(Math.random() * 3)];
                    game.powerUps.push({
                        x: tile.x,
                        y: tile.y,
                        type: powerType
                    });
                }
            }
        }

        // Broadcast explosion
        this.broadcastToRoom(room, {
            type: 'explosion',
            x: bomb.x,
            y: bomb.y,
            range: bomb.range,
            tiles: affectedTiles,
            playerId: bomb.playerId
        });
    }

    handlePowerUpCollection(game, room, playerId, powerUp) {
        const player = game.players.get(playerId);
        if (!player) return;

        switch (powerUp.type) {
            case 'bomb': player.bombs++; break;
            case 'flame': player.range++; break;
            case 'speed': player.speed += 0.2; break;
        }

        this.broadcastToRoom(room, {
            type: 'powerup_collected',
            playerId,
            powerType: powerUp.type,
            x: powerUp.x,
            y: powerUp.y,
            newStats: {
                bombs: player.bombs,
                range: player.range,
                speed: player.speed
            }
        });
    }

    endGame(room) {
        const game = this.games.get(room.id);
        if (!game) return;

        clearInterval(game.gameInterval);
        game.state = GAME_STATES.ENDED;

        const winner = game.players.size === 1 ? Array.from(game.players.entries())[0][0] : null;
        const winnerNickname = winner ? game.players.get(winner).nickname : null;

        this.broadcastToRoom(room, {
            type: 'game_over',
            winner,
            winnerNickname
        });

        // Clean up after delay
        setTimeout(() => {
            this.games.delete(room.id);
        }, 60000);
    }

    getExplosionTiles(room, bomb) {
        const affectedTiles = [{ x: bomb.x, y: bomb.y }];
        const directions = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
        ];

        for (const dir of directions) {
            for (let i = 1; i <= bomb.range; i++) {
                const newX = bomb.x + (dir.dx * i);
                const newY = bomb.y + (dir.dy * i);

                if (newX < 0 || newX >= room.map[0].length ||
                    newY < 0 || newY >= room.map.length) {
                    break;
                }

                const tileType = room.map[newY][newX];

                if (tileType === 2) break;

                affectedTiles.push({ x: newX, y: newY });

                // if (tileType === 2) break;
            }
        }

        return affectedTiles;
    }

    handlePlayerMove(room, roomId, playerId, direction) {
        const game = this.games.get(roomId);
        if (!game || game.state !== GAME_STATES.PLAYING) return;

        const player = game.players.get(playerId);
        if (!player) return;

        let newX = player.x;
        let newY = player.y;

        switch (direction) {
            case 'up': newY -= player.speed * 0.1; break;
            case 'down': newY += player.speed * 0.1; break;
            case 'left': newX -= player.speed * 0.1; break;
            case 'right': newX += player.speed * 0.1; break;
        }

        // Check boundaries and collisions
        newX = Math.max(0, Math.min(game.map[0].length - 1, newX));
        newY = Math.max(0, Math.min(game.map.length - 1, newY));

        if (this.isWalkable(game, newX, newY)) {
            player.x = newX;
            player.y = newY;

            this.broadcastToRoom(room, {
                type: 'player_moved',
                playerId,
                x: player.x,
                y: player.y
            });
        }
    }

    handlePlaceBomb(room, roomId, playerId) {
        const game = this.games.get(roomId);
        if (!game || game.state !== GAME_STATES.PLAYING) return;

        const player = game.players.get(playerId);
        if (!player) return;

        // Check bomb limit
        const activeBombs = game.bombs.filter(b => b.playerId === playerId).length;
        if (activeBombs >= player.bombs) return;

        // Place bomb
        const bomb = {
            id: Date.now().toString(36),
            x: Math.floor(player.x),
            y: Math.floor(player.y),
            playerId,
            range: player.range,
            placedAt: Date.now(),
            timer: 3000
        };

        game.bombs.push(bomb);

        this.broadcastToRoom(room, {
            type: 'bomb_placed',
            bombId: bomb.id,
            x: bomb.x,
            y: bomb.y,
            playerId
        });
    }

    handlePlayerDisconnect(roomId, playerId) {
        const game = this.games.get(roomId);
        if (!game) return;

        game.players.delete(playerId);

        if (game.state === GAME_STATES.PLAYING && game.players.size <= 1) {
            this.endGame(room);
        }
    }

    generateMap(width, height) {
        const map = [];
        // Create empty map filled with 0 (empty spaces)
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                // 0 = empty, 1 = wall (indestructible), 2 = block (destructible)
                if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                    // Border walls
                    row.push(2);
                } else if (x % 2 === 0 && y % 2 === 0) {
                    // Inner walls in grid pattern
                    row.push(2);
                } else {
                    // Randomly place destructible blocks (70% chance)
                    // But ensure corners are clear for player starting positions
                    const isCornerArea =
                        (x <= 2 && y <= 2) || // Top-left
                        (x <= 2 && y >= height - 3) || // Bottom-left
                        (x >= width - 3 && y <= 2) || // Top-right
                        (x >= width - 3 && y >= height - 3); // Bottom-right

                    if (isCornerArea) {
                        row.push(0); // Keep corners empty
                    } else {
                        row.push(Math.random() < 0.7 ? 1 : 0);
                    }
                }
            }
            map.push(row);
        }

        return map;
    }

    getStartingPosition(playerIndex, mapWidth, mapHeight) {
        const positions = [
            { x: 1, y: 1 },                     // Top-left
            { x: mapWidth - 2, y: 1 },          // Top-right
            { x: 1, y: mapHeight - 2 },         // Bottom-left
            { x: mapWidth - 2, y: mapHeight - 2 } // Bottom-right
        ];
        return positions[playerIndex % positions.length];
    }

    isWalkable(game, x, y) {
        const tile = game.map[Math.floor(y)][Math.floor(x)];
        return tile === 0;
    }

    broadcastToRoom(room, message) {
        const data = JSON.stringify(message);
        room.players.forEach(player => {
            if (player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(data);
            }
        });
    }

    initialize() {
        const root = document.querySelector('.game-root') || document.body;
        this.createGameContainer();
        root.appendChild(this.gameContainer);
        this.connectToServer();
        this.setupEventListeners();
    }

    updateSidebar() {
        // Sidebar container
        if (!this.sidebar) {
            this.sidebar = document.createElement('div');
            this.sidebar.className = 'sidebar';
            // Append to .game-root, not to gameContainer!
            const root = document.querySelector('.game-root') || document.body;
            root.appendChild(this.sidebar);
        }
        // ... rest of your sidebar logic ...
    }
} 