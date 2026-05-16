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
import {
	Apartment, Apartments
} from "../database/game/models/Apartment";

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

	// If the player already owns an apartment in this city, it transitions to rented; reset its accrual.
	const apartmentInCity = await Apartments.getOfPlayerInCity(player.id, city.id);

	const apartmentLockKeys = apartmentInCity ? [Apartment.lockKey(apartmentInCity.id)] : [];
	await withLockedEntities(
		[Player.lockKey(player.id), ...apartmentLockKeys] as const,
		async lockedEntities => {
			const lockedPlayer = lockedEntities[0] as Player;
			const lockedApartment = apartmentInCity ? lockedEntities[1] as Apartment : null;

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
			if (lockedApartment) {
				lockedApartment.lastRentClaimedAt = new Date();
				await lockedApartment.save();
			}
			await lockedPlayer.save();

			response.push(makePacket(CommandReportBuyHomeRes, {
				cost: newPrice
			}));
		}
	);
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
 * Apply move-home rent logic under lock: if the player owns an apartment in
 * their current home city (the one being left), its accumulated rent is
 * credited against the move price. Below {@link HomeConstants.MIN_RENT_TO_CLAIM}
 * the rent is forfeited. Above the move price the surplus is forfeited too.
 *
 * Apartments transitioning between rented/unrented state have their
 * `lastRentClaimedAt` reset so unrented periods never accrue rent.
 */
async function applyMoveHomeUnderLock(params: {
	lockedHome: Home;
	lockedPlayer: Player;
	sourceCityId: string;
	sourceApartment: Apartment | null;
	destinationApartment: Apartment | null;
	destinationCityId: string;
	movePrice: number;
	response: CrowniclesPacket[];
}): Promise<{
	effectivePrice: number; rentApplied: number;
} | null> {
	const {
		lockedHome, lockedPlayer, sourceCityId, sourceApartment, destinationApartment, destinationCityId, movePrice, response
	} = params;

	if (lockedHome.cityId !== sourceCityId) {
		// Another concurrent move slipped through; abort silently — the caller's snapshot is stale.
		CrowniclesLogger.error(`Player ${lockedPlayer.keycloakId} home was moved to a different city before the move-home lock was acquired.`);
		return null;
	}

	let rentApplied = 0;
	if (sourceApartment) {
		const accumulated = sourceApartment.getAccumulatedRent();
		if (accumulated >= HomeConstants.MIN_RENT_TO_CLAIM) {
			rentApplied = Math.min(accumulated, movePrice);
		}
	}

	const effectivePrice = movePrice - rentApplied;
	if (effectivePrice > lockedPlayer.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: effectivePrice - lockedPlayer.money }));
		return null;
	}

	lockedHome.cityId = destinationCityId;

	const now = new Date();
	const saves: Promise<unknown>[] = [lockedHome.save()];

	if (sourceApartment) {
		// Source apartment is no longer rented (home left this city) — stop rent accrual.
		if (rentApplied > 0) {
			await lockedPlayer.addMoney({
				response,
				amount: rentApplied,
				reason: NumberChangeReason.APARTMENT_RENT_DEDUCTED
			});
		}
		sourceApartment.lastRentClaimedAt = now;
		saves.push(sourceApartment.save());
	}

	if (destinationApartment) {
		// Destination apartment becomes rented now — clear any accrual from unrented period.
		destinationApartment.lastRentClaimedAt = now;
		saves.push(destinationApartment.save());
	}

	await lockedPlayer.spendMoney({
		response,
		amount: movePrice,
		reason: NumberChangeReason.MOVE_HOME
	});
	saves.push(lockedPlayer.save());

	await Promise.all(saves);

	return {
		effectivePrice, rentApplied
	};
}

/**
 * Handle move home reaction — player moves their home to a different city.
 *
 * Concurrency: locks the Home, the Player wallet and any apartment in
 * the source or destination city so rent claim and city transitions are
 * serialised against concurrent moves, buys and claims.
 */
export async function handleMoveHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	if (!data.home.manage?.movePrice) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to move a home to city ${city.id} but no home is available to move. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	const home = await Homes.getOfPlayer(player.id);

	if (!home) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to move a home he doesn't own. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	const movePrice = data.home.manage.movePrice;
	const sourceCityId = home.cityId;
	const destinationCityId = city.id;

	/*
	 * The apartment in the city the player is leaving is the one that was rented;
	 * the apartment in the destination city (if any) will become rented after the move.
	 * Both need to be locked so their `lastRentClaimedAt` can be reset atomically.
	 */
	const [sourceApartment, destinationApartment] = await Promise.all([
		Apartments.getOfPlayerInCity(player.id, sourceCityId),
		Apartments.getOfPlayerInCity(player.id, destinationCityId)
	]);

	const apartmentLockKeys = [
		...sourceApartment ? [Apartment.lockKey(sourceApartment.id)] : [],
		...destinationApartment ? [Apartment.lockKey(destinationApartment.id)] : []
	];

	await withLockedEntities(
		[
			Home.lockKey(home.id),
			Player.lockKey(player.id),
			...apartmentLockKeys
		] as const,
		async lockedEntities => {
			const lockedHome = lockedEntities[0] as Home;
			const lockedPlayer = lockedEntities[1] as Player;
			let cursor = 2;
			const lockedSourceApartment = sourceApartment ? lockedEntities[cursor++] as Apartment : null;
			const lockedDestinationApartment = destinationApartment ? lockedEntities[cursor] as Apartment : null;

			const result = await applyMoveHomeUnderLock({
				lockedHome,
				lockedPlayer,
				sourceCityId,
				sourceApartment: lockedSourceApartment,
				destinationApartment: lockedDestinationApartment,
				destinationCityId,
				movePrice,
				response
			});
			if (result === null) {
				return;
			}
			response.push(makePacket(CommandReportMoveHomeRes, {
				cost: result.effectivePrice,
				...result.rentApplied > 0 ? { rentDeducted: result.rentApplied } : {}
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
