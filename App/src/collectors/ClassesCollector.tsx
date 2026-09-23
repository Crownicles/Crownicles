import {ReactNode} from "react";
import {Modal} from "react-native";
import {AvailableClass} from "ws-packets/src/objects/ClassDetails";
import {CLASSES_DATA_KINDS, CLASSES_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton, ExpandableEntry, ExpandableList, ModalSurface, Standing} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {useExpandedEntry} from "@/src/design/useExpandedEntry";
import {ClassStatistics} from "@/src/components/ClassStatistics";
import {className} from "@/src/display/Classes";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

type ClassChoice = {details: AvailableClass; index: number};
const SECONDS_PER_MINUTE = 60;

function classChoices(collector: ReactionCollectorCreation): ClassChoice[] {
	if (collector.data.type !== CLASSES_DATA_KINDS.COLLECTOR) return [];
	const classes = collector.data.data.classesDetails;
	return collector.reactions.flatMap((reaction, index) => {
		if (reaction.type !== CLASSES_REACTION_KINDS.CHOOSE) return [];
		const details = classes.find(entry => entry.id === reaction.data.classId);
		return details ? [{details, index}] : [];
	});
}

/** A class shows its statistics where it stands, and is confirmed there too. */
function ClassEntry({choice, locked, expanded, onToggle, onConfirm}: {
	choice: ClassChoice;
	locked: boolean;
	expanded: boolean;
	onToggle: () => void;
	onConfirm: () => void;
}): ReactNode {
	return <ExpandableEntry
		label={className(choice.details.id)}
		dimmed={locked}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ClassStatistics stats={{...choice.details, fightPoint: choice.details.energy, baseBreath: choice.details.initialBreath}} />
		<ActionBanner
			icon={Check}
			label={i18n.t("app:classes.confirm", {name: i18n.t(`models:classes.${choice.details.id}`)})}
			pending={locked}
			onPress={onConfirm}
		/>
	</ExpandableEntry>;
}

export function ClassesCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {isExpanded, toggle, collapse} = useExpandedEntry<number>();
	const {locked, secondsLeft, answer} = useCollectorAnswer(collector, onChoose, submitting);
	const choose = (index: number): void => {
		collapse();
		answer(index);
	};
	if (collector.data.type !== CLASSES_DATA_KINDS.COLLECTOR) return null;
	const close = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));

	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			<Screen>
				<BackButton label={i18n.t("app:collector.refuse")} onClose={close} />
				<Standing
					caption={i18n.t("app:profile.eyebrow")}
					title={i18n.t("app:classes.change")}
					subtitle={i18n.t("app:classes.cooldownAfter", {duration: formatDurationMinutes(collector.data.data.cooldownSeconds / SECONDS_PER_MINUTE)})}
				/>
				<ExpandableList>
					{classChoices(collector).map(choice => <ClassEntry
						key={choice.index}
						choice={choice}
						locked={locked}
						expanded={isExpanded(choice.index)}
						onToggle={(): void => toggle(choice.index)}
						onConfirm={(): void => choose(choice.index)}
					/>)}
				</ExpandableList>
				<Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note>
			</Screen>
		</ModalSurface>
	</Modal>;
}
