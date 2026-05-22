// src/types/pokersolver.d.ts
declare module 'pokersolver' {
  export class Hand {
    name: string;
    descr: string;
    cards: string[];
    rank: number;
    static solve(cards: string[]): Hand;
    static winners(hands: Hand[]): Hand[];
  }
}