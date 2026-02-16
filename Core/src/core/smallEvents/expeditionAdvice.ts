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
import { PlayerTalismansManager } from "../database/game/models/PlayerTalismans";
import { BlessingManager } from "../blessings/BlessingManager";

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
	if (!petEntity) {
		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET
		};
	}
	const petInfo = petEntity.getBasicInfo();
	const petModel = PetDataController.instance.getById(petEntity.typeId)!;

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
		// Calculate consolation tokens based on remaining space (max tokens - current tokens)
		const remainingSpace = TokensConstants.MAX - player.tokens;
		const consolationAmount = Math.min(
			ExpeditionConstants.TALISMAN_EVENT.LEVEL_TOO_LOW_TOKEN_COMPENSATION,
			Math.max(0, remainingSpace)
		);

		return {
			conditionMet: false,
			interactionType: ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW,
			...petInfo,
			consolationTokensAmount: consolationAmount
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
 * Uses a single random roll to determine the bonus type:
 * - 0-4% (5%): random item
 * - 5-14% (10%): money
 * - 15-49% (35%): combat potion
 * - 50-99% (50%): points only
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

	// Single random roll to determine bonus type
	const roll = RandomUtils.crowniclesRandom.integer(0, 99);

	if (roll < bonusConfig.ITEM_THRESHOLD) {
		// 5% chance: random item
		const item = generateRandomItem({});
		rewards.bonusItem = toItemWithDetails(item);
		await giveItemToPlayer(response, context, player, item);
	}
	else if (roll < bonusConfig.MONEY_THRESHOLD) {
		// 10% chance: money
		rewards.bonusMoney = RandomUtils.crowniclesRandom.integer(bonusConfig.MONEY_MIN, bonusConfig.MONEY_MAX);
		await player.addMoney({
			amount: rewards.bonusMoney,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		rewards.bonusMoney = BlessingManager.getInstance().applyMoneyBlessing(rewards.bonusMoney);
	}
	else if (roll < bonusConfig.POTION_THRESHOLD) {
		// 35% chance: combat potion
		const potion = generateRandomCombatPotion();
		rewards.bonusCombatPotion = potion;
		const potionInstance = PotionDataController.instance.getById(potion.id)!;
		await giveItemToPlayer(response, context, player, potionInstance);
	}

	// else: 50% chance - points only (no additional reward)
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
		context.keycloakId!,
		SmallEventConstants.EXPEDITION_ADVICE.SMALL_EVENT_NAME
	);

	// Base packet properties for all cases when player doesn't have talisman
	const basePacketData = {
		alreadyHasTalisman: false,
		talismanGiven: false,
		petInExpedition: false,
		encounterCount // Already includes current encounter as it's logged before execution
	};

	/*
	 * First 2 encounters: Show talisman intro in order (index 0, then index 1)
	 * Note: encounterCount already includes current encounter as it's logged before execution
	 */
	if (encounterCount <= ExpeditionConstants.TALISMAN_EVENT.TALISMAN_INTRO_ENCOUNTERS) {
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
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	talismans.hasTalisman = true;
	await talismans.save();

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

	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	if (talismans.hasTalisman) {
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
