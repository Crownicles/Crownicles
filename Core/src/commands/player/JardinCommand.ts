import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandJardinClosedRes, CommandJardinNoAccessRes, CommandJardinPacketReq, JardinNoAccessReason
} from "../../../../Lib/src/packets/commands/CommandJardinPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	Home, Homes
} from "../../core/database/game/models/Home";
import { CityDataController } from "../../data/City";
import {
	ReactionCollectorCity, ReactionCollectorCityData, ReactionCollectorGardenCompostReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import {
	buildGardenData, handleGardenCompostReaction
} from "../../core/report/ReportGardenService";
import { MapLocationDataController } from "../../data/MapLocation";
import { TravelTime } from "../../core/maps/TravelTime";
import { GardenAccessMode } from "../../../../Lib/src/types/GardenAccessMode";
import { HomeNestedMenuIds } from "../../../../Lib/src/constants/HomeNestedMenuIds";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";

type GardenHomeResolution = {
	home: Home;
	homeLevel: HomeLevel;
} | {
	reason: JardinNoAccessReason;
};

interface GardenCollectorDataParams {
	player: Player;
	home: Home;
	homeLevel: HomeLevel;
	accessMode: GardenAccessMode;
}

/**
 * Resolve the access mode for the /jardin command:
 * - FULL if the player is currently in the city where their home sits.
 * - READ_ONLY if the player is away from home but owns the Cœur Sylvestre talisman.
 * - null if the player is away from home and does not own the talisman (refused).
 */
function resolveGardenAccess(
	player: Player,
	homeCityId: string
): GardenAccessMode | null {
	const currentCity = CityDataController.instance.getCityByMapLinkId(player.mapLinkId);
	if (currentCity && currentCity.id === homeCityId) {
		return GardenAccessMode.FULL;
	}
	return player.hasRemoteHarvestTalisman ? GardenAccessMode.READ_ONLY : null;
}

async function resolveGardenHome(player: Player): Promise<GardenHomeResolution> {
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		return { reason: JardinNoAccessReason.NO_HOME };
	}

	const homeLevel = home.getLevel();
	if (!isGardenAvailable(homeLevel)) {
		return { reason: JardinNoAccessReason.NO_GARDEN };
	}

	return {
		home,
		homeLevel
	};
}

function isGardenAvailable(homeLevel: HomeLevel | null): homeLevel is HomeLevel {
	if (!homeLevel) {
		return false;
	}
	return homeLevel.features.gardenPlots > 0;
}

async function buildGardenCollectorData(params: GardenCollectorDataParams): Promise<ReactionCollectorCityData> {
	const playerInventory = await InventorySlots.getOfPlayer(params.player.id);
	const playerActiveObjects = InventorySlots.slotsToActiveObjects(playerInventory);
	const garden = await buildGardenData(params.home, params.homeLevel, params.player, params.accessMode);
	const destinationId = params.player.getDestinationId()!;

	return {
		gardenOnly: true,
		enterCityTimestamp: TravelTime.getTravelDataSimplified(params.player, new Date()).travelStartTime,
		mapTypeId: MapLocationDataController.instance.getById(destinationId)!.type,
		mapLocationId: destinationId,
		energy: buildEnergyData(params.player, playerActiveObjects),
		health: buildHealthData(params.player, playerActiveObjects),
		home: {
			owned: {
				level: params.home.level,
				features: params.homeLevel.features,
				garden
			}
		},
		apartmentNotary: {
			playerMoney: 0,
			ownedApartments: []
		},
		initialMenu: HomeNestedMenuIds.GARDEN
	};
}

function buildEnergyData(player: Player, playerActiveObjects: PlayerActiveObjects): ReactionCollectorCityData["energy"] {
	return {
		current: player.getCumulativeEnergy(playerActiveObjects),
		max: player.getMaxCumulativeEnergy(playerActiveObjects)
	};
}

function buildHealthData(player: Player, playerActiveObjects: PlayerActiveObjects): ReactionCollectorCityData["health"] {
	return {
		current: player.getHealth(playerActiveObjects),
		max: player.getMaxHealth(playerActiveObjects)
	};
}

function createJardinEndCallback(player: Player): EndCallback {
	return async (collector: ReactionCollectorInstance, endResponse: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.JARDIN_COMMAND);
		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			endResponse.push(makePacket(CommandJardinClosedRes, {}));
			return;
		}

		if (firstReaction.reaction.type === ReactionCollectorGardenCompostReaction.name) {
			const reaction = firstReaction.reaction.data as ReactionCollectorGardenCompostReaction;
			await handleGardenCompostReaction(player, reaction.plantId, reaction.quantity, endResponse);
		}
	};
}

function buildJardinCollectorPacket(
	collectorData: ReactionCollectorCityData,
	player: Player,
	context: PacketContext
): CrowniclesPacket {
	return new ReactionCollectorInstance(
		new ReactionCollectorCity(collectorData),
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1
		},
		createJardinEndCallback(player)
	)
		.block(player.keycloakId, BlockingConstants.REASONS.JARDIN_COMMAND)
		.build();
}

export class JardinCommand {
	@commandRequires(CommandJardinPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandJardinPacketReq,
		context: PacketContext
	): Promise<void> {
		const gardenHome = await resolveGardenHome(player);
		if ("reason" in gardenHome) {
			response.push(makePacket(CommandJardinNoAccessRes, { reason: gardenHome.reason }));
			return;
		}

		const accessMode = resolveGardenAccess(player, gardenHome.home.cityId);
		if (!accessMode) {
			response.push(makePacket(CommandJardinNoAccessRes, { reason: JardinNoAccessReason.NO_TALISMAN }));
			return;
		}

		const collectorData = await buildGardenCollectorData({
			player,
			home: gardenHome.home,
			homeLevel: gardenHome.homeLevel,
			accessMode
		});
		response.push(buildJardinCollectorPacket(collectorData, player, context));
	}
}
