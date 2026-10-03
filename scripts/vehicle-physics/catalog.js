'use strict';

// Maintained source of truth for vehicle identity and physics intent.
// Raw third-party handling values are audit evidence only; they never decide drivetrain.

const TIERS = {
  utility_slow: { targetKmh: 135, zeroTo100: 18.0, driveForce: 0.18, gears: 5, shift: 1.55 },
  commercial: { targetKmh: 150, zeroTo100: 15.0, driveForce: 0.21, gears: 6, shift: 1.65 },
  economy: { targetKmh: 175, zeroTo100: 11.5, driveForce: 0.235, gears: 5, shift: 1.85 },
  civilian: { targetKmh: 195, zeroTo100: 9.0, driveForce: 0.265, gears: 6, shift: 2.0 },
  warm: { targetKmh: 215, zeroTo100: 7.0, driveForce: 0.30, gears: 6, shift: 2.2 },
  sport: { targetKmh: 238, zeroTo100: 5.4, driveForce: 0.34, gears: 6, shift: 2.5 },
  sport_high: { targetKmh: 255, zeroTo100: 4.4, driveForce: 0.37, gears: 7, shift: 2.75 },
  performance_sedan: { targetKmh: 265, zeroTo100: 3.8, driveForce: 0.385, gears: 8, shift: 2.85 },
  super: { targetKmh: 282, zeroTo100: 3.2, driveForce: 0.415, gears: 7, shift: 3.05 },
  hyper: { targetKmh: 305, zeroTo100: 2.7, driveForce: 0.445, gears: 7, shift: 3.25 },
  performance_suv: { targetKmh: 250, zeroTo100: 4.2, driveForce: 0.375, gears: 8, shift: 2.65 },
  offroad: { targetKmh: 185, zeroTo100: 7.5, driveForce: 0.30, gears: 6, shift: 1.95 },
  pursuit: { targetKmh: 260, zeroTo100: 4.2, driveForce: 0.38, gears: 7, shift: 2.8 },
  pursuit_suv: { targetKmh: 235, zeroTo100: 5.2, driveForce: 0.35, gears: 7, shift: 2.55 },
  motorcycle: { targetKmh: 245, zeroTo100: 3.6, driveForce: 0.38, gears: 6, shift: 2.8 },
};

