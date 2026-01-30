import { packetHandler } from "../PacketHandler";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CommandReportChooseDestinationRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import {
	crowniclesClient, keycloakConfig
} from "../../bot/CrowniclesShard";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { minutesToHours } from "../../../../Lib/src/utils/TimeUtils";
import { GuildLevelUpPacket } from "../../../../Lib/src/packets/events/GuildLevelUpPacket";
import { MissionsCompletedPacket } from "../../../../Lib/src/packets/events/MissionsCompletedPacket";
import { MissionsExpiredPacket } from "../../../../Lib/src/packets/events/MissionsExpiredPacket";
import { PlayerDeathPacket } from "../../../../Lib/src/packets/events/PlayerDeathPacket";
import { PlayerLeavePveIslandPacket } from "../../../../Lib/src/packets/events/PlayerLeavePveIslandPacket";
import { PlayerLevelUpPacket } from "../../../../Lib/src/packets/events/PlayerLevelUpPacket";
import { PlayerReceivePetPacket } from "../../../../Lib/src/packets/events/PlayerReceivePetPacket";
import { GiveFoodToGuildPacket } from "../../../../Lib/src/packets/utils/GiveFoodToGuildPacket";
import { NoFoodSpaceInGuildPacket } from "../../../../Lib/src/packets/utils/NoFoodSpaceInGuildPacket";
import { MissionUtils } from "../../utils/MissionUtils";
import { MissionType } from "../../../../Lib/src/types/CompletedMission";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { escapeUsername } from "../../../../Lib/src/utils/StringUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

export default class EventsHandlers {
	@packetHandler(CommandReportChooseDestinationRes)
	async chooseDestinationRes(context: PacketContext, packet: CommandReportChooseDestinationRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}

		const lng = interaction.userLanguage;
		const embed = new CrowniclesEmbed();
		embed.formatAuthor(i18n.t("commands:report.destinationTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user);
		let time = packet.tripDuration;
		const timeDisplay = i18n.formatDuration(packet.tripDuration, lng);
		let i18nTr: string;
		if (time < 60) {
			i18nTr = "commands:report.choseMapMinutes";
		}
		else {
			time = Math.round(minutesToHours(packet.tripDuration));
			i18nTr = "commands:report.choseMap";
		}
		embed.setDescription(i18n.t(i18nTr, {
			count: time,
			lng,
			mapPrefix: i18n.t(`models:map_types.${packet.mapTypeId}.prefix`, { lng }),
			mapType: (i18n.t(`models:map_types.${packet.mapTypeId}.name`, { lng }) as string).toLowerCase(),
			mapEmote: CrowniclesIcons.mapTypes[packet.mapTypeId],
			mapName: i18n.t(`models:map_locations.${packet.mapId}.name`, { lng }),
			time,
			timeDisplay
		}));
		try {
			if (context.discord!.buttonInteraction) {
				await DiscordCache.getButtonInteraction(context.discord!.buttonInteraction)
					?.editReply({ embeds: [embed] });
				return;
			}
		}
		catch {
			// Do nothing
		}

		await interaction.channel.send({ embeds: [embed] });
	}

	@packetHandler(GuildLevelUpPacket)
	async guildLevelUp(context: PacketContext, packet: GuildLevelUpPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		await interaction.channel.send({
			embeds: [
				new CrowniclesEmbed()
					.setTitle(i18n.t("models:guilds.levelUpTitle", {
						lng,
						guild: packet.guildName
					}))
					.setDescription(i18n.t("models:guilds.levelUpDesc", {
						lng,
						level: packet.level
					}))
			]
		});
	}

	@packetHandler(MissionsCompletedPacket)
	async missionsCompleted(context: PacketContext, packet: MissionsCompletedPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId!);
		if (getUser.isError) {
			// User may have been deleted from Keycloak, skip this notification
			CrowniclesLogger.warn(`Keycloak user with id ${packet.keycloakId} not found, skipping missions completed notification`);
			return;
		}
		const user = getUser.payload.user;
		const discordId = user.attributes.discordId?.[0] ? user.attributes.discordId[0] : null;
		const discordUser = discordId ? crowniclesClient.users.cache.get(discordId) : null;

		const lng = interaction.userLanguage;
		const titleText = i18n.t("notifications:missions.completed.title", {
			lng,
			count: packet.missions.length,
			pseudo: escapeUsername(user.attributes.gameUsername[0])
		});
		const completedMissionsEmbed = discordUser
			? new CrowniclesEmbed().formatAuthor(titleText, discordUser)
			: new CrowniclesEmbed().setTitle(titleText);

		const missionLists: Record<MissionType, string[]> = {
			[MissionType.CAMPAIGN]: [],
			[MissionType.DAILY]: [],
			[MissionType.NORMAL]: []
		};
		let totalGems = 0;
		let totalPoints = 0;
		let totalMoney = 0;
		let totalXP = 0;
		for (const mission of packet.missions) {
			totalGems += mission.gemsToWin;
			totalPoints += mission.pointsToWin;
			totalMoney += mission.moneyToWin;
			totalXP += mission.xpToWin;
			missionLists[mission.missionType].push(MissionUtils.formatCompletedMission(mission, lng));
		}
		for (const [missionType, missions] of Object.entries(missionLists)
			.filter(entry => entry[1].length !== 0)) {
			completedMissionsEmbed.addFields({
				name: i18n.t(`notifications:missions.completed.subcategories.${missionType}`, {
					lng,
					count: missions.length
				}),
				value: missions.join("\n")
			});
		}
		if (packet.missions.length > 1) {
			const totalRewardsLines: string[] = [];
			if (totalGems > 0) {
				totalRewardsLines.push(i18n.t("notifications:missions.completed.totalDisplay.gems", {
					count: totalGems,
					lng
				}));
			}
			if (totalPoints > 0) {
				totalRewardsLines.push(i18n.t("notifications:missions.completed.totalDisplay.points", {
					count: totalPoints,
					lng
				}));
			}
			if (totalMoney > 0) {
				totalRewardsLines.push(i18n.t("notifications:missions.completed.totalDisplay.money", {
					count: totalMoney,
					lng
				}));
			}
			if (totalXP > 0) {
				totalRewardsLines.push(i18n.t("notifications:missions.completed.totalDisplay.xp", {
					count: totalXP,
					lng
				}));
			}
			if (totalRewardsLines.length === 0) {
				totalRewardsLines.push(i18n.t("notifications:missions.completed.noRewards", { lng }));
			}
			completedMissionsEmbed.addFields({
				name: i18n.t("notifications:missions.completed.totalRewards", { lng }),
				value: totalRewardsLines.join("\n")
			});
		}
		await interaction.channel.send({ embeds: [completedMissionsEmbed] });
	}

