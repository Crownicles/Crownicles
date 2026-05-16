import { Player } from "../database/game/models/Player";
import {
	City, CityDataController
} from "../../data/City";
import {
	Apartment, Apartments
} from "../database/game/models/Apartment";
import { Homes } from "../database/game/models/Home";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportApartmentAlreadyOwnedRes,
	CommandReportApartmentBuyRes,
	CommandReportApartmentClaimRentRes,
	CommandReportApartmentClaimRentTooLowRes,
	CommandReportApartmentRequiresHomeRes,
	CommandReportNotEnoughMoneyRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { UniqueConstraintError } from "sequelize";

function buildClaimTooLowPacket(apartment: Apartment, currentRent: number): CrowniclesPacket | null {
	const apartmentCity = CityDataController.instance.getById(apartment.cityId);
	if (!apartmentCity || apartmentCity.maps.length === 0) {
		CrowniclesLogger.error(`Apartment ${apartment.id} has invalid cityId ${apartment.cityId} (no city or no map). Skipping claim-too-low packet.`);
		return null;
	}
	return makePacket(CommandReportApartmentClaimRentTooLowRes, {
		cityId: apartment.cityId,
		mapLocationId: apartmentCity.maps[0],
		currentRent,
		minRequired: HomeConstants.MIN_RENT_TO_CLAIM
	});
}

function pushIfNotNull(response: CrowniclesPacket[], packet: CrowniclesPacket | null): void {
	if (packet) {
		response.push(packet);
	}
}

/**
 * Persist a new apartment for the locked player. Handles the unique-index
 * race against a concurrent buy in the same city: in that case the player is
 * refunded and `alreadyOwned: true` is returned so the caller can reply
 * with the appropriate packet without dealing with the rollback details.
 */
async function persistApartmentBuyUnderLock(params: {
	lockedPlayer: Player;
	city: City;
	price: number;
	response: CrowniclesPacket[];
}): Promise<{ alreadyOwned: boolean }> {
	const {
		lockedPlayer, city, price, response
	} = params;

	await lockedPlayer.spendMoney({
		response,
		amount: price,
		reason: NumberChangeReason.APARTMENT_BUY
	});
	try {
		await Apartment.create({
			ownerId: lockedPlayer.id,
			cityId: city.id,
			purchasePrice: price,
			lastRentClaimedAt: new Date()
		});
	}
	catch (err) {
		if (err instanceof UniqueConstraintError) {
			/*
			 * Concurrent buy in the same city won the race; refund the exact spend.
			 * `ignoreBlessing` is required so the refund reverses the original debit
			 * to the cent — otherwise the money blessing multiplier would credit
			 * more than was spent.
			 */
			await lockedPlayer.addMoney({
				response,
				amount: price,
				reason: NumberChangeReason.APARTMENT_BUY,
				ignoreBlessing: true
			});
			await lockedPlayer.save();
			return { alreadyOwned: true };
		}
		throw err;
	}
	await lockedPlayer.save();
	return { alreadyOwned: false };
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

	const playerHome = await Homes.getOfPlayer(player.id);
	if (!playerHome) {
		response.push(makePacket(CommandReportApartmentRequiresHomeRes, {
			cityId: city.id,
			mapLocationId: city.maps[0]
		}));
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

		const result = await persistApartmentBuyUnderLock({
			lockedPlayer, city, price, response
		});
		if (result.alreadyOwned) {
			response.push(makePacket(CommandReportApartmentAlreadyOwnedRes, {
				cityId: city.id,
				mapLocationId: city.maps[0]
			}));
			return;
		}

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
			if (!lockedApartment.isRentedFor(home)) {
				// Not rented out → no rent accrual. Surface as too-low.
				pushIfNotNull(response, buildClaimTooLowPacket(lockedApartment, 0));
				return;
			}

			const accumulated = lockedApartment.getAccumulatedRent();
			if (accumulated < HomeConstants.MIN_RENT_TO_CLAIM) {
				pushIfNotNull(response, buildClaimTooLowPacket(lockedApartment, accumulated));
				return;
			}

			/*
			 * `ignoreBlessing` is required: the packet reports `rentClaimed: accumulated`,
			 * so the credited and reported amounts must match exactly. Without this, a
			 * player with an active money blessing would receive more than the packet
			 * surfaces.
			 */
			await lockedPlayer.addMoney({
				response,
				amount: accumulated,
				reason: NumberChangeReason.APARTMENT_RENT_CLAIM,
				ignoreBlessing: true
			});
			lockedApartment.lastRentClaimedAt = new Date();
			await Promise.all([lockedApartment.save(), lockedPlayer.save()]);

			const apartmentCity = CityDataController.instance.getById(lockedApartment.cityId);
			if (!apartmentCity || apartmentCity.maps.length === 0) {
				CrowniclesLogger.error(`Apartment ${lockedApartment.id} has invalid cityId ${lockedApartment.cityId} after claim; rent credited but no response packet sent.`);
				return;
			}
			response.push(makePacket(CommandReportApartmentClaimRentRes, {
				cityId: lockedApartment.cityId,
				mapLocationId: apartmentCity.maps[0],
				rentClaimed: accumulated
			}));
		}
	);
}
