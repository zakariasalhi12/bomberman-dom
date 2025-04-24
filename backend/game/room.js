import { GAME_STATES, MAX_PLAYERS } from './constants.js';

export default class Room {
    constructor(id, map) {
        this.id = id;
        this.map = map;
        this.state = GAME_STATES.WAITING;
        this.players = new Map();
        this.bombs = [];
        this.powerUps = [];
        this.waitingTimeout = null;
        this.countdownTimeout = null;
        this.gameInterval = null;
        this.startTime = null;
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
// module.exports = Room;

// // === Game.js ===
// const Room = require('./room.js');
// const Player = require('./player.js');
// const { GAME_STATES, MAX_PLAYERS, WAITING_TIMEOUT, COUNTDOWN_DURATION } = require('./constants');

// class Game {
//     constructor(broadcastCallback) {
//         this.rooms = new Map();
//         this.broadcastToRoom = broadcastCallback;
//     }

//     generateRoomId() {
//         return Math.random().toString(36).substring(2, 8);
//     }

//     generateMap(width, height) {
//         const map = [];
//         for (let y = 0; y < height; y++) {
//             const row = [];
//             for (let x = 0; x < width; x++) {
//                 row.push(Math.random() < 0.2 ? 1 : 0); // 1 = wall, 0 = floor
//             }
//             map.push(row);
//         }
//         return map;
//     }

//     createRoom() {
//         const roomId = this.generateRoomId();
//         const map = this.generateMap(15, 13);
//         const room = new Room(roomId, map);
//         this.rooms.set(roomId, room);
//         return room;
//     }

//     findOrCreateRoom() {
//         for (const room of this.rooms.values()) {
//             if (room.state === GAME_STATES.WAITING && !room.isFull()) {
//                 return room;
//             }
//         }
//         return this.createRoom();
//     }

//     joinPlayerToRoom(playerData, socket) {
//         const room = this.findOrCreateRoom();
//         const playerId = Date.now().toString(36) + Math.random().toString(36).substring(2);
//         const player = new Player(playerId, playerData.nickname, socket);
//         room.addPlayer(player);

//         if (room.players.size === 1) {
//             room.waitingTimeout = setTimeout(() => this.startCountdown(room), WAITING_TIMEOUT);
//         }

//         if (room.players.size === MAX_PLAYERS) {
//             clearTimeout(room.waitingTimeout);
//             this.startCountdown(room);
//         }

//         return { room, player };
//     }

//     startCountdown(room) {
//         if (room.state !== GAME_STATES.WAITING) return;
//         room.state = GAME_STATES.COUNTDOWN;
//         this.broadcastToRoom(room, { type: 'countdown', time: COUNTDOWN_DURATION });

//         room.countdownTimeout = setTimeout(() => {
//             this.startGame(room);
//         }, COUNTDOWN_DURATION);
//     }

//     startGame(room) {
//         if (room.state !== GAME_STATES.COUNTDOWN) return;
//         room.state = GAME_STATES.PLAYING;
//         room.startTime = Date.now();

//         this.broadcastToRoom(room, { type: 'start', map: room.map });
//     }

//     handleMove(roomId, playerId, direction) {
//         const room = this.rooms.get(roomId);
//         if (!room) return;

//         const player = room.players.get(playerId);
//         if (!player) return;

//         switch (direction) {
//             case 'up': player.y = Math.max(0, player.y - 1); break;
//             case 'down': player.y = Math.min(room.map.length - 1, player.y + 1); break;
//             case 'left': player.x = Math.max(0, player.x - 1); break;
//             case 'right': player.x = Math.min(room.map[0].length - 1, player.x + 1); break;
//         }

//         this.broadcastToRoom(room, { type: 'move', id: player.id, x: player.x, y: player.y }, player.socket);
//     }

//     handleDisconnect(socket) {
//         for (const room of this.rooms.values()) {
//             for (const [id, player] of room.players.entries()) {
//                 if (player.socket === socket) {
//                     room.removePlayer(id);
//                     this.broadcastToRoom(room, { type: 'leave', id });
//                     break;
//                 }
//             }

//             if (room.isEmpty()) {
//                 this.rooms.delete(room.id);
//             }
//         }
//     }
// }
// module.exports = Game;