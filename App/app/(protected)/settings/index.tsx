import {SegmentedControl} from "@/src/design/SegmentedControl";
import {useFightSpeed} from "@/src/store/useFightSpeed";
import {FIGHT_SPEEDS} from "@/src/display/FightMotion";
import React, {PropsWithChildren} from "react";
import {useRouter} from "expo-router";
import {ActivityIndicator, ScrollView, Switch, Text, View} from "react-native";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthContext} from "@/src/authentication/AuthContext";
import {PreferencesContext} from "@/src/preferences/PreferencesContext";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PingReq} from "ws-packets/src/fromClient/PingReq";
import {PingRes} from "ws-packets/src/fromServer/ping/PingRes";
import {VersionReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {VersionRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {Theme} from "@/src/design/Theme";
import {THEME_PREFERENCES} from "@/src/design/ThemePreference";
import {BackButton} from "@/src/design/Sections";
import {Button as DesignButton} from "@/src/design/Primitives";
import {cancelReportNotification} from "@/src/notifications/ReportNotifications";
import {forgetPushDevice} from "@/src/notifications/PushRegistration";
import {NOTIFICATION_PERMISSIONS, useNotificationPermission} from "@/src/notifications/NotificationPermission";
import {DELIVERED_NOTIFICATION_TYPES, useNotificationPreferenceChange, useNotificationPreferences} from "@/src/store/useNotificationPreferences";
import {i18n} from "@/src/translations/i18n";
import {travelAdvicePreference, useTravelAdvicesShown} from "@/src/preferences/TravelAdvicePreference";
import {createStyles, useTheme} from "@/src/design/ThemeContext";

const useStyles = createStyles(colors => ({
	combatPreference: {marginBottom: Theme.spacing.lg},
	preferenceLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.body, color: colors.ink},
	container: {
		flex: 1,
		padding: Theme.spacing.xl,
		backgroundColor: colors.wash,
	},
	header: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.hero,
		marginBottom: Theme.spacing.xl,
		color: colors.ink,
	},
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: Theme.spacing.xl,
	},
	listItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.sm,
		backgroundColor: colors.paper,
		borderRadius: Theme.radius,
		borderWidth: 1,
		borderColor: colors.line,
	},
	loadingIndicator: {
		marginLeft: Theme.spacing.sm
	},
	pingValue: {
		marginLeft: Theme.spacing.sm,
		fontFamily: Theme.fonts.regular,
		color: colors.muted
	},
	label: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		color: colors.ink
	},
	typeLabel: {
		flex: 1,
		marginRight: Theme.spacing.md
	},
	hint: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.note,
		color: colors.muted,
		marginVertical: Theme.spacing.sm
	},
}));

const ListItem = ({ children }: PropsWithChildren) => {
	const styles = useStyles();
	return <View style={styles.listItem}>
		{children}
	</View>;
};

/** Settings are pointless while the phone forbids the app to notify: the way to allow it comes first. */
function NotificationPermissionNotice(): React.JSX.Element | null {
	const styles = useStyles();
	const {permission, allow} = useNotificationPermission();
	if (permission === null || permission === NOTIFICATION_PERMISSIONS.GRANTED) return null;
	return (
		<View>
			<Text style={styles.hint}>{i18n.t("app:settings.notifications.permission.off")}</Text>
			<DesignButton onPress={allow}>
				{i18n.t(permission === NOTIFICATION_PERMISSIONS.BLOCKED ? "app:settings.notifications.permission.openSettings" : "app:settings.notifications.permission.allow")}
			</DesignButton>
		</View>
	);
}

/** One switch per kind the app sends; Discord's settings are separate and are not touched here. */
function NotificationSettings(): React.JSX.Element {
	const styles = useStyles();
	const state = useNotificationPreferences();
	const change = useNotificationPreferenceChange();
	return (
		<View style={styles.combatPreference}>
			<Text style={styles.preferenceLabel}>{i18n.t("app:settings.notifications.label")}</Text>
			<Text style={styles.hint}>{i18n.t("app:settings.notifications.independent")}</Text>
			<NotificationPermissionNotice />
			{DELIVERED_NOTIFICATION_TYPES.map(type => (
				<ListItem key={type}>
					<Text style={[styles.label, styles.typeLabel]}>{i18n.t(`app:settings.notifications.types.${type}`)}</Text>
					{state.status === "ready"
						? <Switch
							accessibilityLabel={i18n.t(`app:settings.notifications.types.${type}`)}
							value={state.data.preferences[type]}
							disabled={change.pending}
							onValueChange={(enabled): void => {
								change.submit({type, enabled}).then();
							}}
						/>
						: <ActivityIndicator size="small" style={styles.loadingIndicator} />}
				</ListItem>
			))}
			{change.message ? <Text style={styles.hint}>{change.message}</Text> : null}
		</View>
	);
}

