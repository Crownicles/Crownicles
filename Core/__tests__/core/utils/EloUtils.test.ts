import { describe, it, expect } from 'vitest';
import { EloUtils } from "../../../src/core/utils/EloUtils";

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

    describe('calculateNewRating', () => {
        it('should return the correct K factor', () => {
            expect(EloUtils.calculateNewRating(1500, 1500, 1, 32)).toBe(1518);
            expect(EloUtils.calculateNewRating(2200, 2200, 1, 24)).toBe(2213);
            expect(EloUtils.calculateNewRating(2500, 2500, 1, 16)).toBe(2509);
        });
    });
});