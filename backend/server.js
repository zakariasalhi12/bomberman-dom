import http from "http";
import { WebSocketServer } from "ws";
import { Game } from './game/game.js';

// Create plain HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running.\n');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize game
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

// Start the server
server.listen(3000, () => {
    console.log('Server running on port 3000');
});
