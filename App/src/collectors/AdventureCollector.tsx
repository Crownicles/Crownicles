import {ComponentType, ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	SmallEventWitchResultRes, WITCH_OUTCOMES
} from "ws-packets/src/fromServer/smallEvents/SmallEventWitchResultRes";
import {
	BIG_EVENT_DATA_KINDS, GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS,
	REPORT_COLLECTOR_REACTION_KINDS, CITY_DATA_KINDS, SHOP_DATA_KINDS, SMALL_EVENT_DATA_KINDS,
	ReactionCollectorData, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {AMOUNT_UNITS, formatAmount, formatMoney, formatNumber} from "@/src/display/Amounts";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {CityCollector} from "@/src/collectors/CityCollector";
import {BuyCategorySlotCollector, ShopCollector, SkipMissionCollector} from "@/src/collectors/ShopCollector";
import {SmallEventShopCollector} from "@/src/collectors/SmallEventShopCollector";
import {RecipeShopCollector} from "@/src/collectors/RecipeShopCollector";
import {PveIslandInvitationCollector} from "@/src/collectors/PveIslandInvitationCollector";
import {collectorDescription, collectorTitle} from "@/src/collectors/CollectorLabels";
import type {
	HealOutcome as HealOutcomeData, LotteryOutcome as LotteryOutcomeData,
	TokenOutcomeRequiringAcknowledgement
} from "@/src/collectors/ReportEventStore";
import {
	Button, ButtonRow, Confirmation, Hero, KeyValue, Notice, Panel, Screen, StatBar
} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

const MILLISECONDS_PER_MINUTE = 60_000;

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

function duration(milliseconds: number): string {
	const minutes = Math.max(0, Math.ceil(milliseconds / MILLISECONDS_PER_MINUTE));
	const hours = Math.floor(minutes / 60);
	return hours > 0
		? i18n.t("app:adventure.duration.hoursMinutes", {hours, minutes: minutes % 60})
		: i18n.t("app:adventure.duration.minutes", {count: minutes});
}

function signed(value: number): string {
	return value > 0 ? `+${value}` : String(value);
}

function outcomeIcon(outcome: ReportBigEventResultRes): string | undefined {
	const base = `events.${outcome.eventId}.${outcome.possibilityId}`;
	return AppIcons.getIconOrNull(`${base}.${outcome.outcomeId}`)
		?? AppIcons.getIconOrNull(base)
		?? AppIcons.getIconOrNull(`events.${outcome.eventId}.end.${outcome.outcomeId}`)
		?? undefined;
}

function lotteryIcon(): ReactNode | undefined {
	const icon = AppIcons.getIconOrNull("smallEvents.lottery");
	return icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : undefined;
}

function lotteryOutcomeText(outcome: LotteryOutcomeData): string {
	switch (outcome.kind) {
		case "win":
			return i18n.t("app:adventure.lottery.win");
		case "lose":
			return outcome.packet.moneyLost > 0
				? i18n.t("app:adventure.lottery.loseWithMalus")
				: i18n.t("app:adventure.lottery.lose");
		case "poor":
			return i18n.t("app:adventure.lottery.poor");
		case "noAnswer":
			return i18n.t("app:adventure.lottery.noAnswer");
		default:
			return i18n.t("app:adventure.lottery.noAnswer");
	}
}

type TokenMerchantData = Extract<ReactionCollectorData, {type: typeof REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT}>;
type BuyHealData = Extract<ReactionCollectorData, {type: typeof REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL}>;

function tokenRatio(data: TokenMerchantData): number {
	return data.data.maxTokens === 0 ? 0 : data.data.playerTokens / data.data.maxTokens;
}

function merchantReactionIndex(reactions: ReactionCollectorReaction[], amount: number): number {
	return reactions.findIndex(reaction => reaction.type === REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY
		&& reaction.data.amount === amount);
}

function merchantPurchaseLabel(amount: number, pricePerToken: number): string {
	return amount === 1
		? i18n.t("app:adventure.tokens.merchant.buyOne", {amount, price: amount * pricePerToken})
		: i18n.t("app:adventure.tokens.merchant.buyMany", {amount, price: amount * pricePerToken});
}

function TokenMerchantSummary({data}: {data: TokenMerchantData}): ReactNode {
	const {maxTokens, playerMoney, playerTokens, pricePerToken} = data.data;
	return (
		<Panel>
			<StatBar
				label={i18n.t("app:adventure.tokens.fields.balance")}
				value={`${formatNumber(playerTokens)} / ${formatTokens(maxTokens)}`}
				ratio={tokenRatio(data)}
				color={Theme.colors.gold}
			/>
			<KeyValue label={i18n.t("app:adventure.tokens.fields.price")} value={formatMoney(pricePerToken)} />
			<KeyValue label={i18n.t("app:adventure.tokens.fields.money")} value={formatMoney(playerMoney)} />
		</Panel>
	);
}

function MerchantPurchaseButton({
	amount,
	firstAmount,
	pricePerToken,
	index,
	playerMoney,
	onChoose,
	submitting
}: {
	amount: number;
	firstAmount: number;
	pricePerToken: number;
	index: number;
	playerMoney: number;
	onChoose: (reactionIndex: number, amount: number) => void;
	submitting: boolean;
}): ReactNode {
	const canBuy = index >= 0 && amount * pricePerToken <= playerMoney && !submitting;
	return (
		<Button
			variant={amount === firstAmount ? "primary" : "secondary"}
			disabled={!canBuy}
			onPress={canBuy ? (): void => onChoose(index, amount) : undefined}
		>
			{merchantPurchaseLabel(amount, pricePerToken)}
		</Button>
	);
}

function MerchantPurchaseActions({collector, onPurchase, onRefuse, submitting}: {
	collector: ReactionCollectorCreation;
	onPurchase: (reactionIndex: number, amount: number) => void;
	onRefuse: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT) {
		return null;
	}
	const {amounts, playerMoney, pricePerToken} = collector.data.data;
	const refuseIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.REFUSE);
	return (
		<ButtonRow>
			{amounts.map(amount => (
				<MerchantPurchaseButton
					key={amount}
					amount={amount}
					firstAmount={amounts[0]}
					pricePerToken={pricePerToken}
					index={merchantReactionIndex(collector.reactions, amount)}
					playerMoney={playerMoney}
					onChoose={onPurchase}
					submitting={submitting}
				/>
			))}
			{refuseIndex >= 0 ? (
				<Button disabled={submitting} onPress={submitting ? undefined : (): void => onRefuse(refuseIndex)}>
					{i18n.t("app:adventure.tokens.merchant.cancel")}
				</Button>
			) : null}
		</ButtonRow>
	);
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
		<Confirmation
			icon={<TwemojiIcon emoji={AppIcons.getIcon("unitValues.token")} size={Theme.dimensions.headerIcon} />}
			title={i18n.t("app:adventure.tokens.use.title")}
			message={i18n.t("app:adventure.tokens.use.description", {count: collector.data.data.cost})}
			onRequestClose={canRefuse ? (): void => onChoose(refuseIndex) : undefined}
		>
			<ButtonRow>
				<Button variant="primary" disabled={!canConfirm} onPress={canConfirm ? (): void => onChoose(acceptIndex) : undefined}>
					{i18n.t("app:adventure.tokens.use.confirm", {count: collector.data.data.cost})}
				</Button>
				<Button disabled={!canRefuse} onPress={canRefuse ? (): void => onChoose(refuseIndex) : undefined}>
					{i18n.t("app:adventure.tokens.use.cancel")}
				</Button>
			</ButtonRow>
		</Confirmation>
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
		<Confirmation
			icon={<TwemojiIcon emoji={AppIcons.getIcon("shopItems.healAlteration")} size={Theme.dimensions.headerIcon} />}
			title={i18n.t("app:adventure.heal.use.title")}
			message={i18n.t("app:adventure.heal.use.description", {
				price: data.data.healPrice,
				money: data.data.playerMoney
			})}
			onRequestClose={canRefuse ? (): void => onChoose(refuseIndex) : undefined}
		>
			<Panel>
				<KeyValue label={i18n.t("app:adventure.heal.fields.cost")} value={formatMoney(data.data.healPrice)} />
				<KeyValue label={i18n.t("app:adventure.heal.fields.balance")} value={formatMoney(data.data.playerMoney)} />
			</Panel>
			<ButtonRow>
				<Button variant="primary" disabled={!canConfirm} onPress={canConfirm ? (): void => onChoose(acceptIndex) : undefined}>
					{i18n.t("app:adventure.heal.use.confirm", {price: data.data.healPrice})}
				</Button>
				<Button disabled={!canRefuse} onPress={canRefuse ? (): void => onChoose(refuseIndex) : undefined}>
					{i18n.t("app:adventure.heal.use.cancel")}
				</Button>
			</ButtonRow>
		</Confirmation>
	);
}

function TokenMerchantCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	const [pendingPurchase, setPendingPurchase] = useState<{reactionIndex: number; amount: number} | null>(null);
	if (collector.data.type !== REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT) {
		return null;
	}
	const {maxDaily, maxWeekly, playerMoney, pricePerToken} = collector.data.data;
	const purchasePrice = (pendingPurchase?.amount ?? 0) * pricePerToken;

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.tokens.merchant.eyebrow")}
				title={i18n.t("app:adventure.tokens.merchant.title")}
				subtitle={i18n.t("app:adventure.tokens.merchant.description")}
			/>
			<TokenMerchantSummary data={collector.data} />
			<Notice
				icon={AppIcons.getIconOrNull("collectors.warning") ? <TwemojiIcon emoji={AppIcons.getIcon("collectors.warning")} size={Theme.dimensions.headerIcon} /> : undefined}
				title={i18n.t("app:adventure.tokens.merchant.limits", {maxDaily, maxWeekly})}
			/>
			<MerchantPurchaseActions
				collector={collector}
				onPurchase={(reactionIndex, amount): void => setPendingPurchase({reactionIndex, amount})}
				onRefuse={onChoose}
				submitting={submitting}
			/>
			{pendingPurchase ? (
				<Confirmation
					icon={<TwemojiIcon emoji={AppIcons.getIcon("unitValues.token")} size={Theme.dimensions.headerIcon} />}
					title={i18n.t("app:adventure.tokens.merchant.confirmTitle", {count: pendingPurchase.amount})}
					message={i18n.t("app:adventure.tokens.merchant.confirmDescription")}
					onRequestClose={() => setPendingPurchase(null)}
				>
					<Panel>
						<KeyValue label={i18n.t("app:adventure.tokens.fields.received")} value={`+${formatTokens(pendingPurchase.amount)}`} />
						<KeyValue label={i18n.t("app:adventure.tokens.fields.costMoney")} value={`-${formatMoney(purchasePrice)}`} />
						<KeyValue label={i18n.t("app:adventure.tokens.fields.remainingMoney")} value={formatMoney(playerMoney - purchasePrice)} />
					</Panel>
					<ButtonRow>
						<Button variant="primary" disabled={submitting} onPress={submitting ? undefined : (): void => onChoose(pendingPurchase.reactionIndex)}>
							{i18n.t("app:adventure.tokens.merchant.confirm")}
						</Button>
						<Button disabled={submitting} onPress={submitting ? undefined : (): void => setPendingPurchase(null)}>
							{i18n.t("app:adventure.tokens.merchant.keepMoney")}
						</Button>
					</ButtonRow>
				</Confirmation>
			) : null}
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
	[SMALL_EVENT_DATA_KINDS.PVE_ISLAND]: PveIslandInvitationCollector
};

