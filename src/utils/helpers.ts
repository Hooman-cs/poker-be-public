
/**
 * @fileoverview General utility and helper functions.
 */

/**
 * Generates a 6-digit One-Time Password (OTP).
 * @returns {string} The 6-digit OTP.
 */
export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); 
};

/**
 * Generates a random stylized gamer tag (e.g., "FierceDragon48291").
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

  // Using strict type inference for array access
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNumber = Math.floor(Math.random() * 100000); 

  return `${randomAdjective}${randomNoun}${randomNumber}`;
};
