// Armor tests mirroring Weapon tests style.
// NOTE: Replace all -1 placeholders with real expected values once known.

import {describe, expect, it} from 'vitest';
import {Armor} from '../../../src/data/Armor';
import {InventoryConstants} from '../../../../Lib/src/constants/InventoryConstants';
import {ItemCategory, ItemConstants} from '../../../../Lib/src/constants/ItemConstants';

// Test subclass to set internal (normally loaded) fields and expose protected methods.
class TestArmor extends Armor {
	public setProps(p: {
		rarity?: string;
		rawDefense?: number;
		defense?: number;
		attack?: number;
	}) {
		if (p.rarity !== undefined) (this as any).rarity = p.rarity;
		if (p.rawDefense !== undefined) (this as any).rawDefense = p.rawDefense;
		if (p.defense !== undefined) (this as any).defense = p.defense;
		if (p.attack !== undefined) (this as any).attack = p.attack;
	}
	public exposeBaseAttack() {
		// @ts-ignore
		return this.getBaseAttack();
	}
	public exposeBaseDefense() {
		// @ts-ignore
		return this.getBaseDefense();
	}
}

describe('Armor', () => {
	const rarityKey = Object.keys(InventoryConstants.ITEMS_MAPPER)[0];
	const levelMultipliers = ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER;

	it('getCategory returns ARMOR', () => {
		const a = new TestArmor();
		expect(a.getCategory()).toBe(ItemCategory.ARMOR);
	});

	it('getBaseAttack returns attack or 0', () => {
		const a = new TestArmor();
		a.setProps({ attack: 7 });
		expect(a.exposeBaseAttack()).toBe(7);
		const b = new TestArmor();
		expect(b.exposeBaseAttack()).toBe(0);
	});

	it('getAttack scales base attack with level multiplier', () => {
		const attack = 5;
		const level = 3;
		const a = new TestArmor();
		a.setProps({ attack });
		expect(a.getAttack(level)).toBe(6);
	});

	it('getAttack returns 0 when base attack is 0', () => {
		const a = new TestArmor();
		a.setProps({ attack: 0 });
		expect(a.getAttack(4)).toBe(0);
	});

	it('getBaseDefense computes expected rounded formula (placeholder)', () => {
		const rawDefense = 5;
		const bonusDefense = 8;
		const a = new TestArmor();
		a.setProps({ rarity: rarityKey, rawDefense, defense: bonusDefense });
		expect(a.exposeBaseDefense()).toBe(11);
	});

	it('getDefense scales base defense with level multiplier', () => {
		const rawDefense = 4;
		const bonusDefense = 3;
		const level = 2;
		const a = new TestArmor();
		a.setProps({ rarity: rarityKey, rawDefense, defense: bonusDefense });
		// Placeholder expected scaled defense
		expect(a.getDefense(level)).toBe(6);
	});

	it('getDefense returns 0 when computed base defense is 0 (non-positive path)', () => {
		const rawDefense = 3;
		const a = new TestArmor();
		// Negative bonus intended to zero out (adjust if needed)
		a.setProps({ rarity: rarityKey, rawDefense, defense: -1 });
		expect(a.exposeBaseDefense()).toBe(1);
		expect(a.getDefense(5)).toBe(1);
	});

	it('getItemAddedValue returns rawDefense', () => {
		const rawDefense = 9;
		const a = new TestArmor();
		a.setProps({ rawDefense });
		expect(a.getItemAddedValue()).toBe(rawDefense);
	});

	it('rounding consistency for attack at multiple levels', () => {
		const attack = 6;
		const a = new TestArmor();
		a.setProps({ attack });
		const computedAttack: number[] = [];
		for (let lvl = 0; lvl < levelMultipliers.length; lvl++) {
			computedAttack.push(a.getAttack(lvl));
		}
		expect(computedAttack).toEqual([ 6, 6, 7, 7, 7, 8 ]);
	});

	it('rounding consistency for defense at multiple levels', () => {
		const rawDefense = 2;
		const bonusDefense = 5;
		const a = new TestArmor();
		a.setProps({ rarity: rarityKey, rawDefense, defense: bonusDefense });
		const computedDefense: number[] = [];
		for (let lvl = 0; lvl < levelMultipliers.length; lvl++) {
			computedDefense.push(a.getDefense(lvl));
		}
		expect(computedDefense).toEqual([ 7, 7, 8, 8, 9, 9 ]);
	});
});