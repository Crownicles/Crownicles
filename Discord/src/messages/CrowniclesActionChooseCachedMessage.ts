import { CrowniclesCachedMessage } from "./CrowniclesCachedMessage";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { crowniclesClient } from "../bot/CrowniclesShard";
import { CrowniclesEmbed } from "./CrowniclesEmbed";
import i18n from "../translations/i18n";
import {
	ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, InteractionCollector, Message,
	parseEmoji
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
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { Language } from "../../../Lib/src/Language";
import { Millisecond } from "../../../Lib/src/types/TimeTypes";

function errorReason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Acknowledge the click and disable the action buttons; failures are only logged so the chosen action still reaches Core.
 * The buttons are disabled through a message edit rather than the interaction response, so that this edit shares the REST
 * queue of every later edit of this message and is sent before the next turn display. Discord can still persist an older
 * edit over a later one: watchDisplayedTurn repairs the turn when that happens (#5046).
 */
async function acknowledgeActionClick(buttonInteraction: ButtonInteraction, rows: ActionRowBuilder<ButtonBuilder>[]): Promise<void> {
	try {
		await buttonInteraction.deferUpdate();
	}
	catch (error) {
		CrowniclesLogger.warn("Fight action choice could not be acknowledged, sending it anyway", {
			reason: errorReason(error),
			interactionAgeMs: Date.now() - buttonInteraction.createdTimestamp
		});
	}
	try {
		await buttonInteraction.message.edit({ components: rows });
	}
	catch (error) {
		CrowniclesLogger.warn("Fight action buttons could not be disabled, sending the choice anyway", {
			reason: errorReason(error)
		});
	}
}

/**
 * One button per available fight action, wrapped onto new rows when a row is full
 */
function buildActionRows(actions: ReactionCollectorFightChooseActionReaction[]): ActionRowBuilder<ButtonBuilder>[] {
	const rows = [new ActionRowBuilder<ButtonBuilder>()];
	for (const action of actions) {
		if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
			rows.push(new ActionRowBuilder<ButtonBuilder>());
		}
		rows[rows.length - 1].addComponents(new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.fightActions[action.id])!)
			.setCustomId(action.id)
			.setStyle(ButtonStyle.Secondary));
	}
	return rows;
}

/**
 * Progress of one turn of the fighter, shared by the click handler and the checks of the displayed turn
 */
type ActionTurnState = {
	actionSent: boolean;
};

/**
 * Action buttons displayed to the fighter for one turn
 */
type DisplayedActionChoice = {
	packet: ReactionCollectorFightChooseActionPacket;
	context: PacketContext;
	actions: ReactionCollectorFightChooseActionReaction[];
	rows: ActionRowBuilder<ButtonBuilder>[];
	lng: Language;
	turn: ActionTurnState;
};

/**
 * Turn displayed on the action message, and what is needed to display it again
 */
type DisplayedTurn = {
	message: Message;

	// Serialized when the turn is displayed, as the click disables the buttons of the same builders
	display: BaseMessageOptions;
	collector: InteractionCollector<ButtonInteraction>;
	turn: ActionTurnState;
};

/**
 * What the fighter sees of the action message: its text and the state of each button
 */
function displayedState(message: Message): string {
	return JSON.stringify({
		description: message.embeds[0]?.description ?? null,
		buttons: message.components
			.flatMap(row => row.type === ComponentType.ActionRow ? row.components : [])
			.map(component => [component.customId, component.disabled])
	});
}

function isTurnOver(displayedTurn: DisplayedTurn): boolean {
	return displayedTurn.turn.actionSent || displayedTurn.collector.ended;
}

/**
 * Read the action message back from Discord and display the turn again if an older state of the message was written over it.
 * Discord can persist an edit of a message after the following one, even though both requests completed in order: the
 * "opponent is choosing" display then replaced the turn of the fighter, whose disabled buttons made them lose by inactivity.
 */
async function checkDisplayedTurn(displayedTurn: DisplayedTurn, expectedState: string, checkDelay: Millisecond): Promise<void> {
	if (isTurnOver(displayedTurn)) {
		return;
	}
	const storedState = displayedState(await displayedTurn.message.fetch(true));
	if (storedState === expectedState || isTurnOver(displayedTurn)) {
		return;
	}
	CrowniclesLogger.warn("Discord replaced the fight action message with an older state, displaying the turn again", {
		messageId: displayedTurn.message.id,
		checkDelayMs: checkDelay,
		storedState
	});
	await displayedTurn.message.edit(displayedTurn.display);
}

function watchDisplayedTurn(displayedTurn: DisplayedTurn): void {
	const expectedState = displayedState(displayedTurn.message);
	for (const checkDelay of DiscordConstants.FIGHT_ACTION_DISPLAY_CHECK_DELAYS) {
		setTimeout(() => {
			checkDisplayedTurn(displayedTurn, expectedState, checkDelay).catch(error => {
				CrowniclesLogger.warn("Fight action message could not be checked", {
					reason: errorReason(error)
				});
			});
		}, checkDelay);
	}
}

/**
 * Collect handler forwarding the first click of the fighter to Core
 */
function createActionClickHandler(choice: DisplayedActionChoice): (buttonInteraction: ButtonInteraction) => Promise<void> {
	const {
		packet, context, actions, rows, lng, turn
	} = choice;
	return async (buttonInteraction: ButtonInteraction): Promise<void> => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		// Clicks queued while the shard was lagging: only the first one is the chosen action
		if (turn.actionSent) {
			await buttonInteraction.deferUpdate().catch(() => null);
			return;
		}
		turn.actionSent = true;

		disableRows(rows);
		await acknowledgeActionClick(buttonInteraction, rows);
		const reactionIndex = actions.findIndex(action => action.id === buttonInteraction.customId);
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	};
}

export class CrowniclesActionChooseCachedMessage extends CrowniclesCachedMessage<ReactionCollectorFightChooseActionPacket> {
	private usernameCache?: string;

	readonly duration = 30;

	get type(): string {
		return "action_choose";
	}

	updateMessage = async (packet: ReactionCollectorFightChooseActionPacket, context: PacketContext): Promise<ReactionCollectorReturnTypeOrNull> => {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const data = packet.data.data;
		const lng = interaction?.userLanguage ?? context.discord!.language;
		const user = interaction?.user ?? await crowniclesClient.users.fetch(context.discord!.user);
		if (!this.usernameCache) {
			this.usernameCache = await DisplayUtils.getEscapedUsername(data.fighterKeycloakId, lng);
		}
		const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:fight.fightActionChoose.turnIndicationTitle", {
			lng,
			pseudo: this.usernameCache
		}), user)
			.setDescription(i18n.t("commands:fight.fightActionChoose.turnIndicationDescription", { lng }));
		const actions = packet.reactions.map(reaction => reaction.data as ReactionCollectorFightChooseActionReaction);
		const rows = buildActionRows(actions);
		const options = {
			embeds: [embed],
			components: rows
		};
		const msg = await this.post(options, context.discord!.channel);
		if (!msg) {
			return null;
		}
		const buttonCollector = msg.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: packet.endTime - Date.now()
		});
		const turn: ActionTurnState = { actionSent: false };
		buttonCollector.on("collect", createActionClickHandler({
			packet,
			context,
			actions,
			rows,
			lng,
			turn
		}));
		watchDisplayedTurn({
			message: msg,
			display: {
				embeds: options.embeds.map(turnEmbed => turnEmbed.toJSON()),
				components: options.components.map(row => row.toJSON())
			},
			collector: buttonCollector,
			turn
		});
		return [buttonCollector];
	};
}
