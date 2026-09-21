import {ReactNode} from "react";
import {useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {PetOverview} from "@/src/components/PetCare";
import {EmptyState, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";
import {ExpandableList} from "@/src/design/Sections";

export default function Pet(): ReactNode {
	const router = useRouter();
	const state = useGameQuery(
		GAME_ENTITIES.PET,
		() => GameClient.request(makeFromClientPacket(PetReq, {askedPlayer: {}}), PetRes, [PetNotFound])
	);
	if (state.status === "empty") return <Screen><ExpandableList><EmptyState>{i18n.t("app:pet.noPet")}</EmptyState></ExpandableList></Screen>;
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.PET}>{data => <PetOverview
		packet={data}
		onPage={(page): void => router.push(`/pet/${page}`)}
	/>}</GameQueryContent></Screen>;
}
