import React, {ReactNode, useContext, useState} from "react";
import {useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {VersionReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {VersionRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthContext} from "@/src/authentication/AuthContext";
import {PreferencesContext} from "@/src/preferences/PreferencesContext";
import {travelAdvicePreference, useTravelAdvicesShown} from "@/src/preferences/TravelAdvicePreference";
import {GameClient} from "@/src/networking/GameClient";
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
import {SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ChoiceRow, EntryRow, ExpandableList, QuestionSheet, Standing, SwitchRow} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {THEME_PREFERENCES} from "@/src/design/ThemePreference";
import {useTheme} from "@/src/design/ThemeContext";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {LogOut} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const ROW_EMBLEM_SIZE = 24;

function rowEmblem(path: string): ReactNode {
	return <TwemojiIcon emoji={AppIcons.getIcon(path)} size={ROW_EMBLEM_SIZE} />;
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

/** Leaving is confirmed in place: the session and this device's notifications go with it. */
function LogoutSheet({onClose}: {onClose: () => void}): ReactNode {
	const authState = useContext(AuthContext);
	const logout = (): void => {
		cancelReportNotification();
		forgetPushDevice();
		authState.setState(AuthStateEnum.NO_TOKEN);
		authState.clearToken().catch(error => console.error("Failed to clear token:", error));
	};
	return <QuestionSheet
		caption={i18n.t("app:settings.sections.account")}
		title={i18n.t("app:settings.logoutConfirm.title")}
		subtitle={i18n.t("app:settings.logoutConfirm.subtitle")}
		onClose={onClose}
		testID="logout-sheet"
	>
		<ActionBanner icon={LogOut} label={i18n.t("app:settings.logout")} onPress={logout} />
	</QuestionSheet>;
}

function AccountSettings(): ReactNode {
	const router = useRouter();
	const [leaving, setLeaving] = useState(false);
	return <>
		<SectionHeader>{i18n.t("app:settings.sections.account")}</SectionHeader>
		<ExpandableList>
			<EntryRow title={i18n.t("app:settings.logout")} onPress={(): void => setLeaving(true)} />
			<EntryRow title={i18n.t("app:settings.deleteAccount.entry")} danger onPress={(): void => router.push("/settings/delete-account")} />
		</ExpandableList>
		{leaving ? <LogoutSheet onClose={(): void => setLeaving(false)} /> : null}
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
	const version = useGameQuery(GAME_ENTITIES.VERSION, () => GameClient.request(makeFromClientPacket(VersionReq, {}), VersionRes));
	return <>
		<SectionHeader>{i18n.t("app:settings.sections.about")}</SectionHeader>
		<ExpandableList>
			<EntryRow title={i18n.t("app:settings.coreVersion")} end={version.status === "ready" ? version.data.coreVersion : i18n.t("app:common.loading")} />
			<SwitchRow label={i18n.t("app:settings.developerMode")} value={preferences.getDevMode()} onChange={preferences.setDevMode} />
			{preferences.getDevMode() ? <DeveloperTools /> : null}
		</ExpandableList>
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
		<AccountSettings />
		<AboutSettings />
	</Page>;
}
