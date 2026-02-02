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
  grounded: false,
  bobOffset: 0,
  tilt: 0
};

// Game objects
let obstacles = [];
let coinObjects = [];
let powerUps = [];
let stars = [];
let particles = [];
let floatingTexts = [];
let shootingStars = [];
let bgLayers = { far: [], mid: [], near: [] };

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

// Generate organic rock shape points
function generateRockShape(size, pointCount) {
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const radius = size * (0.7 + Math.random() * 0.5);
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  return points;
}

// Initialize parallax background layers
function initBgLayers() {
  bgLayers = { far: [], mid: [], near: [] };
  
  // Far layer - distant rock formations (slow, large)
  for (let i = 0; i < 3; i++) {
    const width = 250 + Math.random() * 150;
    const height = 60 + Math.random() * 50;
    // Pre-generate mountain peaks
    const peakCount = 3 + Math.floor(Math.random() * 2);
    const peaks = [];
    for (let p = 0; p < peakCount; p++) {
      peaks.push({
        xOffset: (p + 0.3 + Math.random() * 0.4) * (width / peakCount),
        height: height * (0.5 + Math.random() * 0.5)
      });
    }
    bgLayers.far.push({
      x: i * 500 + Math.random() * 100,
      width,
      height,
      peaks
    });
  }
  
  // Mid layer - rock spires
  for (let i = 0; i < 4; i++) {
    const height = 50 + Math.random() * 60;
    bgLayers.mid.push({
      x: i * 400 + Math.random() * 150,
      width: 40 + Math.random() * 40,
      height,
      taperTop: 0.2 + Math.random() * 0.3,
      lean: (Math.random() - 0.5) * 0.2
    });
  }
  
  // Near layer - floating asteroids (fewer, more organic)
  for (let i = 0; i < 3; i++) {
    const size = 20 + Math.random() * 30;
    bgLayers.near.push({
      x: i * 450 + Math.random() * 200,
      y: 120 + Math.random() * 180,
      size,
      shape: generateRockShape(size, 8),
      floatOffset: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.01
    });
  }
}
initBgLayers();

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
  
  // Shooting stars
  if (gameRunning && Math.random() < 0.005) {
    shootingStars.push({
      x: canvas.width + 50,
      y: Math.random() * canvas.height * 0.6,
      speed: 15 + Math.random() * 10,
      length: 30 + Math.random() * 40
    });
  }
  
  // Draw and update shooting stars
  shootingStars.forEach((ss, i) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(ss.x + ss.length, ss.y - ss.length * 0.3);
    ctx.stroke();
    
    // Glow
    ctx.strokeStyle = 'rgba(255, 255, 200, 0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(ss.x + ss.length * 0.5, ss.y - ss.length * 0.15);
    ctx.stroke();
    
    ss.x -= ss.speed;
    ss.y += ss.speed * 0.3;
    
    if (ss.x + ss.length < 0 || ss.y > canvas.height) {
      shootingStars.splice(i, 1);
    }
  });
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

