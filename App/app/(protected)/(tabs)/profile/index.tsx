import {useNavigation, useRouter} from "expo-router";
import {ReactNode, useEffect} from "react";
import {ActivityIndicator, View} from "react-native";
import {RequestState} from "@/src/store/useGameQuery";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ProfilePage, ProfileView} from "@/src/components/ProfileView";
import {AppIcons} from "@/src/AppIcons";
import {EmptyState, QuickAction, QuickActions, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {useDailyBonusToClaim} from "@/src/store/useClaimables";
import {useContest} from "@/src/onboarding/Contest";
import {GuideTip} from "@/src/onboarding/GuideTip";
import {ONBOARDING_MOMENTS, useOnboardingMoments} from "@/src/onboarding/OnboardingStore";
import {useJourney} from "@/src/journey/useJourney";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const PROFILE_PAGES: {page: ProfilePage; icon: string}[] = [
	{page: "inventory", icon: "inventory.stock"},
	{page: "unlock", icon: "notifications.types.playerFreedFromJail"},
	{page: "guide", icon: "missions.book"},
	{page: "blessing", icon: "smallEvents.altar"}
];

const useStyles = createStyles(() => ({
	state: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Theme.spacing.xxl
	}
}));

/** The profile opens with the first item of the contest: the guide says once what the page holds. */
function ProfileGuide(): ReactNode {
	const moments = useOnboardingMoments();
	const contestRunning = useContest()?.running === true;
	const guiding = contestRunning && moments.ready;
	if (!guiding || moments.seen(ONBOARDING_MOMENTS.PROFILE)) return null;
	return <GuideTip
		text={i18n.t("app:contest.tips.profile")}
		action={{label: i18n.t("app:contest.tips.understood"), onPress: (): void => moments.mark(ONBOARDING_MOMENTS.PROFILE)}}
		testID="guide-tip-profile"
	/>;
}

function ProfileDetails({profile, onPage}: {profile: ProfileRes; onPage: (page: ProfilePage) => void}): ReactNode {
	// Bailing other players out means nothing yet to someone still discovering the game.
	const beginner = useJourney().nextStep !== null;
	const pages = beginner ? PROFILE_PAGES.filter(entry => entry.page !== "unlock") : PROFILE_PAGES;
	const dailyBonusToClaim = useDailyBonusToClaim();
	return <ProfileView profile={profile} onPage={onPage} lead={<>
		<ProfileGuide />
		<QuickActions>
			{pages.map(entry => <QuickAction
				key={entry.page}
				icon={AppIcons.getIcon(entry.icon)}
				badge={entry.page === "inventory" ? dailyBonusToClaim : 0}
				onPress={(): void => onPage(entry.page)}
			>{i18n.t(`app:profile.titles.${entry.page}`)}</QuickAction>)}
		</QuickActions>
	</>} />;
}

function ProfileState({state, onPage}: {state: RequestState<ProfileRes>; onPage: (page: ProfilePage) => void}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	if (state.status === "loading") {
		return (
			<View style={styles.state}>
				<ActivityIndicator size="large" color={colors.ink} />
				<EmptyState>{i18n.t("app:common.loading")}</EmptyState>
			</View>
		);
	}
	if (state.status === "empty" || state.status === "failed") {
		return <EmptyState>{state.status === "empty" ? i18n.t("app:profile.notFound") : i18n.t("app:common.error")}</EmptyState>;
	}
	return <ProfileDetails profile={state.data} onPage={onPage} />;
}

export default function Profile(): ReactNode {
	const profileState = usePlayerProfile();
	const navigation = useNavigation();
	const router = useRouter();
	const profile = profileState.status === "ready" ? profileState.data : null;

	useEffect(() => {
		if (profile) {
			navigation.setOptions({title: profile.pseudo});
		}
	}, [profile, navigation]);

	return <Screen><ProfileState state={profileState} onPage={(page): void => router.push(`/profile/${page}`)} /></Screen>;
}
