'use strict';

/**
 * Node mirror of sunset_vehicle_dynamics/shared/resolver.lua sanitization rules.
 * Keep in sync when changing mass limits or profile-aware clamps.
 */

const DEFAULT_MASS_LIMITS = { min: 400, max: 15000, default: 1500 };
const MOTORCYCLE_MASS_LIMITS = { min: 120, max: 450, default: 210 };

function isMotorcycleProfile(profile) {
  if (!profile) return false;
  return (
    profile.archetype === 'motorcycle_sport'
    || profile.category === 'motorcycle'
    || profile.bodyStyle === 'motorcycle'
  );
}

function massLimitsForProfile(profile) {
  return isMotorcycleProfile(profile) ? MOTORCYCLE_MASS_LIMITS : DEFAULT_MASS_LIMITS;
}

function sanitizeMass(profile, mass) {
  const limits = massLimitsForProfile(profile);
  const value = Number(mass);
  if (!Number.isFinite(value)) return limits.default;
  if (value < limits.min) return limits.min;
  if (value > limits.max) return limits.max;
  return value;
}

/** Apply runtime mass sanitization to a generated profile object (post-buildProfile). */
function sanitizeProfileMass(profile) {
  if (!profile?.handling) return profile;
  const copy = { ...profile, handling: { ...profile.handling } };
  copy.handling.fMass = sanitizeMass(copy, copy.handling.fMass);
  copy.weightKg = copy.handling.fMass;
  return copy;
}

module.exports = {
  DEFAULT_MASS_LIMITS,
  MOTORCYCLE_MASS_LIMITS,
  isMotorcycleProfile,
  massLimitsForProfile,
  sanitizeMass,
  sanitizeProfileMass,
};
