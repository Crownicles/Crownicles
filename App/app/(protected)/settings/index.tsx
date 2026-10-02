import React, {ReactNode, useContext, useRef, useState} from "react";
import {Linking} from "react-native";
import {useRouter} from "expo-router";
import {nativeApplicationVersion, nativeBuildVersion} from "expo-application";
import Constants from "expo-constants";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {VersionReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {VersionRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthContext} from "@/src/authentication/AuthContext";
import {PreferencesContext} from "@/src/preferences/PreferencesContext";
import {travelAdvicePreference, useTravelAdvicesShown} from "@/src/preferences/TravelAdvicePreference";
import {GameClient} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useFightSpeed} from "@/src/store/useFightSpeed";
import {usePing} from "@/src/store/usePing";
import {enabledCount, useNotificationPreferences} from "@/src/store/useNotificationPreferences";
import {FIGHT_SPEEDS} from "@/src/display/FightMotion";
import {cancelReportNotification} from "@/src/notifications/ReportNotifications";
import {forgetPushDevice} from "@/src/notifications/PushRegistration";
import {NOTIFICATION_PERMISSIONS, useNotificationPermission} from "@/src/notifications/NotificationPermission";
import {Page} from "@/src/design/DetailScreen";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ChoiceRow, EntryRow, ExpandableList, QuestionSheet, Refusal, Standing, SwitchRow} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {THEME_PREFERENCES} from "@/src/design/ThemePreference";
import {useTheme} from "@/src/design/ThemeContext";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {BookOpen, LogOut, Shield, UserRound} from "@/src/design/FightIcons";
import {AppConstants} from "@/src/AppConstants";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";
import {GameServicesSettings} from "@/src/gameServices/GameServicesSettings";

const ROW_EMBLEM_SIZE = 24;
type LegalPageUrl = typeof AppConstants.LEGAL_URLS[keyof typeof AppConstants.LEGAL_URLS];

function rowEmblem(path: string): ReactNode {
	return <TwemojiIcon emoji={AppIcons.getIcon(path)} size={ROW_EMBLEM_SIZE} />;
}

/** The installed binary is the reference; the web preview has none and falls back to the declared version. */
function appVersion(): string {
	const version = nativeApplicationVersion ?? Constants.expoConfig?.version ?? "?";
	return nativeApplicationVersion && nativeBuildVersion
		? i18n.t("app:settings.appVersionValue", {version, build: nativeBuildVersion})
		: version;
}

function GameSettings(): ReactNode {
	const {speed, setSpeed} = useFightSpeed();
	const travelAdvices = useTravelAdvicesShown();
	return <>
		<SectionHeader first>{i18n.t("app:settings.sections.game")}</SectionHeader>
		<ExpandableList>
			<ChoiceRow label={i18n.t("app:battle.speed.label")}>
				<SegmentedControl label={i18n.t("app:battle.speed.label")} value={speed} onChange={setSpeed} options={[
					{value: FIGHT_SPEEDS.NORMAL, label: i18n.t("app:battle.speed.normal")},
					{value: FIGHT_SPEEDS.FAST, label: i18n.t("app:battle.speed.fast")}
				]} />
			</ChoiceRow>
			<SwitchRow
				label={i18n.t("app:settings.travelAdvices.label")}
				caption={i18n.t("app:settings.travelAdvices.hint")}
				value={travelAdvices}
				onChange={travelAdvicePreference.set}
			/>
		</ExpandableList>
	</>;
}

function DisplaySettings(): ReactNode {
	const theme = useTheme();
	return <>
		<SectionHeader>{i18n.t("app:settings.sections.display")}</SectionHeader>
		<ExpandableList>
			<ChoiceRow label={i18n.t("app:settings.theme.label")}>
				<SegmentedControl label={i18n.t("app:settings.theme.label")} value={theme.preference} onChange={theme.setPreference} options={[
					{value: THEME_PREFERENCES.SYSTEM, label: i18n.t("app:settings.theme.system")},
					{value: THEME_PREFERENCES.LIGHT, label: i18n.t("app:settings.theme.light")},
					{value: THEME_PREFERENCES.DARK, label: i18n.t("app:settings.theme.dark")}
				]} />
			</ChoiceRow>
		</ExpandableList>
	</>;
}

/** The phone's refusal comes first: the settings chosen in the app do nothing while it lasts. */
function notificationSummary(permission: ReturnType<typeof useNotificationPermission>["permission"], count: ReturnType<typeof enabledCount>): string | undefined {
	if (permission === NOTIFICATION_PERMISSIONS.BLOCKED || permission === NOTIFICATION_PERMISSIONS.ASKABLE) {
		return i18n.t("app:settings.notifications.summary.off");
	}
	return count ? i18n.t("app:settings.notifications.summary.count", count) : undefined;
}

function NotificationsEntry(): ReactNode {
	const router = useRouter();
	const {permission} = useNotificationPermission();
	const summary = notificationSummary(permission, enabledCount(useNotificationPreferences()));
	return <>
		<SectionHeader>{i18n.t("app:settings.sections.notifications")}</SectionHeader>
		<ExpandableList>
			<EntryRow
				emblem={rowEmblem("notifications.bell")}
				title={i18n.t("app:settings.notifications.entry")}
				{...summary ? {subtitle: summary} : {}}
				onPress={(): void => router.push("/settings/notifications")}
			/>
		</ExpandableList>
	</>;
}

async function endSession(authState: React.ContextType<typeof AuthContext>): Promise<void> {
	await cancelReportNotification();
	forgetPushDevice();
	WebSocketClient.getInstance().disconnect();
	await authState.clearToken();
	authState.setState(AuthStateEnum.NO_TOKEN);
}

