import {
	beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/commands/pet/PetCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/pet/PetNickCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/pet/PetExpeditionPacketHandlers";
import { PacketUtils } from "../../src/utils/PacketUtils";
import {
	CommandPetCaressPacketReq, CommandPetPacketRes, PetExpeditionInfo
} from "../../../Lib/src/packets/commands/CommandPetPacket";
import { CommandPetNickPacketRes } from "../../../Lib/src/packets/commands/CommandPetNickPacket";
import {
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionErrorPacket,
	CommandPetExpeditionPacketReq,
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	ExpeditionInProgressData
} from "../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { makePacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { OwnedPet } from "../../../Lib/src/types/OwnedPet";
import { PetBasicInfo } from "../../../Lib/src/types/PetBasicInfo";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../Lib/src/constants/ExpeditionConstants";
import { getPetExpeditionPreferences } from "../../../Lib/src/constants/PetExpeditionPreferences";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	answeredClick, clickOn, componentsOf, dispatch, embedsOf, ERROR_COLOR, fakeClick, fakeCommand, lastMessage, sentPackets,
	setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";
import { knownPlayers } from "../mocks/DiscordRenderMocks";

beforeAll(() => {
	setupRendering();
	knownPlayers.set("neighbour-keycloak-id", "Neighbour");
});

beforeEach(() => {
	vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
});

const PET: OwnedPet = {
	typeId: 1,
	nickname: "Rex",
	rarity: 2,
	sex: "m",
	loveLevel: 4,
	force: 80,
	feedDelay: 0
};

const PET_INFO: PetBasicInfo = {
	petTypeId: 1,
	petSex: "f",
	petNickname: "Kiki"
};

function expeditionInfo(overrides: Partial<PetExpeditionInfo> = {}): PetExpeditionInfo {
	const now = Date.now();
	return {
		startTime: now - 60_000,
		endTime: now + 3_600_000,
		riskRate: 10,
		difficulty: 10,
		locationType: ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST,
		mapLocationId: 1,
		foodConsumed: 2,
		...overrides
	};
}

describe("pet", () => {
	it("shows the own pet of the player with the caress and expedition buttons", async () => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, makePacket(CommandPetPacketRes, { pet: PET }));

		const message = singleMessage(interaction);
		const [embed] = embedsOf(message);
		expect(embed.author?.name).toBe("Familier de Owner :");
		expect(embed.description).toContain("Rex");
		expect(componentsOf(message).map(button => button.custom_id)).toEqual(["pet_the_pet", "pet_expedition"]);
	});

	it("shows the pet of another player without any button", async () => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, makePacket(CommandPetPacketRes, {
			pet: PET,
			askedKeycloakId: "neighbour-keycloak-id"
		}));

		const message = singleMessage(interaction);
		expect(embedsOf(message)[0].author?.name).toBe("Familier de Neighbour :");
		expect(componentsOf(message)).toEqual([]);
	});

	it("tells where the pet explores and disables the caress during an expedition", async () => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, makePacket(CommandPetPacketRes, {
			pet: PET,
			expeditionInProgress: expeditionInfo()
		}));

		const message = singleMessage(interaction);
		expect(embedsOf(message)[0].description).toContain(CrowniclesIcons.expedition.locations.forest);
		const [caress, expedition] = componentsOf(message);
		expect(caress.disabled).toBe(true);
		expect(expedition.disabled).toBeFalsy();
	});

	it.each([
		[{ riskRate: 10 }, { force: 80 }],
		[{ riskRate: 80 }, { force: 80 }],
		[{ riskRate: 10 }, { force: 20 }],
		[{ difficulty: 90 }, { force: 20 }]
	])("describes an expedition (%o) of a pet (%o)", async (expedition, pet) => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, makePacket(CommandPetPacketRes, {
			pet: {
				...PET, ...pet
			},
			expeditionInProgress: expeditionInfo({
				...expedition,
				startTime: Date.now() - 3_000_000,
				endTime: Date.now() + 100_000,
				foodConsumed: 0
			})
		}));

		expect(embedsOf(singleMessage(interaction))[0].description?.split("\n").length).toBeGreaterThan(4);
	});

	it("caresses the pet once", async () => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, makePacket(CommandPetPacketRes, { pet: PET }));
		const click = fakeClick(interaction.user, "pet_the_pet");

		await clickOn(interaction.collectors[0], click);

		expect(sentPackets(CommandPetCaressPacketReq)).toHaveLength(1);
		expect(lastMessage(click).payload).toMatchObject({ content: expect.stringContaining("Rex") });
	});

	it("asks Core for the expedition menu", async () => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, makePacket(CommandPetPacketRes, { pet: PET }));

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "pet_expedition"));

		expect(sentPackets(CommandPetExpeditionPacketReq)).toHaveLength(1);
	});
});

