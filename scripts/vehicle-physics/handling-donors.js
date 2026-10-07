'use strict';

const { isVanillaHandlingId, normalizeHandlingId } = require('./gta-vanilla-handling-index');

/** Manual overrides (highest priority). confidence: confirmed | inferred | needs_drive_test */
const EXPLICIT_DONORS = {
  tolrrmansory: {
    donorId: 'WINDSOR',
    confidence: 'confirmed',
    note: 'Enus Windsor coupe — planted luxury GT (avoid Windsor Drop on tall RR shell)',
  },
  tolap2: {
    donorId: 'T20',
    confidence: 'confirmed',
    note: 'Progen T20 — planted AWD hyper baseline for low-shell addons',
  },
  schlagenstr: {
    donorId: 'SCHLAGEN',
    confidence: 'confirmed',
    note: 'Benefactor Schlagen GT — STR widebody donor',
  },
  cometcup: {
    donorId: 'COMET3',
    confidence: 'needs_drive_test',
    note: 'Pfister Comet Safari-adjacent cup; verify cup geometry',
  },
  h4rxst2: {
    donorId: 'ELEGY2',
    confidence: 'needs_drive_test',
    note: 'H4Rx ST2 — AWD sports coupe baseline',
  },
  d7cyp: {
    donorId: 'CYCLONE',
    confidence: 'needs_drive_test',
    note: 'D7 CYP — electric hyper donor placeholder',
  },
  tempesta2: {
    donorId: 'TEMPESTA',
    confidence: 'needs_drive_test',
    note: 'Tempesta widebody variant',
  },
  sentinel_rts: {
    donorId: 'SENTINEL3',
    confidence: 'needs_drive_test',
    note: 'Sentinel RTS — classic sports sedan',
  },
};

const ARCHETYPE_DONOR_POOLS = {
  economy_fwd: ['BLISTA', 'PANTO', 'ISSI2', 'PRAIRIE'],
  hot_hatch_fwd: ['PRAIRIE', 'BLISTA2', 'BRIOSO', 'CLUB'],
  sedan_rwd: ['TAILGATER', 'SCHAFTER2', 'ORACLE', 'FUGITIVE'],
  sedan_awd: ['SULTAN', 'KURUMA', 'SCHAFTER2', 'JACKAL'],
  performance_sedan_rwd: ['SCHAFTER3', 'BUFFALO2', 'SCHWARZER', 'SENTINEL3'],
  performance_sedan_awd: ['JUGULAR', 'SCHAFTER3', 'KOMODA', 'RHINEHART'],
  lightweight_sports: ['FUTO', 'BLISTA2', 'GB200', 'MICHELLI'],
  sports_rwd: ['COMET2', 'MASSACRO', 'CARBONIZZARE', 'COQUETTE', 'ELEGY', 'FELTZER2'],
  sports_awd: ['ELEGY2', 'JESTER', 'MASSACRO2', 'SULTANRS', 'PARIAH'],
  super_rwd: ['VACCA', 'ENTITYXF', 'CHEETAH', 'INFERNUS', 'BULLET'],
  super_awd: ['ZENTORNO', 'T20', 'OSIRIS', 'TURISMOR', 'VAGNER'],
  hypercar_rwd: ['EMERUS', 'T20', 'VAGNER', 'AUTARCH', 'TYRUS'],
  hypercar_awd: ['ADDER', 'T20', 'NERO', 'XA21', 'VIGILANTE'],
  muscle_rwd: ['DOMINATOR', 'GAUNTLET', 'DUKES', 'VIGERO', 'PHOENIX'],
  luxury_gt: ['WINDSOR', 'WINDSOR2', 'SUPERD', 'COGCABRIO', 'FELON2'],
  suv_awd: ['BALLER2', 'GRANGER', 'GRESLEY', 'HUNTLEY', 'ROCOTO'],
  performance_suv: ['TOROS', 'BALLER4', 'JUBILEE', 'HUNTLEY', 'GRESLEY'],
  offroad: ['MESA', 'BFINJECTION', 'BRAWLER', 'KAMACHO', 'HELLION'],
  pickup: ['SANDKING', 'BOBCATXL', 'GUARDIAN', 'REBEL', 'SADLER'],
  van: ['RUMPO', 'YOUGA', 'SPEEDO', 'MINIVAN', 'PONY'],
  commercial: ['MULE', 'BENSON', 'POUNDER', 'BURRITO', 'SPEEDO'],
  emergency_sedan: ['POLICE2', 'POLICE', 'POLICE3', 'FBI', 'SHERIFF'],
  emergency_suv: ['FBI2', 'GRANGER', 'PATRIOT', 'SHERIFF2', 'POLICE4'],
  emergency_heavy: ['RIOT', 'PRANGER', 'BARRACKS', 'CRUSADER', 'INSURGENT'],
  motorcycle_sport: ['BATI', 'AKUMA', 'HAKUCHOU', 'DOUBLE', 'CARBONRS'],
};

