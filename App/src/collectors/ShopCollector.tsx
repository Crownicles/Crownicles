import {ReactNode, useRef, useState} from "react";
import {Text, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorDataOf, SHOP_DATA_KINDS, SHOP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {Mission} from "ws-packets/src/objects/Mission";
import {AppIcons} from "@/src/AppIcons";
import {AmountUnit, formatAmount, formatNumber} from "@/src/display/Amounts";
import {plainStory} from "@/src/display/Markdown";
import {shopItemKey, shopItemName} from "@/src/collectors/ShopLabels";
import {missionDate, missionDescription} from "@/src/display/Missions";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {Check, Clock3, Coins, ShoppingBag} from "@/src/design/FightIcons";
import {ActionBanner, ExpandableEntry, ExpandableList, Fact, Figures, Lock, LockHint, Standing, useSectionStyles} from "@/src/design/Sections";
import {Page} from "@/src/design/DetailScreen";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {Story} from "@/src/design/Story";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {splitLeadingEmoji, TwemojiText} from "@/src/design/TwemojiText";
import {UnitIcon} from "@/src/components/UnitIcon";
import {i18n} from "@/src/translations/i18n";
import {inventoryItemDetails} from "@/src/components/InventoryItemRow";
import {ItemDetails} from "@/src/components/ItemDetails";

const ROW_EMBLEM_SIZE = 26;
const STANDING_EMBLEM_SIZE = 40;
const PRICE_UNIT_SIZE = 14;

const useStyles = createStyles(colors => ({
	panel: {gap: Theme.spacing.lg},
	price: {alignItems: "flex-end", gap: 2},
	priceValue: {flexDirection: "row", alignItems: "center", gap: 4},
	priceAmount: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, color: colors.ink, fontVariant: ["tabular-nums"]},
	priceNote: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, color: colors.muted}
}));

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
type ShopArticle = {shopItemId: number; categoryId: string; offers: ShopOffer[]};

const WEEKLY_PLANT_TIERS = ["weeklyPlantTier1", "weeklyPlantTier2", "weeklyPlantTier3"];

/** Shelves whose stock the server counts: their header says how many are left, and an empty one is locked. */
const COUNTED_CATEGORIES: Record<string, {name: string; stock: (data: ShopData) => number | undefined}> = {
	dailyPotion: {name: "app:city.shop.dailyPotion", stock: data => data.additionalShopData?.remainingPotions},
	token: {name: "app:city.shop.tokens", stock: data => data.additionalShopData?.remainingTokens}
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
		const categoryId = reaction.data.shopCategoryId;
		const articles = categories.get(categoryId) ?? [];
		const article = articles.find(entry => entry.shopItemId === reaction.data.shopItemId);
		if (article) article.offers.push({reaction, index});
		else articles.push({shopItemId: reaction.data.shopItemId, categoryId, offers: [{reaction, index}]});
		categories.set(categoryId, articles);
	});
	return categories;
}

function isSingleUnit(article: ShopArticle): boolean {
	return article.offers.length === 1 && article.offers[0].reaction.data.amount === 1;
}

/** What one unit costs, for an article sold in bundles. */
function unitPrice(article: ShopArticle): number {
	const unit = article.offers.reduce((smallest, offer) => offer.reaction.data.amount < smallest.reaction.data.amount ? offer : smallest);
	return Math.round(unit.reaction.data.price / unit.reaction.data.amount);
}

function cheapestOffer(article: ShopArticle): ShopOffer {
	return article.offers.reduce((cheapest, offer) => offer.reaction.data.price < cheapest.reaction.data.price ? offer : cheapest);
}

function quantityLabel(offer: ShopOffer): string {
	return i18n.t("app:city.shop.amount", {amount: offer.reaction.data.amount});
}

function missingMoneyLock(price: number, available: number, currency: AmountUnit): Lock | undefined {
	return price > available
		? {reason: i18n.t("app:city.locks.missingMoney", {amount: formatAmount(price - available, currency)}), icon: Coins}
		: undefined;
}

/** Why an offer cannot be bought, known before the press: nothing left today, or not enough to pay for it. */
function offerLock(offer: ShopOffer, article: ShopArticle, data: ShopData): Lock | undefined {
	if (COUNTED_CATEGORIES[article.categoryId]?.stock(data) === 0) return {reason: i18n.t("app:city.shop.soldOut"), icon: Clock3};
	return missingMoneyLock(offer.reaction.data.price, data.availableCurrency, data.currency);
}

function dailyPotionOf(article: ShopArticle, data: ShopData): ItemWithDetails | undefined {
	return shopItemKey({shopItemId: article.shopItemId}) === "dailyPotion" ? data.additionalShopData?.dailyPotion : undefined;
}

