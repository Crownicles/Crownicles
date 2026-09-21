import {ReactNode} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PET_MANAGEMENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Hero, KeyValue, Note, Panel, Screen} from "@/src/design/Primitives";
import {ModalSurface} from "@/src/design/Sections";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {PetTransferScreen} from "@/src/collectors/PetTransferScreen";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type ManagementProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

function ManagementMenu(props: ManagementProps): ReactNode {
	const {collector} = props;
	if (collector.data.type === PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM) return <Screen>
		<Hero eyebrow={i18n.t("app:pet.eyebrow")} title={i18n.t("app:pet.management.free")} subtitle={expeditionPetName(collector.data.data.pet)} />
		<Note>{i18n.t("app:pet.management.irreversible")}</Note>
		<Panel>
			<KeyValue label={i18n.t("app:pet.management.origin")} value={i18n.t(collector.data.data.isFromShelter ? "app:pet.management.shelter" : "app:pet.management.ownPet")} />
			<KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(collector.data.data.freeCost)} />
		</Panel>
		<CollectorChoices {...props} />
	</Screen>;
	return <Screen>
		<Hero eyebrow={i18n.t("app:pet.eyebrow")} title={i18n.t("app:pet.management.free")} />
		<CollectorChoices {...props} />
	</Screen>;
}

export function PetManagementCollector({collector, onChoose, submitting}: ManagementProps): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	const close = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			{collector.data.type === PET_MANAGEMENT_DATA_KINDS.TRANSFER
				? <PetTransferScreen collector={collector} locked={locked} onChoose={answer} onClose={close} />
				: <ManagementMenu collector={collector} onChoose={answer} submitting={locked} />}
		</ModalSurface>
	</Modal>;
}