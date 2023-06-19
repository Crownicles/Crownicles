import {
	DraftBotShopMessage,
	DraftBotShopMessageBuilder,
	ShopItem,
	ShopItemCategory
} from "../../core/messages/DraftBotShopMessage";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {TranslationModule, Translations} from "../../core/Translations";
import {Guilds} from "../../core/database/game/models/Guild";
import {BlockingUtils, sendBlockedError} from "../../core/utils/BlockingUtils";
import {MissionsController} from "../../core/missions/MissionsController";
import {ICommand} from "../ICommand";
import {Constants} from "../../core/Constants";
import {CommandInteraction} from "discord.js";
import {sendErrorMessage} from "../../core/utils/ErrorUtils";
import {calculateAmountOfXPToAdd, giveFood} from "../../core/utils/GuildUtils";
import {getFoodIndexOf} from "../../core/utils/FoodUtils";
import {BlockingConstants} from "../../core/constants/BlockingConstants";
import {draftBotInstance} from "../../core/bot";
import {EffectsConstants} from "../../core/constants/EffectsConstants";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {Player, Players} from "../../core/database/game/models/Player";
import {NumberChangeReason, ShopItemType} from "../../core/constants/LogsConstants";
import {GuildConstants} from "../../core/constants/GuildConstants";

/**
 * Callback of the guild shop command
 * @param shopMessage
 */
function shopEndCallback(shopMessage: DraftBotShopMessage): void {
	BlockingUtils.unblockPlayer(shopMessage.user.id, BlockingConstants.REASONS.GUILD_SHOP);
}

/**
 * Get the shop item for winning xp
 * @param guildShopTranslations
 */
function getGuildXPShopItem(guildShopTranslations: TranslationModule): ShopItem {
	return new ShopItem(
		guildShopTranslations.get("guildXp.emote"),
		guildShopTranslations.get("guildXp.name"),
		parseInt(guildShopTranslations.get("guildXp.price"), 10),
		guildShopTranslations.get("guildXp.info"),
		async (message) => {
			const [player] = await Players.getOrRegister(message.user.id);
			const guild = await Guilds.getById(player.guildId);
			const xpToAdd = calculateAmountOfXPToAdd(parseInt(guildShopTranslations.get("guildXp.price")));
			await guild.addExperience(xpToAdd, message.sentMessage.channel, message.language, NumberChangeReason.SHOP);

			await guild.save();
			await message.sentMessage.channel.send(
				{
					embeds: [
						new DraftBotEmbed()
							.formatAuthor(guildShopTranslations.get("successNormal"), message.user)
							.setDescription(guildShopTranslations.format("guildXp.give", {
								experience: xpToAdd
							}))]
				}
			);
			draftBotInstance.logsDatabase.logGuildShopBuyout(message.user.id, ShopItemType.GUILD_XP).then();
			return true;
		}
	);
}

/**
 * Get the shop item for buying a given amount of a given food
 * @param guildShopTranslations
 * @param name
 * @param amounts
 * @param interaction
 */
function getFoodShopItem(guildShopTranslations: TranslationModule, name: string, amounts: number[], interaction: CommandInteraction): ShopItem {
	const foodJson = Translations.getModule("food", guildShopTranslations.language);
	const indexFood = getFoodIndexOf(name);
	return new ShopItem(
		Constants.PET_FOOD_GUILD_SHOP.EMOTE[indexFood],
		foodJson.get(`${name}.name`),
		Constants.PET_FOOD_GUILD_SHOP.PRICE[indexFood],
		foodJson.get(`${name}.info`),
		async (message, amount) => {
			const [player] = await Players.getOrRegister(message.user.id);
			const guild = await Guilds.getById(player.guildId);
			if (guild.isStorageFullFor(name, amount)) {
				await sendErrorMessage(message.user, interaction, guildShopTranslations.language, guildShopTranslations.get("fullStock"));
				return false;
			}
			await giveFood(interaction, message.language, player, name, amount, NumberChangeReason.SHOP);
			if (name === Constants.PET_FOOD.ULTIMATE_FOOD) {
				await MissionsController.update(player, message.sentMessage.channel, guildShopTranslations.language, {
					missionId: "buyUltimateSoups",
					count: amount
				});
			}
			draftBotInstance.logsDatabase.logFoodGuildShopBuyout(player.discordUserId, name, amount).then();
			return true;
		},
		amounts
	);
}

/**
 * Displays the guild shop
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 * @param player
 */
async function executeCommand(interaction: CommandInteraction, language: string, player: Player): Promise<void> {
	if (await sendBlockedError(interaction, language)) {
		return;
	}
	const guild = await Guilds.getById(player.guildId);
	const guildShopTranslations = Translations.getModule("commands.guildShop", language);
	const commonFoodRemainingSlots = Math.max(GuildConstants.MAX_COMMON_PET_FOOD - guild.commonFood, 1);
	const herbivorousFoodRemainingSlots = Math.max(GuildConstants.MAX_HERBIVOROUS_PET_FOOD - guild.herbivorousFood, 1);
	const carnivorousFoodRemainingSlots = Math.max(GuildConstants.MAX_CARNIVOROUS_PET_FOOD - guild.carnivorousFood, 1);
	const ultimateFoodRemainingSlots = Math.max(GuildConstants.MAX_ULTIMATE_PET_FOOD - guild.ultimateFood, 1);

	const shopMessage = new DraftBotShopMessageBuilder(
		interaction,
		guildShopTranslations.get("title"),
		language
	);
	if (!guild.isAtMaxLevel()) {
		shopMessage.addCategory(new ShopItemCategory(
			[
				getGuildXPShopItem(guildShopTranslations)
			],
			guildShopTranslations.get("xpItem")
		));
	}
	await (await shopMessage.addCategory(new ShopItemCategory(
		[
			getFoodShopItem(guildShopTranslations, "commonFood", [1, Math.min(5, commonFoodRemainingSlots), Math.min(10, commonFoodRemainingSlots)], interaction),
			getFoodShopItem(guildShopTranslations, "herbivorousFood", [1, Math.min(5, herbivorousFoodRemainingSlots), Math.min(10, herbivorousFoodRemainingSlots)], interaction),
			getFoodShopItem(guildShopTranslations, "carnivorousFood", [1, Math.min(5, carnivorousFoodRemainingSlots), Math.min(10, carnivorousFoodRemainingSlots)], interaction),
			getFoodShopItem(guildShopTranslations, "ultimateFood", [1, Math.min(5, ultimateFoodRemainingSlots)], interaction)
		],
		guildShopTranslations.get("foodItem")
	))
		.endCallback(shopEndCallback)
		.build())
		.reply(interaction, (collector) => BlockingUtils.blockPlayerWithCollector(interaction.user.id, BlockingConstants.REASONS.GUILD_SHOP, collector));
}

const currentCommandFrenchTranslations = Translations.getModule("commands.guildShop", Constants.LANGUAGE.FRENCH);
const currentCommandEnglishTranslations = Translations.getModule("commands.guildShop", Constants.LANGUAGE.ENGLISH);
export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand(currentCommandFrenchTranslations, currentCommandEnglishTranslations),
	executeCommand,
	requirements: {
		disallowEffects: [EffectsConstants.EMOJI_TEXT.BABY, EffectsConstants.EMOJI_TEXT.DEAD, EffectsConstants.EMOJI_TEXT.LOCKED],
		guildRequired: true
	},
	mainGuildCommand: false
};