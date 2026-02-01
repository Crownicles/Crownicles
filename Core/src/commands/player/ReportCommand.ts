import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBigEventResultRes,
	CommandReportBuyHomeRes,
	CommandReportChooseDestinationCityRes,
	CommandReportChooseDestinationRes,
	CommandReportEatInnMealCooldownRes,
	CommandReportEatInnMealRes,
	CommandReportEnchantNotEnoughCurrenciesRes,
	CommandReportErrorNoMonsterRes,
	CommandReportItemCannotBeEnchantedRes,
	CommandReportItemEnchantedRes,
	CommandReportMonsterRewardRes,
	CommandReportMoveHomeRes,
	CommandReportNotEnoughMoneyRes,
	CommandReportPacketReq,
	CommandReportRefusePveFightRes,
	CommandReportSleepRoomRes,
	CommandReportStayInCity,
	CommandReportTravelSummaryRes,
	CommandReportUpgradeHomeRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import { Maps } from "../../core/maps/Maps";
import {
	MapLink, MapLinkDataController
} from "../../data/MapLink";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	getTimeFromXHoursAgo, millisecondsToMinutes, millisecondsToSeconds
} from "../../../../Lib/src/utils/TimeUtils";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { FightController } from "../../core/fights/FightController";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { MonsterDataController } from "../../data/Monster";
import { RealPlayerFighter } from "../../core/fights/fighter/RealPlayerFighter";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Guilds } from "../../core/database/game/models/Guild";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { crowniclesInstance } from "../../index";
import { MonsterFighter } from "../../core/fights/fighter/MonsterFighter";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { FightOvertimeBehavior } from "../../core/fights/FightOvertimeBehavior";
import { ClassDataController } from "../../data/Class";
import { PlayerSmallEvents } from "../../core/database/game/models/PlayerSmallEvent";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ReactionCollectorPveFight } from "../../../../Lib/src/packets/interaction/ReactionCollectorPveFight";
import {
	ReactionCollectorChooseDestination,
	ReactionCollectorChooseDestinationReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import { MapCache } from "../../core/maps/MapCache";
import { TravelTime } from "../../core/maps/TravelTime";
import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { ReportConstants } from "../../../../Lib/src/constants/ReportConstants";
import {
	BigEvent, BigEventDataController
} from "../../data/BigEvent";
import {
	ReactionCollectorBigEvent,
	ReactionCollectorBigEventPossibilityReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import { Possibility } from "../../data/events/Possibility";
import {
	applyPossibilityOutcome, PossibilityOutcome
} from "../../data/events/PossibilityOutcome";
import { ErrorPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { Effect } from "../../../../Lib/src/types/Effect";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { verifyPossibilityOutcomeCondition } from "../../data/events/PossibilityOutcomeCondition";
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
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { RequirementEffectPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";
import { Settings } from "../../core/database/game/models/Setting";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { ShopUtils } from "../../core/utils/ShopUtils";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import { ShopCategory } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	calculateGemsToMoneyRatio,
	getAThousandPointsShopItem,
	getMoneyShopItem,
	getValuableItemShopItem
} from "../../core/utils/MissionShopItems";
import { Homes } from "../../core/database/game/models/Home";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { PostFightPetLoveOutcomes } from "../../../../Lib/src/constants/PetConstants";

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
		if (city && currentEffectFinished) {
			await sendCityCollector(context, response, player, currentDate, city, forceSpecificEvent);
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
			if (city) {
				response.push(makePacket(RequirementEffectPacket, {
					currentEffectId: player.effectId,
					remainingTime: player.effectRemainingTime()
				}));
			}
			else {
				await sendTravelPath(player, response, currentDate, player.effectId);
			}
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
}

async function handleInnMealReaction(
	player: Player,
	reaction: ReactionCollectorInnMealReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	if (player.canEat()) {
		if (reaction.meal.price > player.money) {
			response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.meal.price - player.money }));
			return;
		}

		player.addEnergy(reaction.meal.energy, NumberChangeReason.INN_MEAL, await InventorySlots.getPlayerActiveObjects(player.id));
		player.eatMeal();
		await player.spendMoney({
			response,
			amount: reaction.meal.price,
			reason: NumberChangeReason.INN_MEAL
		});
		await player.save();
		response.push(makePacket(CommandReportEatInnMealRes, {
			energy: reaction.meal.energy,
			moneySpent: reaction.meal.price
		}));
	}
	else {
		response.push(makePacket(CommandReportEatInnMealCooldownRes, {}));
	}
}

