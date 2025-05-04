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

// Graceful shutdown handler
let isShuttingDown = false;

async function cleanup() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('Starting graceful shutdown...');

    // Close all WebSocket connections
    wss.clients.forEach(client => {
        try {
            client.send(JSON.stringify({ type: 'server_shutdown' }));
            client.close();
        } catch (e) {
            console.error('Error closing client connection:', e);
        }
    });

    // Clean up game resources
    try {
        game.cleanup();
    } catch (e) {
        console.error('Error cleaning up game:', e);
    }

    // Close WebSocket server
    return new Promise((resolve) => {
        wss.close(() => {
            console.log('WebSocket server closed');
            resolve();
        });
    });
}

// Handle different termination signals
process.on('SIGINT', async () => {
    console.log('Received SIGINT signal');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal');
    await cleanup();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await cleanup();
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await cleanup();
    process.exit(1);
});