import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	CommandPetTransferAnotherMemberTransferringErrorPacket,
	CommandPetTransferCancelErrorPacket,
	CommandPetTransferFeistyErrorPacket,
	CommandPetTransferNoPetErrorPacket,
	CommandPetTransferPacketReq,
	CommandPetTransferPetOnExpeditionErrorPacket,
	CommandPetTransferSituationChangedErrorPacket,
	CommandPetTransferSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandPetTransferPacket";
import {
	PetEntities, PetEntity
} from "../../core/database/game/models/PetEntity";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorPetTransfer,
	ReactionCollectorPetTransferDepositReaction,
	ReactionCollectorPetTransferSwitchReaction,
	ReactionCollectorPetTransferWithdrawReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetTransfer";
import { Guilds } from "../../core/database/game/models/Guild";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	GuildPet, GuildPets
} from "../../core/database/game/models/GuildPet";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { crowniclesInstance } from "../../index";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { MissionsController } from "../../core/missions/MissionsController";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";
import { OwnedPet } from "../../../../Lib/src/types/OwnedPet";


/**
 * Transfer your pet to the guild's shelter
 */
async function deposePetToGuild(
	response: CrowniclesPacket[],
	player: Player
): Promise<void> {
	if (!player.petId) {
		CrowniclesLogger.warn("Player tried to transfer a pet to the guild but has no pet");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	const playerPet = await PetEntities.getById(player.petId);

	if (playerPet.isFeisty()) {
		CrowniclesLogger.warn("Player tried to transfer a feisty pet to the guild");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	const guildPets = await GuildPets.getOfGuild(player.guildId);
	if (guildPets.length >= PetConstants.SLOTS) {
		CrowniclesLogger.warn("Player tried to transfer a pet to the guild but the shelter is full");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	const guild = await Guilds.getById(player.guildId);

	player.petId = null;
	await player.save();
	await GuildPets.addPet(guild, playerPet, false).save();
	crowniclesInstance.logsDatabase.logPetTransfer(playerPet, null).then();

	response.push(makePacket(CommandPetTransferSuccessPacket, {
		oldPet: playerPet.asOwnedPet()
	}));
}

async function withdrawPetFromGuild(
	response: CrowniclesPacket[],
	player: Player,
	petEntityId: number
): Promise<void> {
	if (player.petId) {
		CrowniclesLogger.warn("Player tried to withdraw a pet from the guild but already has a pet");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	const guildPets = await GuildPets.getOfGuild(player.guildId);
	const toWithdrawPet = guildPets.find(guildPet => guildPet.petEntityId === petEntityId);

	if (!toWithdrawPet) {
		CrowniclesLogger.warn("Player tried to withdraw a pet from the guild but the pet is not in the guild");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	player.petId = toWithdrawPet.petEntityId;
	await player.save();
	await MissionsController.update(player, response, { missionId: "havePet" });
	await toWithdrawPet.destroy();
	PetEntities.getById(toWithdrawPet.petEntityId).then(petEntity => {
		crowniclesInstance.logsDatabase.logPetTransfer(null, petEntity).then();
	});

	response.push(makePacket(CommandPetTransferSuccessPacket, {
		newPet: (await PetEntities.getById(toWithdrawPet.petEntityId)).asOwnedPet()
	}));
}

async function switchPetWithGuild(
	response: CrowniclesPacket[],
	player: Player,
	petEntityId: number
): Promise<void> {
	if (!player.petId) {
		CrowniclesLogger.warn("Player tried to switch a pet with the guild but has no pet");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	const playerPet = await PetEntities.getById(player.petId);

	if (playerPet.isFeisty()) {
		CrowniclesLogger.warn("Player tried to switch a feisty pet with the guild");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	const guildPets = await GuildPets.getOfGuild(player.guildId);
	const toSwitchPet = guildPets.find(guildPet => guildPet.petEntityId === petEntityId);

	if (!toSwitchPet) {
		CrowniclesLogger.warn("Player tried to switch a pet with the guild but the pet is not in the guild");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	player.petId = toSwitchPet.petEntityId;
	toSwitchPet.petEntityId = playerPet.id;
	await player.save();
	await toSwitchPet.save();

	const newPlayerPet = await PetEntities.getById(player.petId);

	crowniclesInstance.logsDatabase.logPetTransfer(playerPet, newPlayerPet).then();

	response.push(makePacket(CommandPetTransferSuccessPacket, {
		oldPet: playerPet.asOwnedPet(),
		newPet: newPlayerPet.asOwnedPet()
	}));
}

function getEndCallback(player: Player) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_TRANSFER);

		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandPetTransferCancelErrorPacket, {}));
			return;
		}

		const depositOwnPet = firstReaction.reaction.type === ReactionCollectorPetTransferDepositReaction.name || firstReaction.reaction.type === ReactionCollectorPetTransferSwitchReaction.name;
		const withdrawPetEntityId = firstReaction.reaction.type === ReactionCollectorPetTransferWithdrawReaction.name
			? (firstReaction.reaction.data as ReactionCollectorPetTransferWithdrawReaction).petEntityId
			: firstReaction.reaction.type === ReactionCollectorPetTransferSwitchReaction.name
				? (firstReaction.reaction.data as ReactionCollectorPetTransferSwitchReaction).petEntityId
				: null;

		await player.reload();

		if (depositOwnPet) {
			if (withdrawPetEntityId) {
				await switchPetWithGuild(response, player, withdrawPetEntityId);
			}
			else {
				await deposePetToGuild(response, player);
			}
		}
		else {
			await withdrawPetFromGuild(response, player, withdrawPetEntityId);
		}
	};
}

/**
 * Check if another guild member is currently transferring a pet
 */
async function checkGuildMemberTransferring(
	guildId: number
): Promise<string | null> {
	const guildMembers = await Players.getByGuild(guildId);
	for (const member of guildMembers) {
		if (BlockingUtils.isPlayerBlockedWithReason(member.keycloakId, BlockingConstants.REASONS.PET_TRANSFER)) {
			return member.keycloakId;
		}
	}
	return null;
}

/**
 * Check if player's pet is on an expedition
 */
async function isPetOnExpedition(playerId: number): Promise<boolean> {
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(playerId);
	return activeExpedition !== null;
}

/**
 * Build reactions array for pet transfer collector
 */
function buildTransferReactions(
	playerPet: PetEntity | null,
	guild: { isPetShelterFull: (pets: GuildPet[]) => boolean },
	guildPets: GuildPet[]
): ReactionCollectorReaction[] | null {
	const reactions: ReactionCollectorReaction[] = [];

	if (playerPet) {
		if (!guild.isPetShelterFull(guildPets) && !playerPet.isFeisty()) {
			reactions.push(makePacket(ReactionCollectorPetTransferDepositReaction, {}));
		}
		for (const guildPet of guildPets) {
			reactions.push(makePacket(ReactionCollectorPetTransferSwitchReaction, {
				petEntityId: guildPet.petEntityId
			}));
		}
	}
	else if (guildPets.length > 0) {
		for (const guildPet of guildPets) {
			reactions.push(makePacket(ReactionCollectorPetTransferWithdrawReaction, {
				petEntityId: guildPet.petEntityId
			}));
		}
	}
	else {
		return null; // No valid transfer options
	}

	reactions.push(makePacket(ReactionCollectorRefuseReaction, {}));
	return reactions;
}

/**
 * Build guild pets entities array for collector
 */
async function buildGuildPetsEntities(
	guildPets: GuildPet[]
): Promise<{
	petEntityId: number;
	pet: OwnedPet;
}[]> {
	const guildPetsEntities = [];
	for (const guildPet of guildPets) {
		guildPetsEntities.push({
			petEntityId: guildPet.petEntityId,
			pet: (await PetEntities.getById(guildPet.petEntityId)).asOwnedPet()
		});
	}
	return guildPetsEntities;
}

export default class PetTransferCommand {
	@commandRequires(CommandPetTransferPacketReq, {
		notBlocked: true,
		guildNeeded: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandPetTransferPacketReq, context: PacketContext): Promise<void> {
		// Check if another guild member is transferring
		const transferringMemberId = await checkGuildMemberTransferring(player.guildId);
		if (transferringMemberId) {
			response.push(makePacket(CommandPetTransferAnotherMemberTransferringErrorPacket, {
				keycloakId: transferringMemberId
			}));
			return;
		}

		const playerPet = await PetEntities.getById(player.petId);

		if (playerPet?.isFeisty()) {
			response.push(makePacket(CommandPetTransferFeistyErrorPacket, {}));
			return;
		}

		// Check if player's pet is on expedition
		if (playerPet && await isPetOnExpedition(player.id)) {
			response.push(makePacket(CommandPetTransferPetOnExpeditionErrorPacket, {}));
			return;
		}

		const guild = await Guilds.getById(player.guildId);
		const guildPets = await GuildPets.getOfGuild(player.guildId);

		// Build reactions - returns null if no valid transfer options
		const reactions = buildTransferReactions(playerPet, guild, guildPets);
		if (!reactions) {
			response.push(makePacket(CommandPetTransferNoPetErrorPacket, {}));
			return;
		}

		const guildPetsEntities = await buildGuildPetsEntities(guildPets);

		const collector = new ReactionCollectorPetTransfer(
			playerPet?.asOwnedPet(),
			guildPetsEntities,
			reactions
		);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			getEndCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.PET_TRANSFER)
			.build();

		response.push(packet);
	}
}
