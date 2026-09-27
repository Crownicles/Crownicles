import {ReactElement, ReactNode, useEffect, useState} from "react";
import {useRouter} from "expo-router";
/** Expo SDK 57 no longer accepts react-navigation directly, so the top tabs come from its own copy. */
import {TopTabs} from "expo-router/js-top-tabs";
import {Alert, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {navigationStyles, tabBarOptions} from "@/src/design/Navigation";
import {SwipeBackBoundary, useSwipeBackOpen} from "@/src/design/SwipeBack";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {DeathScreen} from "@/src/components/DeathScreen";
import {UnlockCelebration, useAdventureBusy} from "@/src/components/UnlockCelebration";
import {usePlayerIsDead} from "@/src/store/usePlayerIsDead";
import {isJourneyTab, JOURNEY_TABS, JourneyTab} from "@/src/journey/Journey";
import {Journey, useJourney} from "@/src/journey/useJourney";
import {MissionCompletedToast} from "@/src/components/MissionRewards";
import {BlessingActivatedToast} from "@/src/components/BlessingActivatedToast";
import {useMissionRewards, useMissionRewardsAccount} from "@/src/store/MissionRewardsStore";
import {useNotificationNavigation, useReportNotification} from "@/src/notifications/useNotifications";
import {allowPermissionPrompt} from "@/src/notifications/ReportNotifications";
import {useReportView} from "@/src/store/useReportActions";
import {ContestView, useContest} from "@/src/onboarding/Contest";
import {OnboardingMoments, ONBOARDING_MOMENTS, useOnboardingAccount, useOnboardingMoments} from "@/src/onboarding/OnboardingStore";
import {ContestSeal, DepartureFork, forkDue, sealDue, stageMoment, StopArrivedToast} from "@/src/onboarding/OnboardingStage";
import {RoyalLetter} from "@/src/onboarding/RoyalLetter";
import {useRoyalLetter, useRoyalLetterAccount} from "@/src/store/RoyalLetterStore";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";

const screenStyles = {flex: 1, backgroundColor: Theme.colors.paper};
const NEW_MARK_SIZE = 8;
const COUNT_MARK_SIZE = 18;
const tabStyles = StyleSheet.create({
	icon: {alignItems: "center", justifyContent: "center"},
	mark: {position: "absolute", top: -Theme.spacing.xs, left: "100%", marginLeft: -Theme.spacing.xs},
	newMark: {
		width: NEW_MARK_SIZE,
		height: NEW_MARK_SIZE,
		borderRadius: NEW_MARK_SIZE / 2,
		backgroundColor: Theme.colors.gold
	},
	countMark: {
		minWidth: COUNT_MARK_SIZE,
		height: COUNT_MARK_SIZE,
		paddingHorizontal: Theme.spacing.xs,
		borderRadius: COUNT_MARK_SIZE / 2,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Theme.colors.gold
	},
	countLabel: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.eyebrow,
		color: Theme.colors.paper,
		fontVariant: ["tabular-nums"]
	}
});

/** Every tab of the app, in the order of the bar; the journey decides which of them are open. */
const TABS: readonly {name: JourneyTab; title: string; icon: string}[] = [
	{name: JOURNEY_TABS.ADVENTURE, title: "app:tabs.adventure", icon: "navigation.adventure"},
	{name: JOURNEY_TABS.PROFILE, title: "app:tabs.profile", icon: "navigation.profile"},
	{name: JOURNEY_TABS.PET, title: "app:tabs.pet", icon: "navigation.pet"},
	{name: JOURNEY_TABS.GUILD, title: "app:tabs.guild", icon: "navigation.guild"},
	{name: JOURNEY_TABS.ARENA, title: "app:tabs.arena", icon: "navigation.fight"}
];

function NewMark(): ReactElement {
	return <View style={tabStyles.newMark} testID="tab-new-mark" />;
}

/** Rewards waiting to be collected are counted, where a new feature is only marked. */
function CountMark({count}: {count: number}): ReactElement {
	return <View style={tabStyles.countMark} testID="tab-count-mark">
		<Text style={tabStyles.countLabel}>{count}</Text>
	</View>;
}