function stableIndex(model, size) {
  let h = 2166136261;
  for (let i = 0; i < model.length; i++) {
    h ^= model.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return size > 0 ? (h >>> 0) % size : 0;
}

function poolForIdentity(identity, emergency) {
  if (emergency) {
    const arch = identity.archetype || '';
    if (arch.includes('emergency_heavy') || identity.body === 'truck') return ARCHETYPE_DONOR_POOLS.emergency_heavy;
    if (arch.includes('suv') || identity.body === 'suv') return ARCHETYPE_DONOR_POOLS.emergency_suv;
    return ARCHETYPE_DONOR_POOLS.emergency_sedan;
  }
  const arch = identity.archetype;
  if (ARCHETYPE_DONOR_POOLS[arch]) return ARCHETYPE_DONOR_POOLS[arch];
  if (identity.body === 'motorcycle' || arch === 'motorcycle_sport') return ARCHETYPE_DONOR_POOLS.motorcycle_sport;
  if (identity.body === 'suv') return ARCHETYPE_DONOR_POOLS.suv_awd;
  if (identity.body === 'van') return ARCHETYPE_DONOR_POOLS.van;
  if (identity.body === 'pickup') return ARCHETYPE_DONOR_POOLS.pickup;
  if (identity.tier === 'hyper' || identity.archetype?.includes('hyper')) return ARCHETYPE_DONOR_POOLS.hypercar_rwd;
  if (identity.tier === 'super' || identity.archetype?.includes('super')) return ARCHETYPE_DONOR_POOLS.super_rwd;
  return ARCHETYPE_DONOR_POOLS.sedan_rwd;
}

function pickFromPool(model, pool, usedCounts) {
  const valid = pool.filter((id) => isVanillaHandlingId(id));
  if (!valid.length) return null;
  const start = stableIndex(model, valid.length);
  for (let i = 0; i < valid.length; i++) {
    const candidate = valid[(start + i) % valid.length];
    const count = usedCounts.get(candidate) || 0;
    if (count < 12) return candidate;
  }
  return valid[start];
}

/**
 * Resolve native GTA handling donor for an addon spawn model.
 * @param {string} model
 * @param {object} identity from catalog.resolveIdentity
 * @param {{ emergency?: boolean }} opts
 */
function resolveDonor(model, identity, opts = {}) {
  const key = String(model || '').toLowerCase();
  if (EXPLICIT_DONORS[key]) {
    const row = EXPLICIT_DONORS[key];
    return {
      model: key,
      donorId: normalizeHandlingId(row.donorId),
      confidence: row.confidence,
      note: row.note,
      source: 'explicit',
    };
  }

  const pool = poolForIdentity(identity || {}, opts.emergency);
  const donorId = pickFromPool(key, pool || ['SCHAFTER2'], new Map());
  if (!donorId || !isVanillaHandlingId(donorId)) {
    return {
      model: key,
      donorId: 'SCHAFTER2',
      confidence: 'needs_drive_test',
      note: 'Fallback donor — verify in-game',
      source: 'fallback',
    };
  }

  return {
    model: key,
    donorId,
    confidence: identity?.confidence === 'confirmed' ? 'inferred' : 'needs_drive_test',
    note: `Archetype pool ${identity?.archetype || 'unknown'}`,
    source: 'archetype_pool',
  };
}

function buildDonorMap(records) {
  const map = new Map();
  const usedCounts = new Map();
  for (const record of records) {
    const donor = resolveDonor(record.model, record.identity, { emergency: record.emergency });
    usedCounts.set(donor.donorId, (usedCounts.get(donor.donorId) || 0) + 1);
    map.set(record.model, donor);
  }
  return map;
}

module.exports = {
  EXPLICIT_DONORS,
  ARCHETYPE_DONOR_POOLS,
  resolveDonor,
  buildDonorMap,
  normalizeHandlingId,
};
