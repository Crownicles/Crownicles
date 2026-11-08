import {
	Effect, EFFECT_TONES
} from "@/src/design/Sections";
import { formatNumber } from "@/src/display/Amounts";

/** A change of a counter, signed so the player reads a gain or a loss rather than a bare number. */
export function signedAmount(amount: number): Effect["value"] {
	return amount > 0 ? `+${formatNumber(amount)}` : formatNumber(amount);
}

/** The emoji a counter wears when it goes up, and the one it may wear instead when it goes down. */
type AmountUnits = {
	gain?: Effect["unit"]; loss?: Effect["unit"];
};

/** A counter that went up or down, or nothing when it did not move. Losses may wear their own emoji. */
export function amountEffect(label: Effect["label"], amount: number, units: AmountUnits = {}): Effect | null {
	if (amount === 0) {
		return null;
	}
	const gained = amount > 0;
	const unit = gained ? units.gain : units.loss ?? units.gain;
	return {
		label,
		value: signedAmount(amount),
		tone: gained ? EFFECT_TONES.GAIN : EFFECT_TONES.LOSS,
		...unit ? { unit } : {}
	};
}

/** A counter the event took away, given as a positive quantity. */
export function lostAmountEffect(label: Effect["label"], lost: number, unit?: Effect["unit"]): Effect | null {
	return amountEffect(label, -lost, unit ? { gain: unit } : {});
}

type EffectLook = { unit: string } | { emoji: string } | Record<string, never>;

export function gainEffect(label: Effect["label"], value: Effect["value"], look: EffectLook = {}): Effect {
	return {
		label, value, tone: EFFECT_TONES.GAIN, ...look
	};
}

export function lossEffect(label: Effect["label"], value: Effect["value"], look: EffectLook = {}): Effect {
	return {
		label, value, tone: EFFECT_TONES.LOSS, ...look
	};
}

export function infoEffect(label: Effect["label"], value: Effect["value"], look: EffectLook = {}): Effect {
	return {
		label, value, tone: EFFECT_TONES.NEUTRAL, ...look
	};
}

export function presentEffects(effects: (Effect | null)[]): Effect[] {
	return effects.filter((effect): effect is Effect => effect !== null);
}
