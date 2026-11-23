import {
  AIR_DRAG,
  BALL_BOUNCE,
  BALL_RADIUS,
  BASE_JOG_SPEED,
  BASE_SPRINT_SPEED,
  CHARGE_RATE_LOB,
  CHARGE_RATE_PASS,
  CHARGE_RATE_SHOOT,
  CURL_STRENGTH,
  DRIBBLE_SPEED_FACTOR,
  GK_MOVE_SPEED,
  GOAL_CELEBRATION_DURATION,
  GOAL_DEPTH,
  GOAL_HALF_W,
  GOAL_HEIGHT,
  GRAVITY,
  HALF_H,
  HALF_W,
  INTRO_DURATION,
  PENALTY_SPOT_DIST,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  PLAYER_RADIUS,
  REPLAY_BUFFER_SIZE,
  REPLAY_PLAYBACK_SPEED,
  TURF_FRICTION,
} from './constants';
import { FORMATIONS, getTeamById } from '../data/teams';
import { soundEngine } from '../audio/SoundEngine';
import {
  BallEntity,
  ChargeState,
  Difficulty,
  GoalEvent,
  HudSnapshot,
  InputState,
  MatchConfig,
  MatchPhase,
  MatchStats,
  NetState,
  Particle,
  PenaltyShootoutState,
  PlayerEntity,
  ReplayFrame,
  SetPieceState,
  SetPieceType,
  SkidMark,
  TeamData,
  TeamMatchStats,
  TeamSide,
} from '../types/game';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function emptyTeamStats(): TeamMatchStats {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    possessionTicks: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    tackles: 0,
    fouls: 0,
    corners: 0,
    saves: 0,
  };
}

function emptyCharge(): ChargeState {
  return { action: 'none', power: 0, finesse: false, playerId: null };
}

interface DiffParams {
  aiReactionDelay: number;
  aiSpeedMult: number;
  aiPassAccuracy: number;
  aiShotAccuracy: number;
  gkReflex: number;
  pressAggression: number;
}

const DIFFICULTY_MAP: Record<Difficulty, DiffParams> = {
  beginner: {
    aiReactionDelay: 0.42,
    aiSpeedMult: 0.82,
    aiPassAccuracy: 0.72,
    aiShotAccuracy: 0.55,
    gkReflex: 0.65,
    pressAggression: 0.45,
  },
  regular: {
    aiReactionDelay: 0.25,
    aiSpeedMult: 0.92,
    aiPassAccuracy: 0.84,
    aiShotAccuracy: 0.72,
    gkReflex: 0.8,
    pressAggression: 0.68,
  },
  top_player: {
    aiReactionDelay: 0.14,
    aiSpeedMult: 1.0,
    aiPassAccuracy: 0.92,
    aiShotAccuracy: 0.85,
    gkReflex: 0.92,
    pressAggression: 0.85,
  },
  superstar: {
    aiReactionDelay: 0.06,
    aiSpeedMult: 1.06,
    aiPassAccuracy: 0.97,
    aiShotAccuracy: 0.93,
    gkReflex: 1.02,
    pressAggression: 0.96,
  },
};

export interface SerializedState {
  phase: MatchPhase;
  half: number;
  matchClockSeconds: number;
  homeScore: number;
  awayScore: number;
  homeControlledId: string | null;
  awayControlledId: string | null;
  homeCharge: ChargeState;
  awayCharge: ChargeState;
  ball: BallEntity;
  leftNet: NetState;
  rightNet: NetState;
  players: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    facing: number;
    stamina: number;
    animState: PlayerEntity['animState'];
    animTime: number;
    hasBall: boolean;
    diveDirY: number;
  }>;
  lastGoal: GoalEvent | null;
  bannerText: string | null;
  bannerSubtext: string | null;
  commentary: string;
  stats: MatchStats;
  penalty: PenaltyShootoutState | null;
}

export class MatchEngine {
  public config: MatchConfig;
  public homeTeam: TeamData;
  public awayTeam: TeamData;

  public players: PlayerEntity[] = [];
  public ball: BallEntity;
  public particles: Particle[] = [];
  public skidMarks: SkidMark[] = [];
  public leftNet: NetState = { impactY: HALF_H, impactZ: 15, strength: 0, phase: 0 };
  public rightNet: NetState = { impactY: HALF_H, impactZ: 15, strength: 0, phase: 0 };

  public phase: MatchPhase = 'intro';
  public phaseTimer = 0;
  public half = 1;
  public homeAttacksRight = true;
  public kickoffTeam: TeamSide = 'home';

  // Virtual match clock (0..2700 1st half, 2700..5400 2nd half)
  public matchClockSeconds = 0;
  public stoppageMinutes = 2;
  private clockScale: number;

  public homeControlledId: string | null = null;
  public awayControlledId: string | null = null;
  public homeNextSwitchId: string | null = null;
  public awayNextSwitchId: string | null = null;
  public homeCharge: ChargeState = emptyCharge();
  public awayCharge: ChargeState = emptyCharge();
  private homeGkRush = false;
  private awayGkRush = false;

  public stats: MatchStats = {
    home: emptyTeamStats(),
    away: emptyTeamStats(),
    goals: [],
  };
  public lastGoal: GoalEvent | null = null;
  public bannerText: string | null = null;
  public bannerSubtext: string | null = null;
  public commentary = 'Welcome to tonight\'s PES Matchday broadcast!';
  public isPaused = false;

  // Set piece state
  public setPiece: SetPieceState | null = null;

  // Replay ring buffer & playback
  public replayBuffer: ReplayFrame[] = [];
  public replayPlayhead = 0;
  private replayFramesSnapshot: ReplayFrame[] = [];

  // Camera state (world coords + zoom)
  public camX = HALF_W;
  public camY = HALF_H;
  public camZoom = 1.0;
  public screenShake = 0;

  // AI timers
  private aiDecisionTimer = 0;
  private celebrationScorerId: string | null = null;
  private passPendingTeam: TeamSide | null = null;

  // Penalty Shootout state
  public penalty: PenaltyShootoutState | null = null;

  constructor(config: MatchConfig) {
    this.config = config;
    this.homeTeam = getTeamById(config.homeTeamId);
    this.awayTeam = getTeamById(config.awayTeamId);
    // 90 virtual minutes = 5400s mapped to matchMinutes real-time minutes
    this.clockScale = 5400 / Math.max(60, config.matchMinutes * 60);

    this.ball = this.createInitialBall();
    this.spawnPlayers();

    if (config.mode === 'penalties') {
      this.startPenaltyShootout();
    } else if (config.mode === 'training') {
      this.phase = 'playing';
      this.homeAttacksRight = true;
      this.bannerText = 'FREE TRAINING';
      this.bannerSubtext = 'PRACTICE DRIBBLING, FINESSE & POWER SHOTS';
      this.phaseTimer = 2.0;
      this.setupTrainingPositions();
    } else {
      this.phase = 'intro';
      this.phaseTimer = INTRO_DURATION;
      this.bannerText = `${this.homeTeam.shortName}  vs  ${this.awayTeam.shortName}`;
      this.bannerSubtext = 'PES MATCHDAY LIVE';
      this.setupKickoffPositions('home');
    }
  }

  private createInitialBall(): BallEntity {
    return {
      x: HALF_W,
      y: HALF_H,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      rotX: 0,
      rotY: 0,
      ownerId: null,
      lastTouchTeam: null,
      lastTouchPlayerId: null,
      prevTouchPlayerId: null,
      prevTouchTeam: null,
      lastKickSpeedKmh: 0,
      lastShotType: 'normal',
      isCross: false,
      inGoal: null,
      trail: [],
    };
  }

  private spawnPlayers() {
    this.players = [];
    const buildTeam = (team: TeamSide, data: TeamData, formationId: MatchConfig['homeFormation']) => {
      const anchors = FORMATIONS[formationId].anchors;
      for (let i = 0; i < 11; i++) {
        const bio = data.roster[i];
        const anchor = anchors[i];
        const attacksRight = team === 'home' ? this.homeAttacksRight : !this.homeAttacksRight;
        const hx = attacksRight ? anchor.x * PITCH_WIDTH : (1 - anchor.x) * PITCH_WIDTH;
        const hy = attacksRight ? anchor.y * PITCH_HEIGHT : (1 - anchor.y) * PITCH_HEIGHT;
        this.players.push({
          id: `${team}_${i}`,
          team,
          slotIndex: i,
          bio,
          x: hx,
          y: hy,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          facing: attacksRight ? 0 : Math.PI,
          stamina: 100,
          animState: i === 0 ? 'gk_ready' : 'idle',
          animTime: Math.random() * 6,
          animLockTimer: 0,
          actionCooldown: 0,
          stunTimer: 0,
          skillTimer: 0,
          hasBall: false,
          dribbleTouchPhase: 0,
          homeX: hx,
          homeY: hy,
          diveDirY: 0,
          divePower: 0,
          yellowCards: 0,
        });
      }
    };

    buildTeam('home', this.homeTeam, this.config.homeFormation);
    buildTeam('away', this.awayTeam, this.config.awayFormation);

    this.homeControlledId = 'home_9';
    this.awayControlledId = 'away_9';
  }

  public getAttackDir(team: TeamSide): 1 | -1 {
    if (team === 'home') return this.homeAttacksRight ? 1 : -1;
    return this.homeAttacksRight ? -1 : 1;
  }

  public getPlayerById(id: string | null): PlayerEntity | undefined {
    if (!id) return undefined;
    return this.players.find((p) => p.id === id);
  }

  private setupKickoffPositions(kickoffTeam: TeamSide) {
    this.kickoffTeam = kickoffTeam;
    this.ball = this.createInitialBall();
    this.homeCharge = emptyCharge();
    this.awayCharge = emptyCharge();
    this.setPiece = null;

    for (const p of this.players) {
      const form = p.team === 'home' ? this.config.homeFormation : this.config.awayFormation;
      const anchor = FORMATIONS[form].anchors[p.slotIndex];
      const dir = this.getAttackDir(p.team);

      // Compress players cleanly into their own half for kickoff
      let normX = anchor.x * 0.56;
      let normY = anchor.y;
      if (p.slotIndex === 0) normX = 0.04;

      let px = dir === 1 ? normX * PITCH_WIDTH : (1 - normX) * PITCH_WIDTH;
      let py = dir === 1 ? normY * PITCH_HEIGHT : (1 - normY) * PITCH_HEIGHT;

      // Put striker(s) at the center spot for kickoff team
      if (p.team === kickoffTeam && p.slotIndex === 9) {
        px = HALF_W - dir * 10;
        py = HALF_H;
      } else if (p.team === kickoffTeam && p.slotIndex === 10) {
        px = HALF_W - dir * 32;
        py = HALF_H + 45;
      } else if (p.team !== kickoffTeam && p.slotIndex === 9) {
        px = HALF_W - dir * 96;
        py = HALF_H;
      }

      p.x = px;
      p.y = py;
      p.z = 0;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.facing = dir === 1 ? 0 : Math.PI;
      p.hasBall = false;
      p.animState = p.slotIndex === 0 ? 'gk_ready' : 'idle';
      p.animLockTimer = 0;
      p.stunTimer = 0;
      p.skillTimer = 0;
      p.actionCooldown = 0;
    }

    const kicker = this.players.find((p) => p.team === kickoffTeam && p.slotIndex === 9);
    if (kicker) {
      this.assignBallOwner(kicker);
      if (kickoffTeam === 'home') this.homeControlledId = kicker.id;
      else this.awayControlledId = kicker.id;
    }
    this.homeControlledId = this.players.find((p) => p.team === 'home' && p.slotIndex === 9)?.id ?? 'home_9';
    this.awayControlledId = this.players.find((p) => p.team === 'away' && p.slotIndex === 9)?.id ?? 'away_9';
  }

