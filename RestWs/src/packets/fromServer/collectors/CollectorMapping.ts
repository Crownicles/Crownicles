import {
	ReactionCollectorData as LibReactionCollectorData,
	ReactionCollectorReaction as LibReactionCollectorReaction
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorData,
	ReactionCollectorDataKind,
	ReactionCollectorDataOf,
	ReactionCollectorDataPayloads,
	ReactionCollectorReaction,
	ReactionCollectorReactionKind,
	ReactionCollectorReactionOf,
	ReactionCollectorReactionPayloads
} from "../../../../../WsPackets/src/fromServer/collectors";

/**
 * Reference to a back-end collector class.
 *
 * Mappings are declared against the class itself rather than against its name as a string: renaming
 * the class in Lib then breaks this file at compile time, instead of silently emitting a payload
 * that installed clients no longer recognise.
 */
type LibClassRef<Instance> = {
	readonly name: string;
	readonly prototype: Instance;
};

/**
 * One back-end class translated into one protocol kind.
 * `serverType` is the `type` the back end puts on the wire, which is the class name.
 *
 * `translate` returns null when the class matches but its payload does not fit the protocol kind,
 * which happens when a back-end field is typed wider than what it actually carries. The caller then
 * falls back on the unknown kind rather than emitting a payload that lies about its shape.
 */
export type CollectorMapping<LibPayload, Translated> = {
	serverType: string;
	translate: (data: LibPayload) => Translated | null;
};

export type ReactionMapping = CollectorMapping<LibReactionCollectorReaction, ReactionCollectorReaction>;

export type DataMapping = CollectorMapping<LibReactionCollectorData, ReactionCollectorData>;

/**
 * Declares how one back-end reaction class becomes one protocol reaction.
 *
 * The registry holds unrelated back-end classes behind a common base, so the concrete type is only
 * known through the key the mapping is registered under. That link cannot be expressed to the
 * compiler, hence the downcast, confined to this function and its data counterpart.
 * @param libClass Back-end class, referenced statically so a rename is caught by the compiler
 * @param kind Protocol identifier, stable across back-end refactors
 * @param toPayload Converts the back-end payload, or returns null to fall back on the unknown kind
 */
export function defineReactionMapping<Instance extends LibReactionCollectorReaction, Kind extends ReactionCollectorReactionKind>(
	libClass: LibClassRef<Instance>,
	kind: Kind,
	toPayload: (data: Instance) => ReactionCollectorReactionPayloads[Kind] | null
): CollectorMapping<LibReactionCollectorReaction, ReactionCollectorReactionOf<Kind>> {
	return {
		serverType: libClass.name,
		translate: (data: LibReactionCollectorReaction): ReactionCollectorReactionOf<Kind> | null => {
			const payload = toPayload(data as Instance);
			return payload === null
				? null
				: {
					type: kind,
					data: payload
				};
		}
	};
}

/**
 * Declares how one back-end collector data class becomes one protocol collector data.
 * See {@link defineReactionMapping} for the downcast rationale.
 * @param libClass Back-end class, referenced statically so a rename is caught by the compiler
 * @param kind Protocol identifier, stable across back-end refactors
 * @param toPayload Converts the back-end payload, or returns null to fall back on the unknown kind
 */
export function defineDataMapping<Instance extends LibReactionCollectorData, Kind extends ReactionCollectorDataKind>(
	libClass: LibClassRef<Instance>,
	kind: Kind,
	toPayload: (data: Instance) => ReactionCollectorDataPayloads[Kind] | null
): CollectorMapping<LibReactionCollectorData, ReactionCollectorDataOf<Kind>> {
	return {
		serverType: libClass.name,
		translate: (data: LibReactionCollectorData): ReactionCollectorDataOf<Kind> | null => {
			const payload = toPayload(data as Instance);
			return payload === null
				? null
				: {
					type: kind,
					data: payload
				};
		}
	};
}

/**
 * Indexes mappings by the type the back end puts on the wire.
 * Throws on a duplicate: two families claiming the same class would silently shadow each other.
 * @param mappings
 */
export function indexMappings<LibPayload, Translated>(
	mappings: CollectorMapping<LibPayload, Translated>[]
): Map<string, CollectorMapping<LibPayload, Translated>> {
	const index = new Map<string, CollectorMapping<LibPayload, Translated>>();
	for (const mapping of mappings) {
		if (index.has(mapping.serverType)) {
			throw new Error(`Duplicate reaction collector mapping for ${mapping.serverType}`);
		}
		index.set(mapping.serverType, mapping);
	}
	return index;
}
