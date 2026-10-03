import {ReactElement, useContext, useRef, useState} from "react";
import {View} from "react-native";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthToken} from "@/src/authentication/AuthToken";
import {AUTH_FAILURES, reasonOfUnknownError} from "@/src/authentication/AuthFailure";
import {IDENTITY_PROVIDERS, KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {AccountCollisionRequestFailure, isAccountCollisionOpen, RestApi} from "@/src/networking/RestApi";
import {Button, Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, ChoiceRow, Refusal, Standing} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {AtSign, Check, MessageCircle} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS, AccountCollision, AccountCollisionCheck, AccountCollisionChoice, AccountCollisionError, AccountCollisionProof} from "ws-packets/src/objects/AccountCollision";

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

function isReverifiable(error: unknown): boolean {
	return error instanceof AccountCollisionRequestFailure && REVERIFIABLE_ERRORS.has(error.reason);
}

/** Whether the collision outlived a refused resolution: a concurrent one may have settled it already */
async function collisionRemains(kept: AuthToken): Promise<boolean> {
	const current = await RestApi.checkAccountCollision(await accessToken(kept));
	return isAccountCollisionOpen(current);
}

/** Signs in to the other account, then proves both belong to the player */
async function verifiedAccounts(token: AuthToken, startedFromEmail: boolean): Promise<VerifiedAccounts> {
	const second = AuthToken.fromKeycloakOAuth2Token(await KeycloakAuth.login(startedFromEmail ? IDENTITY_PROVIDERS.DISCORD : undefined));
	const [discord, email] = startedFromEmail ? [second, token] : [token, second];
	const proof = await RestApi.verifyAccountCollision(await accessToken(discord), await accessToken(email));
	return {discord, email, proof};
}

/** Sends the choice; a stale proof restarts the verification unless the account got settled meanwhile */
async function sendChoice(kept: AuthToken, choice: AccountCollisionChoice, {proof, onStale}: {proof: string; onStale: () => void}): Promise<void> {
	try {
		await RestApi.resolveAccountCollision(await accessToken(kept), proof, choice);
	}
	catch (error) {
		if (!isReverifiable(error)) throw error;
		if (await collisionRemains(kept)) {
			onStale();
			throw error;
		}
	}
}

/** Runs one task at a time and keeps the last failure to show */
function useExclusiveTask(): {pending: boolean; failure: string | null; run: (task: () => Promise<void>) => void} {
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const running = useRef(false);
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
	return {pending, failure, run};
}

function ChoiceSelector({collision, choice, onChange}: {
	collision: AccountCollision;
	choice: AccountCollisionChoice | "";
	onChange: (choice: AccountCollisionChoice | "") => void;
}): ReactElement {
	return <ChoiceRow label={i18n.t("app:auth.collision.choose")}>
		<SegmentedControl label={i18n.t("app:auth.collision.choose")} value={choice} onChange={onChange} options={[
			{value: ACCOUNT_COLLISION_CHOICES.DISCORD, label: i18n.t("app:auth.collision.discord", {name: collision.discord.name})},
			{value: ACCOUNT_COLLISION_CHOICES.EMAIL, label: i18n.t("app:auth.collision.email", {name: collision.emailAccount.name})}
		]} />
	</ChoiceRow>;
}

function VerifyBanner({startedFromEmail, pending, onPress}: {startedFromEmail: boolean; pending: boolean; onPress: () => void}): ReactElement {
	return <ActionBanner icon={startedFromEmail ? MessageCircle : AtSign} label={i18n.t(startedFromEmail ? "app:auth.collision.verifyDiscord" : "app:auth.collision.verifyEmail")} pending={pending} onPress={onPress} />;
}

function ResolveBanner({resumed, chosen, pending, onPress}: {resumed: boolean; chosen: boolean; pending: boolean; onPress: () => void}): ReactElement {
	return <ActionBanner icon={Check} label={i18n.t(resumed ? "app:auth.collision.resume" : "app:auth.collision.confirm")} pending={pending} onPress={onPress} {...!chosen ? {lock: {reason: i18n.t("app:auth.collision.chooseFirst"), icon: Check}} : {}} />;
}