  private setupTrainingPositions() {
    this.ball = this.createInitialBall();
    this.ball.x = HALF_W + 120;
    this.ball.y = HALF_H;
    for (const p of this.players) {
      if (p.team === 'away' && p.slotIndex !== 0) {
        // Keep defenders out of the way in training, except GK + 2 training cones/defenders
        if (p.slotIndex === 2 || p.slotIndex === 3) {
          p.x = PITCH_WIDTH - 220;
          p.y = HALF_H + (p.slotIndex === 2 ? -95 : 95);
        } else {
          p.x = 120 + p.slotIndex * 25;
          p.y = 40;
        }
      } else if (p.team === 'away' && p.slotIndex === 0) {
        p.x = PITCH_WIDTH - 34;
        p.y = HALF_H;
      } else if (p.team === 'home') {
        const anchor = FORMATIONS[this.config.homeFormation].anchors[p.slotIndex];
        p.x = anchor.x * PITCH_WIDTH;
        p.y = anchor.y * PITCH_HEIGHT;
      }
      p.vx = 0;
      p.vy = 0;
      p.z = 0;
      p.hasBall = false;
      p.animState = p.slotIndex === 0 ? 'gk_ready' : 'idle';
    }
    const striker = this.getPlayerById('home_9');
    if (striker) {
      striker.x = HALF_W + 110;
      striker.y = HALF_H;
      this.assignBallOwner(striker);
      this.homeControlledId = striker.id;
    }
  }

  public startPenaltyShootout() {
    this.phase = 'penalty_shootout';
    this.homeAttacksRight = true;
    this.bannerText = 'PENALTY SHOOTOUT';
    this.bannerSubtext = 'AIM WITH WASD / ARROWS • SHOOT WITH K / ENTER';
    this.penalty = {
      turnTeam: 'home',
      round: 1,
      subPhase: 'aiming',
      phaseTimer: 0,
      aimX: 0,
      aimY: 0.45,
      power: 0.2,
      powerOscDir: 1,
      keeperDiveGuess: 0,
      homeScore: 0,
      awayScore: 0,
      homeHistory: [],
      awayHistory: [],
      lastResultText: '',
      winner: null,
    };
    this.setupPenaltyKick('home');
  }

  private setupPenaltyKick(team: TeamSide) {
    const spotX = PITCH_WIDTH - PENALTY_SPOT_DIST;
    const spotY = HALF_H;
    this.ball = this.createInitialBall();
    this.ball.x = spotX;
    this.ball.y = spotY;

    // Position all non-involved players around center circle watching
    for (const p of this.players) {
      p.vx = 0;
      p.vy = 0;
      p.z = 0;
      p.hasBall = false;
      p.animLockTimer = 0;
      p.animState = 'idle';
      p.x = HALF_W - 20 + (p.team === 'home' ? -25 : 25);
      p.y = HALF_H + (p.slotIndex - 5) * 26;
      p.facing = 0;
    }

    const roundIdx = Math.max(0, (this.penalty?.round ?? 1) - 1);
    const takerOrder = [9, 10, 8, 7, 6, 5, 4, 1, 2, 3];
    const takerSlot = takerOrder[roundIdx % takerOrder.length];
    const taker = this.players.find((p) => p.team === team && p.slotIndex === takerSlot)!;
    const keeperTeam: TeamSide = team === 'home' ? 'away' : 'home';
    const keeper = this.players.find((p) => p.team === keeperTeam && p.slotIndex === 0)!;

    taker.x = spotX - 42;
    taker.y = spotY + 6;
    taker.facing = 0;

    keeper.x = PITCH_WIDTH - 14;
    keeper.y = spotY;
    keeper.facing = Math.PI;
    keeper.animState = 'gk_ready';

    this.homeControlledId = team === 'home' ? taker.id : keeper.id;
    this.awayControlledId = team === 'away' ? taker.id : keeper.id;
    this.commentary = `${taker.bio.shortName} steps up to the penalty spot...`;
  }

  public skipReplay() {
    if (this.phase === 'goal_replay') {
      this.finishGoalReplay();
    }
  }

  private finishGoalReplay() {
    this.replayFramesSnapshot = [];
    this.bannerText = null;
    this.bannerSubtext = null;
    if (this.config.mode === 'training') {
      this.phase = 'playing';
      this.setupTrainingPositions();
      return;
    }
    const concedeTeam: TeamSide = this.lastGoal?.scoringTeam === 'home' ? 'away' : 'home';
    this.phase = 'kickoff';
    this.phaseTimer = 0.7;
    this.setupKickoffPositions(concedeTeam);
    soundEngine.playWhistle('kickoff');
  }

  public continueFromHalftime() {
    if (this.phase !== 'halftime') return;
    this.half = 2;
    this.homeAttacksRight = false;
    this.matchClockSeconds = 2700;
    // Slight halftime stamina recovery
    for (const p of this.players) {
      p.stamina = Math.min(100, p.stamina + 28);
    }
    this.phase = 'kickoff';
    this.phaseTimer = 0.8;
    this.bannerText = 'SECOND HALF';
    this.bannerSubtext = 'KICKOFF';
    this.setupKickoffPositions('away');
    soundEngine.playWhistle('kickoff');
  }

  public getReplayFrame(): ReplayFrame | null {
    if (this.phase !== 'goal_replay' || this.replayFramesSnapshot.length === 0) return null;
    const idx = clamp(Math.floor(this.replayPlayhead), 0, this.replayFramesSnapshot.length - 1);
    return this.replayFramesSnapshot[idx];
  }

  public update(dtRaw: number, p1Input: InputState, p2Input: InputState | null) {
    if (this.isPaused) return;
    const dt = Math.min(dtRaw, 0.033);

    // Decay nets, shake, particles, skid marks
    this.updateNet(this.leftNet, dt);
    this.updateNet(this.rightNet, dt);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);
    this.updateParticles(dt);

