import {
	describe, expect, it
} from 'vitest';
import { PlayerBaseFighter } from '../../../../src/core/fights/fighter/PlayerBaseFighter';
import { FightAction } from '../../../../src/data/FightAction';
import { FightView } from '../../../../src/core/fights/FightView';
import { FighterStatus } from '../../../../src/core/fights/FighterStatus';
import Player from '../../../../src/core/database/game/models/Player';
import { CrowniclesPacket } from '../../../../../Lib/src/packets/CrowniclesPacket';
import { PlayerActiveObjects } from '../../../../src/core/database/game/models/PlayerActiveObjects';
import { FightAlterations } from '../../../../src/core/fights/actions/FightAlterations';
import { EnchantmentConstants } from '../../../../../Lib/src/constants/EnchantmentConstants';
import { ClassDataController } from '../../../../src/data/Class';

class TestPlayerBaseFighter extends PlayerBaseFighter {
	constructor(player: Player, effectiveLevel = player.level) {
		super(player, [], effectiveLevel);
	}

	public callApplyWeaponAlterationEnchantment(playerActiveObjects: PlayerActiveObjects): void {
		this.applyWeaponAlterationEnchantment(playerActiveObjects);
	}

	public callLoadCombatStats(playerActiveObjects: PlayerActiveObjects, isPvE: boolean, includePotion = true): void {
		this.loadCombatStats(playerActiveObjects, isPvE, includePotion);
	}

	async chooseAction(_fightView: FightView, _response: CrowniclesPacket[]): Promise<void> {}

	async startFight(_fightView: FightView, _startStatus: FighterStatus, _response: CrowniclesPacket[]): Promise<void> {}

	async endFight(_winner: boolean, _response: CrowniclesPacket[], _bug: boolean, _turnCount: number): Promise<void> {}

	unblock(): void {}
}

function buildActiveObjects(weaponEnchantmentId: string | null): PlayerActiveObjects {
	return {
		weapon: {
			item: {} as PlayerActiveObjects['weapon']['item'],
			itemLevel: 0,
			itemEnchantmentId: weaponEnchantmentId
		},
		armor: {
			item: {} as PlayerActiveObjects['armor']['item'],
			itemLevel: 0,
			itemEnchantmentId: null
		},
		potion: { item: {} as PlayerActiveObjects['potion']['item'] },
		object: { item: {} as PlayerActiveObjects['object']['item'] }
	};
}

/**
 * Build a bare Player instance (no DB) exposing the stat methods called by loadCombatStats.
 */
function buildPlayer(level: number, classId: number): Player {
	const player = Object.create(Player.prototype) as Player;
	player.level = level;
	player.class = classId;
	return player;
}

/**
 * Build active objects with zero-stat items so getCumulative* returns the pure base stats,
 * allowing the enchantment damage multipliers to be asserted in isolation.
 */
