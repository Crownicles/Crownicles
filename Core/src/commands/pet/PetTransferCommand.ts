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
	CommandPetTransferFreeCooldownErrorPacket,
	CommandPetTransferFreeMissingMoneyErrorPacket,
	CommandPetTransferFreeSuccessPacket,
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
	ReactionCollectorPetTransferFreeReaction,
	ReactionCollectorPetTransferSwitchReaction,
	ReactionCollectorPetTransferWithdrawReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetTransfer";
import Guild, { Guilds } from "../../core/database/game/models/Guild";
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
import { PetFreeConstants } from "../../../../Lib/src/constants/PetFreeConstants";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { getFoodIndexOf } from "../../core/utils/FoodUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";

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

	player.petId = null;
	await player.save();
	await GuildPets.addPet(guild, validation.playerPet, false).save();
	crowniclesInstance.logsDatabase.logPetTransfer(validation.playerPet, null).then();

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

	crowniclesInstance.logsDatabase.logPetTransfer(validation.playerPet, newPlayerPet).then();

	response.push(makePacket(CommandPetTransferSuccessPacket, {
		oldPet: validation.playerPet.asOwnedPet(),
		newPet: newPlayerPet.asOwnedPet()
	}));
}

/**
 * Get the cooldown remaining time before the player can free a pet
 */
function getFreeCooldownRemainingTimeMs(player: Player): number {
	return PetFreeConstants.FREE_COOLDOWN - (new Date().valueOf() - player.lastPetFree.valueOf());
}

/**
 * Get the missing money to free a feisty pet
 */
function getMissingMoneyToFreePet(player: Player, petEntity: PetEntity): number {
	return petEntity.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST - player.money : 0;
}

/**
 * Return true if the guild wins a meat piece for freeing the pet
 */
function generateLuckyMeat(guild: Guild | null, petEntity: PetEntity): boolean {
	return guild !== null && guild.carnivorousFood + 1 <= GuildConstants.MAX_PET_FOOD[getFoodIndexOf(PetConstants.PET_FOOD.CARNIVOROUS_FOOD)]
		&& RandomUtils.crowniclesRandom.realZeroToOneInclusive() <= PetFreeConstants.GIVE_MEAT_PROBABILITY
		&& !petEntity.isFeisty();
}

/**
 * Free a pet from the guild shelter
 */
async function freePetFromGuild(
	response: CrowniclesPacket[],
	player: Player,
	petEntityId: number
): Promise<void> {
	const toFreePet = await findGuildPetOrFail(response, player, petEntityId, "free a pet from the guild");
	if (!toFreePet) {
		return;
	}

	const petEntity = await PetEntities.getById(toFreePet.petEntityId);

	// Check cooldown
	const cooldownRemainingTimeMs = getFreeCooldownRemainingTimeMs(player);
	if (cooldownRemainingTimeMs > 0) {
		response.push(makePacket(CommandPetTransferFreeCooldownErrorPacket, { cooldownRemainingTimeMs }));
		return;
	}

	// Check money for feisty pets
	const missingMoney = getMissingMoneyToFreePet(player, petEntity);
	if (missingMoney > 0) {
		response.push(makePacket(CommandPetTransferFreeMissingMoneyErrorPacket, { missingMoney }));
		return;
	}

	// Deduct money if feisty
	if (petEntity.isFeisty()) {
		await player.spendMoney({
			amount: PetFreeConstants.FREE_FEISTY_COST,
			response,
			reason: NumberChangeReason.PET_FREE
		});
	}

	LogsDatabase.logPetFree(petEntity).then();

	// Remove pet from guild shelter
	await toFreePet.destroy();
	await petEntity.destroy();

	// Update player's lastPetFree
	player.lastPetFree = new Date();
	await player.save();

	// Check for lucky meat
	let guild: Guild | null = null;
	let luckyMeat = false;
	try {
		guild = await Guilds.getById(player.guildId);
		luckyMeat = generateLuckyMeat(guild, petEntity);
		if (luckyMeat) {
			guild.carnivorousFood += PetFreeConstants.MEAT_GIVEN;
			await guild.save();
		}
	}
	catch {
		// Continue regardless of error
	}

	response.push(makePacket(CommandPetTransferFreeSuccessPacket, {
		petId: petEntity.typeId,
		petSex: petEntity.sex as SexTypeShort,
		petNickname: petEntity.nickname,
		freeCost: petEntity.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST : 0,
		luckyMeat
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

		// Handle free reaction
		if (firstReaction.reaction.type === ReactionCollectorPetTransferFreeReaction.name) {
			const freePetEntityId = (firstReaction.reaction.data as ReactionCollectorPetTransferFreeReaction).petEntityId;
			await player.reload();
			await freePetFromGuild(response, player, freePetEntityId);
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

	// Add free reactions for all shelter pets (regardless of whether player has a pet)
	for (const guildPet of guildPets) {
		reactions.push(makePacket(ReactionCollectorPetTransferFreeReaction, {
			petEntityId: guildPet.petEntityId
		}));
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
		if (playerPet && await PetUtils.isPetOnExpedition(player.id)) {
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
