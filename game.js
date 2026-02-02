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
let lives = 3;
let baseSpeed = 6;
let speed = baseSpeed;
let gravity = 0.8;
let jumpForce = -14;
let maxJumpTime = 180;
let jumpStartTime = 0;
let isJumping = false;
let jumpHeld = false;
let invincibleUntil = 0;
let screenShake = 0;
let damageFlash = 0;

// High score
let highScore = parseInt(localStorage.getItem('spaceRunnerHighScore')) || 0;

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
let powerUps = [];
let stars = [];
let particles = [];
let floatingTexts = [];

// Level generation
let patternCooldown = 0;
let powerUpCooldown = 0;
let difficulty = 1;
let distanceTraveled = 0;
let minObstacleGap = 300;

// Power-up states
let activeEffects = {
  shield: false,
  magnet: false,
  doubleCoin: 0 // timestamp when expires
};

// Environments
const environments = [
  {
    name: 'Moon',
    skyColor: '#0a0a20',
    groundColor1: '#4a3f6b',
    groundColor2: '#2d2547',
    lineColor: '#7b68a6',
    starColor: '#ffffff',
    particleColor: null
  },
  {
    name: 'Mars',
    skyColor: '#1a0a0a',
    groundColor1: '#8b4513',
    groundColor2: '#5c2e0a',
    lineColor: '#cd853f',
    starColor: '#ffccaa',
    particleColor: '#d2691e' // dust
  },
  {
    name: 'Nebula',
    skyColor: '#0d0221',
    groundColor1: '#4b0082',
    groundColor2: '#2d0150',
    lineColor: '#9932cc',
    starColor: '#ff88ff',
    particleColor: '#ff00ff' // cosmic dust
  }
];
let currentEnvIndex = 0;
let envTransition = 0;

// Power-up types
const powerUpTypes = [
  { type: 'shield', color: '#00bfff', icon: '🛡️', duration: 0 },
  { type: 'magnet', color: '#ff4500', icon: '🧲', duration: 8000 },
  { type: 'doubleCoin', color: '#ffd700', icon: '2x', duration: 10000 }
];

// Resize canvas
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.y = getGroundY() - player.height;
}

function getGroundY() {
  return canvas.height - 100;
}

function getEnv() {
  return environments[currentEnvIndex];
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
  const env = getEnv();
  ctx.fillStyle = env.starColor;
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

function drawEnvironmentParticles() {
  const env = getEnv();
  if (!env.particleColor) return;
  
  // Spawn dust/cosmic particles
  if (Math.random() < 0.1) {
    particles.push({
      x: canvas.width + 10,
      y: Math.random() * canvas.height,
      vx: -speed * 1.5,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 1,
      color: env.particleColor,
      life: 1,
      isEnvParticle: true
    });
  }
}

function drawGround() {
  const groundY = getGroundY();
  const env = getEnv();
  
  const gradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
  gradient.addColorStop(0, env.groundColor1);
  gradient.addColorStop(1, env.groundColor2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, groundY, canvas.width, 100);
  
  ctx.strokeStyle = env.lineColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
}

function drawLives() {
  const heartSize = 25;
  const startX = canvas.width - 100;
  const y = 55;
  
  ctx.font = `${heartSize}px Arial`;
  for (let i = 0; i < 3; i++) {
    // Use red heart for remaining lives, black heart for lost
    ctx.fillText(i < lives ? '❤️' : '🖤', startX + i * 30, y);
  }
}

function drawEnvironmentName() {
  const env = getEnv();
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'left';
  ctx.fillText(env.name.toUpperCase(), 20, 55);
}

function drawActiveEffects() {
  let x = 20;
  const y = 80;
  
  ctx.font = '20px Arial';
  if (activeEffects.shield) {
    ctx.fillText('🛡️', x, y);
    x += 30;
  }
  if (activeEffects.magnet) {
    ctx.fillText('🧲', x, y);
    x += 30;
  }
  if (activeEffects.doubleCoin > Date.now()) {
    ctx.fillText('2x', x, y);
    ctx.font = '12px Arial';
    const remaining = Math.ceil((activeEffects.doubleCoin - Date.now()) / 1000);
    ctx.fillText(remaining + 's', x + 25, y);
  }
}

function drawPlayer() {
  const { x, y, width, height } = player;
  
  // Flash when invincible
  if (invincibleUntil > Date.now() && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  // Shield glow
  if (activeEffects.shield) {
    ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(x + width/2, y + height/2, 40, 0, Math.PI * 2);
    ctx.fill();
  }
  
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
  
  // Jetpack flame
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
  
  ctx.globalAlpha = 1;
}

function drawObstacle(obs) {
  ctx.fillStyle = currentEnvIndex === 1 ? '#a0522d' : '#8b7355';
  ctx.beginPath();
  ctx.arc(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = currentEnvIndex === 1 ? '#8b4513' : '#6b5344';
  ctx.beginPath();
  ctx.arc(obs.x + obs.width/3, obs.y + obs.height/3, obs.width * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(obs.x + obs.width * 0.6, obs.y + obs.height * 0.6, obs.width * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(coin) {
  ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(coin.x + 15, coin.y + 15, 20, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(coin.x + 15, coin.y + 15, 12, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffec8b';
  ctx.beginPath();
  ctx.arc(coin.x + 12, coin.y + 12, 4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#daa520';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('★', coin.x + 15, coin.y + 19);
}

function drawPowerUp(pu) {
  const puType = powerUpTypes.find(p => p.type === pu.type);
  
  // Glow
  ctx.fillStyle = puType.color + '44';
  ctx.beginPath();
  ctx.arc(pu.x + 20, pu.y + 20, 30 + Math.sin(Date.now() / 200) * 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Box
  ctx.fillStyle = puType.color;
  ctx.beginPath();
  ctx.roundRect(pu.x, pu.y, 40, 40, 8);
  ctx.fill();
  
  // Icon
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(puType.icon, pu.x + 20, pu.y + 28);
}

function drawParticles() {
  particles.forEach((p, i) => {
    p.x += p.vx || 0;
    p.y += p.vy || 0;
    p.life -= p.isEnvParticle ? 0.005 : 0.02;
    
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

function drawFloatingTexts() {
  floatingTexts.forEach((ft, i) => {
    ft.y -= 1;
    ft.life -= 0.02;
    
    if (ft.life <= 0) {
      floatingTexts.splice(i, 1);
      return;
    }
    
    ctx.globalAlpha = ft.life;
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
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

function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1 });
}

// Jump system
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
  if (isJumping && player.vy < 0) {
    player.vy *= 0.5;
  }
}

// Level patterns
const patterns = [
  { type: 'single_low', generate: (x) => [{ x, size: 45 }] },
  { type: 'single_med', generate: (x) => [{ x, size: 55 }] },
  { type: 'double', generate: (x) => [{ x, size: 40 }, { x: x + 200, size: 45 }] },
  { type: 'coins', generate: (x) => [] },
  { type: 'low_high', generate: (x) => [{ x, size: 35 }, { x: x + 180, size: 60 }] }
];

function spawnPattern() {
  const groundY = getGroundY();
  const startX = canvas.width + 50;
  
  const availablePatterns = difficulty < 3 ? patterns.slice(0, 3) : patterns;
  const pattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
  const obstacleData = pattern.generate(startX);
  
  obstacleData.forEach(obs => {
    obstacles.push({
      x: obs.x,
      y: groundY - obs.size,
      width: obs.size,
      height: obs.size
    });
  });
  
  // Coins
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
  
  const baseGap = minObstacleGap + Math.random() * 150;
  patternCooldown = baseGap / speed;
}

function spawnPowerUp() {
  const groundY = getGroundY();
  const puType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
  
  powerUps.push({
    x: canvas.width + 50,
    y: groundY - 150 - Math.random() * 100,
    width: 40,
    height: 40,
    type: puType.type
  });
  
  powerUpCooldown = 500 + Math.random() * 300;
}

function checkCollision(a, b, padding = 5) {
  return a.x + padding < b.x + b.width - padding &&
         a.x + a.width - padding > b.x + padding &&
         a.y + padding < b.y + b.height - padding &&
         a.y + a.height - padding > b.y + padding;
}

function takeDamage() {
  if (invincibleUntil > Date.now()) return;
  
  if (activeEffects.shield) {
    activeEffects.shield = false;
    spawnParticles(player.x + player.width/2, player.y + player.height/2, '#00bfff', 15);
    spawnFloatingText(player.x + player.width/2, player.y, 'SHIELD!', '#00bfff');
    invincibleUntil = Date.now() + 1000;
    screenShake = 5;
    return;
  }
  
  lives--;
  screenShake = 15;
  damageFlash = 10; // red flash frames
  spawnParticles(player.x + player.width/2, player.y + player.height/2, '#ff4444', 25);
  
  if (lives <= 0) {
    gameOver();
  } else {
    invincibleUntil = Date.now() + 2000;
    // Big floating text near the hearts
    spawnFloatingText(canvas.width - 50, 80, '−1', '#ff4444');
  }
}

function collectPowerUp(pu) {
  const puType = powerUpTypes.find(p => p.type === pu.type);
  
  spawnParticles(pu.x + 20, pu.y + 20, puType.color, 15);
  spawnFloatingText(pu.x + 20, pu.y, puType.icon, puType.color);
  
  switch (pu.type) {
    case 'shield':
      activeEffects.shield = true;
      break;
    case 'magnet':
      activeEffects.magnet = true;
      setTimeout(() => { activeEffects.magnet = false; }, puType.duration);
      break;
    case 'doubleCoin':
      activeEffects.doubleCoin = Date.now() + puType.duration;
      break;
  }
}

function update() {
  if (!gameRunning) return;
  
  const groundY = getGroundY();
  
  // Variable jump
  if (jumpHeld && isJumping && player.vy < 0) {
    const holdTime = Date.now() - jumpStartTime;
    if (holdTime < maxJumpTime) {
      player.vy += gravity * 0.4;
    } else {
      player.vy += gravity;
    }
  } else {
    player.vy += gravity;
  }
  
  player.y += player.vy;
  
  if (player.y >= groundY - player.height) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.grounded = true;
    isJumping = false;
  }
  
  // Distance and difficulty
  distanceTraveled += speed;
  difficulty = 1 + Math.floor(distanceTraveled / 5000);
  
  // Environment progression
  const newEnvIndex = Math.min(Math.floor(distanceTraveled / 10000), environments.length - 1);
  if (newEnvIndex !== currentEnvIndex) {
    currentEnvIndex = newEnvIndex;
    spawnFloatingText(canvas.width / 2, canvas.height / 2, '🌍 ' + getEnv().name.toUpperCase(), '#ffffff');
  }
  
  speed = baseSpeed + (difficulty - 1) * 0.3;
  if (speed > 10) speed = 10;
  minObstacleGap = Math.max(250, 350 - difficulty * 10);
  
  // Environment particles
  drawEnvironmentParticles();
  
  // Magnet effect
  if (activeEffects.magnet) {
    coinObjects.forEach(coin => {
      const dx = player.x - coin.x;
      const dy = player.y - coin.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 200) {
        coin.x += dx * 0.1;
        coin.y += dy * 0.1;
      }
    });
  }
  
  // Update obstacles (iterate backwards for safe splicing)
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= speed;
    
    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
      score += 10;
      continue;
    }
    
    if (checkCollision(player, obs)) {
      takeDamage();
      obstacles.splice(i, 1);
    }
  }
  
  // Update coins (iterate backwards for safe splicing)
  for (let i = coinObjects.length - 1; i >= 0; i--) {
    const coin = coinObjects[i];
    coin.x -= speed;
    
    if (coin.x + coin.width < 0) {
      coinObjects.splice(i, 1);
      continue;
    }
    
    if (checkCollision(player, coin, 0)) {
      coinObjects.splice(i, 1);
      const value = activeEffects.doubleCoin > Date.now() ? 2 : 1;
      coins += value;
      score += 50 * value;
      spawnParticles(coin.x + 15, coin.y + 15, '#ffd700', 10);
      if (value > 1) {
        spawnFloatingText(coin.x + 15, coin.y, '+' + (50 * value), '#ffd700');
      }
    }
  }
  
  // Update power-ups (iterate backwards for safe splicing)
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pu = powerUps[i];
    pu.x -= speed;
    
    if (pu.x + pu.width < 0) {
      powerUps.splice(i, 1);
      continue;
    }
    
    if (checkCollision(player, pu, 0)) {
      collectPowerUp(pu);
      powerUps.splice(i, 1);
    }
  }
  
  // Spawn patterns
  patternCooldown--;
  const rightmostObstacle = obstacles.length > 0 ? Math.max(...obstacles.map(o => o.x)) : 0;
  if (patternCooldown <= 0 && rightmostObstacle < canvas.width - minObstacleGap) {
    spawnPattern();
  }
  
  // Spawn power-ups
  powerUpCooldown--;
  if (powerUpCooldown <= 0 && Math.random() < 0.3) {
    spawnPowerUp();
  }
  
  // Screen shake and damage flash decay
  if (screenShake > 0) screenShake *= 0.9;
  if (damageFlash > 0) damageFlash--;
  
  // Update UI
  scoreEl.textContent = score;
  coinsEl.textContent = '🪙 ' + coins;
}

function draw() {
  const env = getEnv();
  
  // Screen shake
  ctx.save();
  if (screenShake > 0.5) {
    ctx.translate(
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake
    );
  }
  
  // Sky
  ctx.fillStyle = env.skyColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  drawStars();
  drawGround();
  drawParticles();
  
  obstacles.forEach(drawObstacle);
  coinObjects.forEach(drawCoin);
  powerUps.forEach(drawPowerUp);
  drawPlayer();
  drawFloatingTexts();
  
  // Damage flash overlay
  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${damageFlash * 0.03})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // UI
  drawLives();
  drawEnvironmentName();
  drawActiveEffects();
  
  ctx.restore();
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
  lives = 3;
  speed = baseSpeed;
  difficulty = 1;
  distanceTraveled = 0;
  currentEnvIndex = 0;
  obstacles = [];
  coinObjects = [];
  powerUps = [];
  particles = [];
  floatingTexts = [];
  patternCooldown = 0;
  powerUpCooldown = 100;
  player.y = getGroundY() - player.height;
  player.vy = 0;
  player.grounded = true;
  isJumping = false;
  jumpHeld = false;
  invincibleUntil = 0;
  screenShake = 0;
  damageFlash = 0;
  activeEffects = { shield: false, magnet: false, doubleCoin: 0 };
  
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  
  // Brief grace period at start (no invincibility, just delayed obstacles)
  patternCooldown = 60; // ~1 second before first obstacle
  
  scoreEl.textContent = '0';
  coinsEl.textContent = '🪙 0';
}

function gameOver() {
  gameRunning = false;
  
  // Update high score
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('spaceRunnerHighScore', highScore);
  }
  
  finalScoreEl.textContent = score;
  finalCoinsEl.textContent = coins;
  gameOverScreen.classList.remove('hidden');
}

// Update start screen high score display
function updateStartScreen() {
  const hsEl = document.getElementById('high-score');
  if (hsEl) hsEl.textContent = 'Best: ' + highScore;
}

// Event listeners
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startJump(); });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); endJump(); });
canvas.addEventListener('mousedown', startJump);
canvas.addEventListener('mouseup', endJump);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) startJump(); });
document.addEventListener('keyup', (e) => { if (e.code === 'Space') endJump(); });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initialize
updateStartScreen();
gameLoop();
