import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	findGuaranteedSmallEvent, SmallEventEligibility
} from "../../../src/core/report/ReportSmallEventService";
import { PlayerSmallEvents } from "../../../src/core/database/game/models/PlayerSmallEvent";
import { SmallEventDataController } from "../../../src/data/SmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { smallEventFuncs as velannaFuncs } from "../../../src/core/smallEvents/expeditionAdvice";
import { smallEventFuncs as talvarFuncs } from "../../../src/core/smallEvents/dwarfPetFan";
import { PlayerTalismansManager } from "../../../src/core/database/game/models/PlayerTalismans";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { PetDataController } from "../../../src/data/Pet";
import { DwarfPetsSeen } from "../../../src/core/database/game/models/DwarfPetsSeen";
import { PetUtils } from "../../../src/core/utils/PetUtils";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";

const eligibleEvents: SmallEventEligibility[] = [
	{
		key: "notGuaranteed",
		rarity: 10
	},
	{
		key: "guaranteed",
		rarity: 1
	}
];

const player = {
	id: 1,
	keycloakId: "keycloak",
	petId: 7,
	guildId: 3,
	level: ExpeditionConstants.TALISMAN_EVENT.TALISMAN_MIN_LEVEL
} as never;

function mockTalisman(hasTalisman: boolean): void {
	vi.spyOn(PlayerTalismansManager, "getOfPlayer").mockResolvedValue({ hasTalisman } as never);
}

function mockPet(pet: {
	isFeisty: boolean; isHungry: boolean;
}): void {
	vi.spyOn(PetEntities, "getById").mockResolvedValue({
		typeId: 12,
		isFeisty: () => pet.isFeisty,
		getFeedCooldown: () => pet.isHungry ? 0 : 1,
		getBasicInfo: () => ({})
	} as never);
	vi.spyOn(PetDataController.instance, "getById").mockReturnValue({} as never);
}

function isTalvarGuaranteed(talvarPlayer: never): Promise<boolean> {
	if (!talvarFuncs.isGuaranteed) {
		throw new Error("Talvar can be guaranteed");
	}
	return talvarFuncs.isGuaranteed(talvarPlayer);
}

describe("guaranteed small events", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("draw", () => {
		beforeEach(() => {
			vi.spyOn(SmallEventDataController, "getSmallEventFunction").mockImplementation(key => ({
				isGuaranteed: () => Promise.resolve(key === "guaranteed")
			} as never));
		});

		it("guarantees the eligible small event right after the first ones of the path", async () => {
			vi.spyOn(PlayerSmallEvents, "countSmallEventsOfPlayer").mockResolvedValue(SmallEventConstants.GUARANTEED_AFTER_SMALL_EVENTS);
			vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockResolvedValue(0);
			expect(await findGuaranteedSmallEvent(player, eligibleEvents)).toBe("guaranteed");
		});

		it("does not guarantee a small event the player already met on the path", async () => {
			vi.spyOn(PlayerSmallEvents, "countSmallEventsOfPlayer").mockResolvedValue(SmallEventConstants.GUARANTEED_AFTER_SMALL_EVENTS);
			vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockImplementation((_playerId, key) => Promise.resolve(key === "guaranteed" ? 1 : 0));
			expect(await findGuaranteedSmallEvent(player, eligibleEvents)).toBeNull();
		});

		it("guarantees nothing before or after that small event, so a path has at most one guaranteed small event", async () => {
			for (const count of [SmallEventConstants.GUARANTEED_AFTER_SMALL_EVENTS - 1, SmallEventConstants.GUARANTEED_AFTER_SMALL_EVENTS + 1]) {
				vi.spyOn(PlayerSmallEvents, "countSmallEventsOfPlayer").mockResolvedValue(count);
				expect(await findGuaranteedSmallEvent(player, eligibleEvents)).toBeNull();
			}
		});
	});

	describe("Velanna", () => {
		beforeEach(() => {
			mockPet({
				isFeisty: false, isHungry: false
			});
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(true);
		});

		it("is guaranteed to a player fulfilling every condition of the anchor talisman", async () => {
			mockTalisman(false);
			expect(await velannaFuncs.isGuaranteed!(player)).toBe(true);
		});

		it("is not guaranteed once the player has the talisman, nor when a condition is missing", async () => {
			mockTalisman(true);
			expect(await velannaFuncs.isGuaranteed!(player)).toBe(false);

			mockTalisman(false);
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(false);
			expect(await velannaFuncs.isGuaranteed!(player)).toBe(false);
		});
	});

	describe("Talvar", () => {
		beforeEach(() => {
			mockTalisman(false);
			mockPet({
				isFeisty: false, isHungry: true
			});
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);
		});

		it("is guaranteed to a player without the talisman whose pet he never saw", async () => {
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(false);
			expect(await talvarFuncs.isGuaranteed!(player)).toBe(true);
		});

		it("is not guaranteed when he already saw the pet, nor once the player has the talisman", async () => {
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(true);
			expect(await talvarFuncs.isGuaranteed!(player)).toBe(false);

			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(false);
			mockTalisman(true);
			expect(await talvarFuncs.isGuaranteed!(player)).toBe(false);
		});

		it("is not guaranteed to a player without an available and calm pet", async () => {
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(false);
			expect(await isTalvarGuaranteed({
				...(player as object), petId: null
			} as never)).toBe(false);

			vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
			expect(await isTalvarGuaranteed(player)).toBe(false);

			mockPet({
				isFeisty: true, isHungry: true
			});
			expect(await isTalvarGuaranteed(player)).toBe(false);

			mockPet({
				isFeisty: false, isHungry: true
			});
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(false);
			expect(await isTalvarGuaranteed(player)).toBe(false);
		});
	});
});
