import {
	ItemEnchantment, ItemEnchantmentKind
} from "../../../../Lib/src/types/ItemEnchantment";
import { EnchantmentConstants } from "../../../../Lib/src/constants/EnchantmentConstants";
import { FightAlterations } from "../fights/actions/FightAlterations";

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
};

/**
 * Maps a weapon damage-over-time enchantment kind to the fight alteration it boosts
 */
const WEAPON_ALTERATION_ENCHANTMENTS: (WeaponAlterationEnchantment & { kind: ItemEnchantmentKind })[] = [
	{
		kind: ItemEnchantmentKind.BURNED_DAMAGE,
		alterationId: FightAlterations.BURNED,
		multiplier: EnchantmentConstants.BURNED_DAMAGE_BONUS_MULTIPLIER
	},
	{
		kind: ItemEnchantmentKind.FROZEN_DAMAGE,
		alterationId: FightAlterations.FROZEN,
		multiplier: EnchantmentConstants.FROZEN_DAMAGE_BONUS_MULTIPLIER
	},
	{
		kind: ItemEnchantmentKind.POISONED_DAMAGE,
		alterationId: FightAlterations.POISONED,
		multiplier: EnchantmentConstants.POISONED_DAMAGE_BONUS_MULTIPLIER
	}
];

export abstract class EnchantmentUtils {
	/**
	 * Return the multiplier granted by a weapon/armor enchantment of the given kind, or 1 if none is equipped.
	 * Multipliers from the weapon and armor slots stack multiplicatively.
	 * @param activeObjects
	 * @param kind
	 * @param multipliers
	 */
	static getEnchantmentMultiplier(activeObjects: EnchantableActiveObjects, kind: ItemEnchantmentKind, multipliers: readonly number[]): number {
		const weaponEnchant = activeObjects.weapon.itemEnchantmentId ? ItemEnchantment.getById(activeObjects.weapon.itemEnchantmentId) : null;
		const armorEnchant = activeObjects.armor.itemEnchantmentId ? ItemEnchantment.getById(activeObjects.armor.itemEnchantmentId) : null;
		return (weaponEnchant?.kind === kind ? multipliers[weaponEnchant.level - 1] ?? 1 : 1)
			* (armorEnchant?.kind === kind ? multipliers[armorEnchant.level - 1] ?? 1 : 1);
	}

	/**
	 * Return the fight alteration id and damage multiplier granted by a weapon's damage-over-time enchantment
	 * (burned/frozen/poisoned), or null if the weapon has no such enchantment.
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
			multiplier: match.multiplier
		};
	}
}
