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
let speed = 5;
let gravity = 0.6;
let jumpForce = -12;

// Player
const player = {
  x: 80,
  y: 0,
  width: 40,
  height: 50,
  vy: 0,
  grounded: false,
  color: '#ff6b9d'
};

// Game objects
let obstacles = [];
let coinObjects = [];
let stars = [];
let particles = [];

// Resize canvas
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.y = canvas.height - 120 - player.height;
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
    
    star.x -= star.speed * (speed / 5);
    if (star.x < 0) {
      star.x = canvas.width;
      star.y = Math.random() * canvas.height;
    }
  });
  ctx.globalAlpha = 1;
}

function drawGround() {
  const groundY = canvas.height - 100;
  
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
  
  // Jetpack flame when jumping
  if (!player.grounded) {
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 50);
    ctx.lineTo(x - 8, y + 65 + Math.random() * 10);
    ctx.lineTo(x + 1, y + 50);
    ctx.fill();
    
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 50);
    ctx.lineTo(x - 5, y + 58 + Math.random() * 5);
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
  ctx.arc(obs.x + obs.width/3, obs.y + obs.height/3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(obs.x + obs.width * 0.6, obs.y + obs.height * 0.6, 4, 0, Math.PI * 2);
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

// Game logic
function jump() {
  if (player.grounded && gameRunning) {
    player.vy = jumpForce;
    player.grounded = false;
  }
}

function spawnObstacle() {
  const minHeight = 40;
  const maxHeight = 70;
  const height = Math.random() * (maxHeight - minHeight) + minHeight;
  
  obstacles.push({
    x: canvas.width,
    y: canvas.height - 100 - height,
    width: height,
    height: height
  });
}

function spawnCoin() {
  const y = canvas.height - 100 - Math.random() * 150 - 50;
  coinObjects.push({
    x: canvas.width,
    y: y,
    width: 30,
    height: 30
  });
}

function checkCollision(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

function update() {
  if (!gameRunning) return;
  
  // Player physics
  player.vy += gravity;
  player.y += player.vy;
  
  const groundY = canvas.height - 100 - player.height;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.grounded = true;
  }
  
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
  
  // Increase difficulty
  speed = 5 + Math.floor(score / 200) * 0.5;
  if (speed > 12) speed = 12;
  
  // Spawn new objects
  if (Math.random() < 0.02) spawnObstacle();
  if (Math.random() < 0.015) spawnCoin();
  
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
  speed = 5;
  obstacles = [];
  coinObjects = [];
  particles = [];
  player.y = canvas.height - 120 - player.height;
  player.vy = 0;
  player.grounded = true;
  
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

// Event listeners
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  jump();
});
canvas.addEventListener('mousedown', jump);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') jump();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Start game loop
gameLoop();
