import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";
import { Guilds } from "../../core/database/game/models/Guild";
import {
	Pet, PetDataController
} from "../../data/Pet";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	CommandPetExpeditionPacketReq,
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionGeneratePacketReq,
	CommandPetExpeditionGeneratePacketRes,
	CommandPetExpeditionChoicePacketReq,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketReq,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketReq,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket,
	ExpeditionData,
	ExpeditionRewardData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";

/**
 * Generate a single random expedition
 */
function generateRandomExpedition(): ExpeditionData {
	const durationMinutes = RandomUtils.randInt(
		ExpeditionConstants.DURATION.MIN_MINUTES,
		ExpeditionConstants.DURATION.MAX_MINUTES + 1
	);

	const riskRate = RandomUtils.randInt(
		ExpeditionConstants.RISK_RATE.MIN,
		ExpeditionConstants.RISK_RATE.MAX + 1
	);

	const difficulty = RandomUtils.randInt(
		ExpeditionConstants.DIFFICULTY.MIN,
		ExpeditionConstants.DIFFICULTY.MAX + 1
	);

	const wealthRate = RandomUtils.crowniclesRandom.realZeroToOneInclusive()
		* (ExpeditionConstants.WEALTH_RATE.MAX - ExpeditionConstants.WEALTH_RATE.MIN)
		+ ExpeditionConstants.WEALTH_RATE.MIN;

	const locationTypes = Object.values(ExpeditionConstants.LOCATION_TYPES);
	const locationType = locationTypes[RandomUtils.randInt(0, locationTypes.length)] as ExpeditionLocationType;

	return {
		id: `${ExpeditionConstants.ID_GENERATION.PREFIX}_${Date.now()}_${RandomUtils.randInt(ExpeditionConstants.ID_GENERATION.RANDOM_MIN, ExpeditionConstants.ID_GENERATION.RANDOM_MAX)}`,
		durationMinutes,
		riskRate,
		difficulty,
		wealthRate: Math.round(wealthRate * ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION) / ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION,
		locationType
	};
}

/**
 * Calculate the effective risk based on pet stats and expedition parameters
 */
function calculateEffectiveRisk(expedition: ExpeditionData, petModel: Pet, petLovePoints: number): number {
	const effectiveRisk = expedition.riskRate
		+ expedition.difficulty / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.DIFFICULTY_DIVISOR
		- petModel.force
		- petLovePoints / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.LOVE_DIVISOR;

	return Math.max(0, Math.min(ExpeditionConstants.PERCENTAGE.MAX, effectiveRisk));
}

/**
 * Calculate the reward index (0-9) based on expedition parameters
 */
function calculateRewardIndex(expedition: ExpeditionData): number {
	let durationScore = 0;
	if (expedition.durationMinutes >= ExpeditionConstants.SCORE_THRESHOLDS.DURATION.SCORE_3) {
		durationScore = 3;
	}
	else if (expedition.durationMinutes >= ExpeditionConstants.SCORE_THRESHOLDS.DURATION.SCORE_2) {
		durationScore = 2;
	}
	else if (expedition.durationMinutes >= ExpeditionConstants.SCORE_THRESHOLDS.DURATION.SCORE_1) {
		durationScore = 1;
	}

	let riskScore = 0;
	if (expedition.riskRate >= ExpeditionConstants.SCORE_THRESHOLDS.RISK.SCORE_3) {
		riskScore = 3;
	}
	else if (expedition.riskRate >= ExpeditionConstants.SCORE_THRESHOLDS.RISK.SCORE_2) {
		riskScore = 2;
	}
	else if (expedition.riskRate >= ExpeditionConstants.SCORE_THRESHOLDS.RISK.SCORE_1) {
		riskScore = 1;
	}

	let difficultyScore = 0;
	if (expedition.difficulty >= ExpeditionConstants.SCORE_THRESHOLDS.DIFFICULTY.SCORE_3) {
		difficultyScore = 3;
	}
	else if (expedition.difficulty >= ExpeditionConstants.SCORE_THRESHOLDS.DIFFICULTY.SCORE_2) {
		difficultyScore = 2;
	}
	else if (expedition.difficulty >= ExpeditionConstants.SCORE_THRESHOLDS.DIFFICULTY.SCORE_1) {
		difficultyScore = 1;
	}

	return Math.min(9, durationScore + riskScore + difficultyScore);
}

