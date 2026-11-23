import {
  BALL_RADIUS,
  CENTER_CIRCLE_R,
  GOAL_DEPTH,
  GOAL_HALF_W,
  GOAL_HEIGHT,
  HALF_H,
  HALF_W,
  PENALTY_AREA_H,
  PENALTY_AREA_W,
  PENALTY_SPOT_DIST,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  SIX_YARD_H,
  SIX_YARD_W,
} from './constants';
import { MatchEngine } from './MatchEngine';
import {
  AnimState,
  ChargeState,
  KitStyle,
  NetState,
  PlayerEntity,
  TeamSide,
} from '../types/game';

interface RenderPlayer {
  id: string;
  team: TeamSide;
  slotIndex: number;
  x: number;
  y: number;
  z: number;
  facing: number;
  animState: AnimState;
  animTime: number;
  hasBall: boolean;
  diveDirY: number;
  number: number;
  skinTone: string;
  hairColor: string;
  stamina: number;
}

const Y_SQUASH = 0.84; // Authentic PES wide-broadcast vertical perspective squash
const Z_SCALE = 0.92;  // Vertical height projection factor

export class PitchRenderer {
  private crowdDots: Array<{ x: number; y: number; color: string; phase: number; size: number }> = [];
  private adScroll = 0;

  constructor() {
    this.generateCrowd();
  }

  private generateCrowd() {
    this.crowdDots = [];
    const palette = ['#ef4444', '#3b82f6', '#f8fafc', '#facc15', '#22c55e', '#1e293b', '#f97316', '#cbd5e1'];
    // Top stands
    for (let i = 0; i < 380; i++) {
      this.crowdDots.push({
        x: -110 + Math.random() * (PITCH_WIDTH + 220),
        y: -115 + Math.random() * 64,
        color: palette[Math.floor(Math.random() * palette.length)],
        phase: Math.random() * Math.PI * 2,
        size: 2.2 + Math.random() * 2.0,
      });
    }
    // Bottom stands
    for (let i = 0; i < 240; i++) {
      this.crowdDots.push({
        x: -110 + Math.random() * (PITCH_WIDTH + 220),
        y: PITCH_HEIGHT + 44 + Math.random() * 68,
        color: palette[Math.floor(Math.random() * palette.length)],
        phase: Math.random() * Math.PI * 2,
        size: 2.2 + Math.random() * 2.0,
      });
    }
    // Left & right stands behind goals
    for (let i = 0; i < 160; i++) {
      const left = i % 2 === 0;
      this.crowdDots.push({
        x: left ? -125 + Math.random() * 64 : PITCH_WIDTH + 60 + Math.random() * 64,
        y: -40 + Math.random() * (PITCH_HEIGHT + 80),
        color: palette[Math.floor(Math.random() * palette.length)],
        phase: Math.random() * Math.PI * 2,
        size: 2.2 + Math.random() * 2.0,
      });
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: MatchEngine,
    width: number,
    height: number,
    timeSec: number
  ) {
    this.adScroll = (timeSec * 42) % 360;

    // Choose live frame vs instant replay frame
    const replayFrame = engine.getReplayFrame();
    const isReplay = engine.phase === 'goal_replay' && replayFrame !== null;

    const ballX = isReplay ? replayFrame.ballX : engine.ball.x;
    const ballY = isReplay ? replayFrame.ballY : engine.ball.y;
    const ballZ = isReplay ? replayFrame.ballZ : engine.ball.z;
    const ballRotX = isReplay ? replayFrame.ballRotX : engine.ball.rotX;
    const ballRotY = isReplay ? replayFrame.ballRotY : engine.ball.rotY;
    const ballTrail = isReplay ? replayFrame.ballTrail : engine.ball.trail;
    const leftNet = isReplay ? replayFrame.leftNet : engine.leftNet;
    const rightNet = isReplay ? replayFrame.rightNet : engine.rightNet;

    const renderPlayers: RenderPlayer[] = isReplay
      ? replayFrame.players.map((rp) => {
          const orig = engine.getPlayerById(rp.id)!;
          return {
            ...rp,
            number: orig.bio.number,
            skinTone: orig.bio.skinTone,
            hairColor: orig.bio.hairColor,
            stamina: orig.stamina,
          };
        })
      : engine.players.map((p) => ({
          id: p.id,
          team: p.team,
          slotIndex: p.slotIndex,
          x: p.x,
          y: p.y,
          z: p.z,
          facing: p.facing,
          animState: p.animState,
          animTime: p.animTime,
          hasBall: p.hasBall,
          diveDirY: p.diveDirY,
          number: p.bio.number,
          skinTone: p.bio.skinTone,
          hairColor: p.bio.hairColor,
          stamina: p.stamina,
        }));

    // Background stadium void
    ctx.save();
    ctx.fillStyle =
      engine.config.stadiumTime === 'day'
        ? '#0f172a'
        : engine.config.stadiumTime === 'sunset'
          ? '#1a1025'
          : '#060a14';
    ctx.fillRect(0, 0, width, height);

    // Compute broadcast camera scale
    const baseScale = Math.min(width / 820, height / 520);
    const scale = baseScale * engine.camZoom;

    // Screen shake offset
    const shakeX = engine.screenShake > 0 ? (Math.random() - 0.5) * engine.screenShake * 1.4 : 0;
    const shakeY = engine.screenShake > 0 ? (Math.random() - 0.5) * engine.screenShake * 1.4 : 0;

    // Clamp camera so pitch stays nicely framed
    const camX = Math.max(150, Math.min(PITCH_WIDTH - 150, engine.camX));
    const camY = Math.max(120, Math.min(PITCH_HEIGHT - 120, engine.camY));

    ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY * Y_SQUASH);

    // 1. Stadium stands, animated crowd & LED advertising boards
    this.drawStadiumSurround(ctx, engine, timeSec);

    // 2. Lush mowed grass pitch & chalk lines
    this.drawPitch(ctx, engine, timeSec);

    // 3. Skid marks from tackles/celebrations
    for (const sk of engine.skidMarks) {
      ctx.strokeStyle = `rgba(45, 74, 24, ${sk.alpha})`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sk.x1, sk.y1 * Y_SQUASH);
      ctx.lineTo(sk.x2, sk.y2 * Y_SQUASH);
      ctx.stroke();
    }

