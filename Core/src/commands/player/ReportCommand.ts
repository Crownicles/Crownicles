import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealPacketReq,
	CommandReportPacketReq,
	CommandReportStayInCity,
	CommandReportUseTokensPacketReq
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { Player } from "../../core/database/game/models/Player";
import { Maps } from "../../core/maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	getDateLogs, getTimeFromXHoursAgo
} from "../../../../Lib/src/utils/TimeUtils";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { withLockedPlayerSafe } from "../../core/utils/withLockedPlayerSafe";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { TravelTime } from "../../core/maps/TravelTime";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { Effect } from "../../../../Lib/src/types/Effect";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	City, CityDataController
} from "../../data/City";
import {
	ReactionCollectorCity,
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData,
	ReactionCollectorCityMoveHomeReaction,
	ReactionCollectorCityShopReaction,
	ReactionCollectorCityUpgradeHomeReaction,
	ReactionCollectorEnchantReaction,
	ReactionCollectorExitCityReaction,
	ReactionCollectorHomeBedReaction,
	ReactionCollectorHomeMenuReaction,
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction,
	ReactionCollectorUpgradeItemReaction,
	ReactionCollectorBlacksmithMenuReaction,
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorBlacksmithDisenchantReaction,
	ReactionCollectorRoyalBlacksmithMenuReaction,
	ReactionCollectorRoyalBlacksmithUpgradeReaction,
	ReactionCollectorGardenHarvestReaction,
	ReactionCollectorGardenWaterReaction,
	ReactionCollectorGardenCompostReaction,
	ReactionCollectorGuildDomainMenuReaction,
	ReactionCollectorGuildDomainNotaryReaction,
	ReactionCollectorApartmentBuyReaction,
	ReactionCollectorApartmentClaimRentReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import { BuildingUpgradeEligibilityMap } from "../../../../Lib/src/types/GuildDomainEligibility";
import { GuildPets } from "../../core/database/game/models/GuildPet";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { Settings } from "../../core/database/game/models/Setting";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { Homes } from "../../core/database/game/models/Home";
import { Materials } from "../../core/database/game/models/Material";
import {
	createBuyHealCollector,
	createUseTokensCollector,
	validateBuyHealRequest,
	validateUseTokensRequest
} from "../../core/report/ReportTokenHealService";
import { openTokenMerchant } from "../../core/report/ReportTokenMerchantService";
import {
	HEAL_VALIDATION_REASONS, USE_TOKENS_VALIDATION_REASONS
} from "../../core/report/ReportValidationConstants";
import { executeSmallEvent } from "../../core/report/ReportSmallEventService";
import { chooseDestination } from "../../core/report/ReportDestinationService";
import { doRandomBigEvent } from "../../core/report/ReportBigEventService";
import { doPVEBoss } from "../../core/report/ReportPveService";
import { sendTravelPath } from "../../core/report/ReportTravelService";
import { crowniclesInstance } from "../../app";
import {
	CityMenuMask, CityVisitExitReason, CityVisitExitReasonValue
} from "../../core/database/logs/LogsCityLogger";
import { runWithDeferredCollectorStop } from "../../core/report/ReportCityShopHandoff";

const CITY_REACTION_MENU_MASK = new Map<string, number>([
	[ReactionCollectorInnMealReaction.name, CityMenuMask.INN],
	[ReactionCollectorInnRoomReaction.name, CityMenuMask.INN],
	[ReactionCollectorBlacksmithMenuReaction.name, CityMenuMask.BLACKSMITH],
	[ReactionCollectorBlacksmithUpgradeReaction.name, CityMenuMask.BLACKSMITH],
	[ReactionCollectorBlacksmithDisenchantReaction.name, CityMenuMask.BLACKSMITH],
	[ReactionCollectorRoyalBlacksmithMenuReaction.name, CityMenuMask.ROYAL_BLACKSMITH],
	[ReactionCollectorRoyalBlacksmithUpgradeReaction.name, CityMenuMask.ROYAL_BLACKSMITH],
	[ReactionCollectorUpgradeItemReaction.name, CityMenuMask.HOME],
	[ReactionCollectorEnchantReaction.name, CityMenuMask.ENCHANTER],
	[ReactionCollectorCityShopReaction.name, CityMenuMask.SHOP],
	[ReactionCollectorApartmentBuyReaction.name, CityMenuMask.NOTARY],
	[ReactionCollectorApartmentClaimRentReaction.name, CityMenuMask.NOTARY],
	[ReactionCollectorCityBuyHomeReaction.name, CityMenuMask.HOME],
	[ReactionCollectorCityUpgradeHomeReaction.name, CityMenuMask.HOME],
	[ReactionCollectorCityMoveHomeReaction.name, CityMenuMask.HOME],
	[ReactionCollectorHomeMenuReaction.name, CityMenuMask.HOME],
	[ReactionCollectorHomeBedReaction.name, CityMenuMask.HOME],
	[ReactionCollectorGuildDomainMenuReaction.name, CityMenuMask.GUILD_DOMAIN],
	[ReactionCollectorGuildDomainNotaryReaction.name, CityMenuMask.GUILD_DOMAIN],
	[ReactionCollectorGardenHarvestReaction.name, CityMenuMask.GARDEN_OR_COOKING],
	[ReactionCollectorGardenWaterReaction.name, CityMenuMask.GARDEN_OR_COOKING],
	[ReactionCollectorGardenCompostReaction.name, CityMenuMask.GARDEN_OR_COOKING]
]);
import {
	buildBlacksmithData
} from "../../core/report/ReportBlacksmithService";
import { buildRoyalBlacksmithData } from "../../core/report/ReportRoyalBlacksmithService";
import { handleRoyalBlacksmithUpgradeReaction } from "../../core/report/ReportCityRoyalBlacksmithService";
import {
	buildEnchanterData,
	buildHomeData,
	buildApartmentNotaryData,
	handleBlacksmithDisenchantReaction,
	handleBlacksmithUpgradeReaction,
	handleBuyHomeReaction,
	handleCityShopReaction,
	handleEnchantReaction,
	handleHomeBedReaction,
	handleInnMealReaction,
	handleInnRoomReaction,
	handleMoveHomeReaction,
	handleUpgradeHomeReaction,
	handleUpgradeItemReaction,
	isCityShopEmpty
} from "../../core/report/ReportCityService";
import { handleGuildDomainNotaryReaction } from "../../core/report/ReportCityGuildDomainService";
import { handleGardenCompostReaction } from "../../core/report/ReportGardenService";
import {
	handleApartmentBuyReaction,
	handleApartmentClaimRentReaction
} from "../../core/report/ReportCityNotaryService";

/**
 * Handle the case where the player is stationary inside a city.
 * Shows the city menu when no alteration is active, otherwise the resting/travel screen.
 * @returns true if the request was handled and the caller must return early
 */
async function tryHandleStationaryInCity(params: {
	context: PacketContext;
	response: CrowniclesPacket[];
	player: Player;
	currentDate: Date;
	city: City | undefined;
	currentEffectFinished: boolean;
	forceSpecificEvent: number;
}): Promise<boolean> {
	const {
		context, response, player, currentDate, city, currentEffectFinished, forceSpecificEvent
	} = params;
	if (!city || !player.insideCity) {
		return false;
	}
	if (currentEffectFinished) {
		await sendCityCollector(context, response, player, city, { forceSpecificEvent });
	}
	else {
		await sendTravelPath(player, response, currentDate, player.effectId);
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
	}
	return true;
}

/**
 * Handle the "player just arrived at their destination" case: PVE boss on the island,
 * otherwise a random big event. Unblocks the player afterwards.
 */
async function handleArrival(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player,
	forceSpecificEvent: number
): Promise<void> {
	try {
		if (Maps.isOnPveIsland(player)) {
			await doPVEBoss(player, response, context);
		}
		else {
			await doRandomBigEvent(context, response, player, forceSpecificEvent);
		}
	}
	finally {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
	}
}

/**
 * Handle the travelling player: trigger a small event when due, otherwise advance the
 * travel state (send path, start a travel, or choose a destination). Unblocks afterwards.
 */
async function continueTravelOrEvent(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player,
	currentDate: Date,
	forceSmallEvent: string | null
): Promise<void> {
	const currentEffectFinished = player.currentEffectFinished(currentDate);
	if (forceSmallEvent || await needSmallEvent(player, currentDate)) {
		await executeSmallEvent(response, player, context, forceSmallEvent);
	}
	else if (!currentEffectFinished) {
		await sendTravelPath(player, response, currentDate, player.effectId);
	}
	else if (!player.mapLinkId) {
		await Maps.startTravel(player, MapLinkDataController.instance.getRandomLinkOnMainContinent(), Date.now());
	}
	else if (!Maps.isTravelling(player)) {
		await chooseDestination(context, player, null, response);
	}
	else {
		await sendTravelPath(player, response, currentDate, null);
	}
	BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
}

export default class ReportCommand {
	@commandRequires(CommandReportPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandReportPacketReq,
		context: PacketContext,
		forceSmallEvent: string | null = null,
		forceSpecificEvent = -1
	): Promise<void> {
		if (player.score === 0 && player.effectId === Effect.NOT_STARTED.id) {
			await initiateNewPlayerOnTheAdventure(player);
		}

		BlockingUtils.blockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND, Constants.MESSAGES.COLLECTOR_TIME * 3); // MaxTime here is to prevent any accident permanent blocking

		await MissionsController.update(player, response, { missionId: "commandReport" });

		const currentDate = new Date();

		const currentEffectFinished = player.currentEffectFinished(currentDate);
		if (player.effectId !== Effect.NO_EFFECT.id && currentEffectFinished) {
			await MissionsController.update(player, response, { missionId: "recoverAlteration" });
		}

		const destinationId = player.getDestinationId();
		const city = destinationId === null ? undefined : CityDataController.instance.getCityByMapId(destinationId);
		if (await tryHandleStationaryInCity({
			context, response, player, currentDate, city, currentEffectFinished, forceSpecificEvent
		})) {
			return;
		}

		if (Maps.isArrived(player, currentDate)) {
			await handleArrival(context, response, player, forceSpecificEvent);
			return;
		}

		await continueTravelOrEvent(context, response, player, currentDate, forceSmallEvent);
	}

	@commandRequires(CommandReportUseTokensPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static async useTokens(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandReportUseTokensPacketReq,
		context: PacketContext
	): Promise<void> {
		const currentDate = new Date();
		const timeData = await TravelTime.getTravelData(player, currentDate);

		const validation = validateUseTokensRequest(player, player.effectId, timeData.effectRemainingTime);

		if (!validation.valid) {
			if (validation.reason === USE_TOKENS_VALIDATION_REASONS.INSUFFICIENT_TOKENS) {
				await openTokenMerchant(player, context, response);
			}
			return;
		}

		createUseTokensCollector(player, validation.tokenCost, context, response);
	}

	@commandRequires(CommandReportBuyHealPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static buyHeal(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandReportBuyHealPacketReq,
		context: PacketContext
	): void {
		const currentDate = new Date();
		const validation = validateBuyHealRequest(player, currentDate);

		if (!validation.valid) {
			if ("reason" in validation && validation.reason === HEAL_VALIDATION_REASONS.NO_ALTERATION) {
				response.push(makePacket(CommandReportBuyHealNoAlterationPacketRes, {}));
			}
			else if ("reason" in validation && validation.reason === HEAL_VALIDATION_REASONS.OCCUPIED) {
				response.push(makePacket(CommandReportBuyHealCannotHealOccupiedPacketRes, {}));
			}
			return;
		}

		createBuyHealCollector(player, validation.healPrice, context, response);
	}
}

function cityCollectorEndCallback(context: PacketContext, player: Player, forceSpecificEvent: number, city: City): EndCallback {
	const enterDate = getDateLogs();
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
		const firstReaction = collector.getFirstReaction();
		let exitReason: CityVisitExitReasonValue;
		let menusOpenedMask = 0;
		if (!firstReaction) {
			exitReason = CityVisitExitReason.TIMEOUT;
		}
		else if (firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			exitReason = CityVisitExitReason.REFUSE;
		}
		else if (firstReaction.reaction.type === ReactionCollectorExitCityReaction.name) {
			exitReason = CityVisitExitReason.EXIT_BUTTON;
		}
		else {
			exitReason = CityVisitExitReason.ENGAGED;
			menusOpenedMask = CITY_REACTION_MENU_MASK.get(firstReaction.reaction.type) ?? 0;
		}
		crowniclesInstance?.logsDatabase.logCityVisit({
			keycloakId: player.keycloakId,
			cityId: city.id,
			enterDate,
			exitDate: getDateLogs(),
			exitReason,
			menusOpenedMask
		}).then();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandReportStayInCity, {}));
		}
		else {
			await player.reload();
			await handleCityReaction(firstReaction.reaction.type, {
				context,
				player,
				forceSpecificEvent,
				city,
				response,
				reactionData: firstReaction.reaction.data,
				collectorData: collector.creationPacket.data.data,
				collectorId: collector.creationPacket.id
			});
		}
	};
}

