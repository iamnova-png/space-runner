const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');
const finalCoinsEl = document.getElementById('final-coins');

// Game state
let gameRunning = false;
let score = 0;
let coins = 0;
let baseSpeed = 6;
let speed = baseSpeed;
let gravity = 0.8;
let jumpForce = -14;
let maxJumpTime = 180; // ms to hold for max jump
let jumpStartTime = 0;
let isJumping = false;
let jumpHeld = false;

// Player
const player = {
  x: 80,
  y: 0,
  width: 40,
  height: 50,
  vy: 0,
  grounded: false
};

// Game objects
let obstacles = [];
let coinObjects = [];
let stars = [];
let particles = [];

// Level generation
let lastObstacleX = 0;
let minObstacleGap = 300; // Minimum pixels between obstacles
let patternCooldown = 0;
let difficulty = 1;
let distanceTraveled = 0;

// Resize canvas
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.y = getGroundY() - player.height;
}

function getGroundY() {
  return canvas.height - 100;
}

resize();
window.addEventListener('resize', resize);

// Initialize stars
function initStars() {
  stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 2 + 1
    });
  }
}
initStars();

// Draw functions
function drawStars() {
  ctx.fillStyle = '#ffffff';
  stars.forEach(star => {
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
    
    star.x -= star.speed * (speed / baseSpeed);
    if (star.x < 0) {
      star.x = canvas.width;
      star.y = Math.random() * canvas.height;
    }
  });
  ctx.globalAlpha = 1;
}

function drawGround() {
  const groundY = getGroundY();
  
  // Planet surface gradient
  const gradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
  gradient.addColorStop(0, '#4a3f6b');
  gradient.addColorStop(1, '#2d2547');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, groundY, canvas.width, 100);
  
  // Surface line
  ctx.strokeStyle = '#7b68a6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
}

function drawPlayer() {
  const { x, y, width, height } = player;
  
  // Body (space suit)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y + 15, width, height - 15, 8);
  ctx.fill();
  
  // Helmet
  ctx.fillStyle = '#5588ff';
  ctx.beginPath();
  ctx.arc(x + width/2, y + 15, 18, 0, Math.PI * 2);
  ctx.fill();
  
  // Visor
  ctx.fillStyle = '#88ccff';
  ctx.beginPath();
  ctx.arc(x + width/2 + 3, y + 15, 12, 0, Math.PI * 2);
  ctx.fill();
  
  // Face
  ctx.fillStyle = '#ffcc99';
  ctx.beginPath();
  ctx.arc(x + width/2 + 2, y + 15, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x + width/2, y + 13, 2, 0, Math.PI * 2);
  ctx.arc(x + width/2 + 6, y + 13, 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Smile
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + width/2 + 3, y + 16, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  
  // Jetpack
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(x - 8, y + 25, 10, 25);
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(x - 6, y + 30, 6, 8);
  
  // Jetpack flame when jumping/holding
  if (!player.grounded || jumpHeld) {
    const flameIntensity = jumpHeld ? 1.5 : 1;
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 50);
    ctx.lineTo(x - 8, y + 50 + (15 + Math.random() * 10) * flameIntensity);
    ctx.lineTo(x + 1, y + 50);
    ctx.fill();
    
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 50);
    ctx.lineTo(x - 5, y + 50 + (8 + Math.random() * 5) * flameIntensity);
    ctx.lineTo(x - 1, y + 50);
    ctx.fill();
  }
}

