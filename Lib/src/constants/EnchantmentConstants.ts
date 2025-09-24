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

	static BURNED_DAMAGE_BONUS_MULTIPLIER = 1.1;

	static POISONED_DAMAGE_BONUS_MULTIPLIER = 1.1;

	static FROZEN_DAMAGE_BONUS_MULTIPLIER = 1.1;
}
