import GameMap from '../models/gameMap.js';
import { safeStringify } from '../utils/helpers.js';
import { SOCKET_TYPES } from '../config/protocols.js';
import { logger } from '../utils/logger.js';

export default class GameService {

  startGame(room) {
    if (room.started) {
      logger.info(`Room ${room.id} already started`);
      return;
    }

    room.started = true;
    logger.info(`Game started at room ${room.id}`);

    const gameMap = new GameMap();
    const playersArray = Array.from(room.players.values());

    gameMap.initializePlayers(playersArray);
    room.setMapData(gameMap.map, gameMap.tileSize);

    for (const player of playersArray) {
      player.conn.send(safeStringify({
        type: SOCKET_TYPES.GAME_START,
        nickname: player.nickname,
        lives: player.lives,
        players: playersArray,
        MyId: player.id,
        map: gameMap.map,
      }));
    }
  }
}