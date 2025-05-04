import { GAME_STATES, MAX_PLAYERS, WAITING_TIMEOUT, COUNTDOWN_DURATION } from '../game/constants.js';
import Player from '../game/player.js';
import Room from '../game/room.js';

export default class RoomService {
    constructor(gameService) {
        this.rooms = new Map();
        this.gameService = gameService;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8);
    }

    findOrCreateRoom() {
        for (const room of this.rooms.values()) {
            if (room.state === GAME_STATES.WAITING && !room.isFull()) {
                return room;
            }
        }
        return this.createRoom();
    }

    createRoom() {
        const roomId = this.generateRoomId();
        const room = new Room(roomId);
        this.rooms.set(roomId, room);
        return room;
    }

    joinPlayerToRoom(playerData, socket) {
        const room = this.findOrCreateRoom();
        const playerId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const player = new Player(playerId, playerData.nickname, socket);

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
        // Ensure the game state is also set to COUNTDOWN
        const game = this.gameService.games.get(room.id);
        if (game) game.state = GAME_STATES.COUNTDOWN;

        // Broadcast countdown start to all players
        this.broadcastToRoom(room, {
            type: 'countdown_started',
            duration: COUNTDOWN_DURATION / 1000
        });

        // Start countdown timer
        let remainingTime = COUNTDOWN_DURATION / 1000;
        room.countdownInterval = setInterval(() => {
            remainingTime--;
            this.broadcastToRoom(room, {
                type: 'countdown_update',
                remainingTime
            });
        }, 1000);

        room.countdownTimeout = setTimeout(() => {
            clearInterval(room.countdownInterval);
            this.gameService.startGame(room);
        }, COUNTDOWN_DURATION);
    }

    handleDisconnect(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.players.delete(playerId);

        this.broadcastToRoom(room, {
            type: 'player_left',
            playerId,
            playerCount: room.players.size
        });

        if (room.players.size === 0) {
            if (room.waitingTimeout) clearTimeout(room.waitingTimeout);
            if (room.countdownTimeout) clearTimeout(room.countdownTimeout);
            if (room.countdownInterval) clearInterval(room.countdownInterval);
            if (room.gameInterval) clearInterval(room.gameInterval);
            this.rooms.delete(roomId);
        }
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

    broadcastToRoom(room, message, exclude) {
        const data = JSON.stringify({
            ...message,
            roomId: room.id
        });

        room.players.forEach(player => {
            if (player.socket !== exclude && player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(data);
            }
        });
    }
} 