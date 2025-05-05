import { LoginPage, GamePage, gameState, Ref } from "../app/config.js";
import { jsx, createElement } from "../src/framework.js";
import { render, updateRender } from "../src/vdom.js";
import { MyEventSystem } from "../src/event.js";
import { Router } from "../src/router.js";
import TileMap from "./tileMap.js";
import { playersElement } from "./tileMap.js";
import createSpriteAnimator from "./spriteAnimator.js";

const router = new Router({
  "/": () => [LoginPage()],
});

router.init();

let waitingContainer = null;

export function waiting(element) {
  waitingContainer = element;
  const waitingContent = jsx(
    "div",
    {},
    jsx("p", { id: "playercount" }, `Players: ${gameState.playerCount}/4`),
    jsx(
      "div",
      { className: "waiting-animation" },
      jsx("img", {
        src: "/images/bomberman3d.gif",
        alt: "Waiting...",
        style: "margin-top: 10px;",
      }),
      jsx("p", {}, "Looking for a match...")
    )
  );
  render(waitingContent, element);
}

export let socket;
export function connectToGameServer(name) {
  const host = window.location.hostname;
  socket = new WebSocket(`ws://${host}:8080`);
  socket.onopen = () => {
    console.log("Connected to WebSocket server");
    socket.send(
      JSON.stringify({
        type: "newPlayer",
        nickname: name,
      })
    );
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    // console.log(data);
    handleServerMessages(data);
  };

  socket.onclose = () => {
    console.log("Disconnected from WebSocket server");
  };
}
let tileMap;
function handleServerMessages(data) {
  const tileSize = 40;
  if (data.type == "startGame") {
    tileMap = new TileMap(tileSize, data);
  }
  switch (data.type) {
    case "updatePlayers":
      updatePlayerCount(data.playerCount, data.playerId, data.countP);
      break;
    case "startGame":
      startGame(data, tileMap);
      break;
    case "chatMsg":
      displayMsg(data);
      break;
    case "playerMove":
      updateOtherPlayerPosition(data);
      break;
    case "drawBomb":
      drawBomb(data.position.row, data.position.col);
      break;
    case "removeBomb":
      removeBomb(data.position.row, data.position.col);
      break;
    case "destroyWall":
      destroyWall(
        data.position.row,
        data.position.col,
        data.gift,
        data.index,
        data.frames
      );
      break;
    case "drawExplosion":
      drawExplosion(data.position.row, data.position.col, data.frames);
      break;
    case "HitByExplosion":
      socket.send(JSON.stringify(data));
      break;
    case "playerDead":
      animationPlayerDead(data);
      break;
    case "hearts":
      hearts(data);
      break;
    case "powerupCollected":
      powerupCollected(data);
      break;
    case "playerStatsUpdate":
      updatePlayerStats(data);
      notificationPower(data);
      break;
    case "brodcastplayerinfo":
      broadcastPlayerInfo(data);
      break;
    case "theWinnerIs":
      setTimeout(() => {
        socket.close();
      }, 5000);
      theWinnerIs(data);
      break;
    case "removePlayer":
      console.log("Player removed:", data.id);
      removePlayer(data.id);
      broadcastPlayerInfo(data);
      break;
    default:
      break;
  }
}

function removePlayer(id) {
  const playerElement = playersElement.get(id);
  if (playerElement) {
    playerElement.remove();
    playersElement.delete(id);
  }
}
function theWinnerIs(data) {
  let gamepage = Ref.gamePageRef.current;
  const winScreen = jsx(
    "div",
    { id: "popup-msg", className: "popup", ref: Ref.popupRef },
    jsx("h2", {}, `🎉 The winner is: ${data.name} 🎉`),
    jsx(
      "button",
      {
        className: "play-again-btn",
        onclick: (e) => {
          gameState.name = "";
          e.preventDefault();
          router.navigate("/");
        },
      },
      "Play Again"
    )
  );
  render(winScreen, gamepage);
}

function notificationPower(data) {
  let notificationsEle = Ref.notificationsRef.current;
  if (!notificationsEle) return;

  // let notification = jsx("div", { className: "power-notification"})

  if (data.bombPower) {
    notificationsEle.innerHTML = "💣 Bomb Power increased!";
    notificationsEle.style.borderLeft = "4px solid #ff6b6b";
  } else if (data.speed) {
    notificationsEle.innerHTML = "⚡ Speed boost activated!";
    notificationsEle.style.borderLeft = "4px solid #4ecdc4";
  } else if (data.fire) {
    notificationsEle.innerHTML = "🔥 Fire Range increased!";
    notificationsEle.style.borderLeft = "4px solid #ffa502";
  } else {
    return;
  }

  setTimeout(() => {
    // notificationsEle.removeChild(elementToRemove);
    notificationsEle.innerHTML = "";
  }, 3000);
}