async function handleInnRoomReaction(
	player: Player,
	reaction: ReactionCollectorInnRoomReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	if (reaction.room.price > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.room.price - player.money }));
		return;
	}

	await player.addHealth(reaction.room.health, response, NumberChangeReason.INN_ROOM, await InventorySlots.getPlayerActiveObjects(player.id));
	await player.spendMoney({
		response,
		amount: reaction.room.price,
		reason: NumberChangeReason.INN_ROOM
	});
	await TravelTime.applyEffect(player, Effect.SLEEPING, 0, new Date(), NumberChangeReason.INN_ROOM);
	await player.save();
	response.push(makePacket(CommandReportSleepRoomRes, {
		roomId: reaction.room.roomId,
		health: reaction.room.health,
		moneySpent: reaction.room.price
	}));
}

async function handleEnchantReaction(player: Player, reaction: ReactionCollectorEnchantReaction, response: CrowniclesPacket[]): Promise<void> {
	const enchantment = ItemEnchantment.getById(await Settings.ENCHANTER_ENCHANTMENT_ID.getValue());
	if (!enchantment) {
		CrowniclesLogger.error("No enchantment found for enchanter. Check ENCHANTER_ENCHANTMENT_ID setting.");
		return;
	}
	const isPlayerMage = player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE;
	const price = enchantment.getEnchantmentCost(isPlayerMage);

	const hasEnoughMoney = player.money >= price.money;
	const playerMissionsInfo = price.gems !== 0 ? await PlayerMissionsInfos.getOfPlayer(player.id) : null;
	const hasEnoughGems = playerMissionsInfo ? playerMissionsInfo.gems >= price.gems : true;

	if (!hasEnoughMoney || !hasEnoughGems) {
		response.push(makePacket(CommandReportEnchantNotEnoughCurrenciesRes, {
			missingMoney: hasEnoughMoney ? 0 : price.money - player.money,
			missingGems: hasEnoughGems ? 0 : price.gems - (playerMissionsInfo?.gems ?? 0)
		}));
		return;
	}

	const itemToEnchant = await InventorySlots.getItem(player.id, reaction.slot, reaction.itemCategory);
	if (!itemToEnchant || !(itemToEnchant.isWeapon() || itemToEnchant.isArmor()) || itemToEnchant.itemEnchantmentId) {
		CrowniclesLogger.error("Player tried to enchant an item that doesn't exist or cannot be enchanted. It shouldn't happen because the player must not be able to switch items while in the collector.");
		response.push(makePacket(CommandReportItemCannotBeEnchantedRes, {}));
		return;
	}

	await player.reload();

	itemToEnchant.itemEnchantmentId = enchantment.id;
	if (price.money > 0) {
		await player.spendMoney({
			response,
			amount: price.money,
			reason: NumberChangeReason.ENCHANT_ITEM
		});
	}
	if (price.gems > 0 && playerMissionsInfo) {
		await playerMissionsInfo.spendGems(price.gems, response, NumberChangeReason.ENCHANT_ITEM);
	}

	await Promise.all([
		itemToEnchant.save(),
		player.save(),
		playerMissionsInfo ? playerMissionsInfo.save() : Promise.resolve()
	]);

	response.push(makePacket(CommandReportItemEnchantedRes, {
		enchantmentId: enchantment.id,
		enchantmentType: enchantment.kind.type.id
	}));
}

async function handleBuyHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	if (!data.home.manage?.newPrice) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to buy a home in city ${city.id} but no home is available to buy. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}
	if (data.home.manage.newPrice > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: data.home.manage.newPrice - player.money }));
		return;
	}

	await Promise.all([
		player.spendMoney({
			response,
			amount: data.home.manage.newPrice,
			reason: NumberChangeReason.BUY_HOME
		}),
		Homes.createOrUpdateHome(player.id, city.id, HomeLevel.getInitialLevel().level)
	]);

	await player.save();

	response.push(makePacket(CommandReportBuyHomeRes, {
		cost: data.home.manage.newPrice
	}));
}

