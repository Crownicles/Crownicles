import {ReactNode, useState} from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {PetFeedReq} from "ws-packets/src/fromClient/PetCareReq";
import {PetFeedRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {Hero, KeyValue, Note, Panel, QuickAction, QuickActions, Screen, SectionHeader} from "@/src/design/Primitives";
import {DetailScreen} from "@/src/design/DetailScreen";
import {PetNickname} from "@/src/components/PetNickname";
import {usePetActions} from "@/src/store/usePetActions";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {petIcon, petMood, petName, petNickname, petRarity, petSex, petTypeName} from "@/src/display/PetDisplay";
import {commandRejectionMessage} from "@/src/display/CommandRejection";

const FEED_MENU: CommandMenu = {request: PetFeedReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetFeedRes]};

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

function PetSheet({packet, onRename}: {packet: PetRes; onRename: () => void}): ReactNode {
	const pet = packet.pet;
	const {pending, message, care} = usePetActions();
	const menus = useCommandMenus();

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:pet.eyebrow")}
				title={`${petIcon(pet)} ${petName(pet)}`}
				subtitle={`${petTypeName(pet)} · ${petRarity(pet)}`}
			/>
			<QuickActions>
				<QuickAction icon={AppIcons.getIcon("petCommand.pet")} disabled={pending} onPress={(): void => {care({type: "caress"}).catch(console.error);}}>{i18n.t("app:pet.care.caress")}</QuickAction>
				<QuickAction icon={AppIcons.getIcon("foods.commonFood")} disabled={menus.pending} onPress={(): Promise<void> => menus.open(FEED_MENU)}>{i18n.t("app:pet.care.feed")}</QuickAction>
				<QuickAction icon={AppIcons.getIcon("badges.redactor")} onPress={onRename}>{i18n.t("app:pet.care.rename")}</QuickAction>
			</QuickActions>
			{message ? <Note>{message}</Note> : null}
			{menus.message ? <Note>{menus.message}</Note> : null}

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
		</Screen>
	);
}

export default function Pet(): ReactNode {
	const [renaming, setRenaming] = useState(false);
	const state = useGameQuery<PetRes>(
		GAME_ENTITIES.PET,
		() => GameClient.request(makeFromClientPacket(PetReq, { askedPlayer: {} }), PetRes, [PetNotFound])
	);
	if (renaming && state.status === "ready") return <DetailScreen title={i18n.t("app:pet.care.rename")} eyebrow={i18n.t("app:pet.eyebrow")} onClose={(): void => setRenaming(false)}><PetNickname pet={state.data.pet} /></DetailScreen>;

	switch (state.status) {
		case "loading":
			return <Centered><ActivityIndicator /></Centered>;
		case "empty":
			return <Centered><Text style={styles.message}>{i18n.t("app:pet.noPet")}</Text></Centered>;
		case "failed":
			return <Centered><Text style={styles.message}>{state.rejection ? commandRejectionMessage(state.rejection) : i18n.t("app:common.error")}</Text></Centered>;
		default:
			return <PetSheet packet={state.data} onRename={(): void => setRenaming(true)} />;
	}
}
