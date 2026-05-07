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
import {
	CommandPetSellAlreadyHavePetError,
	CommandPetSellBadPriceErrorPacket,
	CommandPetSellCancelPacket,
	CommandPetSellCantSellToYourselfErrorPacket,
	CommandPetSellFeistyErrorPacket,
	CommandPetSellInitiatorSituationChangedErrorPacket,
	CommandPetSellNoOneAvailableErrorPacket,
	CommandPetSellNoPetErrorPacket,
	CommandPetSellNotEnoughMoneyError,
	CommandPetSellNotInGuildErrorPacket,
	CommandPetSellOnlyOwnerCanCancelErrorPacket,
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
	CollectCallback, EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import {
	ReactionCollectorAcceptReaction,
	ReactionCollectorReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorPetSell } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetSell";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { MissionsController } from "../../core/missions/MissionsController";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { PetUtils } from "../../core/utils/PetUtils";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";

type SellerInformation = {
	player: Player; pet: PetEntity; petModel: Pet; guild: Guild; petCost: number;
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
} | {
	revalidated: false;
};

/**
 * Re-check every invariant against the freshly-locked rows and, if
 * everything still holds, atomically:
 * - decrement buyer money (with logs)
 * - swap pet ownership (seller.petId → null, buyer.petId → pet.id)
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

	const penalty = Math.min(
		Math.round(expected.petCost * GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.PERCENT),
		GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.MAX
	);
	const treasuryEarned = expected.petCost - penalty;
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
		revalidated: true, treasuryEarned
	};
}

async function executePetSell(collector: ReactionCollectorInstance, response: CrowniclesPacket[], sellerInformation: SellerInformation, buyer: Player): Promise<void> {
	/*
	 * 4-row trade critical section: lock seller + buyer + pet + guild
	 * together so two concurrent buyers (or a concurrent withdraw of
	 * the seller's pet) cannot duplicate the pet, double-debit the
	 * buyer, or under-credit the guild treasury.
	 */
	const result = await withLockedEntities(
		[
			Player.lockKey(sellerInformation.player.id),
			Player.lockKey(buyer.id),
			PetEntity.lockKey(sellerInformation.pet.id),
			Guild.lockKey(sellerInformation.guild.id)
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
	await MissionsController.update(sellerInformation.player, response, { missionId: "depositPetInShelter" });

	// Success packet
	response.push(makePacket(CommandPetSellSuccessPacket, {
		guildName: sellerInformation.guild.name,
		treasuryEarned: result.treasuryEarned,
		pet: sellerInformation.pet.asOwnedPet()
	}));

	await collector.end(response);
}

async function acceptPetSellCallback(collector: ReactionCollectorInstance, initiatorPlayer: Player, reactingPlayerKeycloakId: string, response: CrowniclesPacket[], price: number): Promise<void> {
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
	if (initiatorPlayer.petId === null) {
		response.push(makePacket(CommandPetSellInitiatorSituationChangedErrorPacket, {}));
		await collector.end();
		return;
	}

	// Verify that the initiator player is still in a guild
	if (initiatorPlayer.guildId === null) {
		response.push(makePacket(CommandPetSellInitiatorSituationChangedErrorPacket, {}));
		await collector.end(response);
		return;
	}

	const pet = await PetEntities.getById(initiatorPlayer.petId);
	const petModel = PetDataController.instance.getById(pet!.typeId);
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
		petCost: price
	};

	const reactingPlayer = await Players.getOrRegister(reactingPlayerKeycloakId);
	if (await verifyBuyerRequirements(response, sellerInformation, reactingPlayer)) {
		await executePetSell(collector, response, sellerInformation, reactingPlayer);
	}
}

function refusePetSellCallback(initiatorPlayerKeycloakId: string, reactingPlayerKeycloakId: string, response: CrowniclesPacket[]): boolean {
	if (initiatorPlayerKeycloakId !== reactingPlayerKeycloakId) {
		// Only the owner can refuse the pet sell
		response.push(makePacket(CommandPetSellOnlyOwnerCanCancelErrorPacket, {}));
		return false;
	}

	response.push(makePacket(CommandPetSellCancelPacket, {}));
	return true;
}

function createAndPushCollector(player: Player, packet: CommandPetSellPacketReq, pet: PetEntity, context: PacketContext, response: CrowniclesPacket[]): void {
	// Send collector
	const collector = new ReactionCollectorPetSell(
		player.keycloakId,
		packet.price,
		pet.asOwnedPet(),
		packet.askedPlayer.keycloakId
	);

	const endCallback: EndCallback = (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): void => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_SELL);
		if (collector.hasEndedByTime) {
			response.push(makePacket(CommandPetSellNoOneAvailableErrorPacket, {}));
		}
	};

	const collectCallback: CollectCallback = async (collector: ReactionCollectorInstance, reaction: ReactionCollectorReaction, keycloakId: string, response: CrowniclesPacket[]): Promise<void> => {
		if (reaction instanceof ReactionCollectorAcceptReaction) {
			await acceptPetSellCallback(collector, player, keycloakId, response, packet.price);
		}
		else if (refusePetSellCallback(player.keycloakId, keycloakId, response)) {
			await collector.end(response);
		}
	};

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: packet.askedPlayer.keycloakId ? [player.keycloakId, packet.askedPlayer.keycloakId] : undefined,
			reactionLimit: -1
		},
		endCallback,
		collectCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.PET_SELL)
		.build();

	response.push(collectorPacket);
}

export default class PetSellCommand {
	@commandRequires(CommandPetSellPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandPetSellPacketReq, context: PacketContext): Promise<void> {
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

		createAndPushCollector(player, packet, pet, context, response);
	}
}
