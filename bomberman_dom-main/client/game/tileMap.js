import { MyEventSystem } from "../src/event.js";
import { createElement, jsx } from "../src/framework.js";
import { socket } from "./index.js";

export const playersElement = new Map();
export default class Game {
  constructor(tileSize, data) {
    this.tileSize = tileSize; // Pixel size of a tile for rendering
    this.players = data.players.length;
    this.wall = this.#image("wallBlack.png");
    this.bombs = [];
    this.MyId = data.MyId;
    this.map = data.map;
    this.canvas = null;
    this.controlsInitialized = false;
    this.keydownHandler = null;
    this.keyupHandler = null;
  }

  #image(fileName) {
    const img = new Image();
    img.src = `../images/${fileName}`;
    return img;
  }

  drawGame(canvas, data) {
    this.canvas = canvas;
    this.#setCanvasSize(canvas);
    this.#draw(canvas, data);
    this.#setupPlayerControls();
  }

  #draw(canvas, data) {
    const rows = this.map.length;
    const columns = this.map[0].length;

    canvas.innerHTML = "";
    canvas.style.display = "grid";
    canvas.style.gridTemplateRows = `repeat(${rows}, ${this.tileSize}px)`;
    canvas.style.gridTemplateColumns = `repeat(${columns}, ${this.tileSize}px)`;
    canvas.style.alignContent = "center";
    canvas.style.justifyContent = "center";
    canvas.style.position = "relative";

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const tile = this.map[row][column];
        const imgProps = {};
        let divStyle = "";
        let classname = "";
        let divId = "";

        switch (tile) {
          case 0:
            classname = "tile";
            break;
          case 1:
            imgProps.src = "../images/wallBlack.png";
            divId = "wallfix";
            classname = "tile";
            break;
          case 2:
            imgProps.src = "../images/wall.png";
            divId = "WallBreak";
            classname = "tile";
            break;
          case 5:
          case 6:
          case 7:
          case 8:
            classname = "tile";
            break;
          default:
            classname = "tile";
            break;
        }

        const imgnode = imgProps.src ? jsx("img", imgProps) : [];
        const divnode = jsx(
          "div",
          {
            className: classname,
            "data-row": row,
            "data-column": column,
            id: divId || `tile_${row}_${column}`,
            style: divStyle ? `background-image: ${divStyle}` : "",
          },
          imgnode
        );

        const div = createElement(divnode);
        canvas.appendChild(div);

        if (tile >= 5 && tile <= 8) {
          const playerIndex = tile - 5;
          const playerStyles = [
            "url('../images/playerStyle.png')",
            "url('../images/playerRed.png')",
            "url('../images/playerGreen.png')",
            "url('../images/playerYallow.png')",
          ];

          // Convert world units to pixels
          const playerX = data.players[playerIndex].x * this.tileSize;
          const playerY = data.players[playerIndex].y * this.tileSize;

          const playerVNode = jsx("div", {
            className: "player",
            id: `player_${data.players[playerIndex].id}`,
            style: `
                background-image: ${playerStyles[playerIndex]};
                width: ${Math.floor(this.tileSize * 0.8)}px;
                height: ${Math.floor(this.tileSize * 0.8)}px;
                position: absolute;
                z-index: 10;
                transform: translate(${playerX}px, ${playerY}px);
              `,
          });
          const playerDiv = createElement(playerVNode);
          playersElement.set(data.players[playerIndex].id, playerDiv);
          canvas.appendChild(playerDiv);
        }
      }
    }
  }

  #setCanvasSize(canvas) {
    canvas.style.height = `${this.map.length * this.tileSize}px`;
    canvas.style.width = `${this.map[0].length * this.tileSize}px`;
  }

  #setupPlayerControls() {
    if (this.controlsInitialized) {
      console.log("Controls are already initialized, using existing handlers");
      return;
    }

    let keysPressed = {};
    let lastUpdateTime = Date.now();
    let lastSendTime = 0;
    const updateInterval = 16;
    this.keydownHandler = (e) => {
      if (e.target.tagName == "INPUT" || e.target.tagName == "TEXTAREA") return;
      keysPressed[e.key] = true;

      if ((e.key === "b" || e.key === "B") && !e.repeat) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "placeBomb",
            })
          );
        }
      }
    };

    this.keyupHandler = (e) => {
      keysPressed[e.key] = false;
    };

    MyEventSystem.addEventListener(window, "keydown", this.keydownHandler);
    MyEventSystem.addEventListener(window, "keyup", this.keyupHandler);

    const updatePlayerMovement = () => {
      if (!this.controlsInitialized) {
        console.log("Controls are not initialized, skipping update");
        return;
      }

      const now = Date.now();
      const deltaTime = (now - lastUpdateTime) / 1000;
      lastUpdateTime = now;

      let direction;
      if (keysPressed["w"] || keysPressed["W"]) {
        direction = "up";
      }
      if (keysPressed["d"] || keysPressed["D"]) {
        direction = "right";
      }
      if (keysPressed["s"] || keysPressed["S"]) {
        direction = "down";
      }
      if (keysPressed["a"] || keysPressed["A"]) {
        direction = "left";
      }

      if (now - lastSendTime > updateInterval && direction) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "playerMove",
              direction: direction,
              deltaTime: deltaTime,
            })
          );
          lastSendTime = now;
        }
      }

      if (this.controlsInitialized) {
        requestAnimationFrame(updatePlayerMovement);
      }
    };

    this.controlsInitialized = true;
    updatePlayerMovement();
  }

  cleanup() {
    this.controlsInitialized = false;
    console.log("TileMap controls cleaned up");
  }
}
