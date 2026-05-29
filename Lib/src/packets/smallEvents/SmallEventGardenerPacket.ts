import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	GardenerInteractionName, SeedConditionKey
} from "../../constants/PlantConstants";

export const GARDENER_STORY_VARIANT = {
	FIRST: "first",
	RECURRING: "recurring"
} as const;

export type GardenerStoryVariant = typeof GARDENER_STORY_VARIANT[keyof typeof GARDENER_STORY_VARIANT];

export function getGardenerStoryVariant(isFirstEncounter: boolean | undefined): GardenerStoryVariant {
	return isFirstEncounter ? GARDENER_STORY_VARIANT.FIRST : GARDENER_STORY_VARIANT.RECURRING;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGardenerPacket extends SmallEventPacket {
	interactionName!: GardenerInteractionName;

	plantId!: number;

	materialId!: number;

	cost!: number;

	conditionKey!: SeedConditionKey;

	isFirstEncounter?: boolean;
}
