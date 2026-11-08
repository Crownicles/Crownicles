import { ReactNode } from "react";
import {
	Text, View
} from "react-native";
import { useRouter } from "expo-router";
import {
	CircleAlert, Swords, Zap
} from "@/src/design/FightIcons";
import {
	ActionBanner, Lock, Standing
} from "@/src/design/Sections";
import { useQueryClient } from "@tanstack/react-query";
import {
	Cure, CureEmblem
} from "@/src/components/CureEmblem";
import {
	HealAction, HealOffer, healOffer, PendingAction, useBuyHeal
} from "@/src/components/HealAction";
import { reportEventStore } from "@/src/collectors/ReportEventStore";
import {
	activeEffect, effectLock, PlayerEffect
} from "@/src/display/CommandRejection";
import { useReportView } from "@/src/store/useReportActions";
import { useLeagueRewardToClaim } from "@/src/store/useClaimables";
import { gameRules } from "@/src/rules/GameRules";
import { FightReq } from "ws-packets/src/fromClient/FightReq";
import { FightErrorRes } from "ws-packets/src/fromServer/fight/FightRes";
import { FightError } from "ws-packets/src/objects/Fight";
import { PlayerNotFound } from "ws-packets/src/fromServer/common/PlayerNotFound";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import { ReportTravelSummaryRes } from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {
	CommandMenu, useCommandMenus
} from "@/src/store/useInventoryMenus";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { RequestState } from "@/src/store/useGameQuery";
import {
	fightStore, isFightOngoing, useFight
} from "@/src/store/FightStore";
import {
	gameKey, GAME_ENTITIES
} from "@/src/store/GameEntities";
import { GameQueryContent } from "@/src/components/GameQueryContent";
import {
	Note, QuickAction, QuickActions, Screen
} from "@/src/design/Primitives";
import { Theme } from "@/src/design/Theme";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { TwemojiText } from "@/src/design/TwemojiText";
import { AppIcons } from "@/src/AppIcons";
import { FightGauge } from "@/src/components/FightGauge";
import { formatGlory } from "@/src/display/Amounts";
import { leagueName } from "@/src/display/Leagues";
import { i18n } from "@/src/translations/i18n";
import {
	createStyles, useColors
} from "@/src/design/ThemeContext";

const FIGHT_MENU: CommandMenu = {
	request: FightReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [FightErrorRes]
};
const ARENA_PAGES = [
	"classes",
	"history",
	"leagues",
	"rankings"
] as const;
type ArenaPage = typeof ARENA_PAGES[number];

/** Fight history and leagues only mean something once the player can fight. */
const BEFORE_FIGHTS_PAGES: readonly ArenaPage[] = ["classes", "rankings"];
const ARENA_ICONS = {
	classes: "commands.classes", history: "fightHistory.menu", leagues: "unitValues.score", rankings: "top.congrats"
} as const;
const IDENTITY_EMBLEM_SIZE = 42;
const useStyles = createStyles(colors => ({
	identity: {
		flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 20
	},
	name: {
		fontFamily: Theme.fonts.bold, fontSize: 17, color: colors.ink
	},
	className: {
		fontFamily: Theme.fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4
	},
	ranking: {
		flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, marginTop: 22, paddingVertical: 18
	},
	rank: {
		flex: 1, minWidth: 0, gap: 6
	},
	rankEnd: { alignItems: "flex-end" },
	rankLabel: {
		fontFamily: Theme.fonts.medium, fontSize: 11, color: colors.muted
	},
	rankValue: {
		fontFamily: Theme.fonts.bold, fontSize: 17, color: colors.ink
	},
	start: { marginTop: 22 },
	startError: {
		flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingTop: Theme.spacing.md
	},
	startErrorText: {
		flex: 1, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted
	},
	links: { marginTop: 30 }
}));

function identityEmblemPath(profile: ProfileRes, onIsland: boolean): string | null {
	const effect = activeEffect(profile);
	if (effect) {
		return `effects.${effect.effect}`;
	}
	if (onIsland) {
		return "other.island";
	}
	return profile.classId === undefined ? null : `classes.${profile.classId}`;
}

/** A running alteration, then the island being explored, take the place of the class: they decide whether the player can fight. */
function identityEmblem(profile: ProfileRes, onIsland: boolean, cure: Cure | null): ReactNode {
	if (cure) {
		return <CureEmblem cure={cure} />;
	}
	const path = identityEmblemPath(profile, onIsland);
	const icon = path ? AppIcons.getIconOrNull(path) : null;
	return icon ? <TwemojiIcon emoji={icon} size={IDENTITY_EMBLEM_SIZE} /> : null;
}