    // 4. Back half of goals (behind players/ball)
    this.drawGoalBack(ctx, true, leftNet);
    this.drawGoalBack(ctx, false, rightNet);

    // 5. Controlled player ground indicators & PES Power Gauge under feet
    if (!isReplay) {
      this.drawControlledGroundOverlay(ctx, engine, renderPlayers);
    }

    // 6. Penalty aiming reticle (when in Penalty Shootout aiming phase)
    if (engine.phase === 'penalty_shootout' && engine.penalty && engine.penalty.subPhase === 'aiming') {
      this.drawPenaltyReticle(ctx, engine);
    }

    // 7. Depth-sorted entities (players + ball)
    type DrawItem = { sortY: number; draw: () => void };
    const items: DrawItem[] = [];

    for (const p of renderPlayers) {
      items.push({
        sortY: p.y,
        draw: () => {
          const teamData = p.team === 'home' ? engine.homeTeam : engine.awayTeam;
          const isHomeCtrl = !isReplay && p.id === engine.homeControlledId;
          const isAwayCtrl =
            !isReplay &&
            p.id === engine.awayControlledId &&
            (engine.config.mode === 'local_pvp' || engine.config.mode === 'online');
          const isHomeNext = !isReplay && p.id === engine.homeNextSwitchId;
          this.drawPlayer(
            ctx,
            p,
            teamData.kit,
            isHomeCtrl,
            isAwayCtrl,
            isHomeNext
          );
        },
      });
    }

    items.push({
      sortY: ballY + 1,
      draw: () =>
        this.drawBall(ctx, ballX, ballY, ballZ, ballRotX, ballRotY, ballTrail),
    });

    items.sort((a, b) => a.sortY - b.sortY);
    for (const item of items) item.draw();

    // 8. Front posts & crossbar of both goals (renders over ball when ball enters net!)
    this.drawGoalFront(ctx, true);
    this.drawGoalFront(ctx, false);

    // 9. Particles (turf spray, shot sparks, goal confetti)
    for (const pt of engine.particles) {
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y * Y_SQUASH - pt.z * Z_SCALE, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // 10. Stadium floodlight atmosphere & Instant Replay broadcast grade
    this.drawBroadcastAtmosphere(ctx, engine, width, height, isReplay);
  }

