import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	ReactionCollectorData, SMALL_EVENT_DATA_KINDS
} from "ws-packets/src/fromServer/collectors";
import {formatMoney} from "@/src/display/Amounts";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {
	collectorDescription, collectorTitle, itemDisplayName
} from "@/src/collectors/CollectorLabels";
import {Hero, KeyValue, Notice, Panel, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type ShopSmallEventData = Extract<ReactionCollectorData, {
	type: typeof SMALL_EVENT_DATA_KINDS.SHOP | typeof SMALL_EVENT_DATA_KINDS.EPIC_SHOP;
}>;

function ItemLevel({data}: {data: ShopSmallEventData}): ReactNode {
	return "itemLevel" in data.data.item
		? <KeyValue label={i18n.t("app:collector.shop.fields.level")} value={String(data.data.item.itemLevel)} />
		: null;
}

export function SmallEventShopCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.SHOP
		&& collector.data.type !== SMALL_EVENT_DATA_KINDS.EPIC_SHOP) {
		return null;
	}
	const data = collector.data;
	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.smallEvent.eyebrow")}
				title={collectorTitle(data)}
				subtitle={collectorDescription(data)}
			/>
			<Panel>
				<KeyValue label={i18n.t("app:collector.shop.fields.item")} value={itemDisplayName(data.data.item)} />
				<KeyValue label={i18n.t("app:collector.shop.fields.rarity")} value={i18n.t(`items:raritiesWithoutEmote.${data.data.item.rarity}`)} />
				<ItemLevel data={data} />
				<KeyValue label={i18n.t("app:collector.shop.fields.price")} value={formatMoney(data.data.price)} />
			</Panel>
			{data.type === SMALL_EVENT_DATA_KINDS.EPIC_SHOP && data.data.tip
				? <Notice title={i18n.t("app:collector.shop.tip")} />
				: null}
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</Screen>
	);
}