function updatePlayerStats(data) {
  const status = Ref.StatusRef.current;
  const statsNode = jsx(
    "div",
    { className: "stella-status" },
    jsx(
      "h3",
      { style: "color:rgb(0, 0, 0); margin-bottom: 8px;" },
      "✨ Stella's Power Stats ✨"
    ),
    jsx(
      "div",
      { style: "list-style: none; padding: 0; margin: 0;" },
      jsx("p", {}, `💣 Bomb Power: ${data.bombPower}`),
      jsx("p", {}, `⚡ Speed: ${data.speed}`),
      jsx("p", {}, `🔥 Fire Range: ${data.fire}`)
    )
  );
  updateRender(statsNode, status);
}

function powerupCollected(data) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(
    canvas,
    data.position.row,
    data.position.col
  );
  if (tileElement) {
    tileElement.innerHTML = "";
  }
}

function hearts(data) {
  const hearts = Ref.hearts.current;

  console.log("data.Id", data.Id);
  if (hearts.lastElementChild) {
    hearts.lastElementChild.remove();
  }
  console.log("hearts", hearts);
  console.log("heartsData", data);
}

function animationPlayerDead(data) {
  let playerElement = playersElement.get(data.Id);
  playerElement.style.backgroundImage = `url('../images/player_dead.png')`;

  if (!playerElement) {
    console.log("player not found", data.Id);
    return;
  }

  const deathFrames = [
    { x: -17, y: 1 }, // Frame 1
    { x: -55, y: 1 }, // Frame 2
    { x: -91, y: 1 }, // Frame 3
    { x: -126, y: 1 }, // Frame 4
    { x: -162, y: 1 }, // Frame 5
    { x: -198, y: 1 }, // Frame 6
    { x: -235, y: 1 }, // Frame 7
  ];

  let currentFrame = 0;
  const frameDuration = 100;

  const animateDeath = () => {
    if (currentFrame >= deathFrames.length) {
      playerElement.remove();
      return;
    }

    playerElement.style.backgroundPositionX = `${deathFrames[currentFrame].x}px`;
    playerElement.style.backgroundPositionY = `${deathFrames[currentFrame].y}px`;
    currentFrame++;

    setTimeout(animateDeath, frameDuration);
  };

  animateDeath();
}

const playerAnimator = createSpriteAnimator({
  spriteWidth: 28,
  spriteHeight: 40,
  frameIndices: [0, 1, 2, 3],
  frameSlow: 6,
  directionRows: {
    right: 1,
    left: 3,
    up: 2,
    down: 4,
  },
});

function updateOtherPlayerPosition(data) {
  let playerElement = playersElement.get(data.Id);
  if (!playerElement) {
    console.log("player not found", data.Id);
    return;
  }

  const sprite = playerAnimator.getSpritePosition(data.direction);
  playerElement.style.backgroundPosition = `${sprite.x}px ${sprite.y}px`;

  // Convert world units to pixels
  const pixelX = data.position.x * 40; // 40 is the default tileSize
  const pixelY = data.position.y * 40;

  playerElement.style.transform = `translate(${pixelX}px, ${pixelY}px)`;
}

function updatePlayerCount(count, playerId, countP) {
  gameState.playerCount = count;
  let progressText = "";
  if (countP === null) {
    progressText = "Game...";
  } else {
    progressText =
      countP < 20
        ? `Game starting soon... ${countP}s`
        : "Game starting soon...";
  }
  if (waitingContainer) {
    const updatedWaitingContent = jsx(
      "div",
      {},
      jsx("p", { id: "playercount" }, `Players: ${count}/4`),
      jsx(
        "div",
        { className: "waiting-animation" },
        jsx("img", {
          src: "/images/bomberman3d.gif",
          alt: "Waiting...",
          style: "margin-top: 10px;",
        }),
        jsx("p", {}, progressText)
      )
    );

    updateRender(updatedWaitingContent, waitingContainer);
  }
}

function startGame(data, tileMap) {
  console.log(data.players);

  let count = 10;
  const interval = setInterval(() => {
    count--;
    const updatedWaitingContent = jsx(
      "div",
      {},
      jsx("p", { id: "playercount" }, `start Game in : ${count}s`),
      jsx(
        "div",
        { className: "waiting-animation" },
        jsx("img", {
          src: "/images/bomberman3d.gif",
          alt: "Waiting...",
          style: "margin-top: 10px;",
        }),
        jsx("p", {}, "")
      )
    );

    updateRender(updatedWaitingContent, waitingContainer);
    if (count == 0) {
      GoToGame(data, tileMap);
      clearInterval(interval);
    }
  }, 1000);
}
let currentTileMap = null;

function GoToGame(data, tileMap) {
  if (currentTileMap) {
    currentTileMap.cleanup();
  }

  const body = document.body;
  render(GamePage(), body);

  let game = Ref.gameCanvasRef.current; //document.getElementById("game");
  function gameLoop() {
    tileMap.drawGame(game, data);
  }
  requestAnimationFrame(gameLoop);
  currentTileMap = tileMap;

  broadcastPlayerInfo(data);
  chat(data.nickname);
}