/** What the closed row says under the name: what the item does, or the bundles it is sold in. */
function articleSummary(article: ShopArticle, data: ShopData): string | undefined {
	const potion = dailyPotionOf(article, data);
	if (potion) return inventoryItemDetails(potion);
	if (isSingleUnit(article)) return undefined;
	return i18n.t("app:city.shop.bundles", {amounts: article.offers.map(quantityLabel).join(" · ")});
}

/**
 * iOS shows one window at a time: a choice made in a sheet is sent once the sheet is put away, so the
 * window the server answers with is not lost behind it.
 */
function useAfterDismissal(): {defer: (action: () => void) => void; onDismissed: () => void} {
	const pending = useRef<(() => void) | null>(null);
	return {
		defer: (action): void => {
			pending.current = action;
		},
		onDismissed: (): void => {
			const action = pending.current;
			pending.current = null;
			action?.();
		}
	};
}

type ShelfContext = {data: ShopData; locked: boolean; choose: (index: number) => void};

/** The price at the end of a row: what the article costs, or what one unit costs when it comes in bundles. */
function ArticlePrice({article, currency}: {article: ShopArticle; currency: AmountUnit}): ReactNode {
	const styles = useStyles();
	const bundled = !isSingleUnit(article);
	return <View style={styles.price}>
		<View style={styles.priceValue}>
			<Text style={styles.priceAmount}>{formatNumber(bundled ? unitPrice(article) : article.offers[0].reaction.data.price)}</Text>
			<UnitIcon unit={currency} size={PRICE_UNIT_SIZE} />
		</View>
		{bundled ? <Text style={styles.priceNote}>{i18n.t("app:city.shop.perUnit")}</Text> : null}
	</View>;
}

function ArticleCaption({summary, lock}: {summary?: string; lock?: Lock}): ReactNode {
	const sectionStyles = useSectionStyles();
	return <View>
		{summary ? <TwemojiText textStyle={sectionStyles.caption} emojiSize={Theme.fontSize.caption} iosEmojiVerticalOffset={Theme.emoji.iosCaptionOffset}>{summary}</TwemojiText> : null}
		{lock ? <LockHint lock={lock} /> : null}
	</View>;
}

/** The article's sheet: what it does, the quantity when it comes in bundles, what it costs, then the purchase. */
function ArticleSheet({article, context, rowLock, onBuy}: {article: ShopArticle; context: ShelfContext; rowLock?: Lock; onBuy: (index: number) => void}): ReactNode {
	const styles = useStyles();
	const {data, locked} = context;
	const [chosen, setChosen] = useState(0);
	const offer = article.offers[chosen] ?? article.offers[0];
	const price = offer.reaction.data.price;
	const lock = offerLock(offer, article, data);
	const potion = dailyPotionOf(article, data);
	// The row heading, repeated on top of the sheet, already says why: the button only greys out.
	const lockProps = lock && lock.reason === rowLock?.reason ? {disabled: true} : lock ? {lock} : {};
	return <View style={styles.panel}>
		{potion ? <ItemDetails item={potion} /> : null}
		<Story>{i18n.t(`commands:shop.shopItems.${shopItemKey({shopItemId: article.shopItemId})}.info`, {
			kingsMoneyAmount: data.additionalShopData?.gemToMoneyRatio ?? 0,
			thousandPoints: data.additionalShopData?.thousandPoints ?? 0
		})}</Story>
		{article.offers.length > 1 ? <SegmentedControl
			label={i18n.t("app:city.shop.quantity")}
			value={String(chosen)}
			onChange={(value): void => setChosen(Number(value))}
			options={article.offers.map((entry, position) => ({value: String(position), label: quantityLabel(entry)}))}
		/> : null}
		<ExpandableList>
			<Fact label={i18n.t(isSingleUnit(article) ? "app:city.shop.fields.price" : "app:city.shop.fields.lotPrice")} value={formatNumber(price)} unit={data.currency} />
			{lock ? null : <Fact label={i18n.t("app:city.shop.fields.after")} value={formatNumber(data.availableCurrency - price)} unit={data.currency} />}
		</ExpandableList>
		<ActionBanner
			icon={ShoppingBag}
			label={i18n.t("app:city.shop.buyFor", {price: formatAmount(price, data.currency)})}
			pending={locked}
			onPress={(): void => onBuy(offer.index)}
			{...lockProps}
		/>
	</View>;
}

