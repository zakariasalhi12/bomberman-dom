import express from "express";
import http from "http";
import { WebSocketServer } from "ws"; // Import WebSocketServer specifically
import { Game } from './game/game.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // Use WebSocketServer directly
// // Initialize game
const game = new Game((room, message, exclude) => {
    const data = JSON.stringify({
        ...message,
        roomId: room.id
    });

    room.players.forEach(player => {
        if (player.socket !== exclude && player.socket.readyState === WebSocket.OPEN) {
            player.socket.send(data);
        }
    });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
    let playerId = null;
    let roomId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            switch (data.type) {
                case 'join':
                    const result = game.joinPlayerToRoom(data, ws);
                    playerId = result.player.id;
                    roomId = result.room.id;
                    break;

                case 'move':
                    game.handleMove(roomId, playerId, data.direction);
                    break;

                case 'placeBomb':
                    game.handlePlaceBomb(roomId, playerId);
                    break;

                case 'chat':
                    game.handleChat(roomId, playerId, data.message);
                    break;
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        if (roomId && playerId) {
            game.handleDisconnect(roomId, playerId);
        }
    });
});

// Start backend server
server.listen(3000, () => {
    console.log('Backend server running on port 3000');
});