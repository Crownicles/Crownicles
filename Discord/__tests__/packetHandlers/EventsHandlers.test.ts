import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/EventsHandlers";
import {
	CrowniclesPacket, makePacket
} from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportChooseDestinationRes } from "../../../Lib/src/packets/commands/CommandReportPacket";
import { GuildLevelUpPacket } from "../../../Lib/src/packets/events/GuildLevelUpPacket";
import { MissionsCompletedPacket } from "../../../Lib/src/packets/events/MissionsCompletedPacket";
import { MissionsExpiredPacket } from "../../../Lib/src/packets/events/MissionsExpiredPacket";
import { PlayerDeathPacket } from "../../../Lib/src/packets/events/PlayerDeathPacket";
import { PlayerLeavePveIslandPacket } from "../../../Lib/src/packets/events/PlayerLeavePveIslandPacket";
import { KingChallengeTierReachedPacket } from "../../../Lib/src/packets/events/KingChallengeTierReachedPacket";
import { QuestUpdatedPacket } from "../../../Lib/src/packets/events/QuestUpdatedPacket";
import { PlayerLevelUpPacket } from "../../../Lib/src/packets/events/PlayerLevelUpPacket";
import { PlayerReceivePetPacket } from "../../../Lib/src/packets/events/PlayerReceivePetPacket";
import { GiveFoodToGuildPacket } from "../../../Lib/src/packets/utils/GiveFoodToGuildPacket";
import { NoFoodSpaceInGuildPacket } from "../../../Lib/src/packets/utils/NoFoodSpaceInGuildPacket";
import {
	CompletedMission, MissionType
} from "../../../Lib/src/types/CompletedMission";
import {
	QUEST_IDS, QuestConstants
} from "../../../Lib/src/constants/QuestConstants";
import { TokensConstants } from "../../../Lib/src/constants/TokensConstants";
import { PetConstants } from "../../../Lib/src/constants/PetConstants";
import {
	answeredClick, dispatch, embedsOf, ERROR_COLOR, fakeCommand, FakeInteraction, RenderedEmbed, RenderedMessage, setupRendering,
	singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

/**
 * Dispatch an event of the player's command and return the single message posted in its channel
 */
async function postedEvent(packet: CrowniclesPacket): Promise<{
	message: RenderedMessage; embed: RenderedEmbed; interaction: FakeInteraction;
}> {
	const {
		interaction, context
	} = fakeCommand("Hero");
	await dispatch(context, packet);
	const message = singleMessage(interaction);
	expect(message.method).toBe("channel.send");
	return {
		message, embed: embedsOf(message)[0], interaction
	};
}

describe("destination", () => {
	it.each([
		[45, false, "**45 min"],
		[150, false, "**3 heures**"],
		[30, true, "rebroussez chemin"]
	])("announces a trip of %i minutes (going back: %s)", async (tripDuration, isGoingBack, expected) => {
		const { embed } = await postedEvent(makePacket(CommandReportChooseDestinationRes, {
			mapId: 1,
			mapTypeId: "be",
			tripDuration,
			isGoingBack
		}));

		expect(embed.description).toContain(expected);
		expect(embed.description).toContain("Plage Sentinelle");
	});

	it("adds the score earned in the city the player leaves, in the follow-up of his click", async () => {
		const command = fakeCommand("Hero");
		const {
			click, context
		} = answeredClick(command);

		await dispatch(context, makePacket(CommandReportChooseDestinationRes, {
			mapId: 1,
			mapTypeId: "be",
			tripDuration: 90,
			cityStayScore: 12
		}));

		const message = singleMessage(click);
		expect(message.method).toBe("followUp");
		expect(embedsOf(message)[0].description?.split("\n\n")[1]).toContain("**12** points");
		expect(command.interaction.messages).toEqual([]);
	});
});

function completedMission(missionType: MissionType, rewards: Partial<CompletedMission> = {}): CompletedMission {
	return {
		missionId: "anyFight",
		missionObjective: 3,
		missionVariant: 0,
		numberDone: 3,
		missionType,
		pointsToWin: 0,
		xpToWin: 0,
		gemsToWin: 0,
		moneyToWin: 0,
		...rewards
	};
}

describe("missions", () => {
	it("lists a single completed mission without total", async () => {
		const { embed } = await postedEvent(makePacket(MissionsCompletedPacket, {
			keycloakId: "Hero-keycloak-id",
			missions: [completedMission(MissionType.DAILY, { gemsToWin: 2 })]
		}));

		expect(embed.title).toContain("Hero");
		expect(embed.fields).toHaveLength(1);
		expect(embed.fields?.[0].value).toContain("Faire 3 combats");
	});

	it("groups the completed missions by kind and sums their rewards", async () => {
		const { embed } = await postedEvent(makePacket(MissionsCompletedPacket, {
			keycloakId: "Hero-keycloak-id",
			missions: [
				completedMission(MissionType.CAMPAIGN, { moneyToWin: 100 }),
				completedMission(MissionType.NORMAL, { moneyToWin: 50 }),
				completedMission(MissionType.NORMAL, { xpToWin: 30 })
			],
			nextCampaignMission: completedMission(MissionType.CAMPAIGN)
		}));

		expect(embed.fields).toHaveLength(4);
		expect(embed.fields?.[1].value.split("\n")).toHaveLength(2);
		const total = embed.fields?.[2].value.split("\n") ?? [];
		expect(total).toHaveLength(2);
		expect(total[0]).toContain("150");
		expect(total[1]).toContain("30");
	});

	it("tells when several completed missions brought no reward", async () => {
		const { embed } = await postedEvent(makePacket(MissionsCompletedPacket, {
			keycloakId: "Hero-keycloak-id",
			missions: [completedMission(MissionType.NORMAL), completedMission(MissionType.NORMAL)]
		}));

		expect(embed.fields?.at(-1)?.value.split("\n")).toHaveLength(1);
	});

	it("skips the notification of a player deleted from keycloak", async () => {
		const {
			interaction, context
		} = fakeCommand("Hero");
		await dispatch(context, makePacket(MissionsCompletedPacket, {
			keycloakId: "deleted-keycloak-id",
			missions: [completedMission(MissionType.DAILY)]
		}));

		expect(interaction.messages).toEqual([]);
	});

	it("lists the expired missions with their progress", async () => {
		const { embed } = await postedEvent(makePacket(MissionsExpiredPacket, {
			keycloakId: "Hero-keycloak-id",
			missions: [
				{
					...completedMission(MissionType.NORMAL), numberDone: 1
				}
			]
		}));

		expect(embed.description).toContain("(1/3)");
	});
});

describe("player events", () => {
	it("announces the knock-out in the channel and in private", async () => {
		const {
			interaction, context
		} = fakeCommand("Hero");
		const privateMessages: unknown[] = [];
		Object.assign(interaction.user, {
			send: (payload: unknown): Promise<void> => {
				privateMessages.push(payload);
				return Promise.resolve();
			}
		});

		await dispatch(context, makePacket(PlayerDeathPacket, {}));

		expect(embedsOf(singleMessage(interaction))[0].color).toBe(ERROR_COLOR);
		expect(privateMessages).toHaveLength(1);
	});

	it.each([
		[0, false],
		[40, true]
	])("tells what leaving the island cost (%i guild points)", async (guildPointsLost, malusShown) => {
		const { embed } = await postedEvent(makePacket(PlayerLeavePveIslandPacket, {
			moneyLost: 120, guildPointsLost
		}));

		expect(embed.description).toContain("120");
		expect(embed.description?.includes("Points de guilde perdus : **40**")).toBe(malusShown);
	});

	it("lists the rewards of a level up", async () => {
		const { embed } = await postedEvent(makePacket(PlayerLevelUpPacket, {
			keycloakId: "Hero-keycloak-id",
			level: 10,
			fightUnlocked: true,
			guildUnlocked: false,
			healthRestored: true,
			classesTier1Unlocked: false,
			classesTier2Unlocked: true,
			classesTier3Unlocked: false,
			classesTier4Unlocked: false,
			classesTier5Unlocked: false,
			missionSlotUnlocked: false,
			pveUnlocked: false,
			statsIncreased: false
		}));

		const [level, ...rewards] = embed.description?.split("\n").filter(line => line !== "") ?? [];
		expect(level).toContain("niveau **10**");
		expect(rewards).toHaveLength(3);
		expect(rewards[0]).toContain("Combats débloqués avec les commandes </fight:0>");
		expect(rewards[1]).toContain("Votre vie a été restaurée.");
		expect(rewards[2]).toContain("Classes de palier 2 débloquées");
	});

	it.each([
		[{
			giveInGuild: true, giveInPlayerInv: false, noRoomInGuild: false
		}, undefined],
		[{
			giveInGuild: false, giveInPlayerInv: true, noRoomInGuild: false
		}, undefined],
		[{
			giveInGuild: false, giveInPlayerInv: false, noRoomInGuild: true
		}, ERROR_COLOR]
	])("tells where the received pet goes (%o)", async (destination, color) => {
		const { embed } = await postedEvent(makePacket(PlayerReceivePetPacket, {
			...destination, petTypeId: 1, petSex: "m"
		}));

		expect(embed.color).toBe(color);
	});

	it("tells that a different text describes each destination of a received pet", async () => {
		const descriptions = new Set<string | undefined>();
		for (const destination of [
			{
				giveInGuild: true, giveInPlayerInv: false
			},
			{
				giveInGuild: false, giveInPlayerInv: true
			},
			{
				giveInGuild: false, giveInPlayerInv: false
			}
		]) {
			const { embed } = await postedEvent(makePacket(PlayerReceivePetPacket, {
				...destination, noRoomInGuild: false, petTypeId: 1, petSex: "m"
			}));
			descriptions.add(embed.description);
		}

		expect(descriptions.size).toBe(3);
	});
});

describe("guild events", () => {
	it("announces the new level of the guild", async () => {
		const { embed } = await postedEvent(makePacket(GuildLevelUpPacket, {
			guildName: "TheGuild", level: 7
		}));

		expect(embed.title).toContain("TheGuild");
		expect(embed.description).toContain("**7**");
	});

	it("tells which food the guild received", async () => {
		const { embed } = await postedEvent(makePacket(GiveFoodToGuildPacket, {
			quantity: 3, selectedFoodIndex: PetConstants.PET_FOOD_BY_ID.indexOf(PetConstants.PET_FOOD.HERBIVOROUS_FOOD)
		}));

		expect(embed.description).toContain("3");
	});

	it("tells that the guild storage is full", async () => {
		const { embed } = await postedEvent(makePacket(NoFoodSpaceInGuildPacket, {
			food: PetConstants.PET_FOOD.COMMON_FOOD, quantity: 4
		}));

		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain("4");
	});
});

describe("king's challenge", () => {
	const reward = {
		money: 300, tokens: 2, gems: 1
	};

	it("gives the points to the next tier and reminds a player full of tokens to use them", async () => {
		const { embed } = await postedEvent(makePacket(KingChallengeTierReachedPacket, {
			keycloakId: "Hero-keycloak-id",
			tier: 2,
			crossedTiers: 1,
			reward,
			pointsToNextTier: 450,
			ownedTokens: TokensConstants.MAX
		}));

		const lines = embed.description?.split("\n") ?? [];
		expect(lines).toHaveLength(3);
		expect(lines[0]).toContain("300");
		expect(lines[1]).toContain("450");
	});

	it("congratulates the player who completed the challenge", async () => {
		const { embed } = await postedEvent(makePacket(KingChallengeTierReachedPacket, {
			keycloakId: "Hero-keycloak-id",
			tier: 5,
			crossedTiers: 2,
			reward,
			ownedTokens: 0
		}));

		expect(embed.description?.split("\n")).toHaveLength(2);
	});
});

describe("quests", () => {
	const steps = QuestConstants.STEPS[QUEST_IDS.SEEDS].length;

	it.each([
		[1, 3],
		[2, 2],
		[steps, 2]
	])("describes the quest after %i steps", async (stepsDone, descriptionParts) => {
		const { embed } = await postedEvent(makePacket(QuestUpdatedPacket, {
			keycloakId: "Hero-keycloak-id",
			quest: {
				questId: QUEST_IDS.SEEDS, stepsDone
			}
		}));

		expect(embed.title).toContain("Hero");
		expect(embed.fields).toHaveLength(3);
		expect(embed.description?.split("\n").filter(line => line !== "").length).toBeGreaterThanOrEqual(descriptionParts);
	});

	it("titles differently the obtained, progressed and completed quests", async () => {
		const titles = new Set<string | undefined>();
		for (const stepsDone of [1, 2, steps]) {
			const { embed } = await postedEvent(makePacket(QuestUpdatedPacket, {
				keycloakId: "Hero-keycloak-id",
				quest: {
					questId: QUEST_IDS.SEEDS, stepsDone
				}
			}));
			titles.add(embed.title);
		}

		expect(titles.size).toBe(3);
	});
});
