import { ReactNode } from "react";
import {
	CITY_REACTION_KINDS, CityMobileRecycleItem, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { AppIcons } from "@/src/AppIcons";
import type { RowConfirm } from "@/src/collectors/CityRows";
import {
	CircleAlert, Hammer
} from "@/src/design/FightIcons";
import {
	Effect, EFFECT_TONES, Effects
} from "@/src/design/Sections";
import {
	AMOUNT_UNITS, formatNumber
} from "@/src/display/Amounts";
import { i18n } from "@/src/translations/i18n";

type RecycledMaterial = {
	materialId: number; quantity: number;
};

/** The equipment a recycle reaction dismantles, as the scrap dealer priced it. */
export function recycleForReaction(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): CityMobileRecycleItem | undefined {
	if (reaction.type !== CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE) {
		return undefined;
	}
	const data = reaction.data as {
		slot?: number; itemCategory?: number;
	};
	return snapshot?.scrapDealer?.recyclableItems.find(item => item.slot === data.slot && item.itemCategory === data.itemCategory);
}

export function materialUnits(materials: RecycledMaterial[]): number {
	return materials.reduce((total, material) => total + material.quantity, 0);
}

/** Materials first, which are what dismantling is for, then the coins Gorim pays for the scraps. */
export function recoveredEffects(materials: RecycledMaterial[], money: number): Effect[] {
	return [
		...materials.map(material => ({
			label: i18n.t(`models:materials.${material.materialId}`), value: `+${formatNumber(material.quantity)}`, tone: EFFECT_TONES.GAIN, emoji: AppIcons.getIcon(`materials.${material.materialId}`)
		})),
		...money > 0
			? [
				{
					label: i18n.t("app:profile.fields.money"), value: `+${formatNumber(money)}`, tone: EFFECT_TONES.GAIN, unit: AMOUNT_UNITS.MONEY
				}
			]
			: []
	];
}

export function cityRecycleDetails(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): ReactNode {
	const recycle = recycleForReaction(reaction, snapshot);
	return recycle ? <Effects items={recoveredEffects(recycle.recoveredMaterials, recycle.recoveredMoney)} /> : null;
}

export function cityRecycleConfirm(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): RowConfirm | undefined {
	return recycleForReaction(reaction, snapshot)
		? {
			icon: Hammer,
			label: i18n.t("app:city.scrap.dismantle"),
			hint: {
				reason: i18n.t("app:city.scrap.definitive"), icon: CircleAlert
			}
		}
		: undefined;
}
