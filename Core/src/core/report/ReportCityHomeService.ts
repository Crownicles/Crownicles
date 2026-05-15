import { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { City } from "../../data/City";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import {
	ReactionCollectorCityData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBedCooldownRes,
	CommandReportBuyHomeRes,
	CommandReportHomeBedAlreadyFullRes,
	CommandReportHomeBedRes,
	CommandReportMoveHomeRes,
	CommandReportNotEnoughMoneyRes,
	CommandReportUpgradeHomeRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";

/**
 * Handle buy home reaction — player purchases a new home in the city
 *
 * Concurrency: the read-validate-spend sequence on `player.money`
 * runs inside `Player.withLocked`. The home creation happens inside
 * the same transaction (via CLS propagation) so a partial failure
 * after spending money rolls everything back atomically.
 */
export async function handleBuyHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	if (!data.home.manage?.newPrice) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to buy a home in city ${city.id} but no home is available to buy. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}
	if (data.home.manage.newPrice > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: data.home.manage.newPrice - player.money }));
		return;
	}

	const newPrice = data.home.manage.newPrice;
	await Player.withLocked(player.id, async lockedPlayer => {
		// Re-validate against the freshly-locked row.
		if (newPrice > lockedPlayer.money) {
			response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: newPrice - lockedPlayer.money }));
			return;
		}

		await lockedPlayer.spendMoney({
			response,
			amount: newPrice,
			reason: NumberChangeReason.BUY_HOME
		});
		await Homes.createOrUpdateHome(lockedPlayer.id, city.id, HomeLevel.getInitialLevel().level);
		await lockedPlayer.save();

		response.push(makePacket(CommandReportBuyHomeRes, {
			cost: newPrice
		}));
	});
}

/**
 * Handle upgrade home reaction — player upgrades their home level
 *
 * Concurrency: holds row locks on both the Player wallet AND the Home
 * row so a concurrent move-home, upgrade-home, or buy-home cannot
 * conflict on the same `home` row while we mutate `home.level`.
 */
export async function handleUpgradeHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
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

	const upgradePrice = data.home.manage.upgrade.price;
	await withLockedEntities(
		[Home.lockKey(home.id), Player.lockKey(player.id)] as const,
		async ([lockedHome, lockedPlayer]) => {
			/*
			 * Re-validate against the freshly-locked rows. The home
			 * could have been moved/deleted by a concurrent reaction,
			 * or the player could have spent the money elsewhere.
			 */
			if (upgradePrice > lockedPlayer.money) {
				response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: upgradePrice - lockedPlayer.money }));
				return;
			}
			if (lockedHome.cityId !== city.id) {
				CrowniclesLogger.error(`Player ${player.keycloakId} home was moved to a different city before the upgrade lock was acquired.`);
				return;
			}

			const oldLevel = lockedHome.getLevel()!;
			const newLevel = HomeLevel.getNextUpgrade(oldLevel, lockedPlayer.level)!;
			lockedHome.level = newLevel.level;

			/*
			 * Note: inventory bonus is now calculated dynamically based on home level,
			 * so we no longer modify InventoryInfo during upgrades
			 */

			await lockedPlayer.spendMoney({
				response,
				amount: upgradePrice,
				reason: NumberChangeReason.UPGRADE_HOME
			});

			await Promise.all([
				lockedHome.save(),
				lockedPlayer.save()
			]);

			response.push(makePacket(CommandReportUpgradeHomeRes, {
				cost: upgradePrice
			}));
		}
	);
}

/**
 * Handle move home reaction — player moves their home to a different city
 *
 * Concurrency: locks both the Player wallet and the Home row to
 * serialise concurrent move/upgrade requests on the same home.
 */
export async function handleMoveHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
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

	const movePrice = data.home.manage.movePrice;
	await withLockedEntities(
		[Home.lockKey(home.id), Player.lockKey(player.id)] as const,
		async ([lockedHome, lockedPlayer]) => {
			if (movePrice > lockedPlayer.money) {
				response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: movePrice - lockedPlayer.money }));
				return;
			}

			lockedHome.cityId = city.id;

			await lockedPlayer.spendMoney({
				response,
				amount: movePrice,
				reason: NumberChangeReason.MOVE_HOME
			});

			await Promise.all([
				lockedHome.save(),
				lockedPlayer.save()
			]);

			response.push(makePacket(CommandReportMoveHomeRes, {
				cost: movePrice
			}));
		}
	);
}

/**
 * Handle home bed reaction — player rests in their home bed to recover health.
 *
 * The bed no longer applies a SLEEPING effect (so the player can keep playing),
 * but is limited to one use per `BED_COOLDOWN_MS` window across all bed sources
 * (home bed, apartment bed, inn room).
 *
 * Concurrency: read-validate-update of `lastBedUsedAt` and `health` runs under
 * a Player row lock to prevent two parallel bed reactions from doubling the heal.
 */
export async function handleHomeBedReaction(
	player: Player,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	const homeData = data.home.owned;
	if (!homeData) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use home bed without owning a home.`);
		return;
	}

	await Player.withLocked(player.id, async lockedPlayer => {
		const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(lockedPlayer.id);
		const maxHealth = lockedPlayer.getMaxHealth(playerActiveObjects);
		if (lockedPlayer.getHealth(playerActiveObjects) >= maxHealth) {
			response.push(makePacket(CommandReportHomeBedAlreadyFullRes, {}));
			return;
		}

		const now = new Date();
		if (lockedPlayer.lastBedUsedAt && now.getTime() - lockedPlayer.lastBedUsedAt.getTime() < HomeConstants.BED_COOLDOWN_MS) {
			response.push(makePacket(CommandReportBedCooldownRes, {
				nextAvailableAt: lockedPlayer.lastBedUsedAt.getTime() + HomeConstants.BED_COOLDOWN_MS
			}));
			return;
		}

		await lockedPlayer.addHealth({
			amount: homeData.features.bedHealthRegeneration,
			response,
			reason: NumberChangeReason.HOME_BED,
			playerActiveObjects
		});
		lockedPlayer.lastBedUsedAt = now;
		await lockedPlayer.save();
		response.push(makePacket(CommandReportHomeBedRes, {
			health: homeData.features.bedHealthRegeneration
		}));
	});
}
