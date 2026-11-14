import Player from "../database/game/models/Player";
import {
	QUEST_IDS, QuestConstants, QuestId, QuestStepId
} from "../../../../Lib/src/constants/QuestConstants";
import { QuestProgress } from "../../../../Lib/src/types/QuestProgress";
import { PlayerTalismansManager } from "../database/game/models/PlayerTalismans";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { Homes } from "../database/game/models/Home";
import { HomeGardenSlots } from "../database/game/models/HomeGardenSlot";
import { PlantId } from "../../../../Lib/src/constants/PlantConstants";

type QuestStepCheck = () => boolean | Promise<boolean>;

type QuestStepChecks<Q extends QuestId> = Record<QuestStepId<Q>, QuestStepCheck>;

type QuestProgressComputer = (player: Player) => Promise<number>;

/**
 * Count the completed steps of a quest. Completing a step implies the previous ones are completed,
 * so the steps are checked from the last one and the checks of the earlier steps are skipped as soon as one is completed.
 */
async function countCompletedSteps<Q extends QuestId>(questId: Q, checks: QuestStepChecks<Q>): Promise<number> {
	const steps: readonly QuestStepId<Q>[] = QuestConstants.STEPS[questId];
	for (let index = steps.length - 1; index >= 0; index--) {
		if (await checks[steps[index]]()) {
			return index + 1;
		}
	}
	return 0;
}

async function computeExpeditionTalismansProgress(player: Player): Promise<number> {
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	return await countCompletedSteps(QUEST_IDS.EXPEDITION_TALISMANS, {
		meetVelanna: async () => await LogsReadRequests.getSmallEventEncounterCount(player.keycloakId, SmallEventConstants.EXPEDITION_ADVICE.SMALL_EVENT_NAME) > 0,
		anchorTalisman: () => talismans.hasTalisman,
		successfulExpedition: async () => await LogsReadRequests.countSuccessfulExpeditions(player.keycloakId) > 0,
		cloneTalisman: () => talismans.hasCloneTalisman
	});
}

async function computeSeedsProgress(player: Player): Promise<number> {
	const home = await Homes.getOfPlayer(player.id);
	const highestPlanted = home ? await HomeGardenSlots.getHighestPlantedId(home.id) : 0;
	return await countCompletedSteps(QUEST_IDS.SEEDS, {
		commonHerb: () => highestPlanted >= PlantId.COMMON_HERB,
		goldenClover: () => highestPlanted >= PlantId.GOLDEN_CLOVER,
		lunarMoss: () => highestPlanted >= PlantId.LUNAR_MOSS,
		ironRoot: () => highestPlanted >= PlantId.IRON_ROOT,
		nightMushroom: () => highestPlanted >= PlantId.NIGHT_MUSHROOM,
		venomousLeaf: () => highestPlanted >= PlantId.VENOMOUS_LEAF,
		fireBulb: () => highestPlanted >= PlantId.FIRE_BULB,
		meatPlant: () => highestPlanted >= PlantId.MEAT_PLANT,
		crystalFlower: () => highestPlanted >= PlantId.CRYSTAL_FLOWER,
		ancientTree: () => highestPlanted >= PlantId.ANCIENT_TREE
	});
}

const QUEST_PROGRESS_COMPUTERS: Record<QuestId, QuestProgressComputer> = {
	[QUEST_IDS.EXPEDITION_TALISMANS]: computeExpeditionTalismansProgress,
	[QUEST_IDS.SEEDS]: computeSeedsProgress
};

/**
 * Progress of a player in every quest. Quests grant nothing by themselves: their progress is read from the state the game already keeps
 */
export async function getQuestsProgress(player: Player): Promise<QuestProgress[]> {
	return await Promise.all(Object.values(QUEST_IDS)
		.map(async questId => ({
			questId,
			stepsDone: await QUEST_PROGRESS_COMPUTERS[questId](player)
		})));
}
