import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {GuildManagement, GuildStorage} from "@/src/components/Guild";
import {GuildDomain} from "@/src/components/GuildDomain";
import {GuildShelter} from "@/src/components/PetManagement";
import {DetailScreen} from "@/src/design/DetailScreen";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

/** Management is the only page that needs the guild itself, so it reads the same query as the overview. */
function Management(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.GUILD, () => GameClient.request(makeFromClientPacket(GuildReq, {askedPlayer: {}}), GuildRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => data.data
		? <GuildManagement guild={data.data} />
		: <Note>{i18n.t("app:guild.joinHint")}</Note>}</GameQueryContent>;
}

const GUILD_PAGES = {storage: GuildStorage, shelter: GuildShelter, domain: GuildDomain, manage: Management} as const;
type GuildPageName = keyof typeof GUILD_PAGES;

function isGuildPage(page: string | string[] | undefined): page is GuildPageName {
	return typeof page === "string" && page in GUILD_PAGES;
}

export default function GuildPageScreen(): ReactNode {
	const {page} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/guild");
	};
	if (!isGuildPage(page)) return <DetailScreen title={i18n.t("app:guild.eyebrow")} eyebrow={i18n.t("app:guild.eyebrow")} onClose={close}><Note>{i18n.t("app:common.error")}</Note></DetailScreen>;
	const Content = GUILD_PAGES[page];
	return <DetailScreen title={i18n.t(`app:guild.pages.${page}`)} eyebrow={i18n.t("app:guild.eyebrow")} onClose={close}><Content /></DetailScreen>;
}
