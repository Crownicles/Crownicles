import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {PetNickname} from "@/src/components/PetNickname";
import {PetSale} from "@/src/components/PetSale";
import {DetailScreen} from "@/src/design/DetailScreen";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

const PET_PAGES = {rename: PetNickname, sell: PetSale} as const;
type PetPageName = keyof typeof PET_PAGES;
const PET_PAGE_TITLES = {rename: "app:pet.care.rename", sell: "app:pet.sale.title"} as const;

function isPetPage(page: string | string[] | undefined): page is PetPageName {
	return typeof page === "string" && page in PET_PAGES;
}

/** Both sub-pages act on the pet itself, so they read the same query as the overview. */
function PetPageContent({page}: {page: PetPageName}): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.PET, () => GameClient.request(makeFromClientPacket(PetReq, {askedPlayer: {}}), PetRes, [PetNotFound]));
	if (state.status === "empty") return <Note>{i18n.t("app:pet.noPet")}</Note>;
	const Content: ({pet}: {pet: OwnedPet}) => ReactNode = PET_PAGES[page];
	return <GameQueryContent state={state} entity={GAME_ENTITIES.PET}>{data => <Content pet={data.pet} />}</GameQueryContent>;
}

export default function PetPageScreen(): ReactNode {
	const {page} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/pet");
	};
	if (!isPetPage(page)) return <DetailScreen title={i18n.t("app:pet.eyebrow")} eyebrow={i18n.t("app:pet.eyebrow")} onClose={close}><Note>{i18n.t("app:common.error")}</Note></DetailScreen>;
	return <DetailScreen title={i18n.t(PET_PAGE_TITLES[page])} eyebrow={i18n.t("app:pet.eyebrow")} onClose={close}><PetPageContent page={page} /></DetailScreen>;
}
