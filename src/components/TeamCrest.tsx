import React from 'react';
import { TeamData } from '../types/game';

interface TeamCrestProps {
  team: TeamData;
  size?: number;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({ team, size = 36 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {/* Classic football shield */}
      <path
        d="M24 3L41 9V23C41 33.8 33.4 41.8 24 45C14.6 41.8 7 33.8 7 23V9L24 3Z"
        fill={team.crestBg}
        stroke={team.crestAccent}
        strokeWidth="2.8"
      />
      {/* Diagonal highlight */}
      <path
        d="M24 5.2L38.5 10.3V22.8C38.5 31.8 32.1 38.7 24 41.7V5.2Z"
        fill={team.crestAccent}
        fillOpacity="0.22"
      />
      {/* Club initials */}
      <text
        x="24"
        y="27"
        textAnchor="middle"
        fill={team.id === 'rma' ? '#0f172a' : '#ffffff'}
        fontFamily="Chakra Petch, sans-serif"
        fontWeight="800"
        fontSize="12"
        letterSpacing="0.5"
      >
        {team.shortName}
      </text>
    </svg>
  );
};

export const KitPreview: React.FC<{ team: TeamData }> = ({ team }) => {
  const { kit } = team;
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <defs>
        <clipPath id={`shirt_${team.id}`}>
          <path d="M14 10L6 16L10 23L14 20V41H34V20L38 23L42 16L34 10L29 12.5C26 14 22 14 19 12.5L14 10Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#shirt_${team.id})`}>
        <rect x="4" y="8" width="40" height="36" fill={kit.primary} />
        {kit.pattern === 'vertical' && (
          <>
            <rect x="16" y="8" width="4.5" height="36" fill={kit.secondary} />
            <rect x="27.5" y="8" width="4.5" height="36" fill={kit.secondary} />
          </>
        )}
        {kit.pattern === 'sleeves' && (
          <>
            <rect x="4" y="8" width="11" height="20" fill={kit.secondary} />
            <rect x="33" y="8" width="11" height="20" fill={kit.secondary} />
          </>
        )}
        {kit.pattern === 'sash' && (
          <path d="M10 42L38 8" stroke={kit.secondary} strokeWidth="6" />
        )}
      </g>
      <path
        d="M14 10L6 16L10 23L14 20V41H34V20L38 23L42 16L34 10L29 12.5C26 14 22 14 19 12.5L14 10Z"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.5"
      />
    </svg>
  );
};

