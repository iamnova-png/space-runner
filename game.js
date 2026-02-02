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

// Characters
const characters = ['spacekid', 'hovercraft', 'alien'];
let selectedChar = 'spacekid';

// Game state
let gameRunning = false;
let currentRound = 1;
let roundComplete = false;
let transitionProgress = 0;
let transitionActive = false;
const ROUND_1_DISTANCE = 5000;
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
      rotationSpeed: 0.015 + Math.random() * 0.02 // Faster, always spinning
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
    
    rock.x -= speed * 0.7; // Faster movement toward player
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
  const y = 85;
  
  if (activeEffects.shield) {
    ctx.font = '22px Arial';
    ctx.fillText('🛡️', x, y);
    x += 35;
  }
  if (activeEffects.magnet) {
    // Pulsing magnet icon
    const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
    ctx.font = `${22 * pulse}px Arial`;
    ctx.fillText('🧲', x, y);
    // "MAGNET" label
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#ff6600';
    ctx.fillText('MAGNET', x - 2, y + 15);
    ctx.fillStyle = '#fff';
    x += 45;
  }
  if (activeEffects.doubleCoin > Date.now()) {
    const pulse = 1 + Math.sin(Date.now() / 150) * 0.1;
    ctx.font = `bold ${18 * pulse}px Arial`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText('2x', x, y);
    ctx.font = '10px Arial';
    const remaining = Math.ceil((activeEffects.doubleCoin - Date.now()) / 1000);
    ctx.fillText(remaining + 's', x + 25, y);
    ctx.fillStyle = '#fff';
  }
}

