import { CrowniclesCachedMessage } from "./CrowniclesCachedMessage";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesEmbed } from "./CrowniclesEmbed";
import i18n from "../translations/i18n";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, parseEmoji
} from "discord.js";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	DiscordCollectorUtils,
	disableRows
} from "../utils/DiscordCollectorUtils";
import {
	ReactionCollectorFightChooseActionPacket,
	ReactionCollectorFightChooseActionReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordConstants } from "../DiscordConstants";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";
import { DisplayUtils } from "../utils/DisplayUtils";

export class CrowniclesActionChooseCachedMessage extends CrowniclesCachedMessage<ReactionCollectorFightChooseActionPacket> {
	private usernameCache?: string;

	readonly duration = 30;

	get type(): string {
		return "action_choose";
	}

	updateMessage = async (packet: ReactionCollectorFightChooseActionPacket, context: PacketContext): Promise<ReactionCollectorReturnTypeOrNull> => {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		const data = packet.data.data;
		const lng = interaction.userLanguage;
		if (!this.usernameCache) {
			this.usernameCache = await DisplayUtils.getEscapedUsername(data.fighterKeycloakId, interaction.userLanguage);
		}
		const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:fight.fightActionChoose.turnIndicationTitle", {
			lng,
			pseudo: this.usernameCache
		}), interaction.user)
			.setDescription(i18n.t("commands:fight.fightActionChoose.turnIndicationDescription", { lng }));
		const rows = [new ActionRowBuilder<ButtonBuilder>()];
		const reactions = packet.reactions as {
			type: string; data: ReactionCollectorFightChooseActionReaction;
		}[];
		reactions.forEach(action => {
			const react = action.data as ReactionCollectorFightChooseActionReaction;
			const emoji = CrowniclesIcons.fightActions[react.id];

			const button = new ButtonBuilder()
				.setEmoji(parseEmoji(emoji)!)
				.setCustomId(react.id)
				.setStyle(ButtonStyle.Secondary);

			if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
				rows.push(new ActionRowBuilder<ButtonBuilder>());
			}
			rows[rows.length - 1].addComponents(button);
		});
		const msg = await this.post({
			embeds: [embed],
			components: rows
		});
		const buttonCollector = msg!.createMessageComponentCollector({
			time: packet.endTime - Date.now()
		});
		buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== context.discord?.user) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			disableRows(rows);

			await buttonInteraction.update({
				components: rows
			});
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactions.findIndex(reaction => reaction.data.id === buttonInteraction.customId));
		});
		return [buttonCollector];
	};
}
