import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorReactPacket,
	ReactionCollectorRefuseReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCache } from "../bot/DiscordCache";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	InteractionCallbackResponse,
	Message,
	MessageActionRowComponentBuilder,
	MessageComponentInteraction,
	parseEmoji
} from "discord.js";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import {
	sendInteractionNotForYou, SendManner
} from "./ErrorUtils";
import { PacketUtils } from "./PacketUtils";
import {
	keycloakConfig, shardId
} from "../bot/CrowniclesShard.js";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils.js";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordMQTT } from "../bot/DiscordMQTT";
import { RequirementEffectPacket } from "../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
import { Effect } from "../../../Lib/src/types/Effect";
import { PacketConstants } from "../../../Lib/src/constants/PacketConstants";
import { DiscordConstants } from "../DiscordConstants";

type SendingContext = {
	packet: ReactionCollectorCreationPacket;
	context: PacketContext;
};

type SendingValues = {
	embed: CrowniclesEmbed | string;
	items: string[];
};

export const SEND_POLITICS = {
	ALWAYS_FOLLOWUP: [SendManner.FOLLOWUP],
	REPLY_OR_FOLLOWUP: [SendManner.REPLY, SendManner.FOLLOWUP],
	REPLY_OR_EDIT_REPLY: [SendManner.REPLY, SendManner.EDIT_REPLY],
	EDIT_REPLY_OR_FOLLOWUP: [SendManner.EDIT_REPLY, SendManner.FOLLOWUP],
	ALWAYS_SEND: [SendManner.SEND]
};

const MANNER_TO_METHOD = {
	[SendManner.SEND]: (interaction: CrowniclesInteraction): typeof interaction.channel.send => interaction.channel.send,
	[SendManner.REPLY]: (interaction: CrowniclesInteraction): typeof interaction.reply => interaction.reply,
	[SendManner.FOLLOWUP]: (interaction: CrowniclesInteraction): typeof interaction.followUp => interaction.followUp,
	[SendManner.EDIT_REPLY]: (interaction: CrowniclesInteraction): typeof interaction.editReply => interaction.editReply
};

function getSendingManner(interaction: CrowniclesInteraction, sendManners: SendManner[]): SendManner {
	return sendManners.length === 1 ? sendManners[0] : interaction.replied ? sendManners[1] : sendManners[0];
}

/**
 * Disables all components in the provided action rows
 * @param rows - Array of action rows containing components to disable
 */
export function disableRows(rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]): void {
	rows.forEach(row => {
		row.components.forEach(component => {
			component.setDisabled(true);
		});
	});
}

export abstract class DiscordCollectorUtils {
	private static choiceListEmotes = [
		"1⃣",
		"2⃣",
		"3⃣",
		"4⃣",
		"5⃣",
		"6⃣",
		"7⃣",
		"8⃣",
		"9⃣"
	];

	static sendReaction(
		packet: ReactionCollectorCreationPacket,
		context: PacketContext,
		userKeycloakId: string,
		component: MessageComponentInteraction | null,
		reactionIndex: number
	): void {
		const responsePacket = makePacket(
			ReactionCollectorReactPacket,
			{
				id: packet.id,
				keycloakId: userKeycloakId,
				reactionIndex
			}
		);

		if (component) {
			if (component.isButton()) {
				DiscordCache.cacheButtonInteraction(component);
			}
			else if (component.isStringSelectMenu()) {
				DiscordCache.cacheStringSelectMenuInteraction(component);
			}
		}

		PacketUtils.sendPacketToBackend({
			frontEndOrigin: PacketConstants.FRONT_END_ORIGINS.DISCORD,
			frontEndSubOrigin: context.frontEndSubOrigin,
			keycloakId: userKeycloakId,
			discord: {
				user: context.discord!.user,
				channel: context.discord!.channel,
				interaction: context.discord!.interaction,
				buttonInteraction: component?.isButton() ? component.id : undefined,
				stringSelectMenuInteraction: component?.isStringSelectMenu() ? component.id : undefined,
				language: context.discord!.language,
				shardId
			}
		}, responsePacket);
	}