async function handleUpgradeHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	if (!data.home.manage?.upgrade) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade a home in city ${city.id} but no upgrade is available. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	if (data.home.manage.upgrade.price > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: data.home.manage.upgrade.price - player.money }));
		return;
	}

	const home = await Homes.getOfPlayer(player.id);

	if (!home || home.cityId !== city.id) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade a home he doesn't own in city ${city.id}. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	home.level = HomeLevel.getNextUpgrade(home.getLevel(), player.level).level;

	await player.spendMoney({
		response,
		amount: data.home.manage.upgrade.price,
		reason: NumberChangeReason.UPGRADE_HOME
	});

	await Promise.all([
		home.save(),
		player.save()
	]);

	response.push(makePacket(CommandReportUpgradeHomeRes, {
		cost: data.home.manage.upgrade.price
	}));
}

async function handleMoveHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	if (!data.home.manage?.movePrice) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to move a home to city ${city.id} but no home is available to move. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	if (data.home.manage.movePrice > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: data.home.manage.movePrice - player.money }));
		return;
	}

	const home = await Homes.getOfPlayer(player.id);

	if (!home) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to move a home he doesn't own. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	home.cityId = city.id;

	await player.spendMoney({
		response,
		amount: data.home.manage.movePrice,
		reason: NumberChangeReason.MOVE_HOME
	});

	await Promise.all([
		home.save(),
		player.save()
	]);

	response.push(makePacket(CommandReportMoveHomeRes, {
		cost: data.home.manage.movePrice
	}));
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
					await handleCityShopReaction(
						player,
						city,
						(firstReaction.reaction.data as ReactionCollectorCityShopReaction).shopId,
						context,
						response
					);
					break;
				default:
					CrowniclesLogger.error(`Unknown city reaction: ${firstReaction.reaction.type}`);
					break;
			}
		}
	};
}

async function handleCityShopReaction(
	player: Player,
	city: City,
	shopId: string,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	if (!city.shops?.includes(shopId)) {
		CrowniclesLogger.warn(`Player tried to access unknown shop ${shopId} in city ${city.id}`);
		return;
	}

	switch (shopId) {
		case "royalMarket":
			await openRoyalMarket(player, context, response);
			break;
		default:
			CrowniclesLogger.error(`Unhandled city shop ${shopId}`);
			break;
	}
}

async function openRoyalMarket(player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const shopCategories: ShopCategory[] = [
		{
			id: "resources",
			items: [
				getMoneyShopItem(),
				getValuableItemShopItem()
			]
		},
		{
			id: "prestige",
			items: [getAThousandPointsShopItem()]
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logMissionShopBuyout,
		additionalShopData: {
			currency: ShopCurrency.GEM,
			gemToMoneyRatio: calculateGemsToMoneyRatio()
		}
	});
}

async function sendCityCollector(context: PacketContext, response: CrowniclesPacket[], player: Player, currentDate: Date, city: City, forceSpecificEvent: number): Promise<void> {
	const playerInventory = await InventorySlots.getOfPlayer(player.id);
	const playerActiveObjects = InventorySlots.slotsToActiveObjects(playerInventory);
	const isEnchanterHere = await Settings.ENCHANTER_CITY.getValue() === city.id;
	const enchantmentId = isEnchanterHere ? await Settings.ENCHANTER_ENCHANTMENT_ID.getValue() : null;
	const isPlayerMage = player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE;
	const enchantment = ItemEnchantment.getById(enchantmentId);
	const home = await Homes.getOfPlayer(player.id);
	const nextHomeUpgrade = home ? HomeLevel.getNextUpgrade(home.getLevel(), player.level) : null;

	const collectorData: ReactionCollectorCityData = {
		enterCityTimestamp: TravelTime.getTravelDataSimplified(player, currentDate).travelStartTime,
		mapTypeId: MapLocationDataController.instance.getById(player.getDestinationId()).type,
		mapLocationId: player.getDestinationId(),
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
		enchanter: isEnchanterHere
			? {
				enchantableItems: playerInventory.filter(i => (i.isWeapon() || i.isArmor()) && i.itemId !== 0 && !i.itemEnchantmentId).map(i => ({
					category: i.itemCategory,
					slot: i.slot,
					details: i.itemWithDetails(player) as MainItemDetails
				})),
				isInventoryEmpty: playerInventory.filter(i => (i.isWeapon() || i.isArmor()) && i.itemId !== 0).length === 0,
				hasAtLeastOneEnchantedItem: playerInventory.filter(i => (i.isWeapon() || i.isArmor()) && Boolean(i.itemEnchantmentId)).length > 0,
				enchantmentId,
				enchantmentCost: enchantment.getEnchantmentCost(isPlayerMage),
				enchantmentType: enchantment.kind.type.id,
				mageReduction: isPlayerMage
			}
			: null,
		home: {
			owned: home && home.cityId === city.id
				? { level: home.level }
				: null,
			manage: {
				newPrice: home ? null : city.getHomeLevelPrice(HomeLevel.getInitialLevel(), await Homes.getHomesCount()),
				upgrade: nextHomeUpgrade && home && home.cityId === city.id
					? {
						price: city.getHomeLevelPrice(nextHomeUpgrade, await Homes.getHomesCount()),
						oldFeatures: home.getLevel().features,
						newFeatures: nextHomeUpgrade.features
					}
					: null,
				movePrice: home && home.cityId !== city.id ? city.getHomeLevelPrice(home.getLevel(), await Homes.getHomesCount()) : null,
				currentMoney: player.money
			}
		}
	};

	if (!collectorData.home.manage.newPrice && !collectorData.home.manage.upgrade && !collectorData.home.manage.movePrice) {
		delete collectorData.home.manage;
	}

	const collector = new ReactionCollectorCity(collectorData);

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1
		},
		cityCollectorEndCallback(context, player, forceSpecificEvent, city)
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
		MapLinkDataController.instance.getById(Constants.BEGINNING.START_MAP_LINK),
		getTimeFromXHoursAgo(Constants.REPORT.HOURS_USED_TO_CALCULATE_FIRST_REPORT_REWARD)
			.valueOf()
	);
	await player.save();
}

