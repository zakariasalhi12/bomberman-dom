import { GAME_CONFIG } from "../config/gameConfig.js";

export default class GameMap {
  constructor() {
    this.map = JSON.parse(JSON.stringify(GAME_CONFIG.MAP));
    this.tileSize = 1;
    this.randomizeBricks();
  }

  randomizeBricks() {
    for (let i = 0; i < this.map.length; i++) {
      for (let j = 0; j < this.map[i].length; j++) {
        if (this.map[i][j] == 0) {
          if (Math.random() < 0.8) {
            this.map[i][j] = 2;
          }
        }
        if (this.map[i][j] == 9) {
          this.map[i][j] = 0;
        }
      }
    }
  }

  initializePlayers(players) {
    for (let i = 0; i < players.length; i++) {
      const pos = GAME_CONFIG.PLAYER_POSITIONS[i];
      if (pos) {
        const [row, col] = pos;
        this.map[row][col] = 5 + i;
        players[i].x = col;
        players[i].y = row;
      }
    }
  }
}