describe("pet nickname", () => {
	it.each([
		[{ foundPet: false }, ERROR_COLOR, "familier"],
		[{
			foundPet: true, nickNameIsAcceptable: false
		}, ERROR_COLOR, "Entre 3 et 16 caractères"],
		[{
			foundPet: true, nickNameIsAcceptable: true
		}, undefined, "n'a désormais plus de surnom"],
		[{
			foundPet: true, nickNameIsAcceptable: true, newNickname: "Fluffy"
		}, undefined, "**Fluffy**"]
	])("answers the renaming %o", async (packet, color, expected) => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandPetNickPacketRes, packet));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(color);
		expect(embed.description).toContain(expected);
	});
});

function inProgress(overrides: Partial<ExpeditionInProgressData> = {}): ExpeditionInProgressData {
	return {
		id: "expedition",
		durationMinutes: 60,
		displayDurationMinutes: 60,
		riskRate: 10,
		difficulty: 10,
		locationType: ExpeditionConstants.EXPEDITION_LOCATION_TYPES.MOUNTAIN,
		mapLocationId: 1,
		startTime: Date.now() - 60_000,
		endTime: Date.now() + 3_540_000,
		status: "inProgress",
		pet: PET_INFO,
		foodConsumed: 1,
		...overrides
	} as ExpeditionInProgressData;
}

describe("pet expedition status", () => {
	it("explains that the talisman is missing", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: false,
			hasExpeditionInProgress: false,
			canStartExpedition: false,
			pet: PET_INFO
		}));

		const message = singleMessage(interaction);
		expect(message.method).toBe("followUp");
		expect(embedsOf(message)[0].color).toBe(ERROR_COLOR);
	});

	it("describes the expedition in progress", async () => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: true,
			expeditionInProgress: inProgress(),
			canStartExpedition: false
		}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.author?.name).toBe("Owner, expédition en cours");
		expect(embed.description).toContain(CrowniclesIcons.expedition.locations.mountain);
	});

	it("asks Core to resolve an expedition already over instead of displaying it", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: true,
			expeditionInProgress: inProgress({ endTime: Date.now() - 1000 }),
			canStartExpedition: false
		}));

		expect(interaction.messages).toEqual([]);
		expect(sentPackets(CommandPetExpeditionResolvePacketReq)).toHaveLength(1);
	});

	it.each([
		["insufficientLove", 2],
		["petHungry", 1],
		["notOnContinent", 1]
	])("explains why the expedition cannot start (%s)", async (cannotStartReason, paragraphs) => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: false,
			canStartExpedition: false,
			cannotStartReason,
			petLovePoints: 12,
			pet: PET_INFO
		}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description?.split("\n\n")).toHaveLength(paragraphs);
	});

	// Bug: "noPet" is drawn among the sexed random texts (noPet_male / noPet_female) while its French texts have no sex variant: the display throws and the player sees nothing (ExpeditionEmbedBuilders.ts getCannotStartDescription)
	it.fails("tells a player who lost his pet that he has none to send", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: false,
			canStartExpedition: false,
			cannotStartReason: ExpeditionConstants.ERROR_CODES.NO_PET
		}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain("familier");
	});

	it("leaves the display to the collector Core sends when the expedition can start", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: false,
			canStartExpedition: true
		}));

		expect(interaction.messages).toEqual([]);
	});
});

