import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { ReactionCollectorCreation } from "../../../../../WsPackets/src/fromServer/common/ReactionCollectorCreation";
import {
	UNKNOWN_COLLECTOR_KIND, UnknownCollectorTag
} from "../../../../../WsPackets/src/fromServer/collectors";
import { makeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	CollectorMapping, indexMappings
} from "./CollectorMapping";
import { genericReactionMappings } from "./mappings/GenericReactionMappings";
import { guildDataMappings } from "./mappings/GuildCollectorMappings";
import { playerUtilityDataMappings } from "./mappings/PlayerUtilityCollectorMappings";
import {
	fightDataMappings, fightReactionMappings
} from "./mappings/FightCollectorMappings";
import {
	petManagementDataMappings, petManagementReactionMappings
} from "./mappings/PetManagementCollectorMappings";
import {
	expeditionDataMappings, expeditionReactionMappings
} from "./mappings/PetExpeditionCollectorMappings";
import {
	petFeedDataMappings, petFeedReactionMappings
} from "./mappings/PetFeedCollectorMappings";
import {
	drinkDataMappings, drinkReactionMappings
} from "./mappings/DrinkCollectorMappings";
import {
	bigEventDataMappings, bigEventReactionMappings
} from "./mappings/BigEventCollectorMappings";
import {
	smallEventDataMappings, smallEventReactionMappings
} from "./mappings/SmallEventCollectorMappings";
import {
	itemDataMappings, itemReactionMappings
} from "./mappings/ItemCollectorMappings";
import {
	reportCollectorDataMappings, reportCollectorReactionMappings
} from "./mappings/ReportCollectorMappings";
import {
	cityDataMappings, cityReactionMappings
} from "./mappings/CityCollectorMappings";
import {
	shopDataMappings, shopReactionMappings
} from "./mappings/ShopCollectorMappings";
import {
	equipDataMappings, equipReactionMappings
} from "./mappings/EquipCollectorMappings";
import {
	sellDataMappings, sellReactionMappings
} from "./mappings/SellCollectorMappings";
import {
	dailyBonusDataMappings, dailyBonusReactionMappings
} from "./mappings/DailyBonusCollectorMappings";
import {
	classesDataMappings, classesReactionMappings
} from "./mappings/ClassesCollectorMappings";

const reactionMappings = indexMappings([
	...fightReactionMappings,
	...petManagementReactionMappings,
	...expeditionReactionMappings,
	...petFeedReactionMappings,
	...genericReactionMappings,
	...drinkReactionMappings,
	...bigEventReactionMappings,
	...smallEventReactionMappings,
	...itemReactionMappings,
	...reportCollectorReactionMappings,
	...cityReactionMappings,
	...shopReactionMappings,
	...equipReactionMappings,
	...sellReactionMappings,
	...dailyBonusReactionMappings,
	...classesReactionMappings
]);

const dataMappings = indexMappings([
	...playerUtilityDataMappings,
	...fightDataMappings,
	...guildDataMappings,
	...petManagementDataMappings,
	...expeditionDataMappings,
	...petFeedDataMappings,
	...drinkDataMappings,
	...bigEventDataMappings,
	...smallEventDataMappings,
	...itemDataMappings,
	...reportCollectorDataMappings,
	...cityDataMappings,
	...shopDataMappings,
	...equipDataMappings,
	...sellDataMappings,
	...dailyBonusDataMappings,
	...classesDataMappings
]);

/**
 * Back-end types already reported as unmapped. Most collectors are not exposed to the app yet, so
 * reporting every occurrence would drown the logs during the whole migration.
 */
const reportedUnmappedTypes = new Set<string>();

/**
 * Shape the back end puts on the wire for both collector data and reactions.
 */
type TaggedLibPayload<LibPayload> = {
	type: string;
	data: LibPayload;
};

/**
 * Falls back on the unknown kind, so a collector the app was not taught yet still crosses the wire
 * instead of being dropped.
 * @param serverType
 */
function toUnknownTag(serverType: string): UnknownCollectorTag {
	if (!reportedUnmappedTypes.has(serverType)) {
		reportedUnmappedTypes.add(serverType);
		CrowniclesLogger.warn("No WebSocket mapping for reaction collector type", { serverType });
	}
	return {
		type: UNKNOWN_COLLECTOR_KIND,
		data: { serverType }
	};
}

/**
 * @param index
 * @param tagged
 */
function translate<LibPayload, Translated>(
	index: Map<string, CollectorMapping<LibPayload, Translated>>,
	tagged: TaggedLibPayload<LibPayload>
): Translated | null {
	return index.get(tagged.type)?.translate(tagged.data) ?? null;
}

/**
 * Converts a collector opened by the back end into its protocol form.
 * @param packet
 */
export function mapCollectorCreation(packet: ReactionCollectorCreationPacket): ReactionCollectorCreation {
	return makeFromServerPacket(ReactionCollectorCreation, {
		id: packet.id,
		endTime: packet.endTime,

		// Spread rather than assign: passing undefined would overwrite the default of the packet class
		...packet.mainPacket === undefined ? {} : { mainPacket: packet.mainPacket },
		data: translate(dataMappings, packet.data) ?? toUnknownTag(packet.data.type),
		reactions: packet.reactions.map(reaction => translate(reactionMappings, reaction) ?? toUnknownTag(reaction.type))
	});
}
