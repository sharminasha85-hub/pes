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
  Smartphone,
} from 'lucide-react';
import {
  HudSnapshot,
  MatchConfig,
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
  touchEnabled: boolean;
  onToggleTouch: () => void;
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
  touchEnabled,
  onToggleTouch,
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
        className={`pes-nameplate ${side === 'away' ? 'pes-nameplate-away' : ''}`}
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
            marginBottom: 4,
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: alignRight ? 'row-reverse' : 'row', minWidth: 0 }}>
            <span
              style={{
                padding: '1px 5px',
                borderRadius: 4,
                background: team.crestBg,
                color: team.id === 'rma' ? '#0f172a' : '#fff',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {player.number}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-pes)',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.03em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {player.name}
            </span>
          </div>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-pes)', color: '#94a3b8', flexShrink: 0 }}>
            {player.role}
          </span>
        </div>

        {/* Stamina bar */}
        <div className="pes-bar-track" style={{ height: 4, marginBottom: 4 }}>
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
              fontSize: 9.5,
              fontFamily: 'var(--font-pes)',
              fontWeight: 700,
              color: charge.action !== 'none' ? '#fde047' : '#64748b',
              minWidth: 42,
            }}
          >
            {charge.action === 'shoot'
              ? charge.finesse
                ? 'CURL'
                : 'SHOOT'
              : charge.action === 'pass'
                ? 'PASS'
                : charge.action === 'through'
                  ? 'THRU'
                  : charge.action === 'lob'
                    ? 'CROSS'
                    : 'POWER'}
          </span>
          <div className="pes-bar-track" style={{ height: 7 }}>
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
    <div className="pes-hud-root">
      {/* === TOP ROW: BROADCAST SCOREBOARD + COMMENTARY + CONTROLS === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* PES Broadcast Scoreboard */}
          <div className="pes-scoreboard" style={{ pointerEvents: 'auto' }}>
            <div
              className="pes-score-team"
              style={{ borderBottom: `3px solid ${homeTeam.kit.primary}` }}
            >
              <TeamCrest team={homeTeam} size={20} />
              <span>{homeTeam.shortName}</span>
            </div>
            <div className="pes-score-digit">{hud.homeScore}</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 3px',
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
              <TeamCrest team={awayTeam} size={20} />
            </div>

            <div className="pes-clock-box">
              {config.mode === 'training' ? (
                <span>TRAIN</span>
              ) : config.mode === 'penalties' || hud.phase === 'penalty_shootout' ? (
                <span>PEN</span>
              ) : (
                <>
                  <span style={{ fontSize: 10, opacity: 0.85 }}>
                    {hud.half === 1 ? '1ST' : '2ND'}
                  </span>
                  <span>{clock.main}</span>
                  {clock.extra && (
                    <span style={{ color: '#fef08a', fontSize: 11 }}>{clock.extra}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* When touch controls are active, dock active player nameplate cleanly under scoreboard so thumbs never cover it */}
          {touchEnabled && renderNameplate('home', homeTeam, hud.homeControlled, hud.homeCharge)}
        </div>

        {/* Live Commentary Ticker (auto-hidden on compact mobile screens) */}
        <div className="pes-commentary-pill">{hud.commentary}</div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto', flexShrink: 0 }}>
          <button
            className="pes-btn-secondary"
            style={{
              padding: '7px 9px',
              borderColor: touchEnabled ? '#38bdf8' : undefined,
              color: touchEnabled ? '#38bdf8' : undefined,
            }}
            title={touchEnabled ? 'Hide Touch Controls' : 'Show Touch Controls'}
            onClick={onToggleTouch}
          >
            <Smartphone size={15} />
          </button>
          <button
            className="pes-btn-secondary"
            style={{ padding: '7px 9px' }}
            title="Toggle Audio"
            onClick={onToggleMute}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            className="pes-btn-secondary"
            style={{ padding: '7px 9px' }}
            title="Controls"
            onClick={() => setShowControls((v) => !v)}
          >
            <HelpCircle size={15} />
          </button>
          <button
            className="pes-btn-secondary"
            style={{ padding: '7px 9px' }}
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
          gap: 10,
        }}
      >
        {/* GOAL CELEBRATION SLAM BANNER */}
        {hud.phase === 'goal_celebration' && hud.lastGoal && (
          <div className="pes-goal-banner">
            <div className="pes-goal-word">GOAL!!</div>
            <div
              style={{
                marginTop: 5,
                fontFamily: 'var(--font-pes)',
                fontSize: 'clamp(14px, 3.2vw, 20px)',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.06em',
              }}
            >
              #{hud.lastGoal.scorerNumber} {hud.lastGoal.scorerName} &nbsp;•&nbsp; {hud.lastGoal.minute}&apos;
            </div>
            <div
              style={{
                marginTop: 5,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '4px 12px',
                fontFamily: 'var(--font-pes)',
                fontSize: 12,
                color: '#38bdf8',
              }}
            >
              {hud.lastGoal.assistName && (
                <span>ASSIST: {hud.lastGoal.assistName}</span>
              )}
              <span>{hud.lastGoal.shotSpeedKmh} KM/H</span>
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

        {/* NON-GOAL BROADCAST BANNERS */}
        {hud.phase !== 'goal_celebration' &&
          hud.phase !== 'goal_replay' &&
          hud.phase !== 'halftime' &&
          hud.phase !== 'fulltime' &&
          hud.bannerText && (
            <div
              style={{
                padding: '8px 22px',
                borderRadius: 10,
                background: 'rgba(6, 12, 28, 0.88)',
                borderTop: '2px solid #00d4ff',
                borderBottom: '2px solid #facc15',
                textAlign: 'center',
                boxShadow: '0 10px 32px rgba(0,0,0,0.55)',
                maxWidth: '90vw',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(15px, 3vw, 22px)',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                }}
              >
                {hud.bannerText}
              </div>
              {hud.bannerSubtext && (
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: 'var(--font-pes)',
                    fontSize: 12,
                    color: '#38bdf8',
                    letterSpacing: '0.08em',
                  }}
                >
                  {hud.bannerSubtext}
                </div>
              )}
            </div>
          )}

        {/* INSTANT REPLAY WATERMARK + SKIP */}
        {hud.phase === 'goal_replay' && (
          <div
            style={{
              position: 'fixed',
              top: 'calc(56px + var(--safe-top))',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(6, 12, 28, 0.92)',
              border: '1px solid rgba(0, 212, 255, 0.5)',
              pointerEvents: 'auto',
              maxWidth: '94vw',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 8px #ef4444',
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: '#38bdf8', whiteSpace: 'nowrap' }}>
              REPLAY • 0.5x
            </span>
            <div style={{ width: 64, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(hud.replayProgress * 100)}%`, height: '100%', background: '#facc15' }} />
            </div>
            <button
              className="pes-btn-secondary"
              style={{ padding: '4px 9px', fontSize: 11 }}
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
              bottom: touchEnabled ? 'calc(182px + var(--safe-bottom))' : 108,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '10px 16px',
              borderRadius: 12,
              background: 'rgba(6, 12, 28, 0.92)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              width: 'min(370px, 92vw)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontFamily: 'var(--font-pes)', fontWeight: 700, fontSize: 12 }}>{homeTeam.shortName}</span>
                {Array.from({ length: Math.max(5, hud.penalty.homeHistory.length) }).map((_, i) => {
                  const res = hud.penalty!.homeHistory[i];
                  return (
                    <span
                      key={i}
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: res === 'goal' ? '#22c55e' : res === 'miss' ? '#ef4444' : 'rgba(255,255,255,0.18)',
                        border: '1px solid rgba(255,255,255,0.3)',
                      }}
                    />
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {Array.from({ length: Math.max(5, hud.penalty.awayHistory.length) }).map((_, i) => {
                  const res = hud.penalty!.awayHistory[i];
                  return (
                    <span
                      key={i}
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: res === 'goal' ? '#22c55e' : res === 'miss' ? '#ef4444' : 'rgba(255,255,255,0.18)',
                        border: '1px solid rgba(255,255,255,0.3)',
                      }}
                    />
                  );
                })}
                <span style={{ fontFamily: 'var(--font-pes)', fontWeight: 700, fontSize: 12 }}>{awayTeam.shortName}</span>
              </div>
            </div>

            {hud.penalty.subPhase === 'aiming' && (
              <>
                <div className="pes-bar-track" style={{ height: 9, marginBottom: 5 }}>
                  <div className="pes-power-fill" style={{ width: `${Math.round(hud.penalty.power * 100)}%` }} />
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-pes)', color: '#fde047' }}>
                  {hud.penalty.turnTeam === 'home'
                    ? touchEnabled
                      ? 'AIM WITH JOYSTICK • TAP SHOOT!'
                      : 'AIM (WASD / ARROWS) • PRESS K / SPACE TO STRIKE!'
                    : touchEnabled
                      ? 'HOLD JOYSTICK UP (LEFT DIVE) OR DOWN (RIGHT DIVE)!'
                      : 'DEFEND GOAL: HOLD UP (LEFT DIVE) OR DOWN (RIGHT DIVE)!'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* === BOTTOM ROW: NAMEPLATES + PES RADAR MINIMAP === */}
      <div
        style={{
          display: 'flex',
          justifyContent: touchEnabled ? 'center' : 'space-between',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        {!touchEnabled && renderNameplate('home', homeTeam, hud.homeControlled, hud.homeCharge)}

        {/* Iconic PES Translucent Pitch Radar Minimap */}
        <div className="pes-radar-box">
          <svg width="100%" height="100%" viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`} preserveAspectRatio="none">
            <rect x="6" y="6" width={PITCH_WIDTH - 12} height={PITCH_HEIGHT - 12} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="8" />
            <line x1={PITCH_WIDTH / 2} y1="6" x2={PITCH_WIDTH / 2} y2={PITCH_HEIGHT - 6} stroke="rgba(255,255,255,0.35)" strokeWidth="7" />
            <circle cx={PITCH_WIDTH / 2} cy={PITCH_HEIGHT / 2} r="90" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="7" />
            <rect x="6" y="138" width="165" height="404" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="7" />
            <rect x={PITCH_WIDTH - 171} y="138" width="165" height="404" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="7" />

            {radarPlayers.map((rp) => {
              const isCtrl = rp.id === homeControlledId || rp.id === awayControlledId;
              const fill = rp.team === 'home' ? homeTeam.kit.primary : awayTeam.kit.primary;
              return (
                <g key={rp.id}>
                  {isCtrl && (
                    <circle
                      cx={rp.x}
                      cy={rp.y}
                      r="32"
                      fill="none"
                      stroke={rp.id === homeControlledId ? '#38bdf8' : '#fb7185'}
                      strokeWidth="9"
                    />
                  )}
                  <circle
                    cx={rp.x}
                    cy={rp.y}
                    r="19"
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth="6"
                  />
                </g>
              );
            })}

            <circle cx={radarBall.x} cy={radarBall.y} r="18" fill="#fef08a" stroke="#000" strokeWidth="5" />
          </svg>
        </div>

        {!touchEnabled && renderNameplate('away', awayTeam, hud.awayControlled, hud.awayCharge)}
      </div>

      {/* === CONTROLS DRAWER === */}
      {showControls && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(56px + var(--safe-top))',
            right: 14,
            width: 'min(310px, 90vw)',
            maxHeight: '72dvh',
            overflowY: 'auto',
            padding: 14,
            borderRadius: 12,
            background: 'rgba(6, 12, 28, 0.96)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            pointerEvents: 'auto',
            fontSize: 12,
            lineHeight: 1.75,
            boxShadow: '0 14px 40px rgba(0,0,0,0.65)',
            zIndex: 25,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, fontWeight: 800, color: '#38bdf8' }}>
              PES CONTROLS
            </span>
            <button
              className="pes-btn-secondary"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => setShowControls(false)}
            >
              Close
            </button>
          </div>

          {touchEnabled ? (
            <>
              <div style={{ color: '#4ade80', fontWeight: 700 }}>MOBILE TOUCH PAD</div>
              <div>• Left Joystick — Dribble, Aim &amp; Move</div>
              <div>• <strong>SHOOT / PRESS</strong> — Hold to charge PES Power Gauge</div>
              <div>• <strong>PASS / SWITCH</strong> — Short Pass or Switch Defender</div>
              <div>• <strong>THRU / GK</strong> — Through Ball or GK Rush</div>
              <div>• <strong>CROSS / SLIDE</strong> — Lofted Cross or Slide Tackle</div>
              <div>• <strong>DASH</strong> — Sprint • <strong>CURL</strong> + Shoot Finesse • <strong>SKILL</strong> Feint</div>
            </>
          ) : config.mode === 'local_pvp' ? (
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
              <div><span className="pes-key">J</span> / <span className="pes-key">SPACE</span> — Short Pass / Switch (X)</div>
              <div><span className="pes-key">K</span> / <span className="pes-key">ENTER</span> — Shoot / Press Tackle (□)</div>
              <div><span className="pes-key">I</span> / <span className="pes-key">E</span> — Through Ball / GK Rush (Δ)</div>
              <div><span className="pes-key">L</span> / <span className="pes-key">Q</span> — Lofted Cross / Slide Tackle (O)</div>
              <div><span className="pes-key">C</span> + Shoot — Finesse Curled Shot</div>
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
            padding: 12,
            pointerEvents: 'auto',
            zIndex: 30,
          }}
        >
          <div className="pes-modal-card">
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(18px, 4vw, 24px)',
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

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TeamCrest team={homeTeam} size={34} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                    {homeTeam.shortName}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(26px, 6vw, 38px)',
                    fontWeight: 900,
                    padding: '4px 14px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  {hud.homeScore} - {hud.awayScore}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                    {awayTeam.shortName}
                  </span>
                  <TeamCrest team={awayTeam} size={34} />
                </div>
              </div>
            </div>

            {hud.stats.goals.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 12px',
                  marginBottom: 12,
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
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
                  <span style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8', letterSpacing: '0.08em' }}>
                    {row.label}
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: '#fb7185' }}>{row.a}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {hud.isPaused && hud.phase !== 'halftime' && hud.phase !== 'fulltime' && (
                <button className="pes-btn-primary" onClick={onTogglePause}>
                  <Play size={16} fill="currentColor" /> Resume
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
