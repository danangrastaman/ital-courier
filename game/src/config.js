// Orbital Courier — tuning constants and palette.
// One job: every number the game balances on, in one place.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// Physics (per second units, tuned for a 1/60 fixed step).
export const GRAVITY = 52000; // gravitational constant used for every planet
export const THRUST = 260; // acceleration from the main thruster
export const BRAKE = 320; // deceleration from the brake key
export const MAX_SPEED = 520;
export const DRAG = 0.12; // gentle space drag so the ship settles
export const FUEL_MAX = 100;
export const FUEL_DRAIN = 9; // fuel per second of thrust
export const FUEL_BRAKE_DRAIN = 4; // fuel per second of braking
export const SLINGSHOT_POWER = 2.4; // release velocity per dragged pixel
export const SLINGSHOT_MAX = 560;
export const SHIP_RADIUS = 14;
export const PICKUP_RADIUS = 34;
export const DELIVER_RADIUS = 46;
export const HULL_MAX = 3;
export const BOUNCE = 0.55; // velocity kept after a planet bounce
export const INVULN_TIME = 2.0; // seconds of protection after a hit

// Sectors and deliveries.
export const SECTORS = [
  { name: 'SECTOR 1 · DRIFTWOOD REACH', deliveries: 3, planets: 2, asteroids: 5, flareEvery: 34 },
  { name: 'SECTOR 2 · EMBER BELT', deliveries: 4, planets: 3, asteroids: 8, flareEvery: 28 },
  { name: 'SECTOR 3 · THE LONG NIGHT', deliveries: 5, planets: 4, asteroids: 11, flareEvery: 22 },
];
export const TOTAL_DELIVERIES = SECTORS.reduce((n, s) => n + s.deliveries, 0);

// Scoring.
export const CREDIT_DELIVERY = 100;
export const CREDIT_TIME_BONUS = 50; // scaled by how fast the delivery was
export const CREDIT_FUEL_BONUS = 30; // scaled by fuel left at delivery
export const COMBO_STEP = 0.25; // +25% per clean delivery in a row, capped below

// Asteroids and flares.
export const ASTEROID_MIN_R = 10;
export const ASTEROID_MAX_R = 26;
export const FLARE_WARN = 3.0; // seconds of warning before the flare ring
export const FLARE_SPEED = 420; // ring expansion, px per second

// Palette — deep indigo space, warm amber cargo, cool teal stations.
export const COLORS = {
  spaceTop: '#070b24',
  spaceBottom: '#120a2e',
  star: '#e8ecff',
  nebulaA: 'rgba(88, 60, 220, 0.20)',
  nebulaB: 'rgba(20, 160, 170, 0.14)',
  nebulaC: 'rgba(255, 140, 60, 0.10)',
  hud: '#dfe6ff',
  hudDim: '#8b96c9',
  amber: '#ffb347',
  amberDeep: '#ff7a2f',
  teal: '#3fe0c5',
  tealDeep: '#0f8f7d',
  danger: '#ff5a6e',
  hull: '#ff6b81',
  fuel: '#ffd166',
  panel: 'rgba(8, 12, 34, 0.82)',
  panelEdge: 'rgba(150, 170, 255, 0.35)',
  title: '#ffe9b0',
};

// Upgrades offered between sectors: pick one of three.
export const UPGRADES = [
  {
    id: 'tank',
    name: 'BIG TANK',
    icon: '⛽',
    desc: '+40 max fuel. Longer burns, longer routes.',
    apply: (ship) => { ship.fuelMax += 40; ship.fuel = ship.fuelMax; },
  },
  {
    id: 'plating',
    name: 'ABLATIVE PLATING',
    icon: '🛡',
    desc: '+1 hull (max 5). Survive one more hard hit.',
    apply: (ship) => { ship.hullMax = Math.min(5, ship.hullMax + 1); ship.hull += 1; },
  },
  {
    id: 'thrusters',
    name: 'ION THRUSTERS',
    icon: '🚀',
    desc: '+25% thrust, −15% fuel use. Faster, cheaper burns.',
    apply: (ship) => { ship.thrustMul *= 1.25; ship.fuelMul *= 0.85; },
  },
  {
    id: 'magnet',
    name: 'MAGNET SCOOP',
    icon: '🧲',
    desc: '+70% pickup radius. Grab cargo from farther away.',
    apply: (ship) => { ship.pickupMul *= 1.7; },
  },
  {
    id: 'gyro',
    name: 'GYRO BRAKES',
    icon: '🛑',
    desc: 'Brakes twice as strong. Stop on a dime near stations.',
    apply: (ship) => { ship.brakeMul *= 2; },
  },
  {
    id: 'cells',
    name: 'SPARE CELLS',
    icon: '🔋',
    desc: 'Fuel cells drift closer to your route from now on.',
    apply: (ship) => { ship.cellBonus += 1; },
  },
];

export const BEST_KEY = 'orbital-courier-best';
