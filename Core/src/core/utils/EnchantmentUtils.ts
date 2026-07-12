import {
	ItemEnchantment, ItemEnchantmentKind
} from "../../../../Lib/src/types/ItemEnchantment";
import { EnchantmentConstants } from "../../../../Lib/src/constants/EnchantmentConstants";
import { FightAlterations } from "../fights/actions/FightAlterations";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";

/**
 * Minimal shape needed to resolve weapon/armor enchantments, structurally compatible with {@link PlayerActiveObjects}
 */
export type EnchantableActiveObjects = {
	weapon: { itemEnchantmentId: string | null };
	armor: { itemEnchantmentId: string | null };
};

type WeaponAlterationEnchantment = {
	alterationId: string;
	multiplier: number;
	protectedAlterationId: string;
};

/**
 * Maps a weapon damage-over-time enchantment kind to the fight alteration it boosts (`alterationId`) and to the
 * alteration it protects the wielder against (`protectedAlterationId`). Elemental opposites protect each other
 * (fire resists frozen, frozen resists burned); the poison enchantment protects against poison itself.
 */
const WEAPON_ALTERATION_ENCHANTMENTS: (WeaponAlterationEnchantment & { kind: ItemEnchantmentKind })[] = [
	{
		kind: ItemEnchantmentKind.BURNED_DAMAGE,
		alterationId: FightAlterations.BURNED,
		multiplier: EnchantmentConstants.BURNED_DAMAGE_BONUS_MULTIPLIER,
		protectedAlterationId: FightAlterations.FROZEN
	},
	{
		kind: ItemEnchantmentKind.FROZEN_DAMAGE,
		alterationId: FightAlterations.FROZEN,
		multiplier: EnchantmentConstants.FROZEN_DAMAGE_BONUS_MULTIPLIER,
		protectedAlterationId: FightAlterations.BURNED
	},
	{
		kind: ItemEnchantmentKind.POISONED_DAMAGE,
		alterationId: FightAlterations.POISONED,
		multiplier: EnchantmentConstants.POISONED_DAMAGE_BONUS_MULTIPLIER,
		protectedAlterationId: FightAlterations.POISONED
	}
];

export abstract class EnchantmentUtils {
	/**
	 * Return the multiplier granted by the enchantment of the given kind, or 1 if none is equipped.
	 *
	 * Each {@link ItemEnchantmentKind} is bound to a single slot (weapon or armor), and an item can only
	 * carry an enchantment valid for its own slot, so only the slot matching `kind.slot` is inspected.
	 * @param activeObjects
	 * @param kind
	 * @param multipliers
	 */
	static getEnchantmentMultiplier(activeObjects: EnchantableActiveObjects, kind: ItemEnchantmentKind, multipliers: readonly number[]): number {
		const slotEnchantmentId = kind.slot === ItemCategory.WEAPON
			? activeObjects.weapon.itemEnchantmentId
			: activeObjects.armor.itemEnchantmentId;
		const enchant = slotEnchantmentId ? ItemEnchantment.getById(slotEnchantmentId) : null;
		return enchant?.kind === kind ? multipliers[enchant.level - 1] ?? 1 : 1;
	}

	/**
	 * Return the multiplier applied to the effective damage dealt by a fighter, granted by its weapon attack
	 * enchantments. Combines the context-specific attack enchantment (PVP or PVE) with the all-context one.
	 * @param activeObjects
	 * @param isPvE True when the fight is against a monster (PVE), false against another player (PVP)
	 */
	static getOutgoingDamageMultiplier(activeObjects: EnchantableActiveObjects, isPvE: boolean): number {
		const targetedMultiplier = EnchantmentUtils.getEnchantmentMultiplier(
			activeObjects,
			isPvE ? ItemEnchantmentKind.PVE_ATTACK : ItemEnchantmentKind.PVP_ATTACK,
			isPvE ? EnchantmentConstants.PVE_ATTACK_MULTIPLIER : EnchantmentConstants.PVP_ATTACK_MULTIPLIER
		);
		const allAttackMultiplier = EnchantmentUtils.getEnchantmentMultiplier(activeObjects, ItemEnchantmentKind.ALL_ATTACK, EnchantmentConstants.ALL_ATTACK_MULTIPLIER);
		return targetedMultiplier * allAttackMultiplier;
	}

	/**
	 * Return the multiplier applied to the effective damage received by a fighter, granted by its armor defense
	 * enchantment. A defense enchantment reduces incoming damage, so the returned value is the reciprocal of the
	 * defense multiplier `m` (incoming damage is scaled by `1 / m`, i.e. below 1).
	 * @param activeObjects
	 */
	static getIncomingDamageMultiplier(activeObjects: EnchantableActiveObjects): number {
		const defenseMultiplier = EnchantmentUtils.getEnchantmentMultiplier(activeObjects, ItemEnchantmentKind.DEFENSE, EnchantmentConstants.DEFENSE_MULTIPLIER);
		return 1 / defenseMultiplier;
	}

	/**
	 * Return true if the given item enchantment id matches the requested kind. Used for flat (non-multiplicative)
	 * bonuses such as the base/max breath enchantments.
	 * @param itemEnchantmentId
	 * @param kind
	 */
	static hasEnchantmentOfKind(itemEnchantmentId: string | null, kind: ItemEnchantmentKind): boolean {
		const enchant = itemEnchantmentId ? ItemEnchantment.getById(itemEnchantmentId) : null;
		return enchant?.kind === kind;
	}

	/**
	 * Return the fight alteration id and damage multiplier boosted by a weapon's damage-over-time enchantment
	 * (burned/frozen/poisoned), along with the alteration it protects the wielder against, or null if the weapon
	 * has no such enchantment.
	 * @param weaponEnchantmentId
	 */
	static getWeaponAlterationEnchantment(weaponEnchantmentId: string | null): WeaponAlterationEnchantment | null {
		const weaponEnchant = weaponEnchantmentId ? ItemEnchantment.getById(weaponEnchantmentId) : null;
		if (!weaponEnchant) {
			return null;
		}
		const match = WEAPON_ALTERATION_ENCHANTMENTS.find(entry => entry.kind === weaponEnchant.kind);
		if (!match) {
			return null;
		}
		return {
			alterationId: match.alterationId,
			multiplier: match.multiplier,
			protectedAlterationId: match.protectedAlterationId
		};
	}
}
