import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	ActionRowBuilder, parseEmoji, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} from "discord.js";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

export class EmoteUtils {
	static async testAllEmotesInSelectMenu(interaction: CrowniclesInteraction): Promise<void> {
		let emojis = Object.values(CrowniclesIcons.weapons).concat(
			Object.values(CrowniclesIcons.armors),
			Object.values(CrowniclesIcons.potions),
			Object.values(CrowniclesIcons.pets).map(pet => pet.emoteMale),
			Object.values(CrowniclesIcons.pets).map(pet => pet.emoteFemale)
		);

		// Remove duplicates
		emojis = emojis.filter((value, index, self) => self.indexOf(value) === index);

		const embed = new CrowniclesEmbed()
			.setTitle("Test select menu")
			.setDescription("Test select menu");

		const msg = await interaction.channel.send({
			embeds: [embed]
		});

		const maxOptions = 25;
		for (let i = 0; i < Math.ceil(emojis.length / maxOptions); i++) {
			CrowniclesLogger.info(`Test select menu slice ${i} / ${Math.ceil(emojis.length / maxOptions)}`);
			const emojisSlice = emojis.slice(i * maxOptions, (i + 1) * maxOptions);
			CrowniclesLogger.info(`Emojis slice: ${emojisSlice}`);
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
				CrowniclesLogger.errorWithObj("Error while sending select menu", e);
			}
		}
	}
}
