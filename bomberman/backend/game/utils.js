export function getStartingPosition(playerIndex, mapWidth, mapHeight) {
    const positions = [
        { x: 1, y: 1 },                     // Top-left
        { x: mapWidth - 2, y: 1 },          // Top-right
        { x: 1, y: mapHeight - 2 },         // Bottom-left
        { x: mapWidth - 2, y: mapHeight - 2 } // Bottom-right
    ];

    return positions[playerIndex] || positions[0];
} 