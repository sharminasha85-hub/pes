import React, { useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Home,
  Volume2,
  VolumeX,
  HelpCircle,
  FastForward,
  Crosshair,
} from 'lucide-react';
import {
  HudSnapshot,
  MatchConfig,
  PlayerEntity,
  TeamData,
} from '../types/game';
import { PITCH_HEIGHT, PITCH_WIDTH } from '../engine/constants';
import { TeamCrest } from './TeamCrest';

interface MatchHudProps {
  hud: HudSnapshot;
  config: MatchConfig;
  homeTeam: TeamData;
  awayTeam: TeamData;
  radarPlayers: Array<{ id: string; team: 'home' | 'away'; x: number; y: number }>;
  radarBall: { x: number; y: number };
  homeControlledId: string | null;
  awayControlledId: string | null;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onSkipReplay: () => void;
  onContinueHalftime: () => void;
  onStartPenalties: () => void;
  onRematch: () => void;
  onExitMenu: () => void;
}

function formatClock(sec: number, half: number): { main: string; extra: string | null } {
  const totalMin = Math.floor(sec / 60);
  const remSec = Math.floor(sec % 60);
  const cap = half === 1 ? 45 : 90;
  if (totalMin >= cap) {
    const over = totalMin - cap + 1;
    return {
      main: `${String(cap).padStart(2, '0')}:00`,
      extra: `+${over}'`,
    };
  }
  return {
    main: `${String(totalMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`,
    extra: null,
  };
}

