import {ReactNode, useState} from "react";
import {FightReq} from "ws-packets/src/fromClient/FightReq";
import {FightErrorRes} from "ws-packets/src/fromServer/fight/FightRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {fightStore, useFight} from "@/src/store/FightStore";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Hero, KeyValue, Note, Panel, Row, Screen} from "@/src/design/Primitives";
import {DetailScreen} from "@/src/design/DetailScreen";
import {FightHistory, Leagues} from "@/src/components/ArenaReferences";
import {Rankings} from "@/src/components/Rankings";
import {className} from "@/src/display/Classes";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const FIGHT_MENU: CommandMenu = {request: FightReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [FightErrorRes]};
const ARENA_PAGES = {history: FightHistory, leagues: Leagues, rankings: Rankings} as const;
type ArenaPage = keyof typeof ARENA_PAGES;

function ArenaProfile({profile}: {profile: ProfileRes}): ReactNode {
	return <Panel>
		{profile.stats ? <KeyValue label={i18n.t("app:arena.energy")} value={i18n.t("app:profile.formats.progress", profile.stats.energy)} /> : null}
		{profile.classId !== undefined ? <KeyValue label={i18n.t("app:arena.class")} value={className(profile.classId)} /> : null}
		{profile.fightRanking ? <KeyValue label={i18n.t("app:arena.glory")} value={formatNumber(profile.fightRanking.glory)} /> : null}
		{profile.fightRanking ? <KeyValue label={i18n.t("app:arena.league")} value={i18n.t(`models:leagues.${profile.fightRanking.league}`)} /> : null}
	</Panel>;
}

export default function Arena(): ReactNode {
	const [page, setPage] = useState<ArenaPage | null>(null);
	const state = usePlayerProfile();
	const fight = useFight();
	const {pending, message, open} = useCommandMenus();
	const ongoing = Boolean(fight.introduction && !fight.result && !fight.error);
	const start = (): Promise<void> => {fightStore.reset(); return open(FIGHT_MENU);};
	if (page) {
		const Content = ARENA_PAGES[page];
		return <DetailScreen title={i18n.t(`app:arena.pages.${page}`)} eyebrow={i18n.t("app:arena.eyebrow")} onClose={(): void => setPage(null)}><Content /></DetailScreen>;
	}
	return <Screen>
		<Hero eyebrow={i18n.t("app:arena.eyebrow")} title={i18n.t("app:arena.title")} />
		<GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{profile => <ArenaProfile profile={profile} />}</GameQueryContent>
		{message ? <Note>{message}</Note> : null}
		<ButtonRow><Button variant="primary" disabled={pending} onPress={ongoing ? fightStore.show : start}>{i18n.t(ongoing ? "app:arena.resume" : "app:arena.start")}</Button></ButtonRow>
		<Panel>{(Object.keys(ARENA_PAGES) as ArenaPage[]).map(value => <Row key={value} title={i18n.t(`app:arena.pages.${value}`)} onPress={(): void => setPage(value)} chevron />)}</Panel>
	</Screen>;
}