function chat(nickname) {
  const sendButton = Ref.buttonRef.current;
  MyEventSystem.addEventListener(sendButton, "click", () => {
    sendMessage(nickname);
  });
}
export function sendMessage(nickname) {
  const messageText = Ref.chatRef.current.value.trim();
  if (messageText !== "") {
    socket.send(
      JSON.stringify({
        type: "chatMsg",
        nickname: nickname,
        messageText: messageText,
      })
    );
    Ref.chatRef.current.value = "";
  }
}

function displayMsg(data) {
  const messageContainer = Ref.messagesRef.current;

  const newMessage = jsx(
    "div",
    { className: "message" },
    jsx("div", { className: "player-name" }, data.nickname),
    jsx("div", { className: "message-text" }, data.messageText)
  );
  messageContainer.appendChild(createElement(newMessage));
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

////////////////////////////////////////////////////bombs

function drawBomb(row, col) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);
  if (tileElement && !hasclass(tileElement, "bomb")) {
    const bombDiv = jsx("div", {
      className: "bomb",
      style:
        "background-image: url('../images/bomb.png'); width: 38px; height: 38px; z-index: 5; left: 50%; top: 50%;",
    });
    const bombElement = createElement(bombDiv);
    tileElement.appendChild(bombElement);
  }
}

function removeBomb(row, col) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);
  const bombImg = hasclass(tileElement, "bomb");
  if (bombImg) {
    tileElement.innerHTML = "";
  }
}

function destroyWall(row, col, gift, index, frames) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);
  if (tileElement) {
    if (gift) {
      const power = [
        "../images/spoil_tileset.webp",
        "../images/speed.webp",
        "../images/bombing.webp",
      ];
      tileElement.innerHTML =
        '<img src="' +
        power[index] +
        '" style="width: 38px; height: 38px; position: absolute; top: 0; left: 0;">';
    } else {
      tileElement.innerHTML = "";
      drawExplosion(row, col, frames);
    }
  }
}

const explosionAnimator = createSpriteAnimator({
  spriteWidth: 38,
  spriteHeight: 38,
  frameIndices: [0, 1, 2, 3, 4],
  frameSlow: 6,
  directionRows: {
    top: 0,
    down: 1,
  },
});

function drawExplosion(row, col, direction = "top") {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);

  const frameDuration = 75;
  let animationTicks = 0;
  const totalTicks =
    explosionAnimator.frameIndices.length * explosionAnimator.frameSlow;

  const explosionDiv = jsx("div", {
    className: "damage",
    style: `background-image: url('../images/explosion.png');
            width: 38px;
            height: 38px;
            z-index: 6;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background-position: 0px 0px;`,
  });

  const explosionElement = createElement(explosionDiv);
  tileElement.appendChild(explosionElement);

  const animate = () => {
    if (animationTicks >= totalTicks) {
      explosionElement.remove();
      return;
    }

    const { x, y } = explosionAnimator.getSpritePosition(direction);

    explosionElement.style.backgroundPosition = `-${x}px -${y}px`;

    animationTicks++;

    setTimeout(animate, frameDuration);
  };

  animate();
}

// Helper function to check if a child has a .bomb div
function hasclass(tile, className) {
  for (let i = 0; i < tile.children.length; i++) {
    if (tile.children[i].classList.contains(className)) {
      return true;
    }
  }
  return false;
}

function Selectbyrowcol(canvas, row, col) {
  let tileElement = null;
  for (let i = 0; i < canvas.children.length; i++) {
    const child = canvas.children[i];
    if (
      child.dataset &&
      child.dataset.row === String(row) &&
      child.dataset.column === String(col)
    ) {
      tileElement = child;
      break;
    }
  }
  return tileElement;
}

function broadcastPlayerInfo(data) {
  const playersElement = Ref.playersRef.current;
  const images = [
    "../images/bluecaracter.png",
    "../images/redcaracter.png",
    "../images/greencaracter.png",
    "../images/yellowcaracter.png",
  ];

  const playerList = data.players.map((player, index) => {
    return jsx(
      "li",
      { id: `${player.id}` },
      `${player.nickname} - Lives: ${player.lives == 0 ? "dead" : player.lives
      }`,
      jsx("img", {
        src: images[index],
        alt: "player",
        style: `width: 30px; height: 30px; margin-left: 10px;`,
      })
    );
  });
  const showPlayersTitle = jsx("p", {}, "Players:");

  const playerListContainer = jsx(
    "ul",
    { className: "connected-players" },
    ...playerList
  );

  const wrapper = jsx("div", {}, showPlayersTitle, playerListContainer);
  updateRender(wrapper, playersElement);

  //   updateRender(playerList, playersElement);
}

////////////////////////////////////////////////////////