function ArticleRow({article, context, expanded, onToggle}: {article: ShopArticle; context: ShelfContext; expanded: boolean; onToggle: () => void}): ReactNode {
	const {data, locked, choose} = context;
	const {emoji, text} = splitLeadingEmoji(articleName(article.shopItemId, data));
	const lock = offerLock(cheapestOffer(article), article, data);
	const summary = articleSummary(article, data);
	const purchase = useAfterDismissal();
	return <ExpandableEntry
		{...emoji ? {emblem: <TwemojiIcon emoji={emoji} size={ROW_EMBLEM_SIZE} />} : {}}
		label={text}
		{...summary || lock ? {caption: <ArticleCaption {...summary ? {summary} : {}} {...lock ? {lock} : {}} />} : {}}
		end={<ArticlePrice article={article} currency={data.currency} />}
		dimmed={locked || Boolean(lock)}
		expanded={expanded}
		onToggle={onToggle}
		onDismissed={purchase.onDismissed}
		testID={`shop-article-${article.shopItemId}`}
	>
		<ArticleSheet
			article={article}
			context={context}
			{...lock ? {rowLock: lock} : {}}
			onBuy={(index): void => {
				purchase.defer(() => choose(index));
				onToggle();
			}}
		/>
	</ExpandableEntry>;
}

function ShopShelves({collector, context}: {collector: ReactionCollectorCreation; context: ShelfContext}): ReactNode {
	const [openItem, setOpenItem] = useState<number>();
	return [...articlesByCategory(collector).entries()].map(([categoryId, articles]) => {
		const counted = COUNTED_CATEGORIES[categoryId];
		const stock = counted?.stock(context.data);
		return <View key={categoryId}>
			<SectionHeader {...stock === undefined ? {} : {action: {hint: i18n.t("app:city.shop.stock", {count: stock})}}}>
				{counted ? i18n.t(counted.name) : plainStory(i18n.t(`commands:shop.shopCategories.${categoryId}`))}
			</SectionHeader>
			<ExpandableList>{articles.map(article => <ArticleRow
				key={article.shopItemId}
				article={article}
				context={context}
				expanded={openItem === article.shopItemId}
				onToggle={(): void => setOpenItem(openItem === article.shopItemId ? undefined : article.shopItemId)}
			/>)}</ExpandableList>
		</View>;
	});
}

/** The commerce's name and what it sells, then the purse the shelves are measured against. */
function ShopStanding({data}: {data: ShopData}): ReactNode {
	const place = data.shopId ? `commands:report.city.shops.${data.shopId}` : null;
	const emoji = AppIcons.getIconOrNull(data.shopId ? `city.shops.${data.shopId}` : "commands.shop");
	return <Standing
		{...emoji ? {emblem: <TwemojiIcon emoji={emoji} size={STANDING_EMBLEM_SIZE} />} : {}}
		caption={i18n.t("app:city.titles.eyebrow")}
		title={place ? plainStory(i18n.t(`${place}.label`)) : i18n.t("app:city.shop.title")}
		{...place ? {subtitle: plainStory(i18n.t(`${place}.description`))} : {}}
	>
		<Figures items={[{caption: i18n.t(`app:city.shop.balance.${data.currency}`), value: formatNumber(data.availableCurrency), unit: data.currency}]} />
	</Standing>;
}

function closeIndex(collector: ReactionCollectorCreation): number {
	return collector.reactions.findIndex(reaction => reaction.type === SHOP_REACTION_KINDS.CLOSE);
}

/** A city commerce: who it is and the purse, then its shelves; an article opens on its sheet before it is bought. */
export function ShopCollector({collector, onChoose, submitting}: ShopCollectorProps): ReactNode {
	const {locked, choose} = useChooseOnce(onChoose, submitting);
	if (collector.data.type !== SHOP_DATA_KINDS.COLLECTOR) {
		return null;
	}
	const data = collector.data.data;
	return (
		<Page onClose={(): void => choose(closeIndex(collector))} backLabel={i18n.t("app:city.shop.close")} heading={<ShopStanding data={data} />}>
			<ShopShelves collector={collector} context={{data, locked, choose}} />
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Page>
	);
}

/** The step a commerce adds once an item is paid for: what it is for, then the list to pick from. */
function ShopSubMenu({collector, onChoose, submitting, menu, emblem, children}: ShopCollectorProps & {
	menu: "skipMission" | "buySlot";
	emblem: string;
	children: (choose: (index: number) => void, locked: boolean) => ReactNode;
}): ReactNode {
	const {locked, choose} = useChooseOnce(onChoose, submitting);
	return (
		<Page
			onClose={(): void => choose(closeIndex(collector))}
			backLabel={i18n.t("app:city.shop.close")}
			heading={<Standing
				emblem={<TwemojiIcon emoji={emblem} size={STANDING_EMBLEM_SIZE} />}
				caption={i18n.t(`app:city.shop.${menu}.eyebrow`)}
				title={i18n.t(`app:city.shop.${menu}.title`)}
				subtitle={i18n.t(`app:city.shop.${menu}.description`)}
			/>}
		>
			<SectionHeader>{i18n.t(`app:city.shop.${menu}.list`)}</SectionHeader>
			<ExpandableList>{children(choose, locked)}</ExpandableList>
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Page>
	);
}

