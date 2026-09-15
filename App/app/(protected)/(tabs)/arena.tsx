import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {ArrowRight, History, Medal, Swords, Trophy, Zap} from "@/src/design/FightIcons";
import {FightReq} from "ws-packets/src/fromClient/FightReq";
import {FightErrorRes} from "ws-packets/src/fromServer/fight/FightRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {fightStore, useFight} from "@/src/store/FightStore";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Note, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {FightGauge} from "@/src/components/FightGauge";
import {DetailScreen} from "@/src/design/DetailScreen";
import {FightHistory, Leagues} from "@/src/components/ArenaReferences";
import {Rankings} from "@/src/components/Rankings";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const FIGHT_MENU: CommandMenu = {request: FightReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [FightErrorRes]};
const ARENA_PAGES = {history: FightHistory, leagues: Leagues, rankings: Rankings} as const;
type ArenaPage = keyof typeof ARENA_PAGES;
const ARENA_ICONS = {history: History, leagues: Medal, rankings: Trophy} as const;
const styles = StyleSheet.create({
	header: {paddingTop: 8, paddingBottom: 26, flexDirection: "row", gap: 14, alignItems: "center"},
	emblem: {width: 52, height: 52, backgroundColor: Theme.colors.wash, borderRadius: 14, alignItems: "center", justifyContent: "center"},
	eyebrow: {fontFamily: Theme.fonts.semiBold, fontSize: 10, color: Theme.colors.muted, marginBottom: 4, letterSpacing: 0},
	title: {fontFamily: Theme.fonts.extraBold, fontSize: 26, color: Theme.colors.ink},
	identity: {flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 20},
	name: {fontFamily: Theme.fonts.bold, fontSize: 17, color: Theme.colors.ink},
	className: {fontFamily: Theme.fonts.regular, fontSize: 12, color: Theme.colors.muted, marginTop: 4},
	ranking: {flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: Theme.colors.line, marginTop: 22, marginBottom: 22, paddingVertical: 18},
	rank: {flex: 1, minWidth: 0, gap: 6},
	rankEnd: {alignItems: "flex-end"},
	rankLabel: {fontFamily: Theme.fonts.medium, fontSize: 11, color: Theme.colors.muted},
	rankValue: {fontFamily: Theme.fonts.bold, fontSize: 17, color: Theme.colors.ink},
	start: {minHeight: 52, paddingHorizontal: 18, paddingVertical: 12, borderRadius: Theme.pillRadius, backgroundColor: Theme.colors.ink, flexDirection: "row", alignItems: "center", gap: 12},
	startLabel: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: 14, lineHeight: 19, color: Theme.colors.paper},
	disabled: {opacity: 0.5},
	links: {marginTop: 30},
	link: {minHeight: 64, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderColor: Theme.colors.line},
	linkText: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: 13, color: Theme.colors.ink},
	pressed: {opacity: 0.7}
});

function ArenaProfile({profile}: {profile: ProfileRes}): ReactNode {
	const icon = profile.classId === undefined ? null : AppIcons.getIconOrNull(`classes.${profile.classId}`);
	return <>
		<View style={styles.identity}>{icon ? <TwemojiIcon emoji={icon} size={42} /> : null}<View><Text style={styles.name}>{profile.pseudo}</Text>{profile.classId === undefined ? null : <Text style={styles.className}>{i18n.t(`models:classes.${profile.classId}`)} · {i18n.t("app:battle.level", {level: profile.level})}</Text>}</View></View>
		{profile.stats ? <FightGauge label={i18n.t("app:arena.energy")} icon={Zap} value={profile.stats.energy.value} max={profile.stats.energy.max} color={Theme.colors.green} /> : null}
		{profile.fightRanking ? <View style={styles.ranking}><View style={styles.rank}><Text style={styles.rankLabel}>{i18n.t("app:arena.glory")}</Text><Text style={styles.rankValue}>{formatNumber(profile.fightRanking.glory)}</Text></View><View style={[styles.rank, styles.rankEnd]}><Text style={styles.rankLabel}>{i18n.t("app:arena.league")}</Text><Text style={styles.rankValue}>{i18n.t(`models:leagues.${profile.fightRanking.league}`)}</Text></View></View> : null}
	</>;
}

function ArenaStart({pending, ongoing, onStart}: {pending: boolean; ongoing: boolean; onStart: () => Promise<void>}): ReactNode {
	const label = pending ? "app:battle.preparing" : ongoing ? "app:arena.resume" : "app:arena.start";
	return <Pressable accessibilityRole="button" disabled={pending} onPress={ongoing ? fightStore.show : onStart} style={({pressed}) => [styles.start, pending && styles.disabled, pressed && styles.pressed]}><Swords size={20} color={Theme.colors.paper} /><Text style={styles.startLabel}>{i18n.t(label)}</Text><ArrowRight size={18} color={Theme.colors.paper} /></Pressable>;
}

function ArenaLinks({onSelect}: {onSelect: (page: ArenaPage) => void}): ReactNode {
	return <View style={styles.links}>{(Object.keys(ARENA_PAGES) as ArenaPage[]).map(value => {
		const Icon = ARENA_ICONS[value];
		return <Pressable key={value} accessibilityRole="button" onPress={(): void => onSelect(value)} style={({pressed}) => [styles.link, pressed && styles.pressed]}><Icon size={21} color={value === "leagues" ? Theme.colors.gold : Theme.colors.muted} /><Text style={styles.linkText}>{i18n.t(`app:arena.pages.${value}`)}</Text><ArrowRight size={16} color={Theme.colors.faint} /></Pressable>;
	})}</View>;
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
		<View style={styles.header}><View style={styles.emblem}><Swords size={27} color={Theme.colors.ink} /></View><View><Text style={styles.eyebrow}>{i18n.t("app:arena.eyebrow")}</Text><Text style={styles.title}>{i18n.t("app:arena.title")}</Text></View></View>
		<GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{profile => <ArenaProfile profile={profile} />}</GameQueryContent>
		{message ? <Note>{message}</Note> : null}
		<ArenaStart pending={pending} ongoing={ongoing} onStart={start} />
		<ArenaLinks onSelect={setPage} />
	</Screen>;
}
