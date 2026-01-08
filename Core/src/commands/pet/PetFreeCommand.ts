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
	ReactionCollectorPetFreeSelection
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Guild, { Guilds } from "../../core/database/game/models/Guild";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
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
function generateLuckyMeat(guild: Guild, pPet: PetEntity): boolean {
	return guild && guild.carnivorousFood + 1 <= GuildConstants.MAX_PET_FOOD[getFoodIndexOf(PetConstants.PET_FOOD.CARNIVOROUS_FOOD)]
		&& RandomUtils.crowniclesRandom.realZeroToOneInclusive() <= PetFreeConstants.GIVE_MEAT_PROBABILITY
		&& !pPet.isFeisty();
}

/**
 * Accept the pet free request and free the pet
 * @param player
 * @param playerPet
 * @param response
 */
async function acceptPetFree(player: Player, playerPet: PetEntity, response: CrowniclesPacket[]): Promise<void> {
	await player.reload(); // Let's make sure the player has not lost money in the meantime
	// Check money again just in case
	const missingMoney = getMissingMoneyToFreePet(player, playerPet);
	if (missingMoney > 0) {
		response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		return;
	}

	if (playerPet.isFeisty()) {
		await player.spendMoney({
			amount: PetFreeConstants.FREE_FEISTY_COST,
			response,
			reason: NumberChangeReason.PET_FREE
		});
	}

	LogsDatabase.logPetFree(playerPet).then();

	await playerPet.destroy();
	player.petId = null;
	player.lastPetFree = new Date();
	await player.save();

	let guild: Guild;
	let luckyMeat = false;
	try {
		guild = await Guilds.getById(player.guildId);
		luckyMeat = generateLuckyMeat(guild, playerPet);
		if (luckyMeat) {
			guild!.carnivorousFood += PetFreeConstants.MEAT_GIVEN;
			await guild!.save();
		}
	}
	catch {
		// Continue regardless of error
	}

	response.push(makePacket(CommandPetFreeAcceptPacketRes, {
		petId: playerPet.typeId,
		petSex: playerPet.sex as SexTypeShort,
		petNickname: playerPet.nickname,
		freeCost: playerPet.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST : 0,
		luckyMeat
	}));
}

/**
 * Free a pet from the guild shelter
 */