type ChoiceHeading = {emblem: ReactNode; label: string; caption?: string; end?: ReactNode};

/** A pick that cannot be taken back: its row opens on what it changes, and is confirmed there. */
function ConfirmedChoice({heading, confirmLabel, locked, onConfirm, children}: {
	heading: ChoiceHeading;
	confirmLabel: string;
	locked: boolean;
	onConfirm: () => void;
	children?: ReactNode;
}): ReactNode {
	const styles = useStyles();
	const [open, setOpen] = useState(false);
	const confirmation = useAfterDismissal();
	return <ExpandableEntry
		emblem={heading.emblem}
		label={heading.label}
		{...heading.caption ? {caption: heading.caption} : {}}
		{...heading.end ? {end: heading.end} : {}}
		dimmed={locked}
		expanded={open}
		onToggle={(): void => setOpen(!open)}
		onDismissed={confirmation.onDismissed}
	>
		<View style={styles.panel}>
			{children}
			<ActionBanner icon={Check} label={confirmLabel} pending={locked} onPress={(): void => {
				confirmation.defer(onConfirm);
				setOpen(false);
			}} />
		</View>
	</ExpandableEntry>;
}

function missionDeadline(mission: Mission): string | undefined {
	return mission.expiresAt ? i18n.t("app:missions.expiresAt", {date: missionDate(Date.parse(mission.expiresAt))}) : undefined;
}

/** Which of the running missions the player trades away, once the change-mission item is bought. */
export function SkipMissionCollector(props: ShopCollectorProps): ReactNode {
	const [now] = useState(() => Date.now());
	const sectionStyles = useSectionStyles();
	if (props.collector.data.type !== SHOP_DATA_KINDS.SKIP_MISSION) {
		return null;
	}
	const entries = props.collector.reactions
		.map((reaction, index) => ({reaction, index}))
		.filter((entry): entry is {reaction: SkipMissionReaction; index: number} => entry.reaction.type === SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY);

	return <ShopSubMenu {...props} menu="skipMission" emblem={AppIcons.getIcon("shopItems.skipMission")}>
		{(choose, locked): ReactNode => entries.map(entry => {
			const {mission} = entry.reaction.data;
			const deadline = missionDeadline(mission);
			return <ConfirmedChoice
				key={entry.index}
				heading={{
					emblem: <TwemojiIcon emoji={AppIcons.getIcon(`missions.${mission.missionType}`)} size={ROW_EMBLEM_SIZE} />,
					label: plainStory(missionDescription(mission, now)),
					...deadline ? {caption: deadline} : {},
					end: <Text style={sectionStyles.amount}>{i18n.t("app:profile.formats.progress", {value: mission.numberDone, max: mission.missionObjective})}</Text>
				}}
				confirmLabel={i18n.t("app:city.shop.skipMission.confirm")}
				locked={locked}
				onConfirm={(): void => choose(entry.index)}
			>
				<Story>{i18n.t("app:city.shop.skipMission.warning")}</Story>
			</ConfirmedChoice>;
		})}
	</ShopSubMenu>;
}

/** Which inventory category gains the slot the player is paying for. */
export function BuyCategorySlotCollector(props: ShopCollectorProps): ReactNode {
	if (props.collector.data.type !== SHOP_DATA_KINDS.BUY_SLOT) {
		return null;
	}
	const entries = props.collector.reactions
		.map((reaction, index) => ({reaction, index}))
		.filter((entry): entry is {reaction: BuySlotReaction; index: number} => entry.reaction.type === SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY);

	return <ShopSubMenu {...props} menu="buySlot" emblem={AppIcons.getIcon("shopItems.inventoryExtension")}>
		{(choose, locked): ReactNode => entries.map(entry => <ConfirmedChoice
			key={entry.index}
			heading={{
				emblem: <TwemojiIcon emoji={AppIcons.getIcon(`itemKinds.${entry.reaction.data.categoryId}`)} size={ROW_EMBLEM_SIZE} />,
				label: plainStory(i18n.t(`commands:shop.slotCategoriesKind.${entry.reaction.data.categoryId}`)),
				caption: i18n.t("app:city.shop.slotsLeft", {count: entry.reaction.data.remaining, limit: entry.reaction.data.maxSlots})
			}}
			confirmLabel={i18n.t("app:city.shop.buySlot.confirm")}
			locked={locked}
			onConfirm={(): void => choose(entry.index)}
		/>)}
	</ShopSubMenu>;
}
