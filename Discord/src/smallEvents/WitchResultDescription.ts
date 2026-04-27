import { Language } from "../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { SmallEventWitchResultPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import { Effect } from "../../../Lib/src/types/Effect";
import { WitchActionOutcomeType } from "../../../Lib/src/types/WitchActionOutcomeType";
import i18n from "../translations/i18n";
import { StringUtils } from "../utils/StringUtils";

/**
 * Build the time penalty outro text for OCCUPIED effects with time loss
 * @param packet
 * @param lng
 */
function buildTimeOutro(packet: SmallEventWitchResultPacket, lng: Language): string {
	const effectApplied = packet.forceEffect || packet.outcome === WitchActionOutcomeType.EFFECT;
	if (!effectApplied || packet.effectId !== Effect.OCCUPIED.id || !packet.timeLost || packet.timeLost <= 0) {
		return "";
	}
	return ` ${StringUtils.getRandomTranslation("smallEvents:witch.witchEventResults.outcomes.2.time", lng, {
		lostTime: packet.timeLost,
		lostTimeDisplay: i18n.formatDuration(packet.timeLost, lng)
	})}`;
}

/**
 * Build the effect emoji for actions that always apply an alteration even without an EFFECT outcome
 * @param packet
 */
function buildForcedEffectEmoji(packet: SmallEventWitchResultPacket): string {
	if (!packet.forceEffect || packet.outcome === WitchActionOutcomeType.EFFECT || packet.effectId === Effect.OCCUPIED.id) {
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