/** The report-owned collector is rendered in the same screen hierarchy as the mobile mockup. */
export function AdventureCollector(props: AdventureCollectorProps): ReactNode {
	const SpecializedCollector = SPECIALIZED_COLLECTORS[props.collector.data.type];
	if (SpecializedCollector) {
		return <SpecializedCollector {...props} />;
	}
	const description = collectorDescription(props.collector.data);
	return (
		<Screen>
			<Hero
				eyebrow={eventEyebrow(props.collector)}
				title={collectorTitle(props.collector.data)}
				subtitle={description}
			/>
			<CollectorChoices {...props} />
		</Screen>
	);
}
function tokenOutcomeDetails(outcome: TokenOutcomeRequiringAcknowledgement): {
	eyebrow: string;
	title: string;
	description?: string;
	fields: {label: string; value: string}[];
} {
	switch (outcome.kind) {
		case "bought":
			return {
				eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"),
				title: i18n.t("app:adventure.tokens.outcomes.bought"),
				fields: [{label: i18n.t("app:adventure.tokens.fields.received"), value: `+${formatTokens(outcome.packet.amount)}`}]
			};
		case "tooMuch":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.tooMuch"), fields: []};
		case "full":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.full"), fields: []};
		case "cannotAfford":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.cannotAfford"), fields: []};
		case "charity":
			return {
				eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"),
				title: i18n.t("app:adventure.tokens.outcomes.charity"),
				fields: [{label: i18n.t("app:adventure.tokens.fields.received"), value: `+${formatTokens(outcome.packet.amount)}`}]
			};
		case "charityAlreadyUsed":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.charityAlreadyUsed"), fields: []};
		default:
			return {
				eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"),
				title: i18n.t("app:common.error"),
				fields: []
			};
	}
}

