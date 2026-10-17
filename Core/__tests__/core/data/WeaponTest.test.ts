import {describe, expect, it} from 'vitest';
import {Weapon} from '../../../src/data/Weapon';
import {InventoryConstants} from '../../../../Lib/src/constants/InventoryConstants';
import {ItemCategory, ItemConstants} from '../../../../Lib/src/constants/ItemConstants';

// Test subclass to expose protected members
class TestWeapon extends Weapon {
	public setProps(p: {
		rarity?: string;
		rawAttack?: number;
		attack?: number;
		defense?: number;
	}) {
		if (p.rarity !== undefined) (this as any).rarity = p.rarity;
		if (p.rawAttack !== undefined) (this as any).rawAttack = p.rawAttack;
		if (p.attack !== undefined) (this as any).attack = p.attack;
		if (p.defense !== undefined) (this as any).defense = p.defense;
	}
	public exposeBaseAttack() {
		// @ts-ignore accessing protected
		return this.getBaseAttack();
	}
	public exposeBaseDefense() {
		// @ts-ignore accessing protected
		return this.getBaseDefense();
	}
}

describe('Weapon', () => {
	const rarityKey = Object.keys(InventoryConstants.ITEMS_MAPPER)[0];
	const rarityMultiplier = InventoryConstants.ITEMS_MAPPER[rarityKey];
	const levelMultipliers = ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER;

	it('getCategory returns WEAPON', () => {
		const w = new TestWeapon();
		expect(w.getCategory()).toBe(ItemCategory.WEAPON);
	});

	it('getBaseAttack computes expected rounded formula', () => {
		const rawAttack = 5;
		const bonusAttack = 7;
		const w = new TestWeapon();
		w.setProps({ rarity: rarityKey, rawAttack, attack: bonusAttack });
		expect(w.exposeBaseAttack()).toBe(10);
	});

	it('getAttack scales base attack with level multiplier', () => {
		const rawAttack = 4;
		const bonusAttack = 3;
		const level = 2;
		const w = new TestWeapon();
		w.setProps({ rarity: rarityKey, rawAttack, attack: bonusAttack });
		expect(w.getAttack(level)).toBe(6);
	});

	it('getAttack returns 0 when computed base attack is 0 (non-positive path)', () => {
		const rawAttack = 3;
		const w = new TestWeapon();
		// Set attack to negate it to reach zero
		w.setProps({ rarity: rarityKey, rawAttack, attack: -2 });
		expect(w.exposeBaseAttack()).toBe(0);
		expect(w.getAttack(5)).toBe(0);
	});

	it('getItemAddedValue returns rawAttack', () => {
		const rawAttack = 9;
		const w = new TestWeapon();
		w.setProps({ rarity: rarityKey, rawAttack });
		expect(w.getItemAddedValue()).toBe(rawAttack);
	});

	it('getBaseDefense returns defense or 0', () => {
		const w = new TestWeapon();
		w.setProps({ defense: 12 });
		expect(w.exposeBaseDefense()).toBe(12);
		const w2 = new TestWeapon();
		expect(w2.exposeBaseDefense()).toBe(0);
	});

	it('getDefense scales defense with level multiplier', () => {
		const defense = 10;
		const level = 3;
		const w = new TestWeapon();
		w.setProps({ defense });
		expect(w.getDefense(level)).toBe(12);
	});

	it('getDefense returns 0 when defense is 0', () => {
		const w = new TestWeapon();
		w.setProps({ defense: 0 });
		expect(w.getDefense(4)).toBe(0);
	});

	it('rounding consistency for attack at multiple levels', () => {
		const rawAttack = 2;
		const bonusAttack = 1;
		const w = new TestWeapon();
		w.setProps({ rarity: rarityKey, rawAttack, attack: bonusAttack });
		const computedAttack = [];
		for (let lvl = 0; lvl < levelMultipliers.length; lvl++) {
			computedAttack.push(w.getAttack(lvl));
		}
		expect(computedAttack).toEqual([3, 3, 3, 3, 4, 4]);
	});

	it('rounding consistency for defense at multiple levels', () => {
		const defense = 5;
		const w = new TestWeapon();
		w.setProps({ defense });
		const computedDefense = [];
		for (let lvl = 0; lvl < levelMultipliers.length; lvl++) {
			computedDefense.push(w.getDefense(lvl));
		}
		expect(computedDefense).toEqual([ 5, 5, 6, 6, 6, 7 ]);
	});
});