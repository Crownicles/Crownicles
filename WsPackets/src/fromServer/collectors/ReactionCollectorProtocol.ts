/**
 * Wire contract for reaction collectors.
 *
 * A collector describes what the server proposes (`data`) and the choices it offers (`reactions`).
 * Both are open discriminated unions: a family of collectors declares its own payloads from its own
 * file under `families/`, by augmenting the two interfaces below. This file never changes when a
 * family is added.
 *
 * Kinds are protocol identifiers, deliberately decoupled from back-end class names: a published
 * mobile app keeps working when the back end renames a class, and a rename is caught at compile
 * time by the mapping table in RestWs instead of silently breaking installed clients.
 *
 * Consumers must import from `./index`, not from this file, so that every family augmentation is
 * part of their compilation unit.
 */

/**
 * Payload of a collector or a reaction the client does not know yet.
 * Lets a client released before a new collector existed keep parsing the packet instead of failing.
 */
export type UnknownCollectorPayload = {

	/**
	 * Back-end identifier of the unmapped type, for diagnostics only. Never branch on it.
	 */
	serverType: string;
};

/**
 * Kind used when neither side could map the payload.
 */
export const UNKNOWN_COLLECTOR_KIND = "unknown";

/**
 * Payload carried by each kind of collector, keyed by protocol identifier.
 * Augment from a family file, never edit here.
 */
export interface ReactionCollectorDataPayloads {
	unknown: UnknownCollectorPayload;
}

/**
 * Payload carried by each kind of reaction, keyed by protocol identifier.
 * Augment from a family file, never edit here.
 */
export interface ReactionCollectorReactionPayloads {
	unknown: UnknownCollectorPayload;
}

export type ReactionCollectorDataKind = keyof ReactionCollectorDataPayloads;

export type ReactionCollectorReactionKind = keyof ReactionCollectorReactionPayloads;

/**
 * Shape kept identical to what the back end emits, so the payload crosses RestWs untransformed
 * apart from its kind.
 */
type Tagged<Kind extends string, Payload> = {
	type: Kind;
	data: Payload;
};

/**
 * Collector data restricted to a subset of kinds.
 *
 * Distributing over the kind rather than naming the whole union lets a generic producer state which
 * kinds it can emit, and lets the compiler check the payload against the kind it is paired with.
 */
export type ReactionCollectorDataOf<Kind extends ReactionCollectorDataKind> = {
	[Key in Kind]: Tagged<Key, ReactionCollectorDataPayloads[Key]>;
}[Kind];

/**
 * Reaction restricted to a subset of kinds. See {@link ReactionCollectorDataOf}.
 */
export type ReactionCollectorReactionOf<Kind extends ReactionCollectorReactionKind> = {
	[Key in Kind]: Tagged<Key, ReactionCollectorReactionPayloads[Key]>;
}[Kind];

export type ReactionCollectorData = ReactionCollectorDataOf<ReactionCollectorDataKind>;

export type ReactionCollectorReaction = ReactionCollectorReactionOf<ReactionCollectorReactionKind>;

/**
 * The fallback both sides agree on. Belongs to the reaction and the data unions alike, since both
 * declare the unknown kind.
 */
export type UnknownCollectorTag = Tagged<typeof UNKNOWN_COLLECTOR_KIND, UnknownCollectorPayload>;