/**
 * Calculate rewards based on expedition parameters and location
 */
function calculateRewards(expedition: ExpeditionData, rewardIndex: number, isPartialSuccess: boolean): ExpeditionRewardData {
	const locationWeights = ExpeditionConstants.LOCATION_REWARD_WEIGHTS[expedition.locationType];

	let money = Math.round(ExpeditionConstants.REWARD_TABLES.MONEY[rewardIndex] * expedition.wealthRate * locationWeights.money);
	let gems = Math.round(ExpeditionConstants.REWARD_TABLES.GEMS[rewardIndex] * expedition.wealthRate * locationWeights.gems);
	let experience = Math.round(ExpeditionConstants.REWARD_TABLES.EXPERIENCE[rewardIndex] * expedition.wealthRate * locationWeights.experience);
	let guildExperience = Math.round(ExpeditionConstants.REWARD_TABLES.GUILD_EXPERIENCE[rewardIndex] * expedition.wealthRate * locationWeights.guildExperience);
	let points = Math.round(ExpeditionConstants.REWARD_TABLES.POINTS[rewardIndex] * expedition.wealthRate * locationWeights.points);

	if (isPartialSuccess) {
		money = Math.round(money / 2);
		gems = Math.round(gems / 2);
		experience = Math.round(experience / 2);
		guildExperience = Math.round(guildExperience / 2);
		points = Math.round(points / 2);
	}

	return {
		money,
		gems,
		experience,
		guildExperience,
		points
	};
}

/**
 * Get food required for expedition based on pet diet
 */
async function getFoodAvailable(player: Player, petModel: Pet): Promise<{
	available: number;
	foodType: "carnivorousFood" | "herbivorousFood";
}> {
	if (!player.guildId) {
		return {
			available: 0, foodType: petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood"
		};
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return {
			available: 0, foodType: petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood"
		};
	}

	if (petModel.canEatMeat() && petModel.canEatVegetables()) {
		// Omnivore - use whichever is available
		if (guild.carnivorousFood > 0) {
			return {
				available: guild.carnivorousFood, foodType: "carnivorousFood"
			};
		}
		return {
			available: guild.herbivorousFood, foodType: "herbivorousFood"
		};
	}
	else if (petModel.canEatMeat()) {
		return {
			available: guild.carnivorousFood, foodType: "carnivorousFood"
		};
	}
	return {
		available: guild.herbivorousFood, foodType: "herbivorousFood"
	};
}

