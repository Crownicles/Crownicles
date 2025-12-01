import { SmallEventFuncs } from "../../data/SmallEvent";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import { PetEntities } from "../database/game/models/PetEntity";
import { PetExpeditions } from "../database/game/models/PetExpedition";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	SmallEventExpeditionAdvicePacket,
	ExpeditionAdviceInteractionType
} from "../../../../Lib/src/packets/smallEvents/SmallEventExpeditionAdvicePacket";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { Maps } from "../maps/Maps";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import { DwarfPetsSeen } from "../database/game/models/DwarfPetsSeen";
import { PetDataController } from "../../data/Pet";
import {
	FightItemNatures, ItemCategory
} from "../../../../Lib/src/constants/ItemConstants";
import { PotionDataController } from "../../data/Potion";
import {
	generateRandomItem, giveItemToPlayer, toItemWithDetails
} from "../utils/ItemUtils";
import { ItemWithDetails } from "../../../../Lib/src/types/ItemWithDetails";

const SMALL_EVENT_NAME = "expeditionAdvice";

/**
 * Check if the small event can be executed for this player
 * Requires: player level >= 20 and on continent
 */
function canBeExecuted(player: Player): boolean {
	return Maps.isOnContinent(player)
		&& player.level >= ExpeditionConstants.TALISMAN_EVENT.MIN_LEVEL;
}

/**
 * Get the phase based on encounter count for players without talisman
 */
function getPhaseFromEncounterCount(encounterCount: number): "intro" | "explanation" | "conditions" {
	if (encounterCount < ExpeditionConstants.TALISMAN_EVENT.TALISMAN_INTRO_ENCOUNTERS) {
		return "intro";
	}
	if (encounterCount < ExpeditionConstants.TALISMAN_EVENT.TOTAL_ENCOUNTERS_BEFORE_TALISMAN) {
		return "explanation";
	}
	return "conditions";
}

/**
 * Check all conditions required to receive the talisman
 * Returns the first unmet condition or null if all conditions are met
 */
async function checkTalismanConditions(
	player: Player
): Promise<{
	conditionMet: boolean;
	interactionType: ExpeditionAdviceInteractionType;
	petTypeId?: number;
	petSex?: SexTypeShort;
	petNickname?: string;
}> {
	// Condition 1: Player level >= 30
	if (player.level < ExpeditionConstants.TALISMAN_EVENT.TALISMAN_MIN_LEVEL) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW
		};
	}

	// Condition 2: Player has a pet
	if (!player.petId) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET
		};
	}

	const petEntity = await PetEntities.getById(player.petId);
	const petInfo = {
		petTypeId: petEntity.typeId,
		petSex: petEntity.sex as SexTypeShort,
		petNickname: petEntity.nickname ?? undefined
	};

	// Condition 3: Pet is not feisty
	if (petEntity.isFeisty()) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_FEISTY,
			...petInfo
		};
	}

	// Condition 4: Pet is not hungry (has been fed recently)
	const petModel = PetDataController.instance.getById(petEntity.typeId);
	if (petEntity.getFeedCooldown(petModel) <= 0) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_HUNGRY,
			...petInfo
		};
	}

	// Condition 5: Pet has been seen by Talvar
	const isPetSeenByTalvar = await DwarfPetsSeen.isPetSeen(player, petEntity.typeId);
	if (!isPetSeenByTalvar) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_NOT_SEEN_BY_TALVAR,
			...petInfo
		};
	}

	// Condition 6: Player has a guild
	if (!player.guildId) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_GUILD,
			...petInfo
		};
	}

	// All conditions met
	return {
		conditionMet: true,
		interactionType: ExpeditionAdviceInteractionType.TALISMAN_RECEIVED,
		...petInfo
	};
}

/**
 * Generate a random combat potion (SPECIAL or EPIC rarity) for Velanna's rewards
 */
function generateRandomCombatPotion(): ItemWithDetails {
	const bonusConfig = ExpeditionConstants.TALISMAN_EVENT.BONUS_IF_PET_IN_EXPEDITION;
	const rarity = RandomUtils.randInt(bonusConfig.COMBAT_POTION_MIN_RARITY, bonusConfig.COMBAT_POTION_MAX_RARITY + 1);
	const nature = RandomUtils.crowniclesRandom.pick(FightItemNatures);

	const potion = PotionDataController.instance.randomItem(nature, rarity);
	return toItemWithDetails(potion);
}

/**
 * Handle the case when player already has talisman
 */