/**
 * Check all missions to check when you execute a big event
 * @param player
 * @param response
 */
async function completeMissionsBigEvent(player: Player, response: CrowniclesPacket[]): Promise<void> {
	await MissionsController.update(player, response, {
		missionId: "travelHours",
		params: {
			travelTime: player.getCurrentTripDuration()
		}
	});
	const endMapId = MapLinkDataController.instance.getById(player.mapLinkId).endMap;
	await MissionsController.update(player, response, {
		missionId: "goToPlace",
		params: { mapId: endMapId }
	});
	await MissionsController.update(player, response, {
		missionId: "exploreDifferentPlaces",
		params: { placeId: endMapId }
	});
	await MissionsController.update(player, response, {
		missionId: "fromPlaceToPlace",
		params: { mapId: endMapId }
	});
}

/**
 * @param event
 * @param possibility
 * @param player
 * @param time
 * @param context
 * @param response
 */
async function doPossibility(
	event: BigEvent,
	possibility: [string, Possibility],
	player: Player,
	time: number,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	player = await Players.getOrRegister(player.keycloakId);
	player.nextEvent = null;

	if (event.id === 0 && possibility[0] === "end") { // Don't do anything if the player ends the first report
		crowniclesInstance?.logsDatabase.logBigEvent(player.keycloakId, event.id, possibility[0], "0")
			.then();
		response.push(makePacket(CommandReportBigEventResultRes, {
			eventId: event.id,
			possibilityId: possibility[0],
			outcomeId: "0",
			oneshot: false,
			money: 0,
			energy: 0,
			gems: 0,
			experience: 0,
			health: 0,
			score: 0
		}));
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT);
		return;
	}

	// Filter the outcomes that are valid
	const entries = Object.entries(possibility[1].outcomes);

	const validOutcomes: [string, PossibilityOutcome][] = [];
	for (const [key, outcome] of entries) {
		if (!outcome.condition || await verifyPossibilityOutcomeCondition(outcome.condition, player)) {
			validOutcomes.push([key, outcome]);
		}
	}

	const randomOutcome = RandomUtils.crowniclesRandom.pick(validOutcomes);

	crowniclesInstance?.logsDatabase.logBigEvent(player.keycloakId, event.id, possibility[0], randomOutcome[0])
		.then();

	const newMapLink = await applyPossibilityOutcome({
		eventId: event.id,
		possibilityName: possibility[0],
		outcome: randomOutcome,
		time
	}, player, context, response);

	const isDead = await player.killIfNeeded(response, NumberChangeReason.BIG_EVENT);

	/*
	 * If the player is dead but a forced map link is provided, teleport them there
	 * Otherwise, only choose destination if player is alive
	 */
	if (newMapLink || !isDead) {
		await chooseDestination(context, player, newMapLink, response, false);
	}

	await MissionsController.update(player, response, { missionId: "doReports" });

	const tagsToVerify = (randomOutcome[1].tags ?? [])
		.concat(possibility[1].tags ?? [])
		.concat(event.tags ?? []);
	if (tagsToVerify) {
		for (const tag of tagsToVerify) {
			await MissionsController.update(player, response, {
				missionId: tag,
				params: { tags: tagsToVerify }
			});
		}
	}

	await player.save();
	BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT);
}

