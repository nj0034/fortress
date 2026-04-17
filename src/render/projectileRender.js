/**
 * projectileRender.js — Per-weapon projectile shape renderers.
 *
 * All draw functions use ctx.save/restore, translate to (x,y),
 * rotate by angle, and scale by radius/20.
 *
 * drawProjectileShape(ctx, shape, { x, y, radius, color, angle })
 */

// ---------------------------------------------------------------------------
// Individual shape renderers (operate in normalised space, pivot at origin)
// radius/20 scale is applied by the caller wrapper below.
// ---------------------------------------------------------------------------

function drawBulletRound(ctx, color) {
  // Simple glowing circle — baseline shape
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // bright specular highlight
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.ellipse(-2.5, -2.5, 3.5, 2.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrill(ctx, color) {
  // Cylindrical body + forward spike
  ctx.fillStyle = color;
  ctx.fillRect(-8, -5, 14, 10);
  // Spiral grooves
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.5;
  for (let i = -6; i <= 4; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, -5);
    ctx.lineTo(i + 2, 5);
    ctx.stroke();
  }
  // Forward tip (arrow)
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.moveTo(6, -5);
  ctx.lineTo(14, 0);
  ctx.lineTo(6, 5);
  ctx.closePath();
  ctx.fill();
}

function drawOrb(ctx, color) {
  // Multi-layer glowing orb with inner rings
  const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 12);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // outer ring
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCrystal(ctx, color) {
  // Hexagonal crystal shape
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    const r = 11;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // inner facet
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    const r = 5.5;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function drawZigzag(ctx, color) {
  // Lightning bolt shape
  ctx.shadowBlur = 14;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(2, -10);
  ctx.lineTo(4, -2);
  ctx.lineTo(-6, -2);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-2, 10);
  ctx.lineTo(-4, 2);
  ctx.lineTo(6, 2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // bright core
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(2, -8);
  ctx.lineTo(4, -1);
  ctx.lineTo(-10, -1);
  ctx.stroke();
}

function drawRail(ctx, color) {
  // Elongated arrow/rail slug
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  // body
  ctx.fillRect(-12, -3.5, 20, 7);
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(8, -6);
  ctx.lineTo(14, 0);
  ctx.lineTo(8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // tail fins
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-16, -6);
  ctx.lineTo(-10, -3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-16, 6);
  ctx.lineTo(-10, 3);
  ctx.closePath();
  ctx.fill();
}

function drawMeteor(ctx, color) {
  // Rocky mass + fire tail (pointing backward = negative x)
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ff6600";
  // fire glow
  const fireGrad = ctx.createRadialGradient(-14, 0, 1, -8, 0, 18);
  fireGrad.addColorStop(0, "rgba(255,220,80,0.9)");
  fireGrad.addColorStop(0.5, "rgba(255,100,20,0.6)");
  fireGrad.addColorStop(1, "rgba(255,60,0,0)");
  ctx.fillStyle = fireGrad;
  ctx.beginPath();
  ctx.ellipse(-8, 0, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // rocky body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(2, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  // surface crags
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(5, -4, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-2, 4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(0, -2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawComet(ctx, color) {
  // Round head + long bright flame tail
  const tailLen = 22;
  const tailGrad = ctx.createLinearGradient(-tailLen, 0, 8, 0);
  tailGrad.addColorStop(0, "rgba(255,255,255,0)");
  tailGrad.addColorStop(0.4, color.replace(")", ",0.4)").replace("rgb", "rgba"));
  tailGrad.addColorStop(1, "rgba(255,255,255,0.9)");
  ctx.fillStyle = tailGrad;
  ctx.beginPath();
  ctx.moveTo(-tailLen, 0);
  ctx.quadraticCurveTo(-tailLen * 0.3, -6, 6, -5);
  ctx.quadraticCurveTo(9, -2.5, 9, 0);
  ctx.quadraticCurveTo(9, 2.5, 6, 5);
  ctx.quadraticCurveTo(-tailLen * 0.3, 6, -tailLen, 0);
  ctx.fill();
  // head glow
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(-2, -2.5, 3.5, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawTriforce(ctx, color) {
  // Three triangles arranged as a triforce / triskelion
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  const h = 9;
  const drawTri = (cx, cy) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + h * 0.866, cy + h * 0.5);
    ctx.lineTo(cx - h * 0.866, cy + h * 0.5);
    ctx.closePath();
    ctx.fill();
  };
  drawTri(0, -5);
  drawTri(-7, 4);
  drawTri(7, 4);
  ctx.shadowBlur = 0;
  // center hole
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.arc(0, 2.5, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSwarm(ctx, color) {
  // Cluster of small orbiting particles
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  const pts = [
    [0, 0, 5],
    [10, -4, 3],
    [-9, 3, 3],
    [5, 8, 2.5],
    [-5, -7, 2.5],
    [12, 5, 2],
    [-11, -3, 2],
  ];
  for (const [px, py, r] of pts) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw a projectile shape to an existing canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} shape   - One of: bullet-round drill orb crystal zigzag rail meteor comet triforce swarm
 * @param {{ x: number, y: number, radius: number, color: string, angle: number }} opts
 */
export function drawProjectileShape(ctx, shape, { x, y, radius, color, angle }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = radius / 20;
  ctx.scale(s, s);

  switch (shape) {
    case "drill":    drawDrill(ctx, color);    break;
    case "orb":      drawOrb(ctx, color);      break;
    case "crystal":  drawCrystal(ctx, color);  break;
    case "zigzag":   drawZigzag(ctx, color);   break;
    case "rail":     drawRail(ctx, color);     break;
    case "meteor":   drawMeteor(ctx, color);   break;
    case "comet":    drawComet(ctx, color);    break;
    case "triforce": drawTriforce(ctx, color); break;
    case "swarm":    drawSwarm(ctx, color);    break;
    default:         drawBulletRound(ctx, color); break; // bullet-round + fallback
  }

  ctx.restore();
}