const ARCHETYPES = {
  economy_fwd: { category: 'economy', body: 'compact', drivetrain: 'fwd', mass: 1180, tier: 'economy', drag: 8.2, brake: 0.72, steer: 39, grip: 2.18, gripGap: 0.20, lowLoss: 1.02, suspension: [1.85, 1.25, 2.2, 0.11, -0.13], antiRoll: 0.72, roll: [0.34, 0.35], comZ: -0.04, inertia: [1.0, 1.25, 1.35] },
  hot_hatch_fwd: { category: 'sport', body: 'hatchback', drivetrain: 'fwd', mass: 1320, tier: 'warm', drag: 7.2, brake: 0.88, steer: 39, grip: 2.38, gripGap: 0.20, lowLoss: 1.05, suspension: [2.15, 1.5, 2.65, 0.09, -0.11], antiRoll: 1.0, roll: [0.31, 0.32], comZ: -0.07, inertia: [1.0, 1.32, 1.42] },
  sedan_rwd: { category: 'sedan', body: 'sedan', drivetrain: 'rwd', mass: 1650, tier: 'civilian', drag: 7.4, brake: 0.84, steer: 38, grip: 2.32, gripGap: 0.21, lowLoss: 1.18, suspension: [2.05, 1.45, 2.55, 0.10, -0.13], antiRoll: 0.88, roll: [0.34, 0.35], comZ: -0.07, inertia: [1.0, 1.42, 1.48] },
  sedan_awd: { category: 'sedan', body: 'sedan', drivetrain: 'awd_rear', mass: 1750, tier: 'warm', drag: 7.2, brake: 0.9, steer: 38, grip: 2.42, gripGap: 0.19, lowLoss: 1.04, suspension: [2.2, 1.55, 2.75, 0.09, -0.12], antiRoll: 1.02, roll: [0.32, 0.33], comZ: -0.08, inertia: [1.0, 1.45, 1.5] },
  performance_sedan_rwd: { category: 'performance_sedan', body: 'sedan', drivetrain: 'rwd', mass: 1850, tier: 'performance_sedan', drag: 6.5, brake: 1.08, steer: 37.5, grip: 2.58, gripGap: 0.22, lowLoss: 1.28, suspension: [2.45, 1.75, 3.05, 0.075, -0.105], antiRoll: 1.28, roll: [0.275, 0.29], comZ: -0.105, inertia: [1.0, 1.52, 1.58] },
  performance_sedan_awd: { category: 'performance_sedan', body: 'sedan', drivetrain: 'awd_rear', mass: 1900, tier: 'performance_sedan', drag: 6.4, brake: 1.1, steer: 37.2, grip: 2.66, gripGap: 0.19, lowLoss: 1.02, suspension: [2.5, 1.8, 3.12, 0.075, -0.105], antiRoll: 1.32, roll: [0.27, 0.285], comZ: -0.11, inertia: [1.0, 1.54, 1.6] },
  lightweight_sports: { category: 'sports', body: 'coupe', drivetrain: 'rwd', mass: 1230, tier: 'sport', drag: 6.5, brake: 1.04, steer: 39, grip: 2.6, gripGap: 0.23, lowLoss: 1.25, suspension: [2.35, 1.65, 2.92, 0.08, -0.105], antiRoll: 1.22, roll: [0.27, 0.285], comZ: -0.105, inertia: [1.0, 1.42, 1.5] },
  sports_rwd: { category: 'sports', body: 'coupe', drivetrain: 'rwd', mass: 1480, tier: 'sport_high', drag: 6.25, brake: 1.08, steer: 38, grip: 2.62, gripGap: 0.23, lowLoss: 1.27, suspension: [2.42, 1.72, 3.02, 0.075, -0.10], antiRoll: 1.28, roll: [0.255, 0.27], comZ: -0.115, inertia: [1.0, 1.48, 1.55] },
  sports_awd: { category: 'sports', body: 'coupe', drivetrain: 'awd_rear', mass: 1600, tier: 'sport_high', drag: 6.2, brake: 1.1, steer: 37.5, grip: 2.7, gripGap: 0.19, lowLoss: 1.02, suspension: [2.48, 1.76, 3.08, 0.075, -0.10], antiRoll: 1.32, roll: [0.25, 0.265], comZ: -0.12, inertia: [1.0, 1.5, 1.58] },
  super_rwd: { category: 'super', body: 'supercar', drivetrain: 'rwd', mass: 1420, tier: 'super', drag: 5.7, brake: 1.2, steer: 36.5, grip: 2.82, gripGap: 0.22, lowLoss: 1.2, suspension: [2.7, 1.95, 3.42, 0.06, -0.085], antiRoll: 1.48, roll: [0.205, 0.22], comZ: -0.145, inertia: [1.0, 1.58, 1.68] },
  super_awd: { category: 'super', body: 'supercar', drivetrain: 'awd_rear', mass: 1520, tier: 'super', drag: 5.65, brake: 1.22, steer: 36.2, grip: 2.88, gripGap: 0.19, lowLoss: 0.98, suspension: [2.75, 2.0, 3.5, 0.06, -0.085], antiRoll: 1.55, roll: [0.20, 0.215], comZ: -0.15, inertia: [1.0, 1.6, 1.7] },
  hypercar_rwd: { category: 'hypercar', body: 'hypercar', drivetrain: 'rwd', mass: 1320, tier: 'hyper', drag: 5.2, brake: 1.3, steer: 35.5, grip: 2.95, gripGap: 0.22, lowLoss: 1.18, suspension: [2.9, 2.1, 3.65, 0.055, -0.08], antiRoll: 1.68, roll: [0.18, 0.195], comZ: -0.165, inertia: [1.0, 1.65, 1.76] },
  hypercar_awd: { category: 'hypercar', body: 'hypercar', drivetrain: 'awd_rear', mass: 1550, tier: 'hyper', drag: 5.15, brake: 1.32, steer: 35.2, grip: 3.0, gripGap: 0.18, lowLoss: 0.96, suspension: [2.95, 2.15, 3.72, 0.055, -0.08], antiRoll: 1.72, roll: [0.175, 0.19], comZ: -0.17, inertia: [1.0, 1.68, 1.8] },
  muscle_rwd: { category: 'muscle', body: 'muscle', drivetrain: 'rwd', mass: 1850, tier: 'sport_high', drag: 7.0, brake: 0.95, steer: 37.5, grip: 2.42, gripGap: 0.28, lowLoss: 1.48, suspension: [2.15, 1.48, 2.65, 0.105, -0.13], antiRoll: 0.98, roll: [0.32, 0.34], comZ: -0.075, inertia: [1.0, 1.46, 1.55] },
  luxury_gt: { category: 'grand_tourer', body: 'coupe', drivetrain: 'rwd', mass: 1950, tier: 'sport_high', drag: 6.4, brake: 1.06, steer: 36.8, grip: 2.58, gripGap: 0.21, lowLoss: 1.15, suspension: [2.3, 1.62, 2.88, 0.085, -0.115], antiRoll: 1.15, roll: [0.29, 0.305], comZ: -0.10, inertia: [1.0, 1.55, 1.62] },
  suv_awd: { category: 'suv', body: 'suv', drivetrain: 'awd_balanced', mass: 2250, tier: 'civilian', drag: 8.4, brake: 0.88, steer: 36, grip: 2.36, gripGap: 0.20, lowLoss: 1.0, suspension: [2.2, 1.48, 2.72, 0.13, -0.16], antiRoll: 0.9, roll: [0.39, 0.41], comZ: -0.035, inertia: [1.08, 1.62, 1.72] },
  performance_suv: { category: 'performance_suv', body: 'suv', drivetrain: 'awd_rear', mass: 2250, tier: 'performance_suv', drag: 7.2, brake: 1.06, steer: 35.5, grip: 2.58, gripGap: 0.20, lowLoss: 1.0, suspension: [2.5, 1.72, 3.12, 0.10, -0.13], antiRoll: 1.25, roll: [0.33, 0.35], comZ: -0.075, inertia: [1.08, 1.7, 1.8] },
  offroad: { category: 'offroad', body: 'offroad', drivetrain: 'awd_balanced', mass: 2200, tier: 'offroad', drag: 9.2, brake: 0.78, steer: 38, grip: 2.18, gripGap: 0.19, lowLoss: 0.82, suspension: [1.8, 1.25, 2.35, 0.18, -0.22], antiRoll: 0.62, roll: [0.42, 0.44], comZ: -0.02, inertia: [1.1, 1.7, 1.78] },
  pickup: { category: 'pickup', body: 'pickup', drivetrain: 'awd_balanced', mass: 2500, tier: 'offroad', drag: 9.0, brake: 0.8, steer: 37, grip: 2.22, gripGap: 0.20, lowLoss: 0.88, suspension: [1.9, 1.3, 2.45, 0.16, -0.20], antiRoll: 0.72, roll: [0.4, 0.42], comZ: -0.025, inertia: [1.1, 1.68, 1.76] },
  van: { category: 'van', body: 'van', drivetrain: 'rwd', mass: 2600, tier: 'commercial', drag: 9.5, brake: 0.72, steer: 35, grip: 2.08, gripGap: 0.19, lowLoss: 1.15, suspension: [1.8, 1.2, 2.3, 0.15, -0.19], antiRoll: 0.58, roll: [0.43, 0.45], comZ: 0.0, inertia: [1.12, 1.75, 1.82] },
  commercial: { category: 'commercial', body: 'truck', drivetrain: 'rwd', mass: 6500, tier: 'commercial', drag: 10.5, brake: 0.62, steer: 33, grip: 1.95, gripGap: 0.17, lowLoss: 1.1, suspension: [1.55, 1.05, 2.05, 0.19, -0.24], antiRoll: 0.48, roll: [0.48, 0.50], comZ: 0.02, inertia: [1.18, 1.9, 1.95] },
  emergency_sedan: { category: 'emergency', body: 'sedan', drivetrain: 'awd_rear', mass: 1850, tier: 'pursuit', drag: 6.6, brake: 1.1, steer: 37.5, grip: 2.64, gripGap: 0.19, lowLoss: 1.0, suspension: [2.5, 1.78, 3.12, 0.08, -0.11], antiRoll: 1.3, roll: [0.28, 0.295], comZ: -0.105, inertia: [1.0, 1.55, 1.62] },
  emergency_suv: { category: 'emergency', body: 'suv', drivetrain: 'awd_balanced', mass: 2350, tier: 'pursuit_suv', drag: 7.7, brake: 1.0, steer: 35.5, grip: 2.48, gripGap: 0.19, lowLoss: 0.98, suspension: [2.42, 1.66, 3.0, 0.105, -0.14], antiRoll: 1.12, roll: [0.35, 0.37], comZ: -0.065, inertia: [1.08, 1.7, 1.8] },
  emergency_heavy: { category: 'emergency', body: 'truck', drivetrain: 'awd_balanced', mass: 6000, tier: 'utility_slow', drag: 10.0, brake: 0.68, steer: 33, grip: 2.05, gripGap: 0.17, lowLoss: 0.92, suspension: [1.7, 1.15, 2.2, 0.17, -0.22], antiRoll: 0.62, roll: [0.45, 0.47], comZ: -0.01, inertia: [1.15, 1.88, 1.95] },
  motorcycle_sport: { category: 'motorcycle', body: 'motorcycle', drivetrain: 'rwd', mass: 210, tier: 'motorcycle', drag: 5.8, brake: 1.05, steer: 42, grip: 2.25, gripGap: 0.18, lowLoss: 1.05, suspension: [2.0, 1.35, 2.4, 0.10, -0.12], antiRoll: 0.5, roll: [0.30, 0.31], comZ: -0.05, inertia: [1.0, 1.2, 1.25] },
};

