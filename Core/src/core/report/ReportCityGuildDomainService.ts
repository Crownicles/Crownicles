import {
	Player, Players
} from "../database/game/models/Player";
import { City } from "../../data/City";
import Guild, { Guilds } from "../database/game/models/Guild";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainDepositErrorRes,
	CommandReportGuildDomainDepositReq,
	CommandReportGuildDomainDepositRes,
	CommandReportGuildDomainNotEnoughTreasuryRes,
	CommandReportGuildDomainPurchaseRes,
	CommandReportGuildDomainRelocateRes,
	CommandReportGuildDomainUpgradeErrorRes,
	CommandReportGuildDomainUpgradeReq,
	CommandReportGuildDomainUpgradeRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

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

export async function handleGuildDomainDeposit(keycloakId: string, packet: CommandReportGuildDomainDepositReq): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return makePacket(CommandReportGuildDomainDepositErrorRes, { error: "noGuild" });
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild || guild.domainCityId === null) {
		return makePacket(CommandReportGuildDomainDepositErrorRes, { error: "noDomain" });
	}

	const amount = Math.min(packet.amount, player.money);
	if (amount < GuildDomainConstants.MIN_CONTRIBUTE_AMOUNT) {
		return makePacket(CommandReportGuildDomainDepositErrorRes, { error: "tooLow" });
	}

	await player.spendMoney({
		amount,
		response: [],
		reason: NumberChangeReason.GUILD_CONTRIBUTE
	});
	guild.treasury += amount;
	await guild.save();
	await player.save();

	return makePacket(CommandReportGuildDomainDepositRes, {
		newTreasury: guild.treasury,
		newPlayerMoney: player.money,
		amountDeposited: amount
	});
}

export async function handleGuildDomainUpgrade(keycloakId: string, packet: CommandReportGuildDomainUpgradeReq): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: "noGuild" });
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild || guild.domainCityId === null) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: "noDomain" });
	}

	if (guild.chiefId !== player.id && guild.elderId !== player.id) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: "notAuthorized" });
	}

	const building = packet.building as GuildBuilding;
	if (!Object.values(GuildBuilding).includes(building)) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: "invalidBuilding" });
	}

	const currentLevel = guild[BUILDING_LEVEL_FIELDS[building]] as number;
	const upgradeCost = GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel);
	if (upgradeCost === null) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: "maxLevel" });
	}

	const requiredGuildLevel = GuildDomainConstants.getBuildingRequiredGuildLevel(building, currentLevel)!;
	if (guild.level < requiredGuildLevel) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: "guildLevelTooLow" });
	}

	if (guild.treasury < upgradeCost) {
		return makePacket(CommandReportGuildDomainUpgradeErrorRes, { error: "notEnoughTreasury" });
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
