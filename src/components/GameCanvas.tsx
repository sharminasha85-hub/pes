import React, { useEffect, useRef, useState } from 'react';
import { MatchEngine, SerializedState } from '../engine/MatchEngine';
import { PitchRenderer } from '../engine/PitchRenderer';
import {
  createEmptyInput,
  createEmptyTouchInput,
  InputManager,
  TouchInputState,
} from '../engine/InputManager';
import { MultiplayerClient } from '../network/MultiplayerClient';
import { HudSnapshot, InputState, MatchConfig } from '../types/game';
import { MatchHud } from './MatchHud';
import { TouchControls } from './TouchControls';
import { soundEngine } from '../audio/SoundEngine';

interface GameCanvasProps {
  config: MatchConfig;
  multiplayer: MultiplayerClient | null;
  remoteInputRef: React.MutableRefObject<InputState>;
  remoteStateRef: React.MutableRefObject<SerializedState | null>;
  muted: boolean;
  onToggleMute: () => void;
  onExitMenu: () => void;
}

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.innerWidth <= 900
  );
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  config,
  multiplayer,
  remoteInputRef,
  remoteStateRef,
  muted,
  onToggleMute,
  onExitMenu,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const rendererRef = useRef<PitchRenderer | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const touchInputRef = useRef<TouchInputState>(createEmptyTouchInput());

  const [rematchKey, setRematchKey] = useState(0);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => detectTouchDevice());
  const [isAttacking, setIsAttacking] = useState<boolean>(true);
  const [radarState, setRadarState] = useState<{
    players: Array<{ id: string; team: 'home' | 'away'; x: number; y: number }>;
    ball: { x: number; y: number };
    homeCtrl: string | null;
    awayCtrl: string | null;
  }>({ players: [], ball: { x: 525, y: 340 }, homeCtrl: null, awayCtrl: null });

  useEffect(() => {
    const engine = new MatchEngine(config);
    const renderer = new PitchRenderer();
    const input = new InputManager();
    input.attach();

    engineRef.current = engine;
    rendererRef.current = renderer;
    inputRef.current = input;
    setHud(engine.getHudSnapshot());

    const handleEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        engine.isPaused = !engine.isPaused;
        setHud(engine.getHudSnapshot());
      }
    };
    window.addEventListener('keydown', handleEsc);

    let rafId = 0;
    let lastTs = performance.now();
    let hudAccum = 0;
    let netAccum = 0;
    const startTs = lastTs;

    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      const timeSec = (ts - startTs) / 1000;

      const isOnlineClient = config.mode === 'online' && config.onlineRole === 'client';
      const isOnlineHost = config.mode === 'online' && config.onlineRole === 'host';
      const isLocalPvp = config.mode === 'local_pvp';

      const p1Input = input.pollP1(isLocalPvp, touchInputRef.current);

      if (isOnlineClient) {
        netAccum += dt;
        if (multiplayer && netAccum >= 0.025) {
          netAccum = 0;
          multiplayer.send({ type: 'client_input', input: p1Input });
        }
        if (remoteStateRef.current) {
          engine.applySerializedState(remoteStateRef.current);
          remoteStateRef.current = null;
        }
      } else {
        let p2Input: InputState | null = null;
        if (isLocalPvp) {
          p2Input = input.pollP2();
        } else if (isOnlineHost) {
          p2Input = { ...remoteInputRef.current };
          remoteInputRef.current.passJustPressed = false;
          remoteInputRef.current.passJustReleased = false;
          remoteInputRef.current.shootJustPressed = false;
          remoteInputRef.current.shootJustReleased = false;
          remoteInputRef.current.throughJustPressed = false;
          remoteInputRef.current.throughJustReleased = false;
          remoteInputRef.current.lobJustPressed = false;
          remoteInputRef.current.lobJustReleased = false;
          remoteInputRef.current.skillJustPressed = false;
        }

        engine.update(dt, p1Input, p2Input);

        if (isOnlineHost && multiplayer) {
          netAccum += dt;
          if (netAccum >= 0.033) {
            netAccum = 0;
            multiplayer.send({
              type: 'state_snapshot',
              state: engine.serializeState(),
            });
          }
        }
      }

      // Render HiDPI Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.max(1, Math.floor(rect.width * dpr));
        const targetH = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderer.render(ctx, engine, rect.width, rect.height, timeSec);
        }
      }

      // Update React HUD & Radar at ~20Hz
      hudAccum += dt;
      if (hudAccum >= 0.05) {
        hudAccum = 0;
        setHud(engine.getHudSnapshot());
        const myTeam = isOnlineClient ? 'away' : 'home';
        const owner = engine.getPlayerById(engine.ball.ownerId);
        setIsAttacking(!owner || owner.team === myTeam);
        setRadarState({
          players: engine.players.map((p) => ({
            id: p.id,
            team: p.team,
            x: p.x,
            y: p.y,
          })),
          ball: { x: engine.ball.x, y: engine.ball.y },
          homeCtrl: engine.homeControlledId,
          awayCtrl: engine.awayControlledId,
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleEsc);
      input.detach();
      remoteInputRef.current = createEmptyInput();
      touchInputRef.current = createEmptyTouchInput();
    };
  }, [config, rematchKey, multiplayer, remoteInputRef, remoteStateRef]);

  const handleTogglePause = () => {
    if (!engineRef.current) return;
    engineRef.current.isPaused = !engineRef.current.isPaused;
    setHud(engineRef.current.getHudSnapshot());
  };

  const handleSkipReplay = () => {
    engineRef.current?.skipReplay();
  };

  const handleContinueHalftime = () => {
    engineRef.current?.continueFromHalftime();
    if (engineRef.current) setHud(engineRef.current.getHudSnapshot());
  };

  const handleStartPenalties = () => {
    engineRef.current?.startPenaltyShootout();
    if (engineRef.current) setHud(engineRef.current.getHudSnapshot());
  };

  const handleRematch = () => {
    soundEngine.unlock();
    setRematchKey((k) => k + 1);
  };

  const showTouchPad =
    touchEnabled &&
    hud !== null &&
    !hud.isPaused &&
    hud.phase !== 'halftime' &&
    hud.phase !== 'fulltime' &&
    hud.phase !== 'goal_replay';

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: '#050a18',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={() => {
          soundEngine.unlock();
          if (engineRef.current?.phase === 'goal_replay') {
            engineRef.current.skipReplay();
          }
        }}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />

      {showTouchPad && (
        <TouchControls
          touchRef={touchInputRef}
          isAttacking={isAttacking}
          isPenalty={hud.phase === 'penalty_shootout'}
        />
      )}

      {hud && engineRef.current && (
        <MatchHud
          hud={hud}
          config={config}
          homeTeam={engineRef.current.homeTeam}
          awayTeam={engineRef.current.awayTeam}
          radarPlayers={radarState.players}
          radarBall={radarState.ball}
          homeControlledId={radarState.homeCtrl}
          awayControlledId={radarState.awayCtrl}
          muted={muted}
          touchEnabled={touchEnabled}
          onToggleTouch={() => setTouchEnabled((v) => !v)}
          onToggleMute={onToggleMute}
          onTogglePause={handleTogglePause}
          onSkipReplay={handleSkipReplay}
          onContinueHalftime={handleContinueHalftime}
          onStartPenalties={handleStartPenalties}
          onRematch={handleRematch}
          onExitMenu={onExitMenu}
        />
      )}
    </div>
  );
};
