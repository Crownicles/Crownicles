import { randomUUID } from "crypto";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakConfig } from "../../../Lib/src/keycloak/KeycloakConfig";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { KeycloakFederalIdentity } from "../../../Lib/src/keycloak/KeycloakFederalIdentity";
import { KeycloakSessionIdentity } from "../../../Lib/src/keycloak/KeycloakSessionIdentity";
import { AsyncLock } from "../../../Lib/src/locks/AsyncLock";
import {
	ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS, AccountCollision, AccountCollisionCheck, AccountCollisionChoice, AccountCollisionError, AccountCollisionProof, AccountCollisionResolution
} from "../../../WsPackets/src/objects/AccountCollision";
import { KeycloakConstants } from "../../../Lib/src/constants/KeycloakConstants";

const PROOF_TTL_MS = 15 * 60 * 1000;
const RESOLUTION_VERSION = 1;
const NOT_FOUND = 404;

type AccessToken = string;
type KeycloakId = string;
type CollisionProofId = string;
type EmailAddress = string;

/** The address and the Discord account it was verified on. */
type DiscordContact = {
	email: EmailAddress;
	discordId: string;
};
type CollisionPair = DiscordContact & {
	discord: KeycloakUser;
	emailAccount: KeycloakUser;
};
type VerifiedPair = {
	pair: CollisionPair;
	expiresAt: number;
};

type PairLock = {
	lock: AsyncLock; pending: number;
};

/** The two accounts a resolution touches: the one kept and the one deleted. */
type ResolvedAccounts = {
	keptId: KeycloakId;
	deletedId: KeycloakId;
};
type ResolutionIntent = ResolvedAccounts & DiscordContact & {
	version: number;
	choice: AccountCollisionChoice;
};
type KeycloakCallStatus = {
	isError: boolean; status: number;
};
export class AccountCollisionFailure extends Error {
	public constructor(public readonly reason: AccountCollisionError, public readonly status: number = 409) {
		super(reason);
	}
}
function normalizedEmail(email: EmailAddress): EmailAddress {
	return email.trim().toLowerCase();
}
function accountName(user: KeycloakUser): string {
	return user.attributes?.gameUsername?.[0] ?? user.username;
}
function viewOf(pair: CollisionPair): AccountCollision {
	return {
		email: pair.email, discord: { name: accountName(pair.discord) }, emailAccount: { name: accountName(pair.emailAccount) }
	};
}
function lockKey(accounts: ResolvedAccounts): string {
	return [accounts.keptId, accounts.deletedId].sort().join("/");
}
function hasVerifiedDiscordEmail(user: KeycloakUser): boolean {
	return user.attributes?.discordEmailVerified?.[0] === "true";
}
function failedBeyondMissing(result: KeycloakCallStatus): boolean {
	return result.isError && result.status !== NOT_FOUND;
}

/** A stored intent must be this account's, well formed and for a known choice, or the resolution is refused. */
function isIntentOf(intent: ResolutionIntent | null, userId: KeycloakId): intent is ResolutionIntent {
	if (intent === null || typeof intent !== "object") {
		return false;
	}
	const owned = intent.version === RESOLUTION_VERSION && intent.keptId === userId && intent.deletedId !== userId;
	const wellFormed = [
		intent.deletedId,
		intent.discordId,
		intent.email
	].every(value => typeof value === "string");
	return owned && wellFormed && Object.values(ACCOUNT_COLLISION_CHOICES).includes(intent.choice);
}
function parseIntent(raw: string): ResolutionIntent | null {
	try {
		return JSON.parse(raw) as ResolutionIntent;
	}
	catch {
		return null;
	}
}
function readIntent(user: KeycloakUser): ResolutionIntent | null {
	const raw = user.attributes?.accountCollisionResolution?.[0];
	if (!raw) {
		return null;
	}
	const intent = parseIntent(raw);
	if (!isIntentOf(intent, user.id)) {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
	}
	return intent;
}

/** Discord's address on its account, usable only once Discord has verified it. */
function discordContact(discord: KeycloakUser): DiscordContact | null {
	const email = discord.attributes?.discordEmail?.[0];
	const discordId = discord.attributes?.discordId?.[0];
	if (!email || !discordId) {
		return null;
	}
	if (!hasVerifiedDiscordEmail(discord)) {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNVERIFIED_EMAIL);
	}
	return {
		email: normalizedEmail(email), discordId
	};
}

/** At most one other account may hold the address: more is a conflict only a person can settle. */
function soleAccount(users: KeycloakUser[]): KeycloakUser | null {
	if (users.length > 1) {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
	}
	return users[0] ?? null;
}
function stillOwnsEmail(account: KeycloakUser, pair: CollisionPair): boolean {
	return account.id === pair.emailAccount.id && normalizedEmail(account.email ?? "") === pair.email;
}

