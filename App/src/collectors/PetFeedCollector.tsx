import {ReactNode} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PET_FEED_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Hero, KeyValue, Panel, Screen} from "@/src/design/Primitives";
import {ModalSurface} from "@/src/design/Sections";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney} from "@/src/display/Amounts";
import {petName} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

type PetFeedProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

function FeedMenu({collector, onChoose, submitting}: PetFeedProps): ReactNode {
	if (collector.data.type !== PET_FEED_DATA_KINDS.GUILD && collector.data.type !== PET_FEED_DATA_KINDS.PERSONAL) return null;
	return <Screen>
		<Hero eyebrow={i18n.t("app:pet.eyebrow")} title={i18n.t("app:pet.care.feedPet", {pet: petName(collector.data.data.pet)})} />
		{collector.data.type === PET_FEED_DATA_KINDS.PERSONAL ? <Panel>
			<KeyValue label={i18n.t("app:pet.care.food")} value={i18n.t(`models:foods.${collector.data.data.food}`, {count: 1})} />
			<KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(collector.data.data.price)} />
		</Panel> : null}
		<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
	</Screen>;
}

export function PetFeedCollector(props: PetFeedProps): ReactNode {
	const {locked, answer} = useCollectorAnswer(props.collector, props.onChoose, props.submitting);
	const close = (): void => {
		const index = props.collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
		answer(index);
	};
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface><FeedMenu collector={props.collector} onChoose={answer} submitting={locked} /></ModalSurface>
	</Modal>;
}