export const MatchHud: React.FC<MatchHudProps> = ({
  hud,
  config,
  homeTeam,
  awayTeam,
  radarPlayers,
  radarBall,
  homeControlledId,
  awayControlledId,
  muted,
  onToggleMute,
  onTogglePause,
  onSkipReplay,
  onContinueHalftime,
  onStartPenalties,
  onRematch,
  onExitMenu,
}) => {
  const [showControls, setShowControls] = useState(false);

  const clock = formatClock(hud.matchClockSeconds, hud.half);
  const totalPoss = Math.max(1, hud.stats.home.possessionTicks + hud.stats.away.possessionTicks);
  const homePossPct = Math.round((hud.stats.home.possessionTicks / totalPoss) * 100);
  const awayPossPct = 100 - homePossPct;

  const homePassPct =
    hud.stats.home.passesAttempted > 0
      ? Math.round((hud.stats.home.passesCompleted / hud.stats.home.passesAttempted) * 100)
      : 0;
  const awayPassPct =
    hud.stats.away.passesAttempted > 0
      ? Math.round((hud.stats.away.passesCompleted / hud.stats.away.passesAttempted) * 100)
      : 0;

  const renderNameplate = (
    side: 'home' | 'away',
    team: TeamData,
    player: HudSnapshot['homeControlled'],
    charge: HudSnapshot['homeCharge']
  ) => {
    if (!player) return null;
    const staminaColor =
      player.stamina > 55 ? '#22c55e' : player.stamina > 25 ? '#facc15' : '#ef4444';
    const alignRight = side === 'away';
    return (
      <div
        className="pes-nameplate"
        style={{
          borderColor: side === 'home' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(251, 113, 133, 0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexDirection: alignRight ? 'row-reverse' : 'row',
            marginBottom: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexDirection: alignRight ? 'row-reverse' : 'row' }}>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 4,
                background: team.crestBg,
                color: team.id === 'rma' ? '#0f172a' : '#fff',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              {player.number}
            </span>
            <span style={{ fontFamily: 'var(--font-pes)', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em' }}>
              {player.name}
            </span>
          </div>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-pes)', color: '#94a3b8' }}>
            {player.role} • {player.ovr}
          </span>
        </div>

        {/* Stamina bar */}
        <div className="pes-bar-track" style={{ height: 5, marginBottom: 5 }}>
          <div
            style={{
              width: `${Math.round(player.stamina)}%`,
              height: '100%',
              background: staminaColor,
              transition: 'width 0.12s linear',
            }}
          />
        </div>

        {/* Iconic PES Power Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-pes)',
              fontWeight: 700,
              color: charge.action !== 'none' ? '#fde047' : '#64748b',
              minWidth: 50,
            }}
          >
            {charge.action === 'shoot'
              ? charge.finesse
                ? 'FINESSE'
                : 'SHOOT'
              : charge.action === 'pass'
                ? 'PASS'
                : charge.action === 'through'
                  ? 'THROUGH'
                  : charge.action === 'lob'
                    ? 'CROSS'
                    : 'POWER'}
          </span>
          <div className="pes-bar-track" style={{ height: 8 }}>
            <div
              className="pes-power-fill"
              style={{ width: `${Math.round(charge.power * 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '14px 18px',
        zIndex: 10,
      }}
    >
      {/* === TOP ROW: BROADCAST SCOREBOARD + COMMENTARY + CONTROLS === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        {/* PES Broadcast Scoreboard */}
        <div className="pes-scoreboard" style={{ pointerEvents: 'auto' }}>
          <div
            className="pes-score-team"
            style={{ borderBottom: `3px solid ${homeTeam.kit.primary}` }}
          >
            <TeamCrest team={homeTeam} size={22} />
            <span>{homeTeam.shortName}</span>
          </div>
          <div className="pes-score-digit">{hud.homeScore}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
              color: '#64748b',
              fontWeight: 800,
            }}
          >
            -
          </div>
          <div className="pes-score-digit">{hud.awayScore}</div>
          <div
            className="pes-score-team"
            style={{ borderBottom: `3px solid ${awayTeam.kit.primary}` }}
          >
            <span>{awayTeam.shortName}</span>
            <TeamCrest team={awayTeam} size={22} />
          </div>

          <div className="pes-clock-box">
            {config.mode === 'training' ? (
              <span>TRAINING</span>
            ) : config.mode === 'penalties' || hud.phase === 'penalty_shootout' ? (
              <span>PEN</span>
            ) : (
              <>
                <span style={{ fontSize: 10, opacity: 0.85 }}>
                  {hud.half === 1 ? '1ST' : '2ND'}
                </span>
                <span>{clock.main}</span>
                {clock.extra && (
                  <span style={{ color: '#fef08a', fontSize: 12 }}>{clock.extra}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Live Commentary Ticker */}
        <div
          style={{
            flex: 1,
            maxWidth: 440,
            padding: '7px 14px',
            borderRadius: 999,
            background: 'rgba(6, 12, 28, 0.76)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            textAlign: 'center',
            fontSize: 12.5,
            fontFamily: 'var(--font-pes)',
            color: '#e2e8f0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            backdropFilter: 'blur(6px)',
          }}
        >
          {hud.commentary}
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button
            className="pes-btn-secondary"
            style={{ padding: '7px 10px' }}
            title="Toggle Audio"
            onClick={onToggleMute}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            className="pes-btn-secondary"
            style={{ padding: '7px 10px' }}
            title="Controls"
            onClick={() => setShowControls((v) => !v)}
          >
            <HelpCircle size={15} />
          </button>
          <button
            className="pes-btn-secondary"
            style={{ padding: '7px 10px' }}
            title="Pause (ESC)"
            onClick={onTogglePause}
          >
            {hud.isPaused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>
      </div>

      {/* === CENTER OVERLAYS: GOAL BANNER, REPLAY BAR, PENALTY HUD === */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        {/* GOAL CELEBRATION SLAM BANNER */}
        {hud.phase === 'goal_celebration' && hud.lastGoal && (
          <div className="pes-goal-banner">
            <div className="pes-goal-word">GOAL!!</div>
            <div
              style={{
                marginTop: 6,
                fontFamily: 'var(--font-pes)',
                fontSize: 20,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.08em',
              }}
            >
              #{hud.lastGoal.scorerNumber} {hud.lastGoal.scorerName} &nbsp;•&nbsp; {hud.lastGoal.minute}&apos;
            </div>
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                fontFamily: 'var(--font-pes)',
                fontSize: 13,
                color: '#38bdf8',
              }}
            >
              {hud.lastGoal.assistName && (
                <span>ASSIST: {hud.lastGoal.assistName}</span>
              )}
              <span>SPEED: {hud.lastGoal.shotSpeedKmh} KM/H</span>
              <span style={{ color: '#fde047', textTransform: 'uppercase' }}>
                {hud.lastGoal.shotType === 'finesse'
                  ? 'CURLED FINESSE'
                  : hud.lastGoal.shotType === 'power'
                    ? 'THUNDERBOLT'
                    : hud.lastGoal.shotType === 'volley'
                      ? 'VOLLEY'
                      : hud.lastGoal.shotType === 'header'
                        ? 'HEADER'
                        : 'CLINICAL FINISH'}
              </span>
            </div>
          </div>
        )}

        {/* NON-GOAL BROADCAST BANNERS (Kickoff, Corner, Throw-in, Set Piece) */}
        {hud.phase !== 'goal_celebration' &&
          hud.phase !== 'goal_replay' &&
          hud.phase !== 'halftime' &&
          hud.phase !== 'fulltime' &&
          hud.bannerText && (
            <div
              style={{
                padding: '10px 30px',
                borderRadius: 10,
                background: 'rgba(6, 12, 28, 0.88)',
                borderTop: '2px solid #00d4ff',
                borderBottom: '2px solid #facc15',
                textAlign: 'center',
                boxShadow: '0 10px 32px rgba(0,0,0,0.55)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                }}
              >
                {hud.bannerText}
              </div>
              {hud.bannerSubtext && (
                <div
                  style={{
                    marginTop: 3,
                    fontFamily: 'var(--font-pes)',
                    fontSize: 13,
                    color: '#38bdf8',
                    letterSpacing: '0.1em',
                  }}
                >
                  {hud.bannerSubtext}
                </div>
              )}
            </div>
          )}

        {/* INSTANT REPLAY BROADCAST WATERMARK + SKIP */}
        {hud.phase === 'goal_replay' && (
          <div
            style={{
              position: 'fixed',
              top: 66,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 18px',
              borderRadius: 999,
              background: 'rgba(6, 12, 28, 0.9)',
              border: '1px solid rgba(0, 212, 255, 0.5)',
              pointerEvents: 'auto',
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 8px #ef4444',
              }}
            />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', color: '#38bdf8' }}>
              PES INSTANT REPLAY • 0.5x
            </span>
            <div style={{ width: 90, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(hud.replayProgress * 100)}%`, height: '100%', background: '#facc15' }} />
            </div>
            <button
              className="pes-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={onSkipReplay}
            >
              <FastForward size={12} /> Skip
            </button>
          </div>
        )}

        {/* PENALTY SHOOTOUT TRACKER */}
        {hud.phase === 'penalty_shootout' && hud.penalty && (
          <div
            style={{
              position: 'fixed',
              bottom: 108,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '12px 22px',
              borderRadius: 12,
              background: 'rgba(6, 12, 28, 0.92)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              minWidth: 370,
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-pes)', fontWeight: 700, fontSize: 13 }}>{homeTeam.shortName}</span>
                {Array.from({ length: Math.max(5, hud.penalty.homeHistory.length) }).map((_, i) => {
                  const res = hud.penalty!.homeHistory[i];
                  return (
                    <span
                      key={i}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: res === 'goal' ? '#22c55e' : res === 'miss' ? '#ef4444' : 'rgba(255,255,255,0.18)',
                        border: '1px solid rgba(255,255,255,0.3)',
                      }}
                    />
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {Array.from({ length: Math.max(5, hud.penalty.awayHistory.length) }).map((_, i) => {
                  const res = hud.penalty!.awayHistory[i];
                  return (
                    <span
                      key={i}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: res === 'goal' ? '#22c55e' : res === 'miss' ? '#ef4444' : 'rgba(255,255,255,0.18)',
                        border: '1px solid rgba(255,255,255,0.3)',
                      }}
                    />
                  );
                })}
                <span style={{ fontFamily: 'var(--font-pes)', fontWeight: 700, fontSize: 13 }}>{awayTeam.shortName}</span>
              </div>
            </div>

            {hud.penalty.subPhase === 'aiming' && (
              <>
                <div className="pes-bar-track" style={{ height: 10, marginBottom: 6 }}>
                  <div className="pes-power-fill" style={{ width: `${Math.round(hud.penalty.power * 100)}%` }} />
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-pes)', color: '#fde047' }}>
                  {hud.penalty.turnTeam === 'home'
                    ? 'AIM TARGET (WASD / ARROWS) • PRESS K / SPACE TO STRIKE!'
                    : 'DEFEND GOAL: HOLD UP (LEFT DIVE) OR DOWN (RIGHT DIVE)!'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* === BOTTOM ROW: P1 NAMEPLATE + PES RADAR MINIMAP + P2 NAMEPLATE === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        {renderNameplate('home', homeTeam, hud.homeControlled, hud.homeCharge)}

        {/* Iconic PES Translucent Pitch Radar Minimap */}
        <div
          style={{
            width: 210,
            height: 112,
            borderRadius: 8,
            background: 'rgba(7, 25, 16, 0.78)',
            border: '1.5px solid rgba(255, 255, 255, 0.25)',
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
          }}
        >
          <svg width="210" height="112" viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`}>
            {/* Radar pitch lines */}
            <rect x="6" y="6" width={PITCH_WIDTH - 12} height={PITCH_HEIGHT - 12} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="8" />
            <line x1={PITCH_WIDTH / 2} y1="6" x2={PITCH_WIDTH / 2} y2={PITCH_HEIGHT - 6} stroke="rgba(255,255,255,0.35)" strokeWidth="7" />
            <circle cx={PITCH_WIDTH / 2} cy={PITCH_HEIGHT / 2} r="90" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="7" />
            <rect x="6" y="138" width="165" height="404" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="7" />
            <rect x={PITCH_WIDTH - 171} y="138" width="165" height="404" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="7" />

            {/* All 22 player dots */}
            {radarPlayers.map((rp) => {
              const isCtrl = rp.id === homeControlledId || rp.id === awayControlledId;
              const fill = rp.team === 'home' ? homeTeam.kit.primary : awayTeam.kit.primary;
              return (
                <g key={rp.id}>
                  {isCtrl && (
                    <circle
                      cx={rp.x}
                      cy={rp.y}
                      r="30"
                      fill="none"
                      stroke={rp.id === homeControlledId ? '#38bdf8' : '#fb7185'}
                      strokeWidth="9"
                    />
                  )}
                  <circle
                    cx={rp.x}
                    cy={rp.y}
                    r="18"
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth="6"
                  />
                </g>
              );
            })}

            {/* Glowing ball dot */}
            <circle cx={radarBall.x} cy={radarBall.y} r="17" fill="#fef08a" stroke="#000" strokeWidth="5" />
          </svg>
        </div>

        {renderNameplate('away', awayTeam, hud.awayControlled, hud.awayCharge)}
      </div>

      {/* === CONTROLS DRAWER === */}
      {showControls && (
        <div
          style={{
            position: 'fixed',
            top: 62,
            right: 18,
            width: 310,
            padding: 16,
            borderRadius: 12,
            background: 'rgba(6, 12, 28, 0.96)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            pointerEvents: 'auto',
            fontSize: 12.5,
            lineHeight: 1.8,
            boxShadow: '0 14px 40px rgba(0,0,0,0.65)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, color: '#38bdf8', marginBottom: 8 }}>
            PES CONTROLS REFERENCE
          </div>
          {config.mode === 'local_pvp' ? (
            <>
              <div style={{ color: '#38bdf8', fontWeight: 700 }}>PLAYER 1 (HOME)</div>
              <div>WASD Move • L-Shift Sprint • V Finesse</div>
              <div>F Pass/Switch • G Shoot/Press • R Through • T Cross/Slide • E Skill</div>
              <div style={{ color: '#fb7185', fontWeight: 700, marginTop: 8 }}>PLAYER 2 (AWAY)</div>
              <div>Arrows Move • R-Shift/M Sprint • N Finesse</div>
              <div>J Pass/Switch • K Shoot/Press • I Through • L Cross/Slide • U Skill</div>
            </>
          ) : (
            <>
              <div><span className="pes-key">WASD</span> / <span className="pes-key">Arrows</span> — Move &amp; Aim</div>
              <div><span className="pes-key">SHIFT</span> — Dash / Sprint (R1)</div>
              <div><span className="pes-key">J</span> / <span className="pes-key">SPACE</span> — Short Pass / Switch Player (X)</div>
              <div><span className="pes-key">K</span> / <span className="pes-key">ENTER</span> — Shoot / Press Tackle (□)</div>
              <div><span className="pes-key">I</span> / <span className="pes-key">E</span> — Through Ball / GK Rush (Δ)</div>
              <div><span className="pes-key">L</span> / <span className="pes-key">Q</span> — Lofted Cross / Slide Tackle (O)</div>
              <div><span className="pes-key">C</span> + Shoot — Finesse Curled Shot (R2+□)</div>
              <div><span className="pes-key">F</span> / <span className="pes-key">U</span> — PES Step-Over Skill Feint</div>
            </>
          )}
        </div>
      )}

      {/* === PAUSE / HALFTIME / FULLTIME MODAL === */}
      {(hud.isPaused || hud.phase === 'halftime' || hud.phase === 'fulltime') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 20, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 'min(560px, 94vw)',
              padding: '26px 28px',
              borderRadius: 16,
              background: 'linear-gradient(155deg, #0b1636, #060c1f)',
              border: '1px solid rgba(56, 189, 248, 0.38)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.75)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  color: hud.phase === 'fulltime' ? '#facc15' : '#38bdf8',
                }}
              >
                {hud.phase === 'fulltime'
                  ? 'FULL TIME'
                  : hud.phase === 'halftime'
                    ? 'HALF TIME'
                    : 'MATCH PAUSED'}
              </div>

              {/* Big Scoreboard */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 18,
                  marginTop: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TeamCrest team={homeTeam} size={42} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
                    {homeTeam.shortName}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 38,
                    fontWeight: 900,
                    padding: '4px 18px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  {hud.homeScore} - {hud.awayScore}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
                    {awayTeam.shortName}
                  </span>
                  <TeamCrest team={awayTeam} size={42} />
                </div>
              </div>
            </div>

            {/* Goal scorers list */}
            {hud.stats.goals.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '8px 14px',
                  marginBottom: 14,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  fontSize: 12,
                  fontFamily: 'var(--font-pes)',
                }}
              >
                <div>
                  {hud.stats.goals
                    .filter((g) => g.scoringTeam === 'home')
                    .map((g, i) => (
                      <div key={i} style={{ color: '#bae6fd' }}>
                        ⚽ {g.scorerName} {g.minute}&apos;
                      </div>
                    ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {hud.stats.goals
                    .filter((g) => g.scoringTeam === 'away')
                    .map((g, i) => (
                      <div key={i} style={{ color: '#fecdd3' }}>
                        {g.minute}&apos; {g.scorerName} ⚽
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* PES Match Stats Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {[
                { label: 'POSSESSION', h: `${homePossPct}%`, a: `${awayPossPct}%` },
                { label: 'SHOTS (ON TARGET)', h: `${hud.stats.home.shots} (${hud.stats.home.shotsOnTarget})`, a: `${hud.stats.away.shots} (${hud.stats.away.shotsOnTarget})` },
                { label: 'PASS ACCURACY', h: `${homePassPct}%`, a: `${awayPassPct}%` },
                { label: 'TACKLES WON', h: String(hud.stats.home.tackles), a: String(hud.stats.away.tackles) },
                { label: 'GK SAVES', h: String(hud.stats.home.saves), a: String(hud.stats.away.saves) },
                { label: 'CORNERS', h: String(hud.stats.home.corners), a: String(hud.stats.away.corners) },
              ].map((row) => (
                <div className="pes-stat-row" key={row.label}>
                  <span style={{ textAlign: 'left', fontWeight: 700, color: '#38bdf8' }}>{row.h}</span>
                  <span style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', letterSpacing: '0.1em' }}>
                    {row.label}
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: '#fb7185' }}>{row.a}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {hud.isPaused && hud.phase !== 'halftime' && hud.phase !== 'fulltime' && (
                <button className="pes-btn-primary" onClick={onTogglePause}>
                  <Play size={16} fill="currentColor" /> Resume Match
                </button>
              )}

              {hud.phase === 'halftime' && (
                <button className="pes-btn-primary" onClick={onContinueHalftime}>
                  <Play size={16} fill="currentColor" /> Kick Off 2nd Half
                </button>
              )}

              {hud.phase === 'fulltime' &&
                hud.homeScore === hud.awayScore &&
                !hud.penalty && (
                  <button className="pes-btn-primary" onClick={onStartPenalties}>
                    <Crosshair size={16} /> Penalty Shootout!
                  </button>
                )}

              <button className="pes-btn-secondary" onClick={onRematch}>
                <RotateCcw size={15} /> Rematch
              </button>
              <button className="pes-btn-secondary" onClick={onExitMenu}>
                <Home size={15} /> Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