/**
 * @param event
 * @param player
 * @param time
 * @param context
 * @param response
 * @returns
 */
async function doEvent(event: BigEvent, player: Player, time: number, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const possibilities = await event.getPossibilities(player);

	const collector = new ReactionCollectorBigEvent(
		event.id,
		possibilities.map(possibility => ({ name: possibility[0] }))
	);

	const endCallback: EndCallback = async (collector, response) => {
		const reaction = collector.getFirstReaction();

		if (!reaction) {
			await doPossibility(event, possibilities.find(possibility => possibility[0] === "end"), player, time, context, response);
		}
		else {
			const reactionName = (reaction.reaction.data as ReactionCollectorBigEventPossibilityReaction).name;
			await doPossibility(event, possibilities.find(possibility => possibility[0] === reactionName), player, time, context, response);
		}
	};

	const packet = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId]
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.REPORT)
		.build();

	response.push(packet);
}

/**
 * Do a random big event
 * @param context
 * @param response
 * @param player
 * @param forceSpecificEvent
 */
async function doRandomBigEvent(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player,
	forceSpecificEvent = -1
): Promise<void> {
	await completeMissionsBigEvent(player, response);
	const travelData = TravelTime.getTravelDataSimplified(player, new Date());
	let time = millisecondsToMinutes(travelData.playerTravelledTime);
	if (time > ReportConstants.TIME_LIMIT) {
		time = ReportConstants.TIME_LIMIT;
	}

	let event;

	// NextEvent is defined?
	if (player.nextEvent) {
		forceSpecificEvent = player.nextEvent;
	}

	if (forceSpecificEvent === -1 || !forceSpecificEvent) {
		const mapId = player.getDestinationId();
		event = await BigEventDataController.instance.getRandomEvent(mapId, player);
		if (!event) {
			response.push(makePacket(ErrorPacket, { message: "It seems that there is no event here... It's a bug, please report it to the Crownicles staff." }));
			return;
		}
	}
	else {
		event = BigEventDataController.instance.getById(forceSpecificEvent);
	}
	await Maps.stopTravel(player);
	await doEvent(event, player, time, context, response);
}

function addDestinationResToResponse(
	response: CrowniclesPacket[],
	mapLink: MapLink,
	mapTypeId: string,
	tripDuration: number
): void {
	if (CityDataController.instance.getCityByMapLinkId(mapLink.id)) {
		response.push(makePacket(CommandReportChooseDestinationCityRes, {
			mapId: mapLink.endMap,
			mapTypeId
		}));
	}
	else {
		response.push(makePacket(CommandReportChooseDestinationRes, {
			mapId: mapLink.endMap,
			mapTypeId,
			tripDuration
		}));
	}
}

/**
 * Automatically chooses a destination at random / based on the forced link
 * @param forcedLink
 * @param player
 * @param destinationMaps
 * @param response
 */
async function automaticChooseDestination(forcedLink: MapLink, player: Player, destinationMaps: number[], response: CrowniclesPacket[]): Promise<void> {
	const newLink = forcedLink && forcedLink.id !== -1 ? forcedLink : MapLinkDataController.instance.getLinkByLocations(player.getDestinationId(), destinationMaps[0]);
	const endMap = MapLocationDataController.instance.getById(newLink.endMap);
	await Maps.startTravel(player, newLink, Date.now());
	addDestinationResToResponse(response, newLink, endMap.type, newLink.tripDuration);
}

/**
 * Sends a message so that the player can choose where to go
 * @param context
 * @param player
 * @param forcedLink Forced map link to go to
 * @param response
 * @param mainPacket
 */
