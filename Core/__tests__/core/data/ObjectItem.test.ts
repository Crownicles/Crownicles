import {
	describe, expect, it
} from 'vitest';
import { ObjectItem } from '../../../src/data/ObjectItem';
import { ItemNature } from '../../../../Lib/src/constants/ItemConstants';
import { StatValues } from '../../../../Lib/src/types/StatValues';

const CLASS_STATS: StatValues = {
	attack: 10,
	defense: 20,
	speed: 30
};

function buildObjectItem(nature: ItemNature, power: number): ObjectItem {
	return Object.assign(new ObjectItem(), {
		nature,
		power
	});
}

describe('ObjectItem capped power', () => {
	it('adds at most twice the class value of the stat it boosts, and displays that same power', () => {
		const object = buildObjectItem(ItemNature.ATTACK, 50);

		expect(object.getCappedStats(CLASS_STATS)).toEqual({
			attack: 20,
			defense: 0,
			speed: 0
		});
		expect(object.getDisplayPacket(CLASS_STATS).maxPower).toBe(20);
	});

	it('adds its whole power when it stays under the cap', () => {
		const object = buildObjectItem(ItemNature.SPEED, 60);

		expect(object.getCappedStats(CLASS_STATS).speed).toBe(60);
		expect(object.getDisplayPacket(CLASS_STATS).maxPower).toBe(60);
	});

	it('displays the whole power of an object that boosts no fight stat', () => {
		const object = buildObjectItem(ItemNature.HEALTH, 50);

		expect(object.getCappedStats(CLASS_STATS)).toEqual({
			attack: 0,
			defense: 0,
			speed: 0
		});
		expect(object.getDisplayPacket(CLASS_STATS).maxPower).toBe(50);
	});
});
