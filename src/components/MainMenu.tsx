import React from 'react';
import {
  Globe,
  Trophy,
  Users,
  Crosshair,
  Dumbbell,
  Volume2,
  VolumeX,
  Gamepad2,
} from 'lucide-react';
import { GameMode } from '../types/game';
import { soundEngine } from '../audio/SoundEngine';

interface MainMenuProps {
  onSelectMode: (mode: GameMode) => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSelectMode,
  muted,
  onToggleMute,
}) => {
  const handlePick = (mode: GameMode) => {
    soundEngine.unlock();
    onSelectMode(mode);
  };

  return (
    <div className="pes-screen">
      <div className="pes-grid-overlay" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1120,
          margin: '0 auto',
          padding: '32px 24px 40px',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 28,
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="pes-badge-gold">
            <Trophy size={13} />
            E-FOOTBALL • PRO EVOLUTION ENGINE
          </div>

          <button className="pes-btn-secondary" onClick={onToggleMute}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {muted ? 'Audio Muted' : 'Stadium Audio On'}
          </button>
        </div>

        {/* Hero title */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <h1 className="pes-brand-title" style={{ fontSize: 'clamp(42px, 6.2vw, 76px)', lineHeight: 1.05 }}>
            PES 2026
          </h1>
          <p
            style={{
              marginTop: 10,
              fontFamily: 'var(--font-pes)',
              fontSize: 17,
              letterSpacing: '0.18em',
              color: '#94a3b8',
              textTransform: 'uppercase',
            }}
          >
            Authentic 11v11 Animations • Power Gauge Shooting • Instant Goal Replays
          </p>
        </div>

        {/* Mode Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
          }}
        >
          <button
            className="pes-mode-card"
            style={{ ['--card-accent' as string]: '#00d4ff' }}
            onClick={() => handlePick('exhibition')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Trophy size={28} color="#00d4ff" />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-pes)', color: '#38bdf8', fontWeight: 700 }}>
                11v11 vs AI
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                KICK OFF
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
                Classic PES exhibition match against Superstar tactical AI with full replays.
              </div>
            </div>
          </button>

          <button
            className="pes-mode-card"
            style={{ ['--card-accent' as string]: '#22c55e' }}
            onClick={() => handlePick('online')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Globe size={28} color="#22c55e" />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-pes)', color: '#4ade80', fontWeight: 700 }}>
                LIVE ROOMS
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                ONLINE MATCH
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
                Create or join a 6-digit Match Room to play real-time PvP online or across tabs.
              </div>
            </div>
          </button>

          <button
            className="pes-mode-card"
            style={{ ['--card-accent' as string]: '#facc15' }}
            onClick={() => handlePick('local_pvp')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Users size={28} color="#facc15" />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-pes)', color: '#fde047', fontWeight: 700 }}>
                2P VERSUS
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                LOCAL 2P PVP
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
                Head-to-head PES rivalry on one keyboard or dual USB/Bluetooth gamepads.
              </div>
            </div>
          </button>

          <button
            className="pes-mode-card"
            style={{ ['--card-accent' as string]: '#f43f5e' }}
            onClick={() => handlePick('penalties')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Crosshair size={28} color="#f43f5e" />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-pes)', color: '#fb7185', fontWeight: 700 }}>
                SHOOTOUT
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                PENALTIES
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
                5-round shootout drama — aim top corners, time the gauge, and dive to save!
              </div>
            </div>
          </button>

          <button
            className="pes-mode-card"
            style={{ ['--card-accent' as string]: '#a855f7' }}
            onClick={() => handlePick('training')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Dumbbell size={28} color="#a855f7" />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-pes)', color: '#c084fc', fontWeight: 700 }}>
                PRACTICE
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                FREE TRAINING
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
                Master curled finesse shots, lofted crosses, volleys, and step-over skill moves.
              </div>
            </div>
          </button>
        </div>

        {/* Classic PES Controls Strip */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px 20px',
            padding: '14px 20px',
            borderRadius: 12,
            background: 'rgba(8, 15, 36, 0.82)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            fontSize: 12.5,
            color: '#cbd5e1',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-pes)' }}>
            <Gamepad2 size={15} /> PES CONTROLS:
          </span>
          <span><span className="pes-key">WASD</span> / <span className="pes-key">↑↓←→</span> Move</span>
          <span><span className="pes-key">SHIFT</span> Sprint</span>
          <span><span className="pes-key">J</span> / <span className="pes-key">SPACE</span> Pass / Switch</span>
          <span><span className="pes-key">K</span> / <span className="pes-key">ENTER</span> Shoot / Press</span>
          <span><span className="pes-key">I</span> / <span className="pes-key">E</span> Through Ball / GK Rush</span>
          <span><span className="pes-key">L</span> / <span className="pes-key">Q</span> Cross / Slide Tackle</span>
          <span><span className="pes-key">C</span> + Shoot Finesse Curl</span>
          <span><span className="pes-key">F</span> Skill Feint</span>
        </div>
      </div>
    </div>
  );
};

