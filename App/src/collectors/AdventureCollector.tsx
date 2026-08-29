import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {BIG_EVENT_DATA_KINDS, REPORT_COLLECTOR_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {collectorDescription, collectorTitle} from "@/src/collectors/CollectorLabels";
import {Button, ButtonRow, Hero, KeyValue, Notice, Panel, Screen} from "@/src/design/Primitives";
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

/** The report-owned collector is rendered in the same screen hierarchy as the mobile mockup. */
export function AdventureCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
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
