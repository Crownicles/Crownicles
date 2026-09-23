import {ReactNode, useState} from "react";
import {StyleSheet, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorDataOf, SHOP_DATA_KINDS, SHOP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {AmountUnit, formatAmount} from "@/src/display/Amounts";
import {plainStory} from "@/src/display/Markdown";
import {isChoosable} from "@/src/collectors/CollectorLabels";
import {EventJournal, usePlayerPseudo} from "@/src/collectors/EventOutcomeScreen";
import {shopItemKey, shopItemName} from "@/src/collectors/ShopLabels";
import {missionDescription} from "@/src/display/Missions";
import {Button, Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {Check, Coins} from "@/src/design/FightIcons";
import {ActionBanner, BackButton, Card, ENTRY_CHEVRONS, ExpandableEntry, Lock, LockHint, sectionStyles} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {TwemojiText} from "@/src/design/TwemojiText";
import {i18n} from "@/src/translations/i18n";

const ROW_EMBLEM_SIZE = 26;

const styles = StyleSheet.create({
	confirmation: {gap: Theme.spacing.md}
});

type ShopCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

type ShopData = ReactionCollectorDataOf<typeof SHOP_DATA_KINDS.COLLECTOR>["data"];
type ShopItemReaction = Extract<ReactionCollectorCreation["reactions"][number], {type: typeof SHOP_REACTION_KINDS.ITEM}>;
type SkipMissionReaction = Extract<ReactionCollectorCreation["reactions"][number], {type: typeof SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY}>;
type BuySlotReaction = Extract<ReactionCollectorCreation["reactions"][number], {type: typeof SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY}>;

/** One bundle of an item, with the position the server expects back when it is bought. */
type ShopOffer = {reaction: ShopItemReaction; index: number};

/** Every bundle of the same item: Discord lists the item once and asks for the quantity afterwards. */
type ShopArticle = {shopItemId: number; offers: ShopOffer[]};

const WEEKLY_PLANT_TIERS = ["weeklyPlantTier1", "weeklyPlantTier2", "weeklyPlantTier3"];
const COUNTED_CATEGORIES: Record<string, (data: ShopData) => number | undefined> = {
	dailyPotion: data => data.additionalShopData?.remainingPotions,
	token: data => data.additionalShopData?.remainingTokens
};

export function useChooseOnce(onChoose: (index: number) => void, submitting: boolean): {locked: boolean; choose: (index: number) => void} {
	const [answered, setAnswered] = useState(false);
	const locked = answered || submitting;
	return {
		locked,
		choose: (index: number): void => {
			if (locked) return;
			setAnswered(true);
			onChoose(index);
		}
	};
}

function shopText(key: string, options: Record<string, unknown> = {}): string {
	return plainStory(i18n.t(`commands:shop.${key}`, options));
}

/** Discord names the daily potion and the weekly plants after what is actually on the shelf this time. */
function articleName(shopItemId: number, data: ShopData): string {
	const key = shopItemKey({shopItemId});
	const potion = data.additionalShopData?.dailyPotion;
	if (key === "dailyPotion" && potion) {
		return `${AppIcons.getIconOrNull(`potions.${potion.id}`) ?? ""} ${i18n.t(`models:potions.${potion.id}`)}`;
	}
	const tier = WEEKLY_PLANT_TIERS.indexOf(key);
	const plantId = tier >= 0 ? data.additionalShopData?.weeklyPlants?.[tier] : undefined;
	if (plantId !== undefined) {
		return plainStory(i18n.t(`commands:shop.shopItems.${key}.name`, {plantId}));
	}
	return plainStory(shopItemName({shopItemId}));
}

function articlesByCategory(collector: ReactionCollectorCreation): Map<string, ShopArticle[]> {
	const categories = new Map<string, ShopArticle[]>();
	collector.reactions.forEach((reaction, index) => {
		if (reaction.type !== SHOP_REACTION_KINDS.ITEM) return;
		const articles = categories.get(reaction.data.shopCategoryId) ?? [];
		const article = articles.find(entry => entry.shopItemId === reaction.data.shopItemId);
		if (article) article.offers.push({reaction, index});
		else articles.push({shopItemId: reaction.data.shopItemId, offers: [{reaction, index}]});
		categories.set(reaction.data.shopCategoryId, articles);
	});
	return categories;
}

function isSingleUnit(article: ShopArticle): boolean {
	return article.offers.length === 1 && article.offers[0].reaction.data.amount === 1;
}

/** The price line Discord writes under an article: the price itself, or the price of one unit when it comes in bundles. */
function priceLine(article: ShopArticle, currency: AmountUnit): string {
	if (isSingleUnit(article)) {
		return shopText("itemPrice", {price: article.offers[0].reaction.data.price, currency});
	}
	const unit = article.offers.reduce((smallest, offer) => offer.reaction.data.amount < smallest.reaction.data.amount ? offer : smallest);
	return shopText("itemPriceUnit", {price: Math.round(unit.reaction.data.price / unit.reaction.data.amount), currency});
}

function missingMoneyLock(price: number, available: number, currency: AmountUnit): Lock | undefined {
	return price > available
		? {reason: i18n.t("app:city.locks.missingMoney", {amount: formatAmount(price - available, currency)}), icon: Coins}
		: undefined;
}

type ShelfContext = {collector: ReactionCollectorCreation; data: ShopData; locked: boolean; choose: (index: number) => void};

/** Once "Acheter" is pressed the article opens in place on what Discord confirms: what it does, then the quantity. */
function ArticleConfirmation({article, context, onCancel}: {article: ShopArticle; context: ShelfContext; onCancel: () => void}): ReactNode {
	const {data, locked, choose} = context;
	const info = shopText(`shopItems.${shopItemKey({shopItemId: article.shopItemId})}.info`, {
		kingsMoneyAmount: data.additionalShopData?.gemToMoneyRatio ?? 0,
		thousandPoints: data.additionalShopData?.thousandPoints ?? 0
	});
	return <View style={styles.confirmation}>
		<TwemojiText textStyle={sectionStyles.caption} emojiSize={Theme.fontSize.caption}>{`${AppIcons.getIconOrNull("collectors.warning") ?? ""} ${info}`}</TwemojiText>
		{article.offers.map(offer => {
			const lock = missingMoneyLock(offer.reaction.data.price, data.availableCurrency, data.currency)
				?? (isChoosable(offer.reaction, context.collector.data) ? undefined : {reason: i18n.t("app:city.locks.unavailable")});
			return <ActionBanner
				key={offer.index}
				icon={Check}
				label={isSingleUnit(article)
					? shopText("confirmButton")
					: shopText("amountButton", {amount: offer.reaction.data.amount, price: offer.reaction.data.price, currency: data.currency})}
				pending={locked}
				onPress={(): void => choose(offer.index)}
				{...lock ? {lock} : {}}
			/>;
		})}
		<Button onPress={onCancel}>{shopText("cancelButton")}</Button>
	</View>;
}

function ShopArticleRow({article, context, expanded, onToggle}: {article: ShopArticle; context: ShelfContext; expanded: boolean; onToggle: () => void}): ReactNode {
	const {data, locked} = context;
	const cheapest = Math.min(...article.offers.map(offer => offer.reaction.data.price));
	const lock = missingMoneyLock(cheapest, data.availableCurrency, data.currency);
	const price = <TwemojiText textStyle={sectionStyles.caption} emojiSize={Theme.fontSize.caption}>{priceLine(article, data.currency)}</TwemojiText>;
	return <ExpandableEntry
		label={articleName(article.shopItemId, data)}
		caption={lock && !expanded ? <View>{price}<LockHint lock={lock} /></View> : price}
		end={expanded ? undefined : <Button variant="primary">{shopText("buyButton")}</Button>}
		chevron={ENTRY_CHEVRONS.NONE}
		dimmed={locked || Boolean(lock)}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ArticleConfirmation article={article} context={context} onCancel={onToggle} />
	</ExpandableEntry>;
}

function categoryTitle(categoryId: string, data: ShopData): string {
	const count = COUNTED_CATEGORIES[categoryId]?.(data);
	return shopText(`shopCategories.${categoryId}`, count === undefined ? {} : {count});
}

function ShopShelves({context}: {context: ShelfContext}): ReactNode {
	const [openItem, setOpenItem] = useState<number>();
	return [...articlesByCategory(context.collector).entries()].map(([categoryId, articles]) => <View key={categoryId}>
		<SectionHeader>{categoryTitle(categoryId, context.data)}</SectionHeader>
		<Card>{articles.map(article => <ShopArticleRow
			key={article.shopItemId}
			article={article}
			context={context}
			expanded={openItem === article.shopItemId}
			onToggle={(): void => setOpenItem(openItem === article.shopItemId ? undefined : article.shopItemId)}
		/>)}</Card>
	</View>);
}

/** Discord's shop window, told on the same journal page as the rest of the journey: who greets the player, the shelves, then the purse. */
export function ShopCollector({collector, onChoose, submitting}: ShopCollectorProps): ReactNode {
	const pseudo = usePlayerPseudo();
	const {locked, choose} = useChooseOnce(onChoose, submitting);
	if (collector.data.type !== SHOP_DATA_KINDS.COLLECTOR) {
		return null;
	}
	const data = collector.data.data;
	const leave = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === SHOP_REACTION_KINDS.CLOSE));
	const place = data.shopId ? `commands:report.city.shops.${data.shopId}` : null;
	const story = [
		place ? plainStory(i18n.t(`${place}.description`)) : null,
		i18n.t("commands:shop.greeting", {pseudo}),
		i18n.t("commands:shop.currentMoney", {money: data.availableCurrency, currency: data.currency})
	].filter(paragraph => paragraph !== null).join("\n\n");

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:city.shop.close")} onClose={leave} />
				<EventJournal
					emoji={AppIcons.getIconOrNull(data.shopId ? `city.shops.${data.shopId}` : "commands.shop") ?? undefined}
					title={place ? plainStory(i18n.t(`${place}.label`)) : shopText("title")}
					story={story}
				/>
				<ShopShelves context={{collector, data, locked, choose}} />
				{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
			</Screen>
		</SwipeBack>
	);
}