const v = (identity, manufacturer, archetype, tier, drivetrain, mass, extra = {}) => ({
  identity, manufacturer, archetype, tier, drivetrain, mass, confidence: 'confirmed', ...extra,
});

const VANILLA = {
  blista: v('Dinka Blista', 'Dinka', 'economy_fwd', 'economy', 'fwd', 1180, { inspiration: 'Honda Civic hatchback' }),
  issi2: v('Weeny Issi', 'Weeny', 'economy_fwd', 'economy', 'fwd', 1120, { inspiration: 'Mini Cooper' }),
  prairie: v('Bollokan Prairie', 'Bollokan', 'hot_hatch_fwd', 'warm', 'fwd', 1280),
  asea: v('Declasse Asea', 'Declasse', 'economy_fwd', 'economy', 'fwd', 1350),
  tailgater: v('Obey Tailgater', 'Obey', 'sedan_awd', 'warm', 'awd_rear', 1700, { inspiration: 'Audi A6' }),
  buffalo: v('Bravado Buffalo', 'Bravado', 'muscle_rwd', 'warm', 'rwd', 1820),
  buffalo2: v('Bravado Buffalo S', 'Bravado', 'performance_sedan_rwd', 'sport_high', 'rwd', 1800),
  sultan: v('Karin Sultan', 'Karin', 'sedan_awd', 'warm', 'awd_balanced', 1450, { inspiration: 'Subaru Impreza' }),
  sultan2: v('Karin Sultan RS', 'Karin', 'sports_awd', 'sport', 'awd_rear', 1380),
  futo: v('Karin Futo', 'Karin', 'lightweight_sports', 'warm', 'rwd', 980),
  bati: v('Pegassi Bati 801', 'Pegassi', 'motorcycle_sport', 'motorcycle', 'rwd', 205),
  banshee: v('Bravado Banshee', 'Bravado', 'sports_rwd', 'sport_high', 'rwd', 1520, { inspiration: 'Dodge Viper' }),
  comet2: v('Pfister Comet', 'Pfister', 'sports_rwd', 'sport_high', 'rwd', 1480, { inspiration: 'Porsche 911', comY: -0.10 }),
  adder: v('Truffade Adder', 'Truffade', 'hypercar_awd', 'hyper', 'awd_rear', 1888, { inspiration: 'Bugatti Veyron', targetKmh: 300 }),
  zentorno: v('Pegassi Zentorno', 'Pegassi', 'super_awd', 'super', 'awd_rear', 1350, { inspiration: 'Lamborghini Sesto Elemento/Veneno', targetKmh: 288, comZ: -0.17, antiRoll: 1.68, rollFront: 0.18, rollRear: 0.195 }),
  elegy2: v('Annis Elegy RH8', 'Annis', 'sports_awd', 'sport_high', 'awd_rear', 1620, { inspiration: 'Nissan GT-R' }),
  massacro: v('Dewbauchee Massacro', 'Dewbauchee', 'sports_rwd', 'sport_high', 'rwd', 1650),
  jester: v('Dinka Jester', 'Dinka', 'sports_awd', 'sport_high', 'awd_rear', 1650),
  dominator: v('Vapid Dominator', 'Vapid', 'muscle_rwd', 'sport', 'rwd', 1800),
  gauntlet: v('Bravado Gauntlet', 'Bravado', 'muscle_rwd', 'sport', 'rwd', 1850),
  kuruma: v('Karin Kuruma', 'Karin', 'sedan_awd', 'warm', 'awd_balanced', 1600),
  sentinel: v('Übermacht Sentinel', 'Übermacht', 'sedan_rwd', 'warm', 'rwd', 1550),
  schafter2: v('Benefactor Schafter', 'Benefactor', 'sedan_rwd', 'warm', 'rwd', 1780),
  schafter3: v('Benefactor Schafter V12', 'Benefactor', 'performance_sedan_rwd', 'sport_high', 'rwd', 1900),
  neon: v('Pfister Neon', 'Pfister', 'sports_awd', 'sport_high', 'awd_balanced', 1950, { propulsion: 'electric' }),
  jugular: v('Ocelot Jugular', 'Ocelot', 'performance_sedan_awd', 'performance_sedan', 'awd_rear', 1820),
  coquette: v('Invetero Coquette', 'Invetero', 'sports_rwd', 'sport_high', 'rwd', 1450),
  carbonizzare: v('Grotti Carbonizzare', 'Grotti', 'sports_rwd', 'sport_high', 'rwd', 1500),
  entityxf: v('Overflod Entity XF', 'Overflod', 'super_awd', 'super', 'awd_rear', 1430),
  vacca: v('Pegassi Vacca', 'Pegassi', 'super_rwd', 'super', 'rwd', 1450),
  turismo2: v('Grotti Turismo Classic', 'Grotti', 'super_rwd', 'sport_high', 'rwd', 1320),
  osiris: v('Pegassi Osiris', 'Pegassi', 'hypercar_awd', 'hyper', 'awd_rear', 1350, { targetKmh: 296 }),
  t20: v('Progen T20', 'Progen', 'hypercar_awd', 'hyper', 'awd_rear', 1390, { targetKmh: 300 }),
  baller: v('Gallivanter Baller', 'Gallivanter', 'suv_awd', 'civilian', 'awd_balanced', 2300),
  baller2: v('Gallivanter Baller II', 'Gallivanter', 'suv_awd', 'civilian', 'awd_balanced', 2350),
  baller6: v('Gallivanter Baller LE Armored', 'Gallivanter', 'suv_awd', 'warm', 'awd_balanced', 2800),
  dubsta: v('Benefactor Dubsta', 'Benefactor', 'suv_awd', 'civilian', 'awd_balanced', 2400),
  dubsta2: v('Benefactor Dubsta 6x6', 'Benefactor', 'offroad', 'offroad', 'awd_balanced', 3000),
  granger: v('Declasse Granger', 'Declasse', 'suv_awd', 'civilian', 'awd_balanced', 2550),
  toros: v('Pegassi Toros', 'Pegassi', 'performance_suv', 'performance_suv', 'awd_rear', 2200),
  mesa: v('Canis Mesa', 'Canis', 'offroad', 'offroad', 'awd_balanced', 2100),
  sandking: v('Vapid Sandking', 'Vapid', 'pickup', 'offroad', 'awd_balanced', 2800),
  manchez: v('Maibatsu Manchez', 'Maibatsu', 'motorcycle_sport', 'warm', 'rwd', 150),
};