async function handlePlayerWithTalisman(
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext
): Promise<void> {
	let petInExpedition = false;
	let bonusPoints: number | undefined;
	let bonusMoney: number | undefined;
	let bonusItem: ItemWithDetails | undefined;
	let bonusCombatPotion: ItemWithDetails | undefined;
	let petTypeId: number | undefined;
	let petSex: SexTypeShort | undefined;
	let petNickname: string | undefined;
	let interactionType: ExpeditionAdviceInteractionType;

	// Check if player has a pet in expedition
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (activeExpedition && player.petId) {
		petInExpedition = true;
		const petEntity = await PetEntities.getById(player.petId);
		if (petEntity) {
			petTypeId = petEntity.typeId;
			petSex = petEntity.sex as SexTypeShort;
			petNickname = petEntity.nickname ?? undefined;
		}
	}

	if (petInExpedition) {
		const bonusConfig = ExpeditionConstants.TALISMAN_EVENT.BONUS_IF_PET_IN_EXPEDITION;

		// Always give bonus points
		bonusPoints = RandomUtils.randInt(bonusConfig.POINTS_MIN, bonusConfig.POINTS_MAX + 1);
		await player.addScore({
			amount: bonusPoints,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});

		// Check if we give a combat potion (15% chance) - replaces other rewards
		if (RandomUtils.crowniclesRandom.bool(bonusConfig.COMBAT_POTION_CHANCE / 100)) {
			const potion = generateRandomCombatPotion();
			bonusCombatPotion = potion;
			const potionInstance = PotionDataController.instance.getById(potion.id);
			await giveItemToPlayer(response, context, player, potionInstance);
		}
		else {
			// Check if we give money (20% chance)
			if (RandomUtils.crowniclesRandom.bool(bonusConfig.MONEY_CHANCE / 100)) {
				bonusMoney = RandomUtils.randInt(bonusConfig.MONEY_MIN, bonusConfig.MONEY_MAX + 1);
				await player.addMoney({
					amount: bonusMoney,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
			}
			// Check if we give a random item (20% chance)
			else if (RandomUtils.crowniclesRandom.bool(bonusConfig.ITEM_CHANCE / 100)) {
				const item = generateRandomItem({});
				bonusItem = toItemWithDetails(item);
				await giveItemToPlayer(response, context, player, item);
			}
		}

		await player.save();
		interactionType = ExpeditionAdviceInteractionType.EXPEDITION_BONUS;
	}
	else {
		interactionType = ExpeditionAdviceInteractionType.ADVICE;
	}

	response.push(makePacket(SmallEventExpeditionAdvicePacket, {
		alreadyHasTalisman: true,
		talismanGiven: false,
		petInExpedition,
		bonusPoints,
		bonusMoney,
		bonusItem,
		bonusCombatPotion,
		petTypeId,
		petSex,
		petNickname,
		interactionType
	}));
}

/**
 * Handle the case when player doesn't have talisman yet
 */
async function handlePlayerWithoutTalisman(
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext
): Promise<void> {
	// Get encounter count for progressive lore
	const encounterCount = await LogsReadRequests.getSmallEventEncounterCount(
		context.keycloakId,
		SMALL_EVENT_NAME
	);

	const phase = getPhaseFromEncounterCount(encounterCount);

	if (phase === "intro") {
		// Phase 1: Talisman introduction (encounters 1-5)
		response.push(makePacket(SmallEventExpeditionAdvicePacket, {
			alreadyHasTalisman: false,
			talismanGiven: false,
			petInExpedition: false,
			interactionType: ExpeditionAdviceInteractionType.TALISMAN_INTRO,
			encounterCount: encounterCount + 1 // +1 because this encounter hasn't been logged yet
		}));
		return;
	}

	if (phase === "explanation") {
		// Phase 2: Expedition explanation (encounters 6-10)
		response.push(makePacket(SmallEventExpeditionAdvicePacket, {
			alreadyHasTalisman: false,
			talismanGiven: false,
			petInExpedition: false,
			interactionType: ExpeditionAdviceInteractionType.EXPEDITION_EXPLANATION,
			encounterCount: encounterCount + 1
		}));
		return;
	}

	// Phase 3: Check conditions and potentially give talisman
	const conditionResult = await checkTalismanConditions(player);

	if (!conditionResult.conditionMet) {
		// A condition is not met - explain what's missing
		response.push(makePacket(SmallEventExpeditionAdvicePacket, {
			alreadyHasTalisman: false,
			talismanGiven: false,
			petInExpedition: false,
			interactionType: conditionResult.interactionType,
			petTypeId: conditionResult.petTypeId,
			petSex: conditionResult.petSex,
			petNickname: conditionResult.petNickname,
			encounterCount: encounterCount + 1,
			requiredLevel: ExpeditionConstants.TALISMAN_EVENT.TALISMAN_MIN_LEVEL,
			playerLevel: player.level
		}));
		return;
	}

	// All conditions met - give the talisman
	player.hasTalisman = true;
	await player.save();

	response.push(makePacket(SmallEventExpeditionAdvicePacket, {
		alreadyHasTalisman: false,
		talismanGiven: true,
		petInExpedition: false,
		interactionType: ExpeditionAdviceInteractionType.TALISMAN_RECEIVED,
		petTypeId: conditionResult.petTypeId,
		petSex: conditionResult.petSex,
		petNickname: conditionResult.petNickname,
		encounterCount: encounterCount + 1
	}));
}

/**
 * Execute the expedition advice small event
 */
async function executeSmallEvent(
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext,
	_testArgs?: string[]
): Promise<void> {
	if (player.hasTalisman) {
		await handlePlayerWithTalisman(response, player, context);
	}
	else {
		await handlePlayerWithoutTalisman(response, player, context);
	}
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted,
	executeSmallEvent
};