async function chooseDestination(
	context: PacketContext,
	player: Player,
	forcedLink: MapLink | null,
	response: CrowniclesPacket[],
	mainPacket = true
): Promise<void> {
	await PlayerSmallEvents.removeSmallEventsOfPlayer(player.id);
	const destinationMaps = Maps.getNextPlayerAvailableMaps(player);

	if (destinationMaps.length === 0) {
		CrowniclesLogger.error(`Player ${player.id} hasn't any destination map (current map: ${player.getDestinationId()})`);
		return;
	}

	if ((!Maps.isOnPveIsland(player) || destinationMaps.length === 1)
		&& (forcedLink || destinationMaps.length === 1 && player.mapLinkId !== Constants.BEGINNING.LAST_MAP_LINK)
	) {
		await automaticChooseDestination(forcedLink, player, destinationMaps, response);
		return;
	}

	const mapReactions: ReactionCollectorChooseDestinationReaction[] = destinationMaps.map(mapId => {
		const mapLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId(), mapId);
		const mapTypeId = MapLocationDataController.instance.getById(mapId).type;
		const isPveMap = MapCache.allPveMapLinks.includes(mapLink.id);

		return {
			mapId,
			mapTypeId,
			tripDuration: isPveMap || RandomUtils.crowniclesRandom.bool() ? mapLink.tripDuration : null,
			enterInCity: Boolean(CityDataController.instance.getCityByMapLinkId(mapLink.id))
		};
	});

	const collector = new ReactionCollectorChooseDestination(mapReactions);

	/**
	 * Handle the player's destination choice
	 */
	const endCallback: EndCallback = async (collector, response) => {
		const firstReaction = collector.getFirstReaction();
		const mapId = firstReaction
			? (firstReaction.reaction.data as ReactionCollectorChooseDestinationReaction).mapId
			: (RandomUtils.crowniclesRandom.pick(collector.creationPacket.reactions).data as ReactionCollectorChooseDestinationReaction).mapId;
		const newLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId(), mapId);
		const endMap = MapLocationDataController.instance.getById(mapId);

		await Maps.startTravel(player, newLink, Date.now());

		addDestinationResToResponse(response, newLink, endMap.type, newLink.tripDuration);

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.CHOOSE_DESTINATION);
	};

	const packet = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			mainPacket,
			time: Math.min(Constants.MESSAGES.COLLECTOR_TIME, player.effectRemainingTime() || Constants.MESSAGES.COLLECTOR_TIME)
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.CHOOSE_DESTINATION)
		.build();

	response.push(packet);
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

/**
 * Send the location where the player is currently staying on the road
 * @param player
 * @param response
 * @param date
 * @param effectId
 */
async function sendTravelPath(player: Player, response: CrowniclesPacket[], date: Date, effectId: string | null = null): Promise<void> {
	const timeData = await TravelTime.getTravelData(player, date);
	const showEnergy = Maps.isOnPveIsland(player) || Maps.isOnBoat(player);
	const lastMiniEvent = await PlayerSmallEvents.getLastOfPlayer(player.id);
	const endMap = player.getDestination();
	const startMap = player.getPreviousMap();
	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	response.push(makePacket(CommandReportTravelSummaryRes, {
		effect: effectId,
		startTime: timeData.travelStartTime,
		arriveTime: timeData.travelEndTime,
		effectEndTime: effectId ? timeData.effectEndTime : null,
		effectDuration: timeData.effectDuration,
		points: {
			show: !showEnergy,
			cumulated: !showEnergy ? await PlayerSmallEvents.calculateCurrentScore(player) : 0
		},
		energy: {
			show: showEnergy,
			current: showEnergy ? player.getCumulativeEnergy(playerActiveObjects) : 0,
			max: showEnergy ? player.getMaxCumulativeEnergy(playerActiveObjects) : 0
		},
		endMap: {
			id: endMap.id,
			type: endMap.type
		},
		nextStopTime: timeData.nextSmallEventTime,
		lastSmallEventId: lastMiniEvent ? lastMiniEvent.eventType : null,
		startMap: {
			id: startMap.id,
			type: startMap.type
		},
		isOnBoat: Maps.isOnBoat(player)
	}));
}

/**
 * Handle rewards and pet reactions after a PVE fight
 * @param fight
 * @param player
 * @param rewards
 * @param endFightResponse
 */
