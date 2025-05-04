



export class Game {
    constructor(tilesize, data) {
        this.tileSize = tileSize;
        this.players = data.players.length;
        // this.wall = this.#image("wallBlack.png");
        this.bombs = [];
        this.MyId = data.MyId;
        this.map = data.map;
        this.canvas = null;
        this.controlsInitialized = false;
        this.keydownHandler = null;
        this.keyupHandler = null;
    }

}