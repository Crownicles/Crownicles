import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import {
	BuildingInfo,
	CommandGuildDomainPacketReq,
	CommandGuildDomainPacketRes,
	CommandGuildDomainUpgradeGuildLevelTooLowPacket,
	CommandGuildDomainUpgradeMaxLevelPacket,
	CommandGuildDomainUpgradeNotEnoughTreasuryPacket,
	CommandGuildDomainUpgradePacketReq,
	CommandGuildDomainUpgradeSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandGuildDomainPacket";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";

const BUILDING_LEVEL_FIELDS: Record<GuildBuilding, keyof Guild> = {
	[GuildBuilding.SHOP]: "shopLevel",
	[GuildBuilding.SHELTER]: "shelterLevel",
	[GuildBuilding.PANTRY]: "pantryLevel",
	[GuildBuilding.TRAINING_GROUND]: "trainingGroundLevel"
};

function getBuildingLevel(guild: Guild, building: GuildBuilding): number {
	return guild[BUILDING_LEVEL_FIELDS[building]] as number;
}

function buildBuildingInfos(guild: Guild): BuildingInfo[] {
	return Object.values(GuildBuilding).map(building => {
		const currentLevel = getBuildingLevel(guild, building);
		return {
			building,
			level: currentLevel,
			maxLevel: GuildDomainConstants.BUILDINGS[building].maxLevel,
			upgradeCost: GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel),
			requiredGuildLevel: GuildDomainConstants.getBuildingRequiredGuildLevel(building, currentLevel)
		};
	});
}

export default class GuildDomainCommand {
	@commandRequires(CommandGuildDomainPacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		guildNeeded: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD
	}) async execute(response: CrowniclesPacket[], player: Player): Promise<void> {
		const guild = (await Guilds.getById(player.guildId))!;

		response.push(makePacket(CommandGuildDomainPacketRes, {
			guildName: guild.name,
			guildLevel: guild.level,
			treasury: guild.treasury,
			buildings: buildBuildingInfos(guild)
		}));
	}

	@commandRequires(CommandGuildDomainUpgradePacketReq, {
		notBlocked: true,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		guildNeeded: true,
		guildRoleNeeded: GuildRole.ELDER,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD
	}) async executeUpgrade(response: CrowniclesPacket[], player: Player, packet: CommandGuildDomainUpgradePacketReq, _context: PacketContext): Promise<void> {
		const guild = (await Guilds.getById(player.guildId))!;
		const building = packet.building;
		const currentLevel = getBuildingLevel(guild, building);

		const upgradeCost = GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel);
		if (upgradeCost === null) {
			response.push(makePacket(CommandGuildDomainUpgradeMaxLevelPacket, { building }));
			return;
		}

		const requiredGuildLevel = GuildDomainConstants.getBuildingRequiredGuildLevel(building, currentLevel)!;
		if (guild.level < requiredGuildLevel) {
			response.push(makePacket(CommandGuildDomainUpgradeGuildLevelTooLowPacket, {
				building,
				requiredGuildLevel,
				currentGuildLevel: guild.level
			}));
			return;
		}

		if (guild.treasury < upgradeCost) {
			response.push(makePacket(CommandGuildDomainUpgradeNotEnoughTreasuryPacket, {
				building,
				cost: upgradeCost,
				treasury: guild.treasury
			}));
			return;
		}

		guild.treasury -= upgradeCost;
		const fieldName = BUILDING_LEVEL_FIELDS[building];
		guild.setDataValue(fieldName as string, currentLevel + 1);
		await guild.save();

		response.push(makePacket(CommandGuildDomainUpgradeSuccessPacket, {
			building,
			newLevel: currentLevel + 1,
			cost: upgradeCost,
			remainingTreasury: guild.treasury
		}));
	}
}