type CityReactionParams = {
	context: PacketContext;
	player: Player;
	forceSpecificEvent: number;
	city: City;
	response: CrowniclesPacket[];
	reactionData: unknown;
	collectorData: unknown;
	collectorId: string;
};

async function handleCityShopReactionWithDeferredStop(params: CityReactionParams): Promise<void> {
	await runWithDeferredCollectorStop(params.response, params.collectorId, async () => {
		await handleCityShopReaction({
			player: params.player,
			city: params.city,
			shopId: (params.reactionData as ReactionCollectorCityShopReaction).shopId,
			context: params.context,
			response: params.response,
			onClose: async (closeResponse): Promise<void> => {
				await params.player.reload();
				await sendCityCollector(
					params.context,
					closeResponse,
					params.player,
					params.city,
					{ forceSpecificEvent: params.forceSpecificEvent }
				);
			}
		});
	});
}

const NOOP_REACTION = (): Promise<void> => Promise.resolve();

const CITY_REACTION_HANDLERS = new Map<string, (params: CityReactionParams) => Promise<void>>([
	[
		ReactionCollectorExitCityReaction.name, async (params): Promise<void> => {
			await withLockedPlayerSafe(params.player, "report.exitCity", async lockedPlayer => {
				lockedPlayer.insideCity = false;
				await lockedPlayer.save();
			});
			params.player.insideCity = false;
			await chooseDestination(params.context, params.player, null, params.response, {
				mainPacket: true,
				allowStayInCity: false
			});
		}
	],
	[
		ReactionCollectorInnMealReaction.name, async (params): Promise<void> => {
			await handleInnMealReaction(params.player, params.reactionData as ReactionCollectorInnMealReaction, params.response);
		}
	],
	[
		ReactionCollectorInnRoomReaction.name, async (params): Promise<void> => {
			await handleInnRoomReaction(params.player, params.reactionData as ReactionCollectorInnRoomReaction, params.response);
		}
	],
	[
		ReactionCollectorEnchantReaction.name, async (params): Promise<void> => {
			await handleEnchantReaction(params.player, params.reactionData as ReactionCollectorEnchantReaction, params.response);
		}
	],
	[
		ReactionCollectorCityBuyHomeReaction.name, async (params): Promise<void> => {
			await handleBuyHomeReaction(params.player, params.city, params.collectorData as ReactionCollectorCityData, params.response);
		}
	],
	[
		ReactionCollectorCityUpgradeHomeReaction.name, async (params): Promise<void> => {
			await handleUpgradeHomeReaction(params.player, params.city, params.collectorData as ReactionCollectorCityData, params.response);
		}
	],
	[
		ReactionCollectorCityMoveHomeReaction.name, async (params): Promise<void> => {
			await handleMoveHomeReaction(params.player, params.city, params.collectorData as ReactionCollectorCityData, params.response);
		}
	],
	[
		ReactionCollectorCityShopReaction.name, async (params): Promise<void> => {
			await handleCityShopReactionWithDeferredStop(params);
		}
	],
	[ReactionCollectorHomeMenuReaction.name, NOOP_REACTION],
	[
		ReactionCollectorHomeBedReaction.name, async (params): Promise<void> => {
			await handleHomeBedReaction(params.player, params.collectorData as ReactionCollectorCityData, params.response);
		}
	],
	[
		ReactionCollectorUpgradeItemReaction.name, async (params): Promise<void> => {
			await handleUpgradeItemReaction(
				params.player,
				params.reactionData as ReactionCollectorUpgradeItemReaction,
				params.collectorData as ReactionCollectorCityData,
				params.response
			);
		}
	],
	[ReactionCollectorBlacksmithMenuReaction.name, NOOP_REACTION],
	[
		ReactionCollectorBlacksmithUpgradeReaction.name, async (params): Promise<void> => {
			await handleBlacksmithUpgradeReaction(
				params.player,
				params.reactionData as ReactionCollectorBlacksmithUpgradeReaction,
				params.collectorData as ReactionCollectorCityData,
				params.response
			);
		}
	],
	[
		ReactionCollectorBlacksmithDisenchantReaction.name, async (params): Promise<void> => {
			await handleBlacksmithDisenchantReaction(
				params.player,
				params.reactionData as ReactionCollectorBlacksmithDisenchantReaction,
				params.collectorData as ReactionCollectorCityData,
				params.response
			);
		}
	],
	[ReactionCollectorRoyalBlacksmithMenuReaction.name, NOOP_REACTION],
	[
		ReactionCollectorRoyalBlacksmithUpgradeReaction.name, async (params): Promise<void> => {
			await handleRoyalBlacksmithUpgradeReaction(
				params.player,
				params.reactionData as ReactionCollectorRoyalBlacksmithUpgradeReaction,
				params.collectorData as ReactionCollectorCityData,
				params.response
			);
		}
	],
	[ReactionCollectorGardenHarvestReaction.name, NOOP_REACTION],
	[ReactionCollectorGardenWaterReaction.name, NOOP_REACTION],
	[
		ReactionCollectorGardenCompostReaction.name, async (params): Promise<void> => {
			const reaction = params.reactionData as ReactionCollectorGardenCompostReaction;
			await handleGardenCompostReaction(params.player, reaction.plantId, reaction.quantity, params.response);
		}
	],
	[ReactionCollectorGuildDomainMenuReaction.name, NOOP_REACTION],
	[
		ReactionCollectorGuildDomainNotaryReaction.name, async (params): Promise<void> => {
			await handleGuildDomainNotaryReaction(params.player, params.city, params.response);
		}
	],
	[
		ReactionCollectorApartmentBuyReaction.name, async (params): Promise<void> => {
			await handleApartmentBuyReaction(params.player, params.city, params.response);
		}
	],
	[
		ReactionCollectorApartmentClaimRentReaction.name, async (params): Promise<void> => {
			await handleApartmentClaimRentReaction(
				params.player,
				(params.reactionData as ReactionCollectorApartmentClaimRentReaction).apartmentId,
				params.response
			);
		}
	]
]);