function buildZeroStatActiveObjects(params: {
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

describe('PlayerBaseFighter', () => {
	describe('applyWeaponAlterationEnchantment', () => {
		it('does not set any alteration multiplier when the weapon has no enchantment', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects(null));

			expect(fighter.getAlterationMultiplier(FightAlterations.BURNED)).toBe(1);
			expect(fighter.getAlterationMultiplier(FightAlterations.FROZEN)).toBe(1);
			expect(fighter.getAlterationMultiplier(FightAlterations.POISONED)).toBe(1);
		});

		it('does not set any alteration multiplier for an unrelated weapon enchantment', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects('pvpAttack1'));

			expect(fighter.getAlterationMultiplier(FightAlterations.BURNED)).toBe(1);
		});

		it('sets the burned alteration multiplier when the weapon has the burnedDamage enchantment', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects('burnedDamage1'));

			expect(fighter.getAlterationMultiplier(FightAlterations.BURNED)).toBe(EnchantmentConstants.BURNED_DAMAGE_BONUS_MULTIPLIER);
			expect(fighter.getAlterationMultiplier(FightAlterations.FROZEN)).toBe(1);
			expect(fighter.getAlterationMultiplier(FightAlterations.POISONED)).toBe(1);
		});

		it('makes the fire enchantment resist frozen damage', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects('burnedDamage1'));

			expect(fighter.getAlterationResistanceMultiplier(FightAlterations.FROZEN)).toBe(EnchantmentConstants.DOT_ENCHANT_RESISTANCE_MULTIPLIER);
			expect(fighter.getAlterationResistanceMultiplier(FightAlterations.BURNED)).toBe(1);
		});

		it('sets the frozen alteration multiplier when the weapon has the frozenDamage enchantment', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects('frozenDamage1'));

			expect(fighter.getAlterationMultiplier(FightAlterations.FROZEN)).toBe(EnchantmentConstants.FROZEN_DAMAGE_BONUS_MULTIPLIER);
		});

		it('makes the frozen enchantment resist burned damage', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects('frozenDamage1'));

			expect(fighter.getAlterationResistanceMultiplier(FightAlterations.BURNED)).toBe(EnchantmentConstants.DOT_ENCHANT_RESISTANCE_MULTIPLIER);
			expect(fighter.getAlterationResistanceMultiplier(FightAlterations.FROZEN)).toBe(1);
		});

		it('sets the poisoned alteration multiplier when the weapon has the poisonedDamage enchantment', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects('poisonedDamage1'));

			expect(fighter.getAlterationMultiplier(FightAlterations.POISONED)).toBe(EnchantmentConstants.POISONED_DAMAGE_BONUS_MULTIPLIER);
		});

		it('makes the poison enchantment resist poison damage', () => {
			const fighter = new TestPlayerBaseFighter({ level: 10 } as Player);

			fighter.callApplyWeaponAlterationEnchantment(buildActiveObjects('poisonedDamage1'));

			expect(fighter.getAlterationResistanceMultiplier(FightAlterations.POISONED)).toBe(EnchantmentConstants.DOT_ENCHANT_RESISTANCE_MULTIPLIER);
		});
	});

	describe('loadCombatStats enchantment damage multipliers', () => {
		const LEVEL = 10;
		const CLASS_ID = 0;

		it('leaves both damage multipliers at 1 when no enchantment is equipped', () => {
			const fighter = new TestPlayerBaseFighter(buildPlayer(LEVEL, CLASS_ID));

			fighter.callLoadCombatStats(buildZeroStatActiveObjects({}), false);

			expect(fighter.getEnchantmentDamageDealtMultiplier()).toBe(1);
			expect(fighter.getEnchantmentDamageTakenMultiplier()).toBe(1);
		});

		it('applies the pvpAttack weapon enchantment to the damage dealt only in PVP', () => {
			const pvpFighter = new TestPlayerBaseFighter(buildPlayer(LEVEL, CLASS_ID));
			pvpFighter.callLoadCombatStats(buildZeroStatActiveObjects({ weaponEnchantmentId: 'pvpAttack2' }), false);
			expect(pvpFighter.getEnchantmentDamageDealtMultiplier()).toBe(EnchantmentConstants.PVP_ATTACK_MULTIPLIER[1]);

			const pveFighter = new TestPlayerBaseFighter(buildPlayer(LEVEL, CLASS_ID));
			pveFighter.callLoadCombatStats(buildZeroStatActiveObjects({ weaponEnchantmentId: 'pvpAttack2' }), true);
			expect(pveFighter.getEnchantmentDamageDealtMultiplier()).toBe(1);
		});

		it('reduces the damage taken by the reciprocal of the defense enchantment multiplier', () => {
			const fighter = new TestPlayerBaseFighter(buildPlayer(LEVEL, CLASS_ID));

			fighter.callLoadCombatStats(buildZeroStatActiveObjects({ armorEnchantmentId: 'defense3' }), false);

			expect(fighter.getEnchantmentDamageTakenMultiplier()).toBeCloseTo(1 / EnchantmentConstants.DEFENSE_MULTIPLIER[2]);
			expect(fighter.getEnchantmentDamageTakenMultiplier()).toBeLessThan(1);
		});
	});

	describe('effective level', () => {
		it('uses the effective level for stats without mutating the player', () => {
			const player = buildPlayer(99, 0);
			const fighter = new TestPlayerBaseFighter(player, 50);
			const activeObjects = buildZeroStatActiveObjects({});

			fighter.callLoadCombatStats(activeObjects, false);

			expect(fighter.level).toBe(50);
			expect(player.level).toBe(99);
			expect(fighter.getAttack()).toBe(ClassDataController.instance.getById(0)!.getAttackValue(50));
		});

		it('can exclude potion stats for tournament fights', () => {
			const player = buildPlayer(50, 0);
			const fighter = new TestPlayerBaseFighter(player);
			const activeObjects = buildZeroStatActiveObjects({});
			activeObjects.potion.item = {
				getAttack: () => 100,
				getDefense: () => 100,
				getSpeed: () => 100
			} as PlayerActiveObjects['potion']['item'];

			fighter.callLoadCombatStats(activeObjects, false, false);

			expect(fighter.getAttack()).toBe(ClassDataController.instance.getById(0)!.getAttackValue(50));
			expect(fighter.getDefense()).toBe(ClassDataController.instance.getById(0)!.getDefenseValue(50));
			expect(fighter.getSpeed()).toBe(ClassDataController.instance.getById(0)!.getSpeedValue(50));
		});
	});
});
