import {ReactNode} from "react";
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {GameClient} from "@/src/networking/GameClient";
import {useGameRequest} from "@/src/networking/useGameRequest";
import {Hero, KeyValue, Note, Panel, SectionHeader, StatBar} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {petIcon, petMood, petMoodRatio, petNickname, petRarity, petSex, petTypeName} from "@/src/display/PetDisplay";

function Centered({ children }: { children: ReactNode }): ReactNode {
	return <View style={styles.centered}>{children}</View>;
}

function PetSheet({ packet }: { packet: PetRes }): ReactNode {
	const pet = packet.pet;

	return (
		<ScrollView contentContainerStyle={styles.content}>
			<Hero
				eyebrow={i18n.t("app:pet.eyebrow")}
				title={`${petIcon(pet)} ${petNickname(pet)}`}
				subtitle={`${petTypeName(pet)} · ${petRarity(pet)}`}
			/>

			<SectionHeader>{i18n.t("app:pet.titles.sheet")}</SectionHeader>
			<Panel>
				<KeyValue label={i18n.t("app:pet.fields.type")} value={`${petIcon(pet)} ${petTypeName(pet)}`} />
				<KeyValue label={i18n.t("app:pet.fields.nickname")} value={petNickname(pet)} />
				<KeyValue label={i18n.t("app:pet.fields.rarity")} value={petRarity(pet)} />
				<KeyValue label={i18n.t("app:pet.fields.sex")} value={petSex(pet)} />
			</Panel>

			<SectionHeader>{i18n.t("app:pet.titles.mood")}</SectionHeader>
			<Panel>
				<StatBar
					label={i18n.t("app:pet.fields.mood")}
					value={petMood(pet)}
					ratio={petMoodRatio(pet)}
					color={Theme.colors.red}
				/>
				<Note>{i18n.t("app:pet.moodScale")}</Note>
			</Panel>
		</ScrollView>
	);
}

export default function Pet(): ReactNode {
	const state = useGameRequest<PetRes>(
		() => GameClient.request(makeFromClientPacket(PetReq, { askedPlayer: {} }), PetRes, [PetNotFound])
	);

	switch (state.status) {
		case "loading":
			return <Centered><ActivityIndicator /></Centered>;
		case "empty":
			return <Centered><Text style={styles.message}>{i18n.t("app:pet.noPet")}</Text></Centered>;
		case "failed":
			return <Centered><Text style={styles.message}>{i18n.t("app:common.error")}</Text></Centered>;
		default:
			return <PetSheet packet={state.data} />;
	}
}

const styles = StyleSheet.create({
	content: {
		padding: Theme.spacing.xl, backgroundColor: Theme.colors.wash, flexGrow: 1
	},
	centered: {
		flex: 1, alignItems: "center", justifyContent: "center", padding: Theme.spacing.xxl, backgroundColor: Theme.colors.wash
	},
	message: {
		color: Theme.colors.muted, fontSize: Theme.fontSize.body, textAlign: "center"
	}
});