type SessionExit = {
	pending: boolean;
	failed: boolean;
	leave: () => void;
};

function useSessionExit(): SessionExit {
	const authState = useContext(AuthContext);
	const leaving = useRef(false);
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const leave = (): void => {
		if (leaving.current) return;
		leaving.current = true;
		setPending(true);
		setFailed(false);
		endSession(authState).catch((error: unknown): void => {
			console.warn("Failed to end session:", error);
			setFailed(true);
		}).finally((): void => {
			leaving.current = false;
			setPending(false);
		});
	};
	return {pending, failed, leave};
}

/** Leaving is confirmed in place: the session and this device's notifications go with it. */
function LogoutSheet({onClose, sessionExit}: {onClose: () => void; sessionExit: SessionExit}): ReactNode {
	return <QuestionSheet
		caption={i18n.t("app:settings.sections.account")}
		title={i18n.t("app:settings.logoutConfirm.title")}
		subtitle={i18n.t("app:settings.logoutConfirm.subtitle")}
		onClose={onClose}
		testID="logout-sheet"
	>
		{sessionExit.failed ? <Refusal>{i18n.t("app:settings.changeAccountFailed")}</Refusal> : null}
		<ActionBanner icon={LogOut} label={sessionExit.pending ? i18n.t("app:settings.leavingAccount") : i18n.t("app:settings.logout")} pending={sessionExit.pending} onPress={sessionExit.leave} />
	</QuestionSheet>;
}

function AccountSettings(): ReactNode {
	const router = useRouter();
	const [leaving, setLeaving] = useState(false);
	const sessionExit = useSessionExit();
	return <>
		<SectionHeader>{i18n.t("app:settings.sections.account")}</SectionHeader>
		{sessionExit.pending ? <Note>{i18n.t("app:settings.leavingAccount")}</Note> : null}
		<ExpandableList>
			<EntryRow emblem={<UserRound size={ROW_EMBLEM_SIZE} />} title={i18n.t("app:settings.changeAccount")} disabled={sessionExit.pending} onPress={sessionExit.leave} />
			<EntryRow title={i18n.t("app:settings.logout")} disabled={sessionExit.pending} onPress={(): void => setLeaving(true)} />
			<EntryRow title={i18n.t("app:settings.deleteAccount.entry")} disabled={sessionExit.pending} danger onPress={(): void => router.push("/settings/delete-account")} />
		</ExpandableList>
		{sessionExit.failed && !leaving ? <Refusal>{i18n.t("app:settings.changeAccountFailed")}</Refusal> : null}
		{leaving ? <LogoutSheet sessionExit={sessionExit} onClose={(): void => {
			if (!sessionExit.pending) setLeaving(false);
		}} /> : null}
	</>;
}

function DeveloperTools(): ReactNode {
	const router = useRouter();
	const ping = usePing();
	const latency = ping.latency === null ? undefined : i18n.t("app:settings.pingValue", {value: ping.latency});
	return <>
		<EntryRow
			title={i18n.t("app:settings.ping")}
			{...latency ? {end: latency} : {}}
			disabled={ping.pending}
			onPress={ping.measure}
		/>
		<EntryRow title={i18n.t("app:settings.testCommands.title")} onPress={(): void => router.push("/settings/test-commands")} />
	</>;
}

function AboutSettings(): ReactNode {
	const preferences = useContext(PreferencesContext);
	const [legalLinkFailed, setLegalLinkFailed] = useState(false);
	const version = useGameQuery(GAME_ENTITIES.VERSION, () => GameClient.request(makeFromClientPacket(VersionReq, {}), VersionRes));
	const openLegalPage = (url: LegalPageUrl): void => {
		setLegalLinkFailed(false);
		Linking.openURL(url).catch(() => setLegalLinkFailed(true));
	};
	return <>
		<SectionHeader>{i18n.t("app:settings.sections.about")}</SectionHeader>
		<ExpandableList>
			<EntryRow emblem={<Shield size={ROW_EMBLEM_SIZE} />} title={i18n.t("app:settings.legal.privacy")} onPress={(): void => openLegalPage(AppConstants.LEGAL_URLS.PRIVACY)} />
			<EntryRow emblem={<BookOpen size={ROW_EMBLEM_SIZE} />} title={i18n.t("app:settings.legal.terms")} onPress={(): void => openLegalPage(AppConstants.LEGAL_URLS.TERMS)} />
			<EntryRow title={i18n.t("app:settings.appVersion")} end={appVersion()} />
			<EntryRow title={i18n.t("app:settings.coreVersion")} end={version.status === "ready" ? version.data.coreVersion : i18n.t("app:common.loading")} />
			<SwitchRow label={i18n.t("app:settings.developerMode")} value={preferences.getDevMode()} onChange={preferences.setDevMode} />
			{preferences.getDevMode() ? <DeveloperTools /> : null}
		</ExpandableList>
		{legalLinkFailed ? <Refusal>{i18n.t("app:settings.legal.openFailed")}</Refusal> : null}
	</>;
}

export default function Settings(): ReactNode {
	const router = useRouter();
	return <Page
		onClose={router.back}
		heading={<Standing
			emblem={<TwemojiIcon emoji={AppIcons.getIcon("other.gear")} size={Theme.dimensions.headerIcon} />}
			caption={i18n.t("app:settings.eyebrow")}
			title={i18n.t("app:settings.title")}
		/>}
	>
		<GameSettings />
		<DisplaySettings />
		<NotificationsEntry />
		<GameServicesSettings />
		<AccountSettings />
		<AboutSettings />
	</Page>;
}
