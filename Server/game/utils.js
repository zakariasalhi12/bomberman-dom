export function getStartingPosition(playerIndex, mapWidth, mapHeight) {
    const positions = [
        { x: 1, y: 1 },
        { x: mapWidth - 2, y: 1 },
        { x: 1, y: mapHeight - 2 },
        { x: mapWidth - 2, y: mapHeight - 2 }
    ];

    return positions[playerIndex] || positions[0];
} 