import {ReactNode} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {ArrowRight, CircleAlert, Swords, Zap} from "@/src/design/FightIcons";
import {JOURNEY_LEVELS} from "ws-packets/src/objects/Journey";
import {FightReq} from "ws-packets/src/fromClient/FightReq";
import {FightErrorRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightError} from "ws-packets/src/objects/Fight";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {RequestState} from "@/src/store/useGameQuery";
import {fightStore, useFight} from "@/src/store/FightStore";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Note, QuickAction, QuickActions, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {TwemojiText} from "@/src/design/TwemojiText";
import {AppIcons} from "@/src/AppIcons";
import {FightGauge} from "@/src/components/FightGauge";
import {formatGlory} from "@/src/display/Amounts";
import {leagueName} from "@/src/display/Leagues";
import {i18n} from "@/src/translations/i18n";

const FIGHT_MENU: CommandMenu = {request: FightReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [FightErrorRes]};
const ARENA_PAGES = ["classes", "history", "leagues", "rankings"] as const;
type ArenaPage = typeof ARENA_PAGES[number];

/** Fight history and leagues only mean something once the player can fight. */
const BEFORE_FIGHTS_PAGES: readonly ArenaPage[] = ["classes", "rankings"];
const ARENA_ICONS = {classes: "commands.classes", history: "fightHistory.menu", leagues: "unitValues.score", rankings: "top.congrats"} as const;
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
	startError: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingTop: Theme.spacing.md},
	startErrorText: {flex: 1, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	disabled: {opacity: 0.5},
	links: {marginTop: 30},
	pressed: {opacity: 0.7}
});

function ArenaProfile({profile}: {profile: ProfileRes}): ReactNode {
	const icon = profile.classId === undefined ? null : AppIcons.getIconOrNull(`classes.${profile.classId}`);
	return <>
		<View style={styles.identity}>{icon ? <TwemojiIcon emoji={icon} size={42} /> : null}<View><Text style={styles.name}>{profile.pseudo}</Text>{profile.classId === undefined ? null : <Text style={styles.className}>{i18n.t(`models:classes.${profile.classId}`)} · {i18n.t("app:battle.level", {level: profile.level})}</Text>}</View></View>
		{profile.stats ? <FightGauge label={i18n.t("app:arena.energy")} icon={Zap} value={profile.stats.energy.value} max={profile.stats.energy.max} color={Theme.colors.green} /> : null}
		{profile.fightRanking ? <View style={styles.ranking}><View style={styles.rank}><Text style={styles.rankLabel}>{i18n.t("app:arena.glory")}</Text><TwemojiText textStyle={styles.rankValue} emojiSize={Theme.fontSize.rowTitle}>{formatGlory(profile.fightRanking.glory)}</TwemojiText></View><View style={[styles.rank, styles.rankEnd]}><Text style={styles.rankLabel}>{i18n.t("app:arena.league")}</Text><TwemojiText textStyle={styles.rankValue} emojiSize={Theme.fontSize.rowTitle}>{leagueName(profile.fightRanking.league)}</TwemojiText></View></View> : null}
	</>;
}

function ArenaStart({pending, ongoing, onStart}: {pending: boolean; ongoing: boolean; onStart: () => Promise<void>}): ReactNode {
	const label = pending ? "app:battle.preparing" : ongoing ? "app:arena.resume" : "app:arena.start";
	return <Pressable accessibilityRole="button" disabled={pending} onPress={ongoing ? fightStore.show : onStart} style={({pressed}) => [styles.start, pending && styles.disabled, pressed && styles.pressed]}><Swords size={20} color={Theme.colors.paper} /><Text style={styles.startLabel}>{i18n.t(label)}</Text><ArrowRight size={18} color={Theme.colors.paper} /></Pressable>;
}

function ArenaStartError({error}: {error: FightError}): ReactNode {
	return <View style={styles.startError} testID="arena-start-error">
		<CircleAlert size={15} color={Theme.colors.muted} />
		<Text style={styles.startErrorText}>{i18n.t(`app:arena.errors.${error}`)}</Text>
	</View>;
}

/** The league and class tiles wear the player's own league and class, as the mockup does. */
function ArenaLinks({pages, onSelect, leagueId, classId}: {pages: readonly ArenaPage[]; onSelect: (page: ArenaPage) => void; leagueId?: number; classId?: number}): ReactNode {
	const icon = (page: ArenaPage): string => {
		if (page === "leagues" && leagueId !== undefined) return AppIcons.getIcon(`leagues.${leagueId}`);
		if (page === "classes" && classId !== undefined) return AppIcons.getIcon(`classes.${classId}`);
		return AppIcons.getIcon(ARENA_ICONS[page]);
	};
	return <View style={styles.links}><QuickActions>
		{pages.map(page => <QuickAction key={page} icon={icon(page)} onPress={(): void => onSelect(page)}>{i18n.t(`app:arena.pages.${page}`)}</QuickAction>)}
	</QuickActions></View>;
}

/** The player's own league and class, once the profile is known. */
function playerEmblems(state: RequestState<ProfileRes>): {leagueId?: number; classId?: number} {
	if (state.status !== "ready") return {};
	const {fightRanking, classId} = state.data;
	return {
		...fightRanking ? {leagueId: fightRanking.league} : {},
		...classId === undefined ? {} : {classId}
	};
}

function ArenaHeader(): ReactNode {
	return <View style={styles.header}><View style={styles.emblem}><Swords size={27} color={Theme.colors.ink} /></View><View><Text style={styles.eyebrow}>{i18n.t("app:arena.eyebrow")}</Text><Text style={styles.title}>{i18n.t("app:arena.title")}</Text></View></View>;
}

export default function Arena(): ReactNode {
	const router = useRouter();
	const state = usePlayerProfile();
	const fight = useFight();
	const {pending, message, open} = useCommandMenus();
	const ongoing = Boolean(fight.introduction && !fight.result && !fight.error);
	const start = (): Promise<void> => {fightStore.reset(); return open(FIGHT_MENU);};
	const startError = fight.visible ? null : fight.error;
	// Before the fight level the arena only holds the class choice and the rankings; fights are announced when they open.
	const canFight = state.status !== "ready" || state.data.level >= JOURNEY_LEVELS.FIGHTS;
	return <Screen>
		<ArenaHeader />
		<GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{profile => <ArenaProfile profile={profile} />}</GameQueryContent>
		{message ? <Note>{message}</Note> : null}
		{canFight ? <ArenaStart pending={pending} ongoing={ongoing} onStart={start} /> : null}
		{startError ? <ArenaStartError error={startError} /> : null}
		<ArenaLinks pages={canFight ? ARENA_PAGES : BEFORE_FIGHTS_PAGES} onSelect={(page): void => router.push(`/arena/${page}`)} {...playerEmblems(state)} />
	</Screen>;
}
