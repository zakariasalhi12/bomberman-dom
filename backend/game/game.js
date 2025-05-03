import Room from './room.js';
import Player from './player.js';
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

import { GAME_STATES, MAX_PLAYERS, WAITING_TIMEOUT, COUNTDOWN_DURATION, LIVES } from './constants.js';
import { match } from 'type-is';
// const { getStartingPosition } = require('../utils/utils.js');

const POWERUP_TYPES = ['bomb', 'flame', 'speed'];
const TILE_SIZE = 40;

export class Game {
    constructor(broadcastCallback) {
        this.rooms = new Map();
        this.broadcastToRoom = broadcastCallback;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8);
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

    createRoom() {
        const roomId = this.generateRoomId();
        const map = this.generateMap(15, 15);
        console.warn("map", map);
        const room = new Room(roomId, map);
        this.rooms.set(roomId, room);
        return room;
    }

    findOrCreateRoom() {
        for (const room of this.rooms.values()) {
            if (room.state === GAME_STATES.WAITING && !room.isFull()) {
                return room;
            }
        }
        return this.createRoom();
    }

    joinPlayerToRoom(playerData, socket) {
        const room = this.findOrCreateRoom();
        // console.warn(room)
        const playerId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const player = new Player(
            playerId,
            playerData.nickname,
            socket,
            {
                lives: LIVES,
                bombs: 1,
                range: 1,
                speed: 1
            }
        );

        room.addPlayer(player);

        // Send confirmation to the joining player
        socket.send(JSON.stringify({
            type: 'joined_game',
            playerId,
            roomId: room.id,
            players: Array.from(room.players.entries()).map(([id, p]) => ({
                id,
                nickname: p.nickname,
                x: p.x,
                y: p.y,
                lives: p.lives,
                bombs: p.bombs,
                range: p.range,
                speed: p.speed
            }))
        }));

        // Notify other players in the room
        this.broadcastToRoom(room, {
            type: 'player_joined',
            playerId,
            nickname: player.nickname,
            playerCount: room.players.size
        }, socket);

        // Start countdown logic
        if (room.players.size >= 2) {
            if (room.players.size === MAX_PLAYERS) {
                if (room.waitingTimeout) {
                    clearTimeout(room.waitingTimeout);
                    room.waitingTimeout = null;
                }
                this.startCountdown(room);
            } else if (!room.waitingTimeout) {
                room.waitingTimeout = setTimeout(() => {
                    room.waitingTimeout = null;
                    if (room.state === GAME_STATES.WAITING && room.players.size >= 2) {
                        this.startCountdown(room);
                    }
                }, WAITING_TIMEOUT);
            }
        }

        return { room, player };
    }

    startCountdown(room) {
        if (room.state !== GAME_STATES.WAITING) return;
        room.state = GAME_STATES.COUNTDOWN;

        this.broadcastToRoom(room, {
            type: 'countdown_started',
            duration: COUNTDOWN_DURATION / 1000
        });

        room.countdownTimeout = setTimeout(() => {
            this.startGame(room);
        }, COUNTDOWN_DURATION);
    }

    startGame(room) {
        if (room.state !== GAME_STATES.COUNTDOWN) return;
        room.state = GAME_STATES.PLAYING;
        room.startTime = Date.now();

        // Assign starting positions
        let playerIndex = 0;
        for (const [playerId, player] of room.players.entries()) {
            const position = getStartingPosition(playerIndex, room.map[0].length, room.map.length);
            player.x = position.x;
            player.y = position.y;
            playerIndex++;
        }

        // Start game loop
        room.gameInterval = setInterval(() => {
            this.updateGame(room);
        }, 1000 / 60); // 60 FPS
        this.broadcastToRoom(room, {
            type: 'game_started',
            players: Array.from(room.players.entries()).map(([id, player]) => ({
                id,
                nickname: player.nickname,
                x: player.x,
                y: player.y,
                lives: player.lives,
                bombs: player.bombs,
                range: player.range,
                speed: player.speed
            })),
            map: room.map
        });
    }

