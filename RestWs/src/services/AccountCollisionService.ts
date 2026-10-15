import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakConfig } from "../../../Lib/src/keycloak/KeycloakConfig";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { KeycloakFederalIdentity } from "../../../Lib/src/keycloak/KeycloakFederalIdentity";
import { KeycloakSessionIdentity } from "../../../Lib/src/keycloak/KeycloakSessionIdentity";
import { AsyncLock } from "../../../Lib/src/locks/AsyncLock";
import {
	ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS, AccountCollision, AccountCollisionCheck, AccountCollisionChoice, AccountCollisionError,
	AccountCollisionResolution, CollisionAccount
} from "../../../WsPackets/src/objects/AccountCollision";
import { KeycloakConstants } from "../../../Lib/src/constants/KeycloakConstants";
import { AccountAdventure } from "../../../Lib/src/types/AccountAdventure";

const RESOLUTION_VERSION = 1;
const NOT_FOUND = 404;

type AccessToken = string;
type KeycloakId = string;
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

/** Reads where the accounts stand in the game: `null` when it could not tell, never a failure. */
export type AccountAdventures = (requesterId: KeycloakId, accountIds: KeycloakId[]) => Promise<AccountAdventure[] | null>;

/** Where the game says the accounts stand; left out of the plain check, which never waits for the game. */
type Progression = {
	adventures: AccountAdventure[] | null;
};

export class AccountCollisionFailure extends Error {
	public constructor(public readonly reason: AccountCollisionError, public readonly status = 409) {
		super(reason);
	}
}
function normalizedEmail(email: EmailAddress): EmailAddress {
	return email.trim().toLowerCase();
}
function accountName(user: KeycloakUser, kind: AccountCollisionChoice): string {
	const gameName = attribute(user, "gameUsername") || user.username;
	return kind === ACCOUNT_COLLISION_CHOICES.DISCORD
		? attribute(user, "discordDisplayName") || attribute(user, "discordUsername") || gameName
		: gameName;
}
function accountView(user: KeycloakUser, kind: AccountCollisionChoice, progression?: Progression): CollisionAccount {
	const adventure = progression?.adventures?.find(candidate => candidate.keycloakId === user.id);
	return {
		name: accountName(user, kind),
		createdAt: user.createdTimestamp,
		...progression ? { progressionAvailable: progression.adventures !== null } : {},
		...adventure
			? { adventure: {
				level: adventure.level, score: adventure.score, classId: adventure.classId
			} }
			: {}
	};
}
function viewOf(pair: CollisionPair, progression?: Progression): AccountCollision {
	return {
		email: pair.email,
		discord: accountView(pair.discord, ACCOUNT_COLLISION_CHOICES.DISCORD, progression),
		emailAccount: {
			...accountView(pair.emailAccount, ACCOUNT_COLLISION_CHOICES.EMAIL, progression), keycloakId: pair.emailAccount.id
		}
	};
}
function lockKey(accounts: ResolvedAccounts): string {
	return [accounts.keptId, accounts.deletedId].sort().join("/");
}
function hasVerifiedDiscordEmail(user: KeycloakUser): boolean {
	return attribute(user, "discordEmailVerified") === "true";
}
function attribute(user: KeycloakUser, name: keyof KeycloakUser["attributes"]): string | undefined {
	return user.attributes?.[name]?.[0];
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
	const raw = attribute(user, "accountCollisionResolution");
	if (!raw) {
		return null;
	}
	const intent = parseIntent(raw);
	if (!isIntentOf(intent, user.id)) {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
	}
	return intent;
}

/** Discord's address on its account, only once Discord has verified it: an unverified one proves nothing. */
function discordContact(discord: KeycloakUser): DiscordContact | null {
	const email = attribute(discord, "discordEmail");
	const discordId = attribute(discord, "discordId");
	if (!email || !discordId) {
		return null;
	}
	if (!hasVerifiedDiscordEmail(discord)) {
		return null;
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
	const discordUnchanged = normalizedEmail(attribute(discord, "discordEmail") ?? "") === pair.email && attribute(discord, "discordId") === pair.discordId;
	return discordUnchanged && stillOwnsEmail(emailAccount, pair) && Boolean(emailAccount.emailVerified);
}
function isInPair(user: KeycloakUser, pair: CollisionPair): boolean {
	return user.id === pair.discord.id || user.id === pair.emailAccount.id;
}

/** The email session proves the pair only as another account, still holding the address, verified. */
function checkEmailProof(emailAccount: KeycloakUser, pair: CollisionPair): void {
	if (emailAccount.id === pair.discord.id) {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
	}
	if (!stillOwnsEmail(emailAccount, pair)) {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
	}
	if (!emailAccount.emailVerified) {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNVERIFIED_EMAIL);
	}
}

