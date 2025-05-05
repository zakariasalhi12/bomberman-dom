
Bomber Man dom
- 2-4 players -> 3 Lives For every one

Power ups (each time a player destroys a block, a random power up may or may not appear):

Bombs: Increases the amount of bombs dropped at a time by 1;
Flames: Increases explosion range from the bomb in four directions by 1 block;
Speed: Increases movement speed;

When the user opens the game, he/she should be presented to a page where he/she should enter a nickname to differentiate users. After selecting a nickname the user should be presented to a waiting page with a player counter that ends at 4. Once a user joins, the player counter will increment by 1.

If there are more than 2 players in the counter and it does not reach 4 players before 20 seconds, a 10 second timer starts, to players get ready to start the game.
If there are 4 players in the counter before 20 seconds, the 10 seconds timer starts and the game starts.


Start Game Depense :
    - Nickname For The user
    - 2 Players

Game Logic : 
    - EndPoints : 
        ws://localhost:8080/join [room]
        ws://localhost:8080/move
        ws://localhost:8080/placeBomb
        ws://localhost:8080/chat
        ws://localhost:8080/newability
        
Brakes :
0 : Empty Space
1 : Destroyable Brake
2 : Wall