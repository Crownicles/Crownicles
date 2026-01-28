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
import { PetUtils } from "../../core/utils/PetUtils";
import { OwnedPet } from "../../../../Lib/src/types/OwnedPet";

/**
 * Validation result for player's pet before transfer
 */
interface PlayerPetValidation {
	isValid: boolean;
	playerPet?: PetEntity;
}

/**
 * Validate that the player has a non-feisty pet for transfer operations
 */
async function validatePlayerPetForTransfer(
	response: CrowniclesPacket[],
	player: Player,
	operationName: string
): Promise<PlayerPetValidation> {
	if (!player.petId) {
		CrowniclesLogger.warn(`Player tried to ${operationName} but has no pet`);
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return { isValid: false };
	}

	const playerPet = await PetEntities.getById(player.petId);

	if (!playerPet) {
		CrowniclesLogger.warn(`Player tried to ${operationName} but pet not found in database`);
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return { isValid: false };
	}

	if (playerPet.isFeisty()) {
		CrowniclesLogger.warn(`Player tried to ${operationName} with a feisty pet`);
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return { isValid: false };
	}

	return {
		isValid: true, playerPet
	};
}

/**
 * Find a guild pet by entity ID, returning null if not found
 */
async function findGuildPetOrFail(
	response: CrowniclesPacket[],
	player: Player,
	petEntityId: number,
	operationName: string
): Promise<GuildPet | null> {
	const guildPets = await GuildPets.getOfGuild(player.guildId);
	const guildPet = guildPets.find(gp => gp.petEntityId === petEntityId);

	if (!guildPet) {
		CrowniclesLogger.warn(`Player tried to ${operationName} but the pet is not in the guild`);
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return null;
	}

	return guildPet;
}


/**
 * Transfer your pet to the guild's shelter
 */
async function deposePetToGuild(
	response: CrowniclesPacket[],
	player: Player
): Promise<void> {
	const validation = await validatePlayerPetForTransfer(response, player, "transfer a pet to the guild");
	if (!validation.isValid || !validation.playerPet) {
		return;
	}

	const guildPets = await GuildPets.getOfGuild(player.guildId);
	if (guildPets.length >= PetConstants.SLOTS) {
		CrowniclesLogger.warn("Player tried to transfer a pet to the guild but the shelter is full");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		CrowniclesLogger.warn("Player tried to transfer a pet to the guild but guild not found");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	(player.petId as number | null) = null;
	await player.save();
	await GuildPets.addPet(guild, validation.playerPet, false).save();
	crowniclesInstance.logsDatabase.logPetTransfer(validation.playerPet, null!).then();

	response.push(makePacket(CommandPetTransferSuccessPacket, {
		oldPet: validation.playerPet.asOwnedPet()
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

	const toWithdrawPet = await findGuildPetOrFail(response, player, petEntityId, "withdraw a pet from the guild");
	if (!toWithdrawPet) {
		return;
	}

	player.petId = toWithdrawPet.petEntityId;
	await player.save();
	await MissionsController.update(player, response, { missionId: "havePet" });
	await toWithdrawPet.destroy();
	PetEntities.getById(toWithdrawPet.petEntityId).then(petEntity => {
		if (petEntity) {
			crowniclesInstance.logsDatabase.logPetTransfer(null!, petEntity).then();
		}
	});

	const newPet = await PetEntities.getById(toWithdrawPet.petEntityId);
	if (newPet) {
		response.push(makePacket(CommandPetTransferSuccessPacket, {
			newPet: newPet.asOwnedPet()
		}));
	}
}

async function switchPetWithGuild(
	response: CrowniclesPacket[],
	player: Player,
	petEntityId: number
): Promise<void> {
	const validation = await validatePlayerPetForTransfer(response, player, "switch a pet with the guild");
	if (!validation.isValid || !validation.playerPet) {
		return;
	}

	const toSwitchPet = await findGuildPetOrFail(response, player, petEntityId, "switch a pet with the guild");
	if (!toSwitchPet) {
		return;
	}

	player.petId = toSwitchPet.petEntityId;
	toSwitchPet.petEntityId = validation.playerPet.id;
	await player.save();
	await toSwitchPet.save();

	const newPlayerPet = await PetEntities.getById(player.petId);

	if (!newPlayerPet) {
		CrowniclesLogger.warn("Player tried to switch a pet with the guild but the new pet was not found");
		response.push(makePacket(CommandPetTransferSituationChangedErrorPacket, {}));
		return;
	}

	crowniclesInstance.logsDatabase.logPetTransfer(validation.playerPet, newPlayerPet).then();

	response.push(makePacket(CommandPetTransferSuccessPacket, {
		oldPet: validation.playerPet.asOwnedPet(),
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
		else if (withdrawPetEntityId !== null) {
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
		const petEntity = await PetEntities.getById(guildPet.petEntityId);
		if (petEntity) {
			guildPetsEntities.push({
				petEntityId: guildPet.petEntityId,
				pet: petEntity.asOwnedPet()
			});
		}
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
		if (playerPet && await PetUtils.isPetOnExpedition(player.id)) {
			response.push(makePacket(CommandPetTransferPetOnExpeditionErrorPacket, {}));
			return;
		}

		const guild = await Guilds.getById(player.guildId);
		if (!guild) {
			response.push(makePacket(CommandPetTransferNoPetErrorPacket, {}));
			return;
		}
		const guildPets = await GuildPets.getOfGuild(player.guildId);

		// Build reactions - returns null if no valid transfer options
		const reactions = buildTransferReactions(playerPet, guild, guildPets);
		if (!reactions) {
			response.push(makePacket(CommandPetTransferNoPetErrorPacket, {}));
			return;
		}

		const guildPetsEntities = await buildGuildPetsEntities(guildPets);

		const collector = new ReactionCollectorPetTransfer(
			playerPet?.asOwnedPet() as OwnedPet,
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