/** Keeps the player on a clear terminal screen after any token-flow action. */
export function TokenOutcome({outcome, onContinue}: {
	outcome: TokenOutcomeRequiringAcknowledgement;
	onContinue: () => void;
}): ReactNode {
	const details = tokenOutcomeDetails(outcome);
	return (
		<Screen>
			<Hero eyebrow={details.eyebrow} title={details.title} subtitle={details.description} />
			{details.fields.length > 0 ? (
				<Panel>{details.fields.map(field => <KeyValue key={field.label} label={field.label} value={field.value} />)}</Panel>
			) : null}
			<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:adventure.tokens.continue")}</Button></ButtonRow>
		</Screen>
	);
}

function healOutcomeDetails(outcome: HealOutcomeData): {title: string; description: string} {
	switch (outcome.kind) {
		case "accepted":
			return {
				title: i18n.t("app:adventure.heal.outcomes.accepted"),
				description: i18n.t(outcome.packet.isArrived
					? "app:adventure.heal.outcomes.arrived"
					: "app:adventure.heal.outcomes.nextStop", {price: outcome.packet.healPrice})
			};
		case "refused":
			return {
				title: i18n.t("app:adventure.heal.outcomes.refused"),
				description: i18n.t("app:adventure.heal.outcomes.refusedDescription")
			};
		case "noAlteration":
			return {
				title: i18n.t("app:adventure.heal.outcomes.noAlteration"),
				description: i18n.t("app:adventure.heal.outcomes.noAlterationDescription")
			};
		case "cannotHealOccupied":
			return {
				title: i18n.t("app:adventure.heal.outcomes.cannotHealOccupied"),
				description: i18n.t("app:adventure.heal.outcomes.cannotHealOccupiedDescription")
			};
		default:
			return {
				title: i18n.t("app:common.error"),
				description: i18n.t("app:common.error")
			};
	}
}

/** Shows the result of buying an alteration cure before refreshing the adventure report. */
export function HealOutcome({outcome, onContinue}: {
	outcome: HealOutcomeData;
	onContinue: () => void;
}): ReactNode {
	const details = healOutcomeDetails(outcome);
	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.heal.use.eyebrow")}
				title={details.title}
				subtitle={details.description}
			/>
			{outcome.kind === "accepted" ? (
				<Panel>
					<KeyValue label={i18n.t("app:adventure.heal.fields.spent")} value={`-${formatMoney(outcome.packet.healPrice)}`} />
				</Panel>
			) : null}
			<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:adventure.heal.continue")}</Button></ButtonRow>
		</Screen>
	);
}

/** Presents the outcome before allowing the player to continue to any following destination choice. */
export function BigEventOutcome({outcome, onContinue}: {
	outcome: ReportBigEventResultRes;
	onContinue: () => void;
}): ReactNode {
	const outcomeText = i18n.t(`events:${outcome.eventId}.possibilities.${outcome.possibilityId}.outcomes.${outcome.outcomeId}`);
	const icon = outcomeIcon(outcome);
	const changes = [
		{label: i18n.t("app:adventure.event.fields.points"), value: signed(outcome.score), show: outcome.score !== 0},
		{label: i18n.t("app:adventure.event.fields.money"), value: signed(outcome.money), show: outcome.money !== 0},
		{label: i18n.t("app:adventure.event.fields.health"), value: signed(outcome.health), show: outcome.health !== 0},
		{label: i18n.t("app:adventure.event.fields.energy"), value: signed(outcome.energy), show: outcome.energy !== 0},
		{label: i18n.t("app:adventure.event.fields.gems"), value: signed(outcome.gems), show: outcome.gems !== 0},
		{label: i18n.t("app:adventure.event.fields.tokens"), value: signed(outcome.tokens), show: outcome.tokens !== 0},
		{label: i18n.t("app:adventure.event.fields.experience"), value: signed(outcome.experience), show: outcome.experience !== 0},
		{
			label: i18n.t("app:adventure.event.fields.timeLost"),
			value: duration(outcome.effect?.time ?? 0),
			show: outcome.effect !== undefined
		}
	];

	return (
		<Screen>
			<Hero eyebrow={i18n.t("app:adventure.event.eyebrow")} title={i18n.t("app:adventure.event.resultTitle")} />
			<Notice
				icon={icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : undefined}
				title={outcomeText}
				text={i18n.t("app:adventure.event.resultDescription")}
			/>
			{changes.some(change => change.show) ? (
				<Panel>
					{changes.filter(change => change.show).map(change => (
						<KeyValue key={change.label} label={change.label} value={change.value} />
					))}
				</Panel>
			) : null}
			<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:adventure.event.continue")}</Button></ButtonRow>
		</Screen>
	);
}