async function handlePveFightRewards(
	fight: FightController,
	player: Player,
	rewards: {
		money: number; xp: number; guildScore: number; guildXp: number;
	},
	endFightResponse: CrowniclesPacket[]
): Promise<{
	guildXp: number; guildPoints: number;
}> {
	let guildXp = 0;
	let guildPoints = 0;

	if (!fight.isADraw()) {
		const winner = fight.getWinnerFighter();
		const petLoveResult = fight.getPostFightPetLoveChange(winner, PostFightPetLoveOutcomes.WIN);
		if (petLoveResult && winner instanceof RealPlayerFighter) {
			const petEntity = winner.pet;
			if (petEntity) {
				await petEntity.changeLovePoints({
					player: winner.player,
					response: endFightResponse,
					amount: petLoveResult.loveChange,
					reason: NumberChangeReason.FIGHT
				});
				await petEntity.save({ fields: ["lovePoints"] });
				fight.petReactionData = {
					keycloakId: winner.player.keycloakId,
					reactionType: petLoveResult.reactionType,
					loveDelta: petLoveResult.loveChange,
					petId: petEntity.typeId,
					petSex: petEntity.sex,
					petNickname: petEntity.nickname
				};
			}
		}
	}

	await player.addMoney({
		amount: rewards.money,
		reason: NumberChangeReason.PVE_FIGHT,
		response: endFightResponse
	});
	await player.addExperience({
		amount: rewards.xp,
		reason: NumberChangeReason.PVE_FIGHT,
		response: endFightResponse
	}, await InventorySlots.getPlayerActiveObjects(player.id));

	if (player.guildId) {
		const guild = await Guilds.getById(player.guildId);
		await guild.addScore(rewards.guildScore, endFightResponse, NumberChangeReason.PVE_FIGHT);
		await guild.addExperience(rewards.guildXp, endFightResponse, NumberChangeReason.PVE_FIGHT);
		await guild.save();
		if (guild.level < GuildConstants.MAX_LEVEL) {
			guildXp = rewards.guildXp;
		}
		guildPoints = rewards.guildScore;
	}
	return {
		guildXp, guildPoints
	};
}

/**
 * Do a PVE boss fight
 * @param player
 * @param response
 * @param context
 */
async function doPVEBoss(
	player: Player,
	response: CrowniclesPacket[],
	context: PacketContext
): Promise<void> {
	const seed = player.id + millisecondsToSeconds(player.startTravelDate.valueOf());
	const mapId = player.getDestination().id;
	const monsterObj = MonsterDataController.instance.getRandomMonster(mapId, seed);
	const randomLevel = player.level - PVEConstants.MONSTER_LEVEL_RANDOM_RANGE / 2 + seed % PVEConstants.MONSTER_LEVEL_RANDOM_RANGE;

	/**
	 * Handle rewards after the PVE fight completes
	 */
	const fightCallback = async (fight: FightController, endFightResponse: CrowniclesPacket[]): Promise<void> => {
		const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
		if (fight) {
			const rewards = monsterObj.getRewards(randomLevel);
			let guildXp = 0;
			let guildPoints = 0;

			player.fightPointsLost = fight.fightInitiator.getMaxEnergy() - fight.fightInitiator.getEnergy();

			// Only give reward if draw or win
			if (fight.isADraw() || fight.getWinnerFighter() instanceof RealPlayerFighter) {
				const result = await handlePveFightRewards(fight, player, rewards, endFightResponse);
				guildXp = result.guildXp;
				guildPoints = result.guildPoints;
				endFightResponse.push(makePacket(CommandReportMonsterRewardRes, {
					money: rewards.money,
					experience: rewards.xp,
					guildXp,
					guildPoints,
					petReaction: fight.petReactionData
						? {
							reactionType: fight.petReactionData.reactionType,
							loveDelta: fight.petReactionData.loveDelta,
							petId: fight.petReactionData.petId,
							petSex: fight.petReactionData.petSex,
							petNickname: fight.petReactionData.petNickname
						}
						: undefined
				}));
				await MissionsController.update(player, endFightResponse, { missionId: "winBoss" });
			}
			else {
				// Make sure the player has no energy left after a loss even if he leveled up
				player.setEnergyLost(player.getMaxCumulativeEnergy(playerActiveObjects), NumberChangeReason.PVE_FIGHT, playerActiveObjects);
			}

			await player.save();

			crowniclesInstance?.logsDatabase.logPveFight(fight)
				.then();
		}

		if (!await player.leavePVEIslandIfNoEnergy(endFightResponse, playerActiveObjects)) {
			await Maps.stopTravel(player);
			await player.setLastReportWithEffect(
				0,
				Effect.NO_EFFECT,
				NumberChangeReason.BIG_EVENT
			);
			await chooseDestination(context, player, null, endFightResponse);
		}
	};

	if (!monsterObj) {
		response.push(makePacket(CommandReportErrorNoMonsterRes, {}));
		await fightCallback(null, response);
		return;
	}

	const monsterFighter = new MonsterFighter(
		randomLevel,
		monsterObj
	);

	const reactionCollector = new ReactionCollectorPveFight({
		monster: {
			id: monsterObj.id,
			level: randomLevel,
			attack: monsterFighter.getAttack(),
			defense: monsterFighter.getDefense(),
			speed: monsterFighter.getSpeed(),
			energy: monsterFighter.getEnergy()
		},
		mapId
	});

	/**
	 * Handle the end of the PVE fight collector
	 */
	const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandReportRefusePveFightRes, {}));
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
			return;
		}

		const playerFighter = new RealPlayerFighter(player, ClassDataController.instance.getById(player.class));
		await playerFighter.loadStats("MonsterFighter");
		playerFighter.setBaseEnergy(playerFighter.getMaxEnergy() - player.fightPointsLost);

		const fight = new FightController(
			{
				fighter1: playerFighter,
				fighter2: monsterFighter
			},
			FightOvertimeBehavior.INCREASE_DAMAGE_PVE,
			context
		);
		fight.setEndCallback(fightCallback);
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
		await fight.startFight(response);
	};

	const packet = new ReactionCollectorInstance(
		reactionCollector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			time: PVEConstants.COLLECTOR_TIME
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT)
		.build();

	response.push(packet);
}

