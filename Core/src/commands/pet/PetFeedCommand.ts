import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandPetFeedCancelErrorPacket,
	CommandPetFeedGuildStorageEmptyErrorPacket,
	CommandPetFeedNoMoneyFeedErrorPacket,
	CommandPetFeedNoPetErrorPacket,
	CommandPetFeedNotHungryErrorPacket,
	CommandPetFeedPacketReq,
	CommandPetFeedPetOnExpeditionErrorPacket,
	CommandPetFeedResult,
	CommandPetFeedSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandPetFeedPacket";
import {
	PetEntities, PetEntity
} from "../../core/database/game/models/PetEntity";
import { PetDataController } from "../../data/Pet";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorPetFeedWithoutGuild } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithoutGuild";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";

import { getFoodIndexOf } from "../../core/utils/FoodUtils";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { PetFood } from "../../../../Lib/src/types/PetFood";
import {
	ReactionCollectorPetFeedWithGuild,
	ReactionCollectorPetFeedWithGuildFoodReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithGuild";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import { PetUtils } from "../../core/utils/PetUtils";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * In-lock body for the no-guild candy-feed flow. Re-validates that
 * the player still owns this pet and can still afford the candy
 * before mutating state, so a concurrent pet transfer / sell / free
 * or money sink cannot cause a lost-update.
 */
async function applyLockedCandyFeed(
	response: CrowniclesPacket[],
	locked: {
		player: Player; pet: PetEntity;
	},
	expectedPetId: number
): Promise<{ revalidated: false } | { revalidated: true }> {
	const {
		player, pet
	} = locked;
	const candyIndex = getFoodIndexOf(PetConstants.PET_FOOD.COMMON_FOOD);
	const candyPrice = GuildDomainConstants.SHOP_PRICES.FOOD[candyIndex];

	if (player.petId !== expectedPetId) {
		return { revalidated: false };
	}
	if (player.money < candyPrice) {
		return { revalidated: false };
	}

	await player.spendMoney({
		response,
		amount: candyPrice,
		reason: NumberChangeReason.PET_FEED
	});

	pet.hungrySince = new Date();
	await pet.changeLovePoints({
		response,
		player,
		amount: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[candyIndex],
		reason: NumberChangeReason.PET_FEED
	});

	await Promise.all([pet.save(), player.save()]);
	return { revalidated: true };
}

/**
 * Returns true (and pushes the cancel packet) when the user
 * either timed out or refused. Extracted to keep both feed
 * end-callbacks below the CodeScene module mean threshold.
 */
function isFeedCancelled(collector: ReactionCollectorInstance, response: CrowniclesPacket[]): boolean {
	const firstReaction = collector.getFirstReaction();
	if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
		response.push(makePacket(CommandPetFeedCancelErrorPacket, {}));
		return true;
	}
	return false;
}

/**
 * Runs the candy-feed critical section under a Player+PetEntity
 * row lock. Returns null (and pushes the no-pet packet) if the
 * pet row was destroyed under us. Extracted to keep
 * `getWithoutGuildPetFeedEndCallback` below the CodeScene module
 * mean threshold.
 */
async function runCandyFeedUnderLock(
	response: CrowniclesPacket[],
	player: Player,
	authorPet: PetEntity
): Promise<{ revalidated: false } | { revalidated: true } | null> {
	try {
		return await withLockedEntities(
			[Player.lockKey(player.id), PetEntity.lockKey(authorPet.id)] as const,
			async ([lockedPlayer, lockedPet]) => await applyLockedCandyFeed(
				response,
				{
					player: lockedPlayer, pet: lockedPet
				},
				authorPet.id
			)
		);
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			response.push(makePacket(CommandPetFeedNoPetErrorPacket, {}));
			return null;
		}
		throw error;
	}
}

function getWithoutGuildPetFeedEndCallback(player: Player, authorPet: PetEntity) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FEED);

		if (isFeedCancelled(collector, response)) {
			return;
		}

		const outcome = await runCandyFeedUnderLock(response, player, authorPet);
		if (outcome === null) {
			return;
		}
		if (!outcome.revalidated) {
			response.push(makePacket(CommandPetFeedNoMoneyFeedErrorPacket, {}));
			return;
		}

		response.push(makePacket(CommandPetFeedSuccessPacket, {
			result: CommandPetFeedResult.HAPPY
		}));
	};
}

/**
 * Allow a user without guild to feed his pet with some candies
 * @param context
 * @param response
 * @param player
 * @param authorPet
 * @returns
 */
