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
import {PetSale} from "@/src/components/PetSale";
import {PetPowers} from "@/src/components/PetPowers";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";

const FEED_MENU: CommandMenu = {request: PetFeedReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetFeedRes]};
const EXPEDITION_MENU: CommandMenu = {request: PetExpeditionReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetExpeditionRes, PetExpeditionErrorRes]};
const PET_PAGES = {OVERVIEW: "overview", RENAME: "rename", SHELTER: "shelter", SELL: "sell", POWERS: "powers"} as const;
type PetPage = typeof PET_PAGES[keyof typeof PET_PAGES];
const PET_PAGE_TITLES = {
	[PET_PAGES.OVERVIEW]: "app:pet.titles.sheet",
	[PET_PAGES.RENAME]: "app:pet.care.rename",
	[PET_PAGES.SHELTER]: "app:pet.management.shelter",
	[PET_PAGES.SELL]: "app:pet.sale.title",
	[PET_PAGES.POWERS]: "app:pet.powers.title"
} as const;

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

function PetSheet({packet, onPage}: {packet: PetRes; onPage: (page: PetPage) => void}): ReactNode {
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
				<QuickAction icon={AppIcons.getIcon("badges.redactor")} onPress={(): void => onPage(PET_PAGES.RENAME)}>{i18n.t("app:pet.care.rename")}</QuickAction>
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
				<Row title={i18n.t("app:pet.powers.title")} onPress={(): void => onPage(PET_PAGES.POWERS)} chevron />
				<Row title={i18n.t("app:pet.management.shelter")} onPress={(): void => onPage(PET_PAGES.SHELTER)} chevron />
				<Row title={i18n.t("app:pet.management.transfer")} disabled={menus.pending} onPress={(): Promise<void> => menus.open(PET_MANAGEMENT_MENUS.TRANSFER)} chevron />
				<Row title={i18n.t("app:pet.sale.title")} onPress={(): void => onPage(PET_PAGES.SELL)} chevron />
				<Row title={i18n.t("app:pet.management.free")} tone="danger" disabled={menus.pending} onPress={(): Promise<void> => menus.open(PET_MANAGEMENT_MENUS.FREE)} chevron />
			</Panel>
		</Screen>
	);
}

function PetDetails({page, pet}: {page: PetPage; pet: OwnedPet | null}): ReactNode {
	if (page === PET_PAGES.SHELTER) return <GuildShelter />;
	if (page === PET_PAGES.POWERS) return <PetPowers />;
	if (!pet) return <Note>{i18n.t("app:pet.noPet")}</Note>;
	return page === PET_PAGES.RENAME ? <PetNickname pet={pet} /> : <PetSale pet={pet} />;
}

export default function Pet(): ReactNode {
	const [page, setPage] = useState<PetPage>(PET_PAGES.OVERVIEW);
	const state = useGameQuery<PetRes>(
		GAME_ENTITIES.PET,
		() => GameClient.request(makeFromClientPacket(PetReq, { askedPlayer: {} }), PetRes, [PetNotFound])
	);
	if (page !== PET_PAGES.OVERVIEW) return <DetailScreen title={i18n.t(PET_PAGE_TITLES[page])} eyebrow={i18n.t("app:pet.eyebrow")} onClose={(): void => setPage(PET_PAGES.OVERVIEW)}>
		<PetDetails page={page} pet={state.status === "ready" ? state.data.pet : null} />
	</DetailScreen>;

	switch (state.status) {
		case "loading":
			return <Centered><ActivityIndicator /></Centered>;
		case "empty":
			return <Screen><Note>{i18n.t("app:pet.noPet")}</Note><Panel>
				<Row title={i18n.t("app:pet.management.shelter")} onPress={(): void => setPage(PET_PAGES.SHELTER)} chevron />
				<Row title={i18n.t("app:pet.powers.title")} onPress={(): void => setPage(PET_PAGES.POWERS)} chevron />
			</Panel></Screen>;
		case "failed":
			return <Centered><Text style={styles.message}>{state.rejection ? commandRejectionMessage(state.rejection) : i18n.t("app:common.error")}</Text></Centered>;
		default:
			return <PetSheet packet={state.data} onPage={setPage} />;
	}
}