// Sequential mass offsets ensure deterministic unique physics signatures
// for fleet groups without hash-based pseudo-random variation.
const addSimple = (models, archetype, tier, drivetrain, baseMass, manufacturer = 'GTA') => {
  for (let i = 0; i < models.length; i++) {
    VANILLA[models[i]] = v(models[i], manufacturer, archetype, tier, drivetrain, baseMass + i * 10, { confidence: 'inferred' });
  }
};
addSimple(['police','police2','police3','police4','sheriff','fbi'], 'emergency_sedan', 'pursuit', 'awd_rear', 1850, 'Emergency fleet');
addSimple(['sheriff2','fbi2','pranger','lguard'], 'emergency_suv', 'pursuit_suv', 'awd_balanced', 2400, 'Emergency fleet');
addSimple(['ambulance'], 'emergency_heavy', 'utility_slow', 'rwd', 3800, 'Emergency fleet');
addSimple(['firetruk','riot'], 'emergency_heavy', 'utility_slow', 'awd_balanced', 6500, 'Emergency fleet');
addSimple(['policeb'], 'motorcycle_sport', 'pursuit', 'rwd', 240, 'Emergency fleet');
addSimple(['policet','rumpo','rumpo3','burrito3','speedo','youga2'], 'van', 'commercial', 'rwd', 2600);
addSimple(['taxi','dynasty','stanier','fugitive'], 'sedan_rwd', 'civilian', 'rwd', 1650);
addSimple(['stretch'], 'luxury_gt', 'civilian', 'rwd', 2400);
addSimple(['seminole','cavalcade2'], 'suv_awd', 'civilian', 'awd_balanced', 2250);
addSimple(['insurgent2'], 'offroad', 'offroad', 'awd_balanced', 5200);
addSimple(['bus','trash','towtruck','towtruck2','flatbed','utillitruck3','slamtruck','phantom','tanker'], 'commercial', 'commercial', 'rwd', 6500);