  private drawStadiumSurround(ctx: CanvasRenderingContext2D, engine: MatchEngine, timeSec: number) {
    // Outer track / technical surround
    ctx.fillStyle = '#0d261a';
    ctx.fillRect(-135, -125 * Y_SQUASH, PITCH_WIDTH + 270, (PITCH_HEIGHT + 250) * Y_SQUASH);

    // Blue-slate athletic track border around turf
    ctx.fillStyle = '#152238';
    ctx.fillRect(-52, -48 * Y_SQUASH, PITCH_WIDTH + 104, (PITCH_HEIGHT + 96) * Y_SQUASH);

    // Inner dark turf apron
    ctx.fillStyle = '#1c5e2c';
    ctx.fillRect(-26, -24 * Y_SQUASH, PITCH_WIDTH + 52, (PITCH_HEIGHT + 48) * Y_SQUASH);

    // Crowd stands terraces
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(-135, -125 * Y_SQUASH, PITCH_WIDTH + 270, 77 * Y_SQUASH);
    ctx.fillRect(-135, (PITCH_HEIGHT + 44) * Y_SQUASH, PITCH_WIDTH + 270, 82 * Y_SQUASH);
    ctx.fillRect(-135, -48 * Y_SQUASH, 82, (PITCH_HEIGHT + 96) * Y_SQUASH);
    ctx.fillRect(PITCH_WIDTH + 53, -48 * Y_SQUASH, 82, (PITCH_HEIGHT + 96) * Y_SQUASH);

    // Animated cheering stadium crowd
    const cheerBoost = engine.phase === 'goal_celebration' ? 4.5 : 1.0;
    for (const c of this.crowdDots) {
      const bounce = Math.sin(timeSec * 3.5 * cheerBoost + c.phase) * (cheerBoost > 2 ? 2.4 : 0.6);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y * Y_SQUASH + bounce, c.size, c.size);
    }

    // Glowing PES LED Perimeter Ad-Boards along the top touchline!
    const boardY = -34 * Y_SQUASH;
    const boardH = 13;
    const grad = ctx.createLinearGradient(0, boardY, PITCH_WIDTH, boardY);
    grad.addColorStop(0, '#0c1b4d');
    grad.addColorStop(0.25, '#1d4ed8');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(0.75, '#0284c7');
    grad.addColorStop(1, '#0c1b4d');
    ctx.fillStyle = grad;
    ctx.fillRect(-15, boardY, PITCH_WIDTH + 30, boardH);

