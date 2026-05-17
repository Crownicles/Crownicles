import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandJardinNoAccessRes, CommandJardinPacketReq, JardinNoAccessReason
} from "../../../../Lib/src/packets/commands/CommandJardinPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { Homes } from "../../core/database/game/models/Home";
import { CityDataController } from "../../data/City";
import {
	ReactionCollectorCity, ReactionCollectorCityData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { buildGardenData } from "../../core/report/ReportGardenService";
import { MapLocationDataController } from "../../data/MapLocation";
import { TravelTime } from "../../core/maps/TravelTime";

/**
 * Garden menu identifier in the Discord-side nested menu registry.
 * Mirrors {@link HomeMenuIds.GARDEN_MENU} (Discord package) — duplicated here as a
 * string literal because Core cannot depend on Discord.
 */
const HOME_GARDEN_MENU_ID = "HOME_GARDEN_MENU";

/**
 * Resolve the access mode for the /jardin command:
 * - "full" if the player is currently in the city where their home sits.
 * - "readOnly" if the player is away from home but owns the Cœur Sylvestre talisman.
 * - null if the player is away from home and does not own the talisman (refused).
 */
function resolveGardenAccess(
	player: Player,
	homeCityId: string
): "full" | "readOnly" | null {
	const currentCity = CityDataController.instance.getCityByMapId(player.getDestinationId()!);
	if (currentCity && currentCity.id === homeCityId) {
		return "full";
	}
	return player.hasRemoteHarvestTalisman ? "readOnly" : null;
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
		const home = await Homes.getOfPlayer(player.id);
		if (!home) {
			response.push(makePacket(CommandJardinNoAccessRes, { reason: JardinNoAccessReason.NO_HOME }));
			return;
		}
		const homeLevel = home.getLevel();
		if (!homeLevel || homeLevel.features.gardenPlots === 0) {
			response.push(makePacket(CommandJardinNoAccessRes, { reason: JardinNoAccessReason.NO_GARDEN }));
			return;
		}
		const accessMode = resolveGardenAccess(player, home.cityId);
		if (!accessMode) {
			response.push(makePacket(CommandJardinNoAccessRes, { reason: JardinNoAccessReason.NO_TALISMAN }));
			return;
		}

		const playerInventory = await InventorySlots.getOfPlayer(player.id);
		const playerActiveObjects = InventorySlots.slotsToActiveObjects(playerInventory);
		const garden = await buildGardenData(home, homeLevel, player, accessMode);

		const destinationId = player.getDestinationId()!;
		const collectorData: ReactionCollectorCityData = {
			gardenOnly: true,
			enterCityTimestamp: TravelTime.getTravelDataSimplified(player, new Date()).travelStartTime,
			mapTypeId: MapLocationDataController.instance.getById(destinationId)!.type,
			mapLocationId: destinationId,
			energy: {
				current: player.getCumulativeEnergy(playerActiveObjects),
				max: player.getMaxCumulativeEnergy(playerActiveObjects)
			},
			health: {
				current: player.getHealth(playerActiveObjects),
				max: player.getMaxHealth(playerActiveObjects)
			},
			home: {
				owned: {
					level: home.level,
					features: homeLevel.features,
					garden
				}
			},
			apartmentNotary: {
				playerMoney: 0,
				ownedApartments: []
			},
			initialMenu: HOME_GARDEN_MENU_ID
		};

		const collector = new ReactionCollectorCity(collectorData);

		const endCallback: EndCallback = (_collector: ReactionCollectorInstance, _response: CrowniclesPacket[]): void => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.JARDIN_COMMAND);
		};

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.JARDIN_COMMAND)
			.build();

		response.push(collectorPacket);
	}
}
