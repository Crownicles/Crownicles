import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {collectorDescription, eventPromptIcon} from "@/src/collectors/CollectorLabels";
import {EventJournal} from "@/src/collectors/EventOutcomeScreen";
import {Screen} from "@/src/design/Primitives";

export function PveIslandInvitationCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.PVE_ISLAND) {
		return null;
	}

	return (
		<Screen>
			<EventJournal emoji={eventPromptIcon(collector.data)} story={collectorDescription(collector.data) ?? ""} />
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</Screen>
	);
}
