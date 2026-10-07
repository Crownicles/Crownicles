import React from "react";
import {useRouter} from "expo-router";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {ACCOUNT_DELETION_FAILURES, AccountDeletionFailure, AccountDeletionRequestFailure, RestApi} from "@/src/networking/RestApi";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {forgetPushDevice} from "@/src/notifications/PushRegistration";
import {Page} from "@/src/design/DetailScreen";
import {LockHint, Refusal, Standing} from "@/src/design/Sections";
import {Button as DesignButton, Note, SectionHeader} from "@/src/design/Primitives";
import {Check} from "@/src/design/FightIcons";
import {TextField} from "@/src/design/Inputs";
import {FormBlock} from "@/src/design/KeyboardAvoidance";
import {i18n} from "@/src/translations/i18n";

const DELETION_STEPS = {REQUEST: "request", CONFIRM: "confirm"} as const;
type DeletionStep = typeof DELETION_STEPS[keyof typeof DELETION_STEPS];
type DeletionFailure = {step: DeletionStep; reason: AccountDeletionFailure};

const FAILURE_KEYS: Record<AccountDeletionFailure, string> = {
	[ACCOUNT_DELETION_FAILURES.UNAUTHORIZED]: "app:settings.deleteAccount.sessionExpired",
	[ACCOUNT_DELETION_FAILURES.INVALID_CODE]: "app:settings.deleteAccount.codeError",
	[ACCOUNT_DELETION_FAILURES.UNAVAILABLE]: "app:settings.deleteAccount.unavailable"
};

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
	const [deleted, setDeleted] = React.useState(false);
	const [cleanupFailed, setCleanupFailed] = React.useState(false);
	const [failure, setFailure] = React.useState<DeletionFailure | null>(null);
	const running = React.useRef(false);
	const mounted = React.useRef(true);
	React.useEffect(() => {
		mounted.current = true;
		return (): void => {mounted.current = false;};
	}, []);

	const finishDeletion = async (): Promise<void> => {
		setCleanupFailed(false);
		forgetPushDevice();
		WebSocketClient.getInstance().disconnect();
		try {
			await authState.clearToken();
			if (mounted.current) authState.setState(AuthStateEnum.NO_TOKEN);
		} catch {
			if (mounted.current) setCleanupFailed(true);
		}
	};

	const runStep = (step: DeletionStep, action: (accessToken: string) => Promise<void>): void => {
		if (running.current || deleted) return;
		running.current = true;
		setPending(true);
		setFailure(null);

		WebSocketClient.getInstance().getCurrentAccessToken()
			.then(async (accessToken) => {
				if (!mounted.current) return;
				if (!accessToken) {
					authState.setState(AuthStateEnum.NO_TOKEN);
					return;
				}
				await action(accessToken);
			})
			.catch((error) => {
				if (mounted.current) setFailure({step, reason: error instanceof AccountDeletionRequestFailure ? error.reason : ACCOUNT_DELETION_FAILURES.UNAVAILABLE});
			})
			.finally((): void => {
				running.current = false;
				if (mounted.current) setPending(false);
			});
	};

	const requestDeletion = (): void => runStep(DELETION_STEPS.REQUEST, async (accessToken) => {
		await RestApi.requestAccountDeletion(accessToken);
		if (mounted.current) setRequested(true);
	});

	const confirmDeletion = (): void => runStep(DELETION_STEPS.CONFIRM, async (accessToken) => {
		await RestApi.deleteAccount(accessToken, code.trim());
		if (!mounted.current) return;
		setDeleted(true);
		await finishDeletion();
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
			{deleted ? <>
				<Note>{i18n.t("app:settings.deleteAccount.deleted")}</Note>
				{cleanupFailed ? <>
					<Refusal>{i18n.t("app:settings.deleteAccount.cleanupError")}</Refusal>
					<DesignButton onPress={(): void => {finishDeletion().catch(console.error);}}>{i18n.t("app:settings.deleteAccount.finishLogout")}</DesignButton>
				</> : null}
			</> : <>
			<Note>{i18n.t("app:settings.deleteAccount.removed")}</Note>
			<Note>{i18n.t("app:settings.deleteAccount.kept")}</Note>

			<SectionHeader>{i18n.t("app:settings.deleteAccount.requestStep")}</SectionHeader>
			<Note>{i18n.t("app:settings.deleteAccount.requestExplanation")}</Note>
			{requested && <LockHint lock={{reason: i18n.t("app:settings.deleteAccount.requested"), icon: Check}} />}
			{failure?.step === DELETION_STEPS.REQUEST && <Refusal>{i18n.t(FAILURE_KEYS[failure.reason])}</Refusal>}
			<DangerAction label={i18n.t("app:settings.deleteAccount.ask")} disabled={pending} onPress={requestDeletion} />

			<SectionHeader>{i18n.t("app:settings.deleteAccount.confirmStep")}</SectionHeader>
			<Note>{i18n.t("app:settings.deleteAccount.confirmExplanation")}</Note>
			<FormBlock>
				<TextField
					label={i18n.t("app:settings.deleteAccount.codeLabel")}
					value={code}
					onChangeText={(value): void => {setCode(value); setFailure(null);}}
					autoCapitalize="characters"
					autoCorrect={false}
					editable={!pending}
					refusal={failure?.step === DELETION_STEPS.CONFIRM ? i18n.t(FAILURE_KEYS[failure.reason]) : null}
				/>
				<DangerAction label={i18n.t("app:settings.deleteAccount.confirm")} disabled={pending || code.trim().length === 0} onPress={confirmDeletion} />
			</FormBlock>
			</>}
		</Page>
	);
}
