// bomb.js
export default class Bomb {
    constructor(row, col, tileSize, timer, radius) {
      this.row = row;
      this.col = col;
      this.x = col * tileSize;
      this.y = row * tileSize;
      this.timer = timer;       // time left before explode
      this.radius = radius;     // explosion range
      this.exploded = false;
      this.tileSize = tileSize;
      this.canvas = null;
    }
  }
  