import {ComponentType, ReactNode, useMemo, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	SmallEventWitchResultRes, WITCH_OUTCOMES
} from "ws-packets/src/fromServer/smallEvents/SmallEventWitchResultRes";
import {
	BIG_EVENT_DATA_KINDS, GENERIC_REACTION_KINDS, ITEM_DATA_KINDS, REPORT_COLLECTOR_DATA_KINDS,
	REPORT_COLLECTOR_REACTION_KINDS, CITY_DATA_KINDS, SHOP_DATA_KINDS, SMALL_EVENT_DATA_KINDS,
	ReactionCollectorData, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {AMOUNT_UNITS, formatAmount, formatMoney} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {CityCollector} from "@/src/collectors/CityCollector";
import {BuyCategorySlotCollector, ShopCollector, SkipMissionCollector} from "@/src/collectors/ShopCollector";
import {SmallEventShopCollector} from "@/src/collectors/SmallEventShopCollector";
import {RecipeShopCollector} from "@/src/collectors/RecipeShopCollector";
import {PveIslandInvitationCollector} from "@/src/collectors/PveIslandInvitationCollector";
import {ItemAcceptCollector, ItemChoiceCollector} from "@/src/collectors/ItemRewardCollector";
import {collectorDescription, collectorTitle, eventPromptIcon, isEventPrompt} from "@/src/collectors/CollectorLabels";
import type {
	HealOutcome as HealOutcomeData, LotteryOutcome as LotteryOutcomeData,
	TokenOutcomeRequiringAcknowledgement
} from "@/src/collectors/ReportEventStore";
import {Button, ButtonRow, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";
import {ActionBanner, Card, Effect, ExpandableEntry, ExpandableList, Fact, Sheet, Standing} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {EventJournal, EventOutcomeScreen, usePlayerPseudo} from "@/src/collectors/EventOutcomeScreen";
import {plainStory} from "@/src/display/Markdown";
import {
	amountEffect, gainEffect, lossEffect, lostAmountEffect, presentEffects
} from "@/src/display/OutcomeEffects";
import {LotteryReward} from "ws-packets/src/fromServer/smallEvents/SmallEventLotteryRes";
import {anyTranslation} from "@/src/translations/RandomTranslation";

/** Being occupied is the alteration that only costs time: Discord never draws its emoji after a story. */
const OCCUPIED_EFFECT = "occupied";

function isBigEvent(collector: ReactionCollectorCreation): boolean {
	return collector.data.type === BIG_EVENT_DATA_KINDS.COLLECTOR;
}

function isDestination(collector: ReactionCollectorCreation): boolean {
	return collector.data.type === REPORT_COLLECTOR_DATA_KINDS.DESTINATION;
}

function reactionIndex(collector: ReactionCollectorCreation, type: string): number {
	return collector.reactions.findIndex(reaction => reaction.type === type);
}

function formatTokens(value: number): string {
	return formatAmount(value, AMOUNT_UNITS.TOKEN);
}

function eventEyebrow(collector: ReactionCollectorCreation): string {
	if (isBigEvent(collector)) {
		return i18n.t("app:adventure.event.eyebrow");
	}
	if (isDestination(collector)) {
		return i18n.t("app:adventure.destination.eyebrow");
	}
	return i18n.t("app:adventure.smallEvent.eyebrow");
}

function outcomeIcon(outcome: ReportBigEventResultRes): string | undefined {
	const base = `events.${outcome.eventId}.${outcome.possibilityId}`;
	return AppIcons.getIconOrNull(`${base}.${outcome.outcomeId}`)
		?? AppIcons.getIconOrNull(base)
		?? AppIcons.getIconOrNull(`events.${outcome.eventId}.end.${outcome.outcomeId}`)
		?? undefined;
}

function lotteryOutcomeText(outcome: LotteryOutcomeData): string {
	switch (outcome.kind) {
		case "win":
			return i18n.t(`smallEvents:lottery.${outcome.packet.level}.success`, {
				lostTime: outcome.packet.lostTime,
				lostTimeDisplay: formatDurationMinutes(outcome.packet.lostTime)
			}) + i18n.t(`smallEvents:lottery.rewardTypeText.${outcome.packet.winReward}`, {reward: outcome.packet.winAmount});
		case "lose":
			return i18n.t(`smallEvents:lottery.${outcome.packet.level}.${outcome.packet.moneyLost > 0 ? "failWithMalus" : "fail"}`, {
				lostTime: outcome.packet.lostTime,
				lostTimeDisplay: formatDurationMinutes(outcome.packet.lostTime),
				money: outcome.packet.moneyLost
			});
		case "poor":
			return i18n.t("smallEvents:lottery.poor");
		default:
			return i18n.t("smallEvents:lottery.end");
	}
}

type TokenMerchantData = Extract<ReactionCollectorData, {type: typeof REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT}>;
type BuyHealData = Extract<ReactionCollectorData, {type: typeof REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL}>;

function merchantReactionIndex(reactions: ReactionCollectorReaction[], amount: number): number {
	return reactions.findIndex(reaction => reaction.type === REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY
		&& reaction.data.amount === amount);
}

/** Each bundle is bought from its own row, where its price and the money left are already written. */
function MerchantPurchase({amount, data, index, expanded, onToggle, onChoose, submitting}: {
	amount: number;
	data: TokenMerchantData["data"];
	index: number;
	expanded: boolean;
	onToggle: () => void;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	const price = amount * data.pricePerToken;
	const affordable = index >= 0 && price <= data.playerMoney;
	return <ExpandableEntry
		label={plainStory(i18n.t("commands:report.tokenMerchant.buyButton", {count: amount, price}))}
		{...affordable ? {} : {caption: i18n.t("app:city.locks.missingMoney", {amount: formatMoney(price - data.playerMoney)})}}
		dimmed={submitting || !affordable}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ExpandableList>
			<Fact label={i18n.t("app:adventure.tokens.fields.received")} value={`+${formatTokens(amount)}`} />
			<Fact label={i18n.t("app:adventure.tokens.fields.costMoney")} value={`-${formatMoney(price)}`} />
			<Fact label={i18n.t("app:adventure.tokens.fields.remainingMoney")} value={formatMoney(data.playerMoney - price)} />
		</ExpandableList>
		<ActionBanner
			icon={Check}
			label={i18n.t("app:adventure.tokens.merchant.confirm")}
			pending={submitting}
			{...affordable ? {} : {lock: {reason: i18n.t("app:city.locks.missingMoney", {amount: formatMoney(price - data.playerMoney)})}}}
			onPress={(): void => onChoose(index)}
		/>
	</ExpandableEntry>;
}

function TokenUseCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS) {
		return null;
	}
	const acceptIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.ACCEPT);
	const refuseIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.REFUSE);
	const canConfirm = acceptIndex >= 0
		&& collector.data.data.playerTokens >= collector.data.data.cost
		&& !submitting;
	const canRefuse = refuseIndex >= 0 && !submitting;

	return (
		<Sheet
			caption={i18n.t("app:adventure.tokens.merchant.eyebrow")}
			title={i18n.t("app:adventure.tokens.use.title")}
			subtitle={i18n.t("app:adventure.tokens.use.description", {count: collector.data.data.cost})}
			emblem={<TwemojiIcon emoji={AppIcons.getIcon("unitValues.token")} size={Theme.dimensions.headerIcon} />}
			closeLabel={i18n.t("app:adventure.tokens.use.cancel")}
			onClose={canRefuse ? (): void => onChoose(refuseIndex) : (): void => undefined}
		>
			<ActionBanner
				icon={Check}
				label={i18n.t("app:adventure.tokens.use.confirm", {count: collector.data.data.cost})}
				pending={submitting}
				{...canConfirm ? {} : {lock: {reason: i18n.t("app:adventure.tokens.use.description", {count: collector.data.data.cost})}}}
				onPress={(): void => onChoose(acceptIndex)}
			/>
			<ButtonRow>
				<Button disabled={!canRefuse} onPress={canRefuse ? (): void => onChoose(refuseIndex) : undefined}>
					{i18n.t("app:adventure.tokens.use.cancel")}
				</Button>
			</ButtonRow>
		</Sheet>
	);
}

function BuyHealCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL) {
		return null;
	}
	const data = collector.data as BuyHealData;
	const acceptIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.ACCEPT);
	const refuseIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.REFUSE);
	const canConfirm = acceptIndex >= 0 && !submitting;
	const canRefuse = refuseIndex >= 0 && !submitting;

	return (
		<Sheet
			caption={i18n.t("app:adventure.heal.use.eyebrow")}
			title={i18n.t("app:adventure.heal.use.title")}
			subtitle={i18n.t("app:adventure.heal.use.description", {price: data.data.healPrice, money: data.data.playerMoney})}
			emblem={<TwemojiIcon emoji={AppIcons.getIcon("shopItems.healAlteration")} size={Theme.dimensions.headerIcon} />}
			closeLabel={i18n.t("app:adventure.heal.use.cancel")}
			onClose={canRefuse ? (): void => onChoose(refuseIndex) : (): void => undefined}
		>
			<ExpandableList>
				<Fact label={i18n.t("app:adventure.heal.fields.cost")} value={formatMoney(data.data.healPrice)} />
				<Fact label={i18n.t("app:adventure.heal.fields.balance")} value={formatMoney(data.data.playerMoney)} />
			</ExpandableList>
			<ActionBanner
				icon={Check}
				label={i18n.t("app:adventure.heal.use.confirm", {price: data.data.healPrice})}
				pending={!canConfirm}
				onPress={(): void => onChoose(acceptIndex)}
			/>
			<ButtonRow>
				<Button disabled={!canRefuse} onPress={canRefuse ? (): void => onChoose(refuseIndex) : undefined}>
					{i18n.t("app:adventure.heal.use.cancel")}
				</Button>
			</ButtonRow>
		</Sheet>
	);
}

function TokenMerchantCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	const [openAmount, setOpenAmount] = useState<number>();
	const pseudo = usePlayerPseudo();
	if (collector.data.type !== REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT) {
		return null;
	}
	const {amounts} = collector.data.data;
	const data = collector.data.data;
	const refuseIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.REFUSE);

	return (
		<Screen>
			<EventJournal
				emoji={AppIcons.getIconOrNull("unitValues.token") ?? undefined}
				title={plainStory(i18n.t("commands:report.tokenMerchant.title", {pseudo}))}
				story={i18n.t("commands:report.tokenMerchant.description", data)}
			/>
			<Card>{amounts.map(amount => <MerchantPurchase
				key={amount}
				amount={amount}
				data={data}
				index={merchantReactionIndex(collector.reactions, amount)}
				expanded={openAmount === amount}
				onToggle={(): void => setOpenAmount(openAmount === amount ? undefined : amount)}
				onChoose={onChoose}
				submitting={submitting}
			/>)}</Card>
			{refuseIndex >= 0 ? <ButtonRow>
				<Button disabled={submitting} onPress={submitting ? undefined : (): void => onChoose(refuseIndex)}>
					{plainStory(i18n.t("commands:report.tokenMerchant.refuseButton"))}
				</Button>
			</ButtonRow> : null}
		</Screen>
	);
}
type AdventureCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

const SPECIALIZED_COLLECTORS: Partial<Record<ReactionCollectorData["type"], ComponentType<AdventureCollectorProps>>> = {
	[REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS]: TokenUseCollector,
	[REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL]: BuyHealCollector,
	[REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT]: TokenMerchantCollector,
	[CITY_DATA_KINDS.CITY]: CityCollector,
	[SHOP_DATA_KINDS.COLLECTOR]: ShopCollector,
	[SHOP_DATA_KINDS.SKIP_MISSION]: SkipMissionCollector,
	[SHOP_DATA_KINDS.BUY_SLOT]: BuyCategorySlotCollector,
	[SMALL_EVENT_DATA_KINDS.SHOP]: SmallEventShopCollector,
	[SMALL_EVENT_DATA_KINDS.EPIC_SHOP]: SmallEventShopCollector,
	[SMALL_EVENT_DATA_KINDS.RECIPE_SHOP]: RecipeShopCollector,
	[SMALL_EVENT_DATA_KINDS.PVE_ISLAND]: PveIslandInvitationCollector,
	[ITEM_DATA_KINDS.CHOICE]: ItemChoiceCollector,
	[ITEM_DATA_KINDS.ACCEPT]: ItemAcceptCollector
};