async function handleCityReaction(reactionType: string, params: CityReactionParams): Promise<void> {
	const handler = CITY_REACTION_HANDLERS.get(reactionType);
	if (!handler) {
		CrowniclesLogger.error(`Unknown city reaction: ${reactionType}`);
		return;
	}
	await handler(params);
}

const GUILD_BUILDING_LEVEL_FIELDS: Record<GuildBuilding, "shopLevel" | "shelterLevel" | "pantryLevel" | "trainingGroundLevel"> = {
	[GuildBuilding.SHOP]: "shopLevel",
	[GuildBuilding.SHELTER]: "shelterLevel",
	[GuildBuilding.PANTRY]: "pantryLevel",
	[GuildBuilding.TRAINING_GROUND]: "trainingGroundLevel"
};

function buildCanUpgradeBuildings(guild: Guild): BuildingUpgradeEligibilityMap {
	const result = {} as BuildingUpgradeEligibilityMap;
	for (const building of Object.values(GuildBuilding)) {
		const currentLevel = guild[GUILD_BUILDING_LEVEL_FIELDS[building]];
		const upgradeCost = GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel);
		if (upgradeCost === null) {
			result[building] = null;
			continue;
		}
		const requiredGuildLevel = GuildDomainConstants.getBuildingRequiredGuildLevel(building, currentLevel);
		result[building] = {
			canAfford: guild.treasury >= upgradeCost,
			meetsLevel: requiredGuildLevel === null || guild.level >= requiredGuildLevel
		};
	}
	return result;
}

