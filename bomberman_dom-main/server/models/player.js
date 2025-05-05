import { safeStringify } from "../utils/helpers.js";
import { logger } from "../utils/logger.js";
import { SOCKET_TYPES } from "../config/protocols.js";
export default class Player {
  constructor(nickname, id, conn, room) {
    this.room = room;
    this.x = 0;
    this.y = 0;
    this.nickname = nickname;
    this.id = id;
    this.conn = conn;
    this.size = 1;
    this.lives = 3;
    this.speed = 6;
    this.isMoving = false;
    this.isDead = false;
    this.direction = "up";
    this.movementStartTime = null;
    this.fireRange = 1;
    this.maxBombs = 1;
    this.placedBombCount = 0;
    this.collisionPadding = 0.1;
  }

  loseLife() {
    if (this.isDead) return;
    this.lives -= 1;
    if (this.lives == 0) {
      this.isDead = true;
    }
  }

  updateMove(data, room) {
    if (this.isDead) return;
    const deltaTime = data.deltaTime || 0.016;
    const moveSpeed = this.speed * deltaTime;
    const prevX = this.x;
    const prevY = this.y;

    switch (data.direction) {
      case "up":
        this.y = Math.max(0, this.y - moveSpeed);
        this.direction = "up";
        this.isMoving = true;
        break;
      case "down":
        this.y = Math.min(room.map.length - this.size, this.y + moveSpeed);
        this.direction = "down";
        this.isMoving = true;
        break;
      case "left":
        this.x = Math.max(0, this.x - moveSpeed);
        this.direction = "left";
        this.isMoving = true;
        break;
      case "right":
        this.x = Math.min(room.map[0].length - this.size, this.x + moveSpeed);
        this.direction = "right";
        this.isMoving = true;
        break;
      default:
        this.isMoving = false;
        break;
    }

    if (this._checkCollision(room)) {
      this.x = prevX;
      this.y = prevY;
    } else {
      this._checkpowerupCollection(room);
    }

    if (this.isMoving) {
      const moveData = {
        type: SOCKET_TYPES.PLAYER_MOVE,
        position: {
          x: this.x,
          y: this.y,
        },
        direction: this.direction,
        Id: this.id,
      };

      room.broadcast(moveData);
    }
  }

  _checkCollision(room) {
    const playerLeft = this.x + this.collisionPadding;
    const playerTop = this.y + this.collisionPadding;
    const playerRight = this.x + this.size - this.collisionPadding;
    const playerBottom = this.y + this.size - this.collisionPadding;

    const minTileX = Math.floor(playerLeft);
    const maxTileX = Math.ceil(playerRight);
    const minTileY = Math.floor(playerTop);
    const maxTileY = Math.ceil(playerBottom);

    for (let y = minTileY; y < maxTileY; y++) {
      for (let x = minTileX; x < maxTileX; x++) {
        if (y >= 0 && y < room.map.length && x >= 0 && x < room.map[0].length) {
          const tileType = room.map[y][x];

          if (tileType === 1 || tileType === 2 || tileType === 3) {
            if (
              playerRight > x &&
              playerLeft < x + 1 &&
              playerBottom > y &&
              playerTop < y + 1
            ) {
              return true; 
            }
          }
        }
      }
    }
    return false;
  }

  placeBomb(room) {
    if (this.isDead || this.placedBombCount >= this.maxBombs) {
      return;
    }

    const row = Math.floor(this.y + this.size / 2);
    const col = Math.floor(this.x + this.size / 2);

    const frames = [
      { x: -5, y: 0 },
      { x: -40, y: 0 },
      { x: -75, y: 0 },
      { x: -112, y: 0 },
      { x: -146, y: 0 },
      { x: -75, y: 36 },
      { x: -112, y: 36 },
      { x: -146, y: 36 },
    ];

    this.placedBombCount++;
    this._drawBomb(row, col, room);

    setTimeout(() => {
      this._removeBomb(row, col, room);
      this._destroyWall(row, col, frames, room);
    }, 3000);
  }

  _drawBomb(row, col, room) {
    if (room.map[row][col] === 3) return;
    setTimeout(() => {
      room.map[row][col] = 3;
    }, 800);
    room.broadcast({
      type: SOCKET_TYPES.PUT_BOMB,
      position: { row, col },
    });
  }

  _removeBomb(row, col, room) {
    room.map[row][col] = 0;
    this.placedBombCount--;
    room.broadcast({
      type: SOCKET_TYPES.REMOVE_BOMB,
      position: { row, col },
    });
  }

