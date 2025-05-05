const createSpriteAnimator = (config = {}) => {
    const {
      spriteWidth = 28,
      spriteHeight = 40,
      frameIndices = [0, 1, 2, 3],
      frameSlow = 6,
      directionRows = {
        right: 1,
        left: 3,
        up: 2,
        down: 4,
      },
    } = config;
  
    let currentFrame = 0;
    let frameCounter = 0;
  
    const drawSprite = (frameX, frameY) => ({
      x: frameX * spriteWidth,
      y: frameY * spriteHeight,
    });
  
    const getSpritePosition = (direction) => {
      const row = direction ? directionRows[direction] || directionRows.right : 0;
  
      if (!direction) {
        return drawSprite(frameIndices[0], 0);
      }
  
      frameCounter++;
      if (frameCounter >= frameSlow) {
        frameCounter = 0;
        currentFrame = (currentFrame + 1) % frameIndices.length;
      }
  
      return drawSprite(frameIndices[currentFrame], row);
    };
  
    return { getSpritePosition };
  };
  
  export default createSpriteAnimator;