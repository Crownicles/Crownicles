import {
	ReactNode, useState
} from "react";
import { Text } from "react-native";
import { ReactionCollectorCreation } from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	DEFENSE_DATA_KINDS, DEFENSE_REACTION_KINDS, GENERIC_REACTION_KINDS, ReactionCollectorDataOf
} from "ws-packets/src/fromServer/collectors";
import { DefenseRecord } from "ws-packets/src/objects/DefenseRecord";
import { countdownLabel } from "@/src/collectors/CollectorPrompt";
import { useCollectorAnswer } from "@/src/collectors/useCollectorAnswer";
import {
	Note, SectionHeader
} from "@/src/design/Primitives";
import {
	ActionBanner, ENTRY_CHEVRONS, ExpandableEntry, ExpandableList, Gauge, Lock, QuestionSheet, useSectionStyles
} from "@/src/design/Sections";
import {
	Check, Clock3, Shield
} from "@/src/design/FightIcons";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { useColors } from "@/src/design/ThemeContext";
import { Theme } from "@/src/design/Theme";
import { className } from "@/src/display/Classes";
import {
	defenseStyleDescription, defenseStyleIcon, defenseStyleName
} from "@/src/display/DefenseStyles";
import { i18n } from "@/src/translations/i18n";

const STYLE_EMBLEM_SIZE = 26;

type DefenseCollectorProps = {
	collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean;
};

type DefenseData = ReactionCollectorDataOf<typeof DEFENSE_DATA_KINDS.COLLECTOR>["data"];

/** The position in the collector is the answer, so every style carries the index it was sent at; no personality is the random one. */
type DefenseStyleChoice = {
	index: number; personality?: string;
};

function defenseStyleChoices(collector: ReactionCollectorCreation): DefenseStyleChoice[] {
	return collector.reactions.flatMap((reaction, index) => reaction.type === DEFENSE_REACTION_KINDS.STYLE
		? [
			{
				index, ...reaction.data.personality ? { personality: reaction.data.personality } : {}
			}
		]
		: []);
}

function DefenseStyleEmblem({
	personality, size
}: {
	personality: string | undefined; size: number;
}): ReactNode {
	const colors = useColors();
	const icon = defenseStyleIcon(personality);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : <Shield size={size} color={colors.muted} />;
}

/** How the player held against each class lately: the styles say which attackers they resist best. */
function RecentDefenses({
	records, days
}: {
	records: DefenseRecord[]; days: number;
}): ReactNode {
	const colors = useColors();
	return <>
		<SectionHeader>{i18n.t("commands:defense.recentDefensesTitle", { count: days })}</SectionHeader>
		{records.length === 0
			? <Note>{i18n.t("commands:defense.noRecentDefense")}</Note>
			: <ExpandableList>{records.map(record => <Gauge
				key={record.attackerClassId}
				label={className(record.attackerClassId)}
				value={i18n.t("app:defense.won", {
					count: record.won, total: record.defenses
				})}
				ratio={record.defenses > 0 ? record.won / record.defenses : 0}
				color={colors.green}
			/>)}</ExpandableList>}
	</>;
}

/** A tap picks a style, the single button below adopts it; the style defending the player now says so. */
function DefenseStyles({
	choices, current, selected, onSelect
}: {
	choices: DefenseStyleChoice[]; current: string | undefined; selected: number | undefined; onSelect: (index: number) => void;
}): ReactNode {
	const sectionStyles = useSectionStyles();
	return <>
		<SectionHeader>{i18n.t("app:defense.styles")}</SectionHeader>
		<ExpandableList>{choices.map(choice => <ExpandableEntry
			key={choice.index}
			emblem={<DefenseStyleEmblem personality={choice.personality} size={STYLE_EMBLEM_SIZE} />}
			label={defenseStyleName(choice.personality)}
			caption={defenseStyleDescription(choice.personality)}
			{...choice.personality === current ? { end: <Text style={sectionStyles.you}>{i18n.t("app:defense.current")}</Text> } : {}}
			expanded={selected === choice.index}
			highlighted={selected === choice.index}
			chevron={ENTRY_CHEVRONS.NONE}
			onToggle={(): void => onSelect(choice.index)}
		/>)}</ExpandableList>
	</>;
}

/** Why the picked style cannot be adopted: the offer ran out, or it already defends the player. */
function adoptionLock(expired: boolean, chosen: DefenseStyleChoice | undefined, current: string | undefined): Lock | undefined {
	if (expired) {
		return {
			reason: i18n.t("app:collector.expired"), icon: Clock3
		};
	}
	return chosen && chosen.personality === current ? { reason: i18n.t("app:defense.alreadyCurrent") } : undefined;
}

/** Leaving the sheet answers the refusal, which changes nothing; the shared answer guard sends a single reaction before the offer runs out. */
function DefenseMenu({
	collector, data, onChoose, submitting
}: DefenseCollectorProps & { data: DefenseData }): ReactNode {
	const [selected, setSelected] = useState<number | undefined>();
	const {
		answered, secondsLeft, answer
	} = useCollectorAnswer(collector, onChoose, submitting);
	const choices = defenseStyleChoices(collector);
	const chosen = choices.find(choice => choice.index === selected);
	const pending = submitting || answered;
	const lock = adoptionLock(secondsLeft === 0, chosen, data.currentPersonality);
	return <QuestionSheet
		caption={i18n.t("app:arena.eyebrow")}
		title={i18n.t("app:defense.title")}
		subtitle={i18n.t("app:defense.currentStyle", { name: defenseStyleName(data.currentPersonality) })}
		emblem={<DefenseStyleEmblem personality={data.currentPersonality} size={Theme.dimensions.headerIcon} />}
		onClose={(): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE))}
		testID="defense-sheet"
	>
		<Note>{i18n.t("commands:defense.intro", { className: i18n.t(`models:classes.${data.classId}`) })}</Note>
		<RecentDefenses records={data.recentDefenses} days={data.recentDefensesDays} />
		<DefenseStyles choices={choices} current={data.currentPersonality} selected={selected} onSelect={setSelected} />
		<ActionBanner
			icon={Check}
			label={i18n.t("app:defense.choose")}
			pending={pending}
			disabled={chosen === undefined}
			onPress={(): void => {
				if (chosen !== undefined && !lock) {
					answer(chosen.index);
				}
			}}
			{...lock ? { lock } : {}}
		/>
		<Note>{countdownLabel(secondsLeft, pending)}</Note>
	</QuestionSheet>;
}

/** The styles the class of the player can defend with, and its recent defenses to pick one; leaving it changes nothing. */
export function DefenseCollector(props: DefenseCollectorProps): ReactNode {
	const { collector } = props;
	if (collector.data.type !== DEFENSE_DATA_KINDS.COLLECTOR) {
		return null;
	}
	return <DefenseMenu {...props} data={collector.data.data} />;
}
