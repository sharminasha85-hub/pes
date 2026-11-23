import React, { useEffect, useRef, useState } from 'react';
import { GameMode, InputState, MatchConfig } from './types/game';
import { MainMenu } from './components/MainMenu';
import { TeamSelect } from './components/TeamSelect';
import { GameCanvas } from './components/GameCanvas';
import { soundEngine } from './audio/SoundEngine';
import {
  MultiplayerClient,
  NetRole,
  NetTransport,
} from './network/MultiplayerClient';
import { createEmptyInput } from './engine/InputManager';
import { SerializedState } from './engine/MatchEngine';

type Screen = 'menu' | 'setup' | 'match';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('exhibition');
  const [matchConfig, setMatchConfig] = useState<MatchConfig | null>(null);
  const [muted, setMuted] = useState(false);

  // Online multiplayer state
  const mpRef = useRef<MultiplayerClient | null>(null);
  const remoteInputRef = useRef<InputState>(createEmptyInput());
  const remoteStateRef = useRef<SerializedState | null>(null);

  const [onlineStatus, setOnlineStatus] = useState('');
  const [onlineConnected, setOnlineConnected] = useState(false);
  const [onlineTransport, setOnlineTransport] = useState<NetTransport>('broadcast_channel');
  const [onlineRole, setOnlineRole] = useState<NetRole>('host');
  const [onlineRoomCode, setOnlineRoomCode] = useState('');

  useEffect(() => {
    return () => {
      mpRef.current?.disconnect();
    };
  }, []);

  const ensureMpClient = () => {
    if (!mpRef.current) {
      mpRef.current = new MultiplayerClient({
        onStatus: (status, connected, transport) => {
          setOnlineStatus(status);
          setOnlineConnected(connected);
          setOnlineTransport(transport);
        },
        onStartMatch: (cfg) => {
          setMatchConfig({ ...cfg, onlineRole: 'client' });
          setScreen('match');
        },
        onClientInput: (input) => {
          remoteInputRef.current = input;
        },
        onStateSnapshot: (state) => {
          remoteStateRef.current = state;
        },
        onPeerLeft: () => {
          setOnlineConnected(false);
          setOnlineStatus('Opponent disconnected from room.');
        },
      });
    }
    return mpRef.current;
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const handleSelectMode = (selected: GameMode) => {
    setMode(selected);
    setScreen('setup');
  };

  const handleCreateOnlineRoom = (code: string) => {
    setOnlineRole('host');
    setOnlineRoomCode(code);
    setOnlineConnected(false);
    ensureMpClient().connect(code, 'host');
  };

  const handleJoinOnlineRoom = (code: string) => {
    setOnlineRole('client');
    setOnlineRoomCode(code);
    setOnlineConnected(false);
    ensureMpClient().connect(code, 'client');
  };

  const handleStartMatch = (cfg: MatchConfig) => {
    soundEngine.unlock();
    if (cfg.mode === 'online' && cfg.onlineRole === 'host' && mpRef.current) {
      mpRef.current.send({ type: 'start_match', config: cfg });
    }
    setMatchConfig(cfg);
    setScreen('match');
  };

  const handleExitToMenu = () => {
    mpRef.current?.disconnect();
    mpRef.current = null;
    setOnlineConnected(false);
    setOnlineRoomCode('');
    setOnlineStatus('');
    setMatchConfig(null);
    setScreen('menu');
  };

  if (screen === 'menu') {
    return (
      <MainMenu
        onSelectMode={handleSelectMode}
        muted={muted}
        onToggleMute={handleToggleMute}
      />
    );
  }

  if (screen === 'setup') {
    return (
      <TeamSelect
        mode={mode}
        onBack={handleExitToMenu}
        onStartMatch={handleStartMatch}
        onlineStatus={onlineStatus}
        onlineConnected={onlineConnected}
        onlineTransport={onlineTransport}
        onlineRole={onlineRole}
        onlineRoomCode={onlineRoomCode}
        onCreateOnlineRoom={handleCreateOnlineRoom}
        onJoinOnlineRoom={handleJoinOnlineRoom}
      />
    );
  }

  if (screen === 'match' && matchConfig) {
    return (
      <GameCanvas
        config={matchConfig}
        multiplayer={mpRef.current}
        remoteInputRef={remoteInputRef}
        remoteStateRef={remoteStateRef}
        muted={muted}
        onToggleMute={handleToggleMute}
        onExitMenu={handleExitToMenu}
      />
    );
  }

  return null;
}

