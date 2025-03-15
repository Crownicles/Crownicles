import {DraftBotIcons} from "../../../Lib/src/DraftBotIcons";
import {ActionRowBuilder, parseEmoji, StringSelectMenuBuilder, StringSelectMenuOptionBuilder} from "discord.js";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {DraftbotInteraction} from "../messages/DraftbotInteraction";

export class EmoteUtils {

	/**
	 * Map of emojis to their Discord equivalent
	 * TODO : ADD EMOJI TRANSLATION WHEN YOU SEE A DESCREPANCY PLEASE, THANKS, DON'T BE FOOLS
	 * @private
	 */
	private static emojiUnicodeMap: Record<string, string> = {
		"⛰": ":mountain:"
	};

	/**
	 * Translates an emoji to its Discord equivalent when necessary
	 * @param emoji
	 */
	static translateEmojiToDiscord(emoji: string): string {
		if (this.emojiUnicodeMap[emoji]) {
			return this.emojiUnicodeMap[emoji];
		}
		return emoji;
	}

	static async testAllEmotesInSelectMenu(interaction: DraftbotInteraction): Promise<void> {
		let emojis = Object.values(DraftBotIcons.weapons).concat(Object.values(DraftBotIcons.armors), Object.values(DraftBotIcons.potions));
		// Remove duplicates
		emojis = emojis.filter((value, index, self) => self.indexOf(value) === index);
		// Remove some emojis that are not supported by Discord
		emojis.splice(emojis.indexOf("👁️‍🗨️"), 1);

		const embed = new DraftBotEmbed()
			.setTitle("Test select menu")
			.setDescription("Test select menu");

		const msg = await interaction.channel.send({
			embeds: [embed]
		});

		const maxOptions = 25;
		for (let i = 0; i < Math.ceil(emojis.length / maxOptions); i++) {
			console.log("Test select menu slice " + i + " / " + Math.ceil(emojis.length / maxOptions));
			const emojisSlice = emojis.slice(i * maxOptions, (i + 1) * maxOptions);
			console.log("Emojis slice: " + emojisSlice);
			const row = new ActionRowBuilder<StringSelectMenuBuilder>();
			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId("testSelectMenu")
				.setPlaceholder("Test select menu")
				.addOptions(emojisSlice.map((emoji, index) => new StringSelectMenuOptionBuilder()
					.setDescription("Test")
					.setLabel("Test")
					.setValue(index.toString())
					.setEmoji(parseEmoji(emoji)!)));
			try {
				await msg!.edit({
					embeds: [embed],
					components: [row.addComponents(selectMenu)]
				});
			}
			catch (e) {
				console.error(e);
			}
		}
	}
}