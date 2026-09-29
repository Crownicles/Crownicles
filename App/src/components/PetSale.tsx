import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetSellReq} from "ws-packets/src/fromClient/PetManagementReq";
import {PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {Button, ButtonRow, Note} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";
import {EntryRow, ExpandableList} from "@/src/design/Sections";
import {checkWholeNumber, RANK_RANGE} from "@/src/rules/InputChecks";
import {gameRules} from "@/src/rules/GameRules";

const SALE_MENU: CommandMenu = {request: PetSellReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetManagementRes]};

export function PetSale({pet}: {pet: OwnedPet}): ReactNode {
	const [rank, setRank] = useState("");
	const [price, setPrice] = useState("");
	const {pending, message, open} = useCommandMenus();
	const buyerRank = checkWholeNumber(rank, RANK_RANGE);
	const salePrice = checkWholeNumber(price, gameRules().pet.sellPrice);
	const valid = buyerRank.lock === null && salePrice.lock === null;
	return <>
		<ExpandableList><EntryRow title={`${petIcon(pet)} ${petName(pet)}`} /></ExpandableList>
		<TextField label={i18n.t("app:pet.sale.rank")} value={rank} onChangeText={setRank} keyboardType="number-pad" editable={!pending} lock={buyerRank.lock} />
		<TextField label={i18n.t("app:pet.sale.price")} value={price} onChangeText={setPrice} keyboardType="number-pad" editable={!pending} lock={salePrice.lock} />
		{message ? <Note>{message}</Note> : null}
		<ButtonRow><Button variant="primary" disabled={pending || !valid} onPress={(): Promise<void> => open(SALE_MENU, makeFromClientPacket(PetSellReq, {rank: buyerRank.value, price: salePrice.value}))}>{i18n.t("app:pet.sale.offer")}</Button></ButtonRow>
	</>;
}