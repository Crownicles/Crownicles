import React from "react";
import {useRouter} from "expo-router";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {readFullStoredToken} from "@/src/authentication/TokenStorage";
import {AuthToken} from "@/src/authentication/AuthToken";
import {RestApi} from "@/src/networking/RestApi";
import {forgetPushDevice} from "@/src/notifications/PushRegistration";
import {Page} from "@/src/design/DetailScreen";
import {LockHint, Refusal, Standing} from "@/src/design/Sections";
import {Button as DesignButton, Note, SectionHeader} from "@/src/design/Primitives";
import {Check} from "@/src/design/FightIcons";
import {TextField} from "@/src/design/Inputs";
import {FormBlock} from "@/src/design/KeyboardAvoidance";
import {i18n} from "@/src/translations/i18n";

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

/** Each step ends on its own irreversible button, kept apart from what follows. */
function DangerAction({label, disabled, onPress}: {label: string; disabled: boolean; onPress: () => void}): React.ReactElement {
	return <DesignButton variant="danger" disabled={disabled} onPress={onPress}>{label}</DesignButton>;
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

		forgetPushDevice();
		await authState.clearToken();
		authState.setState(AuthStateEnum.NO_TOKEN);
	});

	return (
		<Page
			onClose={router.back}
			heading={<Standing
				caption={i18n.t("app:settings.sections.account")}
				title={i18n.t("app:settings.deleteAccount.title")}
				subtitle={i18n.t("app:settings.deleteAccount.warning")}
			/>}
		>
			<Note>{i18n.t("app:settings.deleteAccount.removed")}</Note>
			<Note>{i18n.t("app:settings.deleteAccount.kept")}</Note>

			<SectionHeader>{i18n.t("app:settings.deleteAccount.requestStep")}</SectionHeader>
			<Note>{i18n.t("app:settings.deleteAccount.requestExplanation")}</Note>
			{requested && <LockHint lock={{reason: i18n.t("app:settings.deleteAccount.requested"), icon: Check}} />}
			{failure === "request" && <Refusal>{i18n.t("app:settings.deleteAccount.requestError")}</Refusal>}
			<DangerAction label={i18n.t("app:settings.deleteAccount.ask")} disabled={pending} onPress={requestDeletion} />

			<SectionHeader>{i18n.t("app:settings.deleteAccount.confirmStep")}</SectionHeader>
			<Note>{i18n.t("app:settings.deleteAccount.confirmExplanation")}</Note>
			<FormBlock>
				<TextField
					label={i18n.t("app:settings.deleteAccount.codeLabel")}
					value={code}
					onChangeText={setCode}
					autoCapitalize="characters"
					autoCorrect={false}
					editable={!pending}
					refusal={failure === "code" ? i18n.t("app:settings.deleteAccount.codeError") : null}
				/>
				<DangerAction label={i18n.t("app:settings.deleteAccount.confirm")} disabled={pending || code.trim().length === 0} onPress={confirmDeletion} />
			</FormBlock>
		</Page>
	);
}
