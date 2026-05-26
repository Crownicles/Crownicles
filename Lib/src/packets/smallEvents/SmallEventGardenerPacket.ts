import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	GardenerInteractionName, SeedConditionKey
} from "../../constants/PlantConstants";

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