  _destroyWall(row, col, frames, room) {
    room.broadcast({
      type: SOCKET_TYPES.EXPLOSION,
      position: { row, col },
      frames,
    });

    room.broadcast({
      type: SOCKET_TYPES.PLAYER_HIT_BY_EXPLOSION,
      row,
      col,
    });

    const baseDirections = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];

    baseDirections.forEach(({ dr, dc }) => {
      for (let i = 1; i <= this.fireRange; i++) {
        const newRow = row + dr * i;
        const newCol = col + dc * i;

        if (
          newRow < 0 ||
          newRow >= room.map.length ||
          newCol < 0 ||
          newCol >= room.map[0].length
        ) {
          break;
        }

        room.broadcast({
          type: SOCKET_TYPES.EXPLOSION,
          position: { row: newRow, col: newCol },
          frames,
        });

        room.broadcast({
          type: SOCKET_TYPES.PLAYER_HIT_BY_EXPLOSION,
          row: newRow,
          col: newCol,
        });

        if (room.map[newRow][newCol] === 2) {
          room.map[newRow][newCol] = 0;
          if (Math.random() < 0.3) {
            const index = Math.floor(Math.random() * 3);
            room.addpowerup(newRow, newCol, index);
            room.broadcast({
              type: SOCKET_TYPES.WALL_DESTROY,
              position: { row: newRow, col: newCol },
              gift: true,
              index,
              frames,
            });
          } else {
            room.broadcast({
              type: SOCKET_TYPES.WALL_DESTROY,
              position: { row: newRow, col: newCol },
              gift: false,
              frames,
            });
          }
          break;
        } else if (
          room.map[newRow][newCol] !== 0 &&
          room.map[newRow][newCol] < 5
        ) {
          break;
        }
      }
    });
  }

  isPlayerHitByExplosion(data, room) {
    const playerCenterX = this.x + this.size / 2;
    const playerCenterY = this.y + this.size / 2;
    const playerTileRow = Math.floor(playerCenterY);
    const playerTileCol = Math.floor(playerCenterX);

    if (data.row === playerTileRow && data.col === playerTileCol) {
      this.loseLife();
      this.conn.send(
        safeStringify({
          type: SOCKET_TYPES.PLAYER_LIVES,
          Id: this.id,
          hearts: this.lives,
        })
      );

      const playersArray = Array.from(room.players.values());
      room.broadcast({
        type: SOCKET_TYPES.PLAYER_DATA,
        players: playersArray,
      });

      this.checkPlayerWin(room, Array.from(room.players));
      if (this.isDead) {
        room.broadcast({
          type: SOCKET_TYPES.PLAYER_DEATH,
          Id: this.id,
        });
      }
    }
  }

  checkPlayerWin(room, players) {
    const alivePlayers = players.filter(([_, player]) => player.lives > 0);

    if (alivePlayers.length === 1) {
      room.started = false;
      room.broadcast({
        type: SOCKET_TYPES.WINNER,
        name: alivePlayers[0][1].nickname,
      });
    } else if (alivePlayers.length === 0) {
      logger.info(`room: ${this.room} Draw!`);
    }
  }

  _checkpowerupCollection(room) {
    const playerCenterX = this.x + this.size / 2;
    const playerCenterY = this.y + this.size / 2;
    const playerTileX = Math.floor(playerCenterX);
    const playerTileY = Math.floor(playerCenterY);

    const powerupKey = `${playerTileY}_${playerTileX}`;
    if (room.powerups && room.powerups[powerupKey]) {
      const powerupType = room.powerups[powerupKey];
      this.collectpowerup(powerupType);

      room.broadcast({
        type: SOCKET_TYPES.COLLECT_POWERUP,
        position: { row: playerTileY, col: playerTileX },
        playerId: this.id,
        powerupType,
      });
      room.removepowerup(playerTileY, playerTileX);
    }
  }

  collectpowerup(powerupType) {
    switch (powerupType) {
      case "bomb":
        this.maxBombs = Math.min(this.maxBombs + 1, 5);
        break;
      case "speed":
        this.speed = Math.min(this.speed + 1, 16);
        break;
      case "fire":
        this.fireRange = Math.min(this.fireRange + 1, 5);
        break;
      default:
        logger.warn(`Unknown powerup type: ${powerupType}`);
        return;
    }

    this.sendPlayerStatsUpdate();
  }

  sendPlayerStatsUpdate() {
    this.conn.send(
      safeStringify({
        type: SOCKET_TYPES.PLAYER_STATS,
        bombPower: this.maxBombs,
        speed: this.speed,
        fire: this.fireRange,
      })
    );
  }
}
