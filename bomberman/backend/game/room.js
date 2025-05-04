import { GAME_STATES, MAX_PLAYERS } from './constants.js';

export default class Room {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.bombs = [];
        this.powerUps = [];
        this.state = GAME_STATES.WAITING;
        this.waitingTimeout = null;
        this.countdownTimeout = null;
        this.gameInterval = null;
        this.startTime = null;
        this.map = this.generateMap(15, 15);
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

    addPlayer(player) {
        this.players.set(player.id, player);
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
    }

    isFull() {
        return this.players.size >= MAX_PLAYERS;
    }

    isEmpty() {
        return this.players.size === 0;
    }
}