import {ReactionCollectorData, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors/families/GenericReactions";
import {DRINK_DATA_KINDS, DRINK_REACTION_KINDS} from "ws-packets/src/fromServer/collectors/families/DrinkCollector";
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
		case "unknown":
			return i18n.t("app:collector.titles.unknown");
		default: {
			const unhandled: never = data;
			return unhandled;
		}
	}
}

export function reactionLabel(reaction: ReactionCollectorReaction): string {
	switch (reaction.type) {
		case GENERIC_REACTION_KINDS.ACCEPT:
			return i18n.t("app:collector.accept");
		case GENERIC_REACTION_KINDS.REFUSE:
			return i18n.t("app:collector.refuse");
		case DRINK_REACTION_KINDS.POTION:
			return `${AppIcons.getIcon(`potions.${reaction.data.potion.id}`)} ${i18n.t(`models:potions.${reaction.data.potion.id}`)}`;
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
