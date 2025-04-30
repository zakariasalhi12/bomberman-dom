import { PlayerMovement, movePlayers, } from "../components/players.js";
import { socket } from "../public/code.js";
import { gameOver } from "./lives.js";
import { ActivatePowerUp } from "../components/powerUps.js";

export let currentLevel;


//https://stackoverflow.com/questions/19764018/controlling-fps-with-requestanimationframe

let stop = false;
let fps = 60,
  fpsInterval,
  startTime,
  now,
  then,
  elapsed;
let duration = 0;

export function startAnimating(fps) {
  fpsInterval = 1000 / fps;
  then = window.performance.now();
  startTime = then;
  animate(fpsInterval);
}

// let duration = 0;
function animate(newtime) {
  // stop
  if (stop) {
    return;
  }

  // request another frame

  let frame = requestAnimationFrame(animate);

  // calc elapsed time since last loop

  now = newtime;
  elapsed = now - then;

  // if enough time has elapsed, draw the next frame

  if (elapsed > fpsInterval) {
    // Get ready for next frame by setting then=now, but...
    // Also, adjust for fpsInterval not being multiple of 16.67
    then = now - (elapsed % fpsInterval);

    // draw stuff here

    // draw player movement
    if (socket != null) {
      if (duration % 10 == 0) {
        PlayerMovement(socket);
      }
      ActivatePowerUp(socket)
      movePlayers()
      duration++
      throttle(gameOver(socket), 50)
    }
  }
}

export function changeStopValue() {
  stop = true;
}
export const debounce = (func, wait) => {
  let debounceTimer
  return function (eve) {
    const context = this
    const args = arguments
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => func.apply(context, args), wait)
    return debounceTimer
  }
}

function throttle(fn, threshold) {
  threshold = threshold || 16.67 * 3;
  var last, deferTimer;

  return function () {
    var now = +new Date, args = arguments;
    if (last && now < last + threshold) {
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function () {
        last = now;
        fn.apply(this, args);
      }, threshold);
    } else {
      last = now;
      fn.apply(this, args);
    }
  }
}