async function sendCityCollector(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player,
	city: City,
	options: {
		forceSpecificEvent: number; initialMenu?: string;
	} = { forceSpecificEvent: 0 }
): Promise<void> {
	const playerInventory = await InventorySlots.getOfPlayer(player.id);
	const playerActiveObjects = InventorySlots.slotsToActiveObjects(playerInventory);
	const isEnchanterHere = await Settings.ENCHANTER_CITY.getValue() === city.id;
	const enchantmentId = isEnchanterHere ? await Settings.ENCHANTER_ENCHANTMENT_ID.getValue() : null;
	const isPlayerMage = player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE;
	const enchantment = enchantmentId ? ItemEnchantment.getById(enchantmentId) : null;
	const home = await Homes.getOfPlayer(player.id);
	const homeLevel = home?.getLevel() ?? null;
	const playerMaterials = await Materials.getPlayerMaterials(player.id);
	const playerMaterialMap = new Map(playerMaterials.map(m => [m.materialId, m.quantity]));

	// Build blacksmith data if city has a blacksmith
	const blacksmith = city.blacksmithAvailable
		? buildBlacksmithData(playerInventory, playerMaterialMap, player)
		: undefined;

	// Build royal blacksmith data if city has a royal blacksmith (e.g. royal castle)
	const royalBlacksmith = city.royalBlacksmithAvailable
		? await buildRoyalBlacksmithData(playerInventory, playerMaterialMap, player)
		: undefined;

	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
	let shelterPets: Awaited<ReturnType<typeof PetEntities.getById>>[] = [];
	if (guild?.domainCityId === city.id) {
		const guildPetEntries = await GuildPets.getOfGuild(guild.id);
		shelterPets = await Promise.all(guildPetEntries.map(gp => PetEntities.getById(gp.petEntityId)));
	}
	const guildFoodSnapshot = guild
		? {
			food: {
				common: guild.commonFood,
				carnivorous: guild.carnivorousFood,
				herbivorous: guild.herbivorousFood,
				ultimate: guild.ultimateFood
			},
			foodArray: [
				guild.commonFood,
				guild.herbivorousFood,
				guild.carnivorousFood,
				guild.ultimateFood
			] as const,
			foodCaps: GuildDomainConstants.getFoodCaps(guild.pantryLevel)
		}
		: null;
	const guildMaxBuyableFood = guild && guildFoodSnapshot
		? GuildDomainConstants.getMaxBuyableFood(guild.treasury, guildFoodSnapshot.foodArray, guildFoodSnapshot.foodCaps)
		: null;

	const guildDomain = guild?.domainCityId === city.id
		? {
			isInCity: true,
			guildName: guild.name,
			shopLevel: guild.shopLevel,
			shelterLevel: guild.shelterLevel,
			pantryLevel: guild.pantryLevel,
			trainingGroundLevel: guild.trainingGroundLevel,
			guildLevel: guild.level,
			treasury: guild.treasury,
			playerMoney: player.money,
			isChief: guild.chiefId === player.id,
			isElder: guild.elderId === player.id,
			food: guildFoodSnapshot!.food,
			foodCaps: guildFoodSnapshot!.foodCaps,
			maxBuyableFood: guildMaxBuyableFood!,
			shelterPets: shelterPets.filter(pe => pe !== null).map(pe => pe!.asOwnedPet()),
			shelterMaxCount: GuildDomainConstants.getShelterSlots(guild.shelterLevel),
			canUpgradeBuildings: buildCanUpgradeBuildings(guild),
			canDeposit: {
				small: player.money >= GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT,
				big: player.money >= GuildDomainConstants.SHOP_PRICES.BIG_DEPOSIT,
				huge: player.money >= GuildDomainConstants.SHOP_PRICES.HUGE_DEPOSIT
			}
		}
		: undefined;

	const isGuildChief = guild !== null && guild.chiefId === player.id;
	let guildDomainNotary: ReactionCollectorCityData["guildDomainNotary"];
	if (isGuildChief && guild.domainCityId !== city.id) {
		const cost = guild.domainCityId
			? GuildDomainConstants.DOMAIN_RELOCATION_COST
			: GuildDomainConstants.DOMAIN_PURCHASE_COST;
		guildDomainNotary = {
			hasDomain: guild.domainCityId !== null,
			cost,
			treasury: guild.treasury,
			isChief: true,
			canAfford: guild.treasury >= cost
		};
	}

	/*
	 * Apartment notary: present in every city. Lets the player buy an apartment
	 * here (if none yet) and/or claim rent from apartments owned in other cities.
	 */
	const apartmentNotary = await buildApartmentNotaryData(player, city, home, new Date());

	// Guild food shop: available when the guild has a shop but is NOT in the domain city (where the full shop is available via the domain entrance).
	const guildFoodShop = guild && guild.shopLevel >= 1 && guild.domainCityId !== city.id
		? {
			guildName: guild.name,
			food: guildFoodSnapshot!.food,
			foodCaps: guildFoodSnapshot!.foodCaps,
			maxBuyableFood: guildMaxBuyableFood!,
			playerMoney: player.money,
			treasury: guild.treasury
		}
		: undefined;

	const collectorData: ReactionCollectorCityData = {
		mapTypeId: MapLocationDataController.instance.getById(player.getDestinationId()!)!.type,
		mapLocationId: player.getDestinationId()!,
		inns: city.inns.map(inn => ({
			innId: inn.id,
			meals: city.getTodayInnMeals(inn, new Date()).map(meal => ({
				mealId: meal.id,
				price: meal.price,
				energy: meal.energy
			})),
			rooms: inn.rooms.map(room => ({
				roomId: room.id,
				price: room.price,
				health: room.health
			}))
		})),
		shops: await Promise.all((city.shops || []).map(async shopId => ({
			shopId,
			isEmpty: await isCityShopEmpty(player, shopId)
		}))),
		energy: {
			current: player.getCumulativeEnergy(playerActiveObjects),
			max: player.getMaxCumulativeEnergy(playerActiveObjects)
		},
		health: {
			current: player.getHealth(),
			max: player.getMaxHealth()
		},
		bossArchivist: city.bossArchivistAvailable,
		enchanter: isEnchanterHere && enchantment
			? await buildEnchanterData(
				{
					inventory: playerInventory, player
				},
				{
					enchantment, enchantmentId: enchantmentId!, isPlayerMage
				}
			)
			: undefined,
		home: await buildHomeData(
			{
				player, inventory: playerInventory, materialMap: playerMaterialMap
			},
			{
				home, homeLevel
			},
			city
		),
		blacksmith,
		royalBlacksmith,
		guildDomain,
		guildFoodShop,
		guildDomainNotary,
		apartmentNotary,
		initialMenu: options.initialMenu
	};

	const collector = new ReactionCollectorCity(collectorData);

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1
		},
		cityCollectorEndCallback(context, player, options.forceSpecificEvent, city)
	)
		.block(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND)
		.build();

	response.push(collectorPacket);
}

/**
 * Initiates a new player on the map
 * @param player
 */
async function initiateNewPlayerOnTheAdventure(player: Player): Promise<void> {
	await Maps.startTravel(
		player,
		MapLinkDataController.instance.getById(Constants.BEGINNING.START_MAP_LINK)!,
		getTimeFromXHoursAgo(Constants.REPORT.HOURS_USED_TO_CALCULATE_FIRST_REPORT_REWARD)
			.valueOf()
	);
	await player.save();
}

/**
 * Returns if the player reached a stopping point (= small event)
 * @param player
 * @param date
 * @returns
 */
async function needSmallEvent(player: Player, date: Date): Promise<boolean> {
	return (await TravelTime.getTravelData(player, date)).nextSmallEventTime <= date.valueOf();
}
