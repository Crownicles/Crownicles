import { Player } from "../database/game/models/Player";
import {
	City, CityDataController
} from "../../data/City";
import {
	Apartment, Apartments
} from "../database/game/models/Apartment";
import {
	Home, Homes
} from "../database/game/models/Home";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportApartmentAlreadyOwnedRes,
	CommandReportApartmentBuyRes,
	CommandReportApartmentClaimRentRes,
	CommandReportApartmentClaimRentTooLowRes,
	CommandReportNotEnoughMoneyRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Whether `apartment` is currently rented out — i.e. the player's main home
 * is in the same city as the apartment, so a tenant occupies it.
 */
export function isApartmentRented(apartment: Apartment, home: Home | null): boolean {
	return home !== null && home.cityId === apartment.cityId;
}

/**
 * Handle apartment purchase reaction — player buys a new apartment in the current city.
 *
 * Concurrency: read-validate-spend-create runs under a Player lock so two
 * concurrent buy attempts cannot both pass the wallet check, and the unique
 * (ownerId, cityId) index on `apartments` prevents two apartments in the
 * same city even if locks were bypassed.
 */
export async function handleApartmentBuyReaction(player: Player, city: City, response: CrowniclesPacket[]): Promise<void> {
	const price = city.apartmentPrice;
	if (!price) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to buy an apartment in city ${city.id} which has no apartmentPrice configured.`);
		return;
	}

	if (price > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: price - player.money }));
		return;
	}

	await Player.withLocked(player.id, async lockedPlayer => {
		// Re-validate ownership against the locked player.
		const existing = await Apartments.getOfPlayerInCity(lockedPlayer.id, city.id);
		if (existing) {
			response.push(makePacket(CommandReportApartmentAlreadyOwnedRes, {
				cityId: city.id,
				mapLocationId: city.maps[0]
			}));
			return;
		}

		if (price > lockedPlayer.money) {
			response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: price - lockedPlayer.money }));
			return;
		}

		await lockedPlayer.spendMoney({
			response,
			amount: price,
			reason: NumberChangeReason.APARTMENT_BUY
		});
		await Apartment.create({
			ownerId: lockedPlayer.id,
			cityId: city.id,
			purchasePrice: price,
			lastRentClaimedAt: new Date()
		});
		await lockedPlayer.save();

		response.push(makePacket(CommandReportApartmentBuyRes, {
			cityId: city.id,
			mapLocationId: city.maps[0],
			cost: price
		}));
	});
}

/**
 * Handle apartment rent claim reaction — player collects the accumulated rent
 * of a specific apartment they own.
 *
 * Concurrency: holds row locks on both the Player wallet AND the Apartment
 * so that a concurrent claim, move-home, or buy-home cannot double-credit
 * the rent or read a stale `lastRentClaimedAt`.
 */
export async function handleApartmentClaimRentReaction(player: Player, apartmentId: number, response: CrowniclesPacket[]): Promise<void> {
	await withLockedEntities(
		[Apartment.lockKey(apartmentId), Player.lockKey(player.id)] as const,
		async ([lockedApartment, lockedPlayer]) => {
			if (lockedApartment.ownerId !== lockedPlayer.id) {
				CrowniclesLogger.error(`Player ${lockedPlayer.keycloakId} tried to claim rent of apartment ${apartmentId} they don't own.`);
				return;
			}

			const home = await Homes.getOfPlayer(lockedPlayer.id);
			if (!isApartmentRented(lockedApartment, home)) {
				// Not rented out → no rent accrual. Surface as too-low.
				const apartmentCity = CityDataController.instance.getById(lockedApartment.cityId)!;
				response.push(makePacket(CommandReportApartmentClaimRentTooLowRes, {
					cityId: lockedApartment.cityId,
					mapLocationId: apartmentCity.maps[0],
					currentRent: 0,
					minRequired: HomeConstants.MIN_RENT_TO_CLAIM
				}));
				return;
			}

			const accumulated = lockedApartment.getAccumulatedRent();
			if (accumulated < HomeConstants.MIN_RENT_TO_CLAIM) {
				const apartmentCity = CityDataController.instance.getById(lockedApartment.cityId)!;
				response.push(makePacket(CommandReportApartmentClaimRentTooLowRes, {
					cityId: lockedApartment.cityId,
					mapLocationId: apartmentCity.maps[0],
					currentRent: accumulated,
					minRequired: HomeConstants.MIN_RENT_TO_CLAIM
				}));
				return;
			}

			await lockedPlayer.addMoney({
				response,
				amount: accumulated,
				reason: NumberChangeReason.APARTMENT_RENT_CLAIM
			});
			lockedApartment.lastRentClaimedAt = new Date();
			await Promise.all([lockedApartment.save(), lockedPlayer.save()]);

			const apartmentCity = CityDataController.instance.getById(lockedApartment.cityId)!;
			response.push(makePacket(CommandReportApartmentClaimRentRes, {
				cityId: lockedApartment.cityId,
				mapLocationId: apartmentCity.maps[0],
				rentClaimed: accumulated
			}));
		}
	);
}
