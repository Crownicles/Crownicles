import { AvailableClass } from "../../../objects/ClassDetails";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		classes: {
			classesDetails: AvailableClass[];
			cooldownSeconds: number;
		};
	}

	interface ReactionCollectorReactionPayloads {
		chooseClass: {
			classId: number;
		};
	}
}

export const CLASSES_DATA_KINDS = { COLLECTOR: "classes" } as const satisfies Record<string, ReactionCollectorDataKind>;
export const CLASSES_REACTION_KINDS = { CHOOSE: "chooseClass" } as const satisfies Record<string, ReactionCollectorReactionKind>;