export default class PetExpeditionCommand {
	/**
	 * Check expedition status and requirements
	 */
	@commandRequires(CommandPetExpeditionPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async checkStatus(response: CrowniclesPacket[], player: Player, _packet: CommandPetExpeditionPacketReq): Promise<void> {
		// Check if player has talisman
		if (!player.hasTalisman) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: false,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "noTalisman"
			}));
			return;
		}

		// Check if player has a pet
		if (!player.petId) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "noPet"
			}));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "noPet"
			}));
			return;
		}

		// Check for expedition in progress
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (activeExpedition) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: true,
				expeditionInProgress: activeExpedition.toExpeditionInProgressData(
					petEntity.typeId,
					petEntity.sex,
					petEntity.nickname ?? undefined
				),
				canStartExpedition: false,
				petLovePoints: petEntity.lovePoints
			}));
			return;
		}

		// Check love points requirement
		if (petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "insufficientLove",
				petLovePoints: petEntity.lovePoints,
				petNickname: petEntity.nickname ?? undefined
			}));
			return;
		}

		// Check if pet is hungry (must be fed before expedition)
		const petModel = PetDataController.instance.getById(petEntity.typeId);
		if (petEntity.getFeedCooldown(petModel) <= 0) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "petHungry",
				petLovePoints: petEntity.lovePoints,
				petNickname: petEntity.nickname ?? undefined
			}));
			return;
		}

		// All requirements met
		response.push(makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: false,
			canStartExpedition: true,
			petLovePoints: petEntity.lovePoints,
			petNickname: petEntity.nickname ?? undefined
		}));
	}

	/**
	 * Generate 3 expedition options
	 */
	@commandRequires(CommandPetExpeditionGeneratePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async generateExpeditions(response: CrowniclesPacket[], player: Player, _packet: CommandPetExpeditionGeneratePacketReq): Promise<void> {
		// Validate requirements
		if (!player.hasTalisman || !player.petId) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "invalidState" }));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity || petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "invalidState" }));
			return;
		}

		// Check no expedition in progress
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (activeExpedition) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "expeditionInProgress" }));
			return;
		}

		// Generate 3 expeditions
		const expeditions: ExpeditionData[] = [
			generateRandomExpedition(),
			generateRandomExpedition(),
			generateRandomExpedition()
		];

		response.push(makePacket(CommandPetExpeditionGeneratePacketRes, {
			expeditions,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined
		}));
	}

	/**
	 * Start a selected expedition
	 */
	@commandRequires(CommandPetExpeditionChoicePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async startExpedition(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandPetExpeditionChoicePacketReq,
		_context: PacketContext,
		expeditionData?: ExpeditionData // Passed from reaction collector
	): Promise<void> {
		// Validate requirements
		if (!player.hasTalisman || !player.petId) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "invalidState"
			}));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity || petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "invalidState"
			}));
			return;
		}

		// Check no expedition in progress
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (activeExpedition) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "expeditionInProgress"
			}));
			return;
		}

		// If no expedition data passed, we need to regenerate it (shouldn't happen normally)
		if (!expeditionData) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "noExpeditionData"
			}));
			return;
		}

		const petModel = PetDataController.instance.getById(petEntity.typeId);
		const rewardIndex = calculateRewardIndex(expeditionData);
		const foodRequired = ExpeditionConstants.FOOD_CONSUMPTION[rewardIndex];

		// Check and consume food
		const foodInfo = await getFoodAvailable(player, petModel);
		let insufficientFood = false;
		let foodConsumed = 0;

		if (foodInfo.available < foodRequired) {
			insufficientFood = true;
			foodConsumed = foodInfo.available;
		}
		else {
			foodConsumed = foodRequired;
		}

		// Consume food from guild
		if (foodConsumed > 0 && player.guildId) {
			const guild = await Guilds.getById(player.guildId);
			if (guild) {
				guild[foodInfo.foodType] -= foodConsumed;
				await guild.save();
			}
		}

		// Create expedition
		const expedition = PetExpeditions.createExpedition(
			player.id,
			petEntity.id,
			expeditionData,
			expeditionData.durationMinutes
		);
		await expedition.save();

		response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
			success: true,
			expedition: expedition.toExpeditionInProgressData(
				petEntity.typeId,
				petEntity.sex,
				petEntity.nickname ?? undefined
			),
			foodConsumed,
			insufficientFood
		}));
	}

	/**
	 * Cancel expedition before departure
	 */
	@commandRequires(CommandPetExpeditionCancelPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async cancelExpedition(response: CrowniclesPacket[], player: Player, _packet: CommandPetExpeditionCancelPacketReq): Promise<void> {
		if (!player.petId) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
			return;
		}

		// Apply love loss for cancellation
		const loveLost = Math.abs(ExpeditionConstants.LOVE_CHANGES.CANCEL_BEFORE_DEPARTURE);
		await petEntity.changeLovePoints({
			player,
			amount: ExpeditionConstants.LOVE_CHANGES.CANCEL_BEFORE_DEPARTURE,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await petEntity.save();

		response.push(makePacket(CommandPetExpeditionCancelPacketRes, {
			loveLost,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined
		}));
	}

	/**
	 * Recall pet during expedition
	 */
	@commandRequires(CommandPetExpeditionRecallPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async recallPet(response: CrowniclesPacket[], player: Player, _packet: CommandPetExpeditionRecallPacketReq): Promise<void> {
		// Check for active expedition
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (!activeExpedition) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noExpedition" }));
			return;
		}

		if (!player.petId) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
			return;
		}

		// Recall expedition
		await PetExpeditions.recallExpedition(activeExpedition);

		// Apply love loss for recall
		const loveLost = Math.abs(ExpeditionConstants.LOVE_CHANGES.RECALL_DURING_EXPEDITION);
		await petEntity.changeLovePoints({
			player,
			amount: ExpeditionConstants.LOVE_CHANGES.RECALL_DURING_EXPEDITION,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await petEntity.save();

		response.push(makePacket(CommandPetExpeditionRecallPacketRes, {
			loveLost,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined
		}));
	}

	/**
	 * Resolve a completed expedition
	 */
	@commandRequires(CommandPetExpeditionResolvePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async resolveExpedition(response: CrowniclesPacket[], player: Player, _packet: CommandPetExpeditionResolvePacketReq): Promise<void> {
		// Check for active expedition
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (!activeExpedition) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noExpedition" }));
			return;
		}

		// Check if expedition has ended
		if (!activeExpedition.hasEnded()) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "expeditionNotComplete" }));
			return;
		}

		if (!player.petId) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
			return;
		}

		const petModel = PetDataController.instance.getById(petEntity.typeId);
		const expeditionData = activeExpedition.toExpeditionData();

		// Calculate effective risk
		const effectiveRisk = calculateEffectiveRisk(expeditionData, petModel, petEntity.lovePoints);

		/*
		 * If insufficient food was used, triple the effective risk
		 * Note: We store this info in the expedition if needed, for now we just calculate
		 * This could be stored in the expedition model if needed
		 */

		// First roll: check for total failure
		const totalFailure = RandomUtils.crowniclesRandom.bool(effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);

		let partialSuccess = false;
		let rewards: ExpeditionRewardData | undefined;
		let loveChange = 0;

		if (totalFailure) {
			// Total failure: no rewards, lose love
			loveChange = ExpeditionConstants.LOVE_CHANGES.TOTAL_FAILURE;
		}
		else {
			// Second roll: check for partial success
			partialSuccess = RandomUtils.crowniclesRandom.bool(effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);

			const rewardIndex = calculateRewardIndex(expeditionData);
			rewards = calculateRewards(expeditionData, rewardIndex, partialSuccess);

			if (!partialSuccess) {
				// Total success: gain love
				loveChange = ExpeditionConstants.LOVE_CHANGES.TOTAL_SUCCESS;
			}
		}

		// Apply love change
		if (loveChange !== 0) {
			await petEntity.changeLovePoints({
				player,
				amount: loveChange,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			await petEntity.save();
		}

		// Apply rewards
		if (rewards) {
			if (rewards.money > 0) {
				await player.addMoney({
					amount: rewards.money,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
			}

			if (rewards.experience > 0) {
				await player.addExperience({
					amount: rewards.experience,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
			}

			if (rewards.points > 0) {
				await player.addScore({
					amount: rewards.points,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
			}

			// Guild experience
			if (rewards.guildExperience > 0 && player.guildId) {
				const guild = await Guilds.getById(player.guildId);
				if (guild) {
					await guild.addExperience(rewards.guildExperience, response, NumberChangeReason.SMALL_EVENT);
					await guild.save();
				}
			}

			/*
			 * Gems handled separately (need gem system)
			 * For now, convert gems to money bonus
			 */
			if (rewards.gems > 0) {
				await player.addMoney({
					amount: rewards.gems * ExpeditionConstants.GEM_TO_MONEY_FALLBACK_RATE,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
			}
		}

		await player.save();

		// Mark expedition as completed
		await PetExpeditions.completeExpedition(activeExpedition);

		response.push(makePacket(CommandPetExpeditionResolvePacketRes, {
			success: !totalFailure,
			partialSuccess,
			totalFailure,
			rewards,
			loveChange,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined,
			expedition: expeditionData
		}));
	}
}
