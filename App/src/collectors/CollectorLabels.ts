import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS,
	DRINK_DATA_KINDS, DRINK_REACTION_KINDS,
	GENERIC_REACTION_KINDS,
	ReactionCollectorData, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";

/**
 * Turns the protocol kinds into what the player reads.
 *
 * Both switches are exhaustive over the discriminated unions, so adding a collector family to
 * `WsPackets` without giving it a wording breaks the build here rather than showing a blank button.
 */

export function collectorTitle(data: ReactionCollectorData): string {
	switch (data.type) {
		case DRINK_DATA_KINDS.COLLECTOR:
			return i18n.t("app:collector.titles.drink");
		case BIG_EVENT_DATA_KINDS.COLLECTOR:
			return i18n.t("app:collector.titles.bigEvent");
		case "unknown":
			return i18n.t("app:collector.titles.unknown");
		default: {
			const unhandled: never = data;
			return unhandled;
		}
	}
}

export function collectorDescription(data: ReactionCollectorData): string | undefined {
	switch (data.type) {
		case BIG_EVENT_DATA_KINDS.COLLECTOR:
			return i18n.t(`events:${data.data.eventId}.text`);
		case DRINK_DATA_KINDS.COLLECTOR:
		case "unknown":
			return undefined;
		default: {
			const unhandled: never = data;
			return unhandled;
		}
	}
}

function eventReactionIcon(eventId: number, possibilityName: string): string | null {
	return AppIcons.getIconOrNull(`events.${eventId}.${possibilityName}`)
		?? AppIcons.getIconOrNull(`events.${eventId}.${possibilityName}.0`);
}

export function reactionLabel(reaction: ReactionCollectorReaction, data: ReactionCollectorData): string {
	switch (reaction.type) {
		case GENERIC_REACTION_KINDS.ACCEPT:
			return i18n.t("app:collector.accept");
		case GENERIC_REACTION_KINDS.REFUSE:
			return i18n.t("app:collector.refuse");
		case DRINK_REACTION_KINDS.POTION:
			return `${AppIcons.getIcon(`potions.${reaction.data.potion.id}`)} ${i18n.t(`models:potions.${reaction.data.potion.id}`)}`;
		case BIG_EVENT_REACTION_KINDS.POSSIBILITY: {
			if (data.type !== BIG_EVENT_DATA_KINDS.COLLECTOR) {
				return i18n.t("app:collector.unknownChoice");
			}
			const eventId = data.data.eventId;
			const possibilityName = reaction.data.name;
			const icon = eventReactionIcon(eventId, possibilityName);
			const label = i18n.t(`events:${eventId}.possibilities.${possibilityName}.text`);
			return icon ? `${icon} ${label}` : label;
		}
		case "unknown":
			return i18n.t("app:collector.unknownChoice");
		default: {
			const unhandled: never = reaction;
			return unhandled;
		}
	}
}

/**
 * A choice the app does not know how to render yet must not be offered: the player would press a
 * button whose effect is unknown to them.
 */
export function isChoosable(reaction: ReactionCollectorReaction): boolean {
	return reaction.type !== "unknown";
}