/** Shared scaffolding of the two menus a commerce opens once an item is paid for. */
function ShopSubMenu({collector, onChoose, submitting, heading, children}: ShopCollectorProps & {
	heading: {emblem: string; title: string; story: string};
	children: (choose: (index: number) => void, locked: boolean) => ReactNode;
}): ReactNode {
	const {locked, choose} = useChooseOnce(onChoose, submitting);
	const leave = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === SHOP_REACTION_KINDS.CLOSE));

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:city.shop.close")} onClose={leave} />
				<EventJournal emoji={heading.emblem} title={heading.title} story={heading.story} />
				<Card>{children(choose, locked)}</Card>
				{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
			</Screen>
		</SwipeBack>
	);
}

/** Which of the running missions the player trades away, once the change-mission item is bought. */
export function SkipMissionCollector(props: ShopCollectorProps): ReactNode {
	const [now] = useState(() => Date.now());
	const pseudo = usePlayerPseudo();
	if (props.collector.data.type !== SHOP_DATA_KINDS.SKIP_MISSION) {
		return null;
	}
	const entries = props.collector.reactions
		.map((reaction, index) => ({reaction, index}))
		.filter((entry): entry is {reaction: SkipMissionReaction; index: number} => entry.reaction.type === SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY);

	return <ShopSubMenu
		{...props}
		heading={{
			emblem: AppIcons.getIcon("missions.sideMission"),
			title: shopText("shopItems.skipMission.giveTitle", {pseudo}),
			story: i18n.t("commands:shop.shopItems.skipMission.giveDesc")
		}}
	>
		{(choose, locked): ReactNode => entries.map(entry => <ExpandableEntry
			key={entry.index}
			label={plainStory(missionDescription(entry.reaction.data.mission, now))}
			chevron={ENTRY_CHEVRONS.FORWARD}
			dimmed={locked}
			expanded={false}
			onToggle={(): void => choose(entry.index)}
		/>)}
	</ShopSubMenu>;
}

