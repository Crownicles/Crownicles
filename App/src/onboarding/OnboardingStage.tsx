import {ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {Modal, StyleSheet, Text, View} from "react-native";
import {usePathname, useRouter} from "expo-router";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {AppIcons} from "@/src/AppIcons";
import {ActionBanner, Toast} from "@/src/design/Sections";
import {Bell, Check, Footprints} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Celebration} from "@/src/components/UnlockCelebration";
import {clockTime} from "@/src/display/Clock";
import {reportOpensAt} from "@/src/display/ReportTiming";
import {reportNotificationsAllowed, requestReportNotifications} from "@/src/notifications/ReportNotifications";
import {ContestView} from "@/src/onboarding/ContestBooklet";
import {OnboardingMoments, ONBOARDING_MOMENTS} from "@/src/onboarding/OnboardingStore";
import {i18n} from "@/src/translations/i18n";

/** The road to the first city is long enough to leave the app: shorter hops are not worth the card. */
const FORK_MIN_TRIP_MS = 20 * 60_000;

/** A report whose time came within this margin of the moment it opened reached it on its own, not through tokens. */
const NATURAL_STOP_TOLERANCE_MS = 5_000;

const TOAST_EMBLEM_SIZE = 24;

const styles = StyleSheet.create({
	actions: {gap: Theme.spacing.sm},
	notified: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.bodySmall, color: Theme.colors.muted, textAlign: "center", paddingVertical: Theme.spacing.md}
});

/** What the report shows now; a discovery waits for this to change before following another. */
export function stageMoment(view: ReportViewRes | null): string {
	const travel = view?.travel;
	return [travel?.nextStopTime, travel?.arriveTime, travel?.endMap.id, view?.reportReady, view?.city ? "city" : "road"].join(":");
}

/** The long road of the contest's second trial is where a newcomer may leave: the guide offers the reminder there, once. */
export function forkDue({view, contest, moments}: {view: ReportViewRes | null; contest: ContestView | null; moments: OnboardingMoments}): ReportTravelSummaryRes | null {
	const travel = view?.travel;
	if (!travel || view?.city || !contest?.running || !moments.ready || moments.seen(ONBOARDING_MOMENTS.FORK)) return null;
	if (contest.contest.current?.trial.id !== "road") return null;
	return travel.arriveTime - travel.startTime >= FORK_MIN_TRIP_MS ? travel : null;
}

function destinationName(travel: ReportTravelSummaryRes): string {
	return travel.endMap.id > 0 ? i18n.t(`models:map_locations.${travel.endMap.id}.name`) : i18n.t("app:adventure.unknownLocation");
}

/** The end of the first session: the character goes on alone, and the player chooses how to come back. */
export function DepartureFork({travel, onClose}: {travel: ReportTravelSummaryRes; onClose: () => void}): ReactNode {
	const [allowed, setAllowed] = useState<boolean | null>(null);
	useEffect(() => {
		reportNotificationsAllowed().then(setAllowed).catch(() => setAllowed(false));
	}, []);
	const notify = (): void => {
		requestReportNotifications().catch(error => console.warn("Report notifications not allowed:", error)).finally(onClose);
	};
	return <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
		<Celebration
			icon="other.walking"
			eyebrow={i18n.t("app:contest.fork.eyebrow")}
			title={i18n.t("app:contest.fork.title")}
			description={i18n.t("app:contest.fork.description", {destination: destinationName(travel), arrival: clockTime(travel.arriveTime)})}
			testID="departure-fork"
		>
			<View style={styles.actions}>
				<ActionBanner icon={Footprints} label={i18n.t("app:contest.fork.continue")} onPress={onClose} testID="departure-fork-continue" />
				{allowed === false
					? <ActionBanner icon={Bell} label={i18n.t("app:contest.fork.notify")} onPress={notify} testID="departure-fork-notify" />
					: allowed ? <Text style={styles.notified}>{i18n.t("app:contest.fork.notified")}</Text> : null}
			</View>
		</Celebration>
	</Modal>;
}

/** The royal seal closes the contest: the player learns the real rhythm of the journey starts now. */
export function ContestSeal({onClose}: {onClose: () => void}): ReactNode {
	return <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
		<Celebration
			icon="other.seal"
			eyebrow={i18n.t("app:contest.seal.eyebrow")}
			title={i18n.t("app:contest.seal.title")}
			description={i18n.t("app:contest.seal.description")}
			testID="contest-seal"
		>
			<ActionBanner icon={Check} label={i18n.t("app:contest.seal.continue")} onPress={onClose} testID="contest-seal-continue" />
		</Celebration>
	</Modal>;
}

/**
 * Says a stop came by itself while the player was busy elsewhere: time runs on the road, and what
 * it brings costs nothing. A stop reached with tokens is expected, so it says nothing then.
 */
export function StopArrivedToast({view, contestRunning}: {view: ReportViewRes | null; contestRunning: boolean}): ReactNode {
	const router = useRouter();
	const pathname = usePathname();
	const [shown, setShown] = useState(false);
	const previous = useRef<{ready: boolean; opensAt: number | null}>({ready: true, opensAt: null});
	const ready = view?.reportReady ?? true;
	const opensAt = view?.travel && !view.city ? reportOpensAt(view.travel) : null;
	useEffect(() => {
		const before = previous.current;
		previous.current = {ready, opensAt};
		if (!ready || before.ready || before.opensAt === null) return;
		if (before.opensAt <= Date.now() + NATURAL_STOP_TOLERANCE_MS) setShown(true);
	}, [ready, opensAt]);
	const dismiss = useCallback((): void => setShown(false), []);
	if (!shown || !contestRunning && pathname === "/") return null;
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("other.walking")} size={TOAST_EMBLEM_SIZE} />}
		title={i18n.t("app:contest.stopArrived.title")}
		subtitle={i18n.t("app:contest.stopArrived.subtitle")}
		onDismiss={dismiss}
		onPress={(): void => {
			dismiss();
			router.navigate("/");
		}}
	/>;
}
