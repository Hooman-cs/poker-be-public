/**
 * @fileoverview General utility and helper functions.
 *
 * `generateOtp` was removed in Phase 0 task 0.11 along with the OTP model
 * and OTP routes. If OTP-based auth is ever revived, build it fresh against
 * the providers structure — do not resurrect old code. See TASKS.md's
 * auth change log in the parking lot for the breadcrumb.
 */

import crypto from 'crypto';

/**
 * Generates a random stylized gamer tag (e.g. "FierceDragon48291").
 * Used to give first-time users a default unique username at registration.
 *
 * The caller is responsible for guaranteeing uniqueness — this function
 * produces a likely-unique string with reasonable entropy, but does not
 * check the database. The auth route should retry on collision (or append
 * additional entropy) until `User.findOne({ username })` returns null.
 */
export const generateGamerName = (): string => {
  const adjectives: string[] = [
    "Swift", "Silent", "Fierce", "Mighty", "Stealthy",
    "Shadow", "Wild", "Epic", "Thunder", "Crimson",
    "Vivid", "Rogue", "Blaze", "Iron", "Atomic",
    "Mystic", "Phantom", "Glitch", "Storm", "Nebula"
  ];

  const nouns: string[] = [
    "Warrior", "Hunter", "Ninja", "Dragon", "Viper",
    "Raven", "Knight", "Ghost", "Assassin", "Titan",
    "Samurai", "Rider", "Predator", "Sniper", "Hacker",
    "Wraith", "Cyclone", "Phoenix", "Juggernaut", "Reaper"
  ];

  const randomAdjective = adjectives[crypto.randomInt(0, adjectives.length)];
  const randomNoun = nouns[crypto.randomInt(0, nouns.length)];
  const randomNumber = crypto.randomInt(10000, 100000);

  return `${randomAdjective}${randomNoun}${randomNumber}`;
};