/** Only Discord sign-ins leave a verified Discord address on an account: such a session cannot keep the email account. */
function keepsEmailWithDiscordSession(user: KeycloakUser, choice: AccountCollisionChoice): boolean {
	return choice === ACCOUNT_COLLISION_CHOICES.EMAIL && discordContact(user) !== null;
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
	private static readonly locks = new Map<string, PairLock>();

	public constructor(
		private readonly config: KeycloakConfig,
		private readonly onIdentityDeleted: (id: KeycloakId) => void = (): void => undefined,
		private readonly adventures: AccountAdventures = (): Promise<AccountAdventure[]> => Promise.resolve([])
	) {
	}

	/** Both accounts as the player sees them, so they recognise the one they want to keep. */
	private async describe(pair: CollisionPair, requesterId: KeycloakId): Promise<AccountCollision> {
		return viewOf(pair, { adventures: await this.adventures(requesterId, [pair.discord.id, pair.emailAccount.id]) });
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
		return soleAccount(result.payload.users.filter(user => user.id !== discordUserId && user.emailVerified));
	}

	/** Only Discord sign-ins write the Discord address on an account, so holding one makes it the Discord side. */
	private async findPair(discord: KeycloakUser): Promise<CollisionPair | null> {
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

	/** Whether the session must settle a collision first; it never waits for the game. */
	public check(token: AccessToken): Promise<AccountCollisionCheck> {
		return this.inspect(token, pair => Promise.resolve(viewOf(pair)));
	}

	/** The same answer, with where the game says each account stands. */
	public preview(token: AccessToken): Promise<AccountCollisionCheck> {
		return this.inspect(token, (pair, requesterId) => this.describe(pair, requesterId));
	}

	private async inspect(token: AccessToken, view: (pair: CollisionPair, requesterId: KeycloakId) => Promise<AccountCollision>): Promise<AccountCollisionCheck> {
		const user = await this.authenticatedUser(token);
		const intent = readIntent(user);
		if (intent) {
			return {
				collision: null, pending: intent.choice
			};
		}
		const discordPair = await this.findPair(user);
		if (discordPair) {
			return {
				collision: await view(discordPair, user.id), current: ACCOUNT_COLLISION_CHOICES.DISCORD
			};
		}
		const emailPair = await this.emailAccountPair(user);
		return emailPair
			? {
				collision: await view(emailPair, user.id), current: ACCOUNT_COLLISION_CHOICES.EMAIL
			}
			: { collision: null };
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
		if (!account) {
			return null;
		}
		const discordId = attribute(account, "discordId");
		if (!discordId) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
		return {
			account, discordId
		};
	}

	/** The verified address of this account, when the one Discord account that verified it too is another account. */
	private async emailAccountPair(user: KeycloakUser): Promise<CollisionPair | null> {
		if (!user.email || !user.emailVerified) {
			return null;
		}
		const email = normalizedEmail(user.email);
		const discord = await this.discordAccountWithEmail(email, user.id);
		return discord
			? {
				discord: discord.account, emailAccount: user, email, discordId: discord.discordId
			}
			: null;
	}

	/** The account signed in with its address and password, never through Discord. */
	private async emailSessionUser(token: AccessToken): Promise<KeycloakUser> {
		const identity = await this.sessionIdentity(token);
		if (identity.identity_provider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		return this.userById(identity.sub);
	}

	private async verifiedPair(discordToken: AccessToken, emailToken: AccessToken): Promise<CollisionPair> {
		const pair = await this.findPair(await this.authenticatedUser(discordToken));
		if (!pair) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		const emailAccount = await this.emailSessionUser(emailToken);
		checkEmailProof(emailAccount, pair);
		return {
			...pair, emailAccount
		};
	}

	private async persist(keycloakId: KeycloakId, change: (user: KeycloakUser) => KeycloakUser): Promise<void> {
		const result = await KeycloakUtils.patchUser(this.config, keycloakId, change);
		if (failedBeyondMissing(result)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		if (result.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
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
		await this.persist(intent.keptId, current => resolvedUser(current, intent));
		return { kept: intent.choice };
	}

	private async underPairLock<T>(accounts: ResolvedAccounts, task: () => Promise<T>): Promise<T> {
		const key = lockKey(accounts);
		let entry = AccountCollisionService.locks.get(key);
		if (!entry) {
			entry = {
				lock: new AsyncLock(), pending: 0
			};
			AccountCollisionService.locks.set(key, entry);
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
				AccountCollisionService.locks.delete(key);
			}
		}
	}

	/** Records the choice and Discord lookup on the kept account before deletion, so the bot never recreates the discarded identity. */
	private async recordAndFinish(pair: CollisionPair, intent: ResolutionIntent): Promise<AccountCollisionResolution> {
		const discord = await this.userById(pair.discord.id);
		const emailAccount = await this.userById(pair.emailAccount.id);
		if (!pairUnchanged(pair, discord, emailAccount)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		const kept = await this.userById(intent.keptId);
		await this.preflight(pair, kept);
		await this.persist(intent.keptId, current => ({
			...current,
			attributes: {
				...current.attributes,
				discordId: [intent.discordId],
				accountCollisionResolution: [JSON.stringify(intent)]
			}
		}));
		return this.finish(intent);
	}

	/** Records the choice on the kept account, then finishes it; resolutions of the same pair run one at a time. */
	private settle(pair: CollisionPair, choice: AccountCollisionChoice): Promise<AccountCollisionResolution> {
		const accounts = resolvedAccounts(pair, choice);
		const intent: ResolutionIntent = {
			version: RESOLUTION_VERSION, ...accounts, discordId: pair.discordId, email: pair.email, choice
		};
		return this.underPairLock(accounts, () => this.recordAndFinish(pair, intent));
	}

	/** The address answers for both accounts, so a session opened with it may keep its own account alone; Discord never answers for the address. */
	private emailAccountKeepingItself(identity: KeycloakSessionIdentity, user: KeycloakUser, choice: AccountCollisionChoice): Promise<CollisionPair | null> {
		if (choice !== ACCOUNT_COLLISION_CHOICES.EMAIL || identity.identity_provider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD) {
			return Promise.resolve(null);
		}
		return this.emailAccountPair(user);
	}

	public async resolve(token: AccessToken, otherToken: AccessToken, choice: AccountCollisionChoice): Promise<AccountCollisionResolution> {
		const identity = await this.sessionIdentity(token);
		const user = await this.userById(identity.sub);
		const pending = readIntent(user);
		if (pending) {
			return this.underPairLock(pending, () => this.finish(pending));
		}
		return otherToken
			? this.resolveWithBothSessions(token, otherToken, user, choice)
			: this.resolveWithOwnSession(token, identity, user, choice);
	}

	/** Without a second sign-in, only the email account may keep itself; otherwise there must be nothing left to settle. */
	private async resolveWithOwnSession(token: AccessToken, identity: KeycloakSessionIdentity, user: KeycloakUser, choice: AccountCollisionChoice): Promise<AccountCollisionResolution> {
		const ownPair = await this.emailAccountKeepingItself(identity, user, choice);
		if (ownPair) {
			return this.settle(ownPair, choice);
		}
		if (!(await this.check(token)).collision) {
			return { kept: choice };
		}
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
	}

	/** Both accounts signed in prove the pair; the requester must be the one kept. */
	private async resolveWithBothSessions(token: AccessToken, otherToken: AccessToken, user: KeycloakUser, choice: AccountCollisionChoice): Promise<AccountCollisionResolution> {
		if (keepsEmailWithDiscordSession(user, choice)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		const pair = choice === ACCOUNT_COLLISION_CHOICES.DISCORD
			? await this.verifiedPair(token, otherToken)
			: await this.verifiedPair(otherToken, token);
		if (user.id !== resolvedAccounts(pair, choice).keptId) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		return this.settle(pair, choice);
	}
}
