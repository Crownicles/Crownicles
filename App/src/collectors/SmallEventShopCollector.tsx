import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	GENERIC_REACTION_KINDS, ReactionCollectorData, SMALL_EVENT_DATA_KINDS
} from "ws-packets/src/fromServer/collectors";
import {formatMoney} from "@/src/display/Amounts";
import {collectorDescription, collectorTitle, itemDisplayName} from "@/src/collectors/CollectorLabels";
import {Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton, Figures, Standing} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Check} from "@/src/design/FightIcons";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const MERCHANT_EMBLEM_SIZE = 34;

type ShopSmallEventData = Extract<ReactionCollectorData, {
	type: typeof SMALL_EVENT_DATA_KINDS.SHOP | typeof SMALL_EVENT_DATA_KINDS.EPIC_SHOP;
}>;

function itemFigures(data: ShopSmallEventData): {caption: string; value: string; unit?: string}[] {
	return [
		{caption: i18n.t("app:collector.shop.fields.rarity"), value: i18n.t(`items:raritiesWithoutEmote.${data.data.item.rarity}`)},
		...("itemLevel" in data.data.item ? [{caption: i18n.t("app:collector.shop.fields.level"), value: String(data.data.item.itemLevel)}] : []),
		{caption: i18n.t("app:collector.shop.fields.price"), value: formatMoney(data.data.price), unit: "money"}
	];
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
	const emblem = AppIcons.getIconOrNull(data.type === SMALL_EVENT_DATA_KINDS.EPIC_SHOP ? "smallEvents.epicItemShop" : "smallEvents.shop");

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:collector.refuse")} onClose={leave} />
				<Standing
					{...emblem ? {emblem: <TwemojiIcon emoji={emblem} size={MERCHANT_EMBLEM_SIZE} />} : {}}
					caption={i18n.t("app:adventure.smallEvent.eyebrow")}
					title={collectorTitle(data)}
					subtitle={collectorDescription(data)}
				/>
				<Figures items={itemFigures(data)} />
				{data.type === SMALL_EVENT_DATA_KINDS.EPIC_SHOP && data.data.tip ? <Note>{i18n.t("app:collector.shop.tip")}</Note> : null}
				<ActionBanner
					icon={Check}
					label={i18n.t("app:city.shop.buy", {item: itemDisplayName(data.data.item), price: formatMoney(data.data.price)})}
					pending={locked}
					onPress={(): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT))}
				/>
			</Screen>
		</SwipeBack>
	);
}
