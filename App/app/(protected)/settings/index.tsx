import {SegmentedControl} from "@/src/design/SegmentedControl";
import {useFightSpeed} from "@/src/store/useFightSpeed";
import {FIGHT_SPEEDS} from "@/src/display/FightMotion";
import React, {PropsWithChildren} from "react";
import {useRouter} from "expo-router";
import {ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View} from "react-native";
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
import {storedThemePreference, THEME_PREFERENCES, ThemePreference} from "@/src/design/ThemePreference";
import {applyThemePreference} from "@/src/design/useThemeFollower";
import {BackButton} from "@/src/design/Sections";
import {Button as DesignButton} from "@/src/design/Primitives";
import {cancelReportNotification} from "@/src/notifications/ReportNotifications";
import {DELIVERED_NOTIFICATION_TYPES, useNotificationPreferenceChange, useNotificationPreferences} from "@/src/store/useNotificationPreferences";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	combatPreference: {marginBottom: Theme.spacing.lg},
	preferenceLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.body, color: Theme.colors.ink},
	container: {
		flex: 1,
		padding: Theme.spacing.xl,
		backgroundColor: Theme.colors.wash,
	},
	header: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.hero,
		marginBottom: Theme.spacing.xl,
		color: Theme.colors.ink,
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
		backgroundColor: Theme.colors.paper,
		borderRadius: Theme.radius,
		borderWidth: 1,
		borderColor: Theme.colors.line,
	},
	loadingIndicator: {
		marginLeft: Theme.spacing.sm
	},
	pingValue: {
		marginLeft: Theme.spacing.sm,
		fontFamily: Theme.fonts.regular,
		color: Theme.colors.muted
	},
	label: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		color: Theme.colors.ink
	},
	hint: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.note,
		color: Theme.colors.muted,
		marginVertical: Theme.spacing.sm
	},
});

const ListItem = ({ children }: PropsWithChildren) => (
  <View style={styles.listItem}>
    {children}
  </View>
);

/** One switch per kind the app sends; Discord's settings are separate and are not touched here. */
function NotificationSettings(): React.JSX.Element {
	const state = useNotificationPreferences();
	const change = useNotificationPreferenceChange();
	return (
		<View style={styles.combatPreference}>
			<Text style={styles.preferenceLabel}>{i18n.t("app:settings.notifications.label")}</Text>
			<Text style={styles.hint}>{i18n.t("app:settings.notifications.independent")}</Text>
			{DELIVERED_NOTIFICATION_TYPES.map(type => (
				<ListItem key={type}>
					<Text style={styles.label}>{i18n.t(`app:settings.notifications.types.${type}`)}</Text>
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

export default function Index() {
	const router = useRouter();
	const preferences = React.useContext(PreferencesContext);
	const authState = React.useContext(AuthContext);
	const {speed, setSpeed} = useFightSpeed();
	const [themePreference, setThemePreference] = React.useState<ThemePreference>(storedThemePreference);
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
					<SegmentedControl label={i18n.t("app:settings.theme.label")} value={themePreference} onChange={(preference): void => {
						setThemePreference(preference);
						applyThemePreference(preference);
					}} options={[
						{value: THEME_PREFERENCES.SYSTEM, label: i18n.t("app:settings.theme.system")},
						{value: THEME_PREFERENCES.LIGHT, label: i18n.t("app:settings.theme.light")},
						{value: THEME_PREFERENCES.DARK, label: i18n.t("app:settings.theme.dark")}
					]} />
				</View>
				<NotificationSettings />
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
				<ListItem>
					<DesignButton variant="danger" onPress={() => {
						cancelReportNotification();
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
