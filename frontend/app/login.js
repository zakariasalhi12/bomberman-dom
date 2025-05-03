import { Button, Div, H1, Input, P } from "../framework/core/components.js";
import { jsx, render } from "../framework/core/dom.js";
import { handleServerMessage } from "./handler.js";



export const Ref = {
    gameCanvasRef: { current: null },
    livesRef: { current: null },
    playersRef: { current: null },
    chatRef: { current: null },
    inputRef: { current: null },
    buttonRef: { current: null },
    messagesRef: { current: null },
    hearts: { current: null },
    StatusRef: { current: null },
    notificationsRef: { current: null },
    popupRef: { current: null },
    gamePageRef: { current: null },
}

export function Login() {
    let name;
    function handleNameInput(event) {
        name = event.target.value;
    }

    function handleLogin(event) {
        // if (name.trim()) {
        connectToGameServer(name);
        render(event.target.parentNode, waitingPage);
        // }
    }


    return Div({
        id: 'login'
    }, [
        H1({}, "Bomberman"),
        P({ id: 'count' }),
        Div({ id: 'input' }, [
            Input({
                type: 'text',
                id: 'name',
                placeholder: 'Enter your Name',
                oninput: handleNameInput
            }),
            Button({
                id: 'NameBut',
                onclick: handleLogin,
                className: "login-button"
            }, "Join Game")])

    ]);
}

export function connectToGameServer(name) {
    const host = window.location.hostname;
    let socket = new WebSocket(`ws://${host}:3000`);
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
        handleServerMessage(data);
    };

    socket.onclose = () => {
        console.log("Disconnected from WebSocket server");
    };
}


function waitingPage() {
    return Div({}, [
        P({ id: "playercount" }, `player`),
        Div({ className: "waiting-animation" }, [
            jsx('img', {
                src: "/images/bomberman3d.gif",
                alt: "Waiting...",
                style: "margin-top: 10px;",
            }),
            P({}, "Looking for a match...")
        ])
    ]);
}

export function GamePage() {
    return Div({ ref: Ref.gamePageRef }, [
        // Header
        jsx('header', { className: 'header' }, [
            H1({ className: 'game-title' }, 'Bomber Man')
        ]),

        Div({
            id: 'power-notifications',
            ref: Ref.notificationsRef,
            style: 'position: absolute; top: 70px; right: 20px; z-index: 100; width: 250px;'
        }),

        Div({
            id: 'popup-msg',
            ref: Ref.popupRef,
        }),

        // Content Container
        Div({ className: 'content-container' }, [
            // Main Game Area
            Main({ className: 'game-area' }, [
                Div({ className: 'game-container' }, [
                    Div({ className: 'game-canvas', id: "game", refer: Ref.gameCanvasRef })
                ])
            ]),
            // Sidebar Chat Area
            jsx('main', { className: 'game-area' }, [
                Div({ className: 'message-container', ref: Ref.messagesRef }),
                Div({ className: 'chat-input-area' }, [
                    Input({
                        type: 'text',
                        className: 'chat-input',
                        placeholder: 'Type a message...',
                        ref: Ref.chatRef,
                    }),
                    Button({ className: 'send-button', ref: Ref.buttonRef }, 'Send')
                ])
            ])
        ]),

        // Footer
        Div({ className: 'footer' }, [
            Div({ className: 'footer-content' }, [
                Div({ className: 'footer-section lives-section' }, [
                    Div({ id: 'playerlives' }, [
                        P({ id: 'lives', ref: Ref.livesRef }, "Lives :")
                    ]),
                    Div({ id: "hearts", ref: Ref.hearts }, [
                        jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' }),
                        jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' }),
                        jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' })
                    ])
                ]),
                Div({ className: 'footer-section players-section', id: 'players', ref: Ref.playersRef }),
                Div({ className: 'footer-section status-section', ref: Ref.StatusRef }, [
                    Div({ className: "stella-status" }, [
                        jsx("h3", { style: "color:rgb(0, 0, 0); margin-bottom: 8px;" }, "✨ Stella's Power Stats ✨"),
                        Div({ style: "list-style: none; padding: 0; margin: 0;" }, [
                            P({}, "💣 Bomb Power: false"),
                            P({}, "⚡ Speed: false"),
                            P({}, "🔥 Fire Range: false")
                        ])
                    ])
                ])
            ])
        ])
    ]);
}
