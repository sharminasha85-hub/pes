# PES 2026 — Pro Evolution Football (React + TypeScript)

An online Pro Evolution Soccer (PES) style football game built with **React, TypeScript, Vite, and HTML5 Canvas** featuring articulated 11v11 player animations, power-gauge shooting, finesse curl physics, goal celebrations, automatic slow-motion instant replays, procedural stadium audio, and online room multiplayer.

## Features
- **11v11 PES Match Engine**: 8 clubs, 4 tactical formations (`4-3-3`, `4-4-2`, `4-2-3-1`, `3-5-2`), smart attacking runs, goalkeeper diving saves, woodwork deflections, and dynamic rippling goal nets.
- **Iconic Scoring & Instant Replays**: PES power gauge (under-foot & HUD), curled finesse shots, headers & volleys, animated goal celebrations (knee slide, airplane run, fist-pump jump), broadcast GOAL!! slam banner, and automatic 0.5x slow-motion instant replays.
- **Game Modes**: Kick Off (vs CPU), Online Match (6-character Room Codes via WebSocket or cross-tab relay), Local 2P PvP (keyboard or dual gamepads), Penalty Shootout, and Free Training.
- **Procedural Web Audio**: Stadium crowd ambience, referee whistles, ball strikes, slide tackles, goalpost clangs, net swishes, and goal roars.

## Getting Started
```bash
npm install
npm run dev
```

For cross-device / LAN online multiplayer via WebSocket:
```bash
npm run server
```

## Controls (Solo / Online / Gamepad)
| Action | Keys |
|---|---|
| Move / Aim | `WASD` or `Arrow Keys` |
| Sprint (R1) | `Shift` |
| Short Pass / Switch Player (X) | `J` or `Space` |
| Shoot / Press & Tackle (□) | `K` or `Enter` |
| Finesse Curl Shot (R2 + □) | Hold `C` + Shoot |
| Through Ball / GK Rush (Δ) | `I` or `E` |
| Lofted Cross / Slide Tackle (O) | `L` or `Q` |
| Skill Move Feint | `F` or `U` |
| Pause | `Esc` |
