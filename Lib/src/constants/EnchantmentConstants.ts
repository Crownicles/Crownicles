export abstract class EnchantmentConstants {
	static PVP_ATTACK_MULTIPLIER: [number, number, number] = [
		1.02,
		1.04,
		1.06
	];

	static PVE_ATTACK_MULTIPLIER: [number, number, number] = [
		1.02,
		1.04,
		1.06
	];

	static ALL_ATTACK_MULTIPLIER: [number, number, number] = [
		1.01,
		1.02,
		1.03
	];

	static DEFENSE_MULTIPLIER: [number, number, number] = [
		1.03,
		1.06,
		1.09
	];

	static SPEED_MULTIPLIER: [number, number, number] = [
		1.03,
		1.06,
		1.09
	];

	static MAX_ENERGY_MULTIPLIER = [
		1.05,
		1.1,
		1.15
	];

	static MAX_HEALTH_MULTIPLIER = [
		1.05,
		1.1,
		1.15
	];

	static BASE_BREATH_BONUS = 1;

	static MAX_BREATH_BONUS = 3;

	static BURNED_DAMAGE_BONUS_MULTIPLIER = 1.2;

	static POISONED_DAMAGE_BONUS_MULTIPLIER = 1.2;

	static FROZEN_DAMAGE_BONUS_MULTIPLIER = 1.2;

	/**
	 * Damage multiplier applied to the damage-over-time alteration a weapon damage enchantment protects against.
	 * Elemental opposites protect each other: the fire (burned) enchantment resists frozen, the frozen enchantment
	 * resists burned; the poison enchantment resists poison (acquired tolerance). Below 1, it grants a small resistance.
	 */
	static DOT_ENCHANT_RESISTANCE_MULTIPLIER = 0.75;

	static PROBABILITY_WEIGHT_TO_COST = {
		MONEY: [
			10000,
			8500,
			7000,
			6000,
			5000,
			4000,
			2500,
			1000
		],
		GEMS: [
			20,
			18,
			15,
			12,
			9,
			6,
			3,
			0
		]
	};

	static ENCHANTMENT_MAGE_REDUCTION = 0.8;

	static LOOT_ENCHANTMENT_CHANCE = 0.05;
}
