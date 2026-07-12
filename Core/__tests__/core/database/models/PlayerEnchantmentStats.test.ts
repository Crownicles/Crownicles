import {
	describe, expect, it
} from 'vitest';
import Player from '../../../../src/core/database/game/models/Player';
import { ClassDataController } from '../../../../src/data/Class';
import { PlayerActiveObjects } from '../../../../src/core/database/game/models/PlayerActiveObjects';

/**
 * Build a bare Player instance without going through Sequelize's constructor/DB,
 * only setting the fields read by the stat calculation methods under test.
 */
function buildPlayer(level: number, classId: number): Player {
	const player = Object.create(Player.prototype) as Player;
	player.level = level;
	player.class = classId;
	return player;
}

function buildActiveObjects(params: {
	weaponEnchantmentId?: string | null;
	armorEnchantmentId?: string | null;
}): PlayerActiveObjects {
	const zeroStatsItem = {
		getAttack: () => 0,
		getDefense: () => 0,
		getSpeed: () => 0
	};

	return {
		weapon: {
			item: zeroStatsItem as PlayerActiveObjects['weapon']['item'],
			itemLevel: 0,
			itemEnchantmentId: params.weaponEnchantmentId ?? null
		},
		armor: {
			item: zeroStatsItem as PlayerActiveObjects['armor']['item'],
			itemLevel: 0,
			itemEnchantmentId: params.armorEnchantmentId ?? null
		},
		potion: { item: zeroStatsItem as PlayerActiveObjects['potion']['item'] },
		object: { item: zeroStatsItem as PlayerActiveObjects['object']['item'] }
	};
}

const CLASS_ID = 0;
const LEVEL = 10;

describe('Player enchantment stat calculations', () => {
	describe('getCumulativeAttack', () => {
		it('returns the base attack when no enchantment is equipped', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseAttack = player.getMaxStatsValue().attack;

			expect(player.getCumulativeAttack(buildActiveObjects({}))).toBe(baseAttack);
		});

		it('ignores attack enchantments: they act as an effective-damage multiplier, not a stat bonus', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseAttack = player.getMaxStatsValue().attack;

			expect(player.getCumulativeAttack(buildActiveObjects({ weaponEnchantmentId: 'pvpAttack2' }))).toBe(baseAttack);
			expect(player.getCumulativeAttack(buildActiveObjects({ weaponEnchantmentId: 'pveAttack2' }))).toBe(baseAttack);
			expect(player.getCumulativeAttack(buildActiveObjects({ weaponEnchantmentId: 'allAttack2' }))).toBe(baseAttack);
		});
	});

	describe('getCumulativeDefense', () => {
		it('returns the base defense when no enchantment is equipped', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseDefense = player.getMaxStatsValue().defense;

			expect(player.getCumulativeDefense(buildActiveObjects({}))).toBe(baseDefense);
		});

		it('ignores the defense enchantment: it acts as an incoming-damage multiplier, not a stat bonus', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseDefense = player.getMaxStatsValue().defense;

			expect(player.getCumulativeDefense(buildActiveObjects({ armorEnchantmentId: 'defense3' }))).toBe(baseDefense);
		});
	});

	describe('getCumulativeSpeed', () => {
		it('returns the base speed when no enchantment is equipped', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseSpeed = player.getMaxStatsValue().speed;

			expect(player.getCumulativeSpeed(buildActiveObjects({}))).toBe(baseSpeed);
		});

		it('applies the speed armor enchantment', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseSpeed = player.getMaxStatsValue().speed;
			const activeObjects = buildActiveObjects({ armorEnchantmentId: 'speed3' });

			expect(player.getCumulativeSpeed(activeObjects)).toBeGreaterThan(baseSpeed);
		});
	});

	describe('getMaxHealth / getMaxCumulativeEnergy', () => {
		it('applies the maxHealth armor enchantment', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseHealth = player.getMaxHealthBase();
			const activeObjects = buildActiveObjects({ armorEnchantmentId: 'maxHealth3' });

			expect(player.getMaxHealth(activeObjects)).toBeGreaterThan(baseHealth);
			expect(player.getMaxHealth(buildActiveObjects({}))).toBe(baseHealth);
		});

		it('applies the maxEnergy armor enchantment', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const baseEnergy = player.getMaxCumulativeEnergy(buildActiveObjects({}));
			const activeObjects = buildActiveObjects({ armorEnchantmentId: 'maxEnergy3' });

			expect(player.getMaxCumulativeEnergy(activeObjects)).toBeGreaterThan(baseEnergy);
		});
	});

	describe('getBaseBreath / getMaxBreath', () => {
		it('returns the class base values without an active objects argument', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const playerClass = ClassDataController.instance.getById(CLASS_ID)!;

			expect(player.getBaseBreath()).toBe(playerClass.baseBreath);
			expect(player.getMaxBreath()).toBe(playerClass.maxBreath);
		});

		it('adds the flat bonus when the baseBreath weapon enchantment is equipped', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const playerClass = ClassDataController.instance.getById(CLASS_ID)!;
			const activeObjects = buildActiveObjects({ weaponEnchantmentId: 'baseBreath1' });

			expect(player.getBaseBreath(activeObjects)).toBe(playerClass.baseBreath + 1);
			expect(player.getBaseBreath(buildActiveObjects({}))).toBe(playerClass.baseBreath);
		});

		it('adds the flat bonus when the maxBreath armor enchantment is equipped', () => {
			const player = buildPlayer(LEVEL, CLASS_ID);
			const playerClass = ClassDataController.instance.getById(CLASS_ID)!;
			const activeObjects = buildActiveObjects({ armorEnchantmentId: 'maxBreath1' });

			expect(player.getMaxBreath(activeObjects)).toBe(playerClass.maxBreath + 3);
			expect(player.getMaxBreath(buildActiveObjects({}))).toBe(playerClass.maxBreath);
		});
	});
});
