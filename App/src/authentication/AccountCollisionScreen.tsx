import {ReactElement, useContext, useRef, useState} from "react";
import {View} from "react-native";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthToken} from "@/src/authentication/AuthToken";
import {AUTH_FAILURES, reasonOfUnknownError} from "@/src/authentication/AuthFailure";
import {IDENTITY_PROVIDERS, KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {AccountCollisionRequestFailure, RestApi} from "@/src/networking/RestApi";
import {Button, Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, ChoiceRow, Refusal, Standing} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {AtSign, Check, MessageCircle} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS, AccountCollisionCheck, AccountCollisionChoice, AccountCollisionError, AccountCollisionProof} from "ws-packets/src/objects/AccountCollision";

const REVERIFIABLE_ERRORS: ReadonlySet<AccountCollisionError> = new Set([ACCOUNT_COLLISION_ERRORS.PROOF_EXPIRED, ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED]);

export type AccountCollisionLoginState = {token: AuthToken; check: AccountCollisionCheck};
type VerifiedAccounts = {discord: AuthToken; email: AuthToken; proof: AccountCollisionProof};

async function accessToken(token: AuthToken): Promise<string> {
	await token.refreshIfNeeded();
	const access = token.getAccessToken();
	if (!access) throw new Error("Account session expired");
	return access;
}

function failureText(error: unknown): string | null {
	if (reasonOfUnknownError(error) === AUTH_FAILURES.CANCELLED) return null;
	if (error instanceof AccountCollisionRequestFailure) return i18n.t(`app:auth.collision.errors.${error.reason}`);
	return i18n.t("app:auth.collision.errors.unavailable");
}

export function AccountCollisionScreen({state, onAuthenticated, onCancel}: {
	state: AccountCollisionLoginState;
	onAuthenticated: (token: AuthToken) => Promise<void>;
	onCancel: () => void;
}): ReactElement {
	const auth = useContext(AuthContext);
	const [verified, setVerified] = useState<VerifiedAccounts | null>(null);
	const [choice, setChoice] = useState<AccountCollisionChoice | "">(state.check.pending ?? "");
	const [confirmed, setConfirmed] = useState<AuthToken | null>(state.check.pending ? state.token : null);
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const running = useRef(false);
	const collision = state.check.collision;
	const startedFromEmail = state.check.current === ACCOUNT_COLLISION_CHOICES.EMAIL;

	const run = (task: () => Promise<void>): void => {
		if (running.current) return;
		running.current = true;
		setPending(true);
		setFailure(null);
		task().catch((error: unknown): void => setFailure(failureText(error))).finally((): void => {
			running.current = false;
			setPending(false);
		});
	};

	const verify = (): void => run(async (): Promise<void> => {
		const second = AuthToken.fromKeycloakOAuth2Token(await KeycloakAuth.login(startedFromEmail ? IDENTITY_PROVIDERS.DISCORD : undefined));
		const discord = startedFromEmail ? second : state.token;
		const email = startedFromEmail ? state.token : second;
		const proof = await RestApi.verifyAccountCollision(await accessToken(discord), await accessToken(email));
		setVerified({discord, email, proof});
	});

	const resolve = (): void => run(async (): Promise<void> => {
		if (!choice) return;
		const kept = confirmed ?? verified?.[choice];
		if (!kept) return;
		await auth.saveToken(kept);
		setConfirmed(kept);
		try {
			await RestApi.resolveAccountCollision(await accessToken(kept), verified?.proof.proof ?? "", choice);
		}
		catch (error) {
			if (error instanceof AccountCollisionRequestFailure && REVERIFIABLE_ERRORS.has(error.reason)) {
				const current = await RestApi.checkAccountCollision(await accessToken(kept));
				if (!current.collision && !current.pending) {
					await onAuthenticated(kept);
					return;
				}
				setConfirmed(null);
				setVerified(null);
				setChoice("");
			}
			throw error;
		}
		await onAuthenticated(kept);
	});

	return <Screen>
		<Standing caption={i18n.t("app:auth.caption")} title={i18n.t(confirmed ? "app:auth.collision.resumeTitle" : "app:auth.collision.title")} {...collision ? {subtitle: collision.email} : {}} />
		<View style={{gap: Theme.spacing.lg}}>
			<Note>{i18n.t("app:auth.collision.warning")}</Note>
			<Note>{i18n.t("app:auth.collision.keptData")}</Note>
			{failure ? <Refusal>{failure}</Refusal> : null}
			{pending ? <Note>{i18n.t("app:auth.collision.pending")}</Note> : null}
			{!verified && !confirmed ? <ActionBanner icon={startedFromEmail ? MessageCircle : AtSign} label={i18n.t(startedFromEmail ? "app:auth.collision.verifyDiscord" : "app:auth.collision.verifyEmail")} pending={pending} onPress={verify} /> : null}
			{verified && collision && !confirmed ? <ChoiceRow label={i18n.t("app:auth.collision.choose")}>
				<SegmentedControl label={i18n.t("app:auth.collision.choose")} value={choice} onChange={setChoice} options={[
					{value: ACCOUNT_COLLISION_CHOICES.DISCORD, label: i18n.t("app:auth.collision.discord", {name: collision.discord.name})},
					{value: ACCOUNT_COLLISION_CHOICES.EMAIL, label: i18n.t("app:auth.collision.email", {name: collision.emailAccount.name})}
				]} />
			</ChoiceRow> : null}
			{verified || confirmed ? <ActionBanner icon={Check} label={i18n.t(confirmed ? "app:auth.collision.resume" : "app:auth.collision.confirm")} pending={pending} onPress={resolve} {...!choice ? {lock: {reason: i18n.t("app:auth.collision.chooseFirst"), icon: Check}} : {}} /> : null}
			{!confirmed ? <Button disabled={pending} onPress={onCancel}>{i18n.t("app:common.back")}</Button> : null}
		</View>
	</Screen>;
}