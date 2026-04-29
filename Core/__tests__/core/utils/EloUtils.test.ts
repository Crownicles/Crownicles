import { describe, it, expect } from 'vitest';
import { EloUtils } from "../../../src/core/utils/EloUtils";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { LeagueInfoConstants } from "../../../../Lib/src/constants/LeagueInfoConstants";

describe('EloUtils', () => {
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
        const threshold = FightConstants.ELO.INACTIVE_ATTACKER_ATTACK_COUNT_THRESHOLD;

        it('should return base k-factor when attacker is active (attackCount >= threshold)', () => {
            const attacker = { getGloryPoints: () => 1500, getLeague: () => nonRoyalLeague } as any;

            // threshold+ attacks in window → attackBasedCountdown = 0 → no boost
            expect(EloUtils.getAttackerKFactor(attacker, threshold)).toBe(32);
            expect(EloUtils.getAttackerKFactor(attacker, threshold + 3)).toBe(32);
        });

        it('should return base k-factor when attacker has recent activity (attackBasedCountdown <= 2)', () => {
            const attacker = { getGloryPoints: () => 1500, getLeague: () => nonRoyalLeague } as any;

            // threshold-2 attacks → attackBasedCountdown = 2 → no boost
            expect(EloUtils.getAttackerKFactor(attacker, threshold - 2)).toBe(32);
            // threshold-1 attacks → attackBasedCountdown = 1 → no boost
            expect(EloUtils.getAttackerKFactor(attacker, threshold - 1)).toBe(32);
        });

        it('should return boosted k-factor when attacker is returning from inactivity (attackBasedCountdown >= 3)', () => {
            const attacker = { getGloryPoints: () => 1500, getLeague: () => nonRoyalLeague } as any;

            // threshold-3 attacks → attackBasedCountdown = 3 → multiplier = min(3-1, 4) = 2
            expect(EloUtils.getAttackerKFactor(attacker, threshold - 3)).toBe(32 * 2);
        });

        it('should increase multiplier with higher inactivity', () => {
            const attacker = { getGloryPoints: () => 1500, getLeague: () => nonRoyalLeague } as any;

            // threshold-4 attacks → attackBasedCountdown = 4 → multiplier = min(4-1, 4) = 3
            expect(EloUtils.getAttackerKFactor(attacker, threshold - 4)).toBe(32 * 3);
        });

        it('should cap the multiplier at INACTIVE_ATTACKER_K_FACTOR_MAX_MULTIPLIER', () => {
            const attacker = { getGloryPoints: () => 1500, getLeague: () => nonRoyalLeague } as any;

            // threshold-5 attacks → attackBasedCountdown = 5 → multiplier = min(5-1, 4) = 4 (capped)
            expect(EloUtils.getAttackerKFactor(attacker, threshold - 5)).toBe(32 * 4);
            // 0 attacks → attackBasedCountdown = threshold → multiplier capped at max
            expect(EloUtils.getAttackerKFactor(attacker, 0)).toBe(32 * FightConstants.ELO.INACTIVE_ATTACKER_K_FACTOR_MAX_MULTIPLIER);
        });

        it('should NOT boost k-factor for Royal league players even when inactive', () => {
            const attacker = { getGloryPoints: () => 3500, getLeague: () => royalLeague } as any;

            // Royal league → no boost, just base k-factor (12 for 3500 glory)
            expect(EloUtils.getAttackerKFactor(attacker, 0)).toBe(12);
        });

        it('should apply lower base k-factor for high-glory players even with boost', () => {
            // Player with 2200 glory → K = 24 (LOW_K_FACTOR)
            const highGloryAttacker = { getGloryPoints: () => 2200, getLeague: () => nonRoyalLeague } as any;

            // 0 attacks → attackBasedCountdown = threshold → multiplier = 4 (capped)
            expect(EloUtils.getAttackerKFactor(highGloryAttacker, 0)).toBe(24 * 4);
        });

        it('should handle exact boundary at threshold (threshold attacks → no boost)', () => {
            const attacker = { getGloryPoints: () => 1500, getLeague: () => nonRoyalLeague } as any;

            // threshold attacks → attackBasedCountdown = 0 → below FIGHT_COUNTDOWN_THRESHOLD → no boost
            expect(EloUtils.getAttackerKFactor(attacker, threshold)).toBe(32);
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