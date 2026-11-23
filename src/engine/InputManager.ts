import { InputState } from '../types/game';

export function createEmptyInput(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    sprint: false,
    finesse: false,
    passHeld: false,
    passJustPressed: false,
    passJustReleased: false,
    throughHeld: false,
    throughJustPressed: false,
    throughJustReleased: false,
    shootHeld: false,
    shootJustPressed: false,
    shootJustReleased: false,
    lobHeld: false,
    lobJustPressed: false,
    lobJustReleased: false,
    skillJustPressed: false,
  };
}

interface PrevButtons {
  pass: boolean;
  through: boolean;
  shoot: boolean;
  lob: boolean;
  skill: boolean;
}

/**
 * Unified Keyboard + Gamepad input poller supporting:
 * - P1 (Solo / Online): WASD or Arrow Keys + J/Space (Pass), K/Enter (Shoot), I/E (Through), L/Q (Lob/Slide), Shift (Sprint), C (Finesse), U/F (Skill Move)
 * - Local 2P PvP:
 *     P1: WASD + F (Pass), G (Shoot), R (Through), T (Lob/Slide), LeftShift (Sprint), V (Finesse), E (Skill)
 *     P2: Arrow Keys + Numpad1/J (Pass), Numpad2/K (Shoot), Numpad4/I (Through), Numpad3/L (Lob/Slide), RightShift/M (Sprint), N (Finesse), U (Skill)
 */
