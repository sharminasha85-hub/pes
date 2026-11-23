export type TeamSide = 'home' | 'away';

export type FormationId = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2';

export type Difficulty = 'beginner' | 'regular' | 'top_player' | 'superstar';

export type GameMode =
  | 'exhibition'
  | 'online'
  | 'local_pvp'
  | 'penalties'
  | 'training';

export type KitPattern = 'solid' | 'vertical' | 'hoops' | 'sash' | 'sleeves';

export interface KitStyle {
  primary: string;
  secondary: string;
  accent: string;
  shorts: string;
  socks: string;
  numberColor: string;
  pattern: KitPattern;
  gkPrimary: string;
  gkSecondary: string;
}

export type PlayerRole =
  | 'GK'
  | 'LB'
  | 'CB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST';

export interface PlayerBio {
  name: string;
  shortName: string;
  number: number;
  role: PlayerRole;
  ovr: number;
  speed: number; // 60-99
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  gk: number;
  skinTone: string;
  hairColor: string;
}

export interface TeamData {
  id: string;
  name: string;
  shortName: string;
  league: string;
  crestBg: string;
  crestAccent: string;
  attack: number;
  midfield: number;
  defense: number;
  defaultFormation: FormationId;
  kit: KitStyle;
  roster: PlayerBio[];
}

export type AnimState =
  | 'idle'
  | 'jog'
  | 'sprint'
  | 'dribble'
  | 'kick_pass'
  | 'kick_shoot'
  | 'kick_lob'
  | 'header'
  | 'slide_tackle'
  | 'stand_tackle'
  | 'stumble'
  | 'skill_feint'
  | 'gk_ready'
  | 'gk_dive_left'
  | 'gk_dive_right'
  | 'celebrate_slide'
  | 'celebrate_airplane'
  | 'celebrate_jump';

export interface PlayerEntity {
  id: string;
  team: TeamSide;
  slotIndex: number; // 0 = GK, 1..10 = outfield
  bio: PlayerBio;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number; // radians
  stamina: number; // 0..100
  animState: AnimState;
  animTime: number;
  animLockTimer: number; // seconds remaining in locked animation
  actionCooldown: number;
  stunTimer: number;
  skillTimer: number;
  hasBall: boolean;
  dribbleTouchPhase: number;
  // Home anchor in pitch coords for current phase
  homeX: number;
  homeY: number;
  // GK dive target
  diveDirY: number;
  divePower: number;
  yellowCards: number;
}

export interface BallEntity {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number; // lateral curve rad/s
  rotX: number;
  rotY: number;
  ownerId: string | null;
  lastTouchTeam: TeamSide | null;
  lastTouchPlayerId: string | null;
  prevTouchPlayerId: string | null;
  prevTouchTeam: TeamSide | null;
  lastKickSpeedKmh: number;
  lastShotType: 'normal' | 'finesse' | 'volley' | 'header' | 'power' | 'penalty';
  isCross: boolean;
  inGoal: TeamSide | null; // which goal net it entered
  trail: Array<{ x: number; y: number; z: number; alpha: number; color: string }>;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

export interface NetState {
  // Deformation impulse on left (home) or right (away) goal net
  impactY: number;
  impactZ: number;
  strength: number;
  phase: number;
}

export interface GoalEvent {
  scoringTeam: TeamSide;
  scorerName: string;
  scorerNumber: number;
  assistName: string | null;
  minute: number;
  half: number;
  shotSpeedKmh: number;
  shotType: BallEntity['lastShotType'];
  isOwnGoal: boolean;
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  possessionTicks: number;
  passesAttempted: number;
  passesCompleted: number;
  tackles: number;
  fouls: number;
  corners: number;
  saves: number;
}

export interface MatchStats {
  home: TeamMatchStats;
  away: TeamMatchStats;
  goals: GoalEvent[];
}

export type MatchPhase =
  | 'intro'
  | 'kickoff'
  | 'playing'
  | 'goal_celebration'
  | 'goal_replay'
  | 'set_piece'
  | 'halftime'
  | 'fulltime'
  | 'penalty_shootout';

export type SetPieceType = 'throw_in' | 'corner' | 'goal_kick' | 'free_kick';

export interface SetPieceState {
  type: SetPieceType;
  team: TeamSide;
  x: number;
  y: number;
  timer: number;
  takerId: string | null;
}

export interface ReplayPlayerSnapshot {
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
}

export interface ReplayFrame {
  ballX: number;
  ballY: number;
  ballZ: number;
  ballRotX: number;
  ballRotY: number;
  ballTrail: BallEntity['trail'];
  leftNet: NetState;
  rightNet: NetState;
  players: ReplayPlayerSnapshot[];
}

export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  sprint: boolean;
  finesse: boolean;
  passHeld: boolean;
  passJustPressed: boolean;
  passJustReleased: boolean;
  throughHeld: boolean;
  throughJustPressed: boolean;
  throughJustReleased: boolean;
  shootHeld: boolean;
  shootJustPressed: boolean;
  shootJustReleased: boolean;
  lobHeld: boolean;
  lobJustPressed: boolean;
  lobJustReleased: boolean;
  skillJustPressed: boolean;
}

export interface ChargeState {
  action: 'none' | 'pass' | 'through' | 'shoot' | 'lob';
  power: number; // 0..1
  finesse: boolean;
  playerId: string | null;
}

export interface PenaltyShotRecord {
  team: TeamSide;
  scored: boolean | null; // null = not yet taken
  takerName: string;
}

export interface PenaltyShootoutState {
  turnTeam: TeamSide;
  round: number; // 1..5+
  subPhase: 'aiming' | 'running' | 'flight' | 'result';
  phaseTimer: number;
  aimX: number; // -1 (left post) .. +1 (right post)
  aimY: number; // 0 (low) .. 1 (top corner)
  power: number; // 0..1
  powerOscDir: number;
  keeperDiveGuess: number; // -1, 0, +1
  homeScore: number;
  awayScore: number;
  homeHistory: Array<'goal' | 'miss'>;
  awayHistory: Array<'goal' | 'miss'>;
  lastResultText: string;
  winner: TeamSide | null;
}

export interface MatchConfig {
  mode: GameMode;
  homeTeamId: string;
  awayTeamId: string;
  homeFormation: FormationId;
  awayFormation: FormationId;
  difficulty: Difficulty;
  matchMinutes: number; // real-time minutes for full 90' match (e.g. 3, 5, 8)
  stadiumTime: 'night' | 'sunset' | 'day';
  onlineRole?: 'host' | 'client';
  roomCode?: string;
}

export interface HudSnapshot {
  phase: MatchPhase;
  half: number;
  matchClockSeconds: number; // 0..5400 (0'..90')
  stoppageMinutes: number;
  homeScore: number;
  awayScore: number;
  homeControlled: {
    name: string;
    number: number;
    stamina: number;
    role: PlayerRole;
    ovr: number;
  } | null;
  awayControlled: {
    name: string;
    number: number;
    stamina: number;
    role: PlayerRole;
    ovr: number;
  } | null;
  homeCharge: ChargeState;
  awayCharge: ChargeState;
  lastGoal: GoalEvent | null;
  bannerText: string | null;
  bannerSubtext: string | null;
  stats: MatchStats;
  isPaused: boolean;
  replayProgress: number; // 0..1
  penalty: PenaltyShootoutState | null;
  commentary: string;
}