function tabMark(tab: JourneyTab, journey: Journey, unclaimedMissions: number): ReactElement | null {
	if (tab === JOURNEY_TABS.PROFILE && unclaimedMissions > 0) return <CountMark count={unclaimedMissions} />;
	return journey.isNew(tab) ? <NewMark /> : null;
}

/** The mark rides on the icon: a badge of the tab itself drifts to the screen edge when few tabs share the bar. */
function tabIcon(path: string, mark: ReactElement | null): (props: {focused: boolean}) => ReactElement {
	const Icon = ({focused}: {focused: boolean}): ReactElement => <View style={tabStyles.icon}>
		<TwemojiIcon emoji={AppIcons.getIcon(path)} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : 0.55} />
		{mark ? <View style={tabStyles.mark}>{mark}</View> : null}
	</View>;
	Icon.displayName = `TabIcon(${path})`;
	return Icon;
}

const ProfileHeader = (): ReactNode => {
	/*
	 * Reads the profile from the store rather than waiting for the profile screen to fill it in:
	 * the header is shown before that screen is ever opened, and both share this single request.
	 */
	const state = usePlayerProfile();
	const profile = state.status === "ready" ? state.data : null;
	const showClassInfo = (): void => {
		Alert.alert(i18n.t("app:navigation.classInfo"), i18n.t("app:navigation.featureNotAvailable"));
	};
	const classIcon = profile ? AppIcons.getIconOrNull(`classes.${profile.classId}`) : null;
	return (
		<TouchableOpacity onPress={showClassInfo} style={navigationStyles.profileHeader}>
			{classIcon ? <View style={navigationStyles.profileClassIcon}><TwemojiIcon emoji={classIcon} size={Theme.fontSize.hero} /></View> : null}
			<View style={navigationStyles.profileIdentity}>
				<Text style={navigationStyles.profileName}>{profile?.pseudo}</Text>
				{profile ? <Text style={navigationStyles.profileLevel}>{i18n.t("app:profile.level", {level: profile.level})}</Text> : null}
			</View>
		</TouchableOpacity>
	);
};

function TabsHeader(): ReactNode {
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
	const insets = useSafeAreaInsets();
	const detailOpen = useSwipeBackOpen();
	const adventureBusy = useAdventureBusy();
	const unclaimedMissions = useMissionRewards().rewards.missions.length;
	// A lone tab needs no bar: the newcomer only sees the adventure until something else opens.
	const tabBarStyle = journey.tabs.length > 1 && !adventureBusy
		? {...tabBarOptions.tabBarStyle, paddingBottom: insets.bottom + Theme.spacing.tabBarVertical}
		: {display: "none" as const};
	return (
		<TopTabs
			tabBarPosition="bottom"
			screenOptions={{
				...tabBarOptions,
				swipeEnabled: !detailOpen && !adventureBusy && journey.tabs.length > 1,
				tabBarStyle
			}}
			screenListeners={({route}: {route: {name: string}}) => ({focus: (): void => {
				if (isJourneyTab(route.name)) journey.visit(route.name);
			}})}
		>
			{TABS.map(tab => <TopTabs.Protected key={tab.name} guard={journey.tabs.includes(tab.name)}>
				<TopTabs.Screen
					name={tab.name}
					options={{title: i18n.t(tab.title), tabBarIcon: tabIcon(tab.icon, tabMark(tab.name, journey, unclaimedMissions))}}
				/>
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
	if (letter) return <RoyalLetter letter={letter} />;
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
	useMissionRewardsAccount();
	useOnboardingAccount();
	useRoyalLetterAccount();
	useReportNotification();
	useNotificationNavigation();
	if (dead) {
		return <DeathScreen />;
	}
	return (
		<View style={screenStyles}>
			<TabsHeader />
			<SwipeBackBoundary><TabPager journey={journey} /></SwipeBackBoundary>
			<OnboardingOverlays journey={journey} />
			<MissionCompletedToast />
			<BlessingActivatedToast />
			<StopToast />
		</View>
	);
}
