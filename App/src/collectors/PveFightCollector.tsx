import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {REPORT_COLLECTOR_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {MonsterStats} from "ws-packets/src/objects/Fight";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {collectorDescription, eventPromptIcon} from "@/src/collectors/CollectorLabels";
import {EventJournal, EventOutcomeScreen} from "@/src/collectors/EventOutcomeScreen";
import {PVE_FIGHT_OUTCOMES, PveFightOutcome} from "@/src/collectors/ReportEventStore";
import {Note, Screen} from "@/src/design/Primitives";
import {Figures, Standing} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const MONSTER_STATS = ["energy", "attack", "defense", "speed"] as const;

/** The boss the player is about to face, with the numbers Discord prints under its story. */
function MonsterCard({monster}: {monster: MonsterStats}): ReactNode {
	const icon = AppIcons.getIconOrNull(`monsters.${monster.id}`);
	return <>
		<Standing
			{...icon ? {emblem: <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} />} : {}}
			caption={i18n.t("app:battle.level", {level: monster.level})}
			title={i18n.t(`models:monsters.${monster.id}.name`)}
		/>
		<Note>{i18n.t(`models:monsters.${monster.id}.description`)}</Note>
		<Figures items={MONSTER_STATS.map(stat => ({caption: i18n.t(`app:adventure.pveFight.stats.${stat}`), value: formatNumber(monster[stat]), unit: stat}))} />
	</>;
}

export function PveFightCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== REPORT_COLLECTOR_DATA_KINDS.PVE_FIGHT) {
		return null;
	}

	return (
		<Screen>
			<EventJournal emoji={eventPromptIcon(collector.data)} story={collectorDescription(collector.data) ?? ""} />
			<MonsterCard monster={collector.data.data.monster} />
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</Screen>
	);
}

const PVE_FIGHT_OUTCOME_TEXTS: Record<PveFightOutcome, {icon: string; story: string}> = {
	[PVE_FIGHT_OUTCOMES.REFUSED]: {icon: "pveFights.waitABit", story: "commands:report.pveFightRefusedStory"},
	[PVE_FIGHT_OUTCOMES.NO_MONSTER]: {icon: "collectors.warning", story: "commands:fight.monsterNotFound"}
};

/** An encounter that ended without a fight: the player hid, or the island had no boss to offer. */
export function PveFightOutcomeScreen({outcome, onContinue}: {outcome: PveFightOutcome; onContinue: () => void}): ReactNode {
	const {icon, story} = PVE_FIGHT_OUTCOME_TEXTS[outcome];
	return <EventOutcomeScreen
		emoji={AppIcons.getIconOrNull(icon) ?? undefined}
		story={i18n.t(story)}
		effects={[]}
		continueLabel={i18n.t("app:adventure.continueReport")}
		onContinue={onContinue}
	/>;
}
