import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { getQuestsProgress } from "../../../src/core/quests/Quests";
import { QUEST_IDS } from "../../../../Lib/src/constants/QuestConstants";
import { PlantId } from "../../../../Lib/src/constants/PlantConstants";
import { PlayerTalismansManager } from "../../../src/core/database/game/models/PlayerTalismans";
import { LogsReadRequests } from "../../../src/core/database/logs/LogsReadRequests";
import { Homes } from "../../../src/core/database/game/models/Home";
import { HomeGardenSlots } from "../../../src/core/database/game/models/HomeGardenSlot";

const player = {
	id: 1,
	keycloakId: "keycloak"
} as never;

type TalismansState = {
	hasTalisman: boolean;
	hasCloneTalisman: boolean;
};

function mockTalismans(state: TalismansState): void {
	vi.spyOn(PlayerTalismansManager, "getOfPlayer").mockResolvedValue(state as never);
}

async function getStepsDone(questId: string): Promise<number | undefined> {
	return (await getQuestsProgress(player)).find(quest => quest.questId === questId)?.stepsDone;
}

describe("Quests progress", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mockTalismans({
			hasTalisman: false,
			hasCloneTalisman: false
		});
		vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(0);
		vi.spyOn(LogsReadRequests, "countSuccessfulExpeditions").mockResolvedValue(0);
		vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);
	});

	it("returns the progress of every quest", async () => {
		const quests = await getQuestsProgress(player);
		expect(quests.map(quest => quest.questId)).toEqual(Object.values(QUEST_IDS));
		expect(quests.every(quest => quest.stepsDone === 0)).toBe(true);
	});

	describe("expedition talismans", () => {
		it("counts meeting Velanna as the first step", async () => {
			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(1);
			expect(await getStepsDone(QUEST_IDS.EXPEDITION_TALISMANS)).toBe(1);
		});

		it("counts a successful expedition after the anchor talisman", async () => {
			mockTalismans({
				hasTalisman: true,
				hasCloneTalisman: false
			});
			vi.spyOn(LogsReadRequests, "countSuccessfulExpeditions").mockResolvedValue(2);
			expect(await getStepsDone(QUEST_IDS.EXPEDITION_TALISMANS)).toBe(3);
		});

		it("completes the quest with the clone talisman without reading the logs", async () => {
			mockTalismans({
				hasTalisman: true,
				hasCloneTalisman: true
			});
			const encounters = vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount");
			const expeditions = vi.spyOn(LogsReadRequests, "countSuccessfulExpeditions");
			expect(await getStepsDone(QUEST_IDS.EXPEDITION_TALISMANS)).toBe(4);
			expect(encounters).not.toHaveBeenCalled();
			expect(expeditions).not.toHaveBeenCalled();
		});

		it("considers the earlier steps done when a later one is, even without their trace in the logs", async () => {
			mockTalismans({
				hasTalisman: true,
				hasCloneTalisman: false
			});
			expect(await getStepsDone(QUEST_IDS.EXPEDITION_TALISMANS)).toBe(2);
		});
	});

	describe("seeds", () => {
		it("follows the highest plant planted in the garden", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeGardenSlots, "getHighestPlantedId").mockResolvedValue(PlantId.NIGHT_MUSHROOM);
			expect(await getStepsDone(QUEST_IDS.SEEDS)).toBe(PlantId.NIGHT_MUSHROOM);
		});

		it("completes the quest once the ancestral tree is planted", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeGardenSlots, "getHighestPlantedId").mockResolvedValue(PlantId.ANCIENT_TREE);
			expect(await getStepsDone(QUEST_IDS.SEEDS)).toBe(10);
		});
	});
});