	static async createAcceptRefuseCollector(
		interaction: CrowniclesInteraction,
		messageContentOrEmbed: CrowniclesEmbed | string,
		reactionCollectorCreationPacket: ReactionCollectorCreationPacket,
		context: PacketContext,
		options?: {
			canInitiatorRefuse?: boolean;
			acceptedUsersId?: string[];
			anyoneCanReact?: boolean;
			emojis?: {
				accept?: string;
				refuse?: string;
			};
			notDeferReply?: boolean;
			indexes?: {
				accept?: number;
				refuse?: number;
			};
		}
	): Promise<ReactionCollectorReturnTypeOrNull> {
		const emojis = {
			accept: CrowniclesIcons.collectors.accept,
			refuse: CrowniclesIcons.collectors.refuse,
			...options?.emojis
		};
		const userDiscordIds: string[] = [context.discord!.user];
		if (options?.acceptedUsersId) {
			userDiscordIds.pop();
			for (const id of options.acceptedUsersId) {
				const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, id);
				if (!getUser.isError) {
					userDiscordIds.push(getUser.payload.user.attributes.discordId![0]);
				}
			}
		}

		const row = new ActionRowBuilder<ButtonBuilder>();

		// Create buttons
		const acceptCustomId = "accept";
		const buttonAccept = new ButtonBuilder()
			.setEmoji(parseEmoji(emojis.accept)!)
			.setCustomId(acceptCustomId)
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(buttonAccept);

		const buttonRefuse = new ButtonBuilder()
			.setEmoji(parseEmoji(emojis.refuse)!)
			.setCustomId("refuse")
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(buttonRefuse);

		const sendFunction = reactionCollectorCreationPacket.mainPacket ? interaction.editReply : interaction.channel.send;

		// Edit message
		let msg: Message;
		if (messageContentOrEmbed instanceof CrowniclesEmbed) {
			msg = await sendFunction({
				embeds: [messageContentOrEmbed],
				components: [row]
			}) as Message;
		}
		else {
			msg = await sendFunction({
				content: messageContentOrEmbed,
				components: [row]
			}) as Message;
		}

		// Create a button collector
		const buttonCollector = msg.createMessageComponentCollector({
			time: reactionCollectorCreationPacket.endTime - Date.now()
		});

