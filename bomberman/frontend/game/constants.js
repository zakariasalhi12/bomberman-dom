// Game constants
export const LIVES = 3;
export const TILE_SIZE = 40;

// Animation constants
export const SPRITE_SIZE = 32;
export const SPRITE_SHEET_WIDTH = 96; // 3 frames per direction
export const FRAME_COUNT = 3;
export const FRAME_DURATION = 150; // Animation frame speed
export const MOVE_SPEED = 250; // Smooth animation speed
export const MOVE_INTERVAL = 100; // How often player can move

// Common sprite paths for all players
export const SPRITE_PATHS = {
    down: './images/move_down.png',
    up: './images/move_up.png',
    left: './images/move_left.png',
    right: './images/move_right.png'
};
