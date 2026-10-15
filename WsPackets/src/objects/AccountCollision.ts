export const ACCOUNT_COLLISION_CHOICES = {
	DISCORD: "discord",
	EMAIL: "email"
} as const;

export const ACCOUNT_COLLISION_ENDPOINTS = {
	CHECK: "/account/collision",
	PREVIEW: "/account/collision/preview",
	RESOLVE: "/account/collision/resolve"
} as const;

export type AccountCollisionChoice = typeof ACCOUNT_COLLISION_CHOICES[keyof typeof ACCOUNT_COLLISION_CHOICES];

export const ACCOUNT_COLLISION_ERRORS = {
	UNAUTHORIZED: "unauthorized",
	UNVERIFIED_EMAIL: "unverifiedEmail",
	ACCOUNT_CHANGED: "accountChanged",
	CONFLICT: "conflict",
	UNAVAILABLE: "unavailable"
} as const;

export type AccountCollisionError = typeof ACCOUNT_COLLISION_ERRORS[keyof typeof ACCOUNT_COLLISION_ERRORS];

export type CollisionAccountAdventure = {
	level: number; score: number; classId: number;
};

export type CollisionAccount = {
	name: string;

	/** Milliseconds since the epoch. */
	createdAt: number;

	/** Absent when the account never started an adventure, or when its progression could not be read. */
	adventure?: CollisionAccountAdventure;

	/** Whether the game told where the account stands; absent until its progression was asked for. */
	progressionAvailable?: boolean;
};

/** Keeping both accounts gives this one another address: that change targets it by its identifier. */
export type CollisionEmailAccount = CollisionAccount & { keycloakId: string };

export type AccountCollision = {
	email: string;
	discord: CollisionAccount;
	emailAccount: CollisionEmailAccount;
};

export type AccountCollisionCheck = {
	collision: AccountCollision | null; pending?: AccountCollisionChoice; current?: AccountCollisionChoice;
};
export type AccountCollisionResolution = { kept: AccountCollisionChoice };
