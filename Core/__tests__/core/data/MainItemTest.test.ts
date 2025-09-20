import {describe, expect, it} from 'vitest';
import {MainItem} from '../../../src/data/MainItem';
import {InventoryConstants} from '../../../../Lib/src/constants/InventoryConstants';
import {ItemConstants} from '../../../../Lib/src/constants/ItemConstants';

// Concrete implementation for testing
class TestMainItem extends MainItem {
	constructor(
		public readonly id: string,
		public readonly rarity: string,
		rawAttack?: number,
		rawDefense?: number,
		speed?: number
	) {
		super();
		(this as any).rawAttack = rawAttack;
		(this as any).rawDefense = rawDefense;
		(this as any).speed = speed;
	}

	// Assume a simple category
	public getCategory(): string {
		return 'TEST_CATEGORY';
	}

	protected getBaseAttack(): number {
		return this.rawAttack ?? 0;
	}

	protected getBaseDefense(): number {
		return this.rawDefense ?? 0;
	}

	public getAttack(itemLevel: number): number {
		const base = this.getBaseAttack();
		return Math.round(base * this.multiplier() * MainItem.getStatMultiplier(itemLevel));
	}

	public getDefense(itemLevel: number): number {
		const base = this.getBaseDefense();
		return Math.round(base * this.multiplier() * MainItem.getStatMultiplier(itemLevel));
	}

	// Expose protected multiplier for testing
	public exposeMultiplier(): number {
		return this.multiplier();
	}
}

describe('MainItem', () => {
	const firstRarity = Object.keys(InventoryConstants.ITEMS_MAPPER)[0];
	const rarityMultiplier = InventoryConstants.ITEMS_MAPPER[firstRarity];
	const levelMultipliers = ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER;
	const lastLevelIndex = levelMultipliers.length - 1;

	it('getStatMultiplier: clamps negative level to 0', () => {
		expect(MainItem.getStatMultiplier(-10)).toBe(levelMultipliers[0]);
	});

	it('getStatMultiplier: clamps level above max to last value', () => {
		expect(MainItem.getStatMultiplier(9999)).toBe(levelMultipliers[lastLevelIndex]);
	});

	it('getStatMultiplier: returns exact middle value', () => {
		const mid = Math.floor(levelMultipliers.length / 2);
		expect(MainItem.getStatMultiplier(mid)).toBe(levelMultipliers[mid]);
	});

	it('multiplier: returns rarity-based multiplier', () => {
		const item = new TestMainItem('id1', firstRarity, 10, 5, 2);
		expect(item.exposeMultiplier()).toBe(rarityMultiplier);
	});

	it('getSpeed: returns 0 when no base speed', () => {
		const item = new TestMainItem('id2', firstRarity, 10, 5, undefined);
		expect(item.getSpeed(3)).toBe(0);
	});

	it('getSpeed: applies multiplier and rounds', () => {
		const itemLevel = 2;
		const baseSpeed = 3;
		const item = new TestMainItem('id3', firstRarity, 10, 5, baseSpeed);
		const expected = 3;
		expect(item.getSpeed(itemLevel)).toBe(expected);
	});

	it('getDisplayPacket: builds correct structure with defaults', () => {
		const level = 1;
		const baseAttack = 12;
		const baseDefense = 7;
		const baseSpeed = 4;
		const item = new TestMainItem('id4', firstRarity, baseAttack, baseDefense, baseSpeed);

		const packet = item.getDisplayPacket(level);

		expect(packet.id).toBe('id4');
		expect(packet.itemLevel).toBe(level);
		expect(packet.itemCategory).toBe('TEST_CATEGORY');
		expect(packet.attack.baseValue).toBe(baseAttack);
		expect(packet.defense.baseValue).toBe(baseDefense);
		expect(packet.speed.baseValue).toBe(baseSpeed);
		expect(packet.attack.upgradeValue).toBe(item.getAttack(level) - baseAttack);
		expect(packet.defense.upgradeValue).toBe(item.getDefense(level) - baseDefense);
		expect(packet.speed.upgradeValue).toBe(item.getSpeed(level) - baseSpeed);
		expect(packet.attack.maxValue).toBe(Infinity);
		expect(packet.defense.maxValue).toBe(Infinity);
		expect(packet.speed.maxValue).toBe(Infinity);
	});

	it('getDisplayPacket: respects provided maxStatsValue and enchantment id', () => {
		const item = new TestMainItem('id5', firstRarity, 5, 9, 2);
		const maxStats = { attack: 50, defense: 40, speed: 30 };
		const packet = item.getDisplayPacket(3, 'ench123', maxStats);
		expect(packet.itemEnchantmentId).toBe('ench123');
		expect(packet.attack.maxValue).toBe(50);
		expect(packet.defense.maxValue).toBe(40);
		expect(packet.speed.maxValue).toBe(30);
	});

	it('getDisplayPacket: upgrade values are zero at level 0', () => {
		const item = new TestMainItem('id6', firstRarity, 8, 6, 1);
		const packet = item.getDisplayPacket(0);
		expect(packet.attack.upgradeValue).toBe(0);
		expect(packet.defense.upgradeValue).toBe(0);
		expect(packet.speed.upgradeValue).toBe(0);
	});
});