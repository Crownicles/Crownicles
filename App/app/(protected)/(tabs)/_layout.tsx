import {ReactNode, useEffect, useState} from "react";
import {useRouter} from "expo-router";
/** Expo SDK 57 no longer accepts react-navigation directly, so the top tabs come from its own copy. */
import {TopTabs} from "expo-router/js-top-tabs";
import {Animated, Text, TouchableOpacity, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {useNavigationStyles} from "@/src/design/Navigation";
import {SwipeBackBoundary, useSwipeBackOpen} from "@/src/design/SwipeBack";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Castle, Compass, LucideIcon, PawPrint, Swords, UserRound} from "@/src/design/FightIcons";
import {CapsuleTabBar, RING_TICK_MS} from "@/src/components/CapsuleTabBar";
import {reportWaitProgress} from "@/src/display/ReportTiming";
import {useCurrentTime} from "@/src/store/useCurrentTime";
import {useTabClaimables} from "@/src/store/useClaimables";
import {useTravelDashing} from "@/src/store/TravelDashStore";
import {useOwnPet} from "@/src/store/useKnownPet";
import {expeditionProgress} from "@/src/display/PetExpedition";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {useQueryClient} from "@tanstack/react-query";
import {DeathScreen} from "@/src/components/DeathScreen";
import {UnlockCelebration, useAdventureBusy, useAdventureHoldsTabs} from "@/src/components/UnlockCelebration";
import {usePlayerIsDead} from "@/src/store/usePlayerIsDead";
import {isJourneyTab, JOURNEY_TABS, JourneyTab} from "@/src/journey/Journey";
import {Journey, useJourney} from "@/src/journey/useJourney";
import {MissionCompletedToast} from "@/src/components/MissionRewards";
import {BlessingActivatedToast} from "@/src/components/BlessingActivatedToast";
import {AppNotificationToast, useAppNotificationRefresh} from "@/src/components/AppNotificationToast";
import {usePushRegistration} from "@/src/notifications/PushRegistration";
import {LevelUpToast} from "@/src/components/LevelUpToast";
import {useNotificationNavigation} from "@/src/notifications/useNotifications";
import {allowPermissionPrompt} from "@/src/notifications/ReportNotifications";
import {useReportView} from "@/src/store/useReportActions";
import {ContestView, useContest} from "@/src/onboarding/Contest";
import {OnboardingMoments, ONBOARDING_MOMENTS, useOnboardingMoments} from "@/src/onboarding/OnboardingStore";
import {ContestSeal, DepartureFork, forkDue, sealDue, stageMoment, StopArrivedToast} from "@/src/onboarding/OnboardingStage";
import {RoyalLetter} from "@/src/onboarding/RoyalLetter";
import {useRoyalLetter} from "@/src/store/RoyalLetterStore";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {RequestState} from "@/src/store/useGameQuery";
import {useColors} from "@/src/design/ThemeContext";

/** Every tab of the app, in the order of the bar; the journey decides which of them are open. */
const TABS: readonly {name: JourneyTab; title: string; icon: LucideIcon}[] = [
	{name: JOURNEY_TABS.ADVENTURE, title: "app:tabs.adventure", icon: Compass},
	{name: JOURNEY_TABS.PROFILE, title: "app:tabs.profile", icon: UserRound},
	{name: JOURNEY_TABS.PET, title: "app:tabs.pet", icon: PawPrint},
	{name: JOURNEY_TABS.GUILD, title: "app:tabs.guild", icon: Castle},
	{name: JOURNEY_TABS.ARENA, title: "app:tabs.arena", icon: Swords}
];

/** How much of the wait for the next report has gone by; full once it can be opened, or while tokens rush there. */
function travelProgress(report: RequestState<ReportViewRes>, currentTime: number, dashing: boolean): number | undefined {
	if (report.status !== "ready") return undefined;
	if (!report.data.travel || currentTime === 0) return undefined;
	return report.data.reportReady || dashing ? 1 : reportWaitProgress(report.data.travel, currentTime);
}

function useTravelProgress(currentTime: number): number | undefined {
	const report = useReportView();
	const dashing = useTravelDashing();
	return travelProgress(report, currentTime, dashing);
}

/** How far the pet's expedition has gone; full once it is back, until its finds are claimed. */
function useExpeditionProgress(currentTime: number): number | undefined {
	const pet = useOwnPet();
	const expedition = pet.status === "ready" ? pet.data.expeditionInProgress : undefined;
	return expedition && currentTime > 0 ? expeditionProgress(expedition, currentTime) : undefined;
}

/** The server gives energy back on its own schedule: the profile is asked again meanwhile, so the ring follows. */
const ENERGY_REFRESH_MS = 60_000;

