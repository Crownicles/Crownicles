import {ReactNode, useState} from "react";
import {StyleSheet, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	GENERIC_REACTION_KINDS, ReactionCollectorData, SMALL_EVENT_DATA_KINDS
} from "ws-packets/src/fromServer/collectors";
import {formatNumber} from "@/src/display/Amounts";
import {collectorDescription, eventPromptIcon, itemDisplayName} from "@/src/collectors/CollectorLabels";
import {EventJournal} from "@/src/collectors/EventOutcomeScreen";
import {Button, Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton, Figures} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {Check} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	actions: {marginTop: Theme.spacing.xl, gap: Theme.spacing.sm}
});

type ShopSmallEventData = Extract<ReactionCollectorData, {
	type: typeof SMALL_EVENT_DATA_KINDS.SHOP | typeof SMALL_EVENT_DATA_KINDS.EPIC_SHOP;
}>;

function itemFigures(data: ShopSmallEventData): {caption: string; value: string; unit?: string}[] {
	return [
		{caption: i18n.t("app:collector.shop.fields.rarity"), value: i18n.t(`items:raritiesWithoutEmote.${data.data.item.rarity}`)},
		...("itemLevel" in data.data.item ? [{caption: i18n.t("app:collector.shop.fields.level"), value: String(data.data.item.itemLevel)}] : []),
		{caption: i18n.t("app:collector.shop.fields.price"), value: formatNumber(data.data.price), unit: "money"}
	];
}

/** Buying or walking on, the same way for every travelling merchant. */
export function MerchantOfferActions({item, locked, onBuy, onLeave}: {
	item: string;
	locked: boolean;
	onBuy: () => void;
	onLeave: () => void;
}): ReactNode {
	return <View style={styles.actions}>
		<ActionBanner icon={Check} label={i18n.t("app:city.shop.buyItem", {item})} pending={locked} onPress={onBuy} />
		<Button disabled={locked} onPress={onLeave}>{i18n.t("app:collector.shop.refuse")}</Button>
	</View>;
}

/** A travelling merchant has one thing to sell, so the offer itself is the screen. */
export function SmallEventShopCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.SHOP
		&& collector.data.type !== SMALL_EVENT_DATA_KINDS.EPIC_SHOP) {
		return null;
	}
	const data = collector.data;
	const locked = answered || submitting;
	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};
	const leave = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:collector.refuse")} onClose={leave} />
				<EventJournal emoji={eventPromptIcon(data)} story={collectorDescription(data) ?? ""} />
				<Figures items={itemFigures(data)} />
				<MerchantOfferActions
					item={itemDisplayName(data.data.item)}
					locked={locked}
					onBuy={(): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT))}
					onLeave={leave}
				/>
			</Screen>
		</SwipeBack>
	);
}