/** The report-owned collector is rendered in the same screen hierarchy as the mobile mockup. */
export function AdventureCollector(props: AdventureCollectorProps): ReactNode {
	const SpecializedCollector = SPECIALIZED_COLLECTORS[props.collector.data.type];
	if (SpecializedCollector) {
		return <SpecializedCollector {...props} />;
	}
	const description = collectorDescription(props.collector.data);
	if (isEventPrompt(props.collector.data)) {
		return (
			<Screen>
				<EventJournal emoji={eventPromptIcon(props.collector.data)} story={description ?? ""} />
				<CollectorChoices {...props} />
			</Screen>
		);
	}
	return (
		<Screen>
			<Standing
				caption={eventEyebrow(props.collector)}
				title={collectorTitle(props.collector.data)}
				subtitle={description}
			/>
			<CollectorChoices {...props} />
		</Screen>
	);
}
/** Every unit a big event may hand out or take away, with the emoji the game uses for it. */
const OUTCOME_UNITS = {
	score: "score",
	money: "money",
	lostMoney: "lostMoney",
	health: "health",
	lostHealth: "lostHealth",
	energy: "energy",
	gem: "gem",
	token: "token",
	xp: "xp",
	time: "time"
} as const;

/** The Discord keys of each merchant answer: `${key}Title` names the page, `${key}Description` tells it. */
const TOKEN_OUTCOME_KEYS: Record<TokenOutcomeRequiringAcknowledgement["kind"], string> = {
	bought: "bought",
	tooMuch: "tooMuch",
	full: "full",
	cannotAfford: "cannotAfford",
	charity: "charity",
	charityAlreadyUsed: "charityAlreadyUsed"
};

function tokensReceived(outcome: TokenOutcomeRequiringAcknowledgement): number | undefined {
	return outcome.kind === "bought" || outcome.kind === "charity" ? outcome.packet.amount : undefined;
}

/** The token merchant's answer, told with the words Discord uses and the tokens it handed over. */
export function TokenOutcome({outcome, onContinue}: {
	outcome: TokenOutcomeRequiringAcknowledgement;
	onContinue: () => void;
}): ReactNode {
	const pseudo = usePlayerPseudo();
	const key = `commands:report.tokenMerchant.${TOKEN_OUTCOME_KEYS[outcome.kind]}`;
	const received = tokensReceived(outcome);
	return <EventOutcomeScreen
		emoji={AppIcons.getIconOrNull("unitValues.token") ?? undefined}
		title={plainStory(i18n.t(`${key}Title`, {pseudo}))}
		story={i18n.t(`${key}Description`, received === undefined ? {} : {count: received})}
		effects={presentEffects([received === undefined ? null : amountEffect(i18n.t("app:adventure.event.fields.tokens"), received, {gain: OUTCOME_UNITS.token})])}
		continueLabel={i18n.t("app:adventure.tokens.continue")}
		onContinue={onContinue}
	/>;
}

function healStory(outcome: HealOutcomeData): string {
	switch (outcome.kind) {
		case "accepted":
			return i18n.t("commands:report.healSuccessDescription", {
				price: outcome.packet.healPrice,
				nextStep: i18n.t(outcome.packet.isArrived ? "commands:report.healNextStepArrived" : "commands:report.healNextStepSmallEvent")
			});
		case "refused":
			return i18n.t("commands:report.healRefusedDescription");
		case "noAlteration":
			return i18n.t("commands:report.healNoAlteration");
		default:
			return i18n.t("commands:report.healCannotHealOccupied");
	}
}

/** Discord titles only the cure it performed or the one the player turned down; its plain refusals are journal lines. */
const HEAL_TITLE_KEYS: Partial<Record<HealOutcomeData["kind"], string>> = {
	accepted: "commands:report.healSuccessTitle",
	refused: "commands:report.healRefusedTitle"
};

/** Shows the result of buying an alteration cure before refreshing the adventure report. */
export function HealOutcome({outcome, onContinue}: {
	outcome: HealOutcomeData;
	onContinue: () => void;
}): ReactNode {
	const pseudo = usePlayerPseudo();
	const titleKey = HEAL_TITLE_KEYS[outcome.kind];
	return <EventOutcomeScreen
		emoji={AppIcons.getIconOrNull("shopItems.healAlteration") ?? undefined}
		{...titleKey ? {title: plainStory(i18n.t(titleKey, {pseudo}))} : {}}
		story={healStory(outcome)}
		effects={outcome.kind === "accepted" ? presentEffects([lostAmountEffect(i18n.t("app:adventure.event.fields.money"), outcome.packet.healPrice, OUTCOME_UNITS.lostMoney)]) : []}
		continueLabel={i18n.t("app:adventure.heal.continue")}
		onContinue={onContinue}
	/>;
}