/** Which inventory category gains the slot the player just paid for. */
export function BuyCategorySlotCollector(props: ShopCollectorProps): ReactNode {
	const pseudo = usePlayerPseudo();
	if (props.collector.data.type !== SHOP_DATA_KINDS.BUY_SLOT) {
		return null;
	}
	const entries = props.collector.reactions
		.map((reaction, index) => ({reaction, index}))
		.filter((entry): entry is {reaction: BuySlotReaction; index: number} => entry.reaction.type === SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY);

	return <ShopSubMenu
		{...props}
		heading={{
			emblem: AppIcons.getIcon("shopItems.slotExtension"),
			title: shopText("chooseSlotTitle", {pseudo}),
			story: i18n.t("commands:shop.chooseSlotIndication")
		}}
	>
		{(choose, locked): ReactNode => entries.map(entry => <ExpandableEntry
			key={entry.index}
			emblem={<TwemojiIcon emoji={AppIcons.getIcon(`itemKinds.${entry.reaction.data.categoryId}`)} size={ROW_EMBLEM_SIZE} />}
			label={plainStory(i18n.t(`commands:shop.slotCategoriesKind.${entry.reaction.data.categoryId}`))}
			caption={i18n.t("app:city.shop.slotsLeft", {count: entry.reaction.data.remaining, limit: entry.reaction.data.maxSlots})}
			chevron={ENTRY_CHEVRONS.FORWARD}
			dimmed={locked}
			expanded={false}
			onToggle={(): void => choose(entry.index)}
		/>)}
	</ShopSubMenu>;
}