    updateGame(room) {
        // console.warn(room.map[])
        // Update bomb timers and handle explosions
        const explodedBombs = [];

        for (let i = 0; i < room.bombs.length; i++) {
            const bomb = room.bombs[i];

            // Check bomb explosion
            if (Date.now() >= bomb.placedAt + bomb.timer) {
                explodedBombs.push(bomb);
                room.bombs.splice(i, 1);
                i--;

                // Handle explosion
                const affectedTiles = this.getExplosionTiles(room, bomb);

                // Check player damage
                for (const [playerId, player] of room.players.entries()) {
                    for (const tile of affectedTiles) {
                        if (Math.floor(player.x) === tile.x && Math.floor(player.y) === tile.y) {
                            player.lives--;

                            if (player.lives <= 0) {
                                // Drop power-up when player dies
                                if (Math.random() < 0.5) {
                                    let powerType;
                                    if (player.bombs > 1 && Math.random() < 0.33) {
                                        powerType = 'bomb';
                                    } else if (player.range > 1 && Math.random() < 0.5) {
                                        powerType = 'flame';
                                    } else if (player.speed > 1) {
                                        powerType = 'speed';
                                    } else {
                                        powerType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                                    }

                                    room.powerUps.push({
                                        x: Math.floor(player.x),
                                        y: Math.floor(player.y),
                                        type: powerType
                                    });
                                }

                                // Remove player
                                room.players.delete(playerId);
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
                    // if (tile.x >= 0 && tile.x < room.map[0].length &&
                    //     tile.y >= 0 && tile.y < room.map.length) {
                    if (room.map[tile.y][tile.x] === 1) {
                        room.map[tile.y][tile.x] = 0;

                        if (Math.random() < 0.3) {
                            const powerType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                            room.powerUps.push({
                                x: tile.x,
                                y: tile.y,
                                type: powerType
                            });
                        }
                    }
                    // }
                }

                // Send explosion data
                this.broadcastToRoom(room, {
                    type: 'explosion',
                    x: bomb.x,
                    y: bomb.y,
                    range: bomb.range,
                    tiles: affectedTiles,
                    playerId: bomb.playerId
                });
            }
        }

        // Check power-up collection
        for (let i = 0; i < room.powerUps.length; i++) {
            const powerUp = room.powerUps[i];

            for (const [playerId, player] of room.players.entries()) {
                if (Math.floor(player.x) === powerUp.x && Math.floor(player.y) === powerUp.y) {
                    switch (powerUp.type) {
                        case 'bomb': player.bombs++; break;
                        case 'flame': player.range++; break;
                        case 'speed': player.speed += 0.2; break;
                    }

                    room.powerUps.splice(i, 1);
                    i--;

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
                    break;
                }
            }
        }

        // Check win condition
        if (room.players.size <= 1 && room.state === GAME_STATES.PLAYING) {
            this.endGame(room);
        }
    }

    endGame(room) {
        clearInterval(room.gameInterval);
        room.state = GAME_STATES.ENDED;

        const winner = room.players.size === 1 ? Array.from(room.players.entries())[0][0] : null;

        this.broadcastToRoom(room, {
            type: 'game_over',
            winner,
            winnerNickname: winner ? room.players.get(winner).nickname : null
        });

        // Clean up room after delay
        setTimeout(() => {
            this.rooms.delete(room.id);
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

    handleMove(roomId, playerId, direction) {
        const room = this.rooms.get(roomId);
        if (!room || room.state !== GAME_STATES.PLAYING) return;

        const player = room.players.get(playerId);
        if (!player) return;

        // Calculate new position based on direction and speed
        let newX = player.x;
        let newY = player.y;

        switch (direction) {
            case 'up': newY -= player.speed * 0.1; break;
            case 'down': newY += player.speed * 0.1; break;
            case 'left': newX -= player.speed * 0.1; break;
            case 'right': newX += player.speed * 0.1; break;
        }

        // Check boundaries and collisions
        newX = Math.max(0, Math.min(room.map[0].length - 1, newX));
        newY = Math.max(0, Math.min(room.map.length - 1, newY));


        if (this.isWalkable(room, newX, newY, direction)) {
            // console.warn("moved");
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

    handlePlaceBomb(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room || room.state !== GAME_STATES.PLAYING) return;

        const player = room.players.get(playerId);
        if (!player) return;

        // Check bomb limit
        const activeBombs = room.bombs.filter(b => b.playerId === playerId).length;
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

        room.bombs.push(bomb);

        this.broadcastToRoom(room, {
            type: 'bomb_placed',
            bombId: bomb.id,
            x: bomb.x,
            y: bomb.y,
            playerId
        }, player.socket);
    }

    handleChat(roomId, playerId, message) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.get(playerId);
        if (!player) return;

        this.broadcastToRoom(room, {
            type: 'chat_message',
            playerId,
            nickname: player.nickname,
            message: message.substring(0, 200)
        }, player.socket);
    }

    handleDisconnect(socket) {
        for (const room of this.rooms.values()) {
            for (const [playerId, player] of room.players.entries()) {
                if (player.socket === socket) {
                    room.players.delete(playerId);

                    this.broadcastToRoom(room, {
                        type: 'player_left',
                        playerId,
                        playerCount: room.players.size
                    });

                    if (room.state === GAME_STATES.PLAYING && room.players.size <= 1) {
                        this.endGame(room);
                    }

                    if (room.players.size === 0) {
                        if (room.waitingTimeout) clearTimeout(room.waitingTimeout);
                        if (room.countdownTimeout) clearTimeout(room.countdownTimeout);
                        if (room.gameInterval) clearInterval(room.gameInterval);
                        this.rooms.delete(room.id);
                    }
                    break;
                }
            }
        }
    }
    isWalkable(room, x, y, direction) {
        console.log(x, y, room.map[Math.floor(y)][Math.ceil(x)]);

        // Check boundaries
        if (x < 0 || y < 0 || y > 13 || x > 13) {
            console.warn("bondaries");
            return false;
        }
        let tile = null;
        switch (direction) {
            case "up":
                tile = room.map[Math.floor(y)][Math.floor(x)];
                break;
            case "down":
                tile = room.map[Math.ceil(y)][Math.ceil(x)];
                break;
            case "left":
                tile = room.map[Math.ceil(y)][Math.floor(x)];
                break;
            case "right":
                tile = room.map[Math.floor(y)][Math.ceil(x)];
                break;

        }
        // Check tile type
        if (tile === 1 || tile === 2) {

            return false; // Wall or destructible block
        }

        // Check if another player is on the tile
        // for (const player of room.players.values()) {
        //     if (Math.floor(player.x) === x && Math.floor(player.y) === y) {
        //         console.warn("other player")
        //         return false;
        //     }
        // }

        // // TODO: optionally check for bombs
        // for (const bomb of room.bombs) {
        //     if (bomb.x === x && bomb.y === y) {
        //         return false;
        //     }
        // }

        return true;
    }

}

// Generate starting positions for players
export function getStartingPosition(playerIndex, mapWidth, mapHeight) {
    const positions = [
        { x: 1, y: 1 },                     // Top-left
        { x: mapWidth - 2, y: 1 },          // Top-right
        { x: 1, y: mapHeight - 2 },         // Bottom-left
        { x: mapWidth - 2, y: mapHeight - 2 } // Bottom-right
    ];

    return positions[playerIndex] || positions[0];
}

// // export { Game };
// function checkcollision(map, playerstate) {

// }