function drawCharacter(c, x, y, scale = 1, tilt = 0, flameIntensity = 0.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(tilt);
  
  if (c === 'spacekid') {
    // Body (space suit)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-20, -25, 40, 35, 8);
    ctx.fill();
    
    // Helmet
    ctx.fillStyle = '#5588ff';
    ctx.beginPath();
    ctx.arc(0, -25, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Visor
    ctx.fillStyle = '#88ccff';
    ctx.beginPath();
    ctx.arc(3, -25, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Face
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(2, -25, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, -27, 2, 0, Math.PI * 2);
    ctx.arc(6, -27, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Smile
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(3, -24, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    
    // Jetpack
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(-28, -15, 10, 25);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(-26, -10, 6, 8);
    
    // Flame
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(-25, 10);
    ctx.lineTo(-28, 10 + 15 * flameIntensity);
    ctx.lineTo(-19, 10);
    ctx.fill();
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(-24, 10);
    ctx.lineTo(-25, 10 + 8 * flameIntensity);
    ctx.lineTo(-21, 10);
    ctx.fill();
    
  } else if (c === 'hovercraft') {
    // Cockpit dome
    ctx.fillStyle = '#44ddff';
    ctx.beginPath();
    ctx.ellipse(0, -20, 18, 14, 0, Math.PI, 0);
    ctx.fill();
    
    // Pilot inside
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(0, -22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-2, -23, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -23, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = '#ff6644';
    ctx.beginPath();
    ctx.ellipse(0, -5, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Stripe
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-25, -8, 50, 4);
    
    // Hover glow
    ctx.fillStyle = `rgba(0, 255, 255, ${0.3 + flameIntensity * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(0, 8, 22 + flameIntensity * 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Thrusters
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(-15, 7);
    ctx.lineTo(-18, 7 + 10 * flameIntensity);
    ctx.lineTo(-12, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, 7);
    ctx.lineTo(12, 7 + 10 * flameIntensity);
    ctx.lineTo(18, 7);
    ctx.fill();
    
  } else if (c === 'alien') {
    // UFO dome
    ctx.fillStyle = '#88ff88';
    ctx.beginPath();
    ctx.ellipse(0, -22, 14, 12, 0, Math.PI, 0);
    ctx.fill();
    
    // Alien inside
    ctx.fillStyle = '#44dd44';
    ctx.beginPath();
    ctx.ellipse(0, -25, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Big eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(-4, -27, 4, 5, -0.2, 0, Math.PI * 2);
    ctx.ellipse(4, -27, 4, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-5, -28, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -28, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Saucer body
    ctx.fillStyle = '#9966cc';
    ctx.beginPath();
    ctx.ellipse(0, -10, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Saucer rim
    ctx.fillStyle = '#bb88ee';
    ctx.beginPath();
    ctx.ellipse(0, -8, 26, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Lights
    const lightPhase = Date.now() / 200;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + lightPhase;
      const lx = Math.cos(angle) * 18;
      ctx.fillStyle = i % 2 === Math.floor(lightPhase) % 2 ? '#ffff00' : '#ff4400';
      ctx.beginPath();
      ctx.arc(lx, -8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Beam
    ctx.fillStyle = `rgba(136, 255, 136, ${0.15 + flameIntensity * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(-20, 15 + flameIntensity * 10);
    ctx.lineTo(20, 15 + flameIntensity * 10);
    ctx.lineTo(15, 0);
    ctx.fill();
  }
  
  ctx.restore();
}

function drawPlayer() {
  const { x, width, height } = player;
  
  // Apply hover bob offset
  const drawY = player.y + player.bobOffset;
  const cx = x + width/2;
  const cy = drawY + height/2;
  
  // Flash when invincible
  if (invincibleUntil > Date.now() && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  // Shield glow
  if (activeEffects.shield) {
    ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, 45, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const flameIntensity = !player.grounded ? (jumpHeld ? 1.8 : 1.2) : 0.5 + Math.sin(Date.now() / 100) * 0.2;
  
  drawCharacter(selectedChar, cx, cy + 5, 1, player.tilt, flameIntensity);
  
  ctx.globalAlpha = 1;
}

function drawObstacle(obs) {
  const cx = obs.x + obs.width/2;
  const cy = obs.y + obs.height/2;
  
  // Update rotation (spin toward player = clockwise = negative)
  obs.rotation -= obs.rotationSpeed;
  
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
    // Rotating asteroid
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(obs.rotation);
    
    ctx.fillStyle = currentEnvIndex === 1 ? '#a0522d' : '#8b7355';
    ctx.beginPath();
    ctx.arc(0, 0, obs.width/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Craters (rotate with asteroid)
    ctx.fillStyle = currentEnvIndex === 1 ? '#8b4513' : '#6b5344';
    ctx.beginPath();
    ctx.arc(-obs.width/6, -obs.width/6, obs.width * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obs.width * 0.15, obs.width * 0.1, obs.width * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
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
    // Same responsive jump for all - differences are in gravity/tilt
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

// Dynamic obstacle generation (no fixed patterns)
function generateObstacles(startX) {
  const results = [];
  const groundY = getGroundY();
  
  // Decide how many obstacles (weighted toward singles)
  const roll = Math.random();
  let count;
  if (roll < 0.6) count = 1;        // 60% single
  else if (roll < 0.85) count = 2;  // 25% double
  else count = 0;                    // 15% coins only
  
  let x = startX;
  for (let i = 0; i < count; i++) {
    // Random size (smaller = easier to jump)
    const size = 35 + Math.random() * 30; // 35-65
    
    results.push({ x, size });
    
    // Gap to next obstacle (if any) - always jumpable
    if (i < count - 1) {
      // Minimum gap based on size - bigger obstacles need more space
      const minGap = 180 + size * 1.5;
      const maxGap = minGap + 100;
      x += minGap + Math.random() * (maxGap - minGap);
    }
  }
  
  return results;
}

function spawnPattern() {
  const groundY = getGroundY();
  const startX = canvas.width + 50;
  
  // Generate dynamic obstacles
  const obstacleData = generateObstacles(startX);
  const isCoinsOnly = obstacleData.length === 0;
  
  obstacleData.forEach(obs => {
    const isSatellite = Math.random() < 0.2 && difficulty >= 2;
    const isMoving = Math.random() < 0.15 && difficulty >= 3;
    
    obstacles.push({
      x: obs.x,
      y: groundY - obs.size,
      baseY: groundY - obs.size,
      width: obs.size,
      height: obs.size,
      type: isSatellite ? 'satellite' : 'asteroid',
      moving: isMoving,
      moveOffset: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: 0.02 + Math.random() * 0.03
    });
  });
  
  // Coins - more on coin-only spawns, sometimes on regular spawns
  if (isCoinsOnly || Math.random() < 0.5) {
    const coinCount = isCoinsOnly ? 4 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2);
    const coinStartX = isCoinsOnly ? startX : startX + 80 + Math.random() * 50;
    const coinY = groundY - 100 - Math.random() * 80;
    
    for (let i = 0; i < coinCount; i++) {
      coinObjects.push({
        x: coinStartX + i * 45,
        y: isCoinsOnly ? coinY + Math.sin(i * 0.8) * 20 : groundY - 110 - Math.random() * 50,
        width: 30,
        height: 30
      });
    }
  }
  
  // Variable gap before next spawn
  const baseGap = minObstacleGap + Math.random() * 200;
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
  
  // Check for round complete
  if (currentRound === 1 && distanceTraveled >= ROUND_1_DISTANCE && !roundComplete) {
    startRoundTransition();
    return;
  }
  
  // Handle transition animation
  if (transitionActive) {
    updateTransition();
    return;
  }
  
  const groundY = getGroundY();
  
  // Character-specific physics (subtle differences, all responsive)
  let charGravity = gravity;
  let charJumpDecay = 0.4;
  
  if (selectedChar === 'alien') {
    charGravity = gravity * 0.85;  // Slightly floatier
    charJumpDecay = 0.35;
  } else if (selectedChar === 'hovercraft') {
    charGravity = gravity * 0.9;
    charJumpDecay = 0.38;
  }
  
  // Variable jump with character-specific feel
  if (jumpHeld && isJumping && player.vy < 0) {
    const holdTime = Date.now() - jumpStartTime;
    if (holdTime < maxJumpTime) {
      player.vy += charGravity * charJumpDecay;
    } else {
      player.vy += charGravity;
    }
  } else {
    player.vy += charGravity;
  }
  
  player.y += player.vy;
  
  if (player.y >= groundY - player.height) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.grounded = true;
    isJumping = false;
  }
  
  // Hover bob animation when grounded (different per character)
  if (player.grounded) {
    if (selectedChar === 'alien') {
      player.bobOffset = Math.sin(Date.now() / 300) * 4; // Slower, floatier
    } else if (selectedChar === 'hovercraft') {
      player.bobOffset = Math.sin(Date.now() / 150) * 2; // Quick, stable hover
    } else {
      player.bobOffset = Math.sin(Date.now() / 200) * 3;
    }
  } else {
    player.bobOffset = 0;
  }
  
  // Tilt based on vertical movement (unique per character)
  let targetTilt, tiltSpeed, maxTilt;
  
  if (selectedChar === 'alien') {
    // UFO leans FORWARD when rising - responsive but smooth
    targetTilt = player.vy * -0.02; // Forward lean on ascent
    tiltSpeed = 0.15; // Responsive
    maxTilt = 0.3;
  } else if (selectedChar === 'hovercraft') {
    // Hovercraft banks smoothly, stays more level
    targetTilt = player.vy * 0.012;
    tiltSpeed = 0.3; // Quick stabilization
    maxTilt = 0.2; // Stays more level
  } else {
    // Space kid - default behavior
    targetTilt = player.vy * 0.015;
    tiltSpeed = 0.2;
    maxTilt = 0.3;
  }
  
  player.tilt += (targetTilt - player.tilt) * tiltSpeed;
  player.tilt = Math.max(-maxTilt, Math.min(maxTilt, player.tilt));
  
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
        coin.x += dx * 0.08;
        coin.y += dy * 0.08;
        // Visual trail to show magnet pull
        if (Math.random() < 0.3) {
          particles.push({
            x: coin.x + 15,
            y: coin.y + 15,
            vx: dx * 0.02,
            vy: dy * 0.02,
            size: 3,
            color: '#ff6600',
            life: 0.5
          });
        }
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
  currentRound = 1;
  roundComplete = false;
  transitionActive = false;
  transitionProgress = 0;
  
  // Hide round complete screen if visible
  document.getElementById('round-complete').classList.add('hidden');
  document.getElementById('round-complete').classList.remove('show-ui');
  
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  
  // Brief grace period at start (no invincibility, just delayed obstacles)
  patternCooldown = 60; // ~1 second before first obstacle
  
  scoreEl.textContent = '0';
  coinsEl.textContent = '🪙 0';
}

function startRoundTransition() {
  roundComplete = true;
  transitionActive = true;
  transitionProgress = 0;
  
  // Show round complete overlay (but not UI yet)
  document.getElementById('round-complete').classList.remove('hidden');
}

function updateTransition() {
  transitionProgress += 0.008; // Slow, epic transition
  
  // Ease out curve
  const ease = 1 - Math.pow(1 - Math.min(transitionProgress, 1), 3);
  
  // Move ground down
  const groundOffset = ease * 400;
  
  // Move player up to center
  const targetY = canvas.height / 2 - player.height;
  player.y = player.y + (targetY - player.y) * 0.03;
  player.bobOffset = Math.sin(Date.now() / 300) * 5;
  
  // Draw transition frame
  drawTransition(groundOffset, ease);
  
  // Show UI after transition mostly complete
  if (transitionProgress > 0.6) {
    const roundCompleteEl = document.getElementById('round-complete');
    roundCompleteEl.classList.add('show-ui');
    
    // Update stats
    document.getElementById('round-score').textContent = score;
    document.getElementById('round-coins').textContent = coins;
    document.getElementById('round-distance').textContent = Math.floor(distanceTraveled);
    
    // Draw animated character
    drawRoundCharacter();
  }
  
  // Transition complete
  if (transitionProgress >= 1.5) {
    transitionActive = false;
    gameRunning = false;
  }
}

function drawTransition(groundOffset, ease) {
  const env = getEnv();
  
  // Sky gets darker/more spacey
  const skyDarkness = ease * 0.5;
  ctx.fillStyle = `rgb(${10 - skyDarkness * 10}, ${10 - skyDarkness * 10}, ${32 - skyDarkness * 20})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Stars move up slightly
  drawStars();
  
  // Parallax layers fall away
  ctx.save();
  ctx.translate(0, groundOffset * 0.5);
  drawParallaxLayers();
  ctx.restore();
  
  // Ground falls away faster
  ctx.save();
  ctx.translate(0, groundOffset);
  drawGround();
  
  // Remaining obstacles fall with ground
  obstacles.forEach(obs => {
    drawObstacle(obs);
  });
  ctx.restore();
  
  // Coins float up with player
  coinObjects.forEach(coin => {
    coin.y -= 2;
    drawCoin(coin);
  });
  
  // Player rises majestically
  const flameIntensity = 1.5 + Math.sin(Date.now() / 100) * 0.3;
  drawCharacter(selectedChar, player.x + player.width/2, player.y + player.bobOffset + player.height/2, 1, 0, flameIntensity);
  
  // Particle trail behind player
  if (Math.random() < 0.3) {
    particles.push({
      x: player.x + player.width/2 + (Math.random() - 0.5) * 20,
      y: player.y + player.height + 10,
      vx: (Math.random() - 0.5) * 2,
      vy: 3 + Math.random() * 2,
      size: 3 + Math.random() * 4,
      color: selectedChar === 'alien' ? '#88ff88' : selectedChar === 'hovercraft' ? '#00ffff' : '#ffaa00',
      life: 1
    });
  }
  
  drawParticles();
  
  // UI
  drawLives();
  scoreEl.textContent = score;
  coinsEl.textContent = '🪙 ' + coins;
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

// Character select screen
const charSelectScreen = document.getElementById('char-select');
const charOptions = document.querySelectorAll('.char-option');

function showCharSelect() {
  startScreen.classList.add('hidden');
  charSelectScreen.classList.remove('hidden');
  drawCharPreviews();
}

function drawCharPreviews() {
  characters.forEach((char, i) => {
    const previewCanvas = document.getElementById(`char-preview-${i}`);
    const pctx = previewCanvas.getContext('2d');
    pctx.clearRect(0, 0, 80, 80);
    
    pctx.save();
    pctx.translate(40, 45);
    
    // Mini version of drawCharacter
    if (char === 'spacekid') {
      pctx.fillStyle = '#ffffff';
      pctx.beginPath();
      pctx.roundRect(-12, -15, 24, 22, 5);
      pctx.fill();
      pctx.fillStyle = '#5588ff';
      pctx.beginPath();
      pctx.arc(0, -15, 11, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#88ccff';
      pctx.beginPath();
      pctx.arc(2, -15, 7, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#ffcc99';
      pctx.beginPath();
      pctx.arc(1, -15, 5, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#ff6b6b';
      pctx.fillRect(-17, -9, 6, 15);
      pctx.fillStyle = '#ff4400';
      pctx.beginPath();
      pctx.moveTo(-15, 6);
      pctx.lineTo(-17, 16);
      pctx.lineTo(-12, 6);
      pctx.fill();
    } else if (char === 'hovercraft') {
      pctx.fillStyle = '#44ddff';
      pctx.beginPath();
      pctx.ellipse(0, -12, 11, 9, 0, Math.PI, 0);
      pctx.fill();
      pctx.fillStyle = '#ff6644';
      pctx.beginPath();
      pctx.ellipse(0, -3, 17, 7, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#ffcc00';
      pctx.fillRect(-15, -5, 30, 3);
      pctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
      pctx.beginPath();
      pctx.ellipse(0, 5, 14, 4, 0, 0, Math.PI * 2);
      pctx.fill();
    } else if (char === 'alien') {
      pctx.fillStyle = '#88ff88';
      pctx.beginPath();
      pctx.ellipse(0, -14, 9, 8, 0, Math.PI, 0);
      pctx.fill();
      pctx.fillStyle = '#44dd44';
      pctx.beginPath();
      pctx.ellipse(0, -16, 5, 6, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#111';
      pctx.beginPath();
      pctx.ellipse(-2, -17, 2.5, 3, 0, 0, Math.PI * 2);
      pctx.ellipse(3, -17, 2.5, 3, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#9966cc';
      pctx.beginPath();
      pctx.ellipse(0, -6, 18, 6, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = 'rgba(136, 255, 136, 0.3)';
      pctx.beginPath();
      pctx.moveTo(-9, 0);
      pctx.lineTo(-12, 15);
      pctx.lineTo(12, 15);
      pctx.lineTo(9, 0);
      pctx.fill();
    }
    
    pctx.restore();
  });
}

function drawRoundCharacter() {
  const roundCharCanvas = document.getElementById('round-char');
  const rctx = roundCharCanvas.getContext('2d');
  rctx.clearRect(0, 0, 100, 100);
  
  rctx.save();
  rctx.translate(50, 55);
  const scale = 1.2;
  rctx.scale(scale, scale);
  
  // Hover bob animation
  const bob = Math.sin(Date.now() / 300) * 3;
  rctx.translate(0, bob);
  
  if (selectedChar === 'spacekid') {
    // Body
    rctx.fillStyle = '#ffffff';
    rctx.beginPath();
    rctx.roundRect(-15, -18, 30, 28, 6);
    rctx.fill();
    // Helmet
    rctx.fillStyle = '#5588ff';
    rctx.beginPath();
    rctx.arc(0, -18, 14, 0, Math.PI * 2);
    rctx.fill();
    // Visor
    rctx.fillStyle = '#88ccff';
    rctx.beginPath();
    rctx.arc(2, -18, 9, 0, Math.PI * 2);
    rctx.fill();
    // Face
    rctx.fillStyle = '#ffcc99';
    rctx.beginPath();
    rctx.arc(1, -18, 6, 0, Math.PI * 2);
    rctx.fill();
    // Jetpack
    rctx.fillStyle = '#ff6b6b';
    rctx.fillRect(-21, -12, 8, 18);
    // Flame
    rctx.fillStyle = '#ff4400';
    rctx.beginPath();
    rctx.moveTo(-18, 6);
    rctx.lineTo(-21, 18);
    rctx.lineTo(-14, 6);
    rctx.fill();
    rctx.fillStyle = '#ffcc00';
    rctx.beginPath();
    rctx.moveTo(-18, 6);
    rctx.lineTo(-19, 12);
    rctx.lineTo(-16, 6);
    rctx.fill();
  } else if (selectedChar === 'hovercraft') {
    // Cockpit
    rctx.fillStyle = '#44ddff';
    rctx.beginPath();
    rctx.ellipse(0, -15, 14, 11, 0, Math.PI, 0);
    rctx.fill();
    // Body
    rctx.fillStyle = '#ff6644';
    rctx.beginPath();
    rctx.ellipse(0, -4, 21, 9, 0, 0, Math.PI * 2);
    rctx.fill();
    // Stripe
    rctx.fillStyle = '#ffcc00';
    rctx.fillRect(-19, -6, 38, 4);
    // Glow
    rctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
    rctx.beginPath();
    rctx.ellipse(0, 6, 17, 5, 0, 0, Math.PI * 2);
    rctx.fill();
  } else if (selectedChar === 'alien') {
    // Head
    rctx.fillStyle = '#88ff88';
    rctx.beginPath();
    rctx.ellipse(0, -17, 11, 10, 0, Math.PI, 0);
    rctx.fill();
    // Eyes
    rctx.fillStyle = '#44dd44';
    rctx.beginPath();
    rctx.ellipse(0, -20, 6, 7, 0, 0, Math.PI * 2);
    rctx.fill();
    rctx.fillStyle = '#111';
    rctx.beginPath();
    rctx.ellipse(-2, -21, 3, 4, 0, 0, Math.PI * 2);
    rctx.ellipse(4, -21, 3, 4, 0, 0, Math.PI * 2);
    rctx.fill();
    // UFO
    rctx.fillStyle = '#9966cc';
    rctx.beginPath();
    rctx.ellipse(0, -7, 22, 8, 0, 0, Math.PI * 2);
    rctx.fill();
    // Beam
    rctx.fillStyle = 'rgba(136, 255, 136, 0.3)';
    rctx.beginPath();
    rctx.moveTo(-11, 0);
    rctx.lineTo(-15, 18);
    rctx.lineTo(15, 18);
    rctx.lineTo(11, 0);
    rctx.fill();
  }
  
  rctx.restore();
}

function selectCharacter(char) {
  selectedChar = char;
  charSelectScreen.classList.add('hidden');
  startGame();
}

charOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    selectCharacter(opt.dataset.char);
  });
});

const nextRoundBtn = document.getElementById('next-round-btn');

function startRound2() {
  currentRound = 2;
  roundComplete = false;
  transitionActive = false;
  transitionProgress = 0;
  
  document.getElementById('round-complete').classList.add('hidden');
  document.getElementById('round-complete').classList.remove('show-ui');
  
  // Reset position for round 2
  player.y = canvas.height / 2 - player.height;
  player.vy = 0;
  player.grounded = false; // Flying in space!
  
  obstacles = [];
  coinObjects = [];
  powerUps = [];
  
  gameRunning = true;
  
  // TODO: Round 2 will have flappy bird mechanics
  // For now just continue with modified gameplay
}

startBtn.addEventListener('click', showCharSelect);
restartBtn.addEventListener('click', showCharSelect);
nextRoundBtn.addEventListener('click', startRound2);

// Initialize
updateStartScreen();
gameLoop();