const ADDON = {
  // ── BMW ────────────────────────────────────────────────────────────────────
  // G30 M5: AWD rear-biased, ~0.35 front bias, modern xDrive
  tol22m5: v('BMW M5 (G30)', 'BMW', 'performance_sedan_awd', 'performance_sedan', 'awd_rear', 1945, { generation: '2017–2023', targetKmh: 275, zeroTo100: 3.4 }),
  // M5 CS: lighter competition version, slightly sharper
  tolm5cs22: v('BMW M5 CS', 'BMW', 'performance_sedan_awd', 'performance_sedan', 'awd_rear', 1870, { generation: '2022', targetKmh: 280, zeroTo100: 3.2 }),
  // E60 M5: pure RWD S85 V10, heavier feel, more rear-drive character
  tolm5e60: v('BMW M5 (E60)', 'BMW', 'performance_sedan_rwd', 'performance_sedan', 'rwd', 1830, { generation: '2005–2010', targetKmh: 265, zeroTo100: 4.2 }),
  tole36prb: v('BMW 3 Series E36 performance build', 'BMW', 'lightweight_sports', 'sport', 'rwd', 1350, { targetKmh: 232, confidence: 'inferred' }),
  tole36v: v('BMW E36 off-road conversion', 'BMW', 'offroad', 'offroad', 'rwd', 1450, { confidence: 'inferred' }),
  tole6314: v('BMW M6 (E63)', 'BMW', 'luxury_gt', 'sport_high', 'rwd', 1785, { targetKmh: 258, confidence: 'inferred' }),

  // ── Nissan / Mitsubishi JDM ────────────────────────────────────────────────
  // 240SX: lightweight, drift-friendly, modest power
  tol240sx: v('Nissan 240SX', 'Nissan', 'lightweight_sports', 'sport', 'rwd', 1170, { targetKmh: 220, zeroTo100: 8.5 }),
  // GT-R R35: AWD rear-biased, brutally fast, heavy
  tolgtr: v('Nissan GT-R', 'Nissan', 'sports_awd', 'sport_high', 'awd_rear', 1752, { targetKmh: 275, zeroTo100: 2.9 }),
  // GT-R Liberty Walk: same platform, slightly heavier aero kit
  tolgtrlw: v('Nissan GT-R Liberty Walk', 'Nissan', 'sports_awd', 'sport_high', 'awd_rear', 1810, { targetKmh: 270, zeroTo100: 3.1 }),
  // R33 Skyline GT-R: older AWD, lighter, more analog feel
  tolr33: v('Nissan Skyline GT-R R33', 'Nissan', 'sports_awd', 'sport', 'awd_rear', 1530, { targetKmh: 255, zeroTo100: 5.5 }),
  // Evo IX: AWD agile rally-derived sedan
  tolevo9: v('Mitsubishi Lancer Evolution IX', 'Mitsubishi', 'sports_awd', 'sport', 'awd_balanced', 1360, { targetKmh: 245, zeroTo100: 5.0 }),

  // ── Chevrolet ──────────────────────────────────────────────────────────────
  tolc7: v('Chevrolet Corvette C7', 'Chevrolet', 'sports_rwd', 'sport_high', 'rwd', 1530, { targetKmh: 258 }),

  // ── Dodge / American muscle ────────────────────────────────────────────────
  // Charger: heavy RWD performance sedan
  tolcharger2: v('Dodge Charger performance build', 'Dodge', 'performance_sedan_rwd', 'sport_high', 'rwd', 1923, { targetKmh: 255, zeroTo100: 4.5 }),
  // Demon: RWD drag-focused, high wheelspin, NOT a cornering car
  toldemon: v('Dodge Challenger SRT Demon', 'Dodge', 'muscle_rwd', 'performance_sedan', 'rwd', 1981, { targetKmh: 265, zeroTo100: 4.0, lowLoss: 1.6 }),
  // Mustang variants: progressively lighter/faster
  tolmustan: v('Ford Mustang', 'Ford', 'muscle_rwd', 'sport', 'rwd', 1655, { targetKmh: 250, zeroTo100: 5.5 }),
  tolmustang: v('Ford Mustang performance build', 'Ford', 'muscle_rwd', 'sport_high', 'rwd', 1680, { targetKmh: 252, zeroTo100: 5.2 }),
  tolmus2: v('Ford Mustang custom', 'Ford', 'muscle_rwd', 'sport_high', 'rwd', 1720, { targetKmh: 248, zeroTo100: 5.8, confidence: 'inferred' }),

  // ── Lamborghini ────────────────────────────────────────────────────────────
  // Urus: AWD performance SUV — NOT supercar cornering
  tolcurus: v('Lamborghini Urus', 'Lamborghini', 'performance_suv', 'performance_suv', 'awd_rear', 2197, { targetKmh: 255, zeroTo100: 4.5 }),
  // Urus RS / hotter variant
  tolrsurus: v('Lamborghini Urus RS', 'Lamborghini', 'performance_suv', 'performance_suv', 'awd_rear', 2150, { targetKmh: 260, zeroTo100: 4.2 }),
  // Huracán / Gallardo era supercar
  tollam2: v('Lamborghini Huracán', 'Lamborghini', 'super_awd', 'super', 'awd_rear', 1422, { targetKmh: 290, zeroTo100: 2.9 }),

  // ── Ferrari ────────────────────────────────────────────────────────────────
  // Logical progression: 360 < 458 < F8 < FXX-K
  // 360: older supercar, less grip, less power than modern
  tolf360: v('Ferrari 360', 'Ferrari', 'super_rwd', 'super', 'rwd', 1350, { targetKmh: 245, zeroTo100: 4.5, grip: 2.72, antiRoll: 1.48, comZ: -0.145 }),
  // 458 Liberty Walk: improved over 360
  tollwalk458: v('Ferrari 458 Liberty Walk', 'Ferrari', 'super_rwd', 'super', 'rwd', 1380, { targetKmh: 265, zeroTo100: 3.9 }),
  // F8 Spider: modern high-power twin-turbo
  tolf8spider: v('Ferrari F8 Spider', 'Ferrari', 'super_rwd', 'super', 'rwd', 1330, { targetKmh: 285, zeroTo100: 2.9 }),
  // FXX-K: track-only, highest grip/braking in the Ferrari range
  tolfxxk: v('Ferrari FXX-K', 'Ferrari', 'hypercar_rwd', 'hyper', 'rwd', 1165, { targetKmh: 295, zeroTo100: 2.5, grip: 3.08 }),

  // ── McLaren ────────────────────────────────────────────────────────────────
  tol675ltsp: v('McLaren 675LT Spider', 'McLaren', 'super_rwd', 'super', 'rwd', 1368, { targetKmh: 292, zeroTo100: 2.9 }),

  // ── Audi ───────────────────────────────────────────────────────────────────
  // R8: actual supercar character, distinct from RS6
  tolr8c: v('Audi R8', 'Audi', 'super_awd', 'super', 'awd_rear', 1560, { targetKmh: 295, zeroTo100: 3.4 }),
  tolr8v10: v('Audi R8 V10', 'Audi', 'super_awd', 'super', 'awd_rear', 1570, { targetKmh: 300, zeroTo100: 3.2 }),
  // RS5: performance coupe
  tolrs5: v('Audi RS5', 'Audi', 'performance_sedan_awd', 'performance_sedan', 'awd_rear', 1765, { targetKmh: 260, zeroTo100: 3.9 }),
  // RS6: heavy performance wagon
  tolrs6: v('Audi RS6', 'Audi', 'performance_sedan_awd', 'performance_sedan', 'awd_rear', 1985, { targetKmh: 263, zeroTo100: 3.7, body: 'wagon' }),
  // RS7: performance fastback (lighter than RS6 wagon)
  tolrs7c821: v('Audi RS7', 'Audi', 'performance_sedan_awd', 'performance_sedan', 'awd_rear', 1950, { targetKmh: 267, zeroTo100: 3.5 }),
  tola6: v('Audi A6', 'Audi', 'sedan_awd', 'warm', 'awd_rear', 1800, { targetKmh: 212 }),
  tolaudidy: v('Audi performance concept', 'Audi', 'sports_awd', 'sport_high', 'awd_rear', 1750, { targetKmh: 256, confidence: 'inferred' }),

  // ── Mercedes-Benz ──────────────────────────────────────────────────────────
  tols63amg: v('Mercedes-AMG S63', 'Mercedes-Benz', 'performance_sedan_awd', 'performance_sedan', 'awd_rear', 2120, { targetKmh: 262 }),
  tolc63: v('Mercedes-AMG C63', 'Mercedes-Benz', 'performance_sedan_rwd', 'performance_sedan', 'rwd', 1810, { targetKmh: 268 }),
  tolgtam21: v('Mercedes-AMG GT', 'Mercedes-Benz', 'luxury_gt', 'sport_high', 'rwd', 1645, { targetKmh: 257, confidence: 'inferred' }),
  tolm6x6: v('Mercedes-AMG G63 6x6', 'Mercedes-Benz', 'offroad', 'offroad', 'awd_balanced', 3850, { targetKmh: 195 }),
  tolmm6x6: v('Mercedes-AMG G63 6x6 custom', 'Mercedes-Benz', 'offroad', 'offroad', 'awd_balanced', 3950, { targetKmh: 192, confidence: 'inferred' }),

  // ── Ford trucks ────────────────────────────────────────────────────────────
  tolraptorv2: v('Ford F-150 Raptor', 'Ford', 'pickup', 'offroad', 'awd_balanced', 2600, { targetKmh: 190 }),

  // ── Luxury ────────────────────────────────────────────────────────────────
  tolrrmansory: v('Rolls-Royce Mansory', 'Rolls-Royce', 'luxury_gt', 'sport_high', 'awd_rear', 2550, { targetKmh: 245, confidence: 'inferred' }),

  // ── Hypercars ──────────────────────────────────────────────────────────────
  tolbt62r: v('Brabham BT62R', 'Brabham', 'hypercar_rwd', 'hyper', 'rwd', 1050, { targetKmh: 298, zeroTo100: 2.6, grip: 3.1 }),
  tolap2: v('Apollo hypercar', 'Apollo', 'hypercar_rwd', 'hyper', 'rwd', 1350, { targetKmh: 296, zeroTo100: 2.7, confidence: 'inferred' }),
  tolka: v('Koenigsegg hypercar', 'Koenigsegg', 'hypercar_rwd', 'hyper', 'rwd', 1395, { targetKmh: 308, zeroTo100: 2.5, confidence: 'inferred' }),

  // ── Offroad ────────────────────────────────────────────────────────────────
  tolraid: v('Rally raid prototype', 'Custom', 'offroad', 'offroad', 'awd_balanced', 1950, { targetKmh: 185, confidence: 'inferred' }),
};

