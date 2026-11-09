import {
	CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {
	cityRowEnd, cityRowSubtitle
} from "@/src/collectors/CityRowDetails";
import { cityRowTitle } from "@/src/collectors/CityRowTitle";
import { cityReactionAvailable } from "@/src/collectors/CityReactionAvailability";
import { cityReactionLock } from "@/src/collectors/CityReactionLocks";

const WEAPON = 0;
const NOW = Date.UTC(2026, 9, 20, 12);
const CITY_DATA = {
	type: "city", data: {}
} as never;

function transfer(targetSlot: number): ReactionCollectorReaction {
	return {
		type: CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER,
		data: {
			itemCategory: WEAPON, sourceSlot: 0, targetSlot
		}
	} as ReactionCollectorReaction;
}

const forge: CityMobileSnapshot = { blacksmith: {
	playerMoney: 500,
	upgradeableItems: [],
	enchantmentTransfers: [
		{
			slot: 0,
			itemId: 12,
			itemCategory: WEAPON,
			itemLevel: 2,
			enchantmentId: "attack1",
			enchantmentType: "damage",
			targets: [
				{
					slot: 1, itemId: 7, itemCategory: WEAPON, itemLevel: 1, cost: 300, canAfford: true
				},
				{
					slot: 2, itemId: 8, itemCategory: WEAPON, itemLevel: 1, cost: 3000, canAfford: false
				}
			]
		}
	]
} };

describe("blacksmith enchantment transfer", () => {
	it("names the equipment losing its enchantment, the one receiving it and the price on its row", () => {
		expect(cityRowTitle(transfer(1), CITY_DATA, forge)).toBe("Seringue infectée");
		expect(cityRowSubtitle(transfer(1), forge)).toMatch(/· vers /u);
		expect(cityRowSubtitle(transfer(2), forge)).toMatch(/vers Percingasiteur$/u);
		expect(cityRowEnd(transfer(1), forge)).toMatch(/^300 /u);
	});

	it("locks a transfer the player cannot pay for, saying how much is missing, before any tap", () => {
		expect(cityReactionAvailable(transfer(1), forge, NOW)).toBe(true);
		expect(cityReactionAvailable(transfer(2), forge, NOW)).toBe(false);
		expect(cityReactionLock(transfer(2), forge, NOW)?.reason).toMatch(/2[\s  ]?500/u);
	});
});
