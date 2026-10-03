import {
	ExpeditionLocation, ExpeditionOption, ExpeditionProgress, PetBasicInfo
} from "../../../objects/PetExpedition";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		expeditionChoice: {
			pet: PetBasicInfo; expeditions: ExpeditionOption[]; hasGuild: boolean; guildFoodAmount?: number;
		};
		expeditionProgress: ExpeditionProgress;
		expeditionFinished: ExpeditionLocation & {
			pet: PetBasicInfo; riskCategory: string; foodConsumed?: number;
		};
	}
	interface ReactionCollectorReactionPayloads {
		expeditionSelect: { expeditionId: string };
		expeditionCancel: Record<string, never>;
		expeditionRecall: Record<string, never>;
		expeditionClose: Record<string, never>;
		expeditionClaim: Record<string, never>;
	}
}

export const EXPEDITION_DATA_KINDS = {
	CHOICE: "expeditionChoice", PROGRESS: "expeditionProgress", FINISHED: "expeditionFinished"
} as const satisfies Record<string, ReactionCollectorDataKind>;
export const EXPEDITION_REACTION_KINDS = {
	SELECT: "expeditionSelect", CANCEL: "expeditionCancel", RECALL: "expeditionRecall", CLOSE: "expeditionClose", CLAIM: "expeditionClaim"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