    if (this.phase === 'penalty_shootout') {
      this.updatePenaltyShootout(dt, p1Input, p2Input);
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'intro') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'kickoff';
        this.phaseTimer = 0.6;
        this.bannerText = 'KICK OFF';
        this.bannerSubtext = null;
        soundEngine.playWhistle('kickoff');
        soundEngine.startCrowdAmbience();
      }
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'halftime' || this.phase === 'fulltime') {
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'goal_replay') {
      this.replayPlayhead += REPLAY_PLAYBACK_SPEED * 60 * dt;
      if (
        this.replayPlayhead >= this.replayFramesSnapshot.length - 1 ||
        p1Input.passJustPressed ||
        p1Input.shootJustPressed
      ) {
        this.finishGoalReplay();
      }
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'goal_celebration') {
      this.phaseTimer -= dt;
      this.updateCelebration(dt);
      this.updateBallPhysics(dt, true);
      if (this.phaseTimer <= 0) {
        if (this.replayBuffer.length > 20) {
          this.replayFramesSnapshot = [...this.replayBuffer];
          this.replayPlayhead = 0;
          this.phase = 'goal_replay';
          this.bannerText = 'INSTANT REPLAY';
          this.bannerSubtext = this.lastGoal
            ? `${this.lastGoal.scorerName} (${this.lastGoal.minute}') • ${this.lastGoal.shotSpeedKmh} KM/H`
            : null;
        } else {
          this.finishGoalReplay();
        }
      }
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'kickoff') {
      this.phaseTimer -= dt;
      const kicker = this.getPlayerById(this.ball.ownerId);
      const isHumanKickoff =
        this.kickoffTeam === 'home' ||
        this.config.mode === 'local_pvp' ||
        this.config.mode === 'online';
      const activeInput = this.kickoffTeam === 'home' ? p1Input : p2Input;

      if (
        (isHumanKickoff &&
          activeInput &&
          (Math.abs(activeInput.moveX) > 0.15 ||
            Math.abs(activeInput.moveY) > 0.15 ||
            activeInput.passJustPressed ||
            activeInput.shootJustPressed)) ||
        (!isHumanKickoff && this.phaseTimer <= 0)
      ) {
        this.phase = 'playing';
        this.bannerText = null;
        this.bannerSubtext = null;
        if (!isHumanKickoff && kicker) {
          // AI passes back cleanly to midfield at kickoff
          const mate = this.players.find((p) => p.team === kicker.team && p.slotIndex === 5);
          if (mate) this.executePass(kicker, mate, 0.35, false);
        }
      }
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'set_piece' && this.setPiece) {
      this.updateSetPiece(dt, p1Input, p2Input);
      this.updateCamera(dt);
      return;
    }

    // === MAIN PLAYING PHASE ===
    if (this.phaseTimer > 0) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.bannerText = null;
        this.bannerSubtext = null;
      }
    }

    // Advance match clock (except in free training)
    if (this.config.mode !== 'training') {
      this.matchClockSeconds += dt * this.clockScale;
      const halfLimit = this.half === 1 ? 2700 + this.stoppageMinutes * 60 : 5400 + this.stoppageMinutes * 60;
      if (this.matchClockSeconds >= halfLimit) {
        // Wait briefly if ball is right inside penalty box for dramatic finish!
        const inDangerZone = this.ball.x < 175 || this.ball.x > PITCH_WIDTH - 175;
        if (!inDangerZone || this.matchClockSeconds >= halfLimit + 180) {
          if (this.half === 1) {
            this.phase = 'halftime';
            this.bannerText = 'HALF TIME';
            this.bannerSubtext = `${this.homeTeam.shortName} ${this.stats.home.goals} - ${this.stats.away.goals} ${this.awayTeam.shortName}`;
            soundEngine.playWhistle('halftime');
            return;
          } else {
            this.phase = 'fulltime';
            this.bannerText = 'FULL TIME';
            this.bannerSubtext = `${this.homeTeam.shortName} ${this.stats.home.goals} - ${this.stats.away.goals} ${this.awayTeam.shortName}`;
            soundEngine.playWhistle('fulltime');
            return;
          }
        }
      }
    }

    // Possession stats
    if (this.ball.ownerId) {
      const owner = this.getPlayerById(this.ball.ownerId);
      if (owner) {
        if (owner.team === 'home') this.stats.home.possessionTicks++;
        else this.stats.away.possessionTicks++;
      }
    }

    // Dynamic crowd excitement when ball nears either penalty box
    const boxProximity = Math.max(
      1 - Math.min(this.ball.x, PITCH_WIDTH - this.ball.x) / 260,
      0
    );
    soundEngine.setCrowdExcitement(boxProximity * 0.75);

    // Update auto-switch candidates & controlled players
    this.updateSwitchCandidates();

    // Process Human Inputs
    this.handleHumanTeam('home', p1Input, dt);
    const awayIsHuman =
      this.config.mode === 'local_pvp' ||
      (this.config.mode === 'online' && p2Input !== null);
    if (awayIsHuman && p2Input) {
      this.handleHumanTeam('away', p2Input, dt);
    }

    // Update AI for all non-controlled players
    this.aiDecisionTimer -= dt;
    const runAiDecisions = this.aiDecisionTimer <= 0;
    if (runAiDecisions) {
      this.aiDecisionTimer = DIFFICULTY_MAP[this.config.difficulty].aiReactionDelay;
    }

    for (const p of this.players) {
      const isHumanControlled =
        p.id === this.homeControlledId ||
        (awayIsHuman && p.id === this.awayControlledId);

      if (p.slotIndex === 0) {
        this.updateGoalkeeper(p, dt);
      } else if (!isHumanControlled) {
        this.updateOutfieldAI(p, dt, runAiDecisions);
      }

      this.integratePlayer(p, dt);
    }

    // Resolve player-to-player soft spacing & ball pickups/tackles
    this.resolvePlayerCollisions();
    this.updateBallPhysics(dt, false);

    // Record frame into rolling replay buffer
    this.recordReplayFrame();

    this.updateCamera(dt);
  }

  private updateNet(net: NetState, dt: number) {
    if (net.strength > 0.005) {
      net.phase += dt * 24;
      net.strength *= Math.pow(0.22, dt);
    } else {
      net.strength = 0;
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z = Math.max(0, pt.z + pt.vz * dt);
      pt.vz -= pt.gravity * dt;
      if (pt.z === 0 && pt.vz < 0) {
        pt.vz *= -0.35;
        pt.vx *= 0.7;
        pt.vy *= 0.7;
      }
      pt.alpha = clamp(pt.life / pt.maxLife, 0, 1);
    }
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].alpha -= dt * 0.07;
      if (this.skidMarks[i].alpha <= 0) this.skidMarks.splice(i, 1);
    }
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    color: string,
    speed: number,
    life = 0.5,
    size = 3
  ) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({
        x,
        y,
        z,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        vz: 45 + Math.random() * 110,
        size: size * (0.7 + Math.random() * 0.7),
        color,
        alpha: 1,
        life: life * (0.7 + Math.random() * 0.5),
        maxLife: life,
        gravity: 340,
      });
    }
  }

  private updateSwitchCandidates() {
    const pickClosest = (team: TeamSide, excludeId: string | null) => {
      let best: PlayerEntity | null = null;
      let bestScore = Infinity;
      for (const p of this.players) {
        if (p.team !== team || p.slotIndex === 0 || p.id === excludeId) continue;
        // Predict ball slightly ahead for snappy PES switching
        const bx = this.ball.x + this.ball.vx * 0.18;
        const by = this.ball.y + this.ball.vy * 0.18;
        const d = dist(p.x, p.y, bx, by);
        if (d < bestScore) {
          bestScore = d;
          best = p;
        }
      }
      return best?.id ?? null;
    };

    // Auto-switch if ball owner is on this team
    const owner = this.getPlayerById(this.ball.ownerId);
    if (owner && owner.slotIndex !== 0) {
      if (owner.team === 'home') this.homeControlledId = owner.id;
      else this.awayControlledId = owner.id;
    } else if (!owner) {
      // Auto-switch on loose/incoming ball if another outfield player is much closer
      for (const team of ['home', 'away'] as TeamSide[]) {
        const curId = team === 'home' ? this.homeControlledId : this.awayControlledId;
        const cur = this.getPlayerById(curId);
        const closestId = pickClosest(team, null);
        const closest = this.getPlayerById(closestId);
        if (closest && (!cur || dist(closest.x, closest.y, this.ball.x, this.ball.y) + 38 < dist(cur.x, cur.y, this.ball.x, this.ball.y))) {
          if (team === 'home') this.homeControlledId = closest.id;
          else this.awayControlledId = closest.id;
        }
      }
    }

    this.homeNextSwitchId = pickClosest('home', this.homeControlledId);
    this.awayNextSwitchId = pickClosest('away', this.awayControlledId);
  }

  private handleHumanTeam(team: TeamSide, input: InputState, dt: number) {
    const ctrlId = team === 'home' ? this.homeControlledId : this.awayControlledId;
    const charge = team === 'home' ? this.homeCharge : this.awayCharge;
    const player = this.getPlayerById(ctrlId);
    if (!player) return;

    const teamHasBall =
      this.ball.ownerId !== null &&
      this.getPlayerById(this.ball.ownerId)?.team === team;
    const playerCanKick =
      player.hasBall ||
      (!this.ball.ownerId && dist(player.x, player.y, this.ball.x, this.ball.y) < 32 && this.ball.z < 36);

    // GK Rush command while defending
    if (!teamHasBall && input.throughHeld) {
      if (team === 'home') this.homeGkRush = true;
      else this.awayGkRush = true;
    } else {
      if (team === 'home') this.homeGkRush = false;
      else this.awayGkRush = false;
    }

    // Manual player switch on Pass press when defending
    if (!teamHasBall && !playerCanKick && input.passJustPressed) {
      const nextId = team === 'home' ? this.homeNextSwitchId : this.awayNextSwitchId;
      if (nextId) {
        if (team === 'home') this.homeControlledId = nextId;
        else this.awayControlledId = nextId;
      }
      charge.action = 'none';
      charge.power = 0;
      return;
    }

    // Skill Move / Feint burst!
    if (input.skillJustPressed && player.hasBall && player.animLockTimer <= 0 && player.actionCooldown <= 0) {
      player.animState = 'skill_feint';
      player.animLockTimer = 0.32;
      player.skillTimer = 0.42;
      player.actionCooldown = 0.65;
      const aimAngle =
        Math.hypot(input.moveX, input.moveY) > 0.2
          ? Math.atan2(input.moveY, input.moveX)
          : player.facing;
      player.facing = aimAngle;
      player.vx = Math.cos(aimAngle) * 235;
      player.vy = Math.sin(aimAngle) * 235;
      this.spawnParticles(player.x, player.y, 2, 8, '#a3e635', 75, 0.35, 2.5);
    }

    // Defending actions when not owning the ball
    if (!playerCanKick && !teamHasBall) {
      // Sliding tackle (O / L / Q)
      if (input.lobJustPressed && player.animLockTimer <= 0 && player.actionCooldown <= 0) {
        this.startSlideTackle(player, input.moveX, input.moveY);
      }
      // Press / Standing tackle (□ / K / Enter)
      if (input.shootHeld && player.animLockTimer <= 0) {
        const dx = this.ball.x - player.x;
        const dy = this.ball.y - player.y;
        const d = Math.hypot(dx, dy) || 1;
        const spd = this.getPlayerMaxSpeed(player, true);
        player.vx += ((dx / d) * spd - player.vx) * Math.min(1, dt * 11);
        player.vy += ((dy / d) * spd - player.vy) * Math.min(1, dt * 11);
        player.facing = Math.atan2(dy, dx);
        player.animState = 'sprint';
        if (d < 28 && player.actionCooldown <= 0) {
          this.attemptStandingTackle(player);
        }
        return;
      }
    }

    // Movement (when not locked in slide tackle / stumble)
    if (player.animLockTimer <= 0 && player.stunTimer <= 0) {
      const mag = Math.hypot(input.moveX, input.moveY);
      if (mag > 0.08) {
        const sprinting = input.sprint && player.stamina > 8;
        let maxSpd = this.getPlayerMaxSpeed(player, sprinting);
        if (player.hasBall) maxSpd *= DRIBBLE_SPEED_FACTOR;

        const targetVx = (input.moveX / mag) * maxSpd * Math.min(1, mag);
        const targetVy = (input.moveY / mag) * maxSpd * Math.min(1, mag);
        const accel = player.hasBall ? 10.5 : 13.0;
        player.vx += (targetVx - player.vx) * Math.min(1, dt * accel);
        player.vy += (targetVy - player.vy) * Math.min(1, dt * accel);
        player.facing = Math.atan2(targetVy, targetVx);

        if (sprinting) {
          player.stamina = Math.max(0, player.stamina - dt * 11.5);
          if (Math.random() < dt * 8) {
            this.spawnParticles(player.x, player.y, 1, 1, '#65a30d', 30, 0.25, 2);
          }
        } else {
          player.stamina = Math.min(100, player.stamina + dt * 4.5);
        }

        player.animState = player.hasBall ? 'dribble' : sprinting ? 'sprint' : 'jog';
      } else {
        player.vx *= Math.pow(0.001, dt);
        player.vy *= Math.pow(0.001, dt);
        player.stamina = Math.min(100, player.stamina + dt * 9.5);
        player.animState = 'idle';
      }
    }

    // === PES POWER GAUGE CHARGING & KICK RELEASE ===
    if (playerCanKick) {
      if (input.shootJustPressed) {
        charge.action = 'shoot';
        charge.power = 0.08;
        charge.finesse = input.finesse;
        charge.playerId = player.id;
      } else if (input.passJustPressed) {
        charge.action = 'pass';
        charge.power = 0.12;
        charge.finesse = false;
        charge.playerId = player.id;
      } else if (input.throughJustPressed) {
        charge.action = 'through';
        charge.power = 0.14;
        charge.finesse = false;
        charge.playerId = player.id;
      } else if (input.lobJustPressed) {
        charge.action = 'lob';
        charge.power = 0.12;
        charge.finesse = false;
        charge.playerId = player.id;
      }
    }

    if (charge.action !== 'none') {
      const rate =
        charge.action === 'shoot'
          ? CHARGE_RATE_SHOOT
          : charge.action === 'lob'
            ? CHARGE_RATE_LOB
            : CHARGE_RATE_PASS;

      const stillHeld =
        (charge.action === 'shoot' && input.shootHeld) ||
        (charge.action === 'pass' && input.passHeld) ||
        (charge.action === 'through' && input.throughHeld) ||
        (charge.action === 'lob' && input.lobHeld);

      if (charge.action === 'shoot') charge.finesse = input.finesse;

      if (stillHeld && charge.power < 1) {
        charge.power = Math.min(1, charge.power + dt * rate);
      }

      const shouldFire = !stillHeld || charge.power >= 0.99;
      if (shouldFire) {
        if (playerCanKick) {
          this.fireChargedKick(player, charge, input);
        }
        charge.action = 'none';
        charge.power = 0;
        charge.playerId = null;
      }
    }
  }

  private fireChargedKick(player: PlayerEntity, charge: ChargeState, input: InputState) {
    const aimMag = Math.hypot(input.moveX, input.moveY);
    const aimX = aimMag > 0.15 ? input.moveX / aimMag : Math.cos(player.facing);
    const aimY = aimMag > 0.15 ? input.moveY / aimMag : Math.sin(player.facing);

    if (charge.action === 'shoot') {
      this.executeShot(player, aimX, aimY, charge.power, charge.finesse);
    } else if (charge.action === 'pass') {
      const target = this.findPassTarget(player, aimX, aimY, false);
      if (target) {
        this.executePass(player, target, charge.power, false);
      } else {
        this.kickFreeDirection(player, aimX, aimY, 270 + charge.power * 220, 20, 'kick_pass');
      }
    } else if (charge.action === 'through') {
      const target = this.findPassTarget(player, aimX, aimY, true);
      if (target) {
        this.executePass(player, target, charge.power, true);
      } else {
        this.kickFreeDirection(player, aimX, aimY, 340 + charge.power * 240, 25, 'kick_pass');
      }
    } else if (charge.action === 'lob') {
      const target = this.findPassTarget(player, aimX, aimY, false);
      this.executeLobCross(player, aimX, aimY, target, charge.power);
    }
  }

  private findPassTarget(
    passer: PlayerEntity,
    aimX: number,
    aimY: number,
    isThrough: boolean
  ): PlayerEntity | null {
    let best: PlayerEntity | null = null;
    let bestScore = -Infinity;
    const attackDir = this.getAttackDir(passer.team);

    for (const mate of this.players) {
      if (mate.team !== passer.team || mate.id === passer.id) continue;
      const dx = mate.x - passer.x;
      const dy = mate.y - passer.y;
      const d = Math.hypot(dx, dy);
      if (d < 28 || d > 540) continue;

      const dot = (dx / d) * aimX + (dy / d) * aimY;
      if (dot < 0.25) continue;

      let score = dot * 120 - d * 0.14;
      if (isThrough && dx * attackDir > 20) score += 38;
      if (mate.slotIndex === 0) score -= 45; // prefer outfield teammates unless aiming directly back
      if (score > bestScore) {
        bestScore = score;
        best = mate;
      }
    }
    return best;
  }

  private executePass(
    passer: PlayerEntity,
    target: PlayerEntity,
    power: number,
    isThrough: boolean
  ) {
    const attackDir = this.getAttackDir(passer.team);
    let tx = target.x + target.vx * (isThrough ? 0.55 : 0.22);
    let ty = target.y + target.vy * (isThrough ? 0.55 : 0.22);
    if (isThrough) {
      tx += attackDir * (68 + power * 85);
    }
    tx = clamp(tx, 25, PITCH_WIDTH - 25);
    ty = clamp(ty, 25, PITCH_HEIGHT - 25);

    const dx = tx - this.ball.x;
    const dy = ty - this.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = clamp(255 + d * 0.92 + power * 180, 270, 560);

    this.releaseBall(passer);
    this.ball.vx = (dx / d) * speed;
    this.ball.vy = (dy / d) * speed;
    this.ball.vz = isThrough ? 32 : 12;
    this.ball.spin = 0;
    this.ball.isCross = false;
    this.ball.lastShotType = 'normal';
    this.ball.lastKickSpeedKmh = Math.round(speed * 0.17);

    passer.facing = Math.atan2(dy, dx);
    passer.animState = 'kick_pass';
    passer.animLockTimer = 0.22;
    passer.actionCooldown = 0.22;

    if (passer.team === 'home') this.stats.home.passesAttempted++;
    else this.stats.away.passesAttempted++;
    this.passPendingTeam = passer.team;

    soundEngine.playKick(0.32 + power * 0.35, false);

    // Switch cursor immediately toward the pass receiver for classic crisp PES feel
    if (target.slotIndex !== 0) {
      if (passer.team === 'home') this.homeControlledId = target.id;
      else this.awayControlledId = target.id;
    }
  }

  private executeLobCross(
    passer: PlayerEntity,
    aimX: number,
    aimY: number,
    target: PlayerEntity | null,
    power: number
  ) {
    let dx = aimX;
    let dy = aimY;
    let d = 240 + power * 240;

    if (target) {
      const tx = target.x + target.vx * 0.5;
      const ty = target.y + target.vy * 0.5;
      dx = tx - this.ball.x;
      dy = ty - this.ball.y;
      d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
    }

    const horizSpeed = clamp(220 + d * 0.72 + power * 130, 240, 470);
    const vz = 215 + power * 155;

    this.releaseBall(passer);
    this.ball.vx = dx * horizSpeed;
    this.ball.vy = dy * horizSpeed;
    this.ball.vz = vz;
    this.ball.spin = (aimY > 0 ? -1 : 1) * 1.1;
    this.ball.isCross = true;
    this.ball.lastShotType = 'normal';
    this.ball.lastKickSpeedKmh = Math.round(horizSpeed * 0.17);

    passer.facing = Math.atan2(dy, dx);
    passer.animState = 'kick_lob';
    passer.animLockTimer = 0.26;
    passer.actionCooldown = 0.25;

    if (passer.team === 'home') this.stats.home.passesAttempted++;
    else this.stats.away.passesAttempted++;
    this.passPendingTeam = passer.team;

    soundEngine.playKick(0.55 + power * 0.3, false);
    this.spawnParticles(this.ball.x, this.ball.y, 2, 7, '#d9f99d', 80, 0.3, 2.5);
  }

  private executeShot(
    shooter: PlayerEntity,
    aimX: number,
    aimY: number,
    power: number,
    isFinesse: boolean
  ) {
    const attackDir = this.getAttackDir(shooter.team);
    const goalX = attackDir === 1 ? PITCH_WIDTH : 0;
    const isAirborne = this.ball.z > 13 && !shooter.hasBall;

    // PES directional goal-corner assist!
    // Aiming up targets top post corner, aiming down targets bottom post corner
    const targetCornerY = HALF_H + clamp(aimY, -1, 1) * (GOAL_HALF_W - 10);
    const dxGoal = goalX - this.ball.x;
    const dyGoal = targetCornerY - this.ball.y;
    const distGoal = Math.hypot(dxGoal, dyGoal) || 1;

    // Blend assisted goal vector with player aim (75% goal-assisted so shots feel crisp like PES)
    let dirX = (dxGoal / distGoal) * 0.78 + aimX * 0.22;
    let dirY = (dyGoal / distGoal) * 0.78 + aimY * 0.22;
    // If shooter is explicitly aiming away from goal, respect manual direction
    if (aimX * attackDir < -0.35) {
      dirX = aimX;
      dirY = aimY;
    }
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len;
    dirY /= len;

    const statFactor = 0.85 + (shooter.bio.shooting / 100) * 0.28;
    const baseSpeed = isFinesse ? 390 + power * 235 : 440 + power * 305;
    const speed = baseSpeed * statFactor;

    // Authentic PES elevation curve: sweet spot (0.45..0.82) hits upper 90; >0.88 risks blazing over!
    let vz = 58 + power * 185;
    if (power > 0.86) vz += (power - 0.86) * 520;
    if (isFinesse) vz = 85 + power * 145;
    if (isAirborne) vz = 45 + power * 120;

    // Finesse curl bends around keeper into far post
    let spin = 0;
    if (isFinesse) {
      const sideSign = shooter.y < HALF_H ? -1 : 1;
      spin = sideSign * attackDir * (2.6 + power * 1.5);
    } else {
      spin = (Math.random() - 0.5) * 0.55;
    }

    // Small accuracy variance scaled by shooting rating & overcharge
    const spread = ((100 - shooter.bio.shooting) * 0.0014) + (power > 0.9 ? 0.06 : 0);
    const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * spread;

    this.releaseBall(shooter);
    this.ball.vx = Math.cos(angle) * speed;
    this.ball.vy = Math.sin(angle) * speed;
    this.ball.vz = vz;
    this.ball.spin = spin;
    this.ball.isCross = false;
    this.ball.lastKickSpeedKmh = Math.round(speed * 0.175);
    this.ball.lastShotType = isAirborne
      ? this.ball.z > 22
        ? 'header'
        : 'volley'
      : isFinesse
        ? 'finesse'
        : power > 0.72
          ? 'power'
          : 'normal';

    shooter.facing = angle;
    shooter.animState = isAirborne && this.ball.z > 20 ? 'header' : 'kick_shoot';
    shooter.animLockTimer = 0.3;
    shooter.actionCooldown = 0.28;

    const st = shooter.team === 'home' ? this.stats.home : this.stats.away;
    st.shots++;
    // Check if roughly on target
    const tToGoal = (goalX - this.ball.x) / (this.ball.vx || 0.001);
    if (tToGoal > 0 && tToGoal < 2.2) {
      const predY = this.ball.y + this.ball.vy * tToGoal;
      if (Math.abs(predY - HALF_H) <= GOAL_HALF_W + 6) {
        st.shotsOnTarget++;
      }
    }

    this.commentary = isFinesse
      ? `${shooter.bio.shortName} curls a finesse effort toward the far corner!`
      : this.ball.lastShotType === 'header'
        ? `Thumping header from ${shooter.bio.shortName}!`
        : this.ball.lastShotType === 'volley'
          ? `What a volley by ${shooter.bio.shortName}!`
          : `${shooter.bio.shortName} unleashes a fierce strike!`;

    soundEngine.playKick(0.65 + power * 0.35, isFinesse);
    this.screenShake = Math.max(this.screenShake, power * 4.5);
    this.spawnParticles(
      this.ball.x,
      this.ball.y,
      this.ball.z + 2,
      12,
      isFinesse ? '#38bdf8' : '#fef08a',
      125,
      0.4,
      3
    );
  }

  private kickFreeDirection(
    player: PlayerEntity,
    dx: number,
    dy: number,
    speed: number,
    vz: number,
    anim: PlayerEntity['animState']
  ) {
    this.releaseBall(player);
    this.ball.vx = dx * speed;
    this.ball.vy = dy * speed;
    this.ball.vz = vz;
    this.ball.spin = 0;
    player.facing = Math.atan2(dy, dx);
    player.animState = anim;
    player.animLockTimer = 0.22;
    player.actionCooldown = 0.22;
    soundEngine.playKick(0.45, false);
  }

  private startSlideTackle(player: PlayerEntity, moveX: number, moveY: number) {
    let angle = player.facing;
    if (Math.hypot(moveX, moveY) > 0.15) {
      angle = Math.atan2(moveY, moveX);
    } else {
      angle = Math.atan2(this.ball.y - player.y, this.ball.x - player.x);
    }
    player.facing = angle;
    player.vx = Math.cos(angle) * 265;
    player.vy = Math.sin(angle) * 265;
    player.animState = 'slide_tackle';
    player.animLockTimer = 0.52;
    player.actionCooldown = 0.85;
    soundEngine.playSlideTackle();
    this.spawnParticles(player.x, player.y, 1, 10, '#65a30d', 90, 0.45, 3);
  }

  private attemptStandingTackle(defender: PlayerEntity) {
    defender.animState = 'stand_tackle';
    defender.animLockTimer = 0.22;
    defender.actionCooldown = 0.5;
    const owner = this.getPlayerById(this.ball.ownerId);
    if (owner && owner.team !== defender.team && owner.skillTimer <= 0) {
      const d = dist(defender.x, defender.y, owner.x, owner.y);
      if (d < 30) {
        const winChance =
          0.42 + (defender.bio.defending - owner.bio.dribbling) * 0.008;
        if (Math.random() < clamp(winChance, 0.25, 0.85)) {
          this.winTackle(defender, owner, false);
        }
      }
    }
  }

  private winTackle(defender: PlayerEntity, victim: PlayerEntity, isSlide: boolean) {
    this.releaseBall(victim);
    victim.stunTimer = isSlide ? 0.65 : 0.35;
    victim.animState = 'stumble';
    victim.animLockTimer = isSlide ? 0.55 : 0.28;
    this.assignBallOwner(defender);

    if (defender.team === 'home') this.stats.home.tackles++;
    else this.stats.away.tackles++;

    soundEngine.playKick(0.35, false);
    this.spawnParticles(this.ball.x, this.ball.y, 3, 8, '#bef264', 85, 0.38, 2.5);
    this.commentary = isSlide
      ? `Crunching slide tackle from ${defender.bio.shortName}!`
      : `Clean dispossession by ${defender.bio.shortName}.`;
  }

  private getPlayerMaxSpeed(player: PlayerEntity, sprint: boolean): number {
    const base = sprint ? BASE_SPRINT_SPEED : BASE_JOG_SPEED;
    const paceFactor = 0.84 + (player.bio.speed / 100) * 0.28;
    const fatigueFactor = player.stamina < 20 ? 0.86 : 1.0;
    const diffMult =
      player.team === 'away' && this.config.mode === 'exhibition'
        ? DIFFICULTY_MAP[this.config.difficulty].aiSpeedMult
        : 1.0;
    return base * paceFactor * fatigueFactor * diffMult;
  }

  private updateOutfieldAI(p: PlayerEntity, dt: number, runDecisions: boolean) {
    if (p.animLockTimer > 0 || p.stunTimer > 0) return;

    const form = p.team === 'home' ? this.config.homeFormation : this.config.awayFormation;
    const anchor = FORMATIONS[form].anchors[p.slotIndex];
    const dir = this.getAttackDir(p.team);
    const diff = DIFFICULTY_MAP[this.config.difficulty];

    // If AI has the ball!
    if (p.hasBall) {
      const goalX = dir === 1 ? PITCH_WIDTH : 0;
      const distToGoal = dist(p.x, p.y, goalX, HALF_H);

      if (runDecisions) {
        // Shoot if in range with decent angle!
        if (distToGoal < 265 && Math.abs(p.y - HALF_H) < 185) {
          const aimCornerY = (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.35);
          const power = 0.52 + Math.random() * 0.28;
          const finesse = distToGoal > 165 && Math.random() < 0.38;
          this.executeShot(p, dir, aimCornerY, power, finesse);
          return;
        }

        // Cross from wide wing position
        if (distToGoal < 290 && Math.abs(p.y - HALF_H) > 190 && Math.random() < 0.45) {
          const striker = this.players.find((m) => m.team === p.team && m.slotIndex === 9);
          this.executeLobCross(p, dir * 0.3, p.y < HALF_H ? 1 : -1, striker ?? null, 0.55);
          return;
        }

        // Check if pressured by opponent -> pass or through-ball
        const nearestOpp = this.findNearestOpponent(p);
        const oppDist = nearestOpp ? dist(p.x, p.y, nearestOpp.x, nearestOpp.y) : 999;
        if (oppDist < 68 || Math.random() < 0.24) {
          const bestMate = this.findBestAiPassTarget(p);
          if (bestMate) {
            const isThrough =
              (bestMate.x - p.x) * dir > 75 && Math.random() < 0.38;
            this.executePass(p, bestMate, 0.4 + Math.random() * 0.28, isThrough);
            return;
          }
        }
      }

      // Otherwise dribble dynamically toward goal while weaving slightly around closest defender
      let targetX = goalX - dir * 90;
      let targetY = HALF_H + (p.y - HALF_H) * 0.6;
      const nearestOpp = this.findNearestOpponent(p);
      if (nearestOpp && dist(p.x, p.y, nearestOpp.x, nearestOpp.y) < 85) {
        // Side-step away from defender
        targetY += p.y >= nearestOpp.y ? 65 : -65;
      }
      this.steerPlayerToward(p, targetX, clamp(targetY, 55, PITCH_HEIGHT - 55), true, dt);
      p.animState = 'dribble';
      return;
    }

    // Off-the-ball AI movement
    if (this.config.mode === 'training' && p.team === 'away') {
      // Passive defenders in training
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.animState = 'idle';
      return;
    }

    const ballOwner = this.getPlayerById(this.ball.ownerId);
    const teamHasBall = ballOwner?.team === p.team;
    const ballNormX = dir === 1 ? this.ball.x / PITCH_WIDTH : 1 - this.ball.x / PITCH_WIDTH;
    const ballNormY = dir === 1 ? this.ball.y / PITCH_HEIGHT : 1 - this.ball.y / PITCH_HEIGHT;

    // Dynamic tactical shift based on ball position & possession
    let tacticalX = anchor.x;
    let tacticalY = anchor.y;
    if (teamHasBall) {
      // Push up & make PES attacking runs into space!
      tacticalX = clamp(anchor.x + (ballNormX - 0.42) * 0.48 + 0.1, 0.16, 0.93);
      tacticalY = clamp(anchor.y + (ballNormY - 0.5) * 0.25, 0.08, 0.92);
    } else {
      // Compact defensive shape
      tacticalX = clamp(anchor.x + (ballNormX - 0.5) * 0.42 - 0.07, 0.12, 0.78);
      tacticalY = clamp(anchor.y + (ballNormY - 0.5) * 0.34, 0.1, 0.9);
    }

    p.homeX = dir === 1 ? tacticalX * PITCH_WIDTH : (1 - tacticalX) * PITCH_WIDTH;
    p.homeY = dir === 1 ? tacticalY * PITCH_HEIGHT : (1 - tacticalY) * PITCH_HEIGHT;

    // Is this AI the designated presser/chaser?
    const isClosestToBall = this.isClosestOutfieldToBall(p);
    if (!teamHasBall && isClosestToBall) {
      const dBall = dist(p.x, p.y, this.ball.x, this.ball.y);
      this.steerPlayerToward(p, this.ball.x, this.ball.y, dBall > 45, dt);

      // AI tackles when close to human ball carrier
      if (
        runDecisions &&
        ballOwner &&
        ballOwner.team !== p.team &&
        dBall < 32 &&
        p.actionCooldown <= 0
      ) {
        if (Math.random() < diff.pressAggression * 0.35) {
          this.attemptStandingTackle(p);
        } else if (dBall < 48 && Math.random() < diff.pressAggression * 0.08) {
          this.startSlideTackle(p, this.ball.x - p.x, this.ball.y - p.y);
        }
      }
      return;
    }

    // Move smoothly toward dynamic tactical position
    const dHome = dist(p.x, p.y, p.homeX, p.homeY);
    if (dHome > 14) {
      this.steerPlayerToward(p, p.homeX, p.homeY, dHome > 110, dt);
    } else {
      p.vx *= Math.pow(0.01, dt);
      p.vy *= Math.pow(0.01, dt);
      p.facing = Math.atan2(this.ball.y - p.y, this.ball.x - p.x);
      p.animState = 'idle';
      p.stamina = Math.min(100, p.stamina + dt * 6);
    }
  }

  private findNearestOpponent(p: PlayerEntity): PlayerEntity | null {
    let best: PlayerEntity | null = null;
    let bestD = Infinity;
    for (const o of this.players) {
      if (o.team === p.team || o.slotIndex === 0) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private findBestAiPassTarget(passer: PlayerEntity): PlayerEntity | null {
    const dir = this.getAttackDir(passer.team);
    let best: PlayerEntity | null = null;
    let bestScore = -Infinity;
    for (const mate of this.players) {
      if (mate.team !== passer.team || mate.id === passer.id || mate.slotIndex === 0) continue;
      const d = dist(passer.x, passer.y, mate.x, mate.y);
      if (d < 55 || d > 360) continue;
      const forwardGain = (mate.x - passer.x) * dir;
      const opp = this.findNearestOpponent(mate);
      const space = opp ? Math.min(100, dist(mate.x, mate.y, opp.x, opp.y)) : 100;
      const score = forwardGain * 0.65 + space * 1.15 - d * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = mate;
      }
    }
    return best;
  }

  private isClosestOutfieldToBall(p: PlayerEntity): boolean {
    const myD = dist(p.x, p.y, this.ball.x, this.ball.y);
    for (const other of this.players) {
      if (other.team !== p.team || other.slotIndex === 0 || other.id === p.id) continue;
      if (dist(other.x, other.y, this.ball.x, this.ball.y) < myD - 4) {
        return false;
      }
    }
    return true;
  }

  private steerPlayerToward(
    p: PlayerEntity,
    tx: number,
    ty: number,
    sprint: boolean,
    dt: number
  ) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const useSprint = sprint && p.stamina > 18;
    let spd = this.getPlayerMaxSpeed(p, useSprint);
    if (p.hasBall) spd *= DRIBBLE_SPEED_FACTOR;
    if (d < 28) spd *= d / 28;

    const targetVx = (dx / d) * spd;
    const targetVy = (dy / d) * spd;
    p.vx += (targetVx - p.vx) * Math.min(1, dt * 9.5);
    p.vy += (targetVy - p.vy) * Math.min(1, dt * 9.5);
    p.facing = Math.atan2(dy, dx);

    if (useSprint) p.stamina = Math.max(0, p.stamina - dt * 6.5);
    else p.stamina = Math.min(100, p.stamina + dt * 3.5);

    p.animState = p.hasBall ? 'dribble' : useSprint ? 'sprint' : 'jog';
  }

  private updateGoalkeeper(gk: PlayerEntity, dt: number) {
    const dir = this.getAttackDir(gk.team);
    const goalX = dir === 1 ? 22 : PITCH_WIDTH - 22;

    // If GK holds the ball -> distribute quickly to open teammate!
    if (gk.hasBall) {
      gk.animLockTimer -= dt;
      if (gk.animLockTimer <= 0) {
        const mate =
          this.players.find((m) => m.team === gk.team && m.slotIndex === 6) ??
          this.players.find((m) => m.team === gk.team && m.slotIndex === 1);
        if (mate) {
          this.executePass(gk, mate, 0.55, false);
        }
      }
      return;
    }

    // Active dive physics
    if (gk.animState === 'gk_dive_left' || gk.animState === 'gk_dive_right') {
      if (gk.animLockTimer > 0) {
        gk.vy *= Math.pow(0.35, dt);
        gk.vx *= Math.pow(0.2, dt);
        this.checkGoalkeeperSave(gk);
        return;
      } else {
        gk.animState = 'gk_ready';
      }
    }

    // Check for incoming shot toward GK's goal!
    const ballMovingToGoal = dir === 1 ? this.ball.vx < -140 : this.ball.vx > 140;
    const distXToGoal = Math.abs(this.ball.x - goalX);
    if (ballMovingToGoal && distXToGoal < 360 && !this.ball.ownerId) {
      const t = (goalX - this.ball.x) / this.ball.vx;
      if (t > 0 && t < 0.72) {
        const predY = this.ball.y + this.ball.vy * t;
        const predZ = Math.max(0, this.ball.z + this.ball.vz * t - 0.5 * GRAVITY * t * t);
        if (Math.abs(predY - HALF_H) <= GOAL_HALF_W + 18 && predZ <= GOAL_HEIGHT + 16) {
          const dy = predY - gk.y;
          const reflex =
            (0.75 + (gk.bio.gk / 100) * 0.35) *
            DIFFICULTY_MAP[this.config.difficulty].gkReflex;
          if (Math.abs(dy) > 15 && gk.actionCooldown <= 0) {
            // Trigger iconic PES full-stretch goalkeeper dive!
            gk.diveDirY = dy > 0 ? 1 : -1;
            gk.divePower = clamp(Math.abs(dy) / 55, 0.55, 1.0);
            gk.vy = gk.diveDirY * (195 + gk.divePower * 125) * reflex;
            gk.vx = dir * 24;
            gk.animState = gk.diveDirY < 0 ? 'gk_dive_left' : 'gk_dive_right';
            gk.animLockTimer = 0.62;
            gk.actionCooldown = 0.85;
            return;
          }
        }
      }
    }

    // GK Rush command (human holding Through Ball / Triangle while defending)
    const rush = gk.team === 'home' ? this.homeGkRush : this.awayGkRush;
    if (rush && Math.abs(this.ball.x - goalX) < 230) {
      this.steerPlayerToward(gk, this.ball.x, this.ball.y, true, dt);
      this.checkGoalkeeperSave(gk);
      return;
    }

    // Normal positioning along goal arc
    const targetY = clamp(
      HALF_H + (this.ball.y - HALF_H) * 0.42,
      HALF_H - GOAL_HALF_W + 14,
      HALF_H + GOAL_HALF_W - 14
    );
    const stepOut = clamp(1 - Math.abs(this.ball.x - goalX) / 420, 0, 1) * 30;
    const targetX = goalX + dir * stepOut;

    const dx = targetX - gk.x;
    const dy = targetY - gk.y;
    const d = Math.hypot(dx, dy);
    if (d > 3) {
      const spd = Math.min(GK_MOVE_SPEED, d * 5.5);
      gk.vx = (dx / d) * spd;
      gk.vy = (dy / d) * spd;
    } else {
      gk.vx *= 0.8;
      gk.vy *= 0.8;
    }
    gk.facing = Math.atan2(this.ball.y - gk.y, this.ball.x - gk.x);
    gk.animState = 'gk_ready';

    this.checkGoalkeeperSave(gk);
  }

  private checkGoalkeeperSave(gk: PlayerEntity) {
    if (this.ball.ownerId || this.ball.inGoal) return;
    const isDiving = gk.animState === 'gk_dive_left' || gk.animState === 'gk_dive_right';
    const reachXY = isDiving ? 28 : 21;
    const reachZ = isDiving ? 34 : 28;
    const d = dist(gk.x, gk.y, this.ball.x, this.ball.y);
    if (d < reachXY && this.ball.z < reachZ) {
      const ballSpd = Math.hypot(this.ball.vx, this.ball.vy);
      if (gk.team === 'home') this.stats.home.saves++;
      else this.stats.away.saves++;

      soundEngine.playSaveImpact();
      this.spawnParticles(this.ball.x, this.ball.y, this.ball.z + 5, 10, '#facc15', 110, 0.4, 3);

      const dir = this.getAttackDir(gk.team);
      if (ballSpd < 340 && !isDiving) {
        // Clean catch!
        this.assignBallOwner(gk);
        gk.animLockTimer = 0.75;
        this.commentary = `Safe hands from ${gk.bio.shortName}!`;
      } else {
        // Dramatic diving fingertip parry!
        this.ball.vx = dir * (165 + Math.random() * 110);
        this.ball.vy = (gk.diveDirY || (Math.random() < 0.5 ? -1 : 1)) * (150 + Math.random() * 130);
        this.ball.vz = 95 + Math.random() * 65;
        this.ball.spin = 0;
        this.ball.lastTouchTeam = gk.team;
        this.ball.lastTouchPlayerId = gk.id;
        this.screenShake = 3.5;
        this.commentary = `WHAT A SAVE by ${gk.bio.shortName}!! Fingertip stop!`;
      }
    }
  }

  private integratePlayer(p: PlayerEntity, dt: number) {
    if (p.animLockTimer > 0) p.animLockTimer = Math.max(0, p.animLockTimer - dt);
    if (p.actionCooldown > 0) p.actionCooldown = Math.max(0, p.actionCooldown - dt);
    if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
    if (p.skillTimer > 0) p.skillTimer = Math.max(0, p.skillTimer - dt);

    // Slide tackle deceleration + grass skid marks
    if (p.animState === 'slide_tackle') {
      const prevX = p.x;
      const prevY = p.y;
      p.vx *= Math.pow(0.14, dt);
      p.vy *= Math.pow(0.14, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (Math.hypot(p.vx, p.vy) > 45) {
        this.skidMarks.push({ x1: prevX, y1: prevY, x2: p.x, y2: p.y, alpha: 0.45 });
        this.checkSlideTackleHit(p);
      }
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Keep players within stadium surround
    p.x = clamp(p.x, -18, PITCH_WIDTH + 18);
    p.y = clamp(p.y, -18, PITCH_HEIGHT + 18);

    const speed = Math.hypot(p.vx, p.vy);
    p.animTime += dt * (1.8 + speed * 0.068);
    if (p.hasBall && speed > 15) {
      p.dribbleTouchPhase += dt * (speed * 0.048);
    }
  }

  private checkSlideTackleHit(tackler: PlayerEntity) {
    const dBall = dist(tackler.x, tackler.y, this.ball.x, this.ball.y);
    const owner = this.getPlayerById(this.ball.ownerId);

    if (dBall < 23 && this.ball.z < 16) {
      if (owner && owner.team !== tackler.team && owner.skillTimer <= 0) {
        this.winTackle(tackler, owner, true);
        // Kick loose forward slightly
        this.releaseBall(tackler);
        this.ball.vx = Math.cos(tackler.facing) * 210;
        this.ball.vy = Math.sin(tackler.facing) * 210;
        this.ball.vz = 28;
      } else if (!owner) {
        this.ball.vx = Math.cos(tackler.facing) * 220;
        this.ball.vy = Math.sin(tackler.facing) * 220;
        this.ball.vz = 30;
        this.ball.lastTouchTeam = tackler.team;
        this.ball.lastTouchPlayerId = tackler.id;
      }
      return;
    }

    // Check if slide clipped an opponent without winning the ball -> Foul!
    if (owner && owner.team !== tackler.team && owner.skillTimer <= 0) {
      const dPlayer = dist(tackler.x, tackler.y, owner.x, owner.y);
      if (dPlayer < 19 && dBall > 24 && Math.random() < 0.25) {
        // Foul called!
        const foulTeam = tackler.team;
        if (foulTeam === 'home') this.stats.home.fouls++;
        else this.stats.away.fouls++;
        owner.stunTimer = 0.7;
        owner.animState = 'stumble';
        soundEngine.playWhistle('short');
        this.startSetPiece('free_kick', owner.team, owner.x, owner.y);
        this.commentary = `Foul by ${tackler.bio.shortName}! Free kick awarded.`;
      }
    }
  }

  private resolvePlayerCollisions() {
    for (let i = 0; i < this.players.length; i++) {
      const a = this.players[i];
      for (let j = i + 1; j < this.players.length; j++) {
        const b = this.players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minDist = PLAYER_RADIUS * 1.65;
        if (d > 0.01 && d < minDist) {
          const push = (minDist - d) * 0.45;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  private assignBallOwner(player: PlayerEntity) {
    if (this.ball.ownerId && this.ball.ownerId !== player.id) {
      const prev = this.getPlayerById(this.ball.ownerId);
      if (prev) prev.hasBall = false;
    }

    // Track completed passes
    if (this.passPendingTeam === player.team && this.ball.lastTouchPlayerId !== player.id) {
      if (player.team === 'home') this.stats.home.passesCompleted++;
      else this.stats.away.passesCompleted++;
      this.passPendingTeam = null;
    } else if (this.passPendingTeam && this.passPendingTeam !== player.team) {
      this.passPendingTeam = null;
    }

    if (this.ball.lastTouchPlayerId !== player.id) {
      this.ball.prevTouchPlayerId = this.ball.lastTouchPlayerId;
      this.ball.prevTouchTeam = this.ball.lastTouchTeam;
    }

    this.ball.ownerId = player.id;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
    this.ball.spin = 0;
    this.ball.z = 0;
    this.ball.vz = 0;
    player.hasBall = true;
  }

  private releaseBall(player: PlayerEntity) {
    player.hasBall = false;
    if (this.ball.ownerId === player.id) {
      this.ball.ownerId = null;
    }
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
  }

  private updateBallPhysics(dt: number, inCelebration: boolean) {
    const b = this.ball;

    // Update speed trail
    for (let i = b.trail.length - 1; i >= 0; i--) {
      b.trail[i].alpha -= dt * 3.8;
      if (b.trail[i].alpha <= 0) b.trail.splice(i, 1);
    }

    if (b.ownerId && !inCelebration) {
      const owner = this.getPlayerById(b.ownerId);
      if (owner) {
        const touchBob = Math.sin(owner.dribbleTouchPhase) * 3.8;
        const offset = 14.5 + Math.max(0, touchBob);
        b.x = owner.x + Math.cos(owner.facing) * offset;
        b.y = owner.y + Math.sin(owner.facing) * offset;
        b.z = 0;
        b.vx = owner.vx;
        b.vy = owner.vy;
        b.vz = 0;
        const spd = Math.hypot(owner.vx, owner.vy);
        b.rotX += (owner.vx * dt) / BALL_RADIUS;
        b.rotY += (owner.vy * dt) / BALL_RADIUS;
        if (spd > 155 && Math.random() < dt * 20) {
          b.trail.push({ x: b.x, y: b.y, z: 2, alpha: 0.3, color: '#ffffff' });
        }
        return;
      } else {
        b.ownerId = null;
      }
    }

    // Free-flight 3D physics + Magnus curve (spin)!
    const prevX = b.x;
    const prevY = b.y;
    const speed2D = Math.hypot(b.vx, b.vy);

    if (Math.abs(b.spin) > 0.05 && speed2D > 80) {
      // Perpendicular Magnus acceleration
      const nx = -b.vy / speed2D;
      const ny = b.vx / speed2D;
      b.vx += nx * b.spin * CURL_STRENGTH * dt;
      b.vy += ny * b.spin * CURL_STRENGTH * dt;
      b.spin *= Math.pow(0.45, dt);
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.vz -= GRAVITY * dt;

    // Ground bounce & turf friction
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -55) {
        b.vz = -b.vz * BALL_BOUNCE;
        b.vx *= 0.91;
        b.vy *= 0.91;
        soundEngine.playKick(0.14, false);
      } else {
        b.vz = 0;
        const fric = Math.pow(TURF_FRICTION, dt * 60);
        b.vx *= fric;
        b.vy *= fric;
      }
    } else {
      const drag = Math.pow(AIR_DRAG, dt * 60);
      b.vx *= drag;
      b.vy *= drag;
    }

    b.rotX += (b.vx * dt) / BALL_RADIUS;
    b.rotY += (b.vy * dt) / BALL_RADIUS;

    // Add dramatic shot trail on fast strikes or curled finesse shots
    if (speed2D > 380) {
      b.trail.push({
        x: b.x,
        y: b.y,
        z: b.z,
        alpha: 0.72,
        color:
          b.lastShotType === 'finesse'
            ? '#38bdf8'
            : b.lastShotType === 'power'
              ? '#fb923c'
              : '#fde047',
      });
    }

    // === 3D GOALPOSTS, CROSSBAR & GOAL DETECTION ===
    if (b.inGoal) {
      // Constrain ball inside the net pocket with soft net damping!
      const isLeft = b.inGoal === 'home';
      const backX = isLeft ? -GOAL_DEPTH + 4 : PITCH_WIDTH + GOAL_DEPTH - 4;
      if ((isLeft && b.x < backX) || (!isLeft && b.x > backX)) {
        b.x = backX;
        b.vx *= -0.18;
        b.vy *= 0.55;
      }
      const topY = HALF_H - GOAL_HALF_W + 4;
      const botY = HALF_H + GOAL_HALF_W - 4;
      if (b.y < topY) {
        b.y = topY;
        b.vy = Math.abs(b.vy) * 0.25;
      }
      if (b.y > botY) {
        b.y = botY;
        b.vy = -Math.abs(b.vy) * 0.25;
      }
      if (b.z > GOAL_HEIGHT - 3) {
        b.z = GOAL_HEIGHT - 3;
        b.vz *= -0.25;
      }
      return;
    }

    // Check goalpost & crossbar collisions
    this.checkGoalWoodwork(prevX, prevY);

    if (!inCelebration) {
      // Check GOAL SCORED!
      const inGoalMouthY = Math.abs(b.y - HALF_H) < GOAL_HALF_W - 2;
      const underCrossbar = b.z < GOAL_HEIGHT - 1;

      if (inGoalMouthY && underCrossbar) {
        if (b.x < -BALL_RADIUS) {
          // Ball entered LEFT goal!
          b.inGoal = 'home';
          this.leftNet = { impactY: b.y, impactZ: b.z, strength: 1.0, phase: 0 };
          const scoringTeam: TeamSide = this.homeAttacksRight ? 'away' : 'home';
          this.onGoalScored(scoringTeam);
          return;
        }
        if (b.x > PITCH_WIDTH + BALL_RADIUS) {
          // Ball entered RIGHT goal!
          b.inGoal = 'away';
          this.rightNet = { impactY: b.y, impactZ: b.z, strength: 1.0, phase: 0 };
          const scoringTeam: TeamSide = this.homeAttacksRight ? 'home' : 'away';
          this.onGoalScored(scoringTeam);
          return;
        }
      }

      // Check ball pickup by nearby players
      for (const p of this.players) {
        if (p.actionCooldown > 0 || p.stunTimer > 0 || p.animState === 'slide_tackle') continue;
        if (p.slotIndex === 0) continue; // GK uses dedicated save logic
        const d = dist(p.x, p.y, b.x, b.y);
        if (d < 19 && b.z < 18) {
          // Soft cushion control check
          const canTrap = speed2D < 490 || Math.random() < 0.72;
          if (canTrap) {
            this.assignBallOwner(p);
            break;
          } else {
            // Deflection off player
            b.vx *= -0.35;
            b.vy *= 0.45;
            b.lastTouchTeam = p.team;
            b.lastTouchPlayerId = p.id;
          }
        }
      }

      // Check Out-of-Bounds (Throw-In, Corner Kick, Goal Kick)
      if (!b.inGoal) {
        this.checkOutOfBounds();
      }
    }
  }

  private checkGoalWoodwork(prevX: number, prevY: number) {
    const b = this.ball;
    const posts = [
      { x: 0, y: HALF_H - GOAL_HALF_W },
      { x: 0, y: HALF_H + GOAL_HALF_W },
      { x: PITCH_WIDTH, y: HALF_H - GOAL_HALF_W },
      { x: PITCH_WIDTH, y: HALF_H + GOAL_HALF_W },
    ];

    for (const post of posts) {
      const d = dist(b.x, b.y, post.x, post.y);
      if (d < BALL_RADIUS + 5.5 && b.z <= GOAL_HEIGHT + 3) {
        const nx = (b.x - post.x) / (d || 1);
        const ny = (b.y - post.y) / (d || 1);
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) {
          b.vx = (b.vx - 2 * dot * nx) * 0.72;
          b.vy = (b.vy - 2 * dot * ny) * 0.72;
          b.x = post.x + nx * (BALL_RADIUS + 6);
          b.y = post.y + ny * (BALL_RADIUS + 6);
          soundEngine.playPostClang();
          this.screenShake = 6;
          this.spawnParticles(post.x, post.y, b.z, 12, '#ffffff', 120, 0.4, 3);
          this.commentary = 'OFF THE POST!! So close!';
        }
      }
    }

    // Crossbar collision
    const crossedLeft = prevX >= 0 && b.x < 0;
    const crossedRight = prevX <= PITCH_WIDTH && b.x > PITCH_WIDTH;
    if ((crossedLeft || crossedRight) && Math.abs(b.y - HALF_H) <= GOAL_HALF_W) {
      if (Math.abs(b.z - GOAL_HEIGHT) < 5.5) {
        b.vx *= -0.65;
        b.vz = Math.abs(b.vz) * 0.65 + 45;
        b.x = crossedLeft ? 4 : PITCH_WIDTH - 4;
        soundEngine.playPostClang();
        this.screenShake = 6.5;
        this.spawnParticles(b.x, b.y, GOAL_HEIGHT, 14, '#fde047', 130, 0.45, 3);
        this.commentary = 'RATTLES THE CROSSBAR!!';
      }
    }
  }

  private checkOutOfBounds() {
    const b = this.ball;
    if (this.config.mode === 'training') {
      if (b.x < -25 || b.x > PITCH_WIDTH + 25 || b.y < -25 || b.y > PITCH_HEIGHT + 25) {
        this.setupTrainingPositions();
      }
      return;
    }

    // Sidelines -> Throw-in
    if (b.y < -8 || b.y > PITCH_HEIGHT + 8) {
      const awardTeam: TeamSide = b.lastTouchTeam === 'home' ? 'away' : 'home';
      const clampedY = b.y < 0 ? 6 : PITCH_HEIGHT - 6;
      const clampedX = clamp(b.x, 30, PITCH_WIDTH - 30);
      soundEngine.playWhistle('short');
      this.startSetPiece('throw_in', awardTeam, clampedX, clampedY);
      return;
    }

    // Goal lines (outside goal mouth) -> Corner or Goal Kick
    if (b.x < -12 || b.x > PITCH_WIDTH + 12) {
      const onLeftLine = b.x < 0;
      const defendingTeam: TeamSide = onLeftLine
        ? this.homeAttacksRight
          ? 'home'
          : 'away'
        : this.homeAttacksRight
          ? 'away'
          : 'home';
      const attackingTeam: TeamSide = defendingTeam === 'home' ? 'away' : 'home';

      soundEngine.playWhistle('short');
      if (b.lastTouchTeam === defendingTeam) {
        // Corner kick!
        if (attackingTeam === 'home') this.stats.home.corners++;
        else this.stats.away.corners++;
        const cx = onLeftLine ? 8 : PITCH_WIDTH - 8;
        const cy = b.y < HALF_H ? 8 : PITCH_HEIGHT - 8;
        this.startSetPiece('corner', attackingTeam, cx, cy);
        this.commentary = `Corner kick to ${attackingTeam === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName}!`;
      } else {
        // Goal kick!
        const gx = onLeftLine ? 52 : PITCH_WIDTH - 52;
        const gy = HALF_H + (b.y < HALF_H ? -40 : 40);
        this.startSetPiece('goal_kick', defendingTeam, gx, gy);
        this.commentary = `Goal kick for ${defendingTeam === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName}.`;
      }
    }
  }

  private startSetPiece(type: SetPieceType, team: TeamSide, x: number, y: number) {
    this.phase = 'set_piece';
    this.homeCharge = emptyCharge();
    this.awayCharge = emptyCharge();
    this.ball.ownerId = null;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.z = 0;
    this.ball.x = clamp(x, 8, PITCH_WIDTH - 8);
    this.ball.y = clamp(y, 8, PITCH_HEIGHT - 8);

    const taker =
      type === 'goal_kick'
        ? this.players.find((p) => p.team === team && p.slotIndex === 0)!
        : this.players.find((p) => p.team === team && p.slotIndex === 8) ??
          this.players.find((p) => p.team === team && p.slotIndex === 7)!;

    taker.x = this.ball.x;
    taker.y = this.ball.y;
    taker.vx = 0;
    taker.vy = 0;
    this.assignBallOwner(taker);

    if (team === 'home') this.homeControlledId = taker.id;
    else this.awayControlledId = taker.id;

    // Position teammates nicely for corners/free kicks
    if (type === 'corner') {
      const boxX = x < HALF_W ? 95 : PITCH_WIDTH - 95;
      let idx = 0;
      for (const p of this.players) {
        if (p.id === taker.id || p.slotIndex === 0) continue;
        if (p.slotIndex >= 6) {
          p.x = boxX + (p.team === team ? (x < HALF_W ? 18 : -18) : 0) + (Math.random() - 0.5) * 35;
          p.y = HALF_H - 70 + (idx % 5) * 34;
          idx++;
        }
      }
    }

    this.setPiece = {
      type,
      team,
      x: this.ball.x,
      y: this.ball.y,
      timer: 1.05,
      takerId: taker.id,
    };

    const labels: Record<SetPieceType, string> = {
      throw_in: 'THROW IN',
      corner: 'CORNER KICK',
      goal_kick: 'GOAL KICK',
      free_kick: 'FREE KICK',
    };
    this.bannerText = labels[type];
    this.bannerSubtext = team === 'home' ? this.homeTeam.name : this.awayTeam.name;
  }

  private updateSetPiece(dt: number, p1Input: InputState, p2Input: InputState | null) {
    if (!this.setPiece) return;
    this.setPiece.timer -= dt;
    const taker = this.getPlayerById(this.setPiece.takerId);
    if (!taker) {
      this.phase = 'playing';
      this.setPiece = null;
      return;
    }

    const isHuman =
      this.setPiece.team === 'home' ||
      this.config.mode === 'local_pvp' ||
      (this.config.mode === 'online' && p2Input !== null);
    const input = this.setPiece.team === 'home' ? p1Input : p2Input;

    const executeAutoKick = () => {
      const sp = this.setPiece!;
      if (sp.type === 'corner') {
        const boxX = sp.x < HALF_W ? 95 : PITCH_WIDTH - 95;
        const dx = boxX - sp.x;
        const dy = HALF_H - sp.y;
        const d = Math.hypot(dx, dy) || 1;
        this.executeLobCross(taker, dx / d, dy / d, null, 0.62);
      } else {
        const mate =
          this.findBestAiPassTarget(taker) ??
          this.players.find((m) => m.team === taker.team && m.id !== taker.id && m.slotIndex !== 0);
        if (mate) this.executePass(taker, mate, 0.5, false);
        else {
          const dir = this.getAttackDir(taker.team);
          this.kickFreeDirection(taker, dir, 0, 380, 60, 'kick_pass');
        }
      }
      this.phase = 'playing';
      this.setPiece = null;
      this.bannerText = null;
      this.bannerSubtext = null;
    };

    if (isHuman && input) {
      if (Math.hypot(input.moveX, input.moveY) > 0.15) {
        taker.facing = Math.atan2(input.moveY, input.moveX);
      }
      if (input.passJustPressed || input.shootJustPressed || input.lobJustPressed || input.throughJustPressed) {
        const aimX = Math.cos(taker.facing);
        const aimY = Math.sin(taker.facing);
        if (input.lobJustPressed || this.setPiece.type === 'corner') {
          this.executeLobCross(taker, aimX, aimY, this.findPassTarget(taker, aimX, aimY, false), 0.65);
        } else if (input.shootJustPressed && this.setPiece.type === 'free_kick') {
          this.executeShot(taker, aimX, aimY, 0.7, input.finesse);
        } else {
          const mate = this.findPassTarget(taker, aimX, aimY, input.throughJustPressed);
          if (mate) this.executePass(taker, mate, 0.5, input.throughJustPressed);
          else this.kickFreeDirection(taker, aimX, aimY, 360, 35, 'kick_pass');
        }
        this.phase = 'playing';
        this.setPiece = null;
        this.bannerText = null;
        this.bannerSubtext = null;
      } else if (this.setPiece.timer < -3.5) {
        executeAutoKick();
      }
    } else if (this.setPiece.timer <= 0) {
      executeAutoKick();
    }
  }

  private onGoalScored(scoringTeam: TeamSide) {
    if (this.phase === 'goal_celebration' || this.phase === 'goal_replay') return;

    if (scoringTeam === 'home') this.stats.home.goals++;
    else this.stats.away.goals++;

    const lastPlayer = this.getPlayerById(this.ball.lastTouchPlayerId);
    const isOwnGoal = lastPlayer !== undefined && lastPlayer.team !== scoringTeam;
    const scorer =
      lastPlayer && lastPlayer.team === scoringTeam
        ? lastPlayer
        : this.players.find((p) => p.team === scoringTeam && p.slotIndex === 9)!;

    const prevPlayer = this.getPlayerById(this.ball.prevTouchPlayerId);
    const assistName =
      !isOwnGoal &&
      prevPlayer &&
      prevPlayer.team === scoringTeam &&
      prevPlayer.id !== scorer.id
        ? prevPlayer.bio.shortName
        : null;

    const minute = Math.max(1, Math.min(90, Math.ceil(this.matchClockSeconds / 60)));

    this.lastGoal = {
      scoringTeam,
      scorerName: isOwnGoal ? `${lastPlayer?.bio.shortName ?? 'DEFENDER'} (OG)` : scorer.bio.shortName,
      scorerNumber: scorer.bio.number,
      assistName,
      minute,
      half: this.half,
      shotSpeedKmh: Math.max(48, this.ball.lastKickSpeedKmh),
      shotType: this.ball.lastShotType,
      isOwnGoal,
    };
    this.stats.goals.push(this.lastGoal);

    // Record final net-ripple frames before transitioning
    this.recordReplayFrame();

    this.phase = 'goal_celebration';
    this.phaseTimer = GOAL_CELEBRATION_DURATION;
    this.celebrationScorerId = scorer.id;
    this.homeCharge = emptyCharge();
    this.awayCharge = emptyCharge();

    const teamData = scoringTeam === 'home' ? this.homeTeam : this.awayTeam;
    this.bannerText = 'GOAL!!';
    this.bannerSubtext = `${teamData.name.toUpperCase()} • ${this.lastGoal.scorerName} ${minute}'`;
    this.commentary = `GOAL!! ${this.lastGoal.scorerName} fires it past the keeper at ${this.lastGoal.shotSpeedKmh} km/h! What a moment!`;

    // Trigger iconic PES goal celebration!
    const celebTypes: PlayerEntity['animState'][] = [
      'celebrate_slide',
      'celebrate_airplane',
      'celebrate_jump',
    ];
    const chosen = celebTypes[Math.floor(Math.random() * celebTypes.length)];
    scorer.animState = chosen;
    scorer.animLockTimer = GOAL_CELEBRATION_DURATION;
    const cornerY = scorer.y < HALF_H ? 65 : PITCH_HEIGHT - 65;
    const cornerX = scoringTeam === 'home' === this.homeAttacksRight ? PITCH_WIDTH - 120 : 120;
    const a = Math.atan2(cornerY - scorer.y, cornerX - scorer.x);
    scorer.facing = a;
    scorer.vx = Math.cos(a) * 145;
    scorer.vy = Math.sin(a) * 145;

    // Fireworks & stadium confetti particles!
    this.spawnParticles(this.ball.x, this.ball.y, 18, 28, teamData.kit.primary, 190, 1.4, 4.5);
    this.spawnParticles(this.ball.x, this.ball.y, 22, 22, teamData.kit.accent, 210, 1.5, 4);

    this.screenShake = 9;
    soundEngine.playNetSwish();
    soundEngine.playGoalRoar();
  }

  private updateCelebration(dt: number) {
    const scorer = this.getPlayerById(this.celebrationScorerId);
    if (!scorer) return;

    if (scorer.animState === 'celebrate_slide') {
      // Knee slide deceleration with grass spray
      scorer.vx *= Math.pow(0.45, dt);
      scorer.vy *= Math.pow(0.45, dt);
      const px = scorer.x;
      const py = scorer.y;
      scorer.x = clamp(scorer.x + scorer.vx * dt, 30, PITCH_WIDTH - 30);
      scorer.y = clamp(scorer.y + scorer.vy * dt, 30, PITCH_HEIGHT - 30);
      if (Math.hypot(scorer.vx, scorer.vy) > 30) {
        this.skidMarks.push({ x1: px, y1: py, x2: scorer.x, y2: scorer.y, alpha: 0.55 });
        if (Math.random() < dt * 25) {
          this.spawnParticles(scorer.x, scorer.y, 2, 2, '#84cc16', 55, 0.45, 2.5);
        }
      }
    } else {
      scorer.x = clamp(scorer.x + scorer.vx * dt, 40, PITCH_WIDTH - 40);
      scorer.y = clamp(scorer.y + scorer.vy * dt, 40, PITCH_HEIGHT - 40);
      if (scorer.animState === 'celebrate_jump') {
        scorer.z = Math.abs(Math.sin(scorer.animTime * 4.5)) * 18;
      }
    }
    scorer.animTime += dt * 7;

    // Teammates sprint over to swarm the scorer!
    for (const p of this.players) {
      if (p.id === scorer.id || p.slotIndex === 0) continue;
      if (p.team === scorer.team) {
        const d = dist(p.x, p.y, scorer.x, scorer.y);
        if (d > 38) {
          this.steerPlayerToward(p, scorer.x, scorer.y, true, dt);
        } else {
          p.vx *= 0.85;
          p.vy *= 0.85;
          p.animState = 'celebrate_jump';
          p.z = Math.abs(Math.sin(p.animTime * 4.2)) * 12;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.animTime += dt * 7;
      } else {
        // Opponents look dejected
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.animState = 'idle';
      }
    }
  }

  private recordReplayFrame() {
    const frame: ReplayFrame = {
      ballX: this.ball.x,
      ballY: this.ball.y,
      ballZ: this.ball.z,
      ballRotX: this.ball.rotX,
      ballRotY: this.ball.rotY,
      ballTrail: this.ball.trail.map((t) => ({ ...t })),
      leftNet: { ...this.leftNet },
      rightNet: { ...this.rightNet },
      players: this.players.map((p) => ({
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
      })),
    };
    this.replayBuffer.push(frame);
    if (this.replayBuffer.length > REPLAY_BUFFER_SIZE) {
      this.replayBuffer.shift();
    }
  }

  // === PENALTY SHOOTOUT ENGINE ===
  private updatePenaltyShootout(dt: number, p1Input: InputState, p2Input: InputState | null) {
    const pen = this.penalty;
    if (!pen || pen.winner) return;

    const spotX = PITCH_WIDTH - PENALTY_SPOT_DIST;
    const isHumanShooting =
      pen.turnTeam === 'home' || this.config.mode === 'local_pvp';
    const shooterInput = pen.turnTeam === 'home' ? p1Input : p2Input ?? p1Input;
    const keeperTeam: TeamSide = pen.turnTeam === 'home' ? 'away' : 'home';
    const isHumanKeeping =
      keeperTeam === 'home' || this.config.mode === 'local_pvp';
    const keeperInput = keeperTeam === 'home' ? p1Input : p2Input ?? p1Input;

    const taker = this.getPlayerById(
      pen.turnTeam === 'home' ? this.homeControlledId : this.awayControlledId
    )!;
    const keeper = this.players.find((p) => p.team === keeperTeam && p.slotIndex === 0)!;

    pen.phaseTimer += dt;

    if (pen.subPhase === 'aiming') {
      // Oscillate PES penalty power meter
      pen.power += pen.powerOscDir * dt * 1.35;
      if (pen.power >= 1) {
        pen.power = 1;
        pen.powerOscDir = -1;
      } else if (pen.power <= 0.1) {
        pen.power = 0.1;
        pen.powerOscDir = 1;
      }

      if (isHumanShooting) {
        pen.aimX = clamp(pen.aimX + shooterInput.moveY * dt * 1.9, -0.95, 0.95);
        pen.aimY = clamp(pen.aimY - shooterInput.moveX * dt * 1.3, 0.08, 0.96);
        if (shooterInput.shootJustPressed || shooterInput.passJustPressed) {
          pen.subPhase = 'running';
          pen.phaseTimer = 0;
          if (!isHumanKeeping) {
            pen.keeperDiveGuess = Math.random() < 0.36 ? Math.sign(pen.aimX) : [-1, 0, 1][Math.floor(Math.random() * 3)];
          }
        }
      } else {
        // Human is goalkeeper! Choose dive direction while AI prepares
        if (keeperInput.moveY < -0.25) pen.keeperDiveGuess = -1;
        else if (keeperInput.moveY > 0.25) pen.keeperDiveGuess = 1;
        else if (Math.abs(keeperInput.moveX) > 0.25) pen.keeperDiveGuess = 0;

        if (pen.phaseTimer > 1.75) {
          pen.aimX = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.45);
          pen.aimY = 0.15 + Math.random() * 0.72;
          pen.power = 0.55 + Math.random() * 0.3;
          pen.subPhase = 'running';
          pen.phaseTimer = 0;
        }
      }
    } else if (pen.subPhase === 'running') {
      // Allow late goalkeeper dive adjustment
      if (isHumanKeeping && Math.abs(keeperInput.moveY) > 0.25) {
        pen.keeperDiveGuess = keeperInput.moveY < 0 ? -1 : 1;
      }
      taker.x += 95 * dt;
      taker.animState = 'jog';
      taker.animTime += dt * 10;

      if (taker.x >= spotX - 10) {
        // Strike penalty!
        const targetY = HALF_H + pen.aimX * (GOAL_HALF_W - 8);
        const speed = 460 + pen.power * 230;
        const dx = PITCH_WIDTH - this.ball.x;
        const dy = targetY - this.ball.y;
        const d = Math.hypot(dx, dy) || 1;

        this.ball.vx = (dx / d) * speed;
        this.ball.vy = (dy / d) * speed;
        // Over-powered red zone risks blasting over the bar!
        this.ball.vz = 75 + pen.aimY * 145 + (pen.power > 0.91 ? 130 : 0);
        this.ball.lastKickSpeedKmh = Math.round(speed * 0.175);
        this.ball.lastShotType = 'penalty';

        taker.animState = 'kick_shoot';
        soundEngine.playKick(0.85, false);

        // Keeper dives!
        if (pen.keeperDiveGuess !== 0) {
          keeper.diveDirY = pen.keeperDiveGuess;
          keeper.vy = pen.keeperDiveGuess * 215;
          keeper.animState = pen.keeperDiveGuess < 0 ? 'gk_dive_left' : 'gk_dive_right';
          keeper.animLockTimer = 0.7;
        }
        pen.subPhase = 'flight';
        pen.phaseTimer = 0;
      }
    } else if (pen.subPhase === 'flight') {
      this.updateBallPhysics(dt, true);
      keeper.y = clamp(keeper.y + keeper.vy * dt, HALF_H - GOAL_HALF_W + 6, HALF_H + GOAL_HALF_W - 6);
      keeper.vy *= Math.pow(0.25, dt);

      // Check keeper save
      const dKeeper = dist(keeper.x, keeper.y, this.ball.x, this.ball.y);
      if (dKeeper < 25 && this.ball.z < 36 && this.ball.x > PITCH_WIDTH - 28 && !this.ball.inGoal) {
        this.ball.vx *= -0.5;
        this.ball.vy += keeper.diveDirY * 120;
        soundEngine.playSaveImpact();
        this.recordPenaltyResult(false, 'SAVED BY THE KEEPER!');
        return;
      }

      if (this.ball.x > PITCH_WIDTH + 6) {
        const inMouth = Math.abs(this.ball.y - HALF_H) < GOAL_HALF_W - 2 && this.ball.z < GOAL_HEIGHT;
        if (inMouth) {
          this.ball.inGoal = 'away';
          this.rightNet = { impactY: this.ball.y, impactZ: this.ball.z, strength: 1, phase: 0 };
          soundEngine.playNetSwish();
          soundEngine.playGoalRoar();
          this.recordPenaltyResult(true, 'GOAL!! CLINICAL PENALTY!');
        } else {
          this.recordPenaltyResult(false, 'OVER THE BAR! MISSED!');
        }
      } else if (pen.phaseTimer > 1.8) {
        this.recordPenaltyResult(false, 'MISSED!');
      }
    } else if (pen.subPhase === 'result') {
      this.updateBallPhysics(dt, true);
      if (pen.phaseTimer > 1.85) {
        this.advancePenaltyTurn();
      }
    }
  }

  private recordPenaltyResult(scored: boolean, text: string) {
    const pen = this.penalty!;
    pen.subPhase = 'result';
    pen.phaseTimer = 0;
    pen.lastResultText = text;
    this.bannerText = scored ? 'GOAL!' : 'SAVED / MISS!';
    this.bannerSubtext = text;

    if (pen.turnTeam === 'home') {
      pen.homeHistory.push(scored ? 'goal' : 'miss');
      if (scored) {
        pen.homeScore++;
        this.stats.home.goals++;
      }
    } else {
      pen.awayHistory.push(scored ? 'goal' : 'miss');
      if (scored) {
        pen.awayScore++;
        this.stats.away.goals++;
      }
    }
  }

  private advancePenaltyTurn() {
    const pen = this.penalty!;
    const hTaken = pen.homeHistory.length;
    const aTaken = pen.awayHistory.length;

    // Check shootout winner (best of 5, then sudden death)
    if (hTaken <= 5 && aTaken <= 5) {
      const hRem = 5 - hTaken;
      const aRem = 5 - aTaken;
      if (pen.homeScore > pen.awayScore + aRem) {
        pen.winner = 'home';
      } else if (pen.awayScore > pen.homeScore + hRem) {
        pen.winner = 'away';
      }
    } else if (hTaken === aTaken && pen.homeScore !== pen.awayScore) {
      pen.winner = pen.homeScore > pen.awayScore ? 'home' : 'away';
    }

    if (pen.winner) {
      const winTeam = pen.winner === 'home' ? this.homeTeam : this.awayTeam;
      this.bannerText = `${winTeam.shortName} WINS ON PENALTIES!`;
      this.bannerSubtext = `${pen.homeScore} - ${pen.awayScore}`;
      this.phase = 'fulltime';
      soundEngine.playWhistle('fulltime');
      return;
    }

    if (pen.turnTeam === 'home') {
      pen.turnTeam = 'away';
    } else {
      pen.turnTeam = 'home';
      pen.round++;
    }
    pen.subPhase = 'aiming';
    pen.phaseTimer = 0;
    pen.aimX = 0;
    pen.aimY = 0.45;
    pen.keeperDiveGuess = 0;
    this.bannerText = null;
    this.bannerSubtext = null;
    this.setupPenaltyKick(pen.turnTeam);
  }

  private updateCamera(dt: number) {
    let targetX = this.ball.x + this.ball.vx * 0.14;
    let targetY = this.ball.y + this.ball.vy * 0.08;
    let targetZoom = 1.04;

    if (this.phase === 'goal_celebration') {
      const scorer = this.getPlayerById(this.celebrationScorerId);
      if (scorer) {
        targetX = scorer.x;
        targetY = scorer.y;
        targetZoom = 1.38;
      }
    } else if (this.phase === 'goal_replay') {
      const rf = this.getReplayFrame();
      if (rf) {
        targetX = rf.ballX;
        targetY = rf.ballY;
        targetZoom = 1.32;
      }
    } else if (this.phase === 'penalty_shootout') {
      targetX = PITCH_WIDTH - 95;
      targetY = HALF_H;
      targetZoom = 1.48;
    } else if (this.phase === 'intro') {
      targetX = HALF_W;
      targetY = HALF_H;
      targetZoom = 0.92;
    }

    const lerp = Math.min(1, dt * 5.2);
    this.camX += (targetX - this.camX) * lerp;
    this.camY += (targetY - this.camY) * lerp;
    this.camZoom += (targetZoom - this.camZoom) * lerp;
  }

  public getHudSnapshot(): HudSnapshot {
    const hc = this.getPlayerById(this.homeControlledId);
    const ac = this.getPlayerById(this.awayControlledId);
    const replayLen = Math.max(1, this.replayFramesSnapshot.length - 1);
    return {
      phase: this.phase,
      half: this.half,
      matchClockSeconds: this.matchClockSeconds,
      stoppageMinutes: this.stoppageMinutes,
      homeScore: this.stats.home.goals,
      awayScore: this.stats.away.goals,
      homeControlled: hc
        ? {
            name: hc.bio.shortName,
            number: hc.bio.number,
            stamina: hc.stamina,
            role: hc.bio.role,
            ovr: hc.bio.ovr,
          }
        : null,
      awayControlled: ac
        ? {
            name: ac.bio.shortName,
            number: ac.bio.number,
            stamina: ac.stamina,
            role: ac.bio.role,
            ovr: ac.bio.ovr,
          }
        : null,
      homeCharge: { ...this.homeCharge },
      awayCharge: { ...this.awayCharge },
      lastGoal: this.lastGoal,
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      stats: {
        home: { ...this.stats.home },
        away: { ...this.stats.away },
        goals: [...this.stats.goals],
      },
      isPaused: this.isPaused,
      replayProgress: this.phase === 'goal_replay' ? clamp(this.replayPlayhead / replayLen, 0, 1) : 0,
      penalty: this.penalty ? { ...this.penalty } : null,
      commentary: this.commentary,
    };
  }

  public serializeState(): SerializedState {
    return {
      phase: this.phase,
      half: this.half,
      matchClockSeconds: this.matchClockSeconds,
      homeScore: this.stats.home.goals,
      awayScore: this.stats.away.goals,
      homeControlledId: this.homeControlledId,
      awayControlledId: this.awayControlledId,
      homeCharge: { ...this.homeCharge },
      awayCharge: { ...this.awayCharge },
      ball: { ...this.ball, trail: this.ball.trail.slice(-8) },
      leftNet: { ...this.leftNet },
      rightNet: { ...this.rightNet },
      players: this.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        stamina: p.stamina,
        animState: p.animState,
        animTime: p.animTime,
        hasBall: p.hasBall,
        diveDirY: p.diveDirY,
      })),
      lastGoal: this.lastGoal,
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      commentary: this.commentary,
      stats: this.stats,
      penalty: this.penalty,
    };
  }

  public applySerializedState(s: SerializedState) {
    this.phase = s.phase;
    this.half = s.half;
    this.matchClockSeconds = s.matchClockSeconds;
    this.homeControlledId = s.homeControlledId;
    this.awayControlledId = s.awayControlledId;
    this.homeCharge = s.homeCharge;
    this.awayCharge = s.awayCharge;
    this.ball = s.ball;
    this.leftNet = s.leftNet;
    this.rightNet = s.rightNet;
    this.lastGoal = s.lastGoal;
    this.bannerText = s.bannerText;
    this.bannerSubtext = s.bannerSubtext;
    this.commentary = s.commentary;
    this.stats = s.stats;
    this.penalty = s.penalty;
    for (const sp of s.players) {
      const p = this.getPlayerById(sp.id);
      if (p) {
        p.x = sp.x;
        p.y = sp.y;
        p.z = sp.z;
        p.vx = sp.vx;
        p.vy = sp.vy;
        p.facing = sp.facing;
        p.stamina = sp.stamina;
        p.animState = sp.animState;
        p.animTime = sp.animTime;
        p.hasBall = sp.hasBall;
        p.diveDirY = sp.diveDirY;
      }
    }
    this.updateCamera(0.033);
  }
}