type ArenaStanding = {
	profile: ProfileRes; onIsland: boolean; cure: Cure | null;
};

function ArenaIdentity({
	profile, onIsland, cure
}: ArenaStanding): ReactNode {
	const styles = useStyles();
	return <View style={styles.identity}>{identityEmblem(profile, onIsland, cure)}<View><Text style={styles.name}>{profile.pseudo}</Text>{profile.classId === undefined ? null : <Text style={styles.className}>{i18n.t(`models:classes.${profile.classId}`)} · {i18n.t("app:battle.level", { level: profile.level })}</Text>}</View></View>;
}

function ArenaRanking({ profile }: { profile: ProfileRes }): ReactNode {
	const styles = useStyles();
	const ranking = profile.fightRanking;
	if (!ranking) {
		return null;
	}
	return <View style={styles.ranking}><View style={styles.rank}><Text style={styles.rankLabel}>{i18n.t("app:arena.glory")}</Text><TwemojiText textStyle={styles.rankValue} emojiSize={Theme.fontSize.rowTitle}>{formatGlory(ranking.glory)}</TwemojiText></View><View style={[styles.rank, styles.rankEnd]}><Text style={styles.rankLabel}>{i18n.t("app:arena.league")}</Text><TwemojiText textStyle={styles.rankValue} emojiSize={Theme.fontSize.rowTitle}>{leagueName(ranking.league)}</TwemojiText></View></View>;
}

function ArenaProfile(standing: ArenaStanding): ReactNode {
	const colors = useColors();
	const { profile } = standing;
	return <>
		<ArenaIdentity {...standing} />
		{profile.stats ? <FightGauge label={i18n.t("app:arena.energy")} icon={Zap} value={profile.stats.energy.value} max={profile.stats.energy.max} color={colors.green} /> : null}
		<ArenaRanking profile={profile} />
	</>;
}

function ArenaStart({
	pending, ongoing, lock, onStart
}: {
	pending: boolean; ongoing: boolean; lock: Lock | undefined; onStart: () => Promise<void>;
}): ReactNode {
	const styles = useStyles();
	const label = pending ? "app:battle.preparing" : ongoing ? "app:arena.resume" : "app:arena.start";
	return <View style={styles.start}><ActionBanner
		icon={Swords}
		label={i18n.t(label)}
		pending={pending}
		onPress={ongoing
			? fightStore.show
			: (): void => {
				onStart().catch(console.error);
			}}
		{...lock ? { lock } : {}}
		testID="arena-start-locked"
	/></View>;
}

function ArenaStartError({ error }: { error: FightError }): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	return <View style={styles.startError} testID="arena-start-error">
		<CircleAlert size={15} color={colors.muted} />
		<Text style={styles.startErrorText}>{i18n.t(`app:arena.errors.${error}`)}</Text>
	</View>;
}

/** The league and class tiles wear the player's own league and class, as the mockup does. */
function ArenaLinks({
	pages, onSelect, leagueId, classId
}: {
	pages: readonly ArenaPage[]; onSelect: (page: ArenaPage) => void; leagueId?: number; classId?: number;
}): ReactNode {
	const styles = useStyles();
	const icon = (page: ArenaPage): string => {
		if (page === "leagues" && leagueId !== undefined) {
			return AppIcons.getIcon(`leagues.${leagueId}`);
		}
		if (page === "classes" && classId !== undefined) {
			return AppIcons.getIcon(`classes.${classId}`);
		}
		return AppIcons.getIcon(ARENA_ICONS[page]);
	};
	const leagueRewardToClaim = useLeagueRewardToClaim();
	return <View style={styles.links}><QuickActions>
		{pages.map(page => <QuickAction
			key={page}
			icon={icon(page)}
			badge={page === "leagues" ? leagueRewardToClaim : 0}
			onPress={(): void => onSelect(page)}
		>{i18n.t(`app:arena.pages.${page}`)}</QuickAction>)}
	</QuickActions></View>;
}

/** The player's own league and class, once the profile is known. */
function playerEmblems(state: RequestState<ProfileRes>): {
	leagueId?: number; classId?: number;
} {
	if (state.status !== "ready") {
		return {};
	}
	const {
		fightRanking, classId
	} = state.data;
	return {
		...fightRanking ? { leagueId: fightRanking.league } : {},
		...classId === undefined ? {} : { classId }
	};
}

