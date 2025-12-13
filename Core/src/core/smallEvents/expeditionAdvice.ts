import { SmallEventFuncs } from "../../data/SmallEvent";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import { PetEntities } from "../database/game/models/PetEntity";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { PetUtils } from "../utils/PetUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	SmallEventExpeditionAdvicePacket,
	ExpeditionAdviceInteractionType
} from "../../../../Lib/src/packets/smallEvents/SmallEventExpeditionAdvicePacket";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { Maps } from "../maps/Maps";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import { DwarfPetsSeen } from "../database/game/models/DwarfPetsSeen";
import { PetDataController } from "../../data/Pet";
import { FightItemNatures } from "../../../../Lib/src/constants/ItemConstants";
import { PotionDataController } from "../../data/Potion";
import {
	generateRandomItem, giveItemToPlayer, toItemWithDetails
} from "../utils/ItemUtils";
import { ItemWithDetails } from "../../../../Lib/src/types/ItemWithDetails";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { MissionsController } from "../missions/MissionsController";

/**
 * Check if the small event can be executed for this player
 * Requires: player level >= tokens unlock level and on continent
 */
function canBeExecuted(player: Player): boolean {
	return Maps.isOnContinent(player)
		&& player.level >= TokensConstants.LEVEL_TO_UNLOCK;
}

/**
 * Result of checking talisman conditions
 */
interface TalismanConditionResult {
	conditionMet: boolean;
	interactionType: ExpeditionAdviceInteractionType;
	petTypeId?: number;
	petSex?: SexTypeShort;
	petNickname?: string;
	consolationTokensAmount?: number;
}

/**
 * Check all conditions required to receive the talisman
 * Returns the first unmet condition or null if all conditions are met
 * Order: noPet, petHungry, petFeisty, noGuild, petNotSeenByTalvar, levelTooLow
 */
async function checkTalismanConditions(player: Player): Promise<TalismanConditionResult> {
	// Condition 1: Player has a pet
	if (!player.petId) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET
		};
	}

	const petEntity = await PetEntities.getById(player.petId);
	const petInfo = petEntity.getBasicInfo();
	const petModel = PetDataController.instance.getById(petEntity.typeId);

	// Condition 2: Pet is not hungry (has been fed recently)
	if (petEntity.getFeedCooldown(petModel) <= 0) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_HUNGRY,
			...petInfo
		};
	}

	// Condition 3: Pet is not feisty
	if (petEntity.isFeisty()) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_FEISTY,
			...petInfo
		};
	}

	// Condition 4: Player has a guild
	if (!player.guildId) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_GUILD,
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

	// Condition 6: Player level >= 30
	if (player.level < ExpeditionConstants.TALISMAN_EVENT.TALISMAN_MIN_LEVEL) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW,
			...petInfo,
			consolationTokensAmount: 1
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
	const rarity = RandomUtils.crowniclesRandom.integer(bonusConfig.COMBAT_POTION_MIN_RARITY, bonusConfig.COMBAT_POTION_MAX_RARITY);
	const nature = RandomUtils.crowniclesRandom.pick(FightItemNatures);

	const potion = PotionDataController.instance.randomItem(nature, rarity);
	return toItemWithDetails(potion);
}

/**
 * Pet information for expedition bonus
 */
interface ExpeditionPetInfo {
	petInExpedition: boolean;
	petTypeId?: number;
	petSex?: SexTypeShort;
	petNickname?: string;
}

/**
 * Bonus rewards given during the expedition advice event
 */
interface ExpeditionBonusRewards {
	bonusPoints?: number;
	bonusMoney?: number;
	bonusItem?: ItemWithDetails;
	bonusCombatPotion?: ItemWithDetails;
}

/**
 * Check if player has a pet currently in expedition
 */
async function getExpeditionPetInfo(player: Player): Promise<ExpeditionPetInfo> {
	if (!player.petId || !await PetUtils.isPetOnExpedition(player.id)) {
		return { petInExpedition: false };
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		return { petInExpedition: false };
	}

	return {
		petInExpedition: true,
		...petEntity.getBasicInfo()
	};
}

/**
 * Apply bonus rewards when pet is in expedition
 */
