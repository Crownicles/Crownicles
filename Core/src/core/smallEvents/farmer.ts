import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	Guilds
} from "../database/game/models/Guild";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { giveFoodToGuild } from "../utils/FoodUtils";
import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFarmerPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFarmerPacket";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";

const FARMER_INTERACTIONS = {
	SALAD: "salad",
	ITEM: "item"
};

const SALAD_AMOUNT = {
	MIN: 1,
	MAX: 3
};

/**
 * Check if the player is on a map link that touches a plains location
 * @param mapLinkId
 */
function isOnPlainsMapLink(mapLinkId: number): boolean {
	const link = MapLinkDataController.instance.getById(mapLinkId);
	if (!link) {
		return false;
	}

	const startLocation = MapLocationDataController.instance.getById(link.startMap);
	const endLocation = MapLocationDataController.instance.getById(link.endMap);

	return startLocation?.type === "pl" || endLocation?.type === "pl";
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async (player) => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (!isOnPlainsMapLink(player.mapLinkId)) {
			return false;
		}
		return await PlayerSmallEvents.playerSmallEventCount(player.id, "farmer") === 0;
	},
	executeSmallEvent: async (response: CrowniclesPacket[], player, context: PacketContext): Promise<void> => {
		let guild;
		try {
			guild = await Guilds.getById(player.guildId);
		}
		catch {
			guild = null;
		}

		const packet: SmallEventFarmerPacket = { interactionName: FARMER_INTERACTIONS.SALAD };

		if (!guild || guild.herbivorousFood >= GuildConstants.MAX_HERBIVOROUS_PET_FOOD) {
			// Salad storage is full or no guild — farmer gives a random item instead
			packet.interactionName = FARMER_INTERACTIONS.ITEM;
			await giveItemToPlayer(response, context, player, generateRandomItem({ maxRarity: ItemRarity.RARE }));
		}
		else {
			// Give salad to the guild
			const maxGiveable = GuildConstants.MAX_HERBIVOROUS_PET_FOOD - guild.herbivorousFood;
			packet.amount = Math.min(RandomUtils.randInt(SALAD_AMOUNT.MIN, SALAD_AMOUNT.MAX + 1), maxGiveable);
			await giveFoodToGuild(response, player, "herbivorousFood", packet.amount, NumberChangeReason.SMALL_EVENT);
		}

		response.push(makePacket(SmallEventFarmerPacket, packet));
	}
};
