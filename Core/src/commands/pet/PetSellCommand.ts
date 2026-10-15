import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	PetEntities, PetEntity
} from "../../core/database/game/models/PetEntity";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import Player, { Players } from "../../core/database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import {
	CommandPetSellAlreadyHavePetError,
	CommandPetSellBadPriceErrorPacket,
	CommandPetSellCantSellToYourselfErrorPacket,
	CommandPetSellFeistyErrorPacket,
	CommandPetSellInitiatorSituationChangedErrorPacket,
	CommandPetSellNoOneAvailableErrorPacket,
	CommandPetSellNoPetErrorPacket,
	CommandPetSellNotEnoughMoneyError,
	CommandPetSellNotInGuildErrorPacket,
	CommandPetSellPacketReq,
	CommandPetSellPetOnExpeditionErrorPacket,
	CommandPetSellSameGuildError,
	CommandPetSellSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandPetSellPacket";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	Pet, PetDataController
} from "../../data/Pet";
import { PetSellConstants } from "../../../../Lib/src/constants/PetSellConstants";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import {
	CollectCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { MissionsController } from "../../core/missions/MissionsController";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { PetUtils } from "../../core/utils/PetUtils";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { PacketUtils } from "../../core/utils/PacketUtils";
import { OwnedPet } from "../../../../Lib/src/types/OwnedPet";
import { createPetSaleCollector } from "../../core/utils/PetSaleCollector";

type SellerInformation = {
	player: Player; pet: PetEntity; petModel: Pet; guild: Guild; petCost: number;
};
type SaleParticipants = {
	seller: Player; buyerKeycloakId: string;
};
type SaleTerms = {
	petId: number; guildId: number; price: number;
};

/**
 * Check if the requirements for selling the pet are fulfilled
 * @param response
 * @param sellerInformation
 */
function missingRequirementsToSellPet(response: CrowniclesPacket[], sellerInformation: SellerInformation): boolean {
	if (sellerInformation.pet.isFeisty()) {
		response.push(makePacket(CommandPetSellFeistyErrorPacket, {}));
		return true;
	}

	if (sellerInformation.petCost < PetSellConstants.SELL_PRICE.MIN || sellerInformation.petCost > PetSellConstants.SELL_PRICE.MAX) {
		response.push(makePacket(CommandPetSellBadPriceErrorPacket, {
			minPrice: PetSellConstants.SELL_PRICE.MIN,
			maxPrice: PetSellConstants.SELL_PRICE.MAX
		}));
		return true;
	}

	return false;
}

async function verifyBuyerRequirements(response: CrowniclesPacket[], sellerInformation: SellerInformation, buyer: Player): Promise<boolean> {
	// Check if the player has started the game
	if (!await CommandUtils.verifyStartedAndNotDead(buyer, response)) {
		return false;
	}

	// Check if the buyer and seller are not in the same guild
	if (buyer.guildId === sellerInformation.guild.id) {
		response.push(makePacket(CommandPetSellSameGuildError, {}));
		return false;
	}

	// Check if the buyer is on the continent
	if (!CommandUtils.verifyWhereAllowed(buyer.mapLinkId, response, [WhereAllowed.CONTINENT])) {
		return false;
	}

	// Check if the buyer does not have a pet
	if (buyer.petId !== null) {
		response.push(makePacket(CommandPetSellAlreadyHavePetError, {}));
		return false;
	}

	// Check if the buyer has enough money
	if (buyer.money < sellerInformation.petCost) {
		response.push(makePacket(CommandPetSellNotEnoughMoneyError, {
			missingMoney: sellerInformation.petCost - buyer.money
		}));
		return false;
	}

	return true;
}

/**
 * Outcome of the in-lock revalidation. The TX is aborted (returned
 * `false`) when ANY actor's state changed between the click and the
 * lock acquisition, so we never mutate stale rows. The caller emits
 * the appropriate "situation changed" error packet.
 */
type LockedSellState = {
	revalidated: true;
	treasuryEarned: number;
	pet: OwnedPet;
} | {
	revalidated: false;
};

/**
 * Re-check every invariant against the freshly-locked rows and, if
 * everything still holds, atomically:
 * - decrement buyer money (with logs)
 * - swap pet ownership (seller.petId -> null, buyer.petId -> pet.id)
 * - reset pet love points to base
 * - credit the seller's guild treasury (minus penalty)
 * - save all four rows in a single Promise.all under the same TX.
 *
 * Returns `treasuryEarned` so the caller can build the success packet
 * outside the critical section.
 */
async function applyLockedPetSell(
	response: CrowniclesPacket[],
	locked: {
		seller: Player; buyer: Player; pet: PetEntity; guild: Guild;
	},
	expected: {
		petId: number; guildId: number; petCost: number;
	}
): Promise<LockedSellState> {
	const {
		seller, buyer, pet, guild
	} = locked;
	const stillValid = seller.petId === expected.petId
		&& seller.guildId === expected.guildId
		&& buyer.petId === null
		&& buyer.guildId !== expected.guildId
		&& buyer.money >= expected.petCost;
	if (!stillValid) {
		return { revalidated: false };
	}

	const treasuryEarned = GuildDomainConstants.computeTreasuryGain(expected.petCost);
	guild.treasury += treasuryEarned;

	await buyer.spendMoney({
		amount: expected.petCost,
		response,
		reason: NumberChangeReason.PET_SELL
	});

	buyer.petId = pet.id;
	seller.petId = null;
	pet.lovePoints = PetConstants.BASE_LOVE;

	await Promise.all([
		guild.save(),
		buyer.save(),
		seller.save(),
		pet.save()
	]);

	return {
		revalidated: true, treasuryEarned, pet: pet.asOwnedPet()
	};
}

async function executePetSell(collector: ReactionCollectorInstance, response: CrowniclesPacket[], sellerInformation: SellerInformation, buyer: Player): Promise<void> {
	/*
	 * 5-row trade critical section: lock seller + buyer + buyer missions info + pet + guild
	 * together so two concurrent buyers (or a concurrent withdraw of
	 * the seller's pet) cannot duplicate the pet, double-debit the
	 * buyer, or under-credit the guild treasury.
	 */
	await PlayerMissionsInfos.getOfPlayer(buyer.id);
	const result = await withLockedEntities(
		[
			Player.lockKey(sellerInformation.player.id),
			Player.lockKey(buyer.id),
			PetEntity.lockKey(sellerInformation.pet.id),
			Guild.lockKey(sellerInformation.guild.id),
			PlayerMissionsInfo.lockKey(buyer.id)
		] as const,
		async ([
			lockedSeller,
			lockedBuyer,
			lockedPet,
			lockedGuild
		]) => await applyLockedPetSell(
			response,
			{
				seller: lockedSeller, buyer: lockedBuyer, pet: lockedPet, guild: lockedGuild
			},
			{
				petId: sellerInformation.pet.id,
				guildId: sellerInformation.guild.id,
				petCost: sellerInformation.petCost
			}
		)
	);

	if (!result.revalidated) {
		response.push(makePacket(CommandPetSellInitiatorSituationChangedErrorPacket, {}));
		await collector.end(response);
		return;
	}

	// Log the pet sell (fire-and-forget)
	LogsDatabase.logPetSell(sellerInformation.pet, sellerInformation.player.keycloakId, buyer.keycloakId, sellerInformation.petCost).then();

	// Update missions on the now-committed instances
	await MissionsController.update(buyer, response, { missionId: "havePet" });
	await MissionsController.update(sellerInformation.player, response, { missionId: "sellOrTradePet" });

	// Success packet
	response.push(makePacket(CommandPetSellSuccessPacket, {
		guildName: sellerInformation.guild.name,
		treasuryEarned: result.treasuryEarned,
		pet: result.pet
	}));

	await collector.end(response);
}

async function acceptPetSellCallback(collector: ReactionCollectorInstance, participants: SaleParticipants, response: CrowniclesPacket[], terms: SaleTerms): Promise<void> {
	const {
		seller: initiatorPlayer, buyerKeycloakId: reactingPlayerKeycloakId
	} = participants;

	// Can't buy your own pet
	if (initiatorPlayer.keycloakId === reactingPlayerKeycloakId) {
		response.push(makePacket(CommandPetSellCantSellToYourselfErrorPacket, {}));
		return;
	}

	// Should not be blocked
	if (BlockingUtils.appendBlockedPacket(reactingPlayerKeycloakId, response)) {
		return;
	}

	await initiatorPlayer.reload();

	// Verify that the initiator player still has the pet
	if (initiatorPlayer.petId !== terms.petId) {
		response.push(makePacket(CommandPetSellInitiatorSituationChangedErrorPacket, {}));
		await collector.end(response);
		return;
	}

	// Verify that the initiator player is still in a guild
	if (initiatorPlayer.guildId !== terms.guildId) {
		response.push(makePacket(CommandPetSellInitiatorSituationChangedErrorPacket, {}));
		await collector.end(response);
		return;
	}

	const pet = await PetEntities.getById(initiatorPlayer.petId);
	const petModel = pet ? PetDataController.instance.getById(pet.typeId) : null;
	const guild = await Guilds.getById(initiatorPlayer.guildId);
	if (!pet || !petModel || !guild) {
		response.push(makePacket(CommandPetSellInitiatorSituationChangedErrorPacket, {}));
		await collector.end(response);
		return;
	}
	const sellerInformation: SellerInformation = {
		player: initiatorPlayer,
		pet,
		petModel,
		guild,
		petCost: terms.price
	};

	const reactingPlayer = await Players.getOrRegister(reactingPlayerKeycloakId);
	if (await verifyBuyerRequirements(response, sellerInformation, reactingPlayer)) {
		await executePetSell(collector, response, sellerInformation, reactingPlayer);
	}
}

export function createAndPushPetSale(seller: SellerInformation, packet: CommandPetSellPacketReq, context: PacketContext, response: CrowniclesPacket[]): void {
	const {
		player, pet, guild
	} = seller;
	const terms: SaleTerms = {
		petId: pet.id, guildId: guild.id, price: packet.price
	};
	const onAccept: CollectCallback = (collector, _reaction, keycloakId, answers): Promise<void> => acceptPetSellCallback(collector, {
		seller: player, buyerKeycloakId: keycloakId
	}, answers, terms);
	const collectorPacket = createPetSaleCollector({
		sellerKeycloakId: player.keycloakId,
		price: packet.price,
		pet: pet.asOwnedPet(),
		...packet.askedPlayer.keycloakId ? { buyerKeycloakId: packet.askedPlayer.keycloakId } : {}
	}, context, onAccept).build();

	if (context.webSocket && packet.askedPlayer.keycloakId) {
		PacketUtils.sendPackets(PacketUtils.webSocketContextForPlayer(context, packet.askedPlayer.keycloakId), [collectorPacket]);
	}
	response.push(collectorPacket);
}

export default class PetSellCommand {
	@commandRequires(CommandPetSellPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandPetSellPacketReq, context: PacketContext): Promise<void> {
		if (packet.askedPlayer.rank !== undefined) {
			const buyer = await Players.getByRank(packet.askedPlayer.rank);
			if (!buyer) {
				response.push(makePacket(CommandPetSellNoOneAvailableErrorPacket, {}));
				return;
			}
			packet.askedPlayer = { keycloakId: buyer.keycloakId };
		}
		const pet = await PetEntities.getById(player.petId);

		if (!pet) {
			response.push(makePacket(CommandPetSellNoPetErrorPacket, {}));
			return;
		}

		// Check if pet is on expedition
		if (await PetUtils.isPetOnExpedition(player.id)) {
			response.push(makePacket(CommandPetSellPetOnExpeditionErrorPacket, {}));
			return;
		}

		if (player.keycloakId === packet.askedPlayer.keycloakId) {
			response.push(makePacket(CommandPetSellCantSellToYourselfErrorPacket, {}));
			return;
		}

		let guild;
		try {
			guild = await Guilds.getById(player.guildId);
		}
		catch {
			guild = null;
		}

		if (guild === null) {
			// Not in a guild
			response.push(makePacket(CommandPetSellNotInGuildErrorPacket, {}));
			return;
		}

		const petModel = PetDataController.instance.getById(pet.typeId);
		if (!petModel) {
			return;
		}
		const sellerInformation: SellerInformation = {
			player, pet, petModel, guild, petCost: packet.price
		};

		if (missingRequirementsToSellPet(response, sellerInformation)) {
			return;
		}

		createAndPushPetSale(sellerInformation, packet, context, response);
	}
}