describe("pet expedition answers", () => {
	it("announces the departure in the reply to the selection, with the food and speed warnings", async () => {
		const command = fakeCommand("Owner");
		const {
			click, context
		} = answeredClick(command);

		await dispatch(context, makePacket(CommandPetExpeditionChoicePacketRes, {
			success: true,
			expedition: inProgress({ durationMinutes: 30 }),
			originalDisplayDurationMinutes: 60,
			insufficientFood: true,
			insufficientFoodCause: "guildNoFood"
		}));

		const [embed] = embedsOf(singleMessage(click));
		expect(embed.author?.name).toBe("Owner, expédition lancée !");
		expect(embed.description).toContain("court de provisions");
		expect(embed.description).toContain("bien plus vite que prévu");
		expect(command.interaction.messages).toEqual([]);
	});

	it("displays the failure of the departure", async () => {
		const command = fakeCommand();
		const {
			click, context
		} = answeredClick(command);

		await dispatch(context, makePacket(CommandPetExpeditionChoicePacketRes, {
			success: false,
			failureReason: "alreadyInExpedition"
		}));

		expect(embedsOf(singleMessage(click))[0].description).toContain("arpente déjà des contrées lointaines");
	});

	it.each([
		[makePacket(CommandPetExpeditionCancelPacketRes, {
			loveLost: 3, isFreeCancellation: false, pet: PET_INFO
		}), "Owner, départ annulé", "confiance"],
		[makePacket(CommandPetExpeditionCancelPacketRes, {
			loveLost: 0, isFreeCancellation: true, pet: PET_INFO
		}), "Owner, départ annulé", "prochaines annulations"],
		[makePacket(CommandPetExpeditionRecallPacketRes, {
			loveLost: 5, pet: PET_INFO
		}), "Owner, familier rappelé", "revient vers vous"]
	])("tells how the pet takes the end of its expedition (%o)", async (packet, title, reaction) => {
		const command = fakeCommand("Owner");
		const {
			click, context
		} = answeredClick(command);

		await dispatch(context, packet);

		const [embed] = embedsOf(singleMessage(click));
		expect(embed.author?.name).toBe(title);
		expect(embed.description).toContain("Kiki");
		expect(embed.description).toContain(reaction);
	});

	it("posts in the channel an answer to a click already replied", async () => {
		const command = fakeCommand();
		const {
			click, context
		} = answeredClick(command);
		click.replied = true;

		await dispatch(context, makePacket(CommandPetExpeditionErrorPacket, { errorCode: "invalidState" }));

		expect(click.messages).toEqual([]);
		const message = singleMessage(command.interaction);
		expect(message.method).toBe("channel.send");
		expect(embedsOf(message)[0].description).toContain("Les astres ne sont pas alignés");
	});
});

const PET_PREFERENCES = getPetExpeditionPreferences(PET_INFO.petTypeId);

function resolution(overrides: Partial<CommandPetExpeditionResolvePacketRes>, locationType: ExpeditionLocationType): CommandPetExpeditionResolvePacketRes {
	return makePacket(CommandPetExpeditionResolvePacketRes, {
		success: true,
		partialSuccess: false,
		totalFailure: false,
		loveChange: 2,
		pet: PET_INFO,
		expedition: {
			id: "expedition",
			durationMinutes: 60,
			displayDurationMinutes: 60,
			riskRate: 10,
			difficulty: 10,
			wealthRate: 1,
			locationType,
			mapLocationId: 1
		},
		petLikedExpedition: false,
		...overrides
	});
}

async function renderResolution(packet: CommandPetExpeditionResolvePacketRes): Promise<string> {
	const command = fakeCommand("Owner");
	const {
		click, context
	} = answeredClick(command);
	await dispatch(context, packet);
	const [embed] = embedsOf(singleMessage(click));
	return `${embed.author?.name}\n${embed.description}`;
}

describe("pet expedition resolution", () => {
	it("lists every reward brought back by a successful expedition the pet liked", async () => {
		const text = await renderResolution(resolution({
			rewards: {
				money: 150,
				experience: 80,
				points: 40,
				tokens: 2,
				itemGiven: true,
				cloneTalismanFound: true,
				materialLoot: [
					{
						materialId: 1, quantity: 2
					}
				]
			},
			badgeEarned: "expert_expediteur",
			petLikedExpedition: true
		}, PET_PREFERENCES?.liked[0] ?? ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST));

		expect(text).toContain("Owner, retour triomphal !");
		for (const reward of ["**150**", "**80**", "**40**", "Jetons gagnés : **2**", "équipement aléatoire", "DÉCOUVERTE EXCEPTIONNELLE", "Expéditeur Expert", "Chlorate de potassium"]) {
			expect(text).toContain(reward);
		}
		expect(text).not.toContain("n'a pas apprécié");
	});

	it("only lists the rewards actually won", async () => {
		const text = await renderResolution(resolution({
			rewards: {
				money: 150,
				experience: 0,
				points: 0
			}
		}, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST));

		expect(text).toContain("**150**");
		expect(text).not.toContain("Expérience gagnée");
		expect(text).not.toContain("Points gagnés");
	});

	it("warns that a disliked destination reduced a partial success", async () => {
		const disliked = PET_PREFERENCES?.disliked[0];
		expect(disliked).toBeDefined();
		const text = await renderResolution(resolution({
			success: false,
			partialSuccess: true,
			loveChange: -1,
			rewards: {
				money: 20,
				experience: 0,
				points: 0
			}
		}, disliked ?? ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST));

		expect(text).toContain("Owner, retour mitigé");
		expect(text).toContain("n'a pas apprécié cette destination");
	});

	it("brings back nothing from a total failure, even from a liked destination", async () => {
		const text = await renderResolution(resolution({
			success: false,
			totalFailure: true,
			loveChange: -3,
			petLikedExpedition: true
		}, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST));

		expect(text).toContain("Owner, expédition échouée");
		expect(text).not.toContain("Butin rapporté");
	});
});
