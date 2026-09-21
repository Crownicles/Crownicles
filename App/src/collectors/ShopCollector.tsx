import {Fragment, ReactNode, useState} from "react";
import {Text} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SHOP_DATA_KINDS, SHOP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {AmountUnit, formatAmount, formatNumber} from "@/src/display/Amounts";
import {plainStory} from "@/src/display/Markdown";
import {isChoosable} from "@/src/collectors/CollectorLabels";
import {compactCityDescription} from "@/src/collectors/CityText";
import {shopItemKey, shopItemName} from "@/src/collectors/ShopLabels";
import {Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {Check, Coins} from "@/src/design/FightIcons";
import {
	ActionBanner, BackButton, ExpandableEntry, ExpandableList, Figures, Lock, LockHint, sectionStyles, Standing
} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

const SHOP_EMBLEM_SIZE = 34;

type ShopCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

type ShopItemReaction = Extract<ReactionCollectorCreation["reactions"][number], {type: typeof SHOP_REACTION_KINDS.ITEM}>;
type ShopGroup = {reaction: ShopItemReaction; index: number};
type AdditionalShopData = {remainingPotions?: number; remainingTokens?: number; gemToMoneyRatio?: number; thousandPoints?: number};

function currencyLabel(value: number, currency: AmountUnit): string {
	return formatAmount(value, currency);
}

function categoryLabel(categoryId: string, count: number): string {
	return plainStory(i18n.t(`commands:shop.shopCategories.${categoryId}`, {count}));
}

/** A commerce is named after itself when the server says which one the player walked into. */
function shopHeading(shopId: string | undefined): {emblem: string | null; title: string; subtitle: string} {
	if (!shopId) {
		return {emblem: null, title: i18n.t("app:city.shop.title"), subtitle: i18n.t("app:city.shop.description")};
	}
	return {
		emblem: AppIcons.getIconOrNull(`city.shops.${shopId}`),
		title: plainStory(i18n.t(`commands:report.city.shops.${shopId}.label`)),
		subtitle: compactCityDescription(plainStory(i18n.t(`commands:report.city.shops.${shopId}.description`)))
	};
}

/** What the purchase actually does, written the way the confirmation screen says it elsewhere. */
function shopItemInfo(shopItemId: number, additionalShopData: AdditionalShopData | undefined): string {
	return plainStory(i18n.t(`commands:shop.shopItems.${shopItemKey({shopItemId})}.info`, {
		kingsMoneyAmount: additionalShopData?.gemToMoneyRatio ?? 0,
		thousandPoints: additionalShopData?.thousandPoints ?? 0
	}));
}

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

type ShopListProps = {
	groups: Map<string, ShopGroup[]>;
	collector: ReactionCollectorCreation;
	currency: AmountUnit;
	availableCurrency: number;
	additionalShopData: AdditionalShopData | undefined;
	locked: boolean;
	choose: (index: number) => void;
};

function ShopItem({entry, props, expansion}: {entry: ShopGroup; props: ShopListProps; expansion: {openKey: number | undefined; onOpen: (key: number | undefined) => void}}): ReactNode {
	const {collector, currency, availableCurrency, additionalShopData, locked, choose} = props;
	const {reaction, index} = entry;
	const tooExpensive = reaction.data.price > availableCurrency;
	const lock: Lock | undefined = tooExpensive
		? {reason: i18n.t("app:city.locks.missingMoney", {amount: currencyLabel(reaction.data.price - availableCurrency, currency)}), icon: Coins}
		: undefined;
	const choosable = isChoosable(reaction, collector.data) && !tooExpensive;
	const expanded = expansion.openKey === index;
	const quantity = reaction.data.amount > 1 ? i18n.t("app:city.shop.quantity", {amount: reaction.data.amount}) : undefined;
	return <ExpandableEntry
		label={shopItemName({shopItemId: reaction.data.shopItemId})}
		caption={lock && !expanded ? <LockHint lock={lock} /> : quantity}
		end={<Text style={sectionStyles.caption}>{currencyLabel(reaction.data.price, currency)}</Text>}
		dimmed={locked || !choosable}
		expanded={expanded}
		onToggle={(): void => expansion.onOpen(expanded ? undefined : index)}
	>
		<Text style={sectionStyles.caption}>{shopItemInfo(reaction.data.shopItemId, additionalShopData)}</Text>
		<ActionBanner
			icon={Check}
			label={i18n.t("app:collector.accept")}
			pending={locked}
			onPress={(): void => choose(index)}
			{...lock ? {lock} : {}}
		/>
	</ExpandableEntry>;
}

function ShopGroups(props: ShopListProps): ReactNode {
	const [openKey, onOpen] = useState<number>();
	return [...props.groups.entries()].map(([categoryId, entries], index) => (
		<Fragment key={categoryId}>
			<SectionHeader first={index === 0}>{categoryLabel(categoryId, entries.length)}</SectionHeader>
			<ExpandableList>{entries.map(entry => <ShopItem key={entry.index} entry={entry} props={props} expansion={{openKey, onOpen}} />)}</ExpandableList>
		</Fragment>
	));
}

export function ShopCollector({collector, onChoose, submitting}: ShopCollectorProps): ReactNode {
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== SHOP_DATA_KINDS.COLLECTOR) {
		return null;
	}

	const {
		currency, availableCurrency, additionalShopData, shopId
	} = collector.data.data;
	const locked = answered || submitting;
	const note = stockNote(additionalShopData);
	const heading = shopHeading(shopId);
	const closeIndex = collector.reactions.findIndex(reaction => reaction.type === SHOP_REACTION_KINDS.CLOSE);
	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};
	/** Walking out of a commerce is the same gesture as leaving any other screen. */
	const leave = (): void => choose(closeIndex);

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:city.shop.close")} onClose={leave} />
				<Standing
					emblem={<TwemojiIcon emoji={heading.emblem ?? AppIcons.getIcon(`unitValues.${currency}`)} size={SHOP_EMBLEM_SIZE} />}
					caption={i18n.t("app:city.shop.eyebrow")}
					title={heading.title}
					subtitle={heading.subtitle}
				/>
				<Figures items={[{caption: i18n.t("app:city.shop.availableCurrency"), value: formatNumber(availableCurrency), unit: currency}]} />
				{note ? <Note>{note}</Note> : null}
				<ShopGroups
					groups={groupShopReactions(collector)}
					collector={collector}
					currency={currency}
					availableCurrency={availableCurrency}
					additionalShopData={additionalShopData}
					locked={locked}
					choose={choose}
				/>
				{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
			</Screen>
		</SwipeBack>
	);
}
