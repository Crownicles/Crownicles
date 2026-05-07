import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	PetEntities, PetEntity
} from "../../core/database/game/models/PetEntity";
import {
	CommandPetFreeAcceptPacketRes,
	CommandPetFreePacketReq,
	CommandPetFreePacketRes,
	CommandPetFreeRefusePacketRes,
	CommandPetFreeShelterSuccessPacketRes,
	CommandPetFreeShelterCooldownErrorPacketRes,
	CommandPetFreeShelterMissingMoneyErrorPacketRes
} from "../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { PetFreeConstants } from "../../../../Lib/src/constants/PetFreeConstants";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import {
	ReactionCollectorAcceptReaction,
	ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorPetFree,
	ReactionCollectorPetFreeSelectReaction,
	ReactionCollectorPetFreeSelection,
	ReactionCollectorPetFreeShelterConfirm,
	ReactionCollectorPetFreeShelterConfirmData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Guild from "../../core/database/game/models/Guild";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import { getFoodIndexOf } from "../../core/utils/FoodUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PetUtils } from "../../core/utils/PetUtils";
import {
	GuildPet, GuildPets
} from "../../core/database/game/models/GuildPet";
import { OwnedPet } from "../../../../Lib/src/types/OwnedPet";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { MissionsController } from "../../core/missions/MissionsController";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";


/**
 * Send the number of milliseconds that remain before the player is allowed to free his pet
 * (a player cannot free pets too often)
 * @param player
 */
function getCooldownRemainingTimeMs(player: Player): number {
	return PetFreeConstants.FREE_COOLDOWN - (new Date().valueOf() - player.lastPetFree.valueOf());
}

/**
 * Returns the amount of money the player is missing to free his pet (0 if the player has enough money)
 * @param player
 * @param playerPet
 */
function getMissingMoneyToFreePet(player: Player, playerPet: PetEntity): number {
	return playerPet.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST - player.money : 0;
}

/**
 * Return true if the player is "lucky" and wins a meat piece for freeing his pet
 * @param guild
 * @param pPet
 */
function generateLuckyMeat(guild: Guild | null, pPet: PetEntity): boolean {
	return guild !== null && guild.carnivorousFood + 1 <= GuildDomainConstants.getFoodCaps(guild.pantryLevel)[getFoodIndexOf(PetConstants.PET_FOOD.CARNIVOROUS_FOOD)]
		&& RandomUtils.crowniclesRandom.realZeroToOneInclusive() <= PetFreeConstants.GIVE_MEAT_PROBABILITY
		&& !pPet.isFeisty();
}

/**
 * Snapshot of pet metadata captured before destruction, used to
 * build the success packet outside the lock.
 */
type FreedPetSnapshot = {
	luckyMeat: boolean;
	freeCost: number;
	petTypeId: number;
	petSex: SexTypeShort;
	petNickname: string | null;
};

/**
 * Common post-revalidation body shared by every free flow. Charges
 * the feisty fee, opportunistically credits the guild pantry, snaps
 * the pet metadata, destroys the targeted rows, refreshes the
 * player's cooldown, and commits everything in a single TX. Owning
 * the shared logic in one place avoids the CodeScene "Code
 * Duplication" smell that arose when each flow inlined the same
 * sequence.
 */
async function commitFreedPet(
	response: CrowniclesPacket[],
	player: Player,
	pet: PetEntity,
	options: {
		clearPlayerPetId: boolean;
		guildPet?: GuildPet;
		guild?: Guild;
	}
): Promise<FreedPetSnapshot> {
	if (pet.isFeisty()) {
		await player.spendMoney({
			amount: PetFreeConstants.FREE_FEISTY_COST,
			response,
			reason: NumberChangeReason.PET_FREE
		});
	}

	const luckyMeat = options.guild ? generateLuckyMeat(options.guild, pet) : false;
	if (luckyMeat && options.guild) {
		options.guild.carnivorousFood += PetFreeConstants.MEAT_GIVEN;
	}

	const snapshot: FreedPetSnapshot = {
		luckyMeat,
		freeCost: pet.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST : 0,
		petTypeId: pet.typeId,
		petSex: pet.sex as SexTypeShort,
		petNickname: pet.nickname
	};

	if (options.guildPet) {
		await options.guildPet.destroy();
	}
	await pet.destroy();
	if (options.clearPlayerPetId) {
		player.petId = null;
	}
	player.lastPetFree = new Date();

	const saves: Promise<unknown>[] = [player.save()];
	if (luckyMeat && options.guild) {
		saves.push(options.guild.save());
	}
	await Promise.all(saves);
	LogsDatabase.logPetFree(pet).then();

	return snapshot;
}