async function applyExpeditionBonusRewards(
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext
): Promise<ExpeditionBonusRewards> {
	const bonusConfig = ExpeditionConstants.TALISMAN_EVENT.BONUS_IF_PET_IN_EXPEDITION;
	const rewards: ExpeditionBonusRewards = {};

	// Always give bonus points
	rewards.bonusPoints = RandomUtils.crowniclesRandom.integer(bonusConfig.POINTS_MIN, bonusConfig.POINTS_MAX);
	await player.addScore({
		amount: rewards.bonusPoints,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});

	// Check if we give a combat potion (15% chance) - replaces other rewards
	if (RandomUtils.crowniclesRandom.bool(bonusConfig.COMBAT_POTION_CHANCE / 100)) {
		const potion = generateRandomCombatPotion();
		rewards.bonusCombatPotion = potion;
		const potionInstance = PotionDataController.instance.getById(potion.id);
		await giveItemToPlayer(response, context, player, potionInstance);
		return rewards;
	}

	// Check if we give money (20% chance)
	if (RandomUtils.crowniclesRandom.bool(bonusConfig.MONEY_CHANCE / 100)) {
		rewards.bonusMoney = RandomUtils.crowniclesRandom.integer(bonusConfig.MONEY_MIN, bonusConfig.MONEY_MAX);
		await player.addMoney({
			amount: rewards.bonusMoney,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		return rewards;
	}

	// Check if we give a random item (20% chance)
	if (RandomUtils.crowniclesRandom.bool(bonusConfig.ITEM_CHANCE / 100)) {
		const item = generateRandomItem({});
		rewards.bonusItem = toItemWithDetails(item);
		await giveItemToPlayer(response, context, player, item);
	}

	return rewards;
}

/**
 * Handle the case when player already has talisman
 */
async function handlePlayerWithTalisman(
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext
): Promise<void> {
	const petInfo = await getExpeditionPetInfo(player);
	let rewards: ExpeditionBonusRewards = {};
	let interactionType: ExpeditionAdviceInteractionType;

	if (petInfo.petInExpedition) {
		rewards = await applyExpeditionBonusRewards(response, player, context);
		await player.save();
		interactionType = ExpeditionAdviceInteractionType.EXPEDITION_BONUS;
	}
	else {
		interactionType = ExpeditionAdviceInteractionType.ADVICE;
	}

	response.push(makePacket(SmallEventExpeditionAdvicePacket, {
		alreadyHasTalisman: true,
		talismanGiven: false,
		...petInfo,
		...rewards,
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
		SmallEventConstants.EXPEDITION_ADVICE.SMALL_EVENT_NAME
	);

	// Base packet properties for all cases when player doesn't have talisman
	const basePacketData = {
		alreadyHasTalisman: false,
		talismanGiven: false,
		petInExpedition: false,
		encounterCount: encounterCount + 1 // +1 because this encounter hasn't been logged yet
	};

	// First 2 encounters: Show talisman intro in order (index 0, then index 1)
	if (encounterCount < ExpeditionConstants.TALISMAN_EVENT.TALISMAN_INTRO_ENCOUNTERS) {
		response.push(makePacket(SmallEventExpeditionAdvicePacket, {
			...basePacketData,
			interactionType: ExpeditionAdviceInteractionType.TALISMAN_INTRO
		}));
		return;
	}

	// Check conditions and potentially give talisman
	const conditionResult = await checkTalismanConditions(player);

	if (!conditionResult.conditionMet) {
		// Give consolation tokens if applicable
		if (conditionResult.consolationTokensAmount) {
			await player.addTokens({
				amount: conditionResult.consolationTokensAmount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
		}

		// A condition is not met - explain what's missing
		response.push(makePacket(SmallEventExpeditionAdvicePacket, {
			...basePacketData,
			interactionType: conditionResult.interactionType,
			petTypeId: conditionResult.petTypeId,
			petSex: conditionResult.petSex,
			petNickname: conditionResult.petNickname,
			requiredLevel: ExpeditionConstants.TALISMAN_EVENT.TALISMAN_MIN_LEVEL,
			playerLevel: player.level,
			consolationTokenGiven: Boolean(conditionResult.consolationTokensAmount),
			consolationTokensAmount: conditionResult.consolationTokensAmount
		}));
		return;
	}

	// All conditions met - give the talisman
	player.hasTalisman = true;
	await player.save();

	response.push(makePacket(SmallEventExpeditionAdvicePacket, {
		...basePacketData,
		talismanGiven: true,
		interactionType: ExpeditionAdviceInteractionType.TALISMAN_RECEIVED,
		petTypeId: conditionResult.petTypeId,
		petSex: conditionResult.petSex,
		petNickname: conditionResult.petNickname
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
	await MissionsController.update(player, response, { missionId: "meetVelanna" });

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