function TaskStatus({failure, pending}: {failure: string | null; pending: boolean}): ReactElement {
	return <>
		{failure ? <Refusal>{failure}</Refusal> : null}
		{pending ? <Note>{i18n.t("app:auth.collision.pending")}</Note> : null}
	</>;
}

function keptAccount(choice: AccountCollisionChoice | "", confirmed: AuthToken | null, verified: VerifiedAccounts | null): AuthToken | undefined {
	return choice ? confirmed ?? verified?.[choice] : undefined;
}

type CollisionChoiceFlow = {
	verified: VerifiedAccounts | null;
	confirmed: AuthToken | null;
	choice: AccountCollisionChoice | "";
	setChoice: (choice: AccountCollisionChoice | "") => void;
	startedFromEmail: boolean;
	pending: boolean;
	failure: string | null;
	verify: () => void;
	resolve: () => void;
};

/** Proves both accounts, then keeps the chosen one; a choice already confirmed resumes without asking again */
function useCollisionChoice(state: AccountCollisionLoginState, onAuthenticated: (token: AuthToken) => Promise<void>): CollisionChoiceFlow {
	const auth = useContext(AuthContext);
	const [verified, setVerified] = useState<VerifiedAccounts | null>(null);
	const [choice, setChoice] = useState<AccountCollisionChoice | "">(state.check.pending ?? "");
	const [confirmed, setConfirmed] = useState<AuthToken | null>(state.check.pending ? state.token : null);
	const {pending, failure, run} = useExclusiveTask();
	const startedFromEmail = state.check.current === ACCOUNT_COLLISION_CHOICES.EMAIL;

	const verify = (): void => run(async (): Promise<void> => {
		setVerified(await verifiedAccounts(state.token, startedFromEmail));
	});

	const restart = (): void => {
		setConfirmed(null);
		setVerified(null);
		setChoice("");
	};

	const resolve = (): void => run(async (): Promise<void> => {
		const kept = keptAccount(choice, confirmed, verified);
		if (!choice || !kept) return;
		await auth.saveToken(kept);
		setConfirmed(kept);
		await sendChoice(kept, choice, {proof: verified?.proof.proof ?? "", onStale: restart});
		await onAuthenticated(kept);
	});

	return {verified, confirmed, choice, setChoice, startedFromEmail, pending, failure, verify, resolve};
}

/** Both accounts are proven first; then the choice, unless it was already confirmed and only resumes */
function CollisionActions({flow, collision}: {flow: CollisionChoiceFlow; collision: AccountCollision | null}): ReactElement {
	if (!flow.verified && !flow.confirmed) return <VerifyBanner startedFromEmail={flow.startedFromEmail} pending={flow.pending} onPress={flow.verify} />;
	const choosable = flow.confirmed ? null : collision;
	return <>
		{choosable ? <ChoiceSelector collision={choosable} choice={flow.choice} onChange={flow.setChoice} /> : null}
		<ResolveBanner resumed={flow.confirmed !== null} chosen={flow.choice !== ""} pending={flow.pending} onPress={flow.resolve} />
	</>;
}

export function AccountCollisionScreen({state, onAuthenticated, onCancel}: {
	state: AccountCollisionLoginState;
	onAuthenticated: (token: AuthToken) => Promise<void>;
	onCancel: () => void;
}): ReactElement {
	const flow = useCollisionChoice(state, onAuthenticated);
	const collision = state.check.collision;
	return <Screen>
		<Standing caption={i18n.t("app:auth.caption")} title={i18n.t(flow.confirmed ? "app:auth.collision.resumeTitle" : "app:auth.collision.title")} {...collision ? {subtitle: collision.email} : {}} />
		<View style={{gap: Theme.spacing.lg}}>
			<Note>{i18n.t("app:auth.collision.warning")}</Note>
			<Note>{i18n.t("app:auth.collision.keptData")}</Note>
			<TaskStatus failure={flow.failure} pending={flow.pending} />
			<CollisionActions flow={flow} collision={collision} />
			{flow.confirmed ? null : <Button disabled={flow.pending} onPress={onCancel}>{i18n.t("app:common.back")}</Button>}
		</View>
	</Screen>;
}