function drawObstacle(obs) {
  // Asteroid
  ctx.fillStyle = '#8b7355';
  ctx.beginPath();
  ctx.arc(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Craters
  ctx.fillStyle = '#6b5344';
  ctx.beginPath();
  ctx.arc(obs.x + obs.width/3, obs.y + obs.height/3, obs.width * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(obs.x + obs.width * 0.6, obs.y + obs.height * 0.6, obs.width * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(coin) {
  // Glow
  ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(coin.x + 15, coin.y + 15, 20, 0, Math.PI * 2);
  ctx.fill();
  
  // Coin
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(coin.x + 15, coin.y + 15, 12, 0, Math.PI * 2);
  ctx.fill();
  
  // Shine
  ctx.fillStyle = '#ffec8b';
  ctx.beginPath();
  ctx.arc(coin.x + 12, coin.y + 12, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Star symbol
  ctx.fillStyle = '#daa520';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('★', coin.x + 15, coin.y + 19);
}

function drawParticles() {
  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;
    
    if (p.life <= 0) {
      particles.splice(i, 1);
      return;
    }
    
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      size: Math.random() * 4 + 2,
      color,
      life: 1
    });
  }
}

// Variable jump system
function startJump() {
  if (player.grounded && gameRunning) {
    player.vy = jumpForce;
    player.grounded = false;
    isJumping = true;
    jumpHeld = true;
    jumpStartTime = Date.now();
  }
}

function endJump() {
  jumpHeld = false;
  // Cut the jump short if released early and still going up
  if (isJumping && player.vy < 0) {
    player.vy *= 0.5; // Reduce upward velocity
  }
}

// Level generation patterns
const patterns = [
  // Single low obstacle
  { type: 'single_low', generate: (x) => {
    return [{ x, size: 45 }];
  }},
  // Single medium obstacle
  { type: 'single_med', generate: (x) => {
    return [{ x, size: 55 }];
  }},
  // Double obstacles with gap
  { type: 'double', generate: (x) => {
    return [
      { x, size: 40 },
      { x: x + 200, size: 45 }
    ];
  }},
  // Coin trail (no obstacles)
  { type: 'coins', generate: (x) => {
    return []; // Just coins, handled separately
  }},
  // Low-high combo
  { type: 'low_high', generate: (x) => {
    return [
      { x, size: 35 },
      { x: x + 180, size: 60 }
    ];
  }}
];

function spawnPattern() {
  const groundY = getGroundY();
  const startX = canvas.width + 50;
  
  // Pick a pattern based on difficulty
  const availablePatterns = difficulty < 3 
    ? patterns.slice(0, 3) // Easy patterns only at start
    : patterns;
  
  const pattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
  const obstacleData = pattern.generate(startX);
  
  // Spawn obstacles from pattern
  obstacleData.forEach(obs => {
    obstacles.push({
      x: obs.x,
      y: groundY - obs.size,
      width: obs.size,
      height: obs.size
    });
    lastObstacleX = Math.max(lastObstacleX, obs.x);
  });
  
  // Spawn coins - either as a trail or near obstacles
  if (pattern.type === 'coins' || Math.random() < 0.6) {
    const coinCount = pattern.type === 'coins' ? 5 : 2;
    const coinStartX = pattern.type === 'coins' ? startX : startX + 100;
    const coinY = groundY - 80 - Math.random() * 100;
    
    for (let i = 0; i < coinCount; i++) {
      coinObjects.push({
        x: coinStartX + i * 50,
        y: pattern.type === 'coins' ? coinY : groundY - 120 - Math.random() * 60,
        width: 30,
        height: 30
      });
    }
  }
  
  // Set cooldown based on pattern
  const baseGap = minObstacleGap + (Math.random() * 150);
  patternCooldown = baseGap / speed;
}

function checkCollision(a, b) {
  // Slightly smaller hitbox for better feel
  const padding = 5;
  return a.x + padding < b.x + b.width - padding &&
         a.x + a.width - padding > b.x + padding &&
         a.y + padding < b.y + b.height - padding &&
         a.y + a.height - padding > b.y + padding;
}

function update() {
  if (!gameRunning) return;
  
  const groundY = getGroundY();
  
  // Variable jump - hold to go higher
  if (jumpHeld && isJumping && player.vy < 0) {
    const holdTime = Date.now() - jumpStartTime;
    if (holdTime < maxJumpTime) {
      // Apply reduced gravity while holding (float higher)
      player.vy += gravity * 0.4;
    } else {
      player.vy += gravity;
    }
  } else {
    player.vy += gravity;
  }
  
  player.y += player.vy;
  
  // Ground collision
  if (player.y >= groundY - player.height) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.grounded = true;
    isJumping = false;
  }
  
  // Update distance and difficulty
  distanceTraveled += speed;
  difficulty = 1 + Math.floor(distanceTraveled / 5000);
  
  // Update speed based on difficulty (gentler curve)
  speed = baseSpeed + (difficulty - 1) * 0.3;
  if (speed > 10) speed = 10;
  
  // Update minimum gap (gets slightly smaller with difficulty)
  minObstacleGap = Math.max(250, 350 - difficulty * 10);
  
  // Update obstacles
  obstacles.forEach((obs, i) => {
    obs.x -= speed;
    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
      score += 10;
    }
    
    // Collision check
    if (checkCollision(player, obs)) {
      gameOver();
    }
  });
  
  // Update coins
  coinObjects.forEach((coin, i) => {
    coin.x -= speed;
    if (coin.x + coin.width < 0) {
      coinObjects.splice(i, 1);
    }
    
    // Collection check
    if (checkCollision(player, coin)) {
      coinObjects.splice(i, 1);
      coins++;
      score += 50;
      spawnParticles(coin.x + 15, coin.y + 15, '#ffd700', 10);
    }
  });
  
  // Spawn new patterns
  patternCooldown--;
  const rightmostObstacle = obstacles.length > 0 
    ? Math.max(...obstacles.map(o => o.x)) 
    : 0;
  
  if (patternCooldown <= 0 && rightmostObstacle < canvas.width - minObstacleGap) {
    spawnPattern();
  }
  
  // Update UI
  scoreEl.textContent = score;
  coinsEl.textContent = '🪙 ' + coins;
}

function draw() {
  // Clear with space background
  ctx.fillStyle = '#0a0a20';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  drawStars();
  drawGround();
  drawParticles();
  
  obstacles.forEach(drawObstacle);
  coinObjects.forEach(drawCoin);
  drawPlayer();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  gameRunning = true;
  score = 0;
  coins = 0;
  speed = baseSpeed;
  difficulty = 1;
  distanceTraveled = 0;
  obstacles = [];
  coinObjects = [];
  particles = [];
  patternCooldown = 0;
  lastObstacleX = 0;
  player.y = getGroundY() - player.height;
  player.vy = 0;
  player.grounded = true;
  isJumping = false;
  jumpHeld = false;
  
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  
  scoreEl.textContent = '0';
  coinsEl.textContent = '🪙 0';
}

function gameOver() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  finalCoinsEl.textContent = coins;
  gameOverScreen.classList.remove('hidden');
}

// Event listeners - track press and release for variable jump
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startJump();
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  endJump();
});

canvas.addEventListener('mousedown', startJump);
canvas.addEventListener('mouseup', endJump);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) startJump();
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') endJump();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Start game loop
gameLoop();
