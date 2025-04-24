export default class Player {
    constructor(id, nickname, socket) {
        this.id = id;
        this.nickname = nickname || `Player${id.substring(0, 4)}`;
        this.x = 0;
        this.y = 0;
        this.lives = 3;
        this.bombs = 1;
        this.range = 1;
        this.speed = 1;
        this.socket = socket;
    }
}
// module.exports = Player;
// export { Player };