/** The alteration an event inflicts, worn by its own emoji when the asset pack has one. */
function alterationEffect(effect: {name: string; time: number}): Effect {
	const emoji = AppIcons.getIconOrNull(`effects.${effect.name}`);
	return lossEffect(i18n.t("app:adventure.event.fields.timeLost"), formatDurationMinutes(effect.time), emoji ? {emoji} : {unit: OUTCOME_UNITS.time});
}

function outcomeChanges(outcome: ReportBigEventResultRes): Effect[] {
	return presentEffects([
		amountEffect(i18n.t("app:adventure.event.fields.points"), outcome.score, {gain: OUTCOME_UNITS.score}),
		amountEffect(i18n.t("app:adventure.event.fields.experience"), outcome.experience, {gain: OUTCOME_UNITS.xp}),
		amountEffect(i18n.t("app:adventure.event.fields.money"), outcome.money, {gain: OUTCOME_UNITS.money, loss: OUTCOME_UNITS.lostMoney}),
		amountEffect(i18n.t("app:adventure.event.fields.health"), outcome.health, {gain: OUTCOME_UNITS.health, loss: OUTCOME_UNITS.lostHealth}),
		amountEffect(i18n.t("app:adventure.event.fields.energy"), outcome.energy, {gain: OUTCOME_UNITS.energy}),
		amountEffect(i18n.t("app:adventure.event.fields.gems"), outcome.gems, {gain: OUTCOME_UNITS.gem}),
		amountEffect(i18n.t("app:adventure.event.fields.tokens"), outcome.tokens, {gain: OUTCOME_UNITS.token}),
		outcome.effect === undefined ? null : alterationEffect(outcome.effect)
	]);
}

/**
 * The end of the story the player just took part in, told as Discord tells it: the outcome the game
 * wrote, followed by the emoji of the alteration it inflicted, and what it cost or brought.
 */
export function BigEventOutcome({outcome, onContinue}: {
	outcome: ReportBigEventResultRes;
	onContinue: () => void;
}): ReactNode {
	const story = i18n.t(`events:${outcome.eventId}.possibilities.${outcome.possibilityId}.outcomes.${outcome.outcomeId}`);
	const alteration = outcome.effect && outcome.effect.name !== OCCUPIED_EFFECT ? AppIcons.getIconOrNull(`effects.${outcome.effect.name}`) : null;
	return <EventOutcomeScreen
		emoji={outcomeIcon(outcome)}
		story={alteration ? `${story} ${alteration}` : story}
		effects={outcomeChanges(outcome)}
		continueLabel={i18n.t("app:adventure.event.continue")}
		onContinue={onContinue}
	/>;
}

const LOTTERY_REWARD_UNITS: Record<LotteryReward, string> = {
	money: OUTCOME_UNITS.money,
	xp: OUTCOME_UNITS.xp,
	points: OUTCOME_UNITS.score,
	guildXp: OUTCOME_UNITS.xp
};

function lostTimeEffect(lostTime: number): Effect | null {
	return lostTime > 0 ? lossEffect(i18n.t("app:adventure.event.fields.timeLost"), formatDurationMinutes(lostTime), {unit: OUTCOME_UNITS.time}) : null;
}

function lotteryEffects(outcome: LotteryOutcomeData): Effect[] {
	switch (outcome.kind) {
		case "win":
			return presentEffects([
				amountEffect(i18n.t(`app:adventure.lottery.rewards.${outcome.packet.winReward}`), outcome.packet.winAmount, {gain: LOTTERY_REWARD_UNITS[outcome.packet.winReward]}),
				lostTimeEffect(outcome.packet.lostTime)
			]);
		case "lose":
			return presentEffects([
				lostAmountEffect(i18n.t("app:adventure.lottery.fields.moneyLost"), outcome.packet.moneyLost, OUTCOME_UNITS.lostMoney),
				lostTimeEffect(outcome.packet.lostTime)
			]);
		default:
			return [];
	}
}

/** Shows the exact resolution sent after a lottery collector is answered. */
export function LotteryOutcome({outcome, onContinue}: {
	outcome: LotteryOutcomeData;
	onContinue: () => void;
}): ReactNode {
	return <EventOutcomeScreen
		emoji={AppIcons.getIconOrNull("smallEvents.lottery") ?? undefined}
		story={lotteryOutcomeText(outcome)}
		effects={lotteryEffects(outcome)}
		continueLabel={i18n.t("app:adventure.smallEvent.continue")}
		onContinue={onContinue}
	/>;
}

