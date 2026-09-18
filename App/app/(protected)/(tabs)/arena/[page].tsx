import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {FightHistory, Leagues} from "@/src/components/ArenaReferences";
import {Classes} from "@/src/components/Classes";
import {Rankings} from "@/src/components/Rankings";
import {DetailScreen} from "@/src/design/DetailScreen";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

const ARENA_PAGES = {classes: Classes, history: FightHistory, leagues: Leagues, rankings: Rankings} as const;
type ArenaPage = keyof typeof ARENA_PAGES;

function isArenaPage(page: string | string[] | undefined): page is ArenaPage {
	return typeof page === "string" && page in ARENA_PAGES;
}

export default function ArenaPageScreen(): ReactNode {
	const {page} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/arena");
	};
	if (!isArenaPage(page)) return <DetailScreen title={i18n.t("app:arena.title")} eyebrow={i18n.t("app:arena.eyebrow")} onClose={close}><Note>{i18n.t("app:common.error")}</Note></DetailScreen>;
	const Content = ARENA_PAGES[page];
	return <DetailScreen title={i18n.t(`app:arena.pages.${page}`)} eyebrow={i18n.t("app:arena.eyebrow")} onClose={close}><Content /></DetailScreen>;
}