/**
 * Get a random small event
 * @param response
 * @param player
 * @param playerActiveObjects
 */
async function getRandomSmallEvent(response: CrowniclesPacket[], player: Player, playerActiveObjects: PlayerActiveObjects): Promise<string> {
	const keys = SmallEventDataController.instance.getKeys();
	let totalSmallEventsRarity = 0;
	const updatedKeys = [];
	for (const key of keys) {
		const file = await import(`../../core/smallEvents/${key}.js`);
		if (!file.smallEventFuncs?.canBeExecuted) {
			response.push(makePacket(ErrorPacket, { message: `${key} doesn't contain a canBeExecuted function` }));
			return null;
		}
		if (await (file.smallEventFuncs as SmallEventFuncs).canBeExecuted(player, playerActiveObjects)) {
			updatedKeys.push(key);
			totalSmallEventsRarity += SmallEventDataController.instance.getById(key).rarity;
		}
	}
	const randomNb = RandomUtils.randInt(1, totalSmallEventsRarity + 1);
	let sum = 0;
	for (const updatedKey of updatedKeys) {
		sum += SmallEventDataController.instance.getById(updatedKey).rarity;
		if (sum >= randomNb) {
			return updatedKey;
		}
	}
	return null;
}

/**
 * Executes a small event
 * @param response
 * @param player
 * @param context
 * @param forced
 */
async function executeSmallEvent(response: CrowniclesPacket[], player: Player, context: PacketContext, forced: string): Promise<void> {
	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);

	// Pick a random event
	const event: string = forced ? forced : await getRandomSmallEvent(response, player, playerActiveObjects);
	if (!event) {
		response.push(makePacket(ErrorPacket, { message: "No small event can be executed..." }));
		return;
	}

	// Execute the event
	const filename = `${event}.js`;
	try {
		const smallEventModule = require.resolve(`../../core/smallEvents/${filename}`);
		try {
			const smallEvent: SmallEventFuncs = require(smallEventModule).smallEventFuncs;
			crowniclesInstance?.logsDatabase.logSmallEvent(player.keycloakId, event)
				.then();

			// Save the small event BEFORE execution so it gets affected by timeTravel() if the event succeeds
			const smallEventRecord = PlayerSmallEvents.createPlayerSmallEvent(player.id, event, Date.now());
			await smallEventRecord.save();

			await smallEvent.executeSmallEvent(response, player, context, playerActiveObjects);
			await MissionsController.update(player, response, { missionId: "doReports" });
		}
		catch (e) {
			CrowniclesLogger.errorWithObj(`Error while executing ${filename} small event`, e);
			response.push(makePacket(ErrorPacket, { message: `${e}` }));
		}
	}
	catch {
		response.push(makePacket(ErrorPacket, { message: `${filename} doesn't exist` }));
	}
}
