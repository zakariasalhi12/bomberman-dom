import { jsx, useState, useRef, useEffect, Div, H2, Input, Button, P, Ul, Li, Span } from '../framework/index.js';
import componentStack from '../framework/core/componentStack.js';

// Game constants
const LIVES = 3;
const TILE_SIZE = 40;

function GameApp() {
    // Set component title
    const COMPONENT_TITLE = 'GameApp';
    componentStack.push(COMPONENT_TITLE);

    // --- State ---
    const [nickname, setNickname] = useState('');
    const [joined, setJoined] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [playerId, setPlayerId] = useState(null);
    const [roomId, setRoomId] = useState(null);
    const [players, setPlayers] = useState([]); // array of player objects
    const [map, setMap] = useState(null);
    const [bombs, setBombs] = useState([]); // array of bomb objects
    const [powerUps, setPowerUps] = useState([]); // array of powerup objects
    const [countdown, setCountdown] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);
    const [statusType, setStatusType] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [gameOver, setGameOver] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);
    const [playerPositions, setPlayerPositions] = useState(new Map());
    const gameStateRef = useRef({
        isMoving: false,
        lastUpdate: Date.now(),
        moveInterval: 100, // ms between moves
    });

    // --- Refs ---
    const socketRef = useRef(null);
    const statusTimeoutRef = useRef(null);

    // Clean up component stack
    componentStack.pop();

    // --- WebSocket Connection ---
    function connectToServer() {
        if (socketRef.current) {
            socketRef.current.close();
        }

        console.log('Connecting to WebSocket server...');
        const socket = new WebSocket('ws://localhost:8080');
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('WebSocket connection established');
            setWaiting(false);
            joinGame(nickname);
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Raw WebSocket message:', event.data);
            handleServerMessage(data);
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed');
            setStatusMsg('Disconnected from server');
            setStatusType('left');
            socketRef.current = null;
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            setStatusMsg('Connection error');
            setStatusType('error');
        };
    }

    // --- Event Handlers ---
    function handleInput(e) {
        setNickname(e.target.value);
    }

    function handleJoin(e) {
        e.preventDefault();
        if (nickname.trim()) {
            setJoined(true);
            setWaiting(true);
            connectToServer();
            setShowSidebar(false);
        }
    }

    function sendMessage(message) {
        const socket = socketRef.current;
        if (socket && socket.readyState === window.WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }

    function joinGame(nickname) {
        console.log('Joining game with nickname:', nickname);
        sendMessage({ type: 'join', nickname });
    }

    function placeBomb() {
        sendMessage({ type: 'place_bomb', roomId, playerId });
    }

    function handleKeyDown(event) {
        if (!roomId || !playerId || gameStateRef.current.isMoving) return;

        const now = Date.now();
        if (now - gameStateRef.current.lastUpdate < gameStateRef.current.moveInterval) return;

        let direction = null;
        switch (event.key) {
            case 'ArrowUp': direction = 'up'; break;
            case 'ArrowDown': direction = 'down'; break;
            case 'ArrowLeft': direction = 'left'; break;
            case 'ArrowRight': direction = 'right'; break;
            case ' ': placeBomb(); return;
        }

        if (direction) {
            gameStateRef.current.isMoving = true;
            gameStateRef.current.lastUpdate = now;

            // Predict movement
            const currentPlayer = players.find(p => p.id === playerId);
            if (currentPlayer) {
                const newPos = calculateNewPosition(currentPlayer, direction);
                if (isValidMove(newPos)) {
                    sendMessage({ type: 'move', roomId, playerId, direction });
                }
            }

            setTimeout(() => {
                gameStateRef.current.isMoving = false;
            }, gameStateRef.current.moveInterval);
        }
    }

    function calculateNewPosition(player, direction) {
        const pos = { x: player.x, y: player.y };
        switch (direction) {
            case 'up': pos.y -= 1; break;
            case 'down': pos.y += 1; break;
            case 'left': pos.x -= 1; break;
            case 'right': pos.x += 1; break;
        }
        return pos;
    }

    function isValidMove(pos) {
        if (!map) return false;

        // Check boundaries
        if (pos.x < 0 || pos.x >= map[0].length || pos.y < 0 || pos.y >= map.length) {
            return false;
        }

        // Check walls and blocks
        const tile = map[Math.floor(pos.y)][Math.floor(pos.x)];
        if (tile === 1 || tile === 2) {
            return false;
        }

        // Check other players
        const playerCollision = players.some(p =>
            p.x === Math.floor(pos.x) && p.y === Math.floor(pos.y)
        );

        // Check bombs
        const bombCollision = bombs.some(b =>
            b.x === Math.floor(pos.x) && b.y === Math.floor(pos.y)
        );

        return !playerCollision && !bombCollision;
    }

    // --- Server Message Handler ---
    function handleServerMessage(data) {
        console.log('Handling server message:', data);

        try {
            switch (data.type) {
                case 'joined_game':
                    console.log('Player joined game:', data);
                    setPlayerId(data.playerId);
                    setRoomId(data.roomId);
                    if (data.map) {
                        console.log('Setting initial map:', data.map);
                        setMap(data.map);
                    }
                    if (data.players) {
                        console.log('Setting initial players:', data.players);
                        setPlayers(data.players.map(p => ({
                            ...p,
                            x: p.x || 1,
                            y: p.y || 1
                        })));
                    }
                    setShowSidebar(true);
                    break;

                case 'player_joined':
                    console.log('New player joined:', data);
                    setStatusMsg(`${data.nickname} joined the game!`);
                    setStatusType('joined');
                    setPlayers(prev => {
                        if (prev.some(p => p.id === data.playerId)) {
                            return prev;
                        }
                        return [...prev, {
                            id: data.playerId,
                            nickname: data.nickname,
                            x: data.x,
                            y: data.y,
                            lives: data.lives || LIVES,
                            bombs: data.bombs || 1,
                            range: data.range || 1,
                            speed: data.speed || 1
                        }];
                    });
                    break;

                case 'player_left':
                    console.log('Player left:', data);
                    setStatusMsg(`${data.nickname || 'A player'} left the game.`);
                    setStatusType('left');
                    setPlayers(prev => prev.filter(p => p.id !== data.playerId));
                    break;

                case 'game_started':
                    console.log('Game started:', data);
                    setCountdown(null);
                    setWaiting(false);
                    if (data.map) {
                        console.log('Setting game map:', data.map);
                        console.log('Map structure:', {
                            isArray: Array.isArray(data.map),
                            length: data.map.length,
                            firstRow: data.map[0],
                            isFirstRowArray: Array.isArray(data.map[0])
                        });
                        setMap(data.map);
                    } else {
                        console.error('No map data in game_started message');
                    }
                    if (data.players) {
                        console.log('Setting players with positions:', data.players);
                        setPlayers(data.players.map(p => ({
                            ...p,
                            x: p.x || 1,
                            y: p.y || 1
                        })));
                    }
                    setShowSidebar(true);
                    break;

                case 'player_moved':
                    console.log('Player moved:', data);
                    setPlayers(prev => prev.map(p =>
                        p.id === data.playerId
                            ? { ...p, x: data.x, y: data.y }
                            : p
                    ));
                    break;

                case 'bomb_placed':
                    console.log('Bomb placed:', data);
                    setBombs(prev => [...prev, {
                        id: data.bombId,
                        x: data.x,
                        y: data.y,
                        playerId: data.playerId,
                        placedAt: Date.now()
                    }]);
                    break;

                case 'explosion':
                    console.log('Explosion:', data);
                    setBombs(prev => prev.filter(b => b.id !== data.bombId));
                    if (data.tiles) {
                        setMap(prev => {
                            if (!prev) return prev;
                            const newMap = prev.map(row => [...row]);
                            data.tiles.forEach(tile => {
                                if (newMap[tile.y] && newMap[tile.y][tile.x] === 1) {
                                    newMap[tile.y][tile.x] = 0;
                                }
                            });
                            return newMap;
                        });
                    }
                    break;

                case 'countdown_started':
                    console.log('Countdown started:', data);
                    setCountdown(data.duration);
                    setWaiting(false);
                    break;
                case 'countdown_update':
                    console.log('Countdown update:', data);
                    setCountdown(data.remainingTime);
                    break;
                case 'player_damaged':
                    setPlayers((prev) => prev.map(p => p.id === data.playerId ? { ...p, lives: data.livesLeft } : p));
                    break;
                case 'player_eliminated':
                    setPlayers((prev) => prev.filter(p => p.id !== data.playerId));
                    setStatusMsg('A player was eliminated!');
                    setStatusType('eliminated');
                    break;
                case 'powerup_collected':
                    setPlayers((prev) => prev.map(p => p.id === data.playerId ? { ...p, ...data.newStats } : p));
                    setStatusMsg('Power-up collected!');
                    setStatusType('powerup');
                    break;
                case 'game_over':
                    setGameOver(data);
                    break;
                case 'chat_message':
                    setChatMessages((prev) => [...prev, data]);
                    break;
            }
        } catch (error) {
            console.error('Error handling server message:', error, error.stack);
            setStatusMsg('Error processing game update');
            setStatusType('error');
        }
    }

    // Add debug logging for state changes
    useEffect(() => {
        console.log('Game state updated:', {
            joined,
            waiting,
            playerId,
            roomId,
            players,
            map,
            countdown,
            showSidebar
        });
    }, [joined, waiting, playerId, roomId, players, map, countdown, showSidebar]);

    // Add state change debugging
    useEffect(() => {
        console.log('Game state changed:', {
            map,
            players,
            bombs,
            powerUps,
            countdown,
            gameOver,
            waiting,
            joined
        });
    }, [map, players, bombs, powerUps, countdown, gameOver, waiting, joined]);

    // Add game state effect
    useEffect(() => {
        if (map && players.length > 0) {
            console.log('Game state updated:', {
                mapSize: [map[0].length, map.length],
                playerCount: players.length,
                currentPlayerId: playerId
            });
        }
    }, [map, players, playerId]);

    // Add keyboard event handling
    useEffect(() => {
        if (joined && !waiting && !gameOver) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [joined, waiting, gameOver, roomId, playerId, map, players]);

    // Status message fade out
    if (statusMsg) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => {
            setStatusMsg(null);
            setStatusType('');
        }, 3500);
    }

    // Add debug render information
    console.log('Current state:', {
        nickname,
        joined,
        waiting,
        playerId,
        roomId,
        players,
        map,
        countdown,
        statusMsg,
        showSidebar
    });

    // --- UI Components ---
    function LoginForm() {
        return Div({ className: 'login-form' }, [
            H2({}, 'Bomberman Dom'),
            jsx('form', { onsubmit: handleJoin }, [
                Input({
                    type: 'text',
                    placeholder: 'Enter your nickname',
                    value: nickname,
                    oninput: handleInput,
                    required: true,
                    style: { marginBottom: '12px', width: '200px' }
                }),
                Button({ type: 'submit' }, 'Join Game')
            ])
        ]);
    }

    function WaitingScreen() {
        return Div({
            className: 'waiting-screen',
            style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                padding: '40px',
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                boxShadow: '0 4px 32px rgba(0, 0, 0, 0.25)'
            }
        }, [
            jsx('img', {
                src: './images/output-waiting.gif',
                alt: 'Waiting...',
                className: 'waiting-gif',
                style: {
                    width: '200px',
                    height: '200px',
                    objectFit: 'contain',
                    marginBottom: '20px'
                }
            }),
            P({
                className: 'waiting-msg',
                style: {
                    fontSize: '24px',
                    color: '#fff',
                    marginBottom: '10px'
                }
            }, 'Looking for a match...'),
            P({
                className: 'player-count',
                style: {
                    fontSize: '18px',
                    color: '#aaa'
                }
            }, [
                'Players: ',
                jsx('span', {
                    id: 'player-count-num',
                    style: { color: '#fff', fontWeight: 'bold' }
                }, players.length || 1),
                '/4'
            ])
        ]);
    }

    function Countdown() {
        return countdown !== null && Div({ className: 'countdown' }, `Game starting in ${countdown}...`);
    }

    function GameOverScreen() {
        if (!gameOver) return null;
        return Div({ className: 'game-over' }, [
            jsx('h1', {}, 'Game Over'),
            jsx('p', {}, gameOver.winner ? `Winner: ${gameOver.winnerNickname}` : 'Draw!'),
            Button({ onclick: () => window.location.reload() }, 'Play Again')
        ]);
    }

    function GameStatusMessage() {
        return statusMsg && Div({ className: `game-status-message ${statusType}` }, statusMsg);
    }

    function renderMap() {
        if (!map) return null;

        return Div({
            className: 'game-board'
        }, [
            Div({
                className: 'game-map',
                style: {
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(15, 40px)',
                    gridTemplateRows: 'repeat(15, 40px)',
                    gap: '0px',
                    padding: '0px',
                    backgroundColor: '#333',
                    borderRadius: '8px',
                    boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.3)'
                }
            }, [
                ...map.flatMap((row, y) =>
                    row.map((cell, x) => {
                        const tileType = getTileType(cell);
                        const tileImage = getTileImage(cell);
                        return Div({
                            className: `tile ${tileType}`,
                            style: {
                                width: '40px',
                                height: '40px',
                                position: 'relative',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: getTileBackground(cell),
                                border: '1px solid #444'
                            }
                        }, [
                            tileImage && jsx('img', {
                                src: tileImage,
                                alt: tileType,
                                style: {
                                    width: '32px',
                                    height: '32px',
                                    objectFit: 'contain'
                                }
                            })
                        ]);
                    })
                )
            ])
        ]);
    }

    function getTileBackground(cell) {
        switch (cell) {
            case 0: return '#2a2a2a';  // Empty tile
            case 1: return '#8b4513';  // Destructible block
            case 2: return '#4a4a4a';  // Indestructible wall
            default: return '#2a2a2a';
        }
    }

    function getTileType(cell) {
        switch (cell) {
            case 0: return 'tile-empty';
            case 1: return 'tile-block';    // Destructible block
            case 2: return 'tile-wall';     // Indestructible wall
            default: return 'tile-empty';
        }
    }

    function getTileImage(cell) {
        switch (cell) {
            case 2: return './images/wallBlack.png';  // Indestructible wall
            case 1: return './images/wall.png';       // Destructible block
            default: return null;                     // Empty space
        }
    }

    function renderPlayers() {
        if (!map || !players.length) {
            console.log('No map or players to render');
            return null;
        }

        console.log('Rendering players:', players);
        return Div({
            className: 'players-container',
            style: {
                position: 'absolute',
                top: '20px',  // Match the game board padding
                left: '20px', // Match the game board padding
                width: 'calc(100% - 40px)', // Account for padding
                height: 'calc(100% - 40px)', // Account for padding
                pointerEvents: 'none'
            }
        }, players.map((player, idx) => {
            console.log(`Rendering player ${idx}:`, player);
            const playerImages = [
                './images/redcaracter.png',
                './images/bluecaracter.png',
                './images/greencaracter.png',
                './images/yellowcaracter.png'
            ];

            return Div({
                className: `player player-${idx + 1}`,
                key: player.id,
                style: {
                    position: 'absolute',
                    left: `${player.x * TILE_SIZE + TILE_SIZE / 2}px`,
                    top: `${player.y * TILE_SIZE + TILE_SIZE / 2}px`,
                    transform: 'translate(-50%, -50%)',
                    width: '36px',
                    height: '36px',
                    zIndex: '100'
                }
            }, [
                jsx('img', {
                    src: playerImages[idx % playerImages.length],
                    alt: `Player ${idx + 1}`,
                    style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                    }
                }),
                Div({
                    className: 'player-nickname',
                    style: {
                        position: 'absolute',
                        top: '-20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                        color: 'white',
                        textShadow: '0 0 4px black',
                        fontSize: '12px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                    }
                }, player.nickname)
            ]);
        }));
    }

    function renderPlayerList() {
        return Ul({
            className: 'player-list'
        }, players.map(player => {
            const isCurrentPlayer = player.id === playerId;
            return Li({
                className: `player-list-item ${isCurrentPlayer ? 'current-player' : ''}`,
                key: player.id
            }, [
                jsx('img', {
                    className: 'player-avatar',
                    src: './images/playerStyle.png',
                    alt: player.nickname
                }),
                Span({}, player.nickname),
                Span({ className: 'player-stats' }, [
                    ...Array(player.lives).fill(null).map((_, i) =>
                        jsx('img', {
                            key: i,
                            className: 'heart-icon',
                            src: './images/heart.png',
                            alt: 'life'
                        })
                    ),
                    ` B:${player.bombs} R:${player.range} S:${player.speed.toFixed(1)}`
                ])
            ]);
        }));
    }

    function renderChat() {
        return Div({ className: 'chat-container' }, [
            Div({ className: 'chat-messages' },
                chatMessages.map((msg, i) =>
                    Div({ className: 'chat-message', key: i }, [
                        Span({ className: 'chat-nick' }, msg.nickname + ': '),
                        Span({ className: 'chat-text' }, msg.message)
                    ])
                )
            ),
            jsx('form', {
                className: 'chat-form',
                onsubmit: (e) => {
                    e.preventDefault();
                    const input = e.target.elements[0];
                    const message = input.value.trim();
                    if (message) {
                        sendMessage({
                            type: 'chat',
                            roomId,
                            playerId,
                            message
                        });
                        input.value = '';
                    }
                }
            }, [
                Input({
                    className: 'chat-input',
                    type: 'text',
                    placeholder: 'Type a message...',
                    maxLength: 200
                })
            ])
        ]);
    }

    function renderBomb(bomb) {
        return Div({
            className: 'bomb',
            key: bomb.id,
            style: {
                left: `${bomb.x * TILE_SIZE}px`,
                top: `${bomb.y * TILE_SIZE}px`
            }
        }, [
            jsx('img', {
                src: './images/bomb.png',
                alt: 'bomb',
                style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                }
            })
        ]);
    }

    function renderPowerUp(powerUp) {
        const powerUpImages = {
            'bomb': './images/bomb.png',
            'flame': './images/explosion.png',
            'speed': './images/speed.webp'
        };

        return Div({
            className: `powerup powerup-${powerUp.type}`,
            key: `${powerUp.x}-${powerUp.y}`,
            style: {
                left: `${powerUp.x * TILE_SIZE}px`,
                top: `${powerUp.y * TILE_SIZE}px`
            }
        }, [
            jsx('img', {
                src: powerUpImages[powerUp.type],
                alt: powerUp.type,
                style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                }
            })
        ]);
    }

    // --- Main Render ---
    return Div({ className: 'game-app' }, [
        !joined && LoginForm(),
        joined && waiting && WaitingScreen(),
        joined && Countdown(),
        joined && !waiting && !gameOver && Div({
            className: 'game-container'
        }, [
            Div({
                className: 'game-board-container'
            }, [
                GameStatusMessage(),
                renderMap(),
                renderPlayers(),
                bombs.map(bomb => renderBomb(bomb)),
                powerUps.map(powerUp => renderPowerUp(powerUp))
            ]),
            showSidebar && Div({
                className: 'sidebar'
            }, [
                H2({}, 'Players'),
                renderPlayerList(),
                renderChat()
            ])
        ]),
        gameOver && GameOverScreen()
    ]);
}

export default GameApp;