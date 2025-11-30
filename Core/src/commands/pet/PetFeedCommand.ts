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
import { GuildShopConstants } from "../../../../Lib/src/constants/GuildShopConstants";
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
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";

function getWithoutGuildPetFeedEndCallback(player: Player, authorPet: PetEntity) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FEED);

		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandPetFeedCancelErrorPacket, {}));
			return;
		}

		const candyIndex = getFoodIndexOf(PetConstants.PET_FOOD.COMMON_FOOD);
		const candyPrice = GuildShopConstants.PRICES.FOOD[candyIndex];

		await player.reload();
		await authorPet.reload();

		if (player.money - candyPrice < 0) {
			response.push(makePacket(CommandPetFeedNoMoneyFeedErrorPacket, {}));
			return;
		}

		await player.spendMoney({
			response,
			amount: candyPrice,
			reason: NumberChangeReason.PET_FEED
		});

		authorPet.hungrySince = new Date();
		await authorPet.changeLovePoints({
			response,
			player,
			amount: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[candyIndex],
			reason: NumberChangeReason.PET_FEED
		});

		await Promise.all([
			authorPet.save(),
			player.save()
		]);

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
		GuildShopConstants.PRICES.FOOD[getFoodIndexOf(PetConstants.PET_FOOD.COMMON_FOOD)]
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

function getWithGuildPetFeedEndCallback(player: Player, authorPet: PetEntity, guild: Guild) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FEED);

		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandPetFeedCancelErrorPacket, {}));
			return;
		}

		const foodReaction = firstReaction.reaction.data as ReactionCollectorPetFeedWithGuildFoodReaction;
		const foodIndex = getFoodIndexOf(foodReaction.food);

		await player.reload();
		await authorPet.reload();
		await guild.reload();

		if (guild.getDataValue(foodReaction.food) < foodReaction.amount) {
			response.push(makePacket(CommandPetFeedGuildStorageEmptyErrorPacket, {}));
			return;
		}

		guild.removeFood(foodReaction.food, 1, NumberChangeReason.PET_FEED);

		const petModel = PetDataController.instance.getById(authorPet.typeId);
		const changeLovePointsParameters = {
			response,
			player,
			amount: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[foodIndex],
			reason: NumberChangeReason.PET_FEED
		};
		if (petModel.diet && (foodReaction.food === PetFood.SALAD || foodReaction.food === PetFood.MEAT)) {
			let result = CommandPetFeedResult.DISLIKE;
			if (petModel.canEatMeat() && foodReaction.food === PetFood.MEAT || petModel.canEatVegetables() && foodReaction.food === PetFood.SALAD) {
				await authorPet.changeLovePoints(changeLovePointsParameters);
				result = CommandPetFeedResult.VERY_HAPPY;
			}
			response.push(makePacket(CommandPetFeedSuccessPacket, {
				result
			}));
		}
		else {
			await authorPet.changeLovePoints(changeLovePointsParameters);
			response.push(makePacket(CommandPetFeedSuccessPacket, {
				result: foodReaction.food === PetFood.CANDY ? CommandPetFeedResult.HAPPY : CommandPetFeedResult.VERY_VERY_HAPPY
			}));
		}

		authorPet.hungrySince = new Date();
		await Promise.all([
			authorPet.save(),
			guild.save()
		]);
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
async function withGuildPetFeed(context: PacketContext, response: CrowniclesPacket[], player: Player, authorPet: PetEntity): Promise<void> {
	const guild = await Guilds.getById(player.guildId);
	const reactions = [];

	for (const food of Object.values(PetConstants.PET_FOOD)) {
		const foodIndex = getFoodIndexOf(food);
		const foodAmount = guild.getDataValue(food);
		if (guild.getDataValue(food) > 0) {
			reactions.push({
				food: food as PetFood,
				amount: foodAmount,
				maxAmount: GuildConstants.MAX_PET_FOOD[foodIndex]
			});
		}
	}

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

export default class PetFeedCommand {
	@commandRequires(CommandPetFeedPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandPetFeedPacketReq, context: PacketContext): Promise<void> {
		const authorPet = await PetEntities.getById(player.petId);
		if (!authorPet) {
			response.push(makePacket(CommandPetFeedNoPetErrorPacket, {}));
			return;
		}

		// Check if pet is on expedition
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (activeExpedition) {
			response.push(makePacket(CommandPetFeedPetOnExpeditionErrorPacket, {}));
			return;
		}

		const cooldownTime = authorPet.getFeedCooldown(PetDataController.instance.getById(authorPet.typeId));
		if (cooldownTime > 0) {
			response.push(makePacket(CommandPetFeedNotHungryErrorPacket, {
				pet: authorPet.asOwnedPet()
			}));
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