/** The same identity banner as every other tab, so the arena reads as one of them. */
function ArenaHeader(): ReactNode {
	const colors = useColors();
	return <Standing emblem={<Swords size={27} color={colors.ink} />} caption={i18n.t("app:arena.eyebrow")} title={i18n.t("app:arena.title")} />;
}

type ArenaCure = {
	offer: HealOffer | null; action: PendingAction; cure: Cure | null;
};

/** While an alteration that can be healed holds the player back, the cure takes the place of the duel. */
function useArenaCure(blocking: PlayerEffect | null, travel: ReportTravelSummaryRes | undefined): ArenaCure {
	const queryClient = useQueryClient();
	const {
		action, cure
	} = useBuyHeal(blocking?.effect, (): void => {
		reportEventStore.clearHeal();
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.REPORT]) {
			queryClient.invalidateQueries({ queryKey: gameKey(entity) }).catch(console.error);
		}
	});
	return {
		offer: blocking ? healOffer(travel) : null, action, cure
	};
}

/** The server refuses a fight below this share of energy: the button says it, and how much is missing, before the tap. */
function energyLock(profile: ProfileRes): Lock | undefined {
	const energy = profile.stats?.energy;
	if (!energy) {
		return undefined;
	}
	const required = Math.ceil(energy.max * gameRules().fight.minimalEnergyRatio);
	return energy.value < required
		? {
			reason: i18n.t("app:arena.lowEnergy", {
				required, value: energy.value
			}),
			icon: Zap
		}
		: undefined;
}

/** What keeps the player from looking for an opponent, known before the tap. */
type ArenaEligibility = {
	canFight: boolean; blocking: PlayerEffect | null; onIsland: boolean;
};

/** Before the fight level the start button stays in sight, greyed, with the level that opens fights. */
function startLock(eligibility: ArenaEligibility, profile: ProfileRes | null): Lock | undefined {
	if (!eligibility.canFight) {
		return { reason: i18n.t("app:arena.locked", { level: gameRules().journeyLevels.fights }) };
	}
	if (eligibility.blocking) {
		return effectLock(eligibility.blocking);
	}
	if (eligibility.onIsland) {
		return { reason: i18n.t("app:arena.island") };
	}
	return profile ? energyLock(profile) : undefined;
}

function useArenaFight(): {
	ongoing: boolean; startError: FightError | null; pending: boolean; message: string | null; start: () => Promise<void>;
} {
	const fight = useFight();
	const {
		pending, message, open
	} = useCommandMenus();
	return {
		ongoing: isFightOngoing(fight),
		startError: fight.visible ? null : fight.error,
		pending,
		message,
		start: (): Promise<void> => {
			fightStore.reset();
			return open(FIGHT_MENU);
		}
	};
}

function arenaEligibility(profile: ProfileRes | null, ongoing: boolean, travel: ReportTravelSummaryRes | undefined): ArenaEligibility {
	return {
		canFight: !profile || profile.level >= gameRules().journeyLevels.fights,
		blocking: profile && !ongoing ? activeEffect(profile) : null,

		// Duels are fought on the continent; the report shows the island energy for the whole exploration, boats included.
		onIsland: travel?.energy.show === true
	};
}

export default function Arena(): ReactNode {
	const router = useRouter();
	const styles = useStyles();
	const state = usePlayerProfile();
	const {
		ongoing, startError, pending, message, start
	} = useArenaFight();
	const profile = state.status === "ready" ? state.data : null;
	const report = useReportView();
	const travel = report.status === "ready" ? report.data.travel : undefined;

	// A fight already under way can always be resumed.
	const eligibility = arenaEligibility(profile, ongoing, travel);
	const {
		canFight, blocking
	} = eligibility;
	const {
		offer, action: heal, cure
	} = useArenaCure(blocking, travel);
	return <Screen>
		<ArenaHeader />
		<GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{profile => <ArenaProfile profile={profile} onIsland={eligibility.onIsland} cure={cure} />}</GameQueryContent>
		{message ? <Note>{message}</Note> : null}
		{offer
			? <View style={styles.start}><HealAction heal={offer} action={heal} /></View>
			: <ArenaStart pending={pending} ongoing={ongoing} lock={ongoing ? undefined : startLock(eligibility, profile)} onStart={start} />}
		{startError ? <ArenaStartError error={startError} /> : null}
		<ArenaLinks pages={canFight ? ARENA_PAGES : BEFORE_FIGHTS_PAGES} onSelect={(page): void => router.push(`/arena/${page}`)} {...playerEmblems(state)} />
		{canFight ? <Note>{i18n.t("app:arena.friendlyFightHint")}</Note> : null}
	</Screen>;
}
