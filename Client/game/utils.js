function getPowerUpImage(type) {
    switch (type) {
        case 'bomb': return './images/spoil_tileset.webp';
        case 'flame': return './images/explosion.png';
        case 'speed': return './images/speed.webp';
        default: return './images/powerup.png';
    }
}

function getTileBackground(cell) {
    switch (cell) {
        case 0: return '#2a2a2a';  
        case 1: return '#8b4513';  
        case 2: return '#4a4a4a';  
        default: return '#2a2a2a';
    }
}

function getTileType(cell) {
    switch (cell) {
        case 0: return 'tile-empty';
        case 1: return 'tile-block';    
        case 2: return 'tile-wall';    
        default: return 'tile-empty';
    }
}

function getTileImage(cell) {
    switch (cell) {
        case 2: return './images/wallBlack.png';  
        case 1: return './images/wall.png';      
        default: return null;                     
    }
}

export { getPowerUpImage, getTileBackground, getTileImage, getTileType }