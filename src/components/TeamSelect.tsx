import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  Copy,
  Check,
  Wifi,
  Shield,
  Zap,
  Sun,
  Moon,
  Sunset,
} from 'lucide-react';
import { FORMATIONS, TEAMS, getTeamById } from '../data/teams';
import {
  Difficulty,
  FormationId,
  GameMode,
  MatchConfig,
} from '../types/game';
import { TeamCrest, KitPreview } from './TeamCrest';
import { generateRoomCode, NetRole, NetTransport } from '../network/MultiplayerClient';

interface TeamSelectProps {
  mode: GameMode;
  onBack: () => void;
  onStartMatch: (config: MatchConfig) => void;
  // Online lobby wiring
  onlineStatus: string;
  onlineConnected: boolean;
  onlineTransport: NetTransport;
  onlineRole: NetRole;
  onlineRoomCode: string;
  onCreateOnlineRoom: (code: string) => void;
  onJoinOnlineRoom: (code: string) => void;
}

const FORMATION_LIST: FormationId[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'];
const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'regular', label: 'Regular' },
  { id: 'top_player', label: 'Top Player' },
  { id: 'superstar', label: 'Superstar' },
];

export const TeamSelect: React.FC<TeamSelectProps> = ({
  mode,
  onBack,
  onStartMatch,
  onlineStatus,
  onlineConnected,
  onlineTransport,
  onlineRole,
  onlineRoomCode,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
}) => {
  const [homeId, setHomeId] = useState('fcb');
  const [awayId, setAwayId] = useState('rma');
  const [homeFormation, setHomeFormation] = useState<FormationId>('4-3-3');
  const [awayFormation, setAwayFormation] = useState<FormationId>('4-3-3');
  const [difficulty, setDifficulty] = useState<Difficulty>('regular');
  const [matchMinutes, setMatchMinutes] = useState(4);
  const [stadiumTime, setStadiumTime] = useState<'night' | 'sunset' | 'day'>('night');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const homeTeam = getTeamById(homeId);
  const awayTeam = getTeamById(awayId);

  const handleCopy = () => {
    if (!onlineRoomCode) return;
    navigator.clipboard?.writeText(onlineRoomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleKickOff = () => {
    onStartMatch({
      mode,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeFormation,
      awayFormation,
      difficulty,
      matchMinutes,
      stadiumTime,
      onlineRole: mode === 'online' ? onlineRole : undefined,
      roomCode: mode === 'online' ? onlineRoomCode : undefined,
    });
  };

  const renderClubPicker = (
    title: string,
    selectedId: string,
    onSelect: (id: string) => void,
    formation: FormationId,
    onFormation: (f: FormationId) => void,
    accent: string
  ) => {
    const team = getTeamById(selectedId);
    return (
      <div
        style={{
          flex: '1 1 300px',
          minWidth: 0,
          width: '100%',
          padding: 16,
          borderRadius: 14,
          background: 'rgba(8, 16, 38, 0.88)',
          border: `1px solid ${accent}44`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pes)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: accent,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{team.league}</span>
        </div>

        {/* Selected club showcase */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            marginBottom: 14,
          }}
        >
          <TeamCrest team={team} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800 }}>
              {team.name}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontFamily: 'var(--font-pes)', fontSize: 12 }}>
              <span style={{ color: '#f87171' }}>ATK <strong>{team.attack}</strong></span>
              <span style={{ color: '#facc15' }}>MID <strong>{team.midfield}</strong></span>
              <span style={{ color: '#38bdf8' }}>DEF <strong>{team.defense}</strong></span>
            </div>
          </div>
          <KitPreview team={team} />
        </div>

        {/* Club selector grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {TEAMS.map((t) => {
            const active = t.id === selectedId;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onSelect(t.id);
                  onFormation(t.defaultFormation);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 4px',
                  borderRadius: 9,
                  background: active ? `${accent}24` : 'rgba(15, 23, 42, 0.7)',
                  border: active ? `1.5px solid ${accent}` : '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <TeamCrest team={t} size={30} />
                <span style={{ fontFamily: 'var(--font-pes)', fontSize: 11, fontWeight: 700 }}>
                  {t.shortName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Formation selector */}
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontFamily: 'var(--font-pes)', letterSpacing: '0.08em' }}>
            TACTICAL FORMATION — {FORMATIONS[formation].description}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {FORMATION_LIST.map((f) => (
              <button
                key={f}
                onClick={() => onFormation(f)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 7,
                  fontFamily: 'var(--font-pes)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: formation === f ? accent : 'rgba(15, 23, 42, 0.8)',
                  color: formation === f ? '#031120' : '#cbd5e1',
                  border: '1px solid rgba(148,163,184,0.22)',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const canKickOff = mode !== 'online' || (onlineRole === 'host' && onlineConnected);

  return (
    <div className="pes-screen">
      <div className="pes-grid-overlay" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1140,
          margin: '0 auto',
          padding: '22px 22px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button className="pes-btn-secondary" onClick={onBack}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 3.8vw, 20px)', fontWeight: 800, letterSpacing: '0.06em' }}>
            {mode === 'online'
              ? 'ONLINE MATCH ROOM'
              : mode === 'local_pvp'
                ? 'LOCAL 2P MATCH SETUP'
                : mode === 'penalties'
                  ? 'PENALTY SHOOTOUT SETUP'
                  : mode === 'training'
                    ? 'TRAINING GROUND SETUP'
                    : 'EXHIBITION MATCH SETUP'}
          </div>
          <div style={{ width: 64 }} />
        </div>

        {/* Online Multiplayer Room Bar */}
        {mode === 'online' && (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 18, 42, 0.92))',
              border: '1px solid rgba(34, 197, 94, 0.42)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Wifi size={22} color={onlineConnected ? '#4ade80' : '#facc15'} />
              <div>
                <div style={{ fontFamily: 'var(--font-pes)', fontWeight: 700, fontSize: 14 }}>
                  {onlineStatus || 'Create a Room or Enter a Friend\'s 6-Character Code'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Transport: {onlineTransport === 'websocket' ? 'WebSocket Server (Online/LAN)' : 'Instant Cross-Tab / Local Relay'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {onlineRoomCode ? (
                <button className="pes-btn-secondary" onClick={handleCopy}>
                  {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  ROOM: <strong style={{ color: '#facc15', fontSize: 14 }}>{onlineRoomCode}</strong>
                </button>
              ) : (
                <button
                  className="pes-btn-secondary"
                  onClick={() => onCreateOnlineRoom(generateRoomCode())}
                >
                  Create Room (Host P1)
                </button>
              )}

              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  maxLength={6}
                  style={{
                    width: 118,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    background: 'rgba(2, 6, 23, 0.85)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                />
                <button
                  className="pes-btn-secondary"
                  disabled={joinCodeInput.trim().length < 4}
                  onClick={() => onJoinOnlineRoom(joinCodeInput.trim())}
                >
                  Join (P2)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Home & Away Club Pickers */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {renderClubPicker(
            'HOME TEAM (P1)',
            homeId,
            setHomeId,
            homeFormation,
            setHomeFormation,
            '#38bdf8'
          )}
          {renderClubPicker(
            mode === 'local_pvp' || mode === 'online' ? 'AWAY TEAM (P2)' : 'AWAY TEAM (CPU)',
            awayId,
            setAwayId,
            awayFormation,
            setAwayFormation,
            '#fb7185'
          )}
        </div>

        {/* Match Settings Strip */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'rgba(8, 16, 38, 0.86)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
          }}
        >
          {/* Difficulty */}
          {(mode === 'exhibition' || mode === 'penalties') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Shield size={15} color="#38bdf8" />
              <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-pes)' }}>AI LEVEL:</span>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 7,
                    fontSize: 12,
                    fontFamily: 'var(--font-pes)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: difficulty === d.id ? '#38bdf8' : 'rgba(15, 23, 42, 0.85)',
                    color: difficulty === d.id ? '#031120' : '#cbd5e1',
                    border: '1px solid rgba(148,163,184,0.22)',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {/* Match length */}
          {mode !== 'penalties' && mode !== 'training' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Zap size={15} color="#facc15" />
              <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-pes)' }}>TIME:</span>
              {[3, 4, 6, 8].map((m) => (
                <button
                  key={m}
                  onClick={() => setMatchMinutes(m)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 7,
                    fontSize: 12,
                    fontFamily: 'var(--font-pes)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: matchMinutes === m ? '#facc15' : 'rgba(15, 23, 42, 0.85)',
                    color: matchMinutes === m ? '#031120' : '#cbd5e1',
                    border: '1px solid rgba(148,163,184,0.22)',
                  }}
                >
                  {m} MIN
                </button>
              ))}
            </div>
          )}

          {/* Stadium lighting */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {[
              { id: 'night' as const, label: 'Night', icon: Moon },
              { id: 'sunset' as const, label: 'Sunset', icon: Sunset },
              { id: 'day' as const, label: 'Day', icon: Sun },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setStadiumTime(id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontFamily: 'var(--font-pes)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: stadiumTime === id ? '#e2e8f0' : 'rgba(15, 23, 42, 0.85)',
                  color: stadiumTime === id ? '#031120' : '#cbd5e1',
                  border: '1px solid rgba(148,163,184,0.22)',
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Kick Off CTA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontSize: 16 }}>
            <TeamCrest team={homeTeam} size={32} />
            <span>{homeTeam.shortName}</span>
            <span style={{ color: '#64748b' }}>vs</span>
            <span>{awayTeam.shortName}</span>
            <TeamCrest team={awayTeam} size={32} />
          </div>

          <button
            className="pes-btn-primary"
            disabled={!canKickOff}
            onClick={handleKickOff}
            style={{ padding: '14px 36px', fontSize: 16 }}
          >
            <Play size={18} fill="currentColor" />
            {mode === 'online' && !onlineConnected
              ? 'Waiting for Opponent...'
              : mode === 'online' && onlineRole === 'client'
                ? 'Waiting for Host Kick Off...'
                : 'KICK OFF MATCH'}
          </button>
        </div>
      </div>
    </div>
  );
};