/** How full the fight energy is while it comes back; no ring once it is full. */
function useEnergyProgress(followed: boolean): number | undefined {
	const profile = usePlayerProfile();
	const queryClient = useQueryClient();
	const energy = profile.status === "ready" ? profile.data.stats?.energy : undefined;
	const regenerating = followed && energy !== undefined && energy.value < energy.max;
	useEffect(() => {
		if (!regenerating) return undefined;
		const refresh = setInterval(() => {
			queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.PROFILE)}).catch(console.error);
		}, ENERGY_REFRESH_MS);
		return (): void => clearInterval(refresh);
	}, [queryClient, regenerating]);
	return regenerating && energy.max > 0 ? energy.value / energy.max : undefined;
}

type NavigatorTabBarProps = {
	state: {index: number; routes: readonly {key: string; name: string; params?: object}[]};
	position: Animated.AnimatedInterpolation<number>;
	navigation: {
		emit: (event: {type: "tabPress"; target: string; canPreventDefault: true}) => {defaultPrevented: boolean};
		navigate: (name: string, params?: object) => void;
	};
};

function NavigatorTabBar({state, position, navigation, journey}: NavigatorTabBarProps & {journey: Journey}): ReactNode {
	const currentTime = useCurrentTime(RING_TICK_MS);
	const progress: Partial<Record<JourneyTab, number | undefined>> = {
		[JOURNEY_TABS.ADVENTURE]: useTravelProgress(currentTime),
		[JOURNEY_TABS.PET]: useExpeditionProgress(currentTime),
		[JOURNEY_TABS.ARENA]: useEnergyProgress(state.routes.some(route => route.name === JOURNEY_TABS.ARENA))
	};
	const claimables = useTabClaimables();
	const tabs = state.routes.flatMap(route => {
		const tab = TABS.find(candidate => candidate.name === route.name);
		if (!tab) return [];
		const ring = progress[tab.name];
		const badge = claimables[tab.name] ?? 0;
		return [{
			name: tab.name,
			title: i18n.t(tab.title),
			Icon: tab.icon,
			isNew: journey.isNew(tab.name),
			...(ring === undefined ? {} : {progress: ring}),
			...(badge > 0 ? {badge} : {})
		}];
	});
	const select = (name: string): void => {
		const route = state.routes.find(candidate => candidate.name === name);
		if (!route) return;
		const event = navigation.emit({type: "tabPress", target: route.key, canPreventDefault: true});
		if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
	};
	return <CapsuleTabBar tabs={tabs} focused={state.routes[state.index].name} position={position} onSelect={select} />;
}

function ProfileIdentity({profile}: {profile: ProfileRes | null}): ReactNode {
	const navigationStyles = useNavigationStyles();
	const classIcon = profile ? AppIcons.getIconOrNull(`classes.${profile.classId}`) : null;
	return <>
		{classIcon ? <View style={navigationStyles.profileClassIcon}><TwemojiIcon emoji={classIcon} size={Theme.fontSize.hero} /></View> : null}
		<View style={navigationStyles.profileIdentity}>
			<Text style={navigationStyles.profileName}>{profile?.pseudo}</Text>
			{profile ? <Text style={navigationStyles.profileLevel}>{i18n.t("app:profile.level", {level: profile.level})}</Text> : null}
		</View>
	</>;
}

const ProfileHeader = (): ReactNode => {
	const navigationStyles = useNavigationStyles();
	/*
	 * Reads the profile from the store rather than waiting for the profile screen to fill it in:
	 * the header is shown before that screen is ever opened, and both share this single request.
	 */
	const state = usePlayerProfile();
	const router = useRouter();
	const journey = useJourney();
	const profile = state.status === "ready" ? state.data : null;
	// The class emblem leads to the class comparison, once the arena that hosts it is open.
	const showClassInfo = journey.tabs.includes(JOURNEY_TABS.ARENA) ? (): void => router.push("/arena/classes") : undefined;
	return (
		<TouchableOpacity disabled={!showClassInfo} onPress={showClassInfo} style={navigationStyles.profileHeader}>
			<ProfileIdentity profile={profile} />
		</TouchableOpacity>
	);
};

function TabsHeader(): ReactNode {
	const navigationStyles = useNavigationStyles();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	return (
		<View style={[navigationStyles.header, {paddingTop: insets.top}]}>
			<View style={navigationStyles.headerSpacer} />
			<ProfileHeader />
			<TouchableOpacity style={navigationStyles.settingsButton} onPress={(): void => router.push("/settings")}>
				<TwemojiIcon emoji={AppIcons.getIcon("other.gear")} size={Theme.dimensions.headerIcon} />
			</TouchableOpacity>
		</View>
	);
}

