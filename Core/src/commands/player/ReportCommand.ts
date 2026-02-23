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
import { getTimeFromXHoursAgo } from "../../../../Lib/src/utils/TimeUtils";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
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
	ReactionCollectorGardenHarvestReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { RequirementEffectPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
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
import { HEAL_VALIDATION_REASONS } from "../../core/report/ReportValidationConstants";
import { executeSmallEvent } from "../../core/report/ReportSmallEventService";
import { chooseDestination } from "../../core/report/ReportDestinationService";
import { doRandomBigEvent } from "../../core/report/ReportBigEventService";
import { doPVEBoss } from "../../core/report/ReportPveService";
import { sendTravelPath } from "../../core/report/ReportTravelService";
import {
	buildBlacksmithData,
	buildEnchanterData,
	buildHomeData,
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
	handleUpgradeItemReaction
} from "../../core/report/ReportCityService";

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

		const city = CityDataController.instance.getCityByMapLinkId(player.mapLinkId);
		if (city) {
			if (currentEffectFinished) {
				await sendCityCollector(context, response, player, currentDate, city, { forceSpecificEvent });
			}
			else {
				response.push(makePacket(RequirementEffectPacket, {
					currentEffectId: player.effectId,
					remainingTime: player.effectRemainingTime()
				}));
				BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			}
			return;
		}

		if (Maps.isArrived(player, currentDate)) {
			if (Maps.isOnPveIsland(player)) {
				await doPVEBoss(player, response, context);
			}
			else {
				await doRandomBigEvent(context, response, player, forceSpecificEvent);
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		if (forceSmallEvent || await needSmallEvent(player, currentDate)) {
			await executeSmallEvent(response, player, context, forceSmallEvent);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		if (!currentEffectFinished) {
			await sendTravelPath(player, response, currentDate, player.effectId);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		if (!player.mapLinkId) {
			await Maps.startTravel(player, MapLinkDataController.instance.getRandomLinkOnMainContinent(), Date.now());
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		if (!Maps.isTravelling(player)) {
			await chooseDestination(context, player, null, response);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		await sendTravelPath(player, response, currentDate, null);
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
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
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandReportStayInCity, {}));
		}
		else {
			await player.reload();
			await handleCityReaction({
				context,
				player,
				forceSpecificEvent,
				city,
				collector,
				firstReaction,
				response
			});
		}
	};
}

async function handleCityReaction(params: {
	context: PacketContext;
	player: Player;
	forceSpecificEvent: number;
	city: City;
	collector: ReactionCollectorInstance;
	firstReaction: { reaction: {
		type: string; data?: unknown;
	}; };
	response: CrowniclesPacket[];
}): Promise<void> {
	const {
		context, player, forceSpecificEvent, city, collector, firstReaction, response
	} = params;
	switch (firstReaction.reaction.type) {
		case ReactionCollectorExitCityReaction.name:
			await doRandomBigEvent(context, response, player, forceSpecificEvent);
			break;
		case ReactionCollectorInnMealReaction.name:
			await handleInnMealReaction(player, firstReaction.reaction.data as ReactionCollectorInnMealReaction, response);
			break;
		case ReactionCollectorInnRoomReaction.name:
			await handleInnRoomReaction(player, firstReaction.reaction.data as ReactionCollectorInnRoomReaction, response);
			break;
		case ReactionCollectorEnchantReaction.name:
			await handleEnchantReaction(player, firstReaction.reaction.data as ReactionCollectorEnchantReaction, response);
			break;
		case ReactionCollectorCityBuyHomeReaction.name:
			await handleBuyHomeReaction(player, city, collector.creationPacket.data.data as ReactionCollectorCityData, response);
			break;
		case ReactionCollectorCityUpgradeHomeReaction.name:
			await handleUpgradeHomeReaction(player, city, collector.creationPacket.data.data as ReactionCollectorCityData, response);
			break;
		case ReactionCollectorCityMoveHomeReaction.name:
			await handleMoveHomeReaction(player, city, collector.creationPacket.data.data as ReactionCollectorCityData, response);
			break;
		case ReactionCollectorCityShopReaction.name:
			await handleCityShopReaction({
				player,
				city,
				shopId: (firstReaction.reaction.data as ReactionCollectorCityShopReaction).shopId,
				context,
				response
			});
			break;
		case ReactionCollectorHomeMenuReaction.name:
			// Home menu reaction - currently just re-opens city menu (handled by Discord frontend)
			break;
		case ReactionCollectorHomeBedReaction.name:
			await handleHomeBedReaction(player, collector.creationPacket.data.data as ReactionCollectorCityData, response);
			break;
		case ReactionCollectorUpgradeItemReaction.name:
			await handleUpgradeItemReaction(
				player,
				firstReaction.reaction.data as ReactionCollectorUpgradeItemReaction,
				collector.creationPacket.data.data as ReactionCollectorCityData,
				response
			);
			break;
		case ReactionCollectorBlacksmithMenuReaction.name:
			// Blacksmith menu reaction - handled by Discord frontend
			break;
		case ReactionCollectorBlacksmithUpgradeReaction.name:
			await handleBlacksmithUpgradeReaction(
				player,
				firstReaction.reaction.data as ReactionCollectorBlacksmithUpgradeReaction,
				collector.creationPacket.data.data as ReactionCollectorCityData,
				response
			);
			break;
		case ReactionCollectorBlacksmithDisenchantReaction.name:
			await handleBlacksmithDisenchantReaction(
				player,
				firstReaction.reaction.data as ReactionCollectorBlacksmithDisenchantReaction,
				collector.creationPacket.data.data as ReactionCollectorCityData,
				response
			);
			break;
		case ReactionCollectorGardenHarvestReaction.name:
			// Garden harvest — handled via async packet in GardenFeatureHandler
			break;
		default:
			CrowniclesLogger.error(`Unknown city reaction: ${firstReaction.reaction.type}`);
			break;
	}
}

async function sendCityCollector(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player,
	currentDate: Date,
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

	const collectorData: ReactionCollectorCityData = {
		enterCityTimestamp: TravelTime.getTravelDataSimplified(player, currentDate).travelStartTime,
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
		shops: (city.shops || []).map(shopId => ({
			shopId
		})),
		energy: {
			current: player.getCumulativeEnergy(playerActiveObjects),
			max: player.getMaxCumulativeEnergy(playerActiveObjects)
		},
		health: {
			current: player.getHealth(playerActiveObjects),
			max: player.getMaxHealth(playerActiveObjects)
		},
		enchanter: isEnchanterHere && enchantment
			? buildEnchanterData(
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
