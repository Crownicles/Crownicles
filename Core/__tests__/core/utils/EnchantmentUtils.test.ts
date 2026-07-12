import {
	describe, expect, it
} from 'vitest';
import { EnchantmentUtils } from '../../../src/core/utils/EnchantmentUtils';
import { ItemEnchantmentKind } from '../../../../Lib/src/types/ItemEnchantment';
import { EnchantmentConstants } from '../../../../Lib/src/constants/EnchantmentConstants';
import { FightAlterations } from '../../../src/core/fights/actions/FightAlterations';

describe('EnchantmentUtils', () => {
	describe('getEnchantmentMultiplier', () => {
		it('returns 1 when neither weapon nor armor has an enchantment', () => {
			const multiplier = EnchantmentUtils.getEnchantmentMultiplier(
				{
					weapon: { itemEnchantmentId: null },
					armor: { itemEnchantmentId: null }
				},
				ItemEnchantmentKind.DEFENSE,
				EnchantmentConstants.DEFENSE_MULTIPLIER
			);

			expect(multiplier).toBe(1);
		});

		it('returns 1 when the equipped enchantment does not match the requested kind', () => {
			const multiplier = EnchantmentUtils.getEnchantmentMultiplier(
				{
					weapon: { itemEnchantmentId: 'pvpAttack1' },
					armor: { itemEnchantmentId: null }
				},
				ItemEnchantmentKind.DEFENSE,
				EnchantmentConstants.DEFENSE_MULTIPLIER
			);

			expect(multiplier).toBe(1);
		});

		it('applies the multiplier of the matching weapon enchantment level', () => {
			const multiplier = EnchantmentUtils.getEnchantmentMultiplier(
				{
					weapon: { itemEnchantmentId: 'pvpAttack2' },
					armor: { itemEnchantmentId: null }
				},
				ItemEnchantmentKind.PVP_ATTACK,
				EnchantmentConstants.PVP_ATTACK_MULTIPLIER
			);

			expect(multiplier).toBe(EnchantmentConstants.PVP_ATTACK_MULTIPLIER[1]);
		});

		it('applies the multiplier of the matching armor enchantment level', () => {
			const multiplier = EnchantmentUtils.getEnchantmentMultiplier(
				{
					weapon: { itemEnchantmentId: null },
					armor: { itemEnchantmentId: 'defense3' }
				},
				ItemEnchantmentKind.DEFENSE,
				EnchantmentConstants.DEFENSE_MULTIPLIER
			);

			expect(multiplier).toBe(EnchantmentConstants.DEFENSE_MULTIPLIER[2]);
		});

		it('only inspects the slot bound to the kind (armor-kind ignores the weapon slot)', () => {
			const multiplier = EnchantmentUtils.getEnchantmentMultiplier(
				{
					weapon: { itemEnchantmentId: 'maxHealth1' },
					armor: { itemEnchantmentId: 'maxHealth3' }
				},
				ItemEnchantmentKind.MAX_HEALTH,
				EnchantmentConstants.MAX_HEALTH_MULTIPLIER
			);

			// MAX_HEALTH is an armor-slot kind, so only the armor enchantment (maxHealth3) counts
			expect(multiplier).toBe(EnchantmentConstants.MAX_HEALTH_MULTIPLIER[2]);
		});

		it('returns 1 for an unknown enchantment id', () => {
			const multiplier = EnchantmentUtils.getEnchantmentMultiplier(
				{
					weapon: { itemEnchantmentId: 'doesNotExist' },
					armor: { itemEnchantmentId: null }
				},
				ItemEnchantmentKind.PVP_ATTACK,
				EnchantmentConstants.PVP_ATTACK_MULTIPLIER
			);

			expect(multiplier).toBe(1);
		});
	});

	describe('getOutgoingDamageMultiplier', () => {
		it('returns 1 when the weapon has no attack enchantment', () => {
			expect(EnchantmentUtils.getOutgoingDamageMultiplier(
				{
					weapon: { itemEnchantmentId: null },
					armor: { itemEnchantmentId: null }
				},
				false
			)).toBe(1);
		});

		it('applies the pvpAttack enchantment only in PVP context', () => {
			const activeObjects = {
				weapon: { itemEnchantmentId: 'pvpAttack2' },
				armor: { itemEnchantmentId: null }
			};

			expect(EnchantmentUtils.getOutgoingDamageMultiplier(activeObjects, false)).toBe(EnchantmentConstants.PVP_ATTACK_MULTIPLIER[1]);
			expect(EnchantmentUtils.getOutgoingDamageMultiplier(activeObjects, true)).toBe(1);
		});

		it('applies the pveAttack enchantment only in PVE context', () => {
			const activeObjects = {
				weapon: { itemEnchantmentId: 'pveAttack2' },
				armor: { itemEnchantmentId: null }
			};

			expect(EnchantmentUtils.getOutgoingDamageMultiplier(activeObjects, false)).toBe(1);
			expect(EnchantmentUtils.getOutgoingDamageMultiplier(activeObjects, true)).toBe(EnchantmentConstants.PVE_ATTACK_MULTIPLIER[1]);
		});

		it('applies the allAttack enchantment in both PVP and PVE contexts', () => {
			const activeObjects = {
				weapon: { itemEnchantmentId: 'allAttack3' },
				armor: { itemEnchantmentId: null }
			};

			expect(EnchantmentUtils.getOutgoingDamageMultiplier(activeObjects, false)).toBe(EnchantmentConstants.ALL_ATTACK_MULTIPLIER[2]);
			expect(EnchantmentUtils.getOutgoingDamageMultiplier(activeObjects, true)).toBe(EnchantmentConstants.ALL_ATTACK_MULTIPLIER[2]);
		});
	});

	describe('getIncomingDamageMultiplier', () => {
		it('returns 1 when the armor has no defense enchantment', () => {
			expect(EnchantmentUtils.getIncomingDamageMultiplier(
				{
					weapon: { itemEnchantmentId: null },
					armor: { itemEnchantmentId: null }
				}
			)).toBe(1);
		});

		it('reduces incoming damage by the reciprocal of the defense multiplier', () => {
			const multiplier = EnchantmentUtils.getIncomingDamageMultiplier({
				weapon: { itemEnchantmentId: null },
				armor: { itemEnchantmentId: 'defense3' }
			});

			expect(multiplier).toBeCloseTo(1 / EnchantmentConstants.DEFENSE_MULTIPLIER[2]);
			expect(multiplier).toBeLessThan(1);
		});
	});

	describe('getWeaponAlterationEnchantment', () => {
		it('returns null when the weapon has no enchantment', () => {
			expect(EnchantmentUtils.getWeaponAlterationEnchantment(null)).toBeNull();
		});

		it('returns null when the weapon enchantment is not a damage-over-time enchantment', () => {
			expect(EnchantmentUtils.getWeaponAlterationEnchantment('pvpAttack1')).toBeNull();
		});

		it('resolves the burned alteration boost for burnedDamage1', () => {
			const result = EnchantmentUtils.getWeaponAlterationEnchantment('burnedDamage1');

			expect(result).toEqual({
				alterationId: FightAlterations.BURNED,
				multiplier: EnchantmentConstants.BURNED_DAMAGE_BONUS_MULTIPLIER
			});
		});

		it('resolves the frozen alteration boost for frozenDamage1', () => {
			const result = EnchantmentUtils.getWeaponAlterationEnchantment('frozenDamage1');

			expect(result).toEqual({
				alterationId: FightAlterations.FROZEN,
				multiplier: EnchantmentConstants.FROZEN_DAMAGE_BONUS_MULTIPLIER
			});
		});

		it('resolves the poisoned alteration boost for poisonedDamage1', () => {
			const result = EnchantmentUtils.getWeaponAlterationEnchantment('poisonedDamage1');

			expect(result).toEqual({
				alterationId: FightAlterations.POISONED,
				multiplier: EnchantmentConstants.POISONED_DAMAGE_BONUS_MULTIPLIER
			});
		});
	});
});
