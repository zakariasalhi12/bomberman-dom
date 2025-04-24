import { handleServerMessage } from "./events.js";

// Connect to backend WebSocket server
const socket = new WebSocket('ws://localhost:3000');

// Game state
let gameState = {
    players: [],
    map: [],
    playerId: null,
    roomId: null
};

// Connection handlers
socket.addEventListener('open', () => {
    console.log('Connected to backend server');

    // Join game after connection
    const nickname = localStorage.getItem('nickname') ||
        prompt('Enter your nickname:') ||
        `Player${Math.floor(Math.random() * 1000)}`;

    if (nickname) {
        socket.send(JSON.stringify({
            type: 'join_game',
            nickname: nickname
        }));
    }
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    console.log('Received from server:', data);
    handleServerMessage(data);
});

// The rest of your main.js code remains unchanged