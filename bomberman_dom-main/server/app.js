import http from "http";
import WebSocketService from "./services/websocketService.js";
import RoomService from "./services/roomService.js";
import GameService from "./services/gameService.js";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket game server is running.");
});

const roomService = new RoomService();
const gameService = new GameService();
const websocketService = new WebSocketService(server, roomService, gameService);

websocketService.initialize();

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