function TabPager({journey}: {journey: Journey}): ReactNode {
	const detailOpen = useSwipeBackOpen();
	const held = useAdventureHoldsTabs();
	// A lone tab needs no bar: the newcomer only sees the adventure until something else opens.
	const hasTabs = journey.tabs.length > 1;
	// An event holds the player on the adventure tab only: from anywhere else, the way back must stay open.
	const heldOn = (routeName: string): boolean => held && routeName === JOURNEY_TABS.ADVENTURE;
	return (
		<TopTabs
			tabBarPosition="bottom"
			tabBar={(props: NavigatorTabBarProps) => hasTabs && !heldOn(props.state.routes[props.state.index].name) ? <NavigatorTabBar {...props} journey={journey} /> : null}
			screenOptions={({route}: {route: {name: string}}) => ({swipeEnabled: !detailOpen && hasTabs && !heldOn(route.name)})}
			screenListeners={({route}: {route: {name: string}}) => ({focus: (): void => {
				if (isJourneyTab(route.name)) journey.visit(route.name);
			}})}
		>
			{TABS.map(tab => <TopTabs.Protected key={tab.name} guard={journey.tabs.includes(tab.name)}>
				<TopTabs.Screen name={tab.name} options={{title: i18n.t(tab.title)}} />
			</TopTabs.Protected>)}
		</TopTabs>
	);
}

/** Announces what just opened; after a discovery, the next one waits for the report to move on. */
function useUnlockCelebration(journey: Journey, moment: string): ReactNode {
	const router = useRouter();
	const [heldAt, setHeldAt] = useState<string | null>(null);
	const step = journey.unannounced;
	const progress = journey.progress;
	if (!step || !progress) return null;
	if (heldAt === moment) return null;
	const hold = (): void => {
		journey.announce(step.feature);
		setHeldAt(moment);
	};
	return <UnlockCelebration
		key={step.feature}
		step={step}
		level={progress.level}
		onDiscover={(): void => {
			hold();
			journey.visit(step.tab);
			router.navigate(step.route);
		}}
		onLater={hold}
	/>;
}

/** The notification is asked for cold only once the app knows the player is past the contest. */
function useContestPermissionPrompt(contest: ContestView | null): void {
	const pastContest = contest !== null && !contest.running;
	useEffect(() => {
		allowPermissionPrompt(pastContest);
	}, [pastContest]);
}

function ContestOverlay({view, contest, moments}: {view: ReportViewRes | null; contest: ContestView | null; moments: OnboardingMoments}): ReactNode {
	if (sealDue(contest, moments)) {
		return <ContestSeal onClose={(): void => moments.mark(ONBOARDING_MOMENTS.ROYAL_SEAL)} />;
	}
	const forkTravel = forkDue({view, contest, moments});
	return forkTravel ? <DepartureFork travel={forkTravel} onClose={(): void => moments.mark(ONBOARDING_MOMENTS.FORK)} /> : null;
}

/**
 * Stages what the contest wants the player to stop on, one thing at a time and never over a story:
 * the king's letter first, then what just opened, the royal seal, and the reminder offered on the
 * long road.
 */
function OnboardingOverlays({journey}: {journey: Journey}): ReactNode {
	const busy = useAdventureBusy();
	const report = useReportView();
	const view = report.status === "ready" ? report.data : null;
	const contest = useContest();
	const moments = useOnboardingMoments();
	const letter = useRoyalLetter();
	useContestPermissionPrompt(contest);
	const unlock = useUnlockCelebration(journey, stageMoment(view));
	if (busy) return null;
	if (letter) return <RoyalLetter unread={letter} />;
	return unlock ?? <ContestOverlay view={view} contest={contest} moments={moments} />;
}

function StopToast(): ReactNode {
	const busy = useAdventureBusy();
	const report = useReportView();
	const contest = useContest();
	return busy ? null : <StopArrivedToast view={report.status === "ready" ? report.data : null} contestRunning={contest?.running ?? false} />;
}

export default function TabLayout(): ReactNode {
	const dead = usePlayerIsDead();
	const journey = useJourney();
	const colors = useColors();
	useNotificationNavigation();
	usePushRegistration();
	useAppNotificationRefresh();
	if (dead) {
		return <DeathScreen />;
	}
	return (
		<View style={{flex: 1, backgroundColor: colors.paper}}>
			<TabsHeader />
			<SwipeBackBoundary><TabPager journey={journey} /></SwipeBackBoundary>
			<OnboardingOverlays journey={journey} />
			<MissionCompletedToast />
			<BlessingActivatedToast />
			<AppNotificationToast />
			<LevelUpToast />
			<StopToast />
		</View>
	);
}