/** Since the proof was given, neither account moved away from the collision it proves. */
function pairUnchanged(pair: CollisionPair, discord: KeycloakUser, emailAccount: KeycloakUser): boolean {
	const discordUnchanged = normalizedEmail(discord.attributes.discordEmail?.[0] ?? "") === pair.email && discord.attributes.discordId?.[0] === pair.discordId;
	return discordUnchanged && stillOwnsEmail(emailAccount, pair) && Boolean(emailAccount.emailVerified);
}
function isInPair(user: KeycloakUser, pair: CollisionPair): boolean {
	return user.id === pair.discord.id || user.id === pair.emailAccount.id;
}
function linksAnotherDiscord(identity: KeycloakFederalIdentity, discordId: string): boolean {
	return identity.identityProvider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD && identity.userId !== discordId;
}
function resolvedAccounts(pair: CollisionPair, choice: AccountCollisionChoice): ResolvedAccounts {
	return choice === ACCOUNT_COLLISION_CHOICES.DISCORD
		? {
			keptId: pair.discord.id, deletedId: pair.emailAccount.id
		}
		: {
			keptId: pair.emailAccount.id, deletedId: pair.discord.id
		};
}

/** The kept account once resolved: it holds the Discord identity and the verified address. */
function resolvedUser(kept: KeycloakUser, intent: ResolutionIntent): KeycloakUser {
	const attributes = {
		...kept.attributes,
		discordId: [intent.discordId] as [
			string
		],
		discordEmail: [intent.email] as [
			string
		],
		discordEmailVerified: ["true"] as [
			string
		]
	};
	delete attributes.accountCollisionResolution;
	return {
		...kept, email: intent.email, emailVerified: true, attributes
	};
}
export class AccountCollisionService {
	private readonly proofs = new Map<string, VerifiedPair>();

	private readonly locks = new Map<string, PairLock>();

	public constructor(private readonly config: KeycloakConfig, private readonly onIdentityDeleted: (id: KeycloakId) => void = (): void => undefined) {
	}