function TravelAdviceSetting(): React.JSX.Element {
	const styles = useStyles();
	const shown = useTravelAdvicesShown();
	return (
		<View style={styles.combatPreference}>
			<ListItem>
				<Text style={styles.label}>{i18n.t("app:settings.travelAdvices.label")}</Text>
				<Switch accessibilityLabel={i18n.t("app:settings.travelAdvices.label")} value={shown} onValueChange={travelAdvicePreference.set} />
			</ListItem>
			<Text style={styles.hint}>{i18n.t("app:settings.travelAdvices.hint")}</Text>
		</View>
	);
}

export default function Index() {
	const styles = useStyles();
	const router = useRouter();
	const preferences = React.useContext(PreferencesContext);
	const authState = React.useContext(AuthContext);
	const {speed, setSpeed} = useFightSpeed();
	const theme = useTheme();
	const [pingLoading, setPingLoading] = React.useState(false);
	const [pingTime, setPingTime] = React.useState<number | null>(null);
	const version = useGameQuery(GAME_ENTITIES.VERSION, () => GameClient.request(makeFromClientPacket(VersionReq, {}), VersionRes));

	const handlePing = () => {
		setPingLoading(true);
		setPingTime(null);
		const startTime = Date.now();
		WebSocketClient.getInstance().sendPacket(makeFromClientPacket(PingReq, { time: startTime }), {
			[PingRes.wireName]: (packet: PingRes) => {
				const elapsed = Date.now() - packet.time;
				setPingTime(elapsed);
				setPingLoading(false);
			},
		});
	};

	return (
		<View style={styles.container}>
			<ScrollView>
				<BackButton label={i18n.t("app:common.back")} onClose={router.back} />
				<View style={styles.combatPreference}>
					<Text style={styles.preferenceLabel}>{i18n.t("app:battle.speed.label")}</Text>
					<SegmentedControl label={i18n.t("app:battle.speed.label")} value={speed} onChange={setSpeed} options={[
						{value: FIGHT_SPEEDS.NORMAL, label: i18n.t("app:battle.speed.normal")},
						{value: FIGHT_SPEEDS.FAST, label: i18n.t("app:battle.speed.fast")}
					]} />
				</View>
				<View style={styles.combatPreference}>
					<Text style={styles.preferenceLabel}>{i18n.t("app:settings.theme.label")}</Text>
					<SegmentedControl label={i18n.t("app:settings.theme.label")} value={theme.preference} onChange={theme.setPreference} options={[
						{value: THEME_PREFERENCES.SYSTEM, label: i18n.t("app:settings.theme.system")},
						{value: THEME_PREFERENCES.LIGHT, label: i18n.t("app:settings.theme.light")},
						{value: THEME_PREFERENCES.DARK, label: i18n.t("app:settings.theme.dark")}
					]} />
				</View>
				<NotificationSettings />
				<TravelAdviceSetting />
				<ListItem>
					<Text style={styles.label}>{i18n.t("app:settings.coreVersion")}</Text>
					<Text style={styles.pingValue}>{version.status === "ready" ? version.data.coreVersion : i18n.t("app:common.loading")}</Text>
				</ListItem>
				<ListItem>
					<Text style={styles.label}>{i18n.t("app:settings.developerMode")}</Text>
					<Switch value={preferences.getDevMode()} onValueChange={preferences.setDevMode} />
				</ListItem>
				{preferences.getDevMode() && (
					<ListItem>
							<DesignButton onPress={handlePing} disabled={pingLoading} variant="primary">{i18n.t("app:settings.ping")}</DesignButton>
						{pingLoading ? (
							<ActivityIndicator size="small" style={styles.loadingIndicator} />
						) : pingTime !== null ? (
							<Text style={styles.pingValue}>{pingTime} ms</Text>
						) : null}
					</ListItem>
				)}
				{preferences.getDevMode() && (
					<ListItem>
						<DesignButton onPress={() => router.push("/settings/test-commands")}>{i18n.t("app:settings.testCommands.title")}</DesignButton>
					</ListItem>
				)}
				<ListItem>
					<DesignButton variant="danger" onPress={() => {
						cancelReportNotification();
						forgetPushDevice();
						authState.setState(AuthStateEnum.NO_TOKEN);
						authState.clearToken().then().catch((err) => {
							console.error("Failed to clear token:", err);
						});
					}}>{i18n.t("app:settings.logout")}</DesignButton>
				</ListItem>
				<ListItem>
					<DesignButton variant="danger" onPress={() => router.push("/settings/delete-account")}>
						{i18n.t("app:settings.deleteAccount.entry")}
					</DesignButton>
				</ListItem>
			</ScrollView>
		</View>
	);
}
