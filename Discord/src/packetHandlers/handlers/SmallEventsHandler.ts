import { packetHandler } from "../PacketHandler";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventAdvanceTimePacket } from "../../../../Lib/src/packets/smallEvents/SmallEventAdvanceTimePacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../messages/CrowniclesSmallEventEmbed";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../utils/SmallEventUtils";
import { SmallEventBigBadPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBigBadPacket";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../bot/CrowniclesShard";
import {
	SmallEventBadIssue,
	SmallEventSmallBadPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventSmallBadPacket";
import { SmallEventBigBadKind } from "../../../../Lib/src/types/SmallEventBigBadKind";
import i18n from "../../translations/i18n";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { SmallEventBoatAdvicePacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBoatAdvicePacket";
import {
	SmallEventGoToPVEIslandAcceptPacket,
	SmallEventGoToPVEIslandNoAnswerPacket,
	SmallEventGoToPVEIslandNotEnoughGemsPacket,
	SmallEventGoToPVEIslandRefusePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventGoToPVEIslandPacket";
import {
	SmallEventLotteryLosePacket,
	SmallEventLotteryNoAnswerPacket,
	SmallEventLotteryPoorPacket,
	SmallEventLotteryWinPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";
import {
	InteractOtherPlayerInteraction,
	SmallEventInteractOtherPlayersAcceptToGivePoorPacket,
	SmallEventInteractOtherPlayersPacket,
	SmallEventInteractOtherPlayersRefuseToGivePoorPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import {
	handleEffectInteraction,
	handleNoPlayerInteraction,
	handleOtherInteractions,
	interactOtherPlayerGetPlayerDisplay
} from "../../smallEvents/interactOtherPlayers";
import { SmallEventLeagueRewardPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventLeagueReward";
import { printTimeBeforeDate } from "../../../../Lib/src/utils/TimeUtils";
import { SmallEventWinGuildXPPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinGuildXPPacket";
import { SmallEventBonusGuildPVEIslandPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";
import { SmallEventBotFactsPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBotFactsPacket";
import { SmallEventDoNothingPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDoNothingPacket";
import { SmallEventFightPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFightPetPacket";
import {
	SmallEventGobletsGameMalus,
	SmallEventGobletsGamePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventGobletsGamePacket";
import {
	SmallEventShopAcceptPacket,
	SmallEventShopCannotBuyPacket,
	SmallEventShopRefusePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventShopPacket";
import { SmallEventStaffMemberPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventStaffMemberPacket";
import { SmallEventWinEnergyPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinEnergyPacket";
import { SmallEventWinEnergyOnIslandPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinEnergyOnIslandPacket";
import { SmallEventWinHealthPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinHealthPacket";
import { SmallEventWinPersonalXPPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinPersonalXPPacket";
import { SmallEventWitchResultPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { witchResult } from "../../smallEvents/witch";
import { DisplayUtils } from "../../utils/DisplayUtils";
import {
	SexTypeShort, StringConstants
} from "../../../../Lib/src/constants/StringConstants";
import {
	SmallEventSpaceInitialPacket,
	SmallEventSpaceResultPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventSpacePacket";
import { SmallEventFindPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindPetPacket";
import { PetUtils } from "../../utils/PetUtils";
import { SmallEventFindPotionPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindPotionPacket";
import { SmallEventFindItemPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindItemPacket";
import { SmallEventPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetPacket";
import { SmallEventClassPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventClassPacket";
import { SmallEventUltimateFoodMerchantPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventUltimateFoodMerchantPacket";
import { SmallEventCartPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventCartPacket";
import { cartResult } from "../../smallEvents/cart";
import { SmallEventFindMissionPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindMissionPacket";
import { MissionUtils } from "../../utils/MissionUtils";
import { SmallEventLimogesPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventLimogesPacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { baseFunctionHandler } from "../../smallEvents/shop";
import { epicItemShopHandler } from "../../smallEvents/epicItemShop";
import {
	SmallEventEpicItemShopAcceptPacket,
	SmallEventEpicItemShopCannotBuyPacket,
	SmallEventEpicItemShopRefusePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventEpicItemShopPacket";
import { Badge } from "../../../../Lib/src/types/Badge";
import { SmallEventDwarfPetFanPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDwarfPetFanPacket";
import { SmallEventInfoFightPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventInfoFightPacket";
import { infoFightResult } from "../../smallEvents/infoFight";
import { limogesResult } from "../../smallEvents/limoges";
import { getPetFoodDescription } from "../../smallEvents/petFood";
import { SmallEventHauntedPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventHauntedPacket";
import { SmallEventPetFoodPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";
import { SmallEventBadPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";
import {
	SmallEventExpeditionAdvicePacket,
	ExpeditionAdviceInteractionType
} from "../../../../Lib/src/packets/smallEvents/SmallEventExpeditionAdvicePacket";
import { SmallEventPetDropTokenPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetDropTokenPacket";

const PET_TIME_INTERACTIONS = new Set([
	"gainTime",
	"loseTime"
]);

export default class SmallEventsHandler {
	@packetHandler(SmallEventAdvanceTimePacket)
	async smallEventAdvanceTime(context: PacketContext, packet: SmallEventAdvanceTimePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const timeDisplay = i18n.formatDuration(packet.amount, lng);
		const description = getRandomSmallEventIntro(lng)
			+ StringUtils.getRandomTranslation("smallEvents:advanceTime.stories", lng, {
				time: packet.amount,
				timeDisplay
			});
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("advanceTime", description, interaction.user, lng)] });
	}

	@packetHandler(SmallEventBigBadPacket)
	async smallEventBigBad(context: PacketContext, packet: SmallEventBigBadPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		let story: string;
		switch (packet.kind) {
			case SmallEventBigBadKind.LIFE_LOSS:
				story = StringUtils.getRandomTranslation("smallEvents:bigBad.lifeLoss", lng, { lifeLoss: packet.lifeLost });
				break;
			case SmallEventBigBadKind.ALTERATION:
				story = `${i18n.t(`smallEvents:bigBad.alterationStories.${packet.receivedStory}`, { lng })} ${CrowniclesIcons.effects[packet.effectId!]}`;
				break;
			case SmallEventBigBadKind.MONEY_LOSS:
				story = StringUtils.getRandomTranslation("smallEvents:bigBad.moneyLoss", lng, { moneyLost: packet.moneyLost });
				break;
			default:
				story = "";
		}
		const description = getRandomSmallEventIntro(lng) + story;
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("bigBad", description, interaction.user, lng)] });
	}

	@packetHandler(SmallEventBoatAdvicePacket)
	async smallEventBoatAdvice(context: PacketContext, _packet: SmallEventBoatAdvicePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const description = StringUtils.getRandomTranslation(
			"smallEvents:boatAdvice.intro",
			lng,
			{ advice: StringUtils.getRandomTranslation("smallEvents:boatAdvice.advices", lng) }
		);
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("boatAdvice", description, interaction.user, lng)] });
	}

	@packetHandler(SmallEventGoToPVEIslandAcceptPacket)
	async smallEventGoToPVEIslandAccept(context: PacketContext, packet: SmallEventGoToPVEIslandAcceptPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t(`smallEvents:goToPVEIsland.endStoryAccept${packet.alone ? "" : "WithMember"}`, {
						lng,
						gainScore: packet.pointsWon > 0
							? i18n.t("smallEvents:goToPVEIsland.confirmedScore", {
								lng,
								score: packet.pointsWon
							})
							: ""
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventGoToPVEIslandRefusePacket)
	async smallEventGoToPVEIslandRefuse(context: PacketContext, _packet: SmallEventGoToPVEIslandRefusePacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = context.discord!.language;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t("smallEvents:goToPVEIsland.endStoryRefuse", { lng }),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventGoToPVEIslandNoAnswerPacket)
	async smallEventGoToPVEIslandNoAnswer(context: PacketContext, _packet: SmallEventGoToPVEIslandNoAnswerPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		await interaction.followUp({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t("smallEvents:goToPVEIsland.endStoryRefuse", { lng }),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventGoToPVEIslandNotEnoughGemsPacket)
	async smallEventGoToPVEIslandNotEnoughGems(context: PacketContext, _packet: SmallEventGoToPVEIslandNotEnoughGemsPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = context.discord!.language;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t("smallEvents:goToPVEIsland.notEnoughGems", { lng }),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventLotteryNoAnswerPacket)
	async smallEventLotteryNoAnswer(context: PacketContext, _packet: SmallEventLotteryNoAnswerPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		await interaction.followUp({
			embeds: [new CrowniclesSmallEventEmbed("lottery", i18n.t("smallEvents:lottery.end", { lng }), interaction.user, lng)]
		});
	}

	@packetHandler(SmallEventLotteryPoorPacket)
	async smallEventLotteryPoor(context: PacketContext, _packet: SmallEventLotteryPoorPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = context.discord!.language;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"lottery",
					i18n.t("smallEvents:lottery.poor", { lng }),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventLotteryLosePacket)
	async smallEventLotteryLose(context: PacketContext, packet: SmallEventLotteryLosePacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = context.discord!.language;
		const lostTimeDisplay = i18n.formatDuration(packet.lostTime, lng);
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"lottery",
					i18n.t(`smallEvents:lottery.${packet.level}.${packet.moneyLost > 0 ? "failWithMalus" : "fail"}`, {
						lng,
						lostTime: packet.lostTime,
						lostTimeDisplay,
						money: packet.moneyLost
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventLotteryWinPacket)
	async smallEventLotteryWin(context: PacketContext, packet: SmallEventLotteryWinPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = context.discord!.language;
		const lostTimeDisplay = i18n.formatDuration(packet.lostTime, lng);
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"lottery",
					i18n.t(`smallEvents:lottery.${packet.level}.success`, {
						lng,
						lostTime: packet.lostTime,
						lostTimeDisplay
					}) + i18n.t(`smallEvents:lottery.rewardTypeText.${packet.winReward}`, {
						lng,
						reward: packet.winAmount
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventInteractOtherPlayersPacket)
	async smallEventInteractOtherPlayers(context: PacketContext, packet: SmallEventInteractOtherPlayersPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		if (!packet.keycloakId) {
			await handleNoPlayerInteraction(interaction, lng);
			return;
		}

		if (!packet.data) {
			throw new Error("No packet data defined in InteractOtherPlayers small event");
		}

		const playerDisplay = await interactOtherPlayerGetPlayerDisplay(packet.keycloakId, packet.data.rank, lng);

		if (packet.playerInteraction === InteractOtherPlayerInteraction.EFFECT) {
			await handleEffectInteraction(interaction, packet, lng, playerDisplay);
			return;
		}

		await handleOtherInteractions(interaction, packet, lng, playerDisplay);
	}

	@packetHandler(SmallEventInteractOtherPlayersAcceptToGivePoorPacket)
	async smallEventInteractOtherPlayersAcceptToGivePoor(context: PacketContext, _packet: SmallEventInteractOtherPlayersAcceptToGivePoorPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = context.discord!.language;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"interactOtherPlayers",
					StringUtils.getRandomTranslation("smallEvents:interactOtherPlayers.poor_give_money", lng),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventInteractOtherPlayersRefuseToGivePoorPacket)
	async smallEventInteractOtherPlayersRefuseToGivePoor(context: PacketContext, _packet: SmallEventInteractOtherPlayersRefuseToGivePoorPacket): Promise<void> {
		const interaction = context.discord!.buttonInteraction ? DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!) : DiscordCache.getInteraction(context.discord!.interaction!);
		const lng = context.discord!.language;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"interactOtherPlayers",
					StringUtils.getRandomTranslation("smallEvents:interactOtherPlayers.poor_dont_give_money", lng),
					interaction!.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventLeagueRewardPacket)
	async smallEventLeagueReward(context: PacketContext, packet: SmallEventLeagueRewardPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const endMessage = i18n.t(`smallEvents:leagueReward.${packet.rewardToday ? "rewardToday" : packet.enoughFights ? "endMessage" : "notEnoughFight"}`, {
			lng,
			leagueId: packet.leagueId,
			rewards: i18n.t("smallEvents:leagueReward.reward", {
				lng,
				money: packet.money,
				xp: packet.xp
			}),
			time: printTimeBeforeDate(packet.nextRewardDate)
		});
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"leagueReward",
					getRandomSmallEventIntro(lng) + StringUtils.getRandomTranslation("smallEvents:leagueReward.intrigue", lng) + endMessage,
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventWinGuildXPPacket)
	async smallEventWinGuildXp(context: PacketContext, packet: SmallEventWinGuildXPPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winGuildXP",
					`${StringUtils.getRandomTranslation("smallEvents:winGuildXP.stories", lng, { guild: packet.guildName })}${i18n.t("smallEvents:winGuildXP.end", {
						lng,
						xp: packet.amount
					})}`,
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventDoNothingPacket)
	async smallEventDoNothing(context: PacketContext, _packet: SmallEventDoNothingPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"doNothing",
					StringUtils.getRandomTranslation("smallEvents:doNothing.stories", interaction.userLanguage),
					interaction.user,
					interaction.userLanguage
				)
			]
		});
	}

	@packetHandler(SmallEventStaffMemberPacket)
	async smallEventStaffMember(context: PacketContext, _packet: SmallEventStaffMemberPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const staffMember = RandomUtils.crowniclesRandom.pick(Object.keys(i18n.t("smallEvents:staffMember.members", {
			returnObjects: true,
			lng
		})));
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"staffMember",
					StringUtils.getRandomTranslation("smallEvents:staffMember.context", lng, {
						pseudo: staffMember,
						sentence: i18n.t(`smallEvents:staffMember.members.${staffMember}`, {
							lng
						})
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventWinEnergyPacket)
	async smallEventWinEnergy(context: PacketContext, _packet: SmallEventWinEnergyPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winEnergy",
					getRandomSmallEventIntro(lng) + StringUtils.getRandomTranslation("smallEvents:winEnergy.stories", lng),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventWinEnergyOnIslandPacket)
	async smallEventWinFightPoints(context: PacketContext, packet: SmallEventWinEnergyOnIslandPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winEnergyOnIsland",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(
						"smallEvents:winEnergyOnIsland.stories",
						lng,
						{ energy: packet.amount }
					),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventWinHealthPacket)
	async smallEventWinHealth(context: PacketContext, packet: SmallEventWinHealthPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winHealth",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:winHealth.stories", lng, { health: packet.amount }),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventWinPersonalXPPacket)
	async smallEventWinPersonalXP(context: PacketContext, packet: SmallEventWinPersonalXPPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winPersonalXP",
					`${getRandomSmallEventIntro(lng)}${StringUtils.getRandomTranslation("smallEvents:winPersonalXP.stories", lng)}${i18n.t("smallEvents:winPersonalXP.end", {
						lng,
						xp: packet.amount
					})}`,
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventWitchResultPacket)
	async smallEventWitchResult(context: PacketContext, packet: SmallEventWitchResultPacket): Promise<void> {
		await witchResult(packet, context);
	}

	@packetHandler(SmallEventFindPetPacket)
	async smallEventFindPet(context: PacketContext, packet: SmallEventFindPetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const translationKey = packet.isPetReceived
			? packet.petIsReceivedByGuild
				? "givePetGuild"
				: "givePetPlayer"
			: packet.isPetFood
				? "food"
				: "noFood";
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findPet",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(
						`smallEvents:findPet.${translationKey}`,
						lng,
						{
							context: packet.petSex,
							pet: PetUtils.petToShortString(lng, undefined, packet.petTypeID, packet.petSex)
						}
					),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventSpaceInitialPacket)
	async smallEventSpaceInitial(context: PacketContext, _packet: SmallEventSpaceInitialPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"space",
					i18n.t("smallEvents:space.before_search_format", {
						lng,
						seIntro: getRandomSmallEventIntro(lng),
						intro: StringUtils.getRandomTranslation("smallEvents:space.intro", lng, {
							name: StringUtils.getRandomTranslation("smallEvents:space.names", lng)
						}),
						searchAction: StringUtils.getRandomTranslation("smallEvents:space.searchAction", lng),
						search: StringUtils.getRandomTranslation("smallEvents:space.search", lng)
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventSpaceResultPacket)
	async smallEventSpaceResult(context: PacketContext, packet: SmallEventSpaceResultPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const oldMessage = (await interaction.fetchReply()).embeds[0]?.data.description;
		if (!oldMessage) {
			return;
		}
		const lng = interaction.userLanguage;
		const oneOrMoreDays = packet.values.mainValue > 1
			? i18n.t("smallEvents:space.days_other", { lng })
			: i18n.t("smallEvents:space.days_one", { lng });

		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"space",
					i18n.t("smallEvents:space.after_search_format", {
						lng,
						oldMessage: oldMessage.split(" ")
							.slice(1)
							.join(" "),
						actionIntro: StringUtils.getRandomTranslation("smallEvents:space.actionIntro", lng),
						action: StringUtils.getRandomTranslation("smallEvents:space.action", lng),
						specific: StringUtils.getRandomTranslation(`smallEvents:space.specific.${packet.chosenEvent}`, lng, {
							mainValue: packet.chosenEvent === "moonPhase"
								? i18n.t("smallEvents:space.moonPhases", {
									returnObjects: true,
									lng
								})[packet.values.mainValue]
								: packet.values.mainValue,
							objectWhichWillCrossTheSky: i18n.t("smallEvents:space.nObjectsCrossTheSky", {
								lng,
								count: packet.values.mainValue
							}),
							days: oneOrMoreDays,
							randomObjectName: packet.values.randomObjectName,
							randomObjectDistance: packet.values.randomObjectDistance,
							randomObjectDiameter: packet.values.randomObjectDiameter
						}),
						outro: StringUtils.getRandomTranslation("smallEvents:space.outro", lng)
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventBotFactsPacket)
	async smallEventBotFacts(context: PacketContext, packet: SmallEventBotFactsPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"botFacts",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:botFacts.stories", lng, {
						botFact: i18n.t(`smallEvents:botFacts.possibleInfo.${packet.information}`, {
							lng,
							count: packet.infoNumber,
							infoNumber: packet.infoNumber,
							infoComplement: DisplayUtils.getClassDisplay(packet.infoComplement ? packet.infoComplement : 0, lng)
						})
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventSmallBadPacket)
	async smallEventSmallBad(context: PacketContext, packet: SmallEventSmallBadPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		const amountDisplay = packet.issue === SmallEventBadIssue.TIME
			? i18n.formatDuration(packet.amount, lng)
			: packet.amount;

		// For TIME issue, choose translation key based on effectId
		let translationKey = `smallEvents:smallBad.${packet.issue}.stories`;
		if (packet.issue === SmallEventBadIssue.TIME && packet.effectId) {
			translationKey = `smallEvents:smallBad.${packet.issue}.${packet.effectId}.stories`;
		}

		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"smallBad",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(translationKey, lng, { amount: amountDisplay }),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventFindPotionPacket)
	async smallEventFindPotion(context: PacketContext, _packet: SmallEventFindPotionPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findPotion",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:findPotion.stories", lng),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventFindItemPacket)
	async smallEventFindItem(context: PacketContext, _packet: SmallEventFindItemPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findItem",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:findItem.stories", lng),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventPetPacket)
	async smallEventPet(context: PacketContext, packet: SmallEventPetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		const amountDisplay = packet.amount && PET_TIME_INTERACTIONS.has(packet.interactionName)
			? i18n.formatDuration(packet.amount, lng)
			: packet.amount;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"pet",
					StringUtils.getRandomTranslation(
						`smallEvents:pet.stories.${packet.interactionName}`,
						lng,
						{
							context: packet.petSex,
							pet: PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex),
							amount: packet.amount,
							amountDisplay,
							food: packet.food ? DisplayUtils.getFoodDisplay(packet.food, 1, lng, false) : null,
							badge: CrowniclesIcons.badges[Badge.LEGENDARY_PET],
							randomAnimal: i18n.t("smallEvents:pet.randomAnimal", {
								lng,
								context: packet.randomPetSex,
								randomAnimal: PetUtils.petToShortString(lng, undefined, packet.randomPetTypeId, packet.randomPetSex)
							})
						}
					),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventClassPacket)
	async smallEventClass(context: PacketContext, packet: SmallEventClassPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"class",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(`smallEvents:class.${packet.classKind}.${packet.interactionName}`, lng, {
						amount: packet.amount
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventUltimateFoodMerchantPacket)
	async smallEventUltimateFoodMerchant(context: PacketContext, packet: SmallEventUltimateFoodMerchantPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"ultimateFoodMerchant",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:ultimateFoodMerchant.stories", lng)
					+ StringUtils.getRandomTranslation(`smallEvents:ultimateFoodMerchant.rewards.${packet.interactionName}`, lng, {
						count: packet.amount,
						moneyEmote: CrowniclesIcons.unitValues.money
					}),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventCartPacket)
	async smallEventCart(context: PacketContext, packet: SmallEventCartPacket): Promise<void> {
		await cartResult(packet, context);
	}

	@packetHandler(SmallEventLimogesPacket)
	async smallEventLimoges(context: PacketContext, packet: SmallEventLimogesPacket): Promise<void> {
		await limogesResult(packet, context);
	}

	@packetHandler(SmallEventBonusGuildPVEIslandPacket)
	async smallEventBonusGuildPVEIsland(context: PacketContext, packet: SmallEventBonusGuildPVEIslandPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"bonusGuildPVEIsland",
					`${i18n.t(`smallEvents:bonusGuildPVEIsland.events.${packet.event}.intro`, { lng })}\n\n${
						i18n.t(`smallEvents:bonusGuildPVEIsland.events.${packet.event}.${packet.result}.${packet.surrounding}`, {
							lng,
							amount: packet.amount,
							emoteKey: packet.isExperienceGain ? "xp" : "guildPoint"
						})}`,
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventFightPetPacket)
	async smallEventFightPet(context: PacketContext, packet: SmallEventFightPetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		// Get the sex context for gendered translations
		const sexContext = packet.isFemale ? StringConstants.SEX.FEMALE.long : StringConstants.SEX.MALE.long;
		await interaction.followUp({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"fightPet",
					i18n.t(`smallEvents:fightPet.fightPetActions.${packet.fightPetActionId}.${packet.isSuccess ? "success" : "failure"}`, {
						lng, context: sexContext
					})
					+ (packet.isSuccess
						? i18n.t("smallEvents:fightPet.rageUpFormat", {
							lng,
							rageUpDescription: StringUtils.getRandomTranslation("smallEvents:fightPet.rageUpDescriptions", lng)
						})
						: ""),
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventGobletsGamePacket)
	async smallEventGobletsGame(context: PacketContext, packet: SmallEventGobletsGamePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		/*
		 * For ITEM result, the item display is handled by the ItemFound system
		 * We just need to display a different message
		 */
		const resultKey = packet.malus === SmallEventGobletsGameMalus.ITEM
			? "smallEvents:gobletsGame.results.item"
			: `smallEvents:gobletsGame.results.${packet.malus}`;

		const goblet = packet.goblet ?? RandomUtils.crowniclesRandom.pick(Object.keys(CrowniclesIcons.goblets));
		const gobletEmote = CrowniclesIcons.goblets[goblet] ?? "";

		await interaction.followUp({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(
						i18n.t("commands:report.journal", {
							lng,
							pseudo: escapeUsername(interaction.user.displayName)
						}),
						interaction.user
					)
					.setDescription(
						`${gobletEmote} ${i18n.t(resultKey, {
							lng,
							quantity: packet.malus === SmallEventGobletsGameMalus.TIME ? i18n.formatDuration(packet.value, lng) : packet.value,
							goblet
						})}`
					)
			]
		});
	}


	@packetHandler(SmallEventShopRefusePacket)
	async smallEventShopRefuse(context: PacketContext, _packet: SmallEventShopRefusePacket): Promise<void> {
		await baseFunctionHandler(context, "smallEvents:shop.refused");
	}

	@packetHandler(SmallEventShopAcceptPacket)
	async smallEventShopAccept(context: PacketContext, _packet: SmallEventShopAcceptPacket): Promise<void> {
		await baseFunctionHandler(context, "smallEvents:shop.purchased");
	}

	@packetHandler(SmallEventShopCannotBuyPacket)
	async smallEventShopCannotBuy(context: PacketContext, _packet: SmallEventShopCannotBuyPacket): Promise<void> {
		await baseFunctionHandler(context, "smallEvents:shop.notEnoughMoney");
	}

	@packetHandler(SmallEventFindMissionPacket)
	async smallEventFindMission(context: PacketContext, packet: SmallEventFindMissionPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findMission",
					`${
						getRandomSmallEventIntro(lng)
					}${
						StringUtils.getRandomTranslation("smallEvents:findMission.intrigue", lng)
					}\n\n**${
						MissionUtils.formatBaseMission(packet.mission, lng)
					}**`,
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventEpicItemShopRefusePacket)
	async smallEventEpicItemShopRefuse(context: PacketContext, _packet: SmallEventEpicItemShopRefusePacket): Promise<void> {
		await epicItemShopHandler(context, "smallEvents:epicItemShop.refused");
	}

	@packetHandler(SmallEventEpicItemShopAcceptPacket)
	async smallEventEpicItemShopAccept(context: PacketContext, _packet: SmallEventEpicItemShopAcceptPacket): Promise<void> {
		await epicItemShopHandler(context, "smallEvents:epicItemShop.purchased");
	}

	@packetHandler(SmallEventEpicItemShopCannotBuyPacket)
	async smallEventEpicItemShopCannotBuy(context: PacketContext, _packet: SmallEventEpicItemShopCannotBuyPacket): Promise<void> {
		await epicItemShopHandler(context, "smallEvents:epicItemShop.notEnoughMoney");
	}

	@packetHandler(SmallEventDwarfPetFanPacket)
	async smallEventDwarfPetFan(context: PacketContext, packet: SmallEventDwarfPetFanPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		const keyReward = packet.isGemReward ? "gem" : "money";
		const hasPetInfo = packet.petTypeId !== undefined;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"dwarfPetFan",
					`${StringUtils.getRandomTranslation("smallEvents:dwarfPetFan.intro", lng)} ${StringUtils.getRandomTranslation(`smallEvents:dwarfPetFan.${packet.interactionName}`, lng, {
						...hasPetInfo ? { context: packet.petSex } : {},
						pet: hasPetInfo ? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId!, packet.petSex!) : "",
						reward: packet.amount !== undefined
							? i18n.t(`smallEvents:dwarfPetFan.reward.${keyReward}`, {
								lng, amount: packet.amount
							})
							: ""
					})}`,
					interaction.user,
					lng
				)
			]
		});
	}

	@packetHandler(SmallEventInfoFightPacket)
	async smallEventInfoFight(context: PacketContext, packet: SmallEventInfoFightPacket): Promise<void> {
		await infoFightResult(context, packet);
	}

	@packetHandler(SmallEventHauntedPacket)
	async smallEventHaunted(context: PacketContext, _packet: SmallEventHauntedPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const description = StringUtils.getRandomTranslation("smallEvents:haunted", lng);
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("haunted", description, interaction.user, lng)] });
	}

	@packetHandler(SmallEventPetFoodPacket)
	async smallEventPetFood(context: PacketContext, packet: SmallEventPetFoodPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;

		const description = getPetFoodDescription(packet, lng);

		const embed = new CrowniclesSmallEventEmbed(
			"petFood",
			description,
			interaction.user,
			lng
		);

		await interaction.editReply({
			embeds: [embed], components: []
		});
	}

	@packetHandler(SmallEventBadPetPacket)
	async smallEventBadPet(context: PacketContext, packet: SmallEventBadPetPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;

		const petDisplay = PetUtils.petToShortString(lng, packet.petNickname, packet.petId, packet.sex as SexTypeShort);

		// Get the sex context for gendered translations
		const sexContext = packet.sex === StringConstants.SEX.MALE.short
			? StringConstants.SEX.MALE.long
			: StringConstants.SEX.FEMALE.long;

		const outcomeKey = packet.loveLost === 0 ? "success" : "fail";
		const description = StringUtils.getRandomTranslation(
			`smallEvents:badPet.outcomes.${packet.interactionType}.${outcomeKey}`,
			lng,
			{
				pet: petDisplay, context: sexContext
			}
		);

		const embed = new CrowniclesSmallEventEmbed(
			"badPet",
			description,
			interaction.user,
			lng
		);

		await interaction.editReply({
			embeds: [embed], components: []
		});
	}

	@packetHandler(SmallEventExpeditionAdvicePacket)
	async smallEventExpeditionAdvice(context: PacketContext, packet: SmallEventExpeditionAdvicePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		let story: string;

		switch (packet.interactionType) {
			case ExpeditionAdviceInteractionType.TALISMAN_INTRO: {
				// Talisman introduction (first 2 encounters, displayed in order)
				const introTexts: string[] = i18n.t("smallEvents:expeditionAdvice.talismanIntro", {
					returnObjects: true,
					lng
				});
				story = introTexts[packet.encounterCount! - 1] ?? introTexts[0];
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.noPet", lng);
				break;

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_HUNGRY: {
				const petDisplayHungry = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.petHungry", lng, {
					pet: petDisplayHungry
				});
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_FEISTY: {
				const petDisplayFeisty = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.petFeisty", lng, {
					pet: petDisplayFeisty
				});
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_NOT_SEEN_BY_TALVAR: {
				const petDisplayTalvar = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.petNotSeenByTalvar", lng, {
					pet: petDisplayTalvar
				});
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_GUILD:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.noGuild", lng);
				break;

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.levelTooLow", lng, {
					requiredLevel: packet.requiredLevel,
					playerLevel: packet.playerLevel,
					count: packet.consolationTokensAmount
				});
				break;

			case ExpeditionAdviceInteractionType.TALISMAN_RECEIVED: {
				const petDisplayReceived = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.talismanReceived", lng, {
					pet: petDisplayReceived
				});
				break;
			}

			case ExpeditionAdviceInteractionType.EXPEDITION_BONUS: {
				const petDisplayBonus = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });

				// Determine which translation to use based on rewards
				let translationKey: string;
				if (packet.bonusCombatPotion) {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.combatPotion";
				}
				else if (packet.bonusItem) {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.pointsAndItem";
				}
				else if (packet.bonusMoney) {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.pointsAndMoney";
				}
				else {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.points";
				}

				story = i18n.t(translationKey, {
					lng,
					pet: petDisplayBonus,
					bonusPoints: packet.bonusPoints,
					bonusMoney: packet.bonusMoney
				});
				break;
			}

			case ExpeditionAdviceInteractionType.ADVICE:
			default:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.advice", lng);
				break;
		}

		await interaction.editReply({
			embeds: [new CrowniclesSmallEventEmbed("expeditionAdvice", story, interaction.user, lng)]
		});
	}

	@packetHandler(SmallEventPetDropTokenPacket)
	async smallEventPetDropToken(context: PacketContext, packet: SmallEventPetDropTokenPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const petDisplay = PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex);
		const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.ownerKeycloakId);
		const ownerName = escapeUsername(!getUser.isError && getUser.payload.user.attributes.gameUsername
			? getUser.payload.user.attributes.gameUsername[0]
			: i18n.t("error:unknownPlayer", { lng }));
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"petDropToken",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:petDropToken.stories", lng, {
						pet: petDisplay,
						owner: ownerName
					}),
					interaction.user,
					lng
				)
			]
		});
	}
}