/**
 * Result of the in-lock revalidation for a free-own-pet flow.
 */
type AcceptPetFreeOutcome = ({ revalidated: true } & FreedPetSnapshot) | { revalidated: false };

/**
 * Inside-lock body for the "free your own pet" flow. Re-checks
 * ownership and money against the locked rows, then delegates the
 * shared destroy / save logic to {@link commitFreedPet}. The
 * optional `guild` lock makes the meat reward serialise correctly
 * with concurrent guild-pantry mutations.
 */
async function applyLockedAcceptPetFree(
	response: CrowniclesPacket[],
	locked: {
		player: Player; pet: PetEntity; guild?: Guild;
	},
	expectedPetId: number
): Promise<AcceptPetFreeOutcome> {
	const {
		player, pet, guild
	} = locked;
	if (player.petId !== expectedPetId || getMissingMoneyToFreePet(player, pet) > 0) {
		return { revalidated: false };
	}

	const snapshot = await commitFreedPet(response, player, pet, {
		clearPlayerPetId: true,
		guild
	});
	return {
		revalidated: true, ...snapshot
	};
}

/**
 * Accept the pet free request and free the pet.
 *
 * Critical section: lock player + pet (+ guild for meat reward) so a
 * concurrent withdraw / sell / transfer of the same pet can't
 * double-destroy or strand the player on a deleted pet row.
 */
async function acceptPetFree(player: Player, playerPet: PetEntity, response: CrowniclesPacket[]): Promise<void> {
	const playerGuildId = player.guildId;
	let outcome: AcceptPetFreeOutcome;
	if (playerGuildId !== null) {
		try {
			outcome = await withLockedEntities(
				[
					Player.lockKey(player.id),
					PetEntity.lockKey(playerPet.id),
					Guild.lockKey(playerGuildId)
				] as const,
				async ([
					lockedPlayer,
					lockedPet,
					lockedGuild
				]) => await applyLockedAcceptPetFree(
					response,
					{
						player: lockedPlayer, pet: lockedPet, guild: lockedGuild
					},
					playerPet.id
				)
			);
		}
		catch {
			/*
			 * Guild row may have been destroyed concurrently; fall
			 * back to a 2-row lock so the user can still free their
			 * own pet (without the meat reward).
			 */
			outcome = await withLockedEntities(
				[Player.lockKey(player.id), PetEntity.lockKey(playerPet.id)] as const,
				async ([lockedPlayer, lockedPet]) => await applyLockedAcceptPetFree(
					response,
					{
						player: lockedPlayer, pet: lockedPet
					},
					playerPet.id
				)
			);
		}
	}
	else {
		outcome = await withLockedEntities(
			[Player.lockKey(player.id), PetEntity.lockKey(playerPet.id)] as const,
			async ([lockedPlayer, lockedPet]) => await applyLockedAcceptPetFree(
				response,
				{
					player: lockedPlayer, pet: lockedPet
				},
				playerPet.id
			)
		);
	}

	if (!outcome.revalidated) {
		response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		return;
	}

	await MissionsController.update(player, response, { missionId: "depositPetInShelter" });

	response.push(makePacket(CommandPetFreeAcceptPacketRes, {
		petId: outcome.petTypeId,
		petSex: outcome.petSex,
		petNickname: outcome.petNickname ?? undefined,
		freeCost: outcome.freeCost,
		luckyMeat: outcome.luckyMeat
	}));
}

/**
 * Result of the in-lock revalidation for a free-from-shelter flow.
 */
type ShelterFreeOutcome = ({ revalidated: true } & FreedPetSnapshot) | {
	revalidated: false;
	cooldownRemainingTimeMs?: number;
	missingMoney?: number;
};

/**
 * Inside-lock body for the "free a pet from the guild shelter" flow.
 * Re-checks every invariant against the locked rows (guildPet still
 * points at the expected pet; player cooldown not yet over; player
 * still has enough money for a feisty pet), then delegates the
 * shared destroy / save logic to {@link commitFreedPet}.
 */