export class InputManager {
  private keys = new Set<string>();
  private p1Prev: PrevButtons = { pass: false, through: false, shoot: false, lob: false, skill: false };
  private p2Prev: PrevButtons = { pass: false, through: false, shoot: false, lob: false, skill: false };
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
      ) {
        e.preventDefault();
      }
      this.keys.add(e.code);
    };
    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    this.boundBlur = () => {
      this.keys.clear();
    };
  }

  public attach() {
    window.addEventListener('keydown', this.boundKeyDown, { passive: false });
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
  }

  public detach() {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
  }

  private has(...codes: string[]): boolean {
    for (const c of codes) {
      if (this.keys.has(c)) return true;
    }
    return false;
  }

  public pollP1(isLocalPvp: boolean): InputState {
    let moveX = 0;
    let moveY = 0;

    if (isLocalPvp) {
      if (this.has('KeyA')) moveX -= 1;
      if (this.has('KeyD')) moveX += 1;
      if (this.has('KeyW')) moveY -= 1;
      if (this.has('KeyS')) moveY += 1;
    } else {
      if (this.has('KeyA', 'ArrowLeft')) moveX -= 1;
      if (this.has('KeyD', 'ArrowRight')) moveX += 1;
      if (this.has('KeyW', 'ArrowUp')) moveY -= 1;
      if (this.has('KeyS', 'ArrowDown')) moveY += 1;
    }

    let sprint = isLocalPvp
      ? this.has('ShiftLeft')
      : this.has('ShiftLeft', 'ShiftRight');
    let finesse = isLocalPvp ? this.has('KeyV') : this.has('KeyC');
    let passHeld = isLocalPvp
      ? this.has('KeyF', 'Space')
      : this.has('KeyJ', 'Space', 'KeyX');
    let shootHeld = isLocalPvp
      ? this.has('KeyG')
      : this.has('KeyK', 'Enter', 'KeyZ');
    let throughHeld = isLocalPvp
      ? this.has('KeyR')
      : this.has('KeyI', 'KeyE');
    let lobHeld = isLocalPvp
      ? this.has('KeyT')
      : this.has('KeyL', 'KeyQ');
    let skillHeld = isLocalPvp
      ? this.has('KeyE')
      : this.has('KeyU', 'KeyF');

    // Gamepad 0 support (PlayStation / Xbox PES classic layout!)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[0];
    if (gp) {
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.18) {
        moveX = ax;
        moveY = ay;
      }
      if (gp.buttons[0]?.pressed) passHeld = true; // Cross / A
      if (gp.buttons[2]?.pressed) shootHeld = true; // Square / X
      if (gp.buttons[3]?.pressed) throughHeld = true; // Triangle / Y
      if (gp.buttons[1]?.pressed) lobHeld = true; // Circle / B
      if (gp.buttons[5]?.pressed) sprint = true; // R1 / RB
      if (gp.buttons[7]?.pressed) finesse = true; // R2 / RT
      if (gp.buttons[4]?.pressed) skillHeld = true; // L1 / LB
    }

    const mag = Math.hypot(moveX, moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }

    const input: InputState = {
      moveX,
      moveY,
      sprint,
      finesse,
      passHeld,
      passJustPressed: passHeld && !this.p1Prev.pass,
      passJustReleased: !passHeld && this.p1Prev.pass,
      throughHeld,
      throughJustPressed: throughHeld && !this.p1Prev.through,
      throughJustReleased: !throughHeld && this.p1Prev.through,
      shootHeld,
      shootJustPressed: shootHeld && !this.p1Prev.shoot,
      shootJustReleased: !shootHeld && this.p1Prev.shoot,
      lobHeld,
      lobJustPressed: lobHeld && !this.p1Prev.lob,
      lobJustReleased: !lobHeld && this.p1Prev.lob,
      skillJustPressed: skillHeld && !this.p1Prev.skill,
    };

    this.p1Prev = {
      pass: passHeld,
      through: throughHeld,
      shoot: shootHeld,
      lob: lobHeld,
      skill: skillHeld,
    };

    return input;
  }

  public pollP2(): InputState {
    let moveX = 0;
    let moveY = 0;
    if (this.has('ArrowLeft')) moveX -= 1;
    if (this.has('ArrowRight')) moveX += 1;
    if (this.has('ArrowUp')) moveY -= 1;
    if (this.has('ArrowDown')) moveY += 1;

    let sprint = this.has('ShiftRight', 'KeyM', 'Numpad0');
    let finesse = this.has('KeyN', 'NumpadDecimal');
    let passHeld = this.has('KeyJ', 'Numpad1');
    let shootHeld = this.has('KeyK', 'Numpad2', 'Enter');
    let throughHeld = this.has('KeyI', 'Numpad4');
    let lobHeld = this.has('KeyL', 'Numpad3');
    let skillHeld = this.has('KeyU', 'Numpad5');

    // Gamepad 1 support
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[1];
    if (gp) {
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.18) {
        moveX = ax;
        moveY = ay;
      }
      if (gp.buttons[0]?.pressed) passHeld = true;
      if (gp.buttons[2]?.pressed) shootHeld = true;
      if (gp.buttons[3]?.pressed) throughHeld = true;
      if (gp.buttons[1]?.pressed) lobHeld = true;
      if (gp.buttons[5]?.pressed) sprint = true;
      if (gp.buttons[7]?.pressed) finesse = true;
      if (gp.buttons[4]?.pressed) skillHeld = true;
    }

    const mag = Math.hypot(moveX, moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }

    const input: InputState = {
      moveX,
      moveY,
      sprint,
      finesse,
      passHeld,
      passJustPressed: passHeld && !this.p2Prev.pass,
      passJustReleased: !passHeld && this.p2Prev.pass,
      throughHeld,
      throughJustPressed: throughHeld && !this.p2Prev.through,
      throughJustReleased: !throughHeld && this.p2Prev.through,
      shootHeld,
      shootJustPressed: shootHeld && !this.p2Prev.shoot,
      shootJustReleased: !shootHeld && this.p2Prev.shoot,
      lobHeld,
      lobJustPressed: lobHeld && !this.p2Prev.lob,
      lobJustReleased: !lobHeld && this.p2Prev.lob,
      skillJustPressed: skillHeld && !this.p2Prev.skill,
    };

    this.p2Prev = {
      pass: passHeld,
      through: throughHeld,
      shoot: shootHeld,
      lob: lobHeld,
      skill: skillHeld,
    };

    return input;
  }
}

