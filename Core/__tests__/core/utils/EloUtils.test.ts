import { describe, it, expect } from 'vitest';
import { EloUtils } from "../../../src/core/utils/EloUtils";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { LeagueInfoConstants } from "../../../../Lib/src/constants/LeagueInfoConstants";

describe('MathUtils', () => {
    describe('getKFactor', () => {
        it('should return the correct K factor', () => {
            const mockPlayer1 = { getGloryPoints: () => 1500 } as any;
            const mockPlayer2 = { getGloryPoints: () => 2200 } as any;
            const mockPlayer3 = { getGloryPoints: () => 2500 } as any;
            const mockPlayer4 = { getGloryPoints: () => 3500 } as any;
            const mockPlayer5 = { getGloryPoints: () => 4000 } as any;

            expect(EloUtils.getKFactor(mockPlayer1)).toBe(32);
            expect(EloUtils.getKFactor(mockPlayer2)).toBe(24);
            expect(EloUtils.getKFactor(mockPlayer3)).toBe(16);
            expect(EloUtils.getKFactor(mockPlayer4)).toBe(12);
            expect(EloUtils.getKFactor(mockPlayer5)).toBe(8);
        });
    });

    describe('getAttackerKFactor', () => {
        const nonRoyalLeague = { id: 5 };
        const royalLeague = { id: LeagueInfoConstants.ROYAL_LEAGUE_ID };

        it('should return base k-factor when attacker is active (fightCountdown <= 2)', () => {
            const attacker0 = { getGloryPoints: () => 1500, fightCountdown: 0, getLeague: () => nonRoyalLeague } as any;
            const attacker2 = { getGloryPoints: () => 1500, fightCountdown: 2, getLeague: () => nonRoyalLeague } as any;

            expect(EloUtils.getAttackerKFactor(attacker0)).toBe(32);
            expect(EloUtils.getAttackerKFactor(attacker2)).toBe(32);
        });

        it('should return boosted k-factor when attacker is returning from inactivity (fightCountdown >= 3)', () => {
            const attacker = { getGloryPoints: () => 1500, fightCountdown: 3, getLeague: () => nonRoyalLeague } as any;

            // fightCountdown=3 → multiplier = min(3-1, 4) = 2
            expect(EloUtils.getAttackerKFactor(attacker)).toBe(32 * 2);
        });

        it('should increase multiplier with higher fightCountdown', () => {
            const attacker = { getGloryPoints: () => 1500, fightCountdown: 4, getLeague: () => nonRoyalLeague } as any;

            // fightCountdown=4 → multiplier = min(4-1, 4) = 3
            expect(EloUtils.getAttackerKFactor(attacker)).toBe(32 * 3);
        });

        it('should cap the multiplier at INACTIVE_ATTACKER_K_FACTOR_MAX_MULTIPLIER', () => {
            const attacker5 = { getGloryPoints: () => 1500, fightCountdown: 5, getLeague: () => nonRoyalLeague } as any;
            const attacker7 = { getGloryPoints: () => 1500, fightCountdown: 7, getLeague: () => nonRoyalLeague } as any;

            // fightCountdown=5 → multiplier = min(5-1, 4) = 4 (capped)
            expect(EloUtils.getAttackerKFactor(attacker5)).toBe(32 * 4);
            // fightCountdown=7 → multiplier = min(7-1, 4) = 4 (still capped)
            expect(EloUtils.getAttackerKFactor(attacker7)).toBe(32 * FightConstants.ELO.INACTIVE_ATTACKER_K_FACTOR_MAX_MULTIPLIER);
        });

        it('should NOT boost k-factor for Royal league players even when inactive', () => {
            const attacker = { getGloryPoints: () => 3500, fightCountdown: 5, getLeague: () => royalLeague } as any;

            // Royal league → no boost, just base k-factor (12 for 3500 glory)
            expect(EloUtils.getAttackerKFactor(attacker)).toBe(12);
        });
    });

    describe('calculateNewRating', () => {
        it('should return the correct K factor', () => {
            expect(EloUtils.calculateNewRating(1500, 1500, 1, 32)).toBe(1518);
            expect(EloUtils.calculateNewRating(2200, 2200, 1, 24)).toBe(2213);
            expect(EloUtils.calculateNewRating(2500, 2500, 1, 16)).toBe(2509);
        });
    });
});