async function applyLockedShelterFree(
	response: CrowniclesPacket[],
	locked: {
		player: Player; pet: PetEntity; guildPet: GuildPet; guild: Guild;
	},
	expectedPetEntityId: number
): Promise<ShelterFreeOutcome> {
	const {
		player, pet, guildPet, guild
	} = locked;
	if (guildPet.petEntityId !== expectedPetEntityId) {
		return { revalidated: false };
	}

	const cooldownRemainingTimeMs = getCooldownRemainingTimeMs(player);
	if (cooldownRemainingTimeMs > 0) {
		return {
			revalidated: false, cooldownRemainingTimeMs
		};
	}

	const missingMoney = getMissingMoneyToFreePet(player, pet);
	if (missingMoney > 0) {
		return {
			revalidated: false, missingMoney
		};
	}

	const snapshot = await commitFreedPet(response, player, pet, {
		clearPlayerPetId: false,
		guildPet,
		guild
	});
	return {
		revalidated: true, ...snapshot
	};
}

/**
 * Free a pet from the guild shelter
 */
async function freePetFromShelter(
	response: CrowniclesPacket[],
	player: Player,
	petEntityId: number
): Promise<void> {
	// Outer fast-fail: locate the guildPet row and its associated pet.
	const guildPets = await GuildPets.getOfGuild(player.guildId!);
	const guildPet = guildPets.find(gp => gp.petEntityId === petEntityId);

	if (!guildPet) {
		CrowniclesLogger.warn("Player tried to free a pet from the guild but the pet is not in the guild");
		response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		return;
	}

	const petEntity = await PetEntities.getById(guildPet.petEntityId);
	if (!petEntity) {
		CrowniclesLogger.warn("Player tried to free a pet from the guild but the pet entity was not found");
		response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		return;
	}

	/*
	 * 4-row critical section: lock player + pet + guild_pet + guild
	 * together so a concurrent withdraw / sell / free of the same
	 * shelter slot cannot duplicate the meat reward, lost-update the
	 * cooldown, or strand orphan guild_pet rows.
	 */
	let outcome: ShelterFreeOutcome;
	try {
		outcome = await withLockedEntities(
			[
				Player.lockKey(player.id),
				PetEntity.lockKey(petEntity.id),
				GuildPet.lockKey(guildPet.id),
				Guild.lockKey(player.guildId!)
			] as const,
			async ([
				lockedPlayer,
				lockedPet,
				lockedGuildPet,
				lockedGuild
			]) => await applyLockedShelterFree(
				response,
				{
					player: lockedPlayer, pet: lockedPet, guildPet: lockedGuildPet, guild: lockedGuild
				},
				petEntityId
			)
		);
	}
	catch {
		/*
		 * One of the rows (guild_pet most likely, or pet entity) was
		 * destroyed by a peer transaction between our outer fast-fail
		 * read and our lock acquisition: treat as "situation changed".
		 */
		response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		return;
	}

	if (!outcome.revalidated) {
		if (outcome.cooldownRemainingTimeMs !== undefined) {
			response.push(makePacket(CommandPetFreeShelterCooldownErrorPacketRes, { cooldownRemainingTimeMs: outcome.cooldownRemainingTimeMs }));
		}
		else if (outcome.missingMoney !== undefined) {
			response.push(makePacket(CommandPetFreeShelterMissingMoneyErrorPacketRes, { missingMoney: outcome.missingMoney }));
		}
		else {
			response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		}
		return;
	}

	response.push(makePacket(CommandPetFreeShelterSuccessPacketRes, {
		petId: outcome.petTypeId,
		petSex: outcome.petSex,
		petNickname: outcome.petNickname ?? undefined,
		freeCost: outcome.freeCost,
		luckyMeat: outcome.luckyMeat
	}));
}

/**
 * Build the shelter pets entities array for collector
 */
async function buildShelterPetsEntities(guildPets: GuildPet[]): Promise<{
	petEntityId: number;
	pet: OwnedPet;
}[]> {
	const results: {
		petEntityId: number; pet: OwnedPet;
	}[] = [];
	for (const guildPet of guildPets) {
		const petEntity = await PetEntities.getById(guildPet.petEntityId);
		if (petEntity) {
			results.push({
				petEntityId: guildPet.petEntityId,
				pet: petEntity.asOwnedPet()
			});
		}
	}
	return results;
}

/**
 * Build reactions array for shelter pets selection collector
 */