	@packetHandler(MissionsExpiredPacket)
	async missionsExpired(context: PacketContext, packet: MissionsExpiredPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId!);
		if (getUser.isError) {
			// User may have been deleted from Keycloak, skip this notification
			CrowniclesLogger.warn(`Keycloak user with id ${packet.keycloakId} not found, skipping missions expired notification`);
			return;
		}
		const user = getUser.payload.user;
		const discordId = user.attributes.discordId?.[0] ? user.attributes.discordId[0] : null;
		const discordUser = discordId ? crowniclesClient.users.cache.get(discordId) : null;

		const lng = interaction.userLanguage;
		let missionsExpiredDescription = "";
		for (const mission of packet.missions) {
			missionsExpiredDescription += `- ${MissionUtils.formatBaseMission(mission, lng)} (${mission.numberDone}/${mission.missionObjective})\n`;
		}

		const titleText = i18n.t("notifications:missions.expired.title", {
			count: packet.missions.length,
			lng,
			pseudo: escapeUsername(user.attributes.gameUsername[0])
		});
		const embed = discordUser
			? new CrowniclesEmbed().formatAuthor(titleText, discordUser)
			: new CrowniclesEmbed().setTitle(titleText);
		embed.setDescription(i18n.t("notifications:missions.expired.description", {
			lng,
			count: packet.missions.length,
			missionsExpired: missionsExpiredDescription
		}));

