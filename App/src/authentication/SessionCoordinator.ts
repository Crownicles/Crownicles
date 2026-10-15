import { AuthToken } from "./AuthToken";
import { AuthStateEnum } from "./AuthStateEnum";
import {
	AUTH_FAILURES, AuthFailure
} from "./AuthFailure";
import {
	AppIncompatibilityFailure, isAccountCollisionOpen, RestApi
} from "../networking/RestApi";
import { AccountCollisionCheck } from "ws-packets/src/objects/AccountCollision";
import {
	APP_COMPATIBILITY_STATUSES, AppOutdatedStatus
} from "ws-packets/src/AppCompatibility";
import {
	ACCOUNT_ACTION_OUTCOMES, AccountActionOutcome, AccountTarget, KeycloakAuth
} from "./KeycloakAuth";

export type CollisionSession = {
	token: AuthToken; check: AccountCollisionCheck;
};

export type SessionStorage = {
	read: () => Promise<AuthToken | null>;
	save: (token: AuthToken) => Promise<void>;
	clear: () => Promise<void>;
};

/** The socket a session owns: it reaches the game with the session's access, and reports how it stands. */
export type SessionConnection = {
	open: (access: () => Promise<string | null>, onState: (state: AuthStateEnum) => void) => Promise<void>;
	close: () => void;
};

export type SessionEvents = {
	state: (state: AuthStateEnum) => void;
	collision: (session: CollisionSession | null) => void;
};

/** Where the account session stands; the socket only speaks for it once the session is active. */
export const SESSION_PHASES = {
	SIGNED_OUT: "signedOut",
	OPENING: "opening",
	COLLISION: "collision",
	ACTIVE: "active",
	UNAVAILABLE: "unavailable",

	/** The server and this app no longer speak the same protocol: the session waits for the side behind. */
	APP_OUTDATED: "appOutdated",
	SERVER_OUTDATED: "serverOutdated",
	EXPIRED: "expired",
	LEAVING: "leaving"
} as const;

export type SessionPhase = typeof SESSION_PHASES[keyof typeof SESSION_PHASES];

type EndedPhase = typeof SESSION_PHASES.SIGNED_OUT | typeof SESSION_PHASES.EXPIRED;

/**
 * The only phases a session may come from to reach these ones; any other move is a callback of an older
 * session and is dropped. The phases not listed can follow any other: a session can always restart or end.
 */
const ENTRY_PHASES: Partial<Record<SessionPhase, readonly SessionPhase[]>> = {
	[SESSION_PHASES.COLLISION]: [SESSION_PHASES.OPENING],
	[SESSION_PHASES.UNAVAILABLE]: [SESSION_PHASES.OPENING],
	[SESSION_PHASES.APP_OUTDATED]: [SESSION_PHASES.OPENING],
	[SESSION_PHASES.SERVER_OUTDATED]: [SESSION_PHASES.OPENING],
	[SESSION_PHASES.ACTIVE]: [SESSION_PHASES.OPENING, SESSION_PHASES.LEAVING],
	[SESSION_PHASES.LEAVING]: [SESSION_PHASES.ACTIVE]
};

/** What the player sees of each phase; an active session shows the state of its socket instead. */
const PHASE_STATES: Record<Exclude<SessionPhase, typeof SESSION_PHASES.ACTIVE | typeof SESSION_PHASES.LEAVING>, AuthStateEnum> = {
	[SESSION_PHASES.SIGNED_OUT]: AuthStateEnum.NO_TOKEN,
	[SESSION_PHASES.OPENING]: AuthStateEnum.CONNECTING,
	[SESSION_PHASES.COLLISION]: AuthStateEnum.ACCOUNT_COLLISION,
	[SESSION_PHASES.UNAVAILABLE]: AuthStateEnum.CONNECTION_ERROR,
	[SESSION_PHASES.APP_OUTDATED]: AuthStateEnum.APP_OUTDATED,
	[SESSION_PHASES.SERVER_OUTDATED]: AuthStateEnum.SERVER_OUTDATED,
	[SESSION_PHASES.EXPIRED]: AuthStateEnum.TOKEN_INVALID_OR_EXPIRED
};

const OUTDATED_PHASES: Record<AppOutdatedStatus, SessionPhase> = {
	[APP_COMPATIBILITY_STATUSES.APP_OUTDATED]: SESSION_PHASES.APP_OUTDATED,
	[APP_COMPATIBILITY_STATUSES.SERVER_OUTDATED]: SESSION_PHASES.SERVER_OUTDATED
};

