import {SmallEvent} from "./SmallEvent";
import Entity from "../models/Entity";
import {CommandInteraction, TextChannel} from "discord.js";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {format} from "../utils/StringFormatter";
import {generateRandomItem, getItemValue, giveItemToPlayer} from "../utils/ItemUtils";
import {Constants} from "../Constants";
import {BlockingUtils} from "../utils/BlockingUtils";
import {RandomUtils} from "../utils/RandomUtils";
import {Translations} from "../Translations";
import {DraftBotValidateReactionMessage} from "../messages/DraftBotValidateReactionMessage";
import {sendErrorMessage} from "../utils/ErrorUtils";

export const smallEvent: SmallEvent = {
	canBeExecuted(): Promise<boolean> {
		return Promise.resolve(true);
	},

	async executeSmallEvent(interaction: CommandInteraction, language: string, entity: Entity, seEmbed: DraftBotEmbed): Promise<void> {
		const randomItem = await generateRandomItem(Constants.RARITY.SPECIAL);
		let price = getItemValue(randomItem);
		price *= Math.round(RandomUtils.randInt(1, 10) === 10 ? 5 : 0.6);
		const gender = RandomUtils.randInt(0, 1);
		const translationShop = Translations.getModule("smallEvents.shop", language);

		await new DraftBotValidateReactionMessage(
			interaction.user,
			async (msg: DraftBotValidateReactionMessage) => {
				BlockingUtils.unblockPlayer(entity.discordUserId);
				if (msg.isValidated()) {
					if (entity.Player.money < price) {
						return await sendErrorMessage(interaction.user, interaction.channel, language,
							translationShop.format("error.cannotBuy", {
								missingMoney: price - entity.Player.money
							})
						);
					}
					await giveItemToPlayer(entity, randomItem, language, interaction.user, <TextChannel>interaction.channel, Constants.SMALL_EVENT.SHOP_RESALE_MULTIPLIER, 1);
					console.log(entity.discordUserId + " bought an item in a mini shop for " + price);
					await entity.Player.addMoney(entity, -price, <TextChannel>interaction.channel, language);
					await entity.Player.save();
					return;
				}
				await sendErrorMessage(interaction.user, interaction.channel, language,
					translationShop.get("error.canceledPurchase"), true
				);
			}
		).setDescription(seEmbed.description
			+ format(
				translationShop.getRandom("intro." + gender)
				+ translationShop.get("end"), {
					name: translationShop.getRandom("names." + gender),
					item: randomItem.toString(language, null),
					price: price,
					type: Constants.REACTIONS.ITEM_CATEGORIES[randomItem.getCategory()] + " " + translationShop.get("types." + randomItem.getCategory())
				}))
			.reply(interaction, (collector) => BlockingUtils.blockPlayerWithCollector(entity.discordUserId, "merchant", collector));
	}
};