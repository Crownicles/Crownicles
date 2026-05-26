import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	GardenerInteractionName, SeedConditionKey
} from "../../constants/PlantConstants";

/**
 * Story variants for the gardener event. `first` is used the very first
 * time a player meets Théobald (introduction-style narration), `recurring`
 * is used for every encounter after (recognition-style narration) (#4273).
 */
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

	/**
	 * Whether this is the player's first ever encounter with Théobald
	 * across all their characters' history. Drives the story narration:
	 * first meeting introduces Théobald, recurring meetings recognise him.
	 * Only read when the packet is the initial story render (i.e. not the
	 * post-button response from a reaction collector callback) — left as
	 * `false` everywhere else (#4273).
	 */
	isFirstEncounter?: boolean;
}