const FAMILY_RULES = [
  { re: /(brioso|clubc|clubp|hweevil|issi|kanjoe|kanjox|sugoi|gazatar)/, identity: 'Compact / hot hatch', archetype: 'hot_hatch_fwd', tier: 'warm', drivetrain: 'fwd', mass: 1250 },
  { re: /(comet|turisgt3|cometcup|h4rxst2)/, identity: 'Pfister sports derivative', manufacturer: 'Pfister', archetype: 'sports_rwd', tier: 'sport_high', drivetrain: 'rwd', mass: 1480 },
  { re: /(elegy|gtr|rhinea|sultan|sultl)/, identity: 'AWD performance derivative', archetype: 'sports_awd', tier: 'sport_high', drivetrain: 'awd_rear', mass: 1650 },
  { re: /(coquette|coqvenm|cazador|carrion|bansh)/, identity: 'RWD performance coupe', archetype: 'sports_rwd', tier: 'sport_high', drivetrain: 'rwd', mass: 1500 },
  { re: /(buff|gaunt|charger|demon|mustang|gaterback)/, identity: 'V8 muscle derivative', archetype: 'muscle_rwd', tier: 'sport_high', drivetrain: 'rwd', mass: 1850 },
  { re: /(tailgater|tailst|tailsr|hyctail|sent5|sen5|sentinel|d7cyp|cyph)/, identity: 'Übermacht performance sedan', manufacturer: 'Übermacht', archetype: 'performance_sedan_rwd', tier: 'performance_sedan', drivetrain: 'rwd', mass: 1850 },
  { re: /(schlag|strcoupe|draft|paragon|paraw|deity|dawn)/, identity: 'Luxury performance grand tourer', archetype: 'luxury_gt', tier: 'sport_high', drivetrain: 'rwd', mass: 1900 },
  { re: /(rsx|kurx|komt|omnven|flashgrs|evo)/, identity: 'AWD sport derivative', archetype: 'sports_awd', tier: 'sport_high', drivetrain: 'awd_rear', mass: 1600 },
  { re: /(tempesta|temphyc|temptwins|zent|ignus|thrax|enty|hycadetail|tenf|sitavenm|jestvenm)/, identity: 'Modern supercar derivative', archetype: 'super_awd', tier: 'super', drivetrain: 'awd_rear', mass: 1500 },
  { re: /(ball|jub|shenron|sr8|toros|taurion|xls|rebla|trag|curus)/, identity: 'Performance SUV derivative', archetype: 'performance_suv', tier: 'performance_suv', drivetrain: 'awd_rear', mass: 2250 },
  { re: /(r300|zr350|remus|rt3000|rt3k|uranus|240sx)/, identity: 'Lightweight RWD tuner', archetype: 'lightweight_sports', tier: 'sport', drivetrain: 'rwd', mass: 1280 },
  { re: /(pargn|sedan|strwag|srspback|rwag|wagen|a6)/, identity: 'Sport sedan / wagon derivative', archetype: 'sedan_awd', tier: 'warm', drivetrain: 'awd_rear', mass: 1780 },
  { re: /(neon)/, identity: 'Electric performance sedan derivative', manufacturer: 'Pfister', archetype: 'sports_awd', tier: 'sport_high', drivetrain: 'awd_balanced', mass: 1950, propulsion: 'electric' },
  { re: /(verus|raid|raptor)/, identity: 'Off-road vehicle', archetype: 'offroad', tier: 'offroad', drivetrain: 'awd_balanced', mass: 2200 },
  { re: /(flattruck|tow|truck)/, identity: 'Commercial truck', archetype: 'commercial', tier: 'commercial', drivetrain: 'rwd', mass: 6500 },
  { re: /(varx)/, identity: 'Sport motorcycle', archetype: 'motorcycle_sport', tier: 'motorcycle', drivetrain: 'rwd', mass: 210 },
];

