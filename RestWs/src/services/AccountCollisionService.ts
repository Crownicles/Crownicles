import { randomUUID } from "crypto";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakConfig } from "../../../Lib/src/keycloak/KeycloakConfig";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { AsyncLock } from "../../../Lib/src/locks/AsyncLock";
import {
	ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS, AccountCollision, AccountCollisionCheck, AccountCollisionChoice, AccountCollisionError, AccountCollisionProof, AccountCollisionResolution
} from "../../../WsPackets/src/objects/AccountCollision";
import { KeycloakConstants } from "../../../Lib/src/constants/KeycloakConstants";
const PROOF_TTL_MS = 15 * 60 * 1000;
const RESOLUTION_VERSION = 1;
type CollisionPair = {
	discord: KeycloakUser;
	emailAccount: KeycloakUser;
	email: string;
	discordId: string;
};
type VerifiedPair = {
	pair: CollisionPair;
	expiresAt: number;
};

type PairLock = {
	lock: AsyncLock; pending: number;
};
type ResolutionIntent = {
	version: number;
	keptId: string;
	deletedId: string;
	discordId: string;
	email: string;
	choice: AccountCollisionChoice;
};
export class AccountCollisionFailure extends Error {
	public constructor(public readonly reason: AccountCollisionError, public readonly status: number = 409) {
		super(reason);
	}
}
function normalizedEmail(email: string): string {
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
function lockKey(first: string, second: string): string {
	return [first, second].sort().join("/");
}
function readIntent(user: KeycloakUser): ResolutionIntent | null {
	const raw = user.attributes?.accountCollisionResolution?.[0];
	if (!raw) {
		return null;
	}
	try {
		const intent = JSON.parse(raw) as ResolutionIntent;
		if (intent.version !== RESOLUTION_VERSION || intent.keptId !== user.id || intent.deletedId === user.id
            || typeof intent.deletedId !== "string" || typeof intent.discordId !== "string" || typeof intent.email !== "string"
            || !Object.values(ACCOUNT_COLLISION_CHOICES).includes(intent.choice)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
		return intent;
	}
	catch {
		throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
	}
}
export class AccountCollisionService {
	private readonly proofs = new Map<string, VerifiedPair>();

	private readonly locks = new Map<string, PairLock>();

	public constructor(private readonly config: KeycloakConfig, private readonly onIdentityDeleted: (id: string) => void = (): void => undefined) {
	}

	private async authenticatedUser(token: string): Promise<KeycloakUser> {
		const session = await KeycloakUtils.getSessionIdentity(this.config, token);
		if (session.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		return this.userById(session.payload.identity.sub);
	}

	private async userById(id: string): Promise<KeycloakUser> {
		const result = await KeycloakUtils.getUserByKeycloakId(this.config, id);
		if (result.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		return result.payload.user;
	}

	private async findPair(token: string): Promise<CollisionPair | null> {
		const session = await KeycloakUtils.getSessionIdentity(this.config, token);
		if (session.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		if (session.payload.identity.identity_provider !== KeycloakConstants.IDENTITY_PROVIDERS.DISCORD) {
			return null;
		}
		const discord = await this.userById(session.payload.identity.sub);
		const email = discord.attributes?.discordEmail?.[0];
		const discordId = discord.attributes?.discordId?.[0];
		if (!email || !discordId) {
			return null;
		}
		if (discord.attributes.discordEmailVerified?.[0] !== "true") {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNVERIFIED_EMAIL);
		}
		const result = await KeycloakUtils.getUsersByEmail(this.config, normalizedEmail(email));
		if (result.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		const others = result.payload.users.filter(user => user.id !== discord.id);
		if (others.length === 0) {
			return null;
		}
		if (others.length !== 1) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
		return {
			discord, emailAccount: others[0], email: normalizedEmail(email), discordId
		};
	}

	public async check(token: string): Promise<AccountCollisionCheck> {
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

	private async checkEmailAccount(user: KeycloakUser): Promise<AccountCollisionCheck> {
		if (!user.email || !user.emailVerified) {
			return { collision: null };
		}
		const candidates = await KeycloakUtils.getUsersByDiscordEmail(this.config, normalizedEmail(user.email));
		if (candidates.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		const others = candidates.payload.users.filter(candidate => candidate.id !== user.id && candidate.attributes.discordEmailVerified?.[0] === "true");
		if (others.length === 0) {
			return { collision: null };
		}
		if (others.length !== 1 || !others[0].attributes.discordId?.[0]) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
		return {
			collision: viewOf({
				discord: others[0], emailAccount: user, email: normalizedEmail(user.email), discordId: others[0].attributes.discordId[0]
			}),
			current: ACCOUNT_COLLISION_CHOICES.EMAIL
		};
	}

	public async verify(discordToken: string, emailToken: string): Promise<AccountCollisionProof> {
		const pair = await this.findPair(discordToken);
		if (!pair) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		const emailSession = await KeycloakUtils.getSessionIdentity(this.config, emailToken);
		if (emailSession.isError || emailSession.payload.identity.identity_provider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		const emailAccount = await this.userById(emailSession.payload.identity.sub);
		if (emailAccount.id !== pair.emailAccount.id || !emailAccount.email || normalizedEmail(emailAccount.email) !== pair.email) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
		}
		if (!emailAccount.emailVerified) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNVERIFIED_EMAIL);
		}
		for (const [proof, value] of this.proofs) {
			if (value.expiresAt <= Date.now()) {
				this.proofs.delete(proof);
			}
		}
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

	private async preflight(pair: CollisionPair, kept: KeycloakUser): Promise<void> {
		const owners = await KeycloakUtils.getDiscordIdentityOwners(this.config, pair.discordId);
		if (owners.isError || owners.payload.users.some(owner => owner.id !== pair.discord.id && owner.id !== pair.emailAccount.id)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
		const identities = await KeycloakUtils.getFederatedIdentities(this.config, kept.id);
		if (identities.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		if (identities.payload.identities.some(identity => identity.identityProvider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD && identity.userId !== pair.discordId)) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
	}

	private async finish(intent: ResolutionIntent): Promise<AccountCollisionResolution> {
		const kept = await this.userById(intent.keptId);
		const discarded = await KeycloakUtils.getUserByKeycloakId(this.config, intent.deletedId);
		if (discarded.isError && discarded.status !== 404) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
		}
		if (!discarded.isError) {
			const deletion = await KeycloakUtils.deleteUser(this.config, intent.deletedId);
			if (deletion.isError && deletion.status !== 404) {
				throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE, 503);
			}
		}
		this.onIdentityDeleted(intent.deletedId);
		const identities = await KeycloakUtils.linkDiscordIdentity(this.config, kept, intent.discordId);
		if (identities.isError) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.CONFLICT);
		}
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
		await this.persist({
			...kept, email: intent.email, emailVerified: true, attributes
		});
		return { kept: intent.choice };
	}

	private async underPairLock<T>(first: string, second: string, task: () => Promise<T>): Promise<T> {
		const key = lockKey(first, second);
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

	public async resolve(token: string, proof: string, choice: AccountCollisionChoice): Promise<AccountCollisionResolution> {
		const user = await this.authenticatedUser(token);
		const pending = readIntent(user);
		if (pending) {
			return this.underPairLock(pending.keptId, pending.deletedId, () => this.finish(pending));
		}
		const verified = this.proofs.get(proof);
		if (!verified || verified.expiresAt <= Date.now()) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.PROOF_EXPIRED);
		}
		const { pair } = verified;
		const keptId = choice === ACCOUNT_COLLISION_CHOICES.DISCORD ? pair.discord.id : pair.emailAccount.id;
		const deletedId = choice === ACCOUNT_COLLISION_CHOICES.DISCORD ? pair.emailAccount.id : pair.discord.id;
		if (user.id !== keptId) {
			throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED, 401);
		}
		return this.underPairLock(keptId, deletedId, async () => {
			const discord = await this.userById(pair.discord.id);
			const emailAccount = await this.userById(pair.emailAccount.id);
			if (normalizedEmail(discord.attributes.discordEmail?.[0] ?? "") !== pair.email
                || discord.attributes.discordId?.[0] !== pair.discordId
                || normalizedEmail(emailAccount.email ?? "") !== pair.email || !emailAccount.emailVerified) {
				throw new AccountCollisionFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED);
			}
			const kept = await this.userById(keptId);
			await this.preflight(pair, kept);
			const intent: ResolutionIntent = {
				version: RESOLUTION_VERSION, keptId, deletedId, discordId: pair.discordId, email: pair.email, choice
			};
			await this.persist({
				...kept,
				attributes: {
					...kept.attributes, accountCollisionResolution: [JSON.stringify(intent)]
				}
			});
			const result = await this.finish(intent);
			this.proofs.delete(proof);
			return result;
		});
	}
}