	private async sessionIdentity(token: AccessToken): Promise<KeycloakSessionIdentity> {
		const session = await KeycloakUtils.getSessionIdentity(this.config, token);
		if (session.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		return session.payload.identity;
	}

	private async authenticatedUser(token: AccessToken): Promise<KeycloakUser> {
		const identity = await this.sessionIdentity(token);
		return this.userById(identity.sub);
	}

	private async userById(id: KeycloakId): Promise<KeycloakUser> {
		const result = await KeycloakUtils.getUserByKeycloakId(this.config, id);
		if (result.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		return result.payload.user;
	}

	private async otherAccountWithEmail(email: EmailAddress, discordUserId: KeycloakId): Promise<KeycloakUser | null> {
		const result = await KeycloakUtils.getUsersByEmail(this.config, email);
		if (result.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		return soleAccount(result.payload.users.filter(user => user.id !== discordUserId));
	}

	private async findPair(token: AccessToken): Promise<CollisionPair | null> {
		const identity = await this.sessionIdentity(token);
		if (identity.identity_provider !== KeycloakConstants.IDENTITY_PROVIDERS.DISCORD) {
			return null;
		}
		const discord = await this.userById(identity.sub);
		const contact = discordContact(discord);
		if (!contact) {
			return null;
		}
		const emailAccount = await this.otherAccountWithEmail(contact.email, discord.id);
		return emailAccount
			? {
				discord, emailAccount, ...contact
			}
			: null;
	}

	public async check(token: AccessToken): Promise<AccountCollisionCheck> {
		const user = await this.authenticatedUser(token);
		const intent = readIntent(user);
		if (intent) {
			return {
				collision: null, pending: intent.choice
			};
		}
		const pair = await this.findPair(token);
		if (pair) {
			return {
				collision: viewOf(pair), current: ACCOUNT_COLLISION_CHOICES.DISCORD
			};
		}
		return this.checkEmailAccount(user);
	}

	/** The one Discord account that verified this address, with its Discord identifier, if there is one. */
	private async discordAccountWithEmail(email: EmailAddress, userId: KeycloakId): Promise<{
		account: KeycloakUser; discordId: string;
	} | null> {
		const candidates = await KeycloakUtils.getUsersByDiscordEmail(this.config, email);
		if (candidates.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		const account = soleAccount(candidates.payload.users.filter(candidate => candidate.id !== userId && hasVerifiedDiscordEmail(candidate)));
		const discordId = account?.attributes.discordId?.[0];
		if (account && !discordId) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
		return account && discordId
			? {
				account, discordId
			}
			: null;
	}

	private async checkEmailAccount(user: KeycloakUser): Promise<AccountCollisionCheck> {
		if (!user.email || !user.emailVerified) {
			return { collision: null };
		}
		const email = normalizedEmail(user.email);
		const discord = await this.discordAccountWithEmail(email, user.id);
		if (!discord) {
			return { collision: null };
		}
		return {
			collision: viewOf({
				discord: discord.account, emailAccount: user, email, discordId: discord.discordId
			}),
			current: ACCOUNT_COLLISION_CHOICES.EMAIL
		};
	}

	private forgetExpiredProofs(): void {
		for (const [proof, value] of this.proofs) {
			if (value.expiresAt <= Date.now()) {
				this.proofs.delete(proof);
			}
		}
	}

	/** The account signed in with its address and password, never through Discord. */
	private async emailSessionUser(token: AccessToken): Promise<KeycloakUser> {
		const identity = await this.sessionIdentity(token);
		if (identity.identity_provider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		return this.userById(identity.sub);
	}

	public async verify(discordToken: AccessToken, emailToken: AccessToken): Promise<AccountCollisionProof> {
		const pair = await this.findPair(discordToken);
		if (!pair) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		const emailAccount = await this.emailSessionUser(emailToken);
		if (!stillOwnsEmail(emailAccount, pair)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		if (!emailAccount.emailVerified) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNVERIFIED_EMAIL);
		}
		this.forgetExpiredProofs();
		const proof = randomUUID();
		this.proofs.set(proof, {
			pair: {
				...pair, emailAccount
			},
			expiresAt: Date.now() + PROOF_TTL_MS
		});
		return {
			proof, collision: viewOf(pair)
		};
	}

	private async persist(user: KeycloakUser): Promise<void> {
		const result = await KeycloakUtils.updateUser(this.config, user);
		if (result.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
	}

	private async ensureDiscordIdentityFree(pair: CollisionPair): Promise<void> {
		const owners = await KeycloakUtils.getDiscordIdentityOwners(this.config, pair.discordId);
		const strangers = owners.isError ? null : owners.payload.users.filter(owner => !isInPair(owner, pair));
		if (!strangers || strangers.length > 0) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
	}

	private async ensureNoOtherDiscordLink(pair: CollisionPair, kept: KeycloakUser): Promise<void> {
		const identities = await KeycloakUtils.getFederatedIdentities(this.config, kept.id);
		if (identities.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		if (identities.payload.identities.some(identity => linksAnotherDiscord(identity, pair.discordId))) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
	}

	private async preflight(pair: CollisionPair, kept: KeycloakUser): Promise<void> {
		await this.ensureDiscordIdentityFree(pair);
		await this.ensureNoOtherDiscordLink(pair, kept);
	}

	/** Deletes the discarded account, which an interrupted resolution may already have deleted. */
	private async deleteDiscarded(id: KeycloakId): Promise<void> {
		const discarded = await KeycloakUtils.getUserByKeycloakId(this.config, id);
		if (failedBeyondMissing(discarded)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		if (discarded.isError) {
			return;
		}
		const deletion = await KeycloakUtils.deleteUser(this.config, id);
		if (failedBeyondMissing(deletion)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
	}

	private async finish(intent: ResolutionIntent): Promise<AccountCollisionResolution> {
		const kept = await this.userById(intent.keptId);
		await this.deleteDiscarded(intent.deletedId);
		this.onIdentityDeleted(intent.deletedId);
		const identities = await KeycloakUtils.linkDiscordIdentity(this.config, kept, intent.discordId);
		if (identities.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
		await this.persist(resolvedUser(kept, intent));
		return { kept: intent.choice };
	}

	private async underPairLock<T>(accounts: ResolvedAccounts, task: () => Promise<T>): Promise<T> {
		const key = lockKey(accounts);
		let entry = this.locks.get(key);
		if (!entry) {
			entry = {
				lock: new AsyncLock(), pending: 0
			};
			this.locks.set(key, entry);
		}
		entry.pending++;
		const release = await entry.lock.acquire();
		try {
			return await task();
		}
		finally {
			release();
			entry.pending--;
			if (entry.pending === 0) {
				this.locks.delete(key);
			}
		}
	}

	private validProof(proof: CollisionProofId): CollisionPair {
		const verified = this.proofs.get(proof);
		if (!verified || verified.expiresAt <= Date.now()) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.PROOF_EXPIRED);
		}
		return verified.pair;
	}

	/** Writes the intent on the kept account before deleting anything, so an interrupted resolution can be finished. */
	private async recordAndFinish(pair: CollisionPair, intent: ResolutionIntent, proof: CollisionProofId): Promise<AccountCollisionResolution> {
		const discord = await this.userById(pair.discord.id);
		const emailAccount = await this.userById(pair.emailAccount.id);
		if (!pairUnchanged(pair, discord, emailAccount)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		const kept = await this.userById(intent.keptId);
		await this.preflight(pair, kept);
		await this.persist({
			...kept,
			attributes: {
				...kept.attributes, accountCollisionResolution: [JSON.stringify(intent)]
			}
		});
		const result = await this.finish(intent);
		this.proofs.delete(proof);
		return result;
	}

	public async resolve(token: AccessToken, proof: CollisionProofId, choice: AccountCollisionChoice): Promise<AccountCollisionResolution> {
		const user = await this.authenticatedUser(token);
		const pending = readIntent(user);
		if (pending) {
			return this.underPairLock(pending, () => this.finish(pending));
		}
		const pair = this.validProof(proof);
		const accounts = resolvedAccounts(pair, choice);
		if (user.id !== accounts.keptId) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		const intent: ResolutionIntent = {
			version: RESOLUTION_VERSION, keptId: accounts.keptId, deletedId: accounts.deletedId, discordId: pair.discordId, email: pair.email, choice
		};
		return this.underPairLock(accounts, () => this.recordAndFinish(pair, intent, proof));
	}
}
