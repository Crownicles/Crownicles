import { Language } from "../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { SmallEventWitchResultPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import { Effect } from "../../../Lib/src/types/Effect";
import { WitchActionOutcomeType } from "../../../Lib/src/types/WitchActionOutcomeType";
import i18n from "../translations/i18n";
import { StringUtils } from "../utils/StringUtils";

/**
 * Check if the packet represents an occupied effect with a time penalty
 * @param packet
 */
function hasOccupiedTimePenalty(packet: SmallEventWitchResultPacket): boolean {
	const effectApplied = packet.forceEffect || packet.outcome === WitchActionOutcomeType.EFFECT;
	return effectApplied && packet.effectId === Effect.OCCUPIED.id && packet.timeLost > 0;
}

/**
 * Build the time penalty outro text for OCCUPIED effects with time loss
 * @param packet
 * @param lng
 */
function buildTimeOutro(packet: SmallEventWitchResultPacket, lng: Language): string {
	if (!hasOccupiedTimePenalty(packet)) {
		return "";
	}
	return ` ${StringUtils.getRandomTranslation("smallEvents:witch.witchEventResults.outcomes.2.time", lng, {
		lostTime: packet.timeLost,
		lostTimeDisplay: i18n.formatDuration(packet.timeLost, lng)
	})}`;
}

/**
 * Check if the forced effect emoji should be displayed
 * @param packet
 */
function shouldShowForcedEffectEmoji(packet: SmallEventWitchResultPacket): boolean {
	return packet.forceEffect && packet.outcome !== WitchActionOutcomeType.EFFECT && packet.effectId !== Effect.OCCUPIED.id;
}

/**
 * Build the effect emoji for actions that always apply an alteration even without an EFFECT outcome
 * @param packet
 */
function buildForcedEffectEmoji(packet: SmallEventWitchResultPacket): string {
	if (!shouldShowForcedEffectEmoji(packet)) {
		return "";
	}
	return ` ${CrowniclesIcons.effects[packet.effectId]}`;
}

/**
 * Build the full description text for the witch result embed
 * @param packet
 * @param lng
 */
export function buildWitchResultDescription(packet: SmallEventWitchResultPacket, lng: Language): string {
	const introToLoad = packet.isIngredient ? "smallEvents:witch.witchEventResults.ingredientIntros" : "smallEvents:witch.witchEventResults.adviceIntros";
	const outcomeTranslationToLoad = packet.outcome === WitchActionOutcomeType.EFFECT
		? `smallEvents:witch.witchEventResults.outcomes.2.${packet.effectId}`
		: `smallEvents:witch.witchEventResults.outcomes.${packet.outcome + 1}`;
	return `${StringUtils.getRandomTranslation(introToLoad, lng, {
		witchEvent: `${i18n.t(`smallEvents:witch.witchEventNames.${packet.ingredientId}`, { lng })} ${CrowniclesIcons.witchSmallEvent[packet.ingredientId]}`
			.toLowerCase()
	})} ${StringUtils.getRandomTranslation(outcomeTranslationToLoad, lng, { lifeLoss: packet.lifeLoss })}${buildTimeOutro(packet, lng)}${buildForcedEffectEmoji(packet)}`;
}
