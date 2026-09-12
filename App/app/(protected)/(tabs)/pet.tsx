import {ReactNode, useState} from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {PetFeedReq} from "ws-packets/src/fromClient/PetCareReq";
import {PetFeedRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {PetExpeditionReq} from "ws-packets/src/fromClient/PetExpeditionReq";
import {PetExpeditionErrorRes, PetExpeditionRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {Hero, KeyValue, Note, Panel, QuickAction, QuickActions, Row, Screen, SectionHeader} from "@/src/design/Primitives";
import {DetailScreen} from "@/src/design/DetailScreen";
import {PetNickname} from "@/src/components/PetNickname";
import {usePetActions} from "@/src/store/usePetActions";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {petIcon, petMood, petName, petNickname, petRarity, petSex, petTypeName} from "@/src/display/PetDisplay";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {useGameDeadline} from "@/src/store/useGameDeadline";
import {missionDate} from "@/src/display/Missions";
import {GuildShelter, PET_MANAGEMENT_MENUS} from "@/src/components/PetManagement";

const FEED_MENU: CommandMenu = {request: PetFeedReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetFeedRes]};
const EXPEDITION_MENU: CommandMenu = {request: PetExpeditionReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetExpeditionRes, PetExpeditionErrorRes]};

const styles = StyleSheet.create({
	centered: {
		flex: 1, alignItems: "center", justifyContent: "center", padding: Theme.spacing.xxl, backgroundColor: Theme.colors.wash
	},
	message: {
		color: Theme.colors.muted, fontSize: Theme.fontSize.body, textAlign: "center"
	}
});

function Centered({ children }: { children: ReactNode }): ReactNode {
	return <View style={styles.centered}>{children}</View>;
}

function PetSheet({packet, onRename, onShelter}: {packet: PetRes; onRename: () => void; onShelter: () => void}): ReactNode {
	const pet = packet.pet;
	const {pending, message, care} = usePetActions();
	const menus = useCommandMenus();
	useGameDeadline(GAME_ENTITIES.PET, packet.expeditionInProgress?.endTime ?? null);

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:pet.eyebrow")}
				title={`${petIcon(pet)} ${petName(pet)}`}
				subtitle={`${petTypeName(pet)} · ${petRarity(pet)}`}
			/>
			<QuickActions>
				{!packet.expeditionInProgress ? <QuickAction icon={AppIcons.getIcon("petCommand.pet")} disabled={pending} onPress={(): void => {care({type: "caress"}).catch(console.error);}}>{i18n.t("app:pet.care.caress")}</QuickAction> : null}
				{!packet.expeditionInProgress ? <QuickAction icon={AppIcons.getIcon("foods.commonFood")} disabled={menus.pending} onPress={(): Promise<void> => menus.open(FEED_MENU)}>{i18n.t("app:pet.care.feed")}</QuickAction> : null}
				<QuickAction icon={AppIcons.getIcon("commands.map")} disabled={menus.pending} onPress={(): Promise<void> => menus.open(EXPEDITION_MENU)}>{i18n.t("app:expedition.open")}</QuickAction>
				<QuickAction icon={AppIcons.getIcon("badges.redactor")} onPress={onRename}>{i18n.t("app:pet.care.rename")}</QuickAction>
			</QuickActions>
			{message ? <Note>{message}</Note> : null}
			{menus.message ? <Note>{menus.message}</Note> : null}
			{packet.expeditionInProgress ? <Note>{i18n.t("app:expedition.overview", {date: missionDate(packet.expeditionInProgress.endTime)})}</Note> : null}

			<SectionHeader>{i18n.t("app:pet.titles.sheet")}</SectionHeader>
			<Panel>
				<KeyValue label={i18n.t("app:pet.fields.type")} value={`${petIcon(pet)} ${petTypeName(pet)}`} />
				<KeyValue label={i18n.t("app:pet.fields.nickname")} value={petNickname(pet)} />
				<KeyValue label={i18n.t("app:pet.fields.rarity")} value={petRarity(pet)} />
				<KeyValue label={i18n.t("app:pet.fields.sex")} value={petSex(pet)} />
			</Panel>

			<SectionHeader>{i18n.t("app:pet.titles.mood")}</SectionHeader>
			<Panel>
				<KeyValue label={i18n.t("app:pet.fields.mood")} value={petMood(pet)} />
			</Panel>
			<SectionHeader>{i18n.t("app:pet.management.title")}</SectionHeader>
			<Panel>
				<Row title={i18n.t("app:pet.management.shelter")} onPress={onShelter} chevron />
				<Row title={i18n.t("app:pet.management.transfer")} disabled={menus.pending} onPress={(): Promise<void> => menus.open(PET_MANAGEMENT_MENUS.TRANSFER)} chevron />
				<Row title={i18n.t("app:pet.management.free")} tone="danger" disabled={menus.pending} onPress={(): Promise<void> => menus.open(PET_MANAGEMENT_MENUS.FREE)} chevron />
			</Panel>
		</Screen>
	);
}

export default function Pet(): ReactNode {
	const [renaming, setRenaming] = useState(false);
	const [shelter, setShelter] = useState(false);
	const state = useGameQuery<PetRes>(
		GAME_ENTITIES.PET,
		() => GameClient.request(makeFromClientPacket(PetReq, { askedPlayer: {} }), PetRes, [PetNotFound])
	);
	if (shelter) return <DetailScreen title={i18n.t("app:pet.management.shelter")} eyebrow={i18n.t("app:pet.eyebrow")} onClose={(): void => setShelter(false)}><GuildShelter /></DetailScreen>;
	if (renaming && state.status === "ready") return <DetailScreen title={i18n.t("app:pet.care.rename")} eyebrow={i18n.t("app:pet.eyebrow")} onClose={(): void => setRenaming(false)}><PetNickname pet={state.data.pet} /></DetailScreen>;

	switch (state.status) {
		case "loading":
			return <Centered><ActivityIndicator /></Centered>;
		case "empty":
			return <Screen><Note>{i18n.t("app:pet.noPet")}</Note><Panel><Row title={i18n.t("app:pet.management.shelter")} onPress={(): void => setShelter(true)} chevron /></Panel></Screen>;
		case "failed":
			return <Centered><Text style={styles.message}>{state.rejection ? commandRejectionMessage(state.rejection) : i18n.t("app:common.error")}</Text></Centered>;
		default:
			return <PetSheet packet={state.data} onRename={(): void => setRenaming(true)} onShelter={(): void => setShelter(true)} />;
	}
}
