import { safeStringify } from "../utils/helpers.js";
import { SOCKET_TYPES } from "../config/protocols.js";

export default class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.started = false;
    this.powerups = {};
    this.countInterval = null;
    this.countP = null;
    this.map = null;
    this.tileSize = null;
  }

  addPlayer(player) {
    this.players.set(player.id, player);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.started) {
      const playersArray = Array.from(this.players.values());
      this.broadcast({
        type: SOCKET_TYPES.PLAYER_REMOVE,
        id: playerId,
        players: playersArray,
      });
      if (this.players.size === 1) {
        this.broadcast({
          type: SOCKET_TYPES.WINNER,
          name: this.players.values().next().value.nickname,
        });
        this.started = false;
      } else if (this.players.size === 0) {
        this.started = false;
      }
    }
  }

  broadcast(data) {
    for (const player of this.players.values()) {
      if (player.conn.readyState) {
        player.conn.send(safeStringify(data));
      }
    }
  }

  setMapData(map, tileSize) {
    this.map = map;
    this.tileSize = tileSize;
  }

  addpowerup(row, col, index) {
    const powerUpTypes = ["bomb", "speed", "fire"];
    const powerupType = powerUpTypes[index];
    this.powerups[`${row}_${col}`] = powerupType;
    this.broadcast({
      type: SOCKET_TYPES.ADD_POWERUP,
      position: { row, col },
      powerupType,
    });
  }

  removepowerup(row, col) {
    delete this.powerups[`${row}_${col}`];
    this.broadcast({
      type: SOCKET_TYPES.powerup_COLLECTED,
      position: { row, col },
    });
  }
}
