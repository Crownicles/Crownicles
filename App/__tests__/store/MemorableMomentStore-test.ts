import { ItemRarity } from "ws-packets/src/objects/ItemRarity";
import { ItemWithDetails } from "ws-packets/src/objects/ItemWithDetails";
import {
	MEMORABLE_MOMENT_KINDS, memorableMomentStore
} from "@/src/store/MemorableMomentStore";

const PROGRESS = {
	owned: 2, total: 29
};
const AT = 1_790_000_000_000;

function item(rarity: ItemRarity): ItemWithDetails {
	const stat = (baseValue: number): {
		baseValue: number; upgradeValue: number; maxValue: number;
	} => ({
		baseValue, upgradeValue: 0, maxValue: baseValue
	});
	return {
		id: 12, rarity, itemCategory: 0, itemLevel: 0, attack: stat(90), defense: stat(0), speed: stat(0)
	};
}

function drain(): string[] {
	const kinds: string[] = [];
	for (let moment = memorableMomentStore.getSnapshot(); moment; moment = memorableMomentStore.getSnapshot()) {
		kinds.push(moment.kind);
		memorableMomentStore.dismiss();
	}
	return kinds;
}

describe("MemorableMomentStore", () => {
	beforeEach((): void => {
		drain();
	});

	it("queues the badges Core still lists, with how many the player now owns", () => {
		memorableMomentStore.announceBadges(["legendary_pet", "rich"], PROGRESS);

		expect(memorableMomentStore.getSnapshot()).toEqual(expect.objectContaining({
			kind: MEMORABLE_MOMENT_KINDS.BADGE, badge: "legendary_pet", ...PROGRESS
		}));
		expect(drain()).toEqual([MEMORABLE_MOMENT_KINDS.BADGE, MEMORABLE_MOMENT_KINDS.BADGE]);
	});

	it("queues a badge once per session, even when Core lists it again before the acknowledgement lands", () => {
		memorableMomentStore.announceBadges(["top_week"], PROGRESS);
		memorableMomentStore.announceBadges(["top_week"], PROGRESS);
		memorableMomentStore.dismiss();
		memorableMomentStore.announceBadges(["top_week"], PROGRESS);

		expect(memorableMomentStore.getSnapshot()).toBeNull();
	});

	it("queues the mythical finds and boss records Core kept, dated when they happened, and skips its other reveals", () => {
		memorableMomentStore.announceReveals([
			{ id: 1 },
			{
				id: 2,
				memorable: {
					at: AT, mythicItem: item(ItemRarity.MYTHICAL)
				}
			},
			{
				id: 3,
				memorable: {
					at: AT,
					bossRecord: {
						monsterId: "kraken", monsterLevel: 80, classId: 7
					}
				}
			}
		]);

		expect(memorableMomentStore.getSnapshot()).toEqual(expect.objectContaining({
			kind: MEMORABLE_MOMENT_KINDS.MYTHIC_ITEM, revealId: 2, at: AT
		}));
		expect(drain()).toEqual([MEMORABLE_MOMENT_KINDS.MYTHIC_ITEM, MEMORABLE_MOMENT_KINDS.BOSS_RECORD]);
	});

	it("queues a kept moment once per session, even when Core lists it again before the acknowledgement lands", () => {
		const reveal = {
			id: 4,
			memorable: {
				at: AT,
				bossRecord: {
					monsterId: "kraken", monsterLevel: 80, classId: 7
				}
			}
		};
		memorableMomentStore.announceReveals([reveal]);
		memorableMomentStore.dismiss();
		memorableMomentStore.announceReveals([reveal]);

		expect(memorableMomentStore.getSnapshot()).toBeNull();
	});
});