function witchEffectApplied(outcome: SmallEventWitchResultRes): boolean {
	return outcome.forceEffect || outcome.outcome === WITCH_OUTCOMES.EFFECT;
}

/** Only the occupied effect costs time, and Discord says how much after the outcome. */
function witchTimeOutro(outcome: SmallEventWitchResultRes): string {
	if (!witchEffectApplied(outcome) || outcome.effectId !== OCCUPIED_EFFECT || outcome.timeLostMinutes <= 0) return "";
	return ` ${anyTranslation("smallEvents:witch.witchEventResults.outcomes.2.time", {lostTime: outcome.timeLostMinutes, lostTimeDisplay: formatDurationMinutes(outcome.timeLostMinutes)})}`;
}

/** A forced effect the outcome text does not already name gets its emoji appended, as on Discord. */
function witchForcedEmoji(outcome: SmallEventWitchResultRes): string {
	if (!outcome.forceEffect || outcome.outcome === WITCH_OUTCOMES.EFFECT || outcome.effectId === OCCUPIED_EFFECT) return "";
	return ` ${AppIcons.getIconOrNull(`effects.${outcome.effectId}`) ?? ""}`;
}

function witchRecipe(outcome: SmallEventWitchResultRes): string {
	return outcome.discoveredRecipe
		? `\n\n${i18n.t("commands:report.city.homes.cooking.recipeDiscovered", {recipe: i18n.t("models:cooking.recipeDisplay", outcome.discoveredRecipe)})}`
		: "";
}

/** The Discord account of the witch's brew: the ingredient or advice, what it did, and what it cost. */
function witchOutcomeDescription(outcome: SmallEventWitchResultRes): string {
	const outcomeKey = outcome.outcome === WITCH_OUTCOMES.EFFECT ? `2.${outcome.effectId}` : String(outcome.outcome + 1);
	const witchEvent = `${i18n.t(`smallEvents:witch.witchEventNames.${outcome.ingredientId}`)} ${AppIcons.getIconOrNull(`witchSmallEvent.${outcome.ingredientId}`) ?? ""}`.toLowerCase();
	return `${anyTranslation(`smallEvents:witch.witchEventResults.${outcome.isIngredient ? "ingredientIntros" : "adviceIntros"}`, {witchEvent})} ${
		anyTranslation(`smallEvents:witch.witchEventResults.outcomes.${outcomeKey}`, {lifeLoss: outcome.lifeLoss})}${witchTimeOutro(outcome)}${witchForcedEmoji(outcome)}${witchRecipe(outcome)}`;
}

function witchEffect(outcome: SmallEventWitchResultRes): Effect | null {
	if (!outcome.forceEffect && outcome.outcome !== WITCH_OUTCOMES.EFFECT) {
		return null;
	}
	const emoji = AppIcons.getIconOrNull(`effects.${outcome.effectId}`);
	return lossEffect(i18n.t("app:adventure.witch.fields.effect"), i18n.t(`error:effects.${outcome.effectId}.self`), emoji ? {emoji} : {});
}

function witchEffects(outcome: SmallEventWitchResultRes): Effect[] {
	return presentEffects([
		witchEffect(outcome),
		outcome.outcome === WITCH_OUTCOMES.LIFE_LOSS ? lostAmountEffect(i18n.t("app:adventure.event.fields.health"), outcome.lifeLoss, OUTCOME_UNITS.lostHealth) : null,
		lostTimeEffect(outcome.timeLostMinutes),
		outcome.discoveredRecipe
			? gainEffect(i18n.t("app:adventure.witch.fields.recipe"), i18n.t("models:cooking.recipeDisplay", outcome.discoveredRecipe))
			: null
	]);
}

export function WitchOutcome({outcome, onContinue}: {
	outcome: SmallEventWitchResultRes;
	onContinue: () => void;
}): ReactNode {
	const story = useMemo(() => witchOutcomeDescription(outcome), [outcome]);
	return <EventOutcomeScreen
		emoji={AppIcons.getIconOrNull("smallEvents.witch") ?? undefined}
		story={story}
		effects={witchEffects(outcome)}
		continueLabel={i18n.t("app:adventure.smallEvent.continue")}
		onContinue={onContinue}
	/>;
}