async function freePetFromShelter(
	response: CrowniclesPacket[],
	player: Player,
	petEntityId: number
): Promise<void> {
	// Get guild pets and find the one to free
	const guildPets = await GuildPets.getOfGuild(player.guildId);
	const guildPet = guildPets.find(gp => gp.petEntityId === petEntityId);

	if (!guildPet) {
		CrowniclesLogger.warn("Player tried to free a pet from the guild but the pet is not in the guild");
		response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
		return;
	}

	const petEntity = await PetEntities.getById(guildPet.petEntityId);

	// Check cooldown
	const cooldownRemainingTimeMs = getCooldownRemainingTimeMs(player);
	if (cooldownRemainingTimeMs > 0) {
		response.push(makePacket(CommandPetFreeShelterCooldownErrorPacketRes, { cooldownRemainingTimeMs }));
		return;
	}

	// Check money for feisty pets
	const missingMoney = getMissingMoneyToFreePet(player, petEntity);
	if (missingMoney > 0) {
		response.push(makePacket(CommandPetFreeShelterMissingMoneyErrorPacketRes, { missingMoney }));
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
	await guildPet.destroy();
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

	response.push(makePacket(CommandPetFreeShelterSuccessPacketRes, {
		petId: petEntity.typeId,
		petSex: petEntity.sex as SexTypeShort,
		petNickname: petEntity.nickname,
		freeCost: petEntity.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST : 0,
		luckyMeat
	}));
}

/**
 * Build the shelter pets entities array for collector
 */
async function buildShelterPetsEntities(guildPets: GuildPet[]): Promise<{
	petEntityId: number;
	pet: OwnedPet;
}[]> {
	const shelterPetsEntities = [];
	for (const guildPet of guildPets) {
		shelterPetsEntities.push({
			petEntityId: guildPet.petEntityId,
			pet: (await PetEntities.getById(guildPet.petEntityId)).asOwnedPet()
		});
	}
	return shelterPetsEntities;
}

export default class PetFreeCommand {
	@commandRequires(CommandPetFreePacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandPetFreePacketReq, context: PacketContext): Promise<void> {
		const playerPet = await PetEntities.getById(player.petId);

		// Get shelter pets if player has a guild
		let shelterPets: {
			petEntityId: number; pet: OwnedPet;
		}[] = [];
		if (player.guildId) {
			const guildPets = await GuildPets.getOfGuild(player.guildId);
			shelterPets = await buildShelterPetsEntities(guildPets);
		}

		// No pet and no shelter pets = error
		if (!playerPet && shelterPets.length === 0) {
			response.push(makePacket(CommandPetFreePacketRes, {
				foundPet: false
			}));
			return;
		}

		// Check if pet is on expedition (only applies to player's own pet)
		if (playerPet && await PetUtils.isPetOnExpedition(player.id)) {
			// If player has no shelter pets either, show error
			if (shelterPets.length === 0) {
				response.push(makePacket(CommandPetFreePacketRes, {
					foundPet: true,
					petCanBeFreed: false,
					petOnExpedition: true
				}));
				return;
			}

			// Otherwise, player can still free shelter pets but not their own
		}

		// Check cooldown (applies to all pet free operations)
		const cooldownRemainingTimeMs = getCooldownRemainingTimeMs(player);
		if (cooldownRemainingTimeMs > 0) {
			response.push(makePacket(CommandPetFreePacketRes, {
				foundPet: true,
				petCanBeFreed: false,
				cooldownRemainingTimeMs
			}));
			return;
		}

		// If player has shelter pets, show selection menu
		if (shelterPets.length > 0) {
			// Build reactions for shelter pets selection
			const reactions = [];

			// Add player's own pet as an option if available and not on expedition
			const petOnExpedition = playerPet && await PetUtils.isPetOnExpedition(player.id);
			if (playerPet && !petOnExpedition) {
				// Check if player has enough money for own pet
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

			const collector = new ReactionCollectorPetFreeSelection(
				playerPet?.asOwnedPet(),
				shelterPets,
				reactions
			);

			const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
				const reaction = collector.getFirstReaction();

				if (reaction && reaction.reaction.type === ReactionCollectorPetFreeSelectReaction.name) {
					const selectedPetEntityId = (reaction.reaction.data as ReactionCollectorPetFreeSelectReaction).petEntityId;

					await player.reload();

					// Check if selected pet is player's own pet
					if (playerPet && selectedPetEntityId === playerPet.id) {
						await acceptPetFree(player, playerPet, response);
					}
					else {
						// Free from shelter
						await freePetFromShelter(response, player, selectedPetEntityId);
					}
				}
				else {
					response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
				}

				BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FREE);
			};

			const collectorPacket = new ReactionCollectorInstance(
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

			response.push(collectorPacket);
			return;
		}

		/*
		 * No shelter pets, only player's own pet - use simple flow
		 * Check money
		 */
		const missingMoney = getMissingMoneyToFreePet(player, playerPet!);
		if (missingMoney > 0) {
			response.push(makePacket(CommandPetFreePacketRes, {
				foundPet: true,
				petCanBeFreed: false,
				missingMoney
			}));
			return;
		}

		// Send simple accept/refuse collector
		const collector = new ReactionCollectorPetFree(
			playerPet!.typeId,
			playerPet!.sex as SexTypeShort,
			playerPet!.nickname,
			playerPet!.isFeisty() ? PetFreeConstants.FREE_FEISTY_COST : 0
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();

			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptPetFree(player, playerPet!, response);
			}
			else {
				response.push(makePacket(CommandPetFreeRefusePacketRes, {}));
			}

			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FREE);
		};

		const collectorPacket = new ReactionCollectorInstance(
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

		response.push(collectorPacket);
	}
}