function emergencyVariant(base, model) {
  const source = resolveIdentity(base) || {};
  const suv = /suv|offroad|pickup/.test(source.archetype || '') || /(ball|jub|shenron|sr8|taurion|xls|rebla)/.test(base);
  return {
    ...source,
    identity: `${source.identity || base} emergency fleet variant`,
    archetype: suv ? 'emergency_suv' : 'emergency_sedan',
    tier: suv ? 'pursuit_suv' : 'pursuit',
    drivetrain: suv ? 'awd_balanced' : 'awd_rear',
    mass: Math.max(source.mass || 1700, suv ? 2250 : 1750) + 120,
    intendedRole: 'emergency pursuit',
    confidence: source.confidence === 'confirmed' ? 'inferred' : (source.confidence || 'uncertain'),
    baseModel: base,
    model,
  };
}

function stripFleetSuffix(model) {
  return model.replace(/(vmark|wmark|mark|mech|ambo|pd)$/i, '').replace(/xpd$/i, 'x');
}

function resolveIdentity(model, vehicleClass = '', emergency = false) {
  model = String(model || '').toLowerCase();
  if (VANILLA[model]) return { ...VANILLA[model], model };
  if (ADDON[model]) return { ...ADDON[model], model };
  if (emergency) return emergencyVariant(stripFleetSuffix(model), model);
  for (const rule of FAMILY_RULES) {
    if (rule.re.test(model)) return { manufacturer: 'Unknown', confidence: 'inferred', ...rule, model };
  }
  const cls = String(vehicleClass || '').toUpperCase();
  if (cls.includes('MOTORCYCLE')) return { model, identity: 'Unidentified addon motorcycle', manufacturer: 'Unknown', archetype: 'motorcycle_sport', tier: 'motorcycle', drivetrain: 'rwd', mass: 220, confidence: 'uncertain' };
  if (cls.includes('SUV') || cls.includes('OFF_ROAD')) return { model, identity: 'Unidentified addon SUV', manufacturer: 'Unknown', archetype: 'suv_awd', tier: 'civilian', drivetrain: 'awd_balanced', mass: 2200, confidence: 'uncertain' };
  if (cls.includes('COMPACT')) return { model, identity: 'Unidentified addon compact', manufacturer: 'Unknown', archetype: 'economy_fwd', tier: 'economy', drivetrain: 'fwd', mass: 1250, confidence: 'uncertain' };
  if (cls.includes('MUSCLE')) return { model, identity: 'Unidentified addon muscle car', manufacturer: 'Unknown', archetype: 'muscle_rwd', tier: 'sport', drivetrain: 'rwd', mass: 1800, confidence: 'uncertain' };
  if (cls.includes('SUPER')) return { model, identity: 'Unidentified addon supercar', manufacturer: 'Unknown', archetype: 'super_rwd', tier: 'super', drivetrain: 'rwd', mass: 1450, confidence: 'uncertain' };
  if (cls.includes('SPORT')) return { model, identity: 'Unidentified addon sports car', manufacturer: 'Unknown', archetype: 'sports_rwd', tier: 'sport', drivetrain: 'rwd', mass: 1500, confidence: 'uncertain' };
  return { model, identity: 'Unidentified addon road vehicle', manufacturer: 'Unknown', archetype: 'sedan_rwd', tier: 'civilian', drivetrain: 'rwd', mass: 1650, confidence: 'uncertain' };
}

module.exports = { TIERS, ARCHETYPES, VANILLA, ADDON, FAMILY_RULES, resolveIdentity };
