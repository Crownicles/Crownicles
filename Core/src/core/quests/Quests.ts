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
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { QuestUpdatedPacket } from "../../../../Lib/src/packets/events/QuestUpdatedPacket";

type QuestStepCheck = () => boolean | Promise<boolean>;

type QuestProgressComputer = (player: Player) => Promise<number>;

export type SeedsQuestStepId = QuestStepId<typeof QUEST_IDS.SEEDS>;

/**
 * A step of a given quest
 */
export type QuestStepReference<Q extends QuestId> = {
	questId: Q;
	stepId: QuestStepId<Q>;
};

/**
 * Plant to plant in the garden to complete each step of the seeds quest
 */
const SEEDS_QUEST_STEP_PLANTS: Record<SeedsQuestStepId, PlantId> = {
	commonHerb: PlantId.COMMON_HERB,
	goldenClover: PlantId.GOLDEN_CLOVER,
	lunarMoss: PlantId.LUNAR_MOSS,
	ironRoot: PlantId.IRON_ROOT,
	nightMushroom: PlantId.NIGHT_MUSHROOM,
	venomousLeaf: PlantId.VENOMOUS_LEAF,
	fireBulb: PlantId.FIRE_BULB,
	meatPlant: PlantId.MEAT_PLANT,
	crystalFlower: PlantId.CRYSTAL_FLOWER,
	ancientTree: PlantId.ANCIENT_TREE
};

function getQuestSteps<Q extends QuestId>(questId: Q): readonly QuestStepId<Q>[] {
	return QuestConstants.STEPS[questId];
}

/**
 * Count the completed steps of a quest. Completing a step implies the previous ones are completed,
 * so the steps are checked from the last one and the checks of the earlier steps are skipped as soon as one is completed.
 */
async function countCompletedSteps<Q extends QuestId>(questId: Q, isStepCompleted: (step: QuestStepId<Q>) => boolean | Promise<boolean>): Promise<number> {
	const steps = getQuestSteps(questId);
	for (let index = steps.length - 1; index >= 0; index--) {
		if (await isStepCompleted(steps[index])) {
			return index + 1;
		}
	}
	return 0;
}

async function computeExpeditionTalismansProgress(player: Player): Promise<number> {
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	const checks: Record<QuestStepId<typeof QUEST_IDS.EXPEDITION_TALISMANS>, QuestStepCheck> = {
		meetVelanna: async () => await LogsReadRequests.getSmallEventEncounterCount(player.keycloakId, SmallEventConstants.EXPEDITION_ADVICE.SMALL_EVENT_NAME) > 0,
		anchorTalisman: () => talismans.hasTalisman,
		successfulExpedition: async () => await LogsReadRequests.countSuccessfulExpeditions(player.keycloakId) > 0,
		cloneTalisman: () => talismans.hasCloneTalisman
	};
	return await countCompletedSteps(QUEST_IDS.EXPEDITION_TALISMANS, step => checks[step]());
}

async function computeSeedsProgress(player: Player): Promise<number> {
	const home = await Homes.getOfPlayer(player.id);
	const highestPlanted = home ? await HomeGardenSlots.getHighestPlantedId(home.id) : 0;
	return await countCompletedSteps(QUEST_IDS.SEEDS, step => highestPlanted >= SEEDS_QUEST_STEP_PLANTS[step]);
}

const QUEST_PROGRESS_COMPUTERS: Record<QuestId, QuestProgressComputer> = {
	[QUEST_IDS.EXPEDITION_TALISMANS]: computeExpeditionTalismansProgress,
	[QUEST_IDS.SEEDS]: computeSeedsProgress
};

/**
 * Progress of a player in the quests they obtained, a quest being obtained with its first step.
 * Quests grant nothing by themselves: their progress is read from the state the game already keeps
 */
export async function getObtainedQuestsProgress(player: Player): Promise<QuestProgress[]> {
	const quests = await Promise.all(Object.values(QUEST_IDS)
		.map(async questId => ({
			questId,
			stepsDone: await QUEST_PROGRESS_COMPUTERS[questId](player)
		})));
	return quests.filter(quest => quest.stepsDone > 0);
}

/**
 * Step of the seeds quest completed by planting a plant for the first time
 */
export function getSeedsQuestStepOfPlant(plantId: PlantId | 0): SeedsQuestStepId | undefined {
	return getQuestSteps(QUEST_IDS.SEEDS)
		.find(step => SEEDS_QUEST_STEP_PLANTS[step] === plantId);
}

/**
 * Tell the player that a step of a quest was just completed, when it makes the quest progress.
 * Must only be called by the code completing the step, the first time it is completed: the step is then considered done
 * even if its trace (a log written asynchronously) is not readable yet.
 * Nothing is sent when a later step was already completed, since the quest does not progress.
 */
export async function notifyQuestStepCompleted<Q extends QuestId>(
	response: CrowniclesPacket[],
	player: Player,
	questStep: QuestStepReference<Q>
): Promise<void> {
	const stepsDoneWithStep = getQuestSteps(questStep.questId).indexOf(questStep.stepId) + 1;
	if (await QUEST_PROGRESS_COMPUTERS[questStep.questId](player) > stepsDoneWithStep) {
		return;
	}
	response.push(makePacket(QuestUpdatedPacket, {
		keycloakId: player.keycloakId,
		quest: {
			questId: questStep.questId,
			stepsDone: stepsDoneWithStep
		}
	}));
}
