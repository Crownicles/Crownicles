import {Fragment, ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SHOP_DATA_KINDS, SHOP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {isChoosable} from "@/src/collectors/CollectorLabels";
import {shopItemName} from "@/src/collectors/ShopLabels";
import {Hero, KeyValue, Note, Panel, Row, Screen, SectionHeader} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type ShopCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

type ShopItemReaction = Extract<ReactionCollectorCreation["reactions"][number], {type: typeof SHOP_REACTION_KINDS.ITEM}>;

function currencyIcon(currency: "money" | "gem"): string {
	return AppIcons.getIcon(`unitValues.${currency}`);
}

function currencyLabel(value: number, currency: "money" | "gem"): string {
	return `${value.toLocaleString("fr-FR")} ${currencyIcon(currency)}`;
}

function categoryLabel(categoryId: string, count: number): string {
	return i18n.t(`commands:shop.shopCategories.${categoryId}`, {count});
}

function shopItemSubtitle(amount: number, price: number, currency: "money" | "gem"): string {
	return i18n.t("app:city.shop.itemDetails", {
		amount,
		price: currencyLabel(price, currency)
	});
}

type ShopGroup = {reaction: ShopItemReaction; index: number};
type AdditionalShopData = {remainingPotions?: number; remainingTokens?: number};

function groupShopReactions(collector: ReactionCollectorCreation): Map<string, ShopGroup[]> {
	const groups = new Map<string, ShopGroup[]>();
	collector.reactions.forEach((reaction, index) => {
		if (reaction.type !== SHOP_REACTION_KINDS.ITEM) return;
		const current = groups.get(reaction.data.shopCategoryId) ?? [];
		current.push({reaction, index});
		groups.set(reaction.data.shopCategoryId, current);
	});
	return groups;
}

function stockNote(additionalShopData: AdditionalShopData | undefined): string | undefined {
	if (additionalShopData?.remainingPotions !== undefined) return i18n.t("app:city.shop.remainingPotions", {count: additionalShopData.remainingPotions});
	return additionalShopData?.remainingTokens !== undefined ? i18n.t("app:city.shop.remainingTokens", {count: additionalShopData.remainingTokens}) : undefined;
}

function ShopGroups({groups, collector, currency, locked, choose}: {groups: Map<string, ShopGroup[]>; collector: ReactionCollectorCreation; currency: "money" | "gem"; locked: boolean; choose: (index: number) => void}): ReactNode {
	return [...groups.entries()].map(([categoryId, entries], index) => (
		<Fragment key={categoryId}>
			<SectionHeader first={index === 0}>{categoryLabel(categoryId, entries.length)}</SectionHeader>
			<Panel>{entries.map(({reaction, index: reactionIndex}) => {
				const choosable = isChoosable(reaction, collector.data);
				const disabled = locked || !choosable;
				return <Row key={`${collector.id}-${reactionIndex}`} disabled={disabled} onPress={disabled ? undefined : (): void => choose(reactionIndex)} title={shopItemName({shopItemId: reaction.data.shopItemId})} subtitle={shopItemSubtitle(reaction.data.amount, reaction.data.price, currency)} end={currencyLabel(reaction.data.price, currency)} chevron={!disabled} />;
			})}</Panel>
		</Fragment>
	));
}

export function ShopCollector({collector, onChoose, submitting}: ShopCollectorProps): ReactNode {
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== SHOP_DATA_KINDS.COLLECTOR) {
		return null;
	}

	const {currency, availableCurrency, additionalShopData} = collector.data.data;
	const locked = answered || submitting;
	const groups = groupShopReactions(collector);

	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};

	const note = stockNote(additionalShopData);
	const closeIndex = collector.reactions.findIndex(reaction => reaction.type === SHOP_REACTION_KINDS.CLOSE);

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:city.shop.eyebrow")}
				title={`${currencyIcon(currency)} ${i18n.t("app:city.shop.title")}`}
				subtitle={i18n.t("app:city.shop.description")}
			/>
			<Panel>
				<KeyValue label={i18n.t("app:city.shop.availableCurrency")} value={currencyLabel(availableCurrency, currency)} />
			</Panel>
			{note ? <Note>{note}</Note> : null}
			<ShopGroups groups={groups} collector={collector} currency={currency} locked={locked} choose={choose} />
			{closeIndex >= 0 ? (
				<Panel>
					<Row
						disabled={locked}
						onPress={locked ? undefined : (): void => choose(closeIndex)}
						title={i18n.t("app:city.shop.close")}
						tone="danger"
						chevron={!locked}
					/>
				</Panel>
			) : null}
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Screen>
	);
}
