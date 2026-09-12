import {ReactNode} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildShelterReq, PetTransferReq, PetFreeReq} from "ws-packets/src/fromClient/PetManagementReq";
import {GuildShelterRes, GuildShelterEmptyRes, PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {petIcon, petMood, petName, petRarity} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

export const PET_MANAGEMENT_MENUS = {
	TRANSFER: {request: PetTransferReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetManagementRes]},
	FREE: {request: PetFreeReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetManagementRes]}
} satisfies Record<string, CommandMenu>;

export function GuildShelter(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.SHELTER, () => GameClient.request(makeFromClientPacket(GuildShelterReq, {}), GuildShelterRes, [GuildShelterEmptyRes]));
	const {pending, message, open} = useCommandMenus();
	return <>
		<ButtonRow><Button variant="primary" disabled={pending} onPress={(): Promise<void> => open(PET_MANAGEMENT_MENUS.TRANSFER)}>{i18n.t("app:pet.management.transfer")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
		{state.status === "empty" ? <Note>{i18n.t("app:pet.management.emptyShelter")}</Note> : <GameQueryContent state={state} entity={GAME_ENTITIES.SHELTER}>{data => <>
			<SectionHeader action={{hint: i18n.t("app:profile.formats.progress", {value: data.pets.length, max: data.maxCount})}}>{data.guildName}</SectionHeader>
			<Panel>{data.pets.map((pet, slot) => ({pet, slot})).map(({pet, slot}) => <Row key={slot} title={`${petIcon(pet)} ${petName(pet)}`} subtitle={`${petRarity(pet)} · ${petMood(pet)}`} />)}</Panel>
		</>}</GameQueryContent>}
	</>;
}