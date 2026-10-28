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
	InteractionUpdateOptions,
	Message,
	MessageActionRowComponentBuilder,
	MessageComponentInteraction,
	MessageEditOptions,
	parseEmoji,
	ReactionCollector
} from "discord.js";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { getErrorReason } from "../../../Lib/src/utils/ErrorUtils";
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

/**
 * Ids of the component interaction answering a click, in the context sent to Core
 */
type RespondingComponentIds = Pick<NonNullable<PacketContext["discord"]>, "buttonInteraction" | "stringSelectMenuInteraction">;

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

/**
 * Add a button to the last row, creating a new row if the current one is full (max 5 buttons per row).
 * @param rows - Array of action rows to add the button to
 * @param button - The button to add
 */
export function addButtonToRow(rows: ActionRowBuilder<ButtonBuilder>[], button: ButtonBuilder): void {
	if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
		rows.push(new ActionRowBuilder<ButtonBuilder>());
	}
	rows[rows.length - 1].addComponents(button);
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

	/**
	 * Component interactions whose acknowledgement failed: unless acknowledged another way, Discord accepts no answer to them
	 */
	private static readonly unacknowledgedComponents = new WeakSet<MessageComponentInteraction>();

	/**
	 * Wait for the acknowledgement of a component interaction (deferReply, deferUpdate, update...) without ever throwing.
	 * Discord rejects an acknowledgement sent more than 3 seconds after the click, which happens when the shard lags: the
	 * click must still be forwarded to Core, otherwise the player stays blocked until the collector ends (#5059).
	 * Acknowledge before any other request to Discord, so that the slow requests do not consume the 3 seconds.
	 * @returns whether the interaction was acknowledged
	 */
	static async acknowledgeComponent(interaction: MessageComponentInteraction, acknowledgement: Promise<unknown>): Promise<boolean> {
		try {
			await acknowledgement;
			return true;
		}
		catch (error) {
			DiscordCollectorUtils.unacknowledgedComponents.add(interaction);
			CrowniclesLogger.warn("Component interaction could not be acknowledged, handling the click anyway", {
				customId: interaction.customId,
				reason: getErrorReason(error),
				interactionAgeMs: Date.now() - interaction.createdTimestamp
			});
			return false;
		}
	}

	/**
	 * Edit a message whose update is only cosmetic (e.g. disabling the buttons of a collector), so that a failure of the
	 * edit cannot prevent the click from being forwarded to Core
	 */
	static async editWithoutBlocking(message: Message, options: MessageEditOptions): Promise<void> {
		try {
			await message.edit(options);
		}
		catch (error) {
			CrowniclesLogger.warn("Collector message could not be edited, handling the click anyway", {
				messageId: message.id,
				reason: getErrorReason(error)
			});
		}
	}

	/**
	 * Update the message of a component interaction, falling back to a message edit when the interaction expired, so
	 * that the displayed view always matches the state of the menu
	 * @returns whether the interaction was acknowledged
	 */
	static async updateComponentMessage(interaction: MessageComponentInteraction, options: InteractionUpdateOptions & MessageEditOptions): Promise<boolean> {
		if (await DiscordCollectorUtils.acknowledgeComponent(interaction, interaction.update(options))) {
			return true;
		}
		await DiscordCollectorUtils.editWithoutBlocking(interaction.message, options);
		return false;
	}

	/**
	 * Time left before Core's deadline for the collector, never zero so that discord.js still arms its timer
	 */
	static getRemainingCollectorTime(packet: ReactionCollectorCreationPacket): number {
		return Math.max(packet.endTime - Date.now(), DiscordConstants.MIN_COLLECTOR_TIME);
	}

	/**
	 * Create a collector that only follows the lifetime of the Core reaction collector, for menus handling their components
	 * with their own collectors. Core's stop packet ends it and Core's timer resets push its deadline back, but its own
	 * deadline still ends it when the stop packet is lost, so the collectors cache releases it and the menus it captures
	 */
	static createCoreLifecycleCollector(message: Message, packet: ReactionCollectorCreationPacket): ReactionCollector {
		return message.createReactionCollector({
			time: DiscordCollectorUtils.getRemainingCollectorTime(packet)
		});
	}

	/**
	 * Add a button to the last row, creating a new row if the current one is full.
	 */
	static addButtonToRow(rows: ActionRowBuilder<ButtonBuilder>[], button: ButtonBuilder): void {
		addButtonToRow(rows, button);
	}

	/**
	 * Whether the acknowledgement of the interaction failed and it was not acknowledged another way (a concurrent
	 * acknowledgement of the same click fails with "already acknowledged" but leaves it answerable)
	 */
	private static isUnanswerable(component: MessageComponentInteraction): boolean {
		return DiscordCollectorUtils.unacknowledgedComponents.has(component) && !component.deferred && !component.replied;
	}

	/**
	 * Cache the component interaction through which Core's response to a click is displayed, and return its id for the
	 * packet context. An interaction whose acknowledgement failed (expired, Discord unavailable...) can no longer be answered:
	 * it is left out, so that the response falls back to the command interaction
	 */
	private static cacheRespondingComponent(component: MessageComponentInteraction | null): RespondingComponentIds {
		if (!component || DiscordCollectorUtils.isUnanswerable(component)) {
			return {};
		}
		if (component.isButton()) {
			DiscordCache.cacheButtonInteraction(component);
			return { buttonInteraction: component.id };
		}
		if (component.isStringSelectMenu()) {
			DiscordCache.cacheStringSelectMenuInteraction(component);
			return { stringSelectMenuInteraction: component.id };
		}
		return {};
	}

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

		PacketUtils.sendPacketToBackend({
			frontEndOrigin: PacketConstants.FRONT_END_ORIGINS.DISCORD,
			frontEndSubOrigin: context.frontEndSubOrigin,
			keycloakId: userKeycloakId,
			discord: {
				user: context.discord!.user,
				channel: context.discord!.channel,
				interaction: context.discord!.interaction,
				...DiscordCollectorUtils.cacheRespondingComponent(component),
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
					await DiscordCollectorUtils.acknowledgeComponent(buttonInteraction, buttonInteraction.deferReply());
				}
				else {
					disableRows([row]);

					await DiscordCollectorUtils.editWithoutBlocking(msg, {
						...messageContentOrEmbed instanceof CrowniclesEmbed
							? { embeds: [messageContentOrEmbed] }
							: { content: messageContentOrEmbed },
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
			deferUpdate?: boolean;
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

			DiscordCollectorUtils.addButtonToRow(rows, button);

			choiceDesc += `${DiscordCollectorUtils.choiceListEmotes[i]} - ${items[i]}\n`;
		}

		if (options.additionalButtons) {
			for (const additionalButton of options.additionalButtons) {
				DiscordCollectorUtils.addButtonToRow(rows, additionalButton.button);
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

			DiscordCollectorUtils.addButtonToRow(rows, buttonRefuse);
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

			await DiscordCollectorUtils.acknowledgeComponent(
				buttonInteraction,
				options.deferUpdate ? buttonInteraction.deferUpdate() : buttonInteraction.deferReply()
			);
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