/** Socket closes that decide the fate of the session itself, and the phase each one ends it in. */
const ENDING_SOCKET_STATES: Partial<Record<AuthStateEnum, EndedPhase>> = {
	[AuthStateEnum.TOKEN_INVALID_OR_EXPIRED]: SESSION_PHASES.EXPIRED,
	[AuthStateEnum.NO_TOKEN]: SESSION_PHASES.SIGNED_OUT
};

/** Only Keycloak refusing the session ends it; any other failure may be retried. */
function isRejectedSession(error: unknown): boolean {
	return error instanceof AuthFailure && error.reason === AUTH_FAILURES.INVALID_TOKEN;
}

export class SessionCoordinator {
	private generation = 0;

	private phase: SessionPhase = SESSION_PHASES.SIGNED_OUT;

	private socketState = AuthStateEnum.CONNECTING;

	private token: AuthToken | null = null;

	private savedToken: string | null = null;

	private accessing: Promise<string | null> | null = null;

	public constructor(private readonly storage: SessionStorage, private readonly socket: SessionConnection, private readonly events: SessionEvents) {
	}

	/** Reopens the session this device kept; it never rejects, the outcome is the phase it reaches. */
	public async restore(): Promise<void> {
		const generation = this.begin();
		try {
			const token = await this.storage.read();
			if (generation !== this.generation) {
				return;
			}
			if (!token) {
				this.moveTo(SESSION_PHASES.SIGNED_OUT);
				return;
			}
			await this.admit(token, generation);
		}
		catch (error) {
			await this.settleFailure(error, generation);
		}
	}

	public async enter(token: AuthToken): Promise<void> {
		const generation = this.begin();
		try {
			await this.admit(token, generation);
		}
		catch (error) {
			await this.settleFailure(error, generation);
			throw error;
		}
	}

	/** The account kept in a collision becomes the session this device restores, before the server hears of the choice. */
	public async checkpoint(token: AuthToken): Promise<void> {
		if (this.phase === SESSION_PHASES.ACTIVE || this.phase === SESSION_PHASES.LEAVING) {
			throw new Error("An open session cannot be replaced by a collision choice");
		}
		const generation = this.generation;
		await this.storage.save(token);
		if (generation === this.generation) {
			this.token = token;
			this.savedToken = token.toJsonString();
		}
	}

	/**
	 * Closes the session on this device. An open session keeps running until the device has forgotten it, so a
	 * failure leaves the player where they were; any other phase has nothing left to keep.
	 */
	public async leave(): Promise<void> {
		if (this.phase !== SESSION_PHASES.ACTIVE) {
			await this.end(SESSION_PHASES.SIGNED_OUT);
			return;
		}
		const generation = this.generation;
		this.moveTo(SESSION_PHASES.LEAVING);
		try {
			await this.storage.clear();
		}
		catch (error) {
			if (generation === this.generation) {
				this.moveTo(SESSION_PHASES.ACTIVE);
			}
			throw error;
		}
		if (generation === this.generation) {
			this.dispose();
			this.events.collision(null);
			this.moveTo(SESSION_PHASES.SIGNED_OUT);
		}
	}

	public dispose(): void {
		this.generation++;
		this.token = null;
		this.savedToken = null;
		this.accessing = null;
		this.socket.close();
	}

	/** Every opening starts a new generation: the callbacks of the previous session no longer reach anything. */
	private begin(): number {
		this.dispose();
		this.moveTo(SESSION_PHASES.OPENING);
		return this.generation;
	}

