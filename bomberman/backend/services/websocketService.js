import { WebSocketServer, WebSocket } from "ws";

export default class WebSocketService {
    constructor(roomService, gameService) {
        this.roomService = roomService;
        this.gameService = gameService;
    }

    handleConnection(ws) {
        console.log('New client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                this.handleMessage(ws, data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            this.handleDisconnect(ws);
        });
    }

    handleMessage(ws, data) {
        switch (data.type) {
            case 'join':
                this.handleJoin(ws, data);
                break;
            case 'move':
                this.handleMove(ws, data);
                break;
            case 'place_bomb':
                this.handlePlaceBomb(ws, data);
                break;
            case 'chat':
                this.handleChat(ws, data);
                break;
        }
    }

    handleJoin(ws, data) {
        const { room, player } = this.roomService.joinPlayerToRoom(data, ws);
        this.gameService.handlePlayerJoin(room, player);
    }

    handleMove(ws, data) {
        const { roomId, playerId, direction } = data;
        const room = this.roomService.rooms.get(roomId);
        this.gameService.handlePlayerMove(room, roomId, playerId, direction);
    }

    handlePlaceBomb(ws, data) {
        const { roomId, playerId } = data;
        const room = this.roomService.rooms.get(roomId);
        this.gameService.handlePlaceBomb(room, roomId, playerId);
    }

    handleChat(ws, data) {
        const { roomId, playerId, message } = data;
        this.roomService.handleChat(roomId, playerId, message);
    }

    handleDisconnect(ws) {
        // Find the room and player associated with this WebSocket
        for (const [roomId, room] of this.roomService.rooms.entries()) {
            for (const [playerId, player] of room.players.entries()) {
                if (player.socket === ws) {
                    this.roomService.handleDisconnect(roomId, playerId);
                    this.gameService.handlePlayerDisconnect(roomId, playerId);
                    return;
                }
            }
        }
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