function withoutGuildPetFeed(context: PacketContext, response: CrowniclesPacket[], player: Player, authorPet: PetEntity): void {
	const collector = new ReactionCollectorPetFeedWithoutGuild(
		authorPet.asOwnedPet(),
		PetFood.CANDY,
		GuildDomainConstants.SHOP_PRICES.FOOD[getFoodIndexOf(PetConstants.PET_FOOD.COMMON_FOOD)]
	);

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1
		},
		getWithoutGuildPetFeedEndCallback(player, authorPet)
	)
		.block(player.keycloakId, BlockingConstants.REASONS.PET_FEED)
		.build();

	response.push(collectorPacket);
}

/**
 * Result of the in-lock guild-feed body.
 */
type GuildFeedOutcome =
	| {
		revalidated: false; reason: "petChanged" | "storageEmpty";
	}
	| {
		revalidated: true; result: CommandPetFeedResult;
	};

/**
 * Pure helper that maps a pet/food combination to the feed-result
 * label and whether the food contributes love points. Extracted to
 * keep `applyLockedGuildFeed` cyclomatic complexity below the
 * CodeScene module mean threshold.
 */
function evaluateFeedResult(
	petModel: ReturnType<typeof PetDataController.instance.getById> | undefined,
	food: PetFood
): {
	gainsLove: boolean; result: CommandPetFeedResult;
} {
	const isDietFood = food === PetFood.SALAD || food === PetFood.MEAT;
	if (petModel?.diet && isDietFood) {
		const eats = (petModel.canEatMeat() && food === PetFood.MEAT)
			|| (petModel.canEatVegetables() && food === PetFood.SALAD);
		return eats
			? {
				gainsLove: true, result: CommandPetFeedResult.VERY_HAPPY
			}
			: {
				gainsLove: false, result: CommandPetFeedResult.DISLIKE
			};
	}
	return {
		gainsLove: true,
		result: food === PetFood.CANDY ? CommandPetFeedResult.HAPPY : CommandPetFeedResult.VERY_VERY_HAPPY
	};
}

/**
 * In-lock body for the guild-pantry feed flow. Re-validates that
 * the player still owns this pet, that the picked food is still
 * available in the locked guild row, then atomically debits the
 * pantry and credits love points to the locked pet entity.
 */
async function applyLockedGuildFeed(
	response: CrowniclesPacket[],
	locked: {
		player: Player; pet: PetEntity; guild: Guild;
	},
	expected: {
		petId: number; foodReaction: ReactionCollectorPetFeedWithGuildFoodReaction;
	}
): Promise<GuildFeedOutcome> {
	const {
		player, pet, guild
	} = locked;
	const {
		petId, foodReaction
	} = expected;

	if (player.petId !== petId) {
		return {
			revalidated: false, reason: "petChanged"
		};
	}
	if (guild.getDataValue(foodReaction.food) < foodReaction.amount) {
		return {
			revalidated: false, reason: "storageEmpty"
		};
	}

	guild.removeFood(foodReaction.food, 1, NumberChangeReason.PET_FEED);

	const petModel = PetDataController.instance.getById(pet.typeId);
	const {
		gainsLove, result
	} = evaluateFeedResult(petModel, foodReaction.food);

	if (gainsLove) {
		await pet.changeLovePoints({
			response,
			player,
			amount: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[getFoodIndexOf(foodReaction.food)],
			reason: NumberChangeReason.PET_FEED
		});
	}

	pet.hungrySince = new Date();
	await Promise.all([pet.save(), guild.save()]);
	return {
		revalidated: true, result
	};
}

/**
 * Runs the guild-feed critical section under a Player+PetEntity+
 * Guild row lock. Returns null (and pushes the storage-empty
 * packet) if any locked row was destroyed under us. Extracted to
 * keep `getWithGuildPetFeedEndCallback` below the CodeScene
 * module mean threshold.
 */
async function runGuildFeedUnderLock(
	response: CrowniclesPacket[],
	player: Player,
	authorPet: PetEntity,
	guild: Guild,
	foodReaction: ReactionCollectorPetFeedWithGuildFoodReaction
): Promise<GuildFeedOutcome | null> {
	try {
		return await withLockedEntities(
			[
				Player.lockKey(player.id),
				PetEntity.lockKey(authorPet.id),
				Guild.lockKey(guild.id)
			] as const,
			async ([
				lockedPlayer,
				lockedPet,
				lockedGuild
			]) => await applyLockedGuildFeed(
				response,
				{
					player: lockedPlayer, pet: lockedPet, guild: lockedGuild
				},
				{
					petId: authorPet.id, foodReaction
				}
			)
		);
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			response.push(makePacket(CommandPetFeedGuildStorageEmptyErrorPacket, {}));
			return null;
		}
		throw error;
	}
}