    // Top LED glow bar
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-15, boardY, PITCH_WIDTH + 30, 1.5);

    ctx.save();
    ctx.beginPath();
    ctx.rect(-15, boardY, PITCH_WIDTH + 30, boardH);
    ctx.clip();
    ctx.font = '700 8px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    const slogans = [
      'PES 2026',
      'PRO EVOLUTION FOOTBALL',
      'MATCHDAY LIVE',
      `${engine.homeTeam.shortName} vs ${engine.awayTeam.shortName}`,
      'E-FOOTBALL CHAMPIONSHIP',
      'KONAMI STADIUM',
    ];
    for (let x = -this.adScroll; x < PITCH_WIDTH + 360; x += 180) {
      const idx = Math.abs(Math.floor((x + this.adScroll) / 180)) % slogans.length;
      ctx.fillStyle = idx % 2 === 0 ? '#fde047' : '#e0f2fe';
      ctx.fillText(slogans[idx], x, boardY + boardH * 0.55);
    }
    ctx.restore();
  }

  private drawPitch(ctx: CanvasRenderingContext2D, engine: MatchEngine, timeSec: number) {
    // Mowed grass stripes (14 vertical alternating emerald stripes)
    const stripeCount = 14;
    const stripeW = PITCH_WIDTH / stripeCount;
    const isSunset = engine.config.stadiumTime === 'sunset';
    const lightGrass = isSunset ? '#2f8a3c' : '#2d9344';
    const darkGrass = isSunset ? '#267834' : '#257f3a';

    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? lightGrass : darkGrass;
      ctx.fillRect(i * stripeW, 0, stripeW + 0.6, PITCH_HEIGHT * Y_SQUASH);
    }

    // Subtle horizontal cross-cut sheen for photorealistic PES turf look
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let r = 0; r < 10; r += 2) {
      ctx.fillRect(0, (r * PITCH_HEIGHT * Y_SQUASH) / 10, PITCH_WIDTH, (PITCH_HEIGHT * Y_SQUASH) / 10);
    }

    // Crisp white chalk pitch markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.2;

    // Outer boundary
    ctx.strokeRect(0, 0, PITCH_WIDTH, PITCH_HEIGHT * Y_SQUASH);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(HALF_W, 0);
    ctx.lineTo(HALF_W, PITCH_HEIGHT * Y_SQUASH);
    ctx.stroke();

    // Center circle (elliptical due to Y_SQUASH)
    ctx.beginPath();
    ctx.ellipse(HALF_W, HALF_H * Y_SQUASH, CENTER_CIRCLE_R, CENTER_CIRCLE_R * Y_SQUASH, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(HALF_W, HALF_H * Y_SQUASH, 4, 4 * Y_SQUASH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left & Right Penalty Boxes + 6-Yard Boxes + Penalty Spots + D-Arcs
    const drawEndBox = (isLeft: boolean) => {
      const boxX = isLeft ? 0 : PITCH_WIDTH - PENALTY_AREA_W;
      const boxY = (HALF_H - PENALTY_AREA_H / 2) * Y_SQUASH;
      ctx.strokeRect(boxX, boxY, PENALTY_AREA_W, PENALTY_AREA_H * Y_SQUASH);

      const sixX = isLeft ? 0 : PITCH_WIDTH - SIX_YARD_W;
      const sixY = (HALF_H - SIX_YARD_H / 2) * Y_SQUASH;
      ctx.strokeRect(sixX, sixY, SIX_YARD_W, SIX_YARD_H * Y_SQUASH);

      const spotX = isLeft ? PENALTY_SPOT_DIST : PITCH_WIDTH - PENALTY_SPOT_DIST;
      ctx.beginPath();
      ctx.ellipse(spotX, HALF_H * Y_SQUASH, 3.5, 3.5 * Y_SQUASH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Penalty D-arc
      ctx.beginPath();
      if (isLeft) {
        ctx.ellipse(spotX, HALF_H * Y_SQUASH, CENTER_CIRCLE_R, CENTER_CIRCLE_R * Y_SQUASH, 0, -0.92, 0.92);
      } else {
        ctx.ellipse(spotX, HALF_H * Y_SQUASH, CENTER_CIRCLE_R, CENTER_CIRCLE_R * Y_SQUASH, 0, Math.PI - 0.92, Math.PI + 0.92);
      }
      ctx.stroke();
    };

    drawEndBox(true);
    drawEndBox(false);

    // Corner arcs & waving corner flags
    const corners = [
      { x: 0, y: 0, a1: 0, a2: Math.PI / 2 },
      { x: PITCH_WIDTH, y: 0, a1: Math.PI / 2, a2: Math.PI },
      { x: PITCH_WIDTH, y: PITCH_HEIGHT, a1: Math.PI, a2: Math.PI * 1.5 },
      { x: 0, y: PITCH_HEIGHT, a1: Math.PI * 1.5, a2: Math.PI * 2 },
    ];
    for (const c of corners) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y * Y_SQUASH, 14, 14 * Y_SQUASH, 0, c.a1, c.a2);
      ctx.stroke();

      // Flagpole + fluttering pennant
      const fy = c.y * Y_SQUASH;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c.x, fy);
      ctx.lineTo(c.x, fy - 16);
      ctx.stroke();

      const wave = Math.sin(timeSec * 6 + c.x) * 2.5;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(c.x, fy - 16);
      ctx.lineTo(c.x + 9, fy - 13 + wave);
      ctx.lineTo(c.x, fy - 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2.2;
    }
  }

  private drawGoalBack(ctx: CanvasRenderingContext2D, isLeft: boolean, net: NetState) {
    const lineX = isLeft ? 0 : PITCH_WIDTH;
    const backX = isLeft ? -GOAL_DEPTH : PITCH_WIDTH + GOAL_DEPTH;
    const topY = (HALF_H - GOAL_HALF_W) * Y_SQUASH;
    const botY = (HALF_H + GOAL_HALF_W) * Y_SQUASH;
    const h = GOAL_HEIGHT * Z_SCALE;

    // Ground shadow inside goal
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(
      Math.min(lineX, backX),
      topY,
      GOAL_DEPTH,
      botY - topY
    );

    // Dynamic rippling back net mesh!
    const ripple = (yWorld: number, zWorld: number): number => {
      if (net.strength <= 0.01) return 0;
      const d = Math.hypot(yWorld - net.impactY, zWorld - net.impactZ);
      const falloff = Math.exp(-d / 48);
      const dir = isLeft ? -1 : 1;
      return dir * net.strength * falloff * (11 + Math.sin(net.phase - d * 0.14) * 7);
    };

    ctx.strokeStyle = 'rgba(241, 245, 249, 0.42)';
    ctx.lineWidth = 1;

    // Back net vertical & horizontal strands
    const cols = 10;
    const rows = 5;
    for (let i = 0; i <= cols; i++) {
      const t = i / cols;
      const yWorld = HALF_H - GOAL_HALF_W + t * (GOAL_HALF_W * 2);
      const sy = yWorld * Y_SQUASH;
      ctx.beginPath();
      for (let r = 0; r <= rows; r++) {
        const zWorld = (r / rows) * GOAL_HEIGHT;
        const bx = backX + ripple(yWorld, zWorld);
        const by = sy - zWorld * Z_SCALE;
        if (r === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.stroke();
    }

    for (let r = 0; r <= rows; r++) {
      const zWorld = (r / rows) * GOAL_HEIGHT;
      ctx.beginPath();
      for (let i = 0; i <= cols; i++) {
        const t = i / cols;
        const yWorld = HALF_H - GOAL_HALF_W + t * (GOAL_HALF_W * 2);
        const bx = backX + ripple(yWorld, zWorld);
        const by = yWorld * Y_SQUASH - zWorld * Z_SCALE;
        if (i === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.stroke();
    }

    // Top roof netting
    for (let i = 0; i <= cols; i++) {
      const yWorld = HALF_H - GOAL_HALF_W + (i / cols) * (GOAL_HALF_W * 2);
      const sy = yWorld * Y_SQUASH - h;
      ctx.beginPath();
      ctx.moveTo(lineX, sy);
      ctx.lineTo(backX + ripple(yWorld, GOAL_HEIGHT), sy);
      ctx.stroke();
    }

    // Back stanchions (dark metallic support bars)
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.72)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(lineX, topY - h);
    ctx.lineTo(backX, topY - h);
    ctx.lineTo(backX, topY);
    ctx.moveTo(lineX, botY - h);
    ctx.lineTo(backX, botY - h);
    ctx.lineTo(backX, botY);
    ctx.moveTo(backX, topY - h);
    ctx.lineTo(backX, botY - h);
    ctx.stroke();
  }

  private drawGoalFront(ctx: CanvasRenderingContext2D, isLeft: boolean) {
    const lineX = isLeft ? 0 : PITCH_WIDTH;
    const topY = (HALF_H - GOAL_HALF_W) * Y_SQUASH;
    const botY = (HALF_H + GOAL_HALF_W) * Y_SQUASH;
    const h = GOAL_HEIGHT * Z_SCALE;

    // Crisp white 3D front posts & crossbar
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(lineX, topY);
    ctx.lineTo(lineX, topY - h);
    ctx.lineTo(lineX, botY - h);
    ctx.lineTo(lineX, botY);
    ctx.stroke();

    // Specular highlight
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(lineX, topY);
    ctx.lineTo(lineX, topY - h);
    ctx.lineTo(lineX, botY - h);
    ctx.lineTo(lineX, botY);
    ctx.stroke();
  }

  private drawControlledGroundOverlay(
    ctx: CanvasRenderingContext2D,
    engine: MatchEngine,
    players: RenderPlayer[]
  ) {
    const drawFor = (id: string | null, charge: ChargeState, color: string) => {
      if (!id) return;
      const p = players.find((pl) => pl.id === id);
      if (!p) return;
      const sx = p.x;
      const sy = p.y * Y_SQUASH;

      // Classic PES glowing oval ring under controlled player's feet
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 16, 11, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Aim direction chevron
      const ax = sx + Math.cos(p.facing) * 21;
      const ay = sy + Math.sin(p.facing) * 21 * Y_SQUASH;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ax, ay, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Iconic PES Power Gauge right below player's feet when charging!
      if (charge.action !== 'none' && charge.power > 0.02) {
        const barW = 36;
        const barH = 5.5;
        const bx = sx - barW / 2;
        const by = sy + 15;

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

        const g = ctx.createLinearGradient(bx, by, bx + barW, by);
        g.addColorStop(0, '#22c55e');
        g.addColorStop(0.55, '#facc15');
        g.addColorStop(0.82, '#f97316');
        g.addColorStop(1, '#ef4444');
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, barW * charge.power, barH);

        // Sweet-spot tick mark
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + barW * 0.72, by - 1, 1.2, barH + 2);
      }

      ctx.restore();
    };

    drawFor(engine.homeControlledId, engine.homeCharge, '#38bdf8');
    if (engine.config.mode === 'local_pvp' || engine.config.mode === 'online') {
      drawFor(engine.awayControlledId, engine.awayCharge, '#fb7185');
    }
  }

  private drawPenaltyReticle(ctx: CanvasRenderingContext2D, engine: MatchEngine) {
    const pen = engine.penalty!;
    const isHumanShooting = pen.turnTeam === 'home' || engine.config.mode === 'local_pvp';
    if (!isHumanShooting) return;

    const targetX = PITCH_WIDTH - 2;
    const targetY = (HALF_H + pen.aimX * (GOAL_HALF_W - 8)) * Y_SQUASH;
    const targetZ = pen.aimY * (GOAL_HEIGHT - 4) * Z_SCALE;
    const ry = targetY - targetZ;

    ctx.save();
    // Target crosshair
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(targetX, ry, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(targetX - 15, ry);
    ctx.lineTo(targetX + 15, ry);
    ctx.moveTo(targetX, ry - 15);
    ctx.lineTo(targetX, ry + 15);
    ctx.stroke();

    ctx.fillStyle = pen.power > 0.88 ? '#ef4444' : '#fde047';
    ctx.beginPath();
    ctx.arc(targetX, ry, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    p: RenderPlayer,
    kit: KitStyle,
    isHomeCtrl: boolean,
    isAwayCtrl: boolean,
    isHomeNext: boolean
  ) {
    const sx = p.x;
    const sy = p.y * Y_SQUASH;
    const lift = p.z * Z_SCALE;

    const isGk = p.slotIndex === 0;
    const jerseyPrimary = isGk ? kit.gkPrimary : kit.primary;
    const jerseySecondary = isGk ? kit.gkSecondary : kit.secondary;

    // Ground shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    const shadowScale = Math.max(0.55, 1 - p.z / 75);
    const isHorizontal =
      p.animState === 'slide_tackle' ||
      p.animState === 'gk_dive_left' ||
      p.animState === 'gk_dive_right' ||
      p.animState === 'celebrate_slide';
    ctx.beginPath();
    ctx.ellipse(
      sx,
      sy + 2,
      (isHorizontal ? 16 : 9.5) * shadowScale,
      (isHorizontal ? 6.5 : 5) * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Articulated body transform
    ctx.translate(sx, sy - lift);

    // Horizontal dive / slide rotation
    if (p.animState === 'gk_dive_left' || p.animState === 'gk_dive_right') {
      const diveRot = p.animState === 'gk_dive_left' ? -1.35 : 1.35;
      ctx.translate(0, -10);
      ctx.rotate(diveRot);
      ctx.translate(0, 10);
    } else if (p.animState === 'slide_tackle' || p.animState === 'celebrate_slide') {
      const slideDir = Math.cos(p.facing) >= 0 ? 1 : -1;
      ctx.translate(0, -5);
      ctx.rotate(slideDir * 1.05);
      ctx.translate(0, 5);
    } else if (p.animState === 'sprint' || p.animState === 'dribble') {
      // Dynamic forward sprint lean!
      const lean = Math.cos(p.facing) * 0.14;
      ctx.rotate(lean);
    } else if (p.animState === 'stumble') {
      ctx.rotate(Math.sin(p.animTime * 10) * 0.25);
    } else if (p.animState === 'skill_feint') {
      ctx.rotate(Math.sin(p.animTime * 18) * 0.2);
    }

    // Stride animation cycle
    const moving =
      p.animState === 'jog' ||
      p.animState === 'sprint' ||
      p.animState === 'dribble' ||
      p.animState === 'celebrate_airplane';
    const strideAmp =
      p.animState === 'sprint'
        ? 6.8
        : p.animState === 'dribble'
          ? 5.2
          : moving
            ? 4.6
            : 0;
    const stride = moving ? Math.sin(p.animTime) * strideAmp : 0;
    const bob = moving ? Math.abs(Math.cos(p.animTime)) * 2.2 : Math.sin(p.animTime * 0.6) * 0.4;

    const kickSwing =
      p.animState === 'kick_shoot'
        ? 9.5
        : p.animState === 'kick_pass' || p.animState === 'kick_lob'
          ? 6.5
          : p.animState === 'stand_tackle'
            ? 7.5
            : 0;
    const facingX = Math.cos(p.facing) >= 0 ? 1 : -1;

    // === LEGS, SOCKS & BOOTS ===
    const leftLegY = -2 + stride * 0.35;
    const rightLegY = -2 - stride * 0.35;
    const leftFootX = -3.4 + stride * facingX * 0.65;
    const rightFootX = 3.4 - stride * facingX * 0.65 + kickSwing * facingX;

    // Left leg
    ctx.strokeStyle = kit.socks;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3.2, -9 - bob);
    ctx.lineTo(leftFootX, leftLegY);
    ctx.stroke();
    // Left boot
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(leftFootX + facingX * 1.4, leftLegY + 0.5, 3, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right leg (kicking leg)
    ctx.strokeStyle = kit.socks;
    ctx.beginPath();
    ctx.moveTo(3.2, -9 - bob);
    ctx.lineTo(rightFootX, rightLegY - (kickSwing > 0 ? 2.5 : 0));
    ctx.stroke();
    // Right boot
    ctx.fillStyle = p.slotIndex === 9 || p.slotIndex === 10 ? '#facc15' : '#0f172a';
    ctx.beginPath();
    ctx.ellipse(
      rightFootX + facingX * 1.4,
      rightLegY - (kickSwing > 0 ? 2.5 : 0) + 0.5,
      3.1,
      1.8,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // === SHORTS ===
    ctx.fillStyle = isGk ? '#0f172a' : kit.shorts;
    ctx.beginPath();
    ctx.roundRect(-6.2, -13.5 - bob, 12.4, 6.2, 2);
    ctx.fill();

    // === TORSO / JERSEY ===
    const torsoY = -24.5 - bob;
    const torsoW = 13.6;
    const torsoH = 12.2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, torsoY, torsoW, torsoH, 3.2);
    ctx.clip();

    // Base jersey fill
    ctx.fillStyle = jerseyPrimary;
    ctx.fillRect(-torsoW / 2, torsoY, torsoW, torsoH);

    // Authentic Kit Patterns
    if (!isGk) {
      if (kit.pattern === 'vertical') {
        ctx.fillStyle = jerseySecondary;
        ctx.fillRect(-4.5, torsoY, 2.8, torsoH);
        ctx.fillRect(1.7, torsoY, 2.8, torsoH);
      } else if (kit.pattern === 'hoops') {
        ctx.fillStyle = jerseySecondary;
        ctx.fillRect(-torsoW / 2, torsoY + 3, torsoW, 3);
        ctx.fillRect(-torsoW / 2, torsoY + 8.5, torsoW, 3);
      } else if (kit.pattern === 'sash') {
        ctx.strokeStyle = jerseySecondary;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-torsoW / 2, torsoY + torsoH);
        ctx.lineTo(torsoW / 2, torsoY);
        ctx.stroke();
      } else if (kit.pattern === 'sleeves') {
        ctx.fillStyle = jerseySecondary;
        ctx.fillRect(-torsoW / 2, torsoY, 3, torsoH);
        ctx.fillRect(torsoW / 2 - 3, torsoY, 3, torsoH);
      }
    }

    // Subtle collar accent
    ctx.fillStyle = kit.accent;
    ctx.fillRect(-3.5, torsoY, 7, 2);
    ctx.restore();

    // Crisp jersey outline
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, torsoY, torsoW, torsoH, 3.2);
    ctx.stroke();

    // Back / Chest Jersey Number
    ctx.fillStyle = isGk ? '#ffffff' : kit.numberColor;
    ctx.font = '800 6.8px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.number), 0, torsoY + 6.7);

    // === ANIMATED ARMS ===
    const armSwing = -stride * 0.55;
    ctx.strokeStyle = p.skinTone;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';

    if (p.animState === 'celebrate_airplane') {
      // Iconic airplane wings out!
      ctx.beginPath();
      ctx.moveTo(-6.5, torsoY + 3);
      ctx.lineTo(-15.5, torsoY + 1);
      ctx.moveTo(6.5, torsoY + 3);
      ctx.lineTo(15.5, torsoY + 1);
      ctx.stroke();
    } else if (p.animState === 'celebrate_jump') {
      // Fist pumps in the air!
      ctx.beginPath();
      ctx.moveTo(-6.5, torsoY + 3);
      ctx.lineTo(-11, torsoY - 7);
      ctx.moveTo(6.5, torsoY + 3);
      ctx.lineTo(11, torsoY - 7);
      ctx.stroke();
    } else if (p.animState === 'gk_dive_left' || p.animState === 'gk_dive_right') {
      // Outstretched goalkeeper gloves!
      ctx.beginPath();
      ctx.moveTo(-5, torsoY + 2);
      ctx.lineTo(-6, torsoY - 11);
      ctx.moveTo(5, torsoY + 2);
      ctx.lineTo(6, torsoY - 11);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-6, torsoY - 11.5, 2.5, 0, Math.PI * 2);
      ctx.arc(6, torsoY - 11.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-6.5, torsoY + 3);
      ctx.lineTo(-8.8, torsoY + 9.5 + armSwing);
      ctx.moveTo(6.5, torsoY + 3);
      ctx.lineTo(8.8, torsoY + 9.5 - armSwing);
      ctx.stroke();
      if (isGk) {
        // Goalkeeper gloves
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(-8.8, torsoY + 9.8 + armSwing, 2.2, 0, Math.PI * 2);
        ctx.arc(8.8, torsoY + 9.8 - armSwing, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === HEAD & HAIR ===
    const headY = torsoY - 5.2;
    ctx.fillStyle = p.skinTone;
    ctx.beginPath();
    ctx.arc(0, headY, 5.1, 0, Math.PI * 2);
    ctx.fill();

    // Hair cap
    ctx.fillStyle = p.hairColor;
    ctx.beginPath();
    ctx.arc(0, headY - 1.1, 5.1, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();

    ctx.restore();

    // === CLASSIC PES OVERHEAD CURSORS ===
    if (isHomeCtrl || isAwayCtrl) {
      const cursorColor = isHomeCtrl ? '#38bdf8' : '#fb7185';
      const cy = sy - lift - 39;
      ctx.save();
      ctx.fillStyle = cursorColor;
      ctx.shadowColor = cursorColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(sx, cy + 7.5);
      ctx.lineTo(sx - 6, cy - 1.5);
      ctx.lineTo(sx + 6, cy - 1.5);
      ctx.closePath();
      ctx.fill();

      // P1 / P2 mini tag
      ctx.shadowBlur = 0;
      ctx.font = '800 7px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(isHomeCtrl ? 'P1' : 'P2', sx, cy - 4);
      ctx.restore();
    } else if (isHomeNext) {
      // Classic PES outlined ghost cursor for next-switch defender
      const cy = sy - lift - 38;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, cy + 6.5);
      ctx.lineTo(sx - 5, cy - 1);
      ctx.lineTo(sx + 5, cy - 1);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBall(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    z: number,
    rotX: number,
    rotY: number,
    trail: Array<{ x: number; y: number; z: number; alpha: number; color: string }>
  ) {
    const sy = y * Y_SQUASH;
    const by = sy - z * Z_SCALE;

    // Landing target ring when ball is high in the air (helps time headers/volleys!)
    if (z > 20) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(x, sy, 9.5, 9.5 * Y_SQUASH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Dynamic ground shadow (shrinks & softens with height z)
    const shadowScale = Math.max(0.45, 1 - z / 110);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.38 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(x + z * 0.14, sy + 2, BALL_RADIUS * 1.15 * shadowScale, BALL_RADIUS * 0.72 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shot speed / finesse trail ribbon
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      ctx.globalAlpha = t.alpha * 0.55;
      ctx.fillStyle = t.color;
      const r = BALL_RADIUS * (0.45 + (i / Math.max(1, trail.length)) * 0.45);
      ctx.beginPath();
      ctx.arc(t.x, t.y * Y_SQUASH - t.z * Z_SCALE, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3D Soccer ball sphere (slightly larger when high toward camera)
    const r = BALL_RADIUS * (1 + Math.min(0.28, z / 180));
    ctx.save();
    ctx.translate(x, by);

    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.7, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Rotating classic soccer pentagon patches
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 4; i++) {
      const a = rotX * 0.55 + (i * Math.PI) / 2;
      const px = Math.cos(a) * r * 0.58;
      const py = Math.sin(a + rotY * 0.35) * r * 0.55;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.31, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private drawBroadcastAtmosphere(
    ctx: CanvasRenderingContext2D,
    engine: MatchEngine,
    width: number,
    height: number,
    isReplay: boolean
  ) {
    // Subtle corner floodlight glow
    if (engine.config.stadiumTime === 'night') {
      const g = ctx.createRadialGradient(width / 2, height * 0.45, width * 0.25, width / 2, height / 2, width * 0.72);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(2, 6, 23, 0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    } else if (engine.config.stadiumTime === 'sunset') {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, 'rgba(251, 146, 60, 0.14)');
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(30, 27, 75, 0.26)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    // Broadcast Instant Replay cinematic framing
    if (isReplay) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
      ctx.fillRect(0, 0, width, height);

      // Cinematic letterbox bars
      ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
      ctx.fillRect(0, 0, width, 34);
      ctx.fillRect(0, height - 34, width, 34);
    }
  }
}

