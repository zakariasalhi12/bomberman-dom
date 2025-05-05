import { WebSocketServer } from "ws";
import Player from "../models/player.js";
import { SOCKET_TYPES } from "../config/protocols.js";
import { logger } from "../utils/logger.js";

export default class WebSocketService {
  constructor(server, roomService, gameService) {
    this.wss = new WebSocketServer({ server });
    this.roomService = roomService;
    this.gameService = gameService;
  }

  initialize() {
    this.wss.on("connection", (ws) => {
      let currentPlayer;
      let currentRoom;

      ws.on("message", (message) => {
        let data;
        try {
          data = JSON.parse(message);
        } catch (err) {
          console.error("Invalid message:", err);
          return;
        }

        switch (data.type) {
          case SOCKET_TYPES.PLAYER_JOIN:
            const id = Date.now() + Math.floor(Math.random() * 1000);
            currentPlayer = new Player(data.nickname, id, ws);
            currentRoom = this.roomService.findAvailableRoom();
            currentRoom.addPlayer(currentPlayer);

            currentRoom.broadcast({
              type: SOCKET_TYPES.PLAYER_UPDATE,
              playerCount: currentRoom.players.size,
            });

            logger.info(
              `Player ${data.nickname} joined Room ${currentRoom.id}`
            );
            this.roomService.scheduleGameStart(currentRoom, this.gameService);
            break;

          case SOCKET_TYPES.PLAYER_MOVE:
            if (currentPlayer) currentPlayer.updateMove(data, currentRoom);
            break;

          case SOCKET_TYPES.PLAYER_PLACE_BOMB:
            if (currentPlayer) currentPlayer.placeBomb(currentRoom);
            break;

          case SOCKET_TYPES.PLAYER_HIT_BY_EXPLOSION:
            if (currentPlayer)
              currentPlayer.isPlayerHitByExplosion(data, currentRoom);
            break;

          case SOCKET_TYPES.PLAYER_CHAT:
            if (currentRoom) {
              currentRoom.broadcast({
                type: SOCKET_TYPES.PLAYER_CHAT,
                nickname: currentPlayer.nickname,
                messageText: data.messageText || "",
              });
            }
            break;

          default:
            logger.warn("Unknown message type:", data.type);
            break;
        }
      });

      ws.on("close", () => {
        if (currentRoom && currentPlayer) {
          currentRoom.removePlayer(currentPlayer.id);
          currentRoom.broadcast({
            type: SOCKET_TYPES.PLAYER_UPDATE,
            playerCount: currentRoom.players.size,
          });
        }
      });
    });
  }
}