async function buildShelterPetReactions(
	player: Player,
	playerPet: PetEntity | null,
	shelterPets: {
		petEntityId: number; pet: OwnedPet;
	}[]
): Promise<CrowniclesPacket[]> {
	const reactions: CrowniclesPacket[] = [];

	// Add player's own pet as an option if available and not on expedition
	const petOnExpedition = playerPet && await PetUtils.isPetOnExpedition(player.id);
	if (playerPet && !petOnExpedition) {
		const missingMoney = getMissingMoneyToFreePet(player, playerPet);
		if (missingMoney <= 0) {
			reactions.push(makePacket(ReactionCollectorPetFreeSelectReaction, {
				petEntityId: playerPet.id
			}));
		}
	}

	// Add shelter pets
	for (const shelterPet of shelterPets) {
		reactions.push(makePacket(ReactionCollectorPetFreeSelectReaction, {
			petEntityId: shelterPet.petEntityId
		}));
	}

	reactions.push(makePacket(ReactionCollectorRefuseReaction, {}));
	return reactions;
}

/**
 * Execute the pet free action based on confirmation data
 */
async function executePetFreeFromConfirmation(
	player: Player,
	confirmData: ReactionCollectorPetFreeShelterConfirmData,
	response: CrowniclesPacket[]
): Promise<void> {
	if (confirmData.isFromShelter) {
		await freePetFromShelter(response, player, confirmData.petEntityId);
		return;
	}

	const playerPet = await PetEntities.getById(confirmData.petEntityId);
	if (playerPet) {
		await acceptPetFree(player, playerPet, response);
	}
	else {
		response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
	}
}

/**
 * Create end callback for shelter pet confirmation collector (accept/refuse after selection)
 */
function createShelterConfirmEndCallback(player: Player): EndCallback {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		const reaction = collector.getFirstReaction();
		const isAccepted = reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name;

		if (isAccepted) {
			const confirmData = collector.creationPacket.data.data as ReactionCollectorPetFreeShelterConfirmData;
			await player.reload();
			await executePetFreeFromConfirmation(player, confirmData, response);
		}
		else {
			response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		}

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FREE);
	};
}

/**
 * Create end callback for shelter selection collector - now creates a confirmation collector
 */
function createShelterSelectionEndCallback(
	player: Player,
	playerPet: PetEntity | null,
	shelterPets: {
		petEntityId: number; pet: OwnedPet;
	}[],
	context: PacketContext
): EndCallback {
	return (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): void => {
		const reaction = collector.getFirstReaction();

		if (reaction && reaction.reaction.type === ReactionCollectorPetFreeSelectReaction.name) {
			const selectedPetEntityId = (reaction.reaction.data as ReactionCollectorPetFreeSelectReaction).petEntityId;
			const isFromShelter = !playerPet || selectedPetEntityId !== playerPet.id;

			// Find the selected pet's info
			let petId: number;
			let petSex: SexTypeShort;
			let petNickname: string | undefined;
			let freeCost = 0;

			if (isFromShelter) {
				const shelterPet = shelterPets.find(sp => sp.petEntityId === selectedPetEntityId);
				if (!shelterPet) {
					response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
					BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FREE);
					return;
				}
				petId = shelterPet.pet.typeId;
				petSex = shelterPet.pet.sex;
				petNickname = shelterPet.pet.nickname ?? undefined;

				// Check if pet would be feisty (loveLevel = FEISTY or lower)
				if (shelterPet.pet.loveLevel <= PetConstants.LOVE_LEVEL.FEISTY) {
					freeCost = PetFreeConstants.FREE_FEISTY_COST;
				}
			}
			else {
				petId = playerPet!.typeId;
				petSex = playerPet!.sex as SexTypeShort;
				petNickname = playerPet!.nickname ?? undefined;
				if (playerPet!.isFeisty()) {
					freeCost = PetFreeConstants.FREE_FEISTY_COST;
				}
			}

			// Create confirmation collector
			const confirmCollector = new ReactionCollectorPetFreeShelterConfirm({
				petEntityId: selectedPetEntityId,
				petId,
				petSex,
				petNickname,
				freeCost,
				isFromShelter
			});

			const confirmEndCallback = createShelterConfirmEndCallback(player);

			// Keep the player blocked during confirmation
			const confirmPacket = new ReactionCollectorInstance(
				confirmCollector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId],
					reactionLimit: 1
				},
				confirmEndCallback
			)
				.block(player.keycloakId, BlockingConstants.REASONS.PET_FREE)
				.build();

			response.push(confirmPacket);
		}
		else {
			response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FREE);
		}
	};
}