function getWithGuildPetFeedEndCallback(player: Player, authorPet: PetEntity, guild: Guild) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FEED);

		if (isFeedCancelled(collector, response)) {
			return;
		}

		const foodReaction = collector.getFirstReaction()!.reaction.data as ReactionCollectorPetFeedWithGuildFoodReaction;

		const outcome = await runGuildFeedUnderLock(response, player, authorPet, guild, foodReaction);
		if (outcome === null) {
			return;
		}
		if (!outcome.revalidated) {
			response.push(makePacket(CommandPetFeedGuildStorageEmptyErrorPacket, {}));
			return;
		}

		response.push(makePacket(CommandPetFeedSuccessPacket, {
			result: outcome.result
		}));
	};
}

/**
 * Allow a user in a guild to give some food to his pet
 * @param context
 * @param response
 * @param player
 * @param authorPet
 * @returns
 */
/**
 * Build the food-reaction list offered to the player from the
 * guild pantry. Extracted to keep `withGuildPetFeed` cyclomatic
 * complexity below the CodeScene module mean threshold.
 */
function buildGuildFoodReactions(guild: Guild): Array<{
	food: PetFood; amount: number; maxAmount: number;
}> {
	const foodCaps = GuildDomainConstants.getFoodCaps(guild.pantryLevel);
	const reactions: Array<{
		food: PetFood; amount: number; maxAmount: number;
	}> = [];
	for (const food of Object.values(PetConstants.PET_FOOD)) {
		const foodAmount = guild.getDataValue(food);
		if (foodAmount > 0) {
			reactions.push({
				food: food as PetFood,
				amount: foodAmount,
				maxAmount: foodCaps[getFoodIndexOf(food)]
			});
		}
	}
	return reactions;
}

async function withGuildPetFeed(context: PacketContext, response: CrowniclesPacket[], player: Player, authorPet: PetEntity): Promise<void> {
	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		response.push(makePacket(CommandPetFeedGuildStorageEmptyErrorPacket, {}));
		return;
	}

	const reactions = buildGuildFoodReactions(guild);
	if (reactions.length === 0) {
		response.push(makePacket(CommandPetFeedGuildStorageEmptyErrorPacket, {}));
		return;
	}

	const collector = new ReactionCollectorPetFeedWithGuild(
		authorPet.asOwnedPet(),
		reactions
	);

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1
		},
		getWithGuildPetFeedEndCallback(player, authorPet, guild)
	)
		.block(player.keycloakId, BlockingConstants.REASONS.PET_FEED)
		.build();

	response.push(collectorPacket);
}

/**
 * Validates the static feed prerequisites (pet exists, not on
 * expedition, not on cooldown). Returns the resolved pet entity
 * or null when a refusal packet has already been pushed.
 * Extracted to keep `execute` below the CodeScene module mean
 * threshold.
 */
async function validateFeedPrerequisites(player: Player, response: CrowniclesPacket[]): Promise<PetEntity | null> {
	const authorPet = await PetEntities.getById(player.petId);
	if (!authorPet) {
		response.push(makePacket(CommandPetFeedNoPetErrorPacket, {}));
		return null;
	}

	if (await PetUtils.isPetOnExpedition(player.id)) {
		response.push(makePacket(CommandPetFeedPetOnExpeditionErrorPacket, {}));
		return null;
	}

	const cooldownTime = authorPet.getFeedCooldown(PetDataController.instance.getById(authorPet.typeId)!);
	if (cooldownTime > 0) {
		response.push(makePacket(CommandPetFeedNotHungryErrorPacket, {
			pet: authorPet.asOwnedPet()
		}));
		return null;
	}

	return authorPet;
}

export default class PetFeedCommand {
	@commandRequires(CommandPetFeedPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandPetFeedPacketReq, context: PacketContext): Promise<void> {
		const authorPet = await validateFeedPrerequisites(player, response);
		if (!authorPet) {
			return;
		}

		if (!player.guildId) {
			withoutGuildPetFeed(context, response, player, authorPet);
		}
		else {
			await withGuildPetFeed(context, response, player, authorPet);
		}
	}
}