		await interaction.channel.send({
			embeds: [embed]
		});
	}

	@packetHandler(PlayerDeathPacket)
	async playerDeath(context: PacketContext, _packet: PlayerDeathPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}

		const lng = interaction.userLanguage;

		await interaction.channel.send({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("models:players.koTitle", {
						lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}), interaction.user)
					.setDescription(i18n.t("models:players.koDesc", { lng }))
					.setErrorColor()
			]
		});

		interaction.user.send({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("models:players.koDmTitle", { lng }), interaction.user)
					.setDescription(i18n.t("models:players.koDmDesc", { lng }))
			]
		}).then()
			.catch();
	}

	@packetHandler(PlayerLeavePveIslandPacket)
	async playerLeavePveIsland(context: PacketContext, packet: PlayerLeavePveIslandPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}

		const lng = interaction.userLanguage;
		let desc = i18n.t("models:players.leavePVEIslandDescStart", {
			lng,
			moneyLost: packet.moneyLost
		});

		if (packet.guildPointsLost > 0) {
			desc += i18n.t("models:players.leavePVEIslandMalusGuildPoints", {
				lng,
				guildPointsLost: packet.guildPointsLost
			});
		}

		desc += i18n.t("models:players.leavePVEIslandDescEnd", { lng });

		await interaction.channel.send({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("models:players.leavePVEIslandTitle", {
						lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}), interaction.user)
					.setDescription(desc)
			]
		});
	}

	@packetHandler(PlayerLevelUpPacket)
	async playerLevelUp(context: PacketContext, packet: PlayerLevelUpPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}

		const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId!);
		if (getUser.isError) {
			// User may have been deleted from Keycloak, skip this notification
			CrowniclesLogger.warn(`Keycloak user with id ${packet.keycloakId} not found, skipping level up notification`);
			return;
		}
		const user = getUser.payload.user;
		const discordId = user.attributes.discordId?.[0] ? user.attributes.discordId[0] : null;
		const discordUser = discordId ? crowniclesClient.users.cache.get(discordId) : null;

		const lng = interaction.userLanguage;

		const rewards: {
			[key in keyof Omit<PlayerLevelUpPacket, "level" | "keycloakId">]: {
				tr: string; replacements?: object;
			}
		} = {
			fightUnlocked: { tr: "fightUnlocked" },
			guildUnlocked: { tr: "guildUnlocked" },
			healthRestored: { tr: "healthRestored" },
			classesTier1Unlocked: {
				tr: "classTier",
				replacements: { tier: 1 }
			},
			classesTier2Unlocked: {
				tr: "classTier",
				replacements: { tier: 2 }
			},
			classesTier3Unlocked: {
				tr: "classTier",
				replacements: { tier: 3 }
			},
			classesTier4Unlocked: {
				tr: "classTier",
				replacements: { tier: 4 }
			},
			classesTier5Unlocked: {
				tr: "classTier",
				replacements: { tier: 5 }
			},
			missionSlotUnlocked: { tr: "newMissionSlot" },
			pveUnlocked: { tr: "pveUnlocked" },
			tokensUnlocked: { tr: "tokensUnlocked" },
			statsIncreased: { tr: "statsIncreased" }
		};

		let desc = i18n.t("models:players.levelUp.description", {
			lng,
			level: packet.level
		});

		for (const [key, value] of Object.entries(rewards)) {
			if (packet[key as keyof PlayerLevelUpPacket]) {
				desc += `${i18n.t(`models:players.levelUp.rewards.${value.tr}`, {
					lng,
					...value.replacements
				})}\n`;
			}
		}

		const titleText = i18n.t("models:players.levelUp.title", {
			lng,
			pseudo: escapeUsername(user.attributes.gameUsername[0])
		});
		const embed = discordUser
			? new CrowniclesEmbed().formatAuthor(titleText, discordUser)
			: new CrowniclesEmbed().setTitle(titleText);
		embed.setDescription(desc);

		await interaction.channel.send({
			embeds: [embed]
		});
	}

	@packetHandler(PlayerReceivePetPacket)
	async playerReceivePet(context: PacketContext, packet: PlayerReceivePetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}

		const lng = interaction.userLanguage;
		const descTr = packet.giveInGuild
			? "models:petReceived.genericGiveGuild"
			: packet.giveInPlayerInv
				? "models:petReceived.genericGivePlayer"
				: "models:petReceived.genericGiveNoSlot";

		const embed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("models:petReceived.genericGiveTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(i18n.t(descTr, {
				lng,
				pet: DisplayUtils.getPetDisplay(packet.petTypeId, packet.petSex, lng)
			}));

		if (packet.noRoomInGuild) {
			embed.setErrorColor();
		}

		await interaction.channel.send({
			embeds: [embed]
		});
	}

	@packetHandler(GiveFoodToGuildPacket)
	async giveFoodToGuild(context: PacketContext, packet: GiveFoodToGuildPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const foodId = PetConstants.PET_FOOD_BY_ID[packet.selectedFoodIndex];
		const lng = interaction!.userLanguage;

		await interaction?.channel.send({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("notifications:guildFood.receivedFoodTitle", { lng }), interaction.user)
					.setDescription(
						i18n.t("notifications:guildFood.receivedFoodDescription", {
							lng,
							foodId,
							amount: packet.quantity,
							foodName: i18n.t(`models:foods.${foodId}`, {
								lng,
								count: packet.quantity
							})
						})
					)
			]
		});
	}

	@packetHandler(NoFoodSpaceInGuildPacket)
	async noFoodSpaceInGuild(context: PacketContext, packet: NoFoodSpaceInGuildPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		await interaction.channel.send({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:guildFoodStorageFull", {
						lng,
						quantity: packet.quantity,
						food: DisplayUtils.getFoodDisplay(packet.food, packet.quantity, lng, false)
					})
				)
			]
		});
	}
}
