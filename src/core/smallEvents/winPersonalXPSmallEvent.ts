import {SmallEvent} from "./SmallEvent";
import {CommandInteraction} from "discord.js";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {RandomUtils} from "../utils/RandomUtils";
import {format} from "../utils/StringFormatter";
import {SmallEventConstants} from "../constants/SmallEventConstants";
import {Translations} from "../Translations";
import {NumberChangeReason} from "../constants/LogsConstants";
import Player from "../database/game/models/Player";

export const smallEvent: SmallEvent = {
	/**
	 * No restrictions on who can do it
	 */
	canBeExecuted(): Promise<boolean> {
		return Promise.resolve(true);
	},

	/**
	 * Win personal XP
	 * @param interaction
	 * @param language
	 * @param player
	 * @param seEmbed
	 */
	async executeSmallEvent(interaction: CommandInteraction, language: string, player: Player, seEmbed: DraftBotEmbed): Promise<void> {
		const xpWon = RandomUtils.rangedInt(SmallEventConstants.EXPERIENCE);
		const translationWXPP = Translations.getModule("smallEvents.winPersonalXP", language);
		seEmbed
			.setDescription(
				format(
					translationWXPP.getRandom("stories") + translationWXPP.get("end"),
					{
						xp: xpWon
					})
			);
		await player.addExperience({
			amount: xpWon,
			channel: interaction.channel,
			language,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await player.save();
		await interaction.editReply({embeds: [seEmbed]});
	}
};