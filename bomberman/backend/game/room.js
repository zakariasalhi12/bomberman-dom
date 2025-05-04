import { GAME_STATES, MAX_PLAYERS } from './constants.js';

export default class Room {
    constructor(id, map) {
        this.id = id;
        this.players = new Map();
        this.bombs = [];
        this.powerUps = [];
        this.state = GAME_STATES.WAITING;
        this.waitingTimeout = null;
        this.countdownTimeout = null;
        this.gameInterval = null;
        this.startTime = null;
        this.map = map;
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