/** Shows the exact resolution sent after a lottery collector is answered. */
export function LotteryOutcome({outcome, onContinue}: {
	outcome: LotteryOutcomeData;
	onContinue: () => void;
}): ReactNode {
	const fields = outcome.kind === "win"
		? [
			{
				label: i18n.t(`app:adventure.lottery.rewards.${outcome.packet.winReward}`),
				value: signed(outcome.packet.winAmount)
			},
			...(outcome.packet.lostTime > 0 ? [{
				label: i18n.t("app:adventure.event.fields.timeLost"),
				value: duration(outcome.packet.lostTime)
			}] : [])
		]
		: outcome.kind === "lose"
			? [
				...(outcome.packet.moneyLost > 0 ? [{
					label: i18n.t("app:adventure.lottery.fields.moneyLost"),
					value: signed(-outcome.packet.moneyLost)
				}] : []),
				...(outcome.packet.lostTime > 0 ? [{
					label: i18n.t("app:adventure.event.fields.timeLost"),
					value: duration(outcome.packet.lostTime)
				}] : [])
			]
			: [];

	return (
		<Screen>
			<Hero eyebrow={i18n.t("app:adventure.smallEvent.eyebrow")} title={i18n.t("app:adventure.lottery.resultTitle")} />
			<Notice icon={lotteryIcon()} title={lotteryOutcomeText(outcome)} />
			{fields.length > 0 ? (
				<Panel>
					{fields.map(field => <KeyValue key={field.label} label={field.label} value={field.value} />)}
				</Panel>
			) : null}
			<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:adventure.smallEvent.continue")}</Button></ButtonRow>
		</Screen>
	);
}

function witchOutcomeDescription(outcome: SmallEventWitchResultRes): string {
	switch (outcome.outcome) {
		case WITCH_OUTCOMES.POTION:
			return i18n.t("app:adventure.witch.outcomes.potion");
		case WITCH_OUTCOMES.EFFECT:
			return i18n.t("app:adventure.witch.outcomes.effect");
		case WITCH_OUTCOMES.LIFE_LOSS:
			return i18n.t("app:adventure.witch.outcomes.lifeLoss");
		case WITCH_OUTCOMES.NOTHING:
			return i18n.t("app:adventure.witch.outcomes.nothing");
		default:
			return i18n.t("app:adventure.witch.outcomes.nothing");
	}
}

function witchEffect(outcome: SmallEventWitchResultRes): string | null {
	if (!outcome.forceEffect && outcome.outcome !== WITCH_OUTCOMES.EFFECT) {
		return null;
	}
	const icon = AppIcons.getIconOrNull(`effects.${outcome.effectId}`);
	const label = i18n.t(`error:effects.${outcome.effectId}.self`);
	return icon ? `${icon} ${label}` : label;
}

export function WitchOutcome({outcome, onContinue}: {
	outcome: SmallEventWitchResultRes;
	onContinue: () => void;
}): ReactNode {
	const ingredientIcon = AppIcons.getIconOrNull(`witchSmallEvent.${outcome.ingredientId}`);
	const ingredient = i18n.t(`smallEvents:witch.witchEventNames.${outcome.ingredientId}`);
	const effect = witchEffect(outcome);
	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.smallEvent.eyebrow")}
				title={i18n.t("app:adventure.witch.resultTitle")}
				subtitle={witchOutcomeDescription(outcome)}
			/>
			<Panel>
				<KeyValue label={i18n.t(outcome.isIngredient ? "app:adventure.witch.fields.ingredient" : "app:adventure.witch.fields.advice")} value={ingredientIcon ? `${ingredientIcon} ${ingredient}` : ingredient} />
				{effect ? <KeyValue label={i18n.t("app:adventure.witch.fields.effect")} value={effect} /> : null}
				{outcome.outcome === WITCH_OUTCOMES.LIFE_LOSS
					? <KeyValue label={i18n.t("app:adventure.event.fields.health")} value={`-${formatNumber(outcome.lifeLoss)}`} />
					: null}
				{outcome.timeLostMinutes > 0
					? <KeyValue label={i18n.t("app:adventure.event.fields.timeLost")} value={i18n.t("app:adventure.duration.minutes", {count: outcome.timeLostMinutes})} />
					: null}
				{outcome.discoveredRecipe ? <KeyValue
					label={i18n.t("app:adventure.witch.fields.recipe")}
					value={i18n.t("models:cooking.recipeDisplay", outcome.discoveredRecipe)}
				/> : null}
			</Panel>
			<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:adventure.smallEvent.continue")}</Button></ButtonRow>
		</Screen>
	);
}