/**
 * Create end callback for simple pet free collector
 */
function createSimplePetFreeEndCallback(player: Player, playerPet: PetEntity): EndCallback {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		const reaction = collector.getFirstReaction();

		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptPetFree(player, playerPet, response);
		}
		else {
			response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		}

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FREE);
	};
}

/**
 * Build and return a reaction collector packet for pet free
 */
function buildPetFreeCollectorPacket(
	collector: ReactionCollectorPetFree | ReactionCollectorPetFreeSelection,
	context: PacketContext,
	player: Player,
	endCallback: EndCallback
): CrowniclesPacket {
	return new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.PET_FREE)
		.build();
}

/**
 * Handle the shelter pets selection flow
 */
async function handleShelterPetsFlow(
	response: CrowniclesPacket[],
	player: Player,
	playerPet: PetEntity | null,
	shelterPets: {
		petEntityId: number; pet: OwnedPet;
	}[],
	context: PacketContext
): Promise<void> {
	const reactions = await buildShelterPetReactions(player, playerPet, shelterPets);

	const collector = new ReactionCollectorPetFreeSelection(
		playerPet?.asOwnedPet(),
		shelterPets,
		reactions
	);

	const endCallback = createShelterSelectionEndCallback(player, playerPet, shelterPets, context);
	response.push(buildPetFreeCollectorPacket(collector, context, player, endCallback));
}

/**
 * Handle the simple pet free flow (no shelter pets)
 */
function handleSimplePetFreeFlow(
	response: CrowniclesPacket[],
	player: Player,
	playerPet: PetEntity,
	context: PacketContext
): void {
	const collector = new ReactionCollectorPetFree(
		playerPet.typeId,
		playerPet.sex as SexTypeShort,
		playerPet.nickname,
		playerPet.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST : 0
	);

	const endCallback = createSimplePetFreeEndCallback(player, playerPet);
	response.push(buildPetFreeCollectorPacket(collector, context, player, endCallback));
}

/**
 * Check if the player has no pets to free
 */
function hasNoPetsToFree(playerPet: PetEntity | null, shelterPetsCount: number): boolean {
	return !playerPet && shelterPetsCount === 0;
}

/**
 * Check if player's pet is blocked on expedition with no alternatives
 */
async function isPetBlockedOnExpeditionWithNoAlternatives(
	player: Player,
	playerPet: PetEntity | null,
	shelterPetsCount: number
): Promise<boolean> {
	return Boolean(playerPet)
		&& await PetUtils.isPetOnExpedition(player.id)
		&& shelterPetsCount === 0;
}

export default class PetFreeCommand {
	@commandRequires(CommandPetFreePacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandPetFreePacketReq, context: PacketContext): Promise<void> {
		const playerPet = await PetEntities.getById(player.petId);
		const shelterPets = player.guildId
			? await buildShelterPetsEntities(await GuildPets.getOfGuild(player.guildId))
			: [];

		if (hasNoPetsToFree(playerPet, shelterPets.length)) {
			response.push(makePacket(CommandPetFreePacketRes, { foundPet: false }));
			return;
		}

		if (await isPetBlockedOnExpeditionWithNoAlternatives(player, playerPet, shelterPets.length)) {
			response.push(makePacket(CommandPetFreePacketRes, {
				foundPet: true,
				petCanBeFreed: false,
				petOnExpedition: true
			}));
			return;
		}

		const cooldownRemainingTimeMs = getCooldownRemainingTimeMs(player);
		if (cooldownRemainingTimeMs > 0) {
			response.push(makePacket(CommandPetFreePacketRes, {
				foundPet: true,
				petCanBeFreed: false,
				cooldownRemainingTimeMs
			}));
			return;
		}

		if (shelterPets.length > 0) {
			await handleShelterPetsFlow(response, player, playerPet, shelterPets, context);
			return;
		}

		const missingMoney = getMissingMoneyToFreePet(player, playerPet!);
		if (missingMoney > 0) {
			response.push(makePacket(CommandPetFreePacketRes, {
				foundPet: true,
				petCanBeFreed: false,
				missingMoney
			}));
			return;
		}

		handleSimplePetFreeFlow(response, player, playerPet!, context);
	}
}
