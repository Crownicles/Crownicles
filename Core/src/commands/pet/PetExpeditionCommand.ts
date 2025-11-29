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
 * Cache for storing generated expeditions until the player makes a choice
 * Key: keycloakId, Value: { expeditions, timestamp }
 */
const pendingExpeditionsCache = new Map<string, {
	expeditions: ExpeditionData[];
	timestamp: number;
}>();

/**
 * Cache cleanup interval (5 minutes)
 */
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Cache expiry time (10 minutes)
 */
const CACHE_EXPIRY_TIME = 10 * 60 * 1000;

/**
 * Clean up expired cache entries periodically
 */
setInterval(() => {
	const now = Date.now();
	for (const [key, value] of pendingExpeditionsCache.entries()) {
		if (now - value.timestamp > CACHE_EXPIRY_TIME) {
			pendingExpeditionsCache.delete(key);
		}
	}
}, CACHE_CLEANUP_INTERVAL);

/**
 * Duration ranges for the 3 expedition slots
 * Slot 0: Short (10 min - 1 hour)
 * Slot 1: Medium (15 min - 10 hours)
 * Slot 2: Long (30 min - 3 days)
 */
const DURATION_RANGES = [
	{
		min: 10, max: 60
	},
	{
		min: 15, max: 10 * 60
	},
	{
		min: 30, max: 3 * 24 * 60
	}
];

/**
 * Generate a single random expedition with specified duration range and location
 */
