import {ReactElement, ReactNode, useEffect, useState} from "react";
import {useRouter} from "expo-router";
/** Expo SDK 57 no longer accepts react-navigation directly, so the top tabs come from its own copy. */
import {TopTabs} from "expo-router/js-top-tabs";
import {Alert, Text, TouchableOpacity, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {useNavigationStyles, tabBarOptionsOf} from "@/src/design/Navigation";
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
import {LevelUpToast} from "@/src/components/LevelUpToast";
import {useNotificationNavigation, useReportNotification} from "@/src/notifications/useNotifications";
import {allowPermissionPrompt} from "@/src/notifications/ReportNotifications";
import {useReportView} from "@/src/store/useReportActions";
import {ContestView, useContest} from "@/src/onboarding/Contest";
import {OnboardingMoments, ONBOARDING_MOMENTS, useOnboardingMoments} from "@/src/onboarding/OnboardingStore";
import {ContestSeal, DepartureFork, forkDue, sealDue, stageMoment, StopArrivedToast} from "@/src/onboarding/OnboardingStage";
import {RoyalLetter} from "@/src/onboarding/RoyalLetter";
import {useRoyalLetter} from "@/src/store/RoyalLetterStore";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const NEW_MARK_SIZE = 8;
const ACTIVE_PILL = {width: 52, height: 28} as const;
const INACTIVE_ICON_OPACITY = 0.45;
const useTabStyles = createStyles(colors => ({
	// Both states keep the pill's size: the tab bar cross-fades them on top of each other.
	icon: {...ACTIVE_PILL, borderRadius: ACTIVE_PILL.height / 2, alignItems: "center", justifyContent: "center"},
	active: {backgroundColor: colors.goldWash},
	mark: {
		position: "absolute",
		top: (ACTIVE_PILL.height - Theme.dimensions.tabBarIcon) / 2 - Theme.spacing.xs,
		left: "50%",
		marginLeft: Theme.dimensions.tabBarIcon / 2 - Theme.spacing.xs
	},
	newMark: {
		width: NEW_MARK_SIZE,
		height: NEW_MARK_SIZE,
		borderRadius: NEW_MARK_SIZE / 2,
		backgroundColor: colors.gold
	}
}));

/** Every tab of the app, in the order of the bar; the journey decides which of them are open. */
const TABS: readonly {name: JourneyTab; title: string; icon: string}[] = [
	{name: JOURNEY_TABS.ADVENTURE, title: "app:tabs.adventure", icon: "navigation.adventure"},
	{name: JOURNEY_TABS.PROFILE, title: "app:tabs.profile", icon: "navigation.profile"},
	{name: JOURNEY_TABS.PET, title: "app:tabs.pet", icon: "navigation.pet"},
	{name: JOURNEY_TABS.GUILD, title: "app:tabs.guild", icon: "navigation.guild"},
	{name: JOURNEY_TABS.ARENA, title: "app:tabs.arena", icon: "navigation.fight"}
];

function NewMark(): ReactElement {
	const tabStyles = useTabStyles();
	return <View style={tabStyles.newMark} testID="tab-new-mark" />;
}

function tabMark(tab: JourneyTab, journey: Journey): ReactElement | null {
	return journey.isNew(tab) ? <NewMark /> : null;
}

function TabIconView({path, mark, focused}: {path: string; mark: ReactElement | null; focused: boolean}): ReactElement {
	const tabStyles = useTabStyles();
	return <View style={[tabStyles.icon, focused && tabStyles.active]}>
		<TwemojiIcon emoji={AppIcons.getIcon(path)} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : INACTIVE_ICON_OPACITY} />
		{mark ? <View style={tabStyles.mark}>{mark}</View> : null}
	</View>;
}

/** The mark rides on the icon: a badge of the tab itself drifts to the screen edge when few tabs share the bar. */
function tabIcon(path: string, mark: ReactElement | null): (props: {focused: boolean}) => ReactElement {
	// The navigator calls this as a plain function, so the hook lives in the component it returns.
	const Icon = ({focused}: {focused: boolean}): ReactElement => <TabIconView path={path} mark={mark} focused={focused} />;
	Icon.displayName = `TabIcon(${path})`;
	return Icon;
}

const ProfileHeader = (): ReactNode => {
	const navigationStyles = useNavigationStyles();
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
	const insets = useSafeAreaInsets();
	const detailOpen = useSwipeBackOpen();
	const adventureBusy = useAdventureBusy();
	const tabBarOptions = tabBarOptionsOf(useColors());
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
					options={{title: i18n.t(tab.title), tabBarIcon: tabIcon(tab.icon, tabMark(tab.name, journey))}}
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
	useReportNotification();
	useNotificationNavigation();
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
			<LevelUpToast />
			<StopToast />
		</View>
	);
}
