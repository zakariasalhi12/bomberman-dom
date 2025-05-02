import { handleServerMessage } from "./assets/events.js";

// Connect to backend WebSocket server
// Use the appropriate URL based on the environment
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.hostname}:3000`;
const socket = new WebSocket(wsUrl);

// Game state
let gameState = {
    players: [],
    map: [],
    playerId: null,
    roomId: null
};

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    console.log('Received from server:', data);
    handleServerMessage(data);
});

// Export the socket for use in other modules
export default socket;