import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	BIG_EVENT_DATA_KINDS, GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS,
	REPORT_COLLECTOR_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {collectorDescription, collectorTitle} from "@/src/collectors/CollectorLabels";
import type {
	LotteryOutcome as LotteryOutcomeData, TokenOutcome as TokenOutcomeData
} from "@/src/collectors/ReportEventStore";
import {
	Button, ButtonRow, Hero, KeyValue, Notice, Panel, Screen, StatBar
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

function tokenCount(value: number): string {
	return value.toLocaleString("fr-FR");
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
		: i18n.t("app:adventure.duration.minutes", {minutes});
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
	}
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
	const canConfirm = acceptIndex >= 0 && !submitting;
	const canRefuse = refuseIndex >= 0 && !submitting;

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.tokens.use.eyebrow")}
				title={i18n.t("app:adventure.tokens.use.title")}
				subtitle={i18n.t("app:adventure.tokens.use.description")}
			/>
			<Panel>
				<KeyValue label={i18n.t("app:adventure.tokens.fields.cost")} value={`${collector.data.data.cost} 🪙`} />
				<KeyValue label={i18n.t("app:adventure.tokens.fields.balance")} value={`${collector.data.data.playerTokens} 🪙`} />
			</Panel>
			<ButtonRow>
				<Button variant="primary" disabled={!canConfirm} onPress={canConfirm ? (): void => onChoose(acceptIndex) : undefined}>
					{i18n.t("app:adventure.tokens.use.confirm", {count: collector.data.data.cost})}
				</Button>
				<Button disabled={!canRefuse} onPress={canRefuse ? (): void => onChoose(refuseIndex) : undefined}>
					{i18n.t("app:adventure.tokens.use.cancel")}
				</Button>
			</ButtonRow>
		</Screen>
	);
}

function TokenMerchantCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT) {
		return null;
	}
	const {amounts, maxDaily, maxTokens, maxWeekly, playerMoney, playerTokens, pricePerToken} = collector.data.data;
	const refuseIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.REFUSE);

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.tokens.merchant.eyebrow")}
				title={i18n.t("app:adventure.tokens.merchant.title")}
				subtitle={i18n.t("app:adventure.tokens.merchant.description")}
			/>
			<Panel>
				<StatBar
					label={i18n.t("app:adventure.tokens.fields.balance")}
					value={`${tokenCount(playerTokens)} / ${tokenCount(maxTokens)} 🪙`}
					ratio={maxTokens === 0 ? 0 : playerTokens / maxTokens}
					color={Theme.colors.gold}
				/>
				<KeyValue label={i18n.t("app:adventure.tokens.fields.price")} value={`${tokenCount(pricePerToken)} 💰`} />
				<KeyValue label={i18n.t("app:adventure.tokens.fields.money")} value={`${tokenCount(playerMoney)} 💰`} />
			</Panel>
			<Notice
				icon={AppIcons.getIconOrNull("collectors.warning") ? <TwemojiIcon emoji={AppIcons.getIcon("collectors.warning")} size={Theme.dimensions.headerIcon} /> : undefined}
				title={i18n.t("app:adventure.tokens.merchant.limits", {maxDaily, maxWeekly})}
			/>
			<ButtonRow>
				{amounts.map(amount => {
					const index = collector.reactions.findIndex(reaction => reaction.type === REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY
						&& reaction.data.amount === amount);
					const canBuy = index >= 0 && !submitting;
					const label = amount === 1
						? i18n.t("app:adventure.tokens.merchant.buyOne", {amount, price: amount * pricePerToken})
						: i18n.t("app:adventure.tokens.merchant.buyMany", {amount, price: amount * pricePerToken});
					return (
						<Button key={amount} variant={amount === amounts[0] ? "primary" : "secondary"} disabled={!canBuy} onPress={canBuy ? (): void => onChoose(index) : undefined}>
							{label}
						</Button>
					);
				})}
				{refuseIndex >= 0 ? (
					<Button disabled={submitting} onPress={submitting ? undefined : (): void => onChoose(refuseIndex)}>
						{i18n.t("app:adventure.tokens.merchant.cancel")}
					</Button>
				) : null}
			</ButtonRow>
		</Screen>
	);
}

/** The report-owned collector is rendered in the same screen hierarchy as the mobile mockup. */
export function AdventureCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type === REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS) {
		return <TokenUseCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
	}
	if (collector.data.type === REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT) {
		return <TokenMerchantCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
	}
	const description = collectorDescription(collector.data);
	return (
		<Screen>
			<Hero
				eyebrow={eventEyebrow(collector)}
				title={collectorTitle(collector.data)}
				subtitle={description}
			/>
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</Screen>
	);
}

function tokenOutcomeDetails(outcome: TokenOutcomeData): {
	eyebrow: string;
	title: string;
	description?: string;
	fields: {label: string; value: string}[];
} {
	switch (outcome.kind) {
		case "used":
			return {
				eyebrow: i18n.t("app:adventure.tokens.use.eyebrow"),
				title: i18n.t("app:adventure.tokens.outcomes.used"),
				description: i18n.t(outcome.packet.isArrived
					? "app:adventure.tokens.outcomes.arrived"
					: "app:adventure.tokens.outcomes.nextStop"),
				fields: [{
					label: i18n.t("app:adventure.tokens.fields.spent"),
					value: `-${tokenCount(outcome.packet.tokensSpent)} 🪙`
				}]
			};
		case "useRefused":
			return {eyebrow: i18n.t("app:adventure.tokens.use.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.useRefused"), fields: []};
		case "bought":
			return {
				eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"),
				title: i18n.t("app:adventure.tokens.outcomes.bought"),
				fields: [{label: i18n.t("app:adventure.tokens.fields.received"), value: `+${tokenCount(outcome.packet.amount)} 🪙`}]
			};
		case "tooMuch":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.tooMuch"), fields: []};
		case "full":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.full"), fields: []};
		case "merchantRefused":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.merchantRefused"), fields: []};
		case "cannotAfford":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.cannotAfford"), fields: []};
		case "charity":
			return {
				eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"),
				title: i18n.t("app:adventure.tokens.outcomes.charity"),
				fields: [{label: i18n.t("app:adventure.tokens.fields.received"), value: `+${tokenCount(outcome.packet.amount)} 🪙`}]
			};
		case "charityAlreadyUsed":
			return {eyebrow: i18n.t("app:adventure.tokens.merchant.eyebrow"), title: i18n.t("app:adventure.tokens.outcomes.charityAlreadyUsed"), fields: []};
	}
}

/** Keeps the player on a clear terminal screen after any token-flow action. */
export function TokenOutcome({outcome, onContinue}: {
	outcome: TokenOutcomeData;
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
