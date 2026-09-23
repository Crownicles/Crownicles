import {ReactNode} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PET_MANAGEMENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {PET_SALE_ROLES, PetSaleOffer} from "ws-packets/src/objects/PetManagement";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton, ExpandableList, Fact, Figures, ModalSurface, Standing} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

function SaleParties({offer}: {offer: PetSaleOffer}): ReactNode {
	return <ExpandableList>
		<Fact label={i18n.t("app:pet.sale.seller")} value={offer.sellerName ?? i18n.t("app:profile.values.unknown")} />
		<Fact label={i18n.t("app:pet.sale.buyer")} value={offer.buyerName ?? i18n.t("app:profile.values.unknown")} />
	</ExpandableList>;
}

/** Each side of the sale has its own lever: the buyer buys, the seller may take the offer back. */
function SaleRoleActions({offer, locked, acceptIndex, refuseIndex, onAnswer, onClose}: {
	offer: PetSaleOffer;
	locked: boolean;
	acceptIndex: number;
	refuseIndex: number;
	onAnswer: (index: number) => void;
	onClose: () => void;
}): ReactNode {
	switch (offer.role) {
		case PET_SALE_ROLES.SELLER:
			return <>
				<Note>{i18n.t("app:pet.sale.waiting")}</Note>
				<ButtonRow><Button disabled={locked || refuseIndex < 0} onPress={onClose}>{i18n.t("app:pet.sale.cancel")}</Button></ButtonRow>
			</>;
		case PET_SALE_ROLES.BUYER:
			return <ActionBanner
				icon={Check}
				label={i18n.t("app:pet.sale.buy")}
				pending={locked || acceptIndex < 0}
				onPress={(): void => onAnswer(acceptIndex)}
			/>;
		default:
			return null;
	}
}

export function PetSellCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked, secondsLeft} = useCollectorAnswer(collector, onChoose, submitting);
	if (collector.data.type !== PET_MANAGEMENT_DATA_KINDS.SELL) return null;
	const offer = collector.data.data;
	const acceptIndex = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT);
	const refuseIndex = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	const observer = offer.role === PET_SALE_ROLES.OBSERVER;
	const close = (): void => {
		if (!observer) answer(refuseIndex);
	};
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			<Screen>
				{observer ? null : <BackButton label={i18n.t(offer.role === PET_SALE_ROLES.SELLER ? "app:pet.sale.cancel" : "app:pet.sale.refuse")} onClose={close} />}
				<Standing
					caption={i18n.t("app:pet.sale.offerTitle")}
					title={petName(offer.pet)}
					emblem={petIcon(offer.pet)}
				/>
				<Figures items={[{caption: i18n.t("app:pet.sale.price"), value: formatNumber(offer.price), unit: "money"}]} />
				<SaleParties offer={offer} />
				<SaleRoleActions
					offer={offer}
					locked={locked}
					acceptIndex={acceptIndex}
					refuseIndex={refuseIndex}
					onAnswer={answer}
					onClose={close}
				/>
				<Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note>
			</Screen>
		</ModalSurface>
	</Modal>;
}
