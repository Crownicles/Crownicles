import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useOwnGuild} from "@/src/store/useGuild";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {GuildDeparture, GuildDepartureLink, GuildManagement, GuildStorage} from "@/src/components/Guild";
import {GuildDomain} from "@/src/components/GuildDomain";
import {GuildShelter} from "@/src/components/PetManagement";
import {GuildRankings} from "@/src/components/Rankings";
import {GuildJoin} from "@/src/components/GuildRecruitment";
import {DetailScreen} from "@/src/design/DetailScreen";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

/** The domain holds the chief's levers too; they need the guild itself, so they read the same query as the overview. */
function Domain(): ReactNode {
	const state = useOwnGuild();
	return <>
		<GuildDomain />
		<GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => data.data
			? <><GuildManagement guild={data.data} /><GuildDepartureLink /></>
			: <Note>{i18n.t("app:guild.joinHint")}</Note>}</GameQueryContent>
	</>;
}

function Departure(): ReactNode {
	const state = useOwnGuild();
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => data.data
		? <GuildDeparture guild={data.data} />
		: <Note>{i18n.t("app:guild.joinHint")}</Note>}</GameQueryContent>;
}

const GUILD_PAGES = {storage: GuildStorage, shelter: GuildShelter, domain: Domain, rankings: GuildRankings, leave: Departure, join: GuildJoin} as const;
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
