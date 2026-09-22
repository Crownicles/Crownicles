import React from "react";
import {useRouter} from "expo-router";
import {ScrollView, StyleSheet, Text, View} from "react-native";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {readFullStoredToken} from "@/src/authentication/TokenStorage";
import {AuthToken} from "@/src/authentication/AuthToken";
import {RestApi} from "@/src/networking/RestApi";
import {Theme} from "@/src/design/Theme";
import {BackButton} from "@/src/design/Sections";
import {Button as DesignButton} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: Theme.spacing.xl,
		backgroundColor: Theme.colors.wash,
	},
	title: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.hero,
		color: Theme.colors.ink,
		marginBottom: Theme.spacing.lg,
	},
	warning: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.body,
		color: Theme.colors.ink,
		marginBottom: Theme.spacing.lg,
	},
	paragraph: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		color: Theme.colors.ink,
		marginBottom: Theme.spacing.lg,
	},
	stepTitle: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.body,
		color: Theme.colors.ink,
		marginTop: Theme.spacing.lg,
		marginBottom: Theme.spacing.sm,
	},
	notice: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		color: Theme.colors.green,
		marginBottom: Theme.spacing.lg,
	},
	error: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		color: Theme.colors.red,
		marginBottom: Theme.spacing.lg,
	},
	action: {
		marginBottom: Theme.spacing.sm,
	},
});

/** Reads the session from the keychain, refreshing it when it is about to expire. */
async function currentAccessToken(): Promise<string | null> {
	const storedToken = await readFullStoredToken();
	if (!storedToken) {
		return null;
	}

	const authToken = AuthToken.fromJsonString(storedToken);
	await authToken.refreshIfNeeded();
	return authToken.getAccessToken();
}

export default function DeleteAccount(): React.ReactElement {
	const router = useRouter();
	const authState = React.useContext(AuthContext);
	const [code, setCode] = React.useState("");
	const [pending, setPending] = React.useState(false);
	const [requested, setRequested] = React.useState(false);
	const [failure, setFailure] = React.useState<"request" | "code" | null>(null);

	const runStep = (step: (accessToken: string) => Promise<void>): void => {
		setPending(true);
		setFailure(null);

		currentAccessToken()
			.then(async (accessToken) => {
				if (!accessToken) {
					// The session is already gone, so there is nothing left to delete with.
					authState.setState(AuthStateEnum.NO_TOKEN);
					return;
				}
				await step(accessToken);
			})
			.catch((error) => {
				console.error("Account deletion step failed:", error);
				setPending(false);
				setFailure("request");
			});
	};

	const requestDeletion = (): void => runStep(async (accessToken) => {
		const accepted = await RestApi.requestAccountDeletion(accessToken);
		setPending(false);
		if (accepted) {
			setRequested(true);
		}
		else {
			setFailure("request");
		}
	});

	const confirmDeletion = (): void => runStep(async (accessToken) => {
		if (!await RestApi.deleteAccount(accessToken, code)) {
			setPending(false);
			setFailure("code");
			return;
		}

		await authState.clearToken();
		authState.setState(AuthStateEnum.NO_TOKEN);
	});

	return (
		<View style={styles.container}>
			<ScrollView>
				<BackButton label={i18n.t("app:common.back")} onClose={router.back} />
				<Text style={styles.title}>{i18n.t("app:settings.deleteAccount.title")}</Text>
				<Text style={styles.warning}>{i18n.t("app:settings.deleteAccount.warning")}</Text>
				<Text style={styles.paragraph}>{i18n.t("app:settings.deleteAccount.removed")}</Text>
				<Text style={styles.paragraph}>{i18n.t("app:settings.deleteAccount.kept")}</Text>

				<Text style={styles.stepTitle}>{i18n.t("app:settings.deleteAccount.requestStep")}</Text>
				<Text style={styles.paragraph}>{i18n.t("app:settings.deleteAccount.requestExplanation")}</Text>
				{requested && <Text style={styles.notice}>{i18n.t("app:settings.deleteAccount.requested")}</Text>}
				{failure === "request" && <Text style={styles.error}>{i18n.t("app:settings.deleteAccount.requestError")}</Text>}
				<View style={styles.action}>
					<DesignButton variant="danger" disabled={pending} onPress={requestDeletion}>
						{i18n.t("app:settings.deleteAccount.ask")}
					</DesignButton>
				</View>

				<Text style={styles.stepTitle}>{i18n.t("app:settings.deleteAccount.confirmStep")}</Text>
				<Text style={styles.paragraph}>{i18n.t("app:settings.deleteAccount.confirmExplanation")}</Text>
				<TextField
					label={i18n.t("app:settings.deleteAccount.codeLabel")}
					value={code}
					onChangeText={setCode}
					autoCapitalize="characters"
					editable={!pending}
				/>
				{failure === "code" && <Text style={styles.error}>{i18n.t("app:settings.deleteAccount.codeError")}</Text>}
				<View style={styles.action}>
					<DesignButton variant="danger" disabled={pending || code.trim().length === 0} onPress={confirmDeletion}>
						{i18n.t("app:settings.deleteAccount.confirm")}
					</DesignButton>
				</View>
			</ScrollView>
		</View>
	);
}
