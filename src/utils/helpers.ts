/**
 * @fileoverview General utility and helper functions.
 */

import crypto from 'crypto';

/**
 * Generates a cryptographically secure 6-digit One-Time Password (OTP).
 * Replaced Math.random() with crypto to prevent predictability vulnerabilities.
 * 
 * @returns {string} The secure 6-digit OTP.
 */
export const generateOtp = (): string => {
  // Generates a random integer between 100000 (inclusive) and 1000000 (exclusive)
  return crypto.randomInt(100000, 1000000).toString(); 
};

/**
 * Generates a random stylized gamer tag (e.g., "FierceDragon48291").
 * 
 * @returns {string} A randomly generated gamer name.
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

  // Using crypto here as well for consistent randomness across the utility
  const randomAdjective = adjectives[crypto.randomInt(0, adjectives.length)];
  const randomNoun = nouns[crypto.randomInt(0, nouns.length)];
  const randomNumber = crypto.randomInt(10000, 100000); 

  return `${randomAdjective}${randomNoun}${randomNumber}`;
};