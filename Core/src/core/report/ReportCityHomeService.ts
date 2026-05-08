import { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { City } from "../../data/City";
import { Homes } from "../database/game/models/Home";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import {
	ReactionCollectorCityData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBuyHomeRes,
	CommandReportHomeBedAlreadyFullRes,
	CommandReportHomeBedRes,
	CommandReportMoveHomeRes,
	CommandReportNotEnoughMoneyRes,
	CommandReportUpgradeHomeRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Handle buy home reaction — player purchases a new home in the city
 */
export async function handleBuyHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
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

/**
 * Handle upgrade home reaction — player upgrades their home level
 */
export async function handleUpgradeHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
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

	const oldLevel = home.getLevel()!;
	const newLevel = HomeLevel.getNextUpgrade(oldLevel, player.level)!;
	home.level = newLevel.level;

	/*
	 * Note: inventory bonus is now calculated dynamically based on home level,
	 * so we no longer modify InventoryInfo during upgrades
	 */

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

/**
 * Handle move home reaction — player moves their home to a different city
 */
export async function handleMoveHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
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

/**
 * Handle home bed reaction — player rests in their home bed to recover health
 */
export async function handleHomeBedReaction(
	player: Player,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();

	const homeData = data.home.owned;
	if (!homeData) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use home bed without owning a home.`);
		return;
	}

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const maxHealth = player.getMaxHealth(playerActiveObjects);
	if (player.getHealth(playerActiveObjects) >= maxHealth) {
		response.push(makePacket(CommandReportHomeBedAlreadyFullRes, {}));
		return;
	}

	await player.addHealth({
		amount: homeData.features.bedHealthRegeneration,
		response,
		reason: NumberChangeReason.HOME_BED,
		playerActiveObjects
	});
	await TravelTime.applyEffect(player, Effect.SLEEPING, 0, new Date(), NumberChangeReason.HOME_BED);
	await player.save();
	response.push(makePacket(CommandReportHomeBedRes, {
		health: homeData.features.bedHealthRegeneration
	}));
}
