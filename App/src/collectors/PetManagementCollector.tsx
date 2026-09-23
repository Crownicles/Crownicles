import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PET_MANAGEMENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Note, Screen} from "@/src/design/Primitives";
import {Figures, ModalSurface, SheetModal, Standing} from "@/src/design/Sections";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {PetTransferScreen} from "@/src/collectors/PetTransferScreen";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type ManagementProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

function ManagementMenu(props: ManagementProps): ReactNode {
	const {collector} = props;
	if (collector.data.type === PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM) return <Screen>
		<Standing caption={i18n.t("app:pet.eyebrow")} title={i18n.t("app:pet.management.free")} subtitle={expeditionPetName(collector.data.data.pet)} />
		<Note>{i18n.t("app:pet.management.irreversible")}</Note>
		<Figures items={[
			{
				caption: i18n.t("app:pet.management.origin"),
				value: i18n.t(collector.data.data.isFromShelter ? "app:pet.management.shelter" : "app:pet.management.ownPet")
			},
			{
				caption: i18n.t("app:pet.care.price"), value: formatNumber(collector.data.data.freeCost), unit: "money"
			}
		]} />
		<CollectorChoices {...props} />
	</Screen>;
	return <Screen>
		<Standing caption={i18n.t("app:pet.eyebrow")} title={i18n.t("app:pet.management.free")} />
		<CollectorChoices {...props} />
	</Screen>;
}

export function PetManagementCollector({collector, onChoose, submitting}: ManagementProps): ReactNode {
	const {answer, answered, locked} = useCollectorAnswer(collector, onChoose, submitting);
	const close = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));

	/*
	 * The question is settled the moment the answer leaves: the window closes on its own instead of
	 * waiting for the server to stop the collector. Waiting would leave the player behind a locked
	 * screen if that packet never arrived, and would put the result window on top of this one.
	 */
	return <SheetModal visible={!answered} onRequestClose={close}>
		<ModalSurface>
			{collector.data.type === PET_MANAGEMENT_DATA_KINDS.TRANSFER
				? <PetTransferScreen collector={collector} locked={locked} onChoose={answer} onClose={close} />
				: <ManagementMenu collector={collector} onChoose={answer} submitting={locked} />}
		</ModalSurface>
	</SheetModal>;
}