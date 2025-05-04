import express from 'express';
import { WebSocketServer } from 'ws';
import GameService from './services/gameService.js';
import RoomService from './services/roomService.js';
import WebSocketService from './services/websocketService.js';
import { Game } from './game/game.js';

const app = express();
const port = 8080;

// Initialize services
const gameService = new GameService();
const roomService = new RoomService(gameService);
const websocketService = new WebSocketService(roomService, gameService);

// Create WebSocket server
const wss = new WebSocketServer({ port });

console.log('Server is running at http://localhost:8080');

function broadcastToRoom(room, message, excludeSocket = null) {
    console.log('Broadcasting to room:', {
        roomId: room.id,
        messageType: message.type,
        playerCount: room.players.size
    });

    const messageStr = JSON.stringify(message);
    for (const player of room.players.values()) {
        if (player.socket !== excludeSocket) {
            player.socket.send(messageStr);
        }
    }
}

const game = new Game(broadcastToRoom);

wss.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received message:', message);

            switch (message.type) {
                case 'join':
                    console.log('Join request:', message);
                    game.joinPlayerToRoom(message, socket);
                    break;
                case 'move':
                    game.handleMove(message.roomId, message.playerId, message.direction);
                    break;
                case 'place_bomb':
                    game.handlePlaceBomb(message.roomId, message.playerId);
                    break;
                case 'chat':
                    game.handleChat(message.roomId, message.playerId, message.message);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    socket.on('close', () => {
        console.log('Client disconnected');
        game.handleDisconnect(socket);
    });
});

process.on('SIGINT', () => {
    console.log('Shutting down server...');
    wss.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
});