function drawParallaxLayers() {
  const groundY = getGroundY();
  
  // Far layer - distant rock formations (slowest, 0.15x speed)
  const farColor = currentEnvIndex === 0 ? '#2a2545' : 
                   currentEnvIndex === 1 ? '#3a2020' : '#1a0a30';
  ctx.fillStyle = farColor;
  
  bgLayers.far.forEach(m => {
    ctx.beginPath();
    ctx.moveTo(m.x, groundY);
    
    // Use pre-generated peaks
    m.peaks.forEach(peak => {
      ctx.lineTo(m.x + peak.xOffset, groundY - peak.height);
    });
    
    ctx.lineTo(m.x + m.width, groundY);
    ctx.closePath();
    ctx.fill();
    
    m.x -= speed * 0.12;
    if (m.x + m.width < 0) {
      m.x = canvas.width + 50;
    }
  });
  
  // Mid layer - rock spires (0.3x speed)
  const midColor = currentEnvIndex === 0 ? '#3a3560' : 
                   currentEnvIndex === 1 ? '#4a2828' : '#2a1545';
  ctx.fillStyle = midColor;
  
  bgLayers.mid.forEach(r => {
    ctx.beginPath();
    ctx.moveTo(r.x, groundY);
    ctx.lineTo(r.x + r.width * r.taperTop + r.lean * r.height, groundY - r.height);
    ctx.lineTo(r.x + r.width * (1 - r.taperTop) + r.lean * r.height, groundY - r.height);
    ctx.lineTo(r.x + r.width, groundY);
    ctx.closePath();
    ctx.fill();
    
    r.x -= speed * 0.25;
    if (r.x + r.width < 0) {
      r.x = canvas.width + 100;
    }
  });
  
  // Near layer - floating asteroids (0.5x speed)
  const nearColor = currentEnvIndex === 0 ? '#4a4570' : 
                    currentEnvIndex === 1 ? '#5a4040' : '#3a2050';
  const nearDark = currentEnvIndex === 0 ? '#353055' : 
                   currentEnvIndex === 1 ? '#402828' : '#251535';
  
  bgLayers.near.forEach(rock => {
    const floatY = rock.y + Math.sin(Date.now() / 1000 + rock.floatOffset) * 6;
    rock.rotation += rock.rotationSpeed;
    
    ctx.save();
    ctx.translate(rock.x, floatY);
    ctx.rotate(rock.rotation);
    
    // Draw organic rock shape
    ctx.fillStyle = nearColor;
    ctx.beginPath();
    ctx.moveTo(rock.shape[0].x, rock.shape[0].y);
    for (let i = 1; i < rock.shape.length; i++) {
      ctx.lineTo(rock.shape[i].x, rock.shape[i].y);
    }
    ctx.closePath();
    ctx.fill();
    
    // Crater/shadow detail
    ctx.fillStyle = nearDark;
    ctx.beginPath();
    ctx.arc(-rock.size * 0.15, -rock.size * 0.1, rock.size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    rock.x -= speed * 0.45;
    if (rock.x + rock.size < 0) {
      rock.x = canvas.width + rock.size + 50;
      rock.y = 120 + Math.random() * 180;
    }
  });
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
  // Draw custom heart shapes instead of emoji (consistent sizing)
  const size = 10;
  const spacing = 28;
  const startX = canvas.width - 90;
  const baseY = 58;
  
  for (let i = 0; i < 3; i++) {
    const cx = startX + i * spacing;
    const isFull = i < lives;
    
    ctx.fillStyle = isFull ? '#ff4466' : '#444455';
    ctx.beginPath();
    
    // Better heart shape - two bumps on top, point at bottom
    const topY = baseY;
    const bottomY = baseY + size * 1.8;
    const width = size;
    
    ctx.moveTo(cx, topY + size * 0.4);
    // Left bump
    ctx.bezierCurveTo(cx - width * 0.1, topY, cx - width, topY, cx - width, topY + size * 0.5);
    // Left side down to point
    ctx.bezierCurveTo(cx - width, topY + size, cx, bottomY - size * 0.3, cx, bottomY);
    // Right side up from point
    ctx.bezierCurveTo(cx, bottomY - size * 0.3, cx + width, topY + size, cx + width, topY + size * 0.5);
    // Right bump
    ctx.bezierCurveTo(cx + width, topY, cx + width * 0.1, topY, cx, topY + size * 0.4);
    ctx.fill();
    
    // Add shine to full hearts
    if (isFull) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.35, topY + size * 0.45, size * 0.2, size * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
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
  const { x, width, height } = player;
  
  // Apply hover bob offset
  const drawY = player.y + player.bobOffset;
  
  // Flash when invincible
  if (invincibleUntil > Date.now() && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  ctx.save();
  
  // Apply tilt rotation
  ctx.translate(x + width/2, drawY + height/2);
  ctx.rotate(player.tilt);
  ctx.translate(-(x + width/2), -(drawY + height/2));
  
  // Shield glow
  if (activeEffects.shield) {
    ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(x + width/2, drawY + height/2, 40, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Body (space suit)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, drawY + 15, width, height - 15, 8);
  ctx.fill();
  
  // Helmet
  ctx.fillStyle = '#5588ff';
  ctx.beginPath();
  ctx.arc(x + width/2, drawY + 15, 18, 0, Math.PI * 2);
  ctx.fill();
  
  // Visor
  ctx.fillStyle = '#88ccff';
  ctx.beginPath();
  ctx.arc(x + width/2 + 3, drawY + 15, 12, 0, Math.PI * 2);
  ctx.fill();
  
  // Face
  ctx.fillStyle = '#ffcc99';
  ctx.beginPath();
  ctx.arc(x + width/2 + 2, drawY + 15, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x + width/2, drawY + 13, 2, 0, Math.PI * 2);
  ctx.arc(x + width/2 + 6, drawY + 13, 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Smile
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + width/2 + 3, drawY + 16, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  
  // Jetpack
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(x - 8, drawY + 25, 10, 25);
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(x - 6, drawY + 30, 6, 8);
  
  // Jetpack flame - always on (idle), bigger when jumping
  const flameIntensity = !player.grounded ? (jumpHeld ? 1.8 : 1.2) : 0.5 + Math.sin(Date.now() / 100) * 0.2;
  
  // Outer flame
  ctx.fillStyle = '#ff4400';
  ctx.beginPath();
  ctx.moveTo(x - 5, drawY + 50);
  ctx.lineTo(x - 8, drawY + 50 + (12 + Math.random() * 8) * flameIntensity);
  ctx.lineTo(x + 1, drawY + 50);
  ctx.fill();
  
  // Inner flame
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo(x - 4, drawY + 50);
  ctx.lineTo(x - 5, drawY + 50 + (6 + Math.random() * 4) * flameIntensity);
  ctx.lineTo(x - 1, drawY + 50);
  ctx.fill();
  
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawObstacle(obs) {
  const cx = obs.x + obs.width/2;
  const cy = obs.y + obs.height/2;
  
  if (obs.type === 'satellite') {
    // Spinning satellite
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Date.now() / 500);
    
    // Body
    ctx.fillStyle = '#888899';
    ctx.fillRect(-obs.width/4, -obs.height/6, obs.width/2, obs.height/3);
    
    // Solar panels
    ctx.fillStyle = '#3355aa';
    ctx.fillRect(-obs.width/2, -obs.height/8, obs.width/4, obs.height/4);
    ctx.fillRect(obs.width/4, -obs.height/8, obs.width/4, obs.height/4);
    
    // Panel lines
    ctx.strokeStyle = '#5577cc';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const lx = -obs.width/2 + obs.width/12 + i * obs.width/12;
      ctx.beginPath();
      ctx.moveTo(lx, -obs.height/8);
      ctx.lineTo(lx, obs.height/8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx + obs.width * 0.75, -obs.height/8);
      ctx.lineTo(lx + obs.width * 0.75, obs.height/8);
      ctx.stroke();
    }
    
    // Dish
    ctx.fillStyle = '#aaaaaa';
    ctx.beginPath();
    ctx.arc(0, -obs.height/6, obs.width/8, Math.PI, 0);
    ctx.fill();
    
    ctx.restore();
  } else {
    // Asteroid (default)
    ctx.fillStyle = currentEnvIndex === 1 ? '#a0522d' : '#8b7355';
    ctx.beginPath();
    ctx.arc(cx, cy, obs.width/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Craters
    ctx.fillStyle = currentEnvIndex === 1 ? '#8b4513' : '#6b5344';
    ctx.beginPath();
    ctx.arc(obs.x + obs.width/3, obs.y + obs.height/3, obs.width * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obs.x + obs.width * 0.65, obs.y + obs.height * 0.6, obs.width * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
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
    const isSatellite = Math.random() < 0.25 && difficulty >= 2;
    const isMoving = Math.random() < 0.2 && difficulty >= 3;
    
    obstacles.push({
      x: obs.x,
      y: groundY - obs.size,
      baseY: groundY - obs.size,
      width: obs.size,
      height: obs.size,
      type: isSatellite ? 'satellite' : 'asteroid',
      moving: isMoving,
      moveOffset: Math.random() * Math.PI * 2
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
  
  // Hover bob animation when grounded
  if (player.grounded) {
    player.bobOffset = Math.sin(Date.now() / 200) * 3;
  } else {
    player.bobOffset = 0;
  }
  
  // Tilt based on vertical movement
  const targetTilt = player.vy * 0.015;
  player.tilt += (targetTilt - player.tilt) * 0.2;
  player.tilt = Math.max(-0.3, Math.min(0.3, player.tilt));
  
  // Distance and difficulty
  distanceTraveled += speed;
  difficulty = 1 + Math.floor(distanceTraveled / 5000);
  
  // Environment progression (change every ~30 seconds of gameplay)
  const newEnvIndex = Math.min(Math.floor(distanceTraveled / 4000), environments.length - 1);
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
    
    // Moving obstacles bob up and down
    if (obs.moving) {
      obs.y = obs.baseY + Math.sin(Date.now() / 400 + obs.moveOffset) * 30;
    }
    
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
  drawParallaxLayers();
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
  shootingStars = [];
  initBgLayers();
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
