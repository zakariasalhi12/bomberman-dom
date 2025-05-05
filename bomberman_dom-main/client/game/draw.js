import TileMap from "./tileMap.js";

const worldTileSize = 1; // 1 unit in the world
const renderTileSize = 40; // Render size in pixels
const tileMap = new TileMap(renderTileSize);

function gameLoop() {
  tileMap.drawGame();
}

setInterval(gameLoop, 1000/60);