	/** The session is saved before anything uses it, then checked for a collision before the game opens. */
	private async admit(token: AuthToken, generation: number): Promise<void> {
		this.token = token;
		const access = await this.accessToken();
		if (generation !== this.generation) {
			return;
		}
		if (!access) {
			throw new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "The stored session has expired.");
		}
		const check = await RestApi.checkAccountCollision(access);
		if (generation !== this.generation) {
			return;
		}
		if (isAccountCollisionOpen(check)) {
			this.events.collision({
				token, check
			});
			this.moveTo(SESSION_PHASES.COLLISION);
			return;
		}
		this.events.collision(null);
		this.socketState = AuthStateEnum.CONNECTING;
		this.moveTo(SESSION_PHASES.ACTIVE);
		await this.socket.open(() => this.accessToken(), state => {
			if (generation === this.generation) {
				this.socketChanged(state);
			}
		});
	}

	/** Once admitted, a failure belongs to the socket; before that, the session could not open and may be retried. */
	private async settleFailure(error: unknown, generation: number): Promise<void> {
		if (generation !== this.generation) {
			return;
		}
		if (isRejectedSession(error)) {
			await this.end(SESSION_PHASES.EXPIRED);
			return;
		}
		if (this.phase === SESSION_PHASES.ACTIVE) {
			this.socketChanged(AuthStateEnum.CONNECTION_ERROR);
			return;
		}
		this.moveTo(error instanceof AppIncompatibilityFailure ? OUTDATED_PHASES[error.status] : SESSION_PHASES.UNAVAILABLE);
	}

	/** Some closes decide the fate of the session itself: those never go through the socket state. */
	private socketChanged(state: AuthStateEnum): void {
		const ended = ENDING_SOCKET_STATES[state];
		if (ended) {
			this.end(ended).catch((): void => undefined);
			return;
		}
		if (state === AuthStateEnum.ACCOUNT_COLLISION) {
			this.reenterOnCollision();
			return;
		}
		this.socketState = state;
		this.publish();
	}

	/** The server found a collision behind an open session: entering again brings it up. */
	private reenterOnCollision(): void {
		if (this.phase === SESSION_PHASES.ACTIVE && this.token) {
			this.enter(this.token).catch((): void => undefined);
		}
	}

	/** Keycloak refused the session or the server ended it: nothing is left to keep, even if the device cannot erase it. */
	private async end(phase: EndedPhase): Promise<void> {
		this.dispose();
		const generation = this.generation;
		try {
			await this.storage.clear();
		}
		catch (error) {
			console.warn("The ended session could not be erased from this device", error);
		}
		if (generation === this.generation) {
			this.events.collision(null);
			this.moveTo(phase);
		}
	}

	private moveTo(phase: SessionPhase): void {
		const allowed = ENTRY_PHASES[phase];
		if (allowed && !allowed.includes(this.phase)) {
			console.warn(`Ignored a session move from ${this.phase} to ${phase}`);
			return;
		}
		this.phase = phase;
		this.publish();
	}

	private publish(): void {
		if (this.phase === SESSION_PHASES.LEAVING) {
			return;
		}
		this.events.state(this.phase === SESSION_PHASES.ACTIVE ? this.socketState : PHASE_STATES[this.phase]);
	}

	/** A query: only Keycloak refusing the session changes its phase, any other failure is the caller's to handle. */
	public accessToken(): Promise<string | null> {
		if (this.accessing) {
			return this.accessing;
		}
		const generation = this.generation;
		const request = this.currentAccess(generation)
			.catch(async (error: unknown): Promise<never> => {
				if (isRejectedSession(error) && generation === this.generation) {
					await this.end(SESSION_PHASES.EXPIRED);
				}
				throw error;
			})
			.finally((): void => {
				if (this.accessing === request) {
					this.accessing = null;
				}
			});
		this.accessing = request;
		return request;
	}

	private async currentAccess(generation: number): Promise<string | null> {
		const token = this.token;
		if (!token) {
			return null;
		}
		await token.refreshIfNeeded();
		if (generation !== this.generation) {
			return null;
		}
		const access = token.getAccessToken();
		if (!access) {
			throw new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "The stored session has expired.");
		}
		await this.persist(token, generation);
		return generation === this.generation ? access : null;
	}

	/** A rotated token is saved before anyone uses it, unless the device is forgetting the session. */
	private async persist(token: AuthToken, generation: number): Promise<void> {
		const serialized = token.toJsonString();
		if (serialized === this.savedToken || this.phase === SESSION_PHASES.LEAVING) {
			return;
		}
		await this.storage.save(token);
		if (generation === this.generation) {
			this.savedToken = serialized;
		}
	}

	private async accountTarget(): Promise<AccountTarget | null> {
		const generation = this.generation;
		const access = await this.accessToken();
		if (!access) {
			throw new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "The current account is unavailable.");
		}
		const target = await KeycloakAuth.accountIdentity(access);
		return generation === this.generation ? target : null;
	}

	public async changeEmail(): Promise<AccountActionOutcome> {
		const target = await this.accountTarget();
		return target ? KeycloakAuth.changeEmail(target) : ACCOUNT_ACTION_OUTCOMES.CANCELLED;
	}

	public async changePassword(): Promise<AccountActionOutcome> {
		const target = await this.accountTarget();
		return target ? KeycloakAuth.changePassword(target) : ACCOUNT_ACTION_OUTCOMES.CANCELLED;
	}
}
