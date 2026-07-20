import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGardenClosedRes, CommandGardenNoAccessRes, CommandGardenPacketReq, GardenNoAccessReason
} from "../../../../Lib/src/packets/commands/CommandGardenPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	Home, Homes
} from "../../core/database/game/models/Home";
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
import { PlayerTalismansManager } from "../../core/database/game/models/PlayerTalismans";
import {
	buildGardenData, handleGardenCompostReaction
} from "../../core/report/ReportGardenService";
import { MapLocationDataController } from "../../data/MapLocation";
import { GardenAccessMode } from "../../../../Lib/src/types/GardenAccessMode";
import { HomeNestedMenuIds } from "../../../../Lib/src/constants/HomeNestedMenuIds";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { Maps } from "../../core/maps/Maps";

type GardenHomeResolution = {
	home: Home;
	homeLevel: HomeLevel;
} | {
	reason: GardenNoAccessReason;
};

interface GardenCollectorDataParams {
	player: Player;
	home: Home;
	homeLevel: HomeLevel;
	accessMode: GardenAccessMode;
}

/**
 * Resolve the access mode for the /garden command:
 * - FULL if the player is currently in the city where their home sits.
 * - READ_ONLY if the player is away from home but owns the Cœur Sylvestre talisman.
 * - null if the player is away from home and does not own the talisman (refused).
 */
function resolveGardenAccess(
	player: Player,
	homeCityId: string,
	hasRemoteHarvestTalisman: boolean
): GardenAccessMode | null {
	const isAtHome = !Maps.isTravelling(player) && player.getCurrentCityId() === homeCityId;
	if (isAtHome) {
		return GardenAccessMode.FULL;
	}
	return hasRemoteHarvestTalisman ? GardenAccessMode.READ_ONLY : null;
}

async function resolveGardenHome(player: Player): Promise<GardenHomeResolution> {
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		return { reason: GardenNoAccessReason.NO_HOME };
	}

	const homeLevel = home.getLevel();
	if (!isGardenAvailable(homeLevel)) {
		return { reason: GardenNoAccessReason.NO_GARDEN };
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
		mapTypeId: MapLocationDataController.instance.getById(destinationId)!.type,
		mapLocationId: destinationId,
		energy: buildEnergyData(params.player, playerActiveObjects),
		health: buildHealthData(params.player),
		home: {
			owned: {
				level: params.home.level,
				features: params.homeLevel.features,
				garden
			}
		},
		apartmentNotary: {
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

function buildHealthData(player: Player): ReactionCollectorCityData["health"] {
	return {
		current: player.getHealth(),
		max: player.getMaxHealth()
	};
}

function createGardenEndCallback(player: Player): EndCallback {
	return async (collector: ReactionCollectorInstance, endResponse: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GARDEN_COMMAND);
		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			endResponse.push(makePacket(CommandGardenClosedRes, {}));
			return;
		}

		if (firstReaction.reaction.type === ReactionCollectorGardenCompostReaction.name) {
			const reaction = firstReaction.reaction.data as ReactionCollectorGardenCompostReaction;
			await handleGardenCompostReaction(player, reaction.plantId, reaction.quantity, endResponse);
		}
	};
}

function buildGardenCollectorPacket(
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
		createGardenEndCallback(player)
	)
		.block(player.keycloakId, BlockingConstants.REASONS.GARDEN_COMMAND)
		.build();
}

export class GardenCommand {
	@commandRequires(CommandGardenPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandGardenPacketReq,
		context: PacketContext
	): Promise<void> {
		const gardenHome = await resolveGardenHome(player);
		if ("reason" in gardenHome) {
			response.push(makePacket(CommandGardenNoAccessRes, { reason: gardenHome.reason }));
			return;
		}

		const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
		const accessMode = resolveGardenAccess(player, gardenHome.home.cityId, talismans.hasRemoteHarvestTalisman);
		if (!accessMode) {
			response.push(makePacket(CommandGardenNoAccessRes, { reason: GardenNoAccessReason.NO_TALISMAN }));
			return;
		}

		const collectorData = await buildGardenCollectorData({
			player,
			home: gardenHome.home,
			homeLevel: gardenHome.homeLevel,
			accessMode
		});
		response.push(buildGardenCollectorPacket(collectorData, player, context));
	}
}
