import React, { useRef, useState } from 'react';
import { TouchInputState } from '../engine/InputManager';
import { soundEngine } from '../audio/SoundEngine';

interface TouchControlsProps {
  touchRef: React.MutableRefObject<TouchInputState>;
  isAttacking: boolean;
  isPenalty: boolean;
}

type ActionKey = 'passHeld' | 'shootHeld' | 'throughHeld' | 'lobHeld' | 'sprint' | 'finesse' | 'skillHeld';

export const TouchControls: React.FC<TouchControlsProps> = ({
  touchRef,
  isAttacking,
  isPenalty,
}) => {
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [activeButtons, setActiveButtons] = useState<Record<ActionKey, boolean>>({
    passHeld: false,
    shootHeld: false,
    throughHeld: false,
    lobHeld: false,
    sprint: false,
    finesse: false,
    skillHeld: false,
  });

  const updateJoystick = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    setKnobPos({ x: dx, y: dy });
    const nx = dx / maxR;
    const ny = dy / maxR;
    touchRef.current.moveX = Math.abs(nx) < 0.08 ? 0 : nx;
    touchRef.current.moveY = Math.abs(ny) < 0.08 ? 0 : ny;
  };

  const resetJoystick = () => {
    joyPointerId.current = null;
    setKnobPos({ x: 0, y: 0 });
    touchRef.current.moveX = 0;
    touchRef.current.moveY = 0;
  };

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    soundEngine.unlock();
    if (joyPointerId.current !== null) return;
    joyPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.preventDefault();
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.preventDefault();
    resetJoystick();
  };

  const bindAction = (key: ActionKey) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      soundEngine.unlock();
      e.currentTarget.setPointerCapture(e.pointerId);
      touchRef.current[key] = true;
      setActiveButtons((prev) => ({ ...prev, [key]: true }));
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      touchRef.current[key] = false;
      setActiveButtons((prev) => ({ ...prev, [key]: false }));
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      touchRef.current[key] = false;
      setActiveButtons((prev) => ({ ...prev, [key]: false }));
    },
  });

  return (
    <div className="pes-touch-layer">
      {/* LEFT: Virtual PES Analog Joystick */}
      <div
        className="pes-joystick-zone"
        onPointerDown={handleJoyDown}
        onPointerMove={handleJoyMove}
        onPointerUp={handleJoyUp}
        onPointerCancel={handleJoyUp}
      >
        <div className="pes-joystick-base" ref={joyBaseRef}>
          {/* Subtle 4-way directional ticks */}
          <div
            style={{
              position: 'absolute',
              inset: 10,
              borderRadius: '50%',
              border: '1px dashed rgba(255,255,255,0.18)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="pes-joystick-knob"
            style={{
              transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* RIGHT: Authentic PES Mobile Contextual Action Pad */}
      <div className="pes-action-pad">
        {/* SHOOT / PRESS (Primary big button, bottom-right) */}
        <button
          type="button"
          className={`pes-touch-btn ${activeButtons.shootHeld ? 'active' : ''}`}
          style={{
            right: 4,
            bottom: 4,
            width: 66,
            height: 66,
            fontSize: 11,
            background: isAttacking || isPenalty
              ? 'radial-gradient(circle at 35% 30%, rgba(244,63,94,0.88), rgba(159,18,57,0.82))'
              : 'radial-gradient(circle at 35% 30%, rgba(249,115,22,0.88), rgba(154,52,18,0.82))',
          }}
          {...bindAction('shootHeld')}
        >
          {isPenalty ? 'SHOOT' : isAttacking ? 'SHOOT' : 'PRESS'}
        </button>

        {/* PASS / SWITCH (Bottom-left of action pad) */}
        <button
          type="button"
          className={`pes-touch-btn ${activeButtons.passHeld ? 'active' : ''}`}
          style={{
            right: 80,
            bottom: 10,
            width: 60,
            height: 60,
            fontSize: 10.5,
            background: 'radial-gradient(circle at 35% 30%, rgba(14,165,233,0.86), rgba(3,105,161,0.82))',
          }}
          {...bindAction('passHeld')}
        >
          {isAttacking ? 'PASS' : 'SWITCH'}
        </button>

        {/* THROUGH / GK RUSH (Upper-left) */}
        <button
          type="button"
          className={`pes-touch-btn ${activeButtons.throughHeld ? 'active' : ''}`}
          style={{
            right: 112,
            bottom: 78,
            width: 54,
            height: 54,
            fontSize: 9.5,
            background: 'radial-gradient(circle at 35% 30%, rgba(34,197,94,0.84), rgba(21,128,61,0.8))',
          }}
          {...bindAction('throughHeld')}
        >
          {isAttacking ? 'THRU' : 'GK'}
        </button>

        {/* CROSS / SLIDE TACKLE (Upper-middle) */}
        <button
          type="button"
          className={`pes-touch-btn ${activeButtons.lobHeld ? 'active' : ''}`}
          style={{
            right: 54,
            bottom: 108,
            width: 54,
            height: 54,
            fontSize: 9.5,
            background: 'radial-gradient(circle at 35% 30%, rgba(234,179,8,0.86), rgba(161,98,7,0.82))',
          }}
          {...bindAction('lobHeld')}
        >
          {isAttacking ? 'CROSS' : 'SLIDE'}
        </button>

        {/* DASH / SPRINT (Top-right shoulder) */}
        <button
          type="button"
          className={`pes-touch-btn ${activeButtons.sprint ? 'active' : ''}`}
          style={{
            right: 2,
            bottom: 84,
            width: 50,
            height: 50,
            fontSize: 9.5,
            background: 'radial-gradient(circle at 35% 30%, rgba(99,102,241,0.86), rgba(55,48,163,0.82))',
          }}
          {...bindAction('sprint')}
        >
          DASH
        </button>

        {/* FINESSE CURVE / SKILL FEINT mini pills above pad */}
        {isAttacking && !isPenalty && (
          <>
            <button
              type="button"
              className={`pes-touch-btn ${activeButtons.finesse ? 'active' : ''}`}
              style={{
                right: 130,
                bottom: 138,
                width: 44,
                height: 44,
                fontSize: 8.5,
                background: 'rgba(14, 165, 233, 0.72)',
              }}
              {...bindAction('finesse')}
            >
              CURL
            </button>
            <button
              type="button"
              className={`pes-touch-btn ${activeButtons.skillHeld ? 'active' : ''}`}
              style={{
                right: 2,
                bottom: 142,
                width: 44,
                height: 44,
                fontSize: 8.5,
                background: 'rgba(168, 85, 247, 0.78)',
              }}
              {...bindAction('skillHeld')}
            >
              SKILL
            </button>
          </>
        )}
      </div>
    </div>
  );
};