		// Send an error if someone uses the collector that is not intended for them and stop if it's the owner
		buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (!options?.anyoneCanReact && (!options?.canInitiatorRefuse || buttonInteraction.user.id !== context.discord?.user || buttonInteraction.customId !== "refuse")
				&& !userDiscordIds.find(userDiscordId => userDiscordId === buttonInteraction.user.id)) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, interaction.userLanguage);
				return;
			}

			const getReactingPlayer = await KeycloakUtils.getKeycloakIdFromDiscordId(keycloakConfig, buttonInteraction.user.id, buttonInteraction.user.displayName);
			if (!getReactingPlayer.isError && getReactingPlayer.payload.keycloakId) {
				if (!options?.notDeferReply) {
					await buttonInteraction.deferReply();
				}
				else if (messageContentOrEmbed instanceof CrowniclesEmbed) {
					disableRows([row]);

					await msg.edit({
						embeds: [messageContentOrEmbed],
						components: [row]
					});
				}
				else {
					disableRows([row]);

					await msg.edit({
						content: messageContentOrEmbed,
						components: [row]
					});
				}

				const reactionIndex = buttonInteraction.customId === acceptCustomId
					? options?.indexes?.accept ?? reactionCollectorCreationPacket.reactions.findIndex(reaction => reaction.type === ReactionCollectorAcceptReaction.name)
					: options?.indexes?.refuse ?? reactionCollectorCreationPacket.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name);

				DiscordCollectorUtils.sendReaction(
					reactionCollectorCreationPacket,
					context,
					getReactingPlayer.payload.keycloakId,
					buttonInteraction,
					reactionIndex
				);
			}
			else {
				const listener = DiscordMQTT.packetListener.getListener(RequirementEffectPacket.name);
				if (listener) {
					await listener(context, makePacket(RequirementEffectPacket, {
						remainingTime: -1,
						currentEffectId: Effect.NOT_STARTED.id
					}));
				}
			}
		});

		buttonCollector.on("end", async () => {
			disableRows([row]);

			await msg.edit({ components: [row] });
		});

		return [buttonCollector];
	}

	static async createChoiceListCollector(
		interaction: CrowniclesInteraction,
		{
			packet,
			context
		}: SendingContext,
		{
			embed,
			items
		}: SendingValues,
		options: {
			refuse: {
				can: boolean; reactionIndex?: number;
			};
			additionalButtons?: {
				button: ButtonBuilder;
				text?: string;
				emoji?: string;
			}[];
			sendManners?: SendManner[];
		}
	): Promise<ReactionCollectorReturnTypeOrNull> {
		if (items.length > DiscordCollectorUtils.choiceListEmotes.length) {
			throw "Too many items to display";
		}

		let choiceDesc = "";
		const rows = [new ActionRowBuilder<ButtonBuilder>()];

		// Create buttons
		for (let i = 0; i < items.length; ++i) {
			const button = new ButtonBuilder()
				.setEmoji(parseEmoji(DiscordCollectorUtils.choiceListEmotes[i])!)
				.setCustomId(i.toString())
				.setStyle(ButtonStyle.Secondary);

			if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
				rows.push(new ActionRowBuilder<ButtonBuilder>());
			}
			rows[rows.length - 1].addComponents(button);

			choiceDesc += `${DiscordCollectorUtils.choiceListEmotes[i]} - ${items[i]}\n`;
		}

		if (options.additionalButtons) {
			for (const additionalButton of options.additionalButtons) {
				if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
					rows.push(new ActionRowBuilder<ButtonBuilder>());
				}
				rows[rows.length - 1].addComponents(additionalButton.button);
				if (additionalButton.text && additionalButton.emoji) {
					choiceDesc += `${additionalButton.emoji} - ${additionalButton.text}\n`;
				}
			}
		}

		if (options.refuse.can) {
			const buttonRefuse = new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
				.setCustomId("refuse")
				.setStyle(ButtonStyle.Secondary);

			if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
				rows.push(new ActionRowBuilder<ButtonBuilder>());
			}
			rows[rows.length - 1].addComponents(buttonRefuse);
		}

		// Add a choice description to the embed
		if (embed instanceof CrowniclesEmbed) {
			embed.setDescription((embed.data.description ?? "") + choiceDesc);
		}
		else {
			embed += choiceDesc;
		}

		if (!options.sendManners) {
			options.sendManners = SEND_POLITICS.REPLY_OR_FOLLOWUP; // Default manners
		}

		const sendManner = getSendingManner(interaction, options.sendManners);

		// Edit message
		const reply: Message | InteractionCallbackResponse | null = await MANNER_TO_METHOD[sendManner](interaction)({
			components: rows,
			withResponse: true,
			...embed instanceof CrowniclesEmbed
				? { embeds: [embed] }
				: { content: embed }
		});

		let msg;
		if (reply instanceof InteractionCallbackResponse) {
			msg = reply.resource?.message;
		}
		else {
			msg = reply;
		}

		if (!msg) {
			return null;
		}

		// Create button collector
		const buttonCollector = msg.createMessageComponentCollector({
			time: packet.endTime - Date.now()
		});

		// Send an error if someone uses the collector that is not intended for them and stop if it's the owner
		buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== context.discord?.user) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, interaction.userLanguage);
				return;
			}

			await buttonInteraction.deferReply();
			if (buttonInteraction.customId !== "refuse") {
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, parseInt(buttonInteraction.customId, 10));
			}
			else {
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, options.refuse.reactionIndex!);
			}
		});

		buttonCollector.on("end", async () => {
			disableRows(rows);

			await msg.edit({ components: rows });
		});

		return [buttonCollector];
	}
}
