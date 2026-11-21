import {
	beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", async () => (await import("../../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../../src/packetHandlers/handlers/ReactionCollectorHandlers";
import "../../../src/packetHandlers/handlers/FightHandler";
import { buildFightConfirmationDescription } from "../../../src/commands/player/FightCommand";
import { PacketUtils } from "../../../src/utils/PacketUtils";
import {
	ReactionCollectorFight, ReactionCollectorFightData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorFight";
import { ReactionCollectorReactPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CommandFightRefusePacketRes } from "../../../../Lib/src/packets/commands/CommandFightPacket";
import { CommandFightCancelPacketReq } from "../../../../Lib/src/packets/commands/CommandFightCancelPacket";
import { CommandFightIntroduceFightersPacket } from "../../../../Lib/src/packets/fights/FightIntroductionPacket";
import { CommandFightEndOfFightPacket } from "../../../../Lib/src/packets/fights/EndOfFightPacket";
import { FightRewardPacket } from "../../../../Lib/src/packets/fights/FightRewardPacket";
import { KingGuardFightRewardPacket } from "../../../../Lib/src/packets/fights/KingGuardFightRewardPacket";
import { CommandFightStatusPacket } from "../../../../Lib/src/packets/fights/FightStatusPacket";
import { FightPlayerStats } from "../../../../Lib/src/types/FightPlayerStats";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { KingGuardIdentity } from "../../../../Lib/src/utils/KingGuardIdentity";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	clickOn, collectorPacket, componentsOf, dispatch, embedsOf, ERROR_COLOR, fakeClick, fakeCommand, FakeInteraction,
	lastMessage, RenderedEmbed, sentPackets, setupRendering, singleMessage
} from "../../mocks/DiscordRenderHarness";
import { knownPlayers } from "../../mocks/DiscordRenderMocks";
import frenchCommands from "../../../../Lang/fr/commands.json";

beforeAll(() => {
	setupRendering();
	knownPlayers.set("rival-keycloak-id", "Rival");
});

beforeEach(() => {
	vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
});

function playerStats(pet?: FightPlayerStats["pet"]): FightPlayerStats {
	return {
		classId: 21,
		fightRanking: { glory: 1869 },
		energy: {
			value: 1869,
			max: 1869
		},
		attack: 549,
		defense: 641,
		speed: 512,
		breath: {
			base: 17,
			max: 17,
			regen: 3
		},
		...pet ? { pet } : {}
	};
}

describe("buildFightConfirmationDescription", () => {
	it("renders the glory icon and its numeric value in the confirmation message", () => {
		const data = { playerStats: playerStats() } satisfies ReactionCollectorFightData;

		const description = buildFightConfirmationDescription("fr", "Jack", data, "common");

		expect(description).not.toContain("NaN");
		expect(description).toContain(CrowniclesIcons.unitValues.glory);
		expect(description).toMatch(/1\D869/);
	});
});

async function openFight(stats = playerStats()): Promise<{
	interaction: FakeInteraction; context: PacketContext;
}> {
	const command = fakeCommand("Fighter");
	await dispatch(command.context, collectorPacket(new ReactionCollectorFight(stats)));
	return command;
}

describe("fight confirmation", () => {
	it("asks the fighter to confirm with the fight buttons", async () => {
		const { interaction } = await openFight();

		const message = singleMessage(interaction);
		expect(embedsOf(message)[0].author?.name).toContain("Fighter");
		expect(componentsOf(message).map(button => button.custom_id)).toEqual(["accept", "refuse"]);
	});

	it("strikes through the pet when it is on expedition", async () => {
		const pet = {
			petTypeId: 1,
			petSex: "m",
			petNickname: "Rex",
			isOnExpedition: false
		} as const;
		const atHome = await openFight(playerStats(pet));
		const away = await openFight(playerStats({
			...pet,
			isOnExpedition: true
		}));

		expect(embedsOf(singleMessage(atHome.interaction))[0].description).not.toContain("~~");
		expect(embedsOf(singleMessage(away.interaction))[0].description).toMatch(/~~[^~]*Rex[^~]*~~/);
	});

	it("displays the cancellation of the fight in the reply to the refuse click", async () => {
		const { interaction } = await openFight();
		const click = fakeClick(interaction.user, "refuse");

		await clickOn(interaction.collectors[0], click);
		const [reaction] = sentPackets(ReactionCollectorReactPacket);
		await dispatch(reaction.context, makePacket(CommandFightRefusePacketRes, {}));

		const [embed] = embedsOf(singleMessage(click));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toBe("Vous avez annulé la recherche de combat.");
	});
});

function introduction(overrides: Partial<CommandFightIntroduceFightersPacket> = {}): CommandFightIntroduceFightersPacket {
	return makePacket(CommandFightIntroduceFightersPacket, {
		fightId: `fight-${Math.random()}`,
		fightInitiatorKeycloakId: "Fighter-keycloak-id",
		fightOpponentKeycloakId: "rival-keycloak-id",
		fightInitiatorActions: [["simpleAttack", 2], ["quickAttack", 1], ["heavyAttack", 4]],
		fightOpponentActions: [["simpleAttack", 2]],
		...overrides
	});
}

function introOf(interaction: FakeInteraction): RenderedEmbed {
	const intro = interaction.messages.find(message => message.method === "editReply" || message.method === "channel.send");
	if (!intro) {
		throw new Error("The fight intro was not displayed");
	}
	return embedsOf(intro)[0];
}

describe("fight introduction", () => {
	it("introduces both fighters in the reply to the accept click, and opens the fight messages", async () => {
		const { interaction } = await openFight();
		const click = fakeClick(interaction.user, "accept");
		await clickOn(interaction.collectors[0], click);
		const [reaction] = sentPackets(ReactionCollectorReactPacket);

		await dispatch(reaction.context, introduction());

		const [intro] = embedsOf(singleMessage(click));
		expect(intro.author?.name).toContain("Un combat est lancé entre Fighter et Rival");
		const [initiator, opponent] = intro.fields ?? [];
		expect(initiator.value.split("\n")).toHaveLength(4);
		// The opponent column is padded to stay aligned with the longest list of actions
		expect(opponent.value.split("\n")).toHaveLength(4);
		expect(opponent.value).toContain("Attaques de Rival");
		expect(interaction.messages.filter(message => message.method === "channel.send")).toHaveLength(3);
	});

	it("names a monster or a king guard opponent and shows the pets of the fighters", async () => {
		const monster = fakeCommand("Fighter");
		const guard = fakeCommand("Fighter");
		const pet = {
			typeId: 1,
			nickname: "Rex",
			rarity: 1,
			sex: "m",
			loveLevel: 3,
			force: 10,
			feedDelay: 0
		} as const;

		await dispatch(monster.context, introduction({
			fightOpponentKeycloakId: undefined,
			fightOpponentMonsterId: "crocodile",
			fightInitiatorPet: pet
		}));
		await dispatch(guard.context, introduction({ fightOpponentKeycloakId: KingGuardIdentity.toKeycloakId(1) }));

		const monsterIntro = introOf(monster.interaction);
		expect(monsterIntro.author?.name).not.toContain("crocodile");
		expect(monsterIntro.fields?.[0].value).toContain("Familier de Fighter");
		expect(introOf(guard.interaction).author?.name).toContain("Garde Raimonde");
	});

	it("introduces a friendly fight in the command reply with the level cap", async () => {
		const {
			interaction, context
		} = fakeCommand("Fighter");

		await dispatch(context, introduction({
			friendly: true,
			levelCap: 100
		}));

		expect(interaction.messages[0].method).toBe("editReply");
		expect(introOf(interaction).author?.name).toContain("ramenés au niveau 100");
	});

	it("cancels a fight whose introduction cannot be displayed and ignores its next packets", async () => {
		const {
			context, discord
		} = fakeCommand("Fighter");
		const orphanContext = {
			...context,
			discord: {
				...discord,
				interaction: "forgotten-interaction"
			}
		};
		const fight = introduction();

		await dispatch(orphanContext, fight);
		await dispatch(orphanContext, Object.assign(new CommandFightStatusPacket(), { fightId: fight.fightId }));

		const cancels = sentPackets(CommandFightCancelPacketReq);
		expect(cancels).toHaveLength(1);
		expect(cancels[0].packet.fightId).toBe(fight.fightId);
	});
});

function fighter(keycloakId: string, finalEnergy: number): CommandFightEndOfFightPacket["winner"] {
	return {
		keycloakId,
		finalEnergy,
		maxEnergy: 1000
	};
}

describe("end of fight", () => {
	it.each([
		[false, "remporte le match contre"],
		[true, "égalité"]
	])("titles the outcome (draw: %s) and reacts with a handshake", async (draw, expected) => {
		const {
			interaction, context
		} = fakeCommand("Fighter");

		await dispatch(context, makePacket(CommandFightEndOfFightPacket, {
			winner: fighter("Fighter-keycloak-id", 400),
			looser: fighter("rival-keycloak-id", 0),
			draw,
			turns: 12,
			maxTurns: 40
		}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.title).toContain(expected);
		expect(embed.description).toContain("12/40");
		expect(embed.description).toContain("Statistiques de Rival");
		expect(interaction.reactions).toEqual([CrowniclesIcons.fightCommand.handshake]);
	});

	it.each([
		[40, false],
		[41, true]
	])("mentions the overtime only once the turns exceed the limit (%s turns)", async (turns, overtime) => {
		const {
			interaction, context
		} = fakeCommand("Fighter");

		await dispatch(context, makePacket(CommandFightEndOfFightPacket, {
			winner: fighter("Fighter-keycloak-id", 400),
			looser: fighter("rival-keycloak-id", 0),
			draw: false,
			turns,
			maxTurns: 40
		}));

		const { description } = embedsOf(singleMessage(interaction))[0];
		expect(description).toContain(`${turns}/40`);
		expect(description?.includes("(prolongations)")).toBe(overtime);
	});
});

function reward(overrides: Partial<FightRewardPacket> = {}): FightRewardPacket {
	return makePacket(FightRewardPacket, {
		points: 0,
		money: 0,
		player1: {
			keycloakId: "Fighter-keycloak-id",
			oldGlory: 1000,
			newGlory: 1020,
			oldLeagueId: 2,
			newLeagueId: 2
		},
		player2: {
			keycloakId: "rival-keycloak-id",
			oldGlory: 1010,
			newGlory: 990,
			oldLeagueId: 2,
			newLeagueId: 2
		},
		draw: false,
		winnerKeycloakId: "Fighter-keycloak-id",
		...overrides
	});
}

async function renderReward(packet: FightRewardPacket | KingGuardFightRewardPacket): Promise<RenderedEmbed> {
	const {
		interaction, context
	} = fakeCommand("Fighter");
	await dispatch(context, packet);
	return embedsOf(singleMessage(interaction))[0];
}

describe("fight reward", () => {
	it("shows the glory won and lost, without reward field when nothing was won", async () => {
		const embed = await renderReward(reward());

		expect(embed.fields?.map(field => field.name)).toEqual(["Changements de gloire"]);
		expect(embed.fields?.[0].value).toBe("**Fighter :** + 20 ✨\n**Rival :** - 20 ✨\n".replaceAll("✨", CrowniclesIcons.unitValues.glory));
	});

	it("shows only the rewards actually won", async () => {
		const embed = await renderReward(reward({ money: 150 }));

		const rewards = embed.fields?.find(field => field.name === "Récompenses du combat");
		expect(rewards?.value).toContain("150");
		expect(rewards?.value).not.toContain("Points");
	});

	it("shows the league changes of both players", async () => {
		const embed = await renderReward(reward({
			player1: {
				keycloakId: "Fighter-keycloak-id",
				oldGlory: 1000,
				newGlory: 1100,
				oldLeagueId: 2,
				newLeagueId: 3
			},
			player2: {
				keycloakId: "rival-keycloak-id",
				oldGlory: 1010,
				newGlory: 900,
				oldLeagueId: 2,
				newLeagueId: 1
			}
		}));

		const leagues = embed.fields?.find(field => field.name === "Changements de ligues")?.value.split("\n").filter(Boolean);
		expect(leagues).toHaveLength(2);
		expect(leagues?.[0]).toContain(CrowniclesIcons.other.leagueUp);
		expect(leagues?.[1]).toContain(CrowniclesIcons.other.leagueDown);
	});

	it("tells how the pet reacted when its love grew", async () => {
		const embed = await renderReward(reward({
			petLoveChange: {
				keycloakId: "Fighter-keycloak-id",
				loveChange: 2,
				reactionType: PetConstants.POST_FIGHT_REACTION_TYPES.LOVE_GAIN,
				petId: 1,
				petSex: "f",
				petNickname: "Kiki"
			}
		}));

		expect(embed.fields?.find(field => field.name === "Relation avec le familier")?.value).toContain("Kiki");
	});

	it.each([
		["sameElo", 1000, 1010, "Fighter-keycloak-id"],
		["higherEloWins", 1500, 1000, "Fighter-keycloak-id"],
		["lowestEloWins", 1500, 1000, "rival-keycloak-id"]
	])("sums the fight up with a %s sentence", async (recap, fighterGlory, rivalGlory, winnerKeycloakId) => {
		const embed = await renderReward(reward({
			player1: {
				keycloakId: "Fighter-keycloak-id",
				oldGlory: fighterGlory,
				newGlory: fighterGlory,
				oldLeagueId: 1,
				newLeagueId: 1
			},
			player2: {
				keycloakId: "rival-keycloak-id",
				oldGlory: rivalGlory,
				newGlory: rivalGlory,
				oldLeagueId: 1,
				newLeagueId: 1
			},
			winnerKeycloakId
		}));

		const [winner, loser] = winnerKeycloakId === "rival-keycloak-id" ? ["Rival", "Fighter"] : ["Fighter", "Rival"];
		const sentences = ((frenchCommands.fight.fightReward as Record<string, unknown>)[recap] as string[]).map(sentence => sentence
			.replaceAll("{{winner}}", winner)
			.replaceAll("{{loser}}", loser)
			.replaceAll("{{player1}}", "Fighter")
			.replaceAll("{{player2}}", "Rival"));
		expect(sentences).toContain(embed.description);
	});
});

describe("king guard fight reward", () => {
	it.each([
		[{
			won: true, draw: false
		}, "et l'a vaincue"],
		[{
			won: false, draw: true
		}, "sans parvenir à la départager"],
		[{
			won: false, draw: false
		}, "et a été vaincu"]
	])("recounts the fight against a female guard (%o)", async (outcome, expected) => {
		const embed = await renderReward(makePacket(KingGuardFightRewardPacket, {
			points: 30,
			money: 0,
			...outcome,
			guard: {
				id: 1,
				sex: "f"
			}
		}));

		expect(embed.description).toContain("Raimonde");
		expect(embed.description).toContain(expected);
		expect(embed.fields?.[0].value).toContain("30");
	});
});
