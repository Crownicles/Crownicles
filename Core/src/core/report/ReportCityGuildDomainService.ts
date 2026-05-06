import {
	Player, Players
} from "../database/game/models/Player";
import { City } from "../../data/City";
import Guild, { Guilds } from "../database/game/models/Guild";
import {
	GUILD_DOMAIN_ERROR, GuildBuilding, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainNotEnoughTreasuryRes,
	CommandReportGuildDomainPurchaseRes,
	CommandReportGuildDomainRelocateRes,
	CommandReportGuildDomainUpgradeErrorRes,
	CommandReportGuildDomainUpgradeReq,
	CommandReportGuildDomainUpgradeRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

const BUILDING_LEVEL_FIELDS: Record<GuildBuilding, keyof Guild> = {
	[GuildBuilding.SHOP]: "shopLevel",
	[GuildBuilding.SHELTER]: "shelterLevel",
	[GuildBuilding.PANTRY]: "pantryLevel",
	[GuildBuilding.TRAINING_GROUND]: "trainingGroundLevel"
};

export async function handleGuildDomainNotaryReaction(player: Player, city: City, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
	if (!guild || guild.chiefId !== player.id) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use guild domain notary but is not guild chief.`);
		return;
	}

	const isRelocation = guild.domainCityId !== null;
	const cost = isRelocation
		? GuildDomainConstants.DOMAIN_RELOCATION_COST
		: GuildDomainConstants.DOMAIN_PURCHASE_COST;

	if (guild.treasury < cost) {
		response.push(makePacket(CommandReportGuildDomainNotEnoughTreasuryRes, {
			missingTreasury: cost - guild.treasury
		}));
		return;
	}

	guild.treasury -= cost;
	guild.domainCityId = city.id;
	await guild.save();

	if (isRelocation) {
		response.push(makePacket(CommandReportGuildDomainRelocateRes, { cost }));
	}
	else {
		response.push(makePacket(CommandReportGuildDomainPurchaseRes, { cost }));
	}
}

export async function handleGuildDomainUpgrade(keycloakId: string, packet: CommandReportGuildDomainUpgradeReq): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: GUILD_DOMAIN_ERROR.NO_GUILD });
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild || guild.domainCityId === null) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: GUILD_DOMAIN_ERROR.NO_DOMAIN });
	}

	if (guild.chiefId !== player.id) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: GUILD_DOMAIN_ERROR.NOT_AUTHORIZED });
	}

	const building = packet.building;
	if (!Object.values(GuildBuilding).includes(building)) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: GUILD_DOMAIN_ERROR.INVALID_BUILDING });
	}

	const currentLevel = guild.getDataValue(BUILDING_LEVEL_FIELDS[building]) as number;
	const upgradeCost = GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel);
	if (upgradeCost === null) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: GUILD_DOMAIN_ERROR.MAX_LEVEL });
	}

	const requiredGuildLevel = GuildDomainConstants.getBuildingRequiredGuildLevel(building, currentLevel)!;
	if (guild.level < requiredGuildLevel) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: GUILD_DOMAIN_ERROR.GUILD_LEVEL_TOO_LOW });
	}

	if (guild.treasury < upgradeCost) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: GUILD_DOMAIN_ERROR.NOT_ENOUGH_TREASURY });
	}

	guild.treasury -= upgradeCost;
	guild.setDataValue(BUILDING_LEVEL_FIELDS[building] as string, currentLevel + 1);
	await guild.save();

	return makePacket(CommandReportGuildDomainUpgradeRes, {
		building,
		newLevel: currentLevel + 1,
		cost: upgradeCost,
		newTreasury: guild.treasury
	});
}