function generateExpeditionWithConstraints(
	durationRange: {
		min: number; max: number;
	},
	locationType: ExpeditionLocationType
): ExpeditionData {
	const durationMinutes = RandomUtils.randInt(
		durationRange.min,
		durationRange.max + 1
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

	const expeditionData: ExpeditionData = {
		id: `${ExpeditionConstants.ID_GENERATION.PREFIX}_${Date.now()}_${RandomUtils.randInt(ExpeditionConstants.ID_GENERATION.RANDOM_MIN, ExpeditionConstants.ID_GENERATION.RANDOM_MAX)}`,
		durationMinutes,
		riskRate,
		difficulty,
		wealthRate: Math.round(wealthRate * ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION) / ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION,
		locationType
	};

	// Calculate food cost based on reward index
	expeditionData.foodCost = ExpeditionConstants.FOOD_CONSUMPTION[calculateRewardIndex(expeditionData)];

	return expeditionData;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = RandomUtils.randInt(0, i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * Generate 3 expeditions with different locations and fixed duration ranges
 */
function generateThreeExpeditions(): ExpeditionData[] {
	// Get all location types and shuffle them to ensure 3 different locations
	const allLocationTypes = Object.values(ExpeditionConstants.LOCATION_TYPES) as ExpeditionLocationType[];
	const shuffledLocations = shuffleArray(allLocationTypes);

	return [
		generateExpeditionWithConstraints(DURATION_RANGES[0], shuffledLocations[0]),
		generateExpeditionWithConstraints(DURATION_RANGES[1], shuffledLocations[1]),
		generateExpeditionWithConstraints(DURATION_RANGES[2], shuffledLocations[2])
	];
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
function calculateRewards(expedition: ExpeditionData, rewardIndex: number, isPartialSuccess: boolean, hasCloneTalisman: boolean): ExpeditionRewardData {
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

	// Calculate clone talisman drop chance (only if player doesn't already have it)
	let cloneTalismanFound = false;
	if (!hasCloneTalisman && !isPartialSuccess) {
		let dropChance = ExpeditionConstants.CLONE_TALISMAN.BASE_DROP_CHANCE
			+ rewardIndex * ExpeditionConstants.CLONE_TALISMAN.REWARD_INDEX_BONUS_PER_POINT;

		// Apply location bonus for special locations
		if ((ExpeditionConstants.CLONE_TALISMAN.BONUS_LOCATIONS as readonly string[]).includes(expedition.locationType)) {
			dropChance *= ExpeditionConstants.CLONE_TALISMAN.LOCATION_BONUS_MULTIPLIER;
		}

		// Cap at max drop chance
		dropChance = Math.min(dropChance, ExpeditionConstants.CLONE_TALISMAN.MAX_DROP_CHANCE);

		// Roll for clone talisman
		cloneTalismanFound = RandomUtils.crowniclesRandom.bool(dropChance / 100);
	}

	return {
		money,
		gems,
		experience,
		guildExperience,
		points,
		cloneTalismanFound
	};
}

/**
 * Context for expedition resolution validation - success case
 */
interface ExpeditionValidationSuccess {
	success: true;
	activeExpedition: NonNullable<Awaited<ReturnType<typeof PetExpeditions.getActiveExpeditionForPlayer>>>;
	petEntity: NonNullable<Awaited<ReturnType<typeof PetEntities.getById>>>;
}

/**
 * Context for expedition resolution validation - failure case
 */
interface ExpeditionValidationFailure {
	success: false;
	errorCode: string;
}

type ExpeditionValidationResult = ExpeditionValidationSuccess | ExpeditionValidationFailure;

/**
 * Validate expedition prerequisites before resolution
 */
async function validateExpeditionPrerequisites(
	playerId: number,
	petId: number | null
): Promise<ExpeditionValidationResult> {
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(playerId);
	if (!activeExpedition) {
		return {
			success: false,
			errorCode: "noExpedition"
		};
	}

	if (!activeExpedition.hasEnded()) {
		return {
			success: false,
			errorCode: "expeditionNotComplete"
		};
	}

	if (!petId) {
		return {
			success: false,
			errorCode: "noPet"
		};
	}

	const petEntity = await PetEntities.getById(petId);
	if (!petEntity) {
		return {
			success: false,
			errorCode: "noPet"
		};
	}

	return {
		success: true,
		activeExpedition,
		petEntity
	};
}

/**
 * Determine expedition outcome based on effective risk
 */
function determineExpeditionOutcome(
	effectiveRisk: number,
	expedition: ExpeditionData,
	hasCloneTalisman: boolean
): {
	totalFailure: boolean;
	partialSuccess: boolean;
	rewards: ExpeditionRewardData | undefined;
	loveChange: number;
} {
	const totalFailure = RandomUtils.crowniclesRandom.bool(effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);

	if (totalFailure) {
		return {
			totalFailure: true,
			partialSuccess: false,
			rewards: undefined,
			loveChange: ExpeditionConstants.LOVE_CHANGES.TOTAL_FAILURE
		};
	}

	const partialSuccess = RandomUtils.crowniclesRandom.bool(effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);
	const rewardIndex = calculateRewardIndex(expedition);
	const rewards = calculateRewards(expedition, rewardIndex, partialSuccess, hasCloneTalisman);

	return {
		totalFailure: false,
		partialSuccess,
		rewards,
		loveChange: partialSuccess ? 0 : ExpeditionConstants.LOVE_CHANGES.TOTAL_SUCCESS
	};
}

/**
 * Apply expedition rewards to player
 */
async function applyExpeditionRewards(
	rewards: ExpeditionRewardData,
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
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

	if (rewards.cloneTalismanFound) {
		player.hasCloneTalisman = true;
	}
}

/**
 * Food types with their ration values
 * Priority order: commonFood (treats) > carnivorousFood/herbivorousFood > ultimateFood (soup)
 */
type FoodType = "commonFood" | "carnivorousFood" | "herbivorousFood" | "ultimateFood";

const FOOD_RATION_VALUES: Record<FoodType, number> = {
	commonFood: 1,
	carnivorousFood: 3,
	herbivorousFood: 3,
	ultimateFood: 5
};

interface FoodConsumptionPlan {
	totalRations: number;
	consumption: {
		foodType: FoodType;
		itemsToConsume: number;
		rationsProvided: number;
	}[];
}

/**
 * Calculate the optimal food consumption plan
 * Priority: treats > meat/salad (based on diet) > soup
 * Minimizes excess rations while respecting priority order
 */
async function calculateFoodConsumptionPlan(
	player: Player,
	petModel: Pet,
	rationsRequired: number
): Promise<FoodConsumptionPlan> {
	const plan: FoodConsumptionPlan = {
		totalRations: 0,
		consumption: []
	};

	if (!player.guildId) {
		return plan;
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return plan;
	}

	const dietFoodType: FoodType = petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood";
	const treatVal = FOOD_RATION_VALUES.commonFood;
	const dietVal = FOOD_RATION_VALUES[dietFoodType];
	const soupVal = FOOD_RATION_VALUES.ultimateFood;

	const available = {
		treats: guild.commonFood,
		diet: guild[dietFoodType],
		soup: guild.ultimateFood
	};

	// Default to using everything if we can't meet requirements
	let best = {
		t: available.treats,
		d: available.diet,
		s: available.soup,
		excess: (available.treats * treatVal + available.diet * dietVal + available.soup * soupVal) - rationsRequired
	};

	// If we have enough to meet requirements, search for optimal
	if (best.excess >= 0) {
		// Iterate treats from max down to 0 to prioritize treats
		for (let t = Math.min(available.treats, rationsRequired); t >= 0; t--) {
			const rem = rationsRequired - t * treatVal;

			if (rem <= 0) {
				// Treats alone are enough
				const excess = -rem;
				if (excess < best.excess || (excess === best.excess && t > best.t)) {
					best = {
						t,
						d: 0,
						s: 0,
						excess
					};
				}
				if (excess === 0) {
					break; // Optimal found (0 excess, max treats)
				}
				continue;
			}

			/*
			 * Need diet/soup. We want to minimize s (Soup < Diet priority).
			 * We only need to check s in range [minSoup, minSoup + 2] to cover modulo 3 cases.
			 */
			const minSoup = Math.max(0, Math.ceil((rem - available.diet * dietVal) / soupVal));

			if (minSoup > available.soup) {
				continue; // Cannot satisfy with this t
			}

			// Check s, s+1, s+2
			for (let s = minSoup; s <= Math.min(available.soup, minSoup + 2); s++) {
				const remAfterSoup = rem - s * soupVal;
				const d = Math.max(0, Math.ceil(remAfterSoup / dietVal));

				if (d > available.diet) {
					continue;
				}

				const currentExcess = (t * treatVal + d * dietVal + s * soupVal) - rationsRequired;

				/*
				 * Compare with best.
				 * Priority: Minimize Excess > Maximize Treats > Maximize Diet (Minimize Soup)
				 */
				if (currentExcess < best.excess) {
					best = {
						t,
						d,
						s,
						excess: currentExcess
					};
				}

				if (currentExcess === 0) {
					break;
				}
			}

			if (best.excess === 0 && best.t === t) {
				break; // Found optimal
			}
		}
	}

	// Build the plan
	if (best.t > 0) {
		plan.consumption.push({
			foodType: "commonFood",
			itemsToConsume: best.t,
			rationsProvided: best.t * treatVal
		});
		plan.totalRations += best.t * treatVal;
	}

	if (best.d > 0) {
		plan.consumption.push({
			foodType: dietFoodType,
			itemsToConsume: best.d,
			rationsProvided: best.d * dietVal
		});
		plan.totalRations += best.d * dietVal;
	}

	if (best.s > 0) {
		plan.consumption.push({
			foodType: "ultimateFood",
			itemsToConsume: best.s,
			rationsProvided: best.s * soupVal
		});
		plan.totalRations += best.s * soupVal;
	}

	return plan;
}

/**
 * Apply the food consumption plan to the guild storage
 */
async function applyFoodConsumptionPlan(guildId: number, plan: FoodConsumptionPlan): Promise<void> {
	if (plan.consumption.length === 0) {
		return;
	}

	const guild = await Guilds.getById(guildId);
	if (!guild) {
		return;
	}

	for (const item of plan.consumption) {
		guild[item.foodType] -= item.itemsToConsume;
	}

	await guild.save();
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
				petNickname: petEntity.nickname ?? undefined,
				petId: petEntity.typeId,
				petSex: petEntity.sex
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
				petNickname: petEntity.nickname ?? undefined,
				petId: petEntity.typeId,
				petSex: petEntity.sex
			}));
			return;
		}

		// All requirements met
		response.push(makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: false,
			canStartExpedition: true,
			petLovePoints: petEntity.lovePoints,
			petNickname: petEntity.nickname ?? undefined,
			petId: petEntity.typeId,
			petSex: petEntity.sex
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
	async generateExpeditions(response: CrowniclesPacket[], player: Player, _packet: CommandPetExpeditionGeneratePacketReq, context: PacketContext): Promise<void> {
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

		// Generate 3 expeditions with different locations
		const expeditions = generateThreeExpeditions();

		// Store expeditions in cache for later retrieval when player makes a choice
		pendingExpeditionsCache.set(context.keycloakId, {
			expeditions,
			timestamp: Date.now()
		});

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
		packet: CommandPetExpeditionChoicePacketReq,
		context: PacketContext
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

		// Get expedition data from cache
		const cachedData = pendingExpeditionsCache.get(context.keycloakId);
		if (!cachedData) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "noExpeditionData"
			}));
			return;
		}

		// Find the chosen expedition by ID
		const expeditionData = cachedData.expeditions.find(exp => exp.id === packet.expeditionId);
		if (!expeditionData) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "noExpeditionData"
			}));
			return;
		}

		// Remove from cache after successful retrieval
		pendingExpeditionsCache.delete(context.keycloakId);

		const petModel = PetDataController.instance.getById(petEntity.typeId);
		const rewardIndex = calculateRewardIndex(expeditionData);
		const rationsRequired = ExpeditionConstants.FOOD_CONSUMPTION[rewardIndex];

		// Calculate optimal food consumption plan
		const foodPlan = await calculateFoodConsumptionPlan(player, petModel, rationsRequired);

		let insufficientFood = false;
		let insufficientFoodCause: "noGuild" | "guildNoFood" | undefined;

		if (foodPlan.totalRations < rationsRequired) {
			insufficientFood = true;

			// Distinguish between not being in a guild vs guild having no food
			if (!player.guildId) {
				insufficientFoodCause = "noGuild";
			}
			else {
				insufficientFoodCause = "guildNoFood";
			}
		}

		// Apply food consumption to guild storage
		if (player.guildId && foodPlan.consumption.length > 0) {
			await applyFoodConsumptionPlan(player.guildId, foodPlan);
		}

		// Create expedition
		const expedition = PetExpeditions.createExpedition(
			player.id,
			petEntity.id,
			expeditionData,
			expeditionData.durationMinutes,
			foodPlan.totalRations
		);
		await expedition.save();

		response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
			success: true,
			expedition: expedition.toExpeditionInProgressData(
				petEntity.typeId,
				petEntity.sex,
				petEntity.nickname ?? undefined
			),
			foodConsumed: foodPlan.totalRations,
			insufficientFood,
			insufficientFoodCause
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
		// Validate prerequisites
		const validation = await validateExpeditionPrerequisites(player.id, player.petId);
		if (validation.success === false) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: validation.errorCode }));
			return;
		}

		const {
			activeExpedition,
			petEntity
		} = validation;
		const petModel = PetDataController.instance.getById(petEntity.typeId);
		const expeditionData = activeExpedition.toExpeditionData();

		// Calculate effective risk and determine outcome
		const effectiveRisk = calculateEffectiveRisk(expeditionData, petModel, petEntity.lovePoints);
		const outcome = determineExpeditionOutcome(effectiveRisk, expeditionData, player.hasCloneTalisman);

		// Apply love change
		if (outcome.loveChange !== 0) {
			await petEntity.changeLovePoints({
				player,
				amount: outcome.loveChange,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			await petEntity.save();
		}

		// Apply rewards
		if (outcome.rewards) {
			await applyExpeditionRewards(outcome.rewards, player, response);
		}

		await player.save();

		// Mark expedition as completed
		await PetExpeditions.completeExpedition(activeExpedition);

		response.push(makePacket(CommandPetExpeditionResolvePacketRes, {
			success: !outcome.totalFailure,
			partialSuccess: outcome.partialSuccess,
			totalFailure: outcome.totalFailure,
			rewards: outcome.rewards,
			loveChange: outcome.loveChange,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined,
			expedition: expeditionData
		}));
	}
}
