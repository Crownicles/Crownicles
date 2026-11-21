import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", async () => (await import("../../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../../src/packetHandlers/handlers/commands/player/ProfileCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/InventoryCommandPacketHandlers";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandProfilePacketRes } from "../../../../Lib/src/packets/commands/CommandProfilePacket";
import { CommandInventoryPacketRes } from "../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	clickOn, componentsOf, dispatch, embedsOf, ERROR_COLOR, fakeClick, fakeCommand, fakeUser, lastMessage, mainItem,
	RenderedEmbed, setupRendering, singleMessage, supportItem
} from "../../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

type ProfileData = CommandProfilePacketRes["playerData"];

function profileData(overrides: Partial<ProfileData> = {}): ProfileData {
	return {
		missions: {
			gems: 7,
			campaignProgression: 35
		},
		rank: {
			unranked: false,
			rank: 12,
			numberOfPlayers: 340,
			score: 4567
		},
		effect: {
			healed: false,
			timeLeft: 0,
			effect: "none",
			hasTimeDisplay: false
		},
		level: 23,
		badges: [],
		health: {
			value: 80,
			max: 120
		},
		experience: {
			value: 300,
			max: 900
		},
		money: 1500,
		kingChallengeTier: 2,
		...overrides
	};
}

async function renderProfile(data: ProfileData): Promise<{
	embed: RenderedEmbed; reactions: string[];
}> {
	const {
		interaction, context
	} = fakeCommand("Hero");
	await dispatch(context, makePacket(CommandProfilePacketRes, {
		keycloakId: context.keycloakId!,
		playerData: data
	}));
	const [embed] = embedsOf(singleMessage(interaction));
	return {
		embed, reactions: interaction.reactions
	};
}

function fieldValue(embed: RenderedEmbed, name: string): string | undefined {
	return embed.fields?.find(field => field.name.startsWith(name))?.value;
}

describe("profile", () => {
	it("titles the profile with the player name and level, and shows the minimal fields of a new player", async () => {
		const { embed } = await renderProfile(profileData());

		expect(embed.title).toBe("Hero | Niveau 23");
		expect(embed.fields?.map(field => field.name)).toEqual(["Informations :", "Missions :", "Classement et Score :"]);
		expect(fieldValue(embed, "Classement")).toContain("12 / 340");
		expect(fieldValue(embed, "Missions")).toContain("2/");
	});

	it("shows the tokens only when Core sends them", async () => {
		const withoutTokens = await renderProfile(profileData());
		const withTokens = await renderProfile(profileData({
			tokens: {
				value: 3,
				max: 25
			}
		}));

		expect(fieldValue(withoutTokens.embed, "Informations")).not.toContain("3 / 25");
		expect(fieldValue(withTokens.embed, "Informations")).toContain("3 / 25");
	});

	it("shows an unranked player without rank", async () => {
		const { embed } = await renderProfile(profileData({
			rank: {
				unranked: true,
				rank: -1,
				numberOfPlayers: 340,
				score: 0
			}
		}));

		expect(fieldValue(embed, "Classement")).toContain("Non classé");
		expect(fieldValue(embed, "Classement")).not.toContain("-1");
	});

	it("shows every optional field of an advanced player", async () => {
		const { embed } = await renderProfile(profileData({
			stats: {
				energy: {
					value: 90,
					max: 100
				},
				attack: 150,
				defense: 140,
				speed: 60,
				breath: {
					base: 2,
					max: 8,
					regen: 1
				}
			},
			effect: {
				healed: false,
				timeLeft: 3_600_000,
				effect: "sleeping",
				hasTimeDisplay: true
			},
			classId: 0,
			guild: "TheGuild",
			destinationId: 1,
			mapTypeId: "be",
			fightRanking: {
				glory: 1200,
				gloryRank: 4,
				numberOfFighters: 50,
				league: 2
			},
			pet: {
				typeId: 1,
				sex: "m",
				rarity: 3,
				nickname: "Rex"
			},
			cooking: {
				level: 12,
				grade: "cook",
				experience: {
					value: 40,
					max: 100
				}
			},
			color: "#ff0000"
		}));

		expect(embed.color).toBe(0xff0000);
		expect(embed.fields?.map(field => field.name)).toEqual([
			"Informations :",
			"Statistiques :",
			"Missions :",
			"Classement et Score :",
			"Temps restant :",
			"Classe :",
			"Guilde :",
			"Destination :",
			"Gloire et ligue :",
			"Familier :",
			"Cuisine :"
		]);
		expect(fieldValue(embed, "Temps restant")).toContain(CrowniclesIcons.effects.sleeping);
		expect(fieldValue(embed, "Guilde")).toContain("TheGuild");
		expect(fieldValue(embed, "Gloire")).toContain("4 / 50");
		expect(fieldValue(embed, "Familier")).toContain("Rex");
		expect(fieldValue(embed, "Cuisine")).toContain("Niveau 12 — Cuisinier");
	});

	it("shows a fighter without glory rank as unranked", async () => {
		const { embed } = await renderProfile(profileData({
			fightRanking: {
				glory: 100,
				gloryRank: -1,
				numberOfFighters: 50,
				league: 0
			}
		}));

		expect(fieldValue(embed, "Gloire")).toContain("Non classé");
	});

	it("tells a healed player that he can play again", async () => {
		const { embed } = await renderProfile(profileData({
			effect: {
				healed: true,
				timeLeft: 0,
				effect: "sleeping",
				hasTimeDisplay: true
			}
		}));

		expect(fieldValue(embed, "Temps restant")).toContain("Reprise du jeu possible");
		expect(embed.title).not.toContain(CrowniclesIcons.effects.sleeping);
	});

	it("reacts with each badge of the player", async () => {
		const { reactions } = await renderProfile(profileData({
			badges: [Badge.BOT_OWNER, Badge.SUPPORT]
		}));

		expect(reactions).toEqual([CrowniclesIcons.badges[Badge.BOT_OWNER], CrowniclesIcons.badges[Badge.SUPPORT]]);
	});

	it("only reacts with the badge list emote when the player has too many badges", async () => {
		const badges = Object.values(Badge).slice(0, Constants.PROFILE.MAX_EMOTE_DISPLAY_NUMBER);
		const { reactions } = await renderProfile(profileData({ badges }));

		expect(reactions).toEqual([CrowniclesIcons.profile.displayAllBadgeEmote]);
	});
});

type InventoryData = NonNullable<CommandInventoryPacketRes["data"]>;

function inventoryData(overrides: Partial<InventoryData> = {}): InventoryData {
	return {
		weapon: mainItem(ItemCategory.WEAPON, 0),
		armor: mainItem(ItemCategory.ARMOR, 0),
		potion: supportItem(ItemCategory.POTION, 0),
		object: supportItem(ItemCategory.OBJECT, 0),
		backupWeapons: [],
		backupArmors: [],
		backupPotions: [],
		backupObjects: [],
		slots: {
			weapons: 1,
			armors: 1,
			potions: 1,
			objects: 1
		},
		materials: [],
		...overrides
	};
}

async function renderInventory(data: InventoryData, talismans: Partial<CommandInventoryPacketRes> = {}): Promise<ReturnType<typeof fakeCommand>> {
	const command = fakeCommand("Hero");
	await dispatch(command.context, makePacket(CommandInventoryPacketRes, {
		foundPlayer: true,
		keycloakId: command.context.keycloakId!,
		data,
		...talismans
	}));
	return command;
}

describe("inventory", () => {
	it("opens on the equipped items with the buttons of the three other views", async () => {
		const { interaction } = await renderInventory(inventoryData());

		const message = singleMessage(interaction);
		const [embed] = embedsOf(message);
		expect(embed.title).toBe("Inventaire de Hero");
		expect(embed.fields).toHaveLength(5);
		expect(embed.fields?.[4].value).toContain("Aucun artefact");
		expect(componentsOf(message).map(button => button.custom_id)).toEqual(["viewBackup", "viewMaterials", "viewPlants"]);
	});

	it("lists every owned talisman", async () => {
		const { interaction } = await renderInventory(inventoryData(), {
			hasTalisman: true,
			hasRemoteHarvestTalisman: true
		});

		const talismans = embedsOf(singleMessage(interaction))[0].fields?.[4].value.split("\n");
		expect(talismans).toHaveLength(2);
		expect(talismans?.[1]).toContain("</garden:0>");
	});

	it("switches to the backup view, listing the empty slots and the categories without slot", async () => {
		const { interaction } = await renderInventory(inventoryData({
			backupWeapons: [
				{
					display: mainItem(ItemCategory.WEAPON, 1, { attack: 20 }),
					slot: 2
				}
			],
			slots: {
				weapons: 3,
				armors: 1,
				potions: 2,
				objects: 1
			}
		}));
		const click = fakeClick(interaction.user, "viewBackup");

		await clickOn(interaction.collectors[0], click);

		const update = lastMessage(click);
		const [embed] = embedsOf(update);
		expect(embed.title).toBe("Réserve d'objets de Hero");
		const [weapons, armors, potions] = embed.fields ?? [];
		expect(weapons.name).toBe("Arme (1/2) :");
		expect(weapons.value.split("\n").filter(line => line !== "")).toHaveLength(2);
		expect(weapons.value.split("\n")[0]).toContain("Emplacement vide");
		expect(armors.value).toContain("Aucun emplacement disponible");
		expect(potions.name).toBe("Potion (0/1) :");
		expect(componentsOf(update).map(button => button.custom_id)).toEqual(["viewEquipped", "viewMaterials", "viewPlants"]);
	});

	it("sorts the materials by name in the materials view", async () => {
		const { interaction } = await renderInventory(inventoryData({
			materials: [
				{
					materialId: 1,
					quantity: 4
				},
				{
					materialId: 2,
					quantity: 9
				}
			]
		}));
		const click = fakeClick(interaction.user, "viewMaterials");

		await clickOn(interaction.collectors[0], click);

		const [embed] = embedsOf(lastMessage(click));
		expect(embed.fields?.[0].name).toBe("Matériaux (2) :");
		const lines = embed.fields?.flatMap(field => field.value.split("\n")) ?? [];
		expect(lines).toHaveLength(2);
		const names = lines.map(line => line.split("**")[1]);
		expect([...names].sort((a, b) => a.localeCompare(b, "fr"))).toEqual(names);
		expect(lines.some(line => line.endsWith("x9"))).toBe(true);
	});

	it("tells a player without material nor plant that he has none", async () => {
		const { interaction } = await renderInventory(inventoryData());
		const materialsClick = fakeClick(interaction.user, "viewMaterials");
		const plantsClick = fakeClick(interaction.user, "viewPlants");

		await clickOn(interaction.collectors[0], materialsClick);
		await clickOn(interaction.collectors[0], plantsClick);

		expect(embedsOf(lastMessage(materialsClick))[0].fields?.[0].value).toContain("Aucun matériau");
		expect(embedsOf(lastMessage(plantsClick))[0].fields?.[0].value).toContain("Aucune plante transportée");
	});

	it("shows the plant slots and their link to the home chest", async () => {
		const { interaction } = await renderInventory(inventoryData({
			plants: {
				seed: 1,
				plantSlots: [
					{
						plantId: 2,
						slot: 1
					}
				],
				maxPlantSlots: 2,
				linkedToHomeStorage: true
			}
		}));
		const click = fakeClick(interaction.user, "viewPlants");

		await clickOn(interaction.collectors[0], click);

		const [seed, slots, link] = embedsOf(lastMessage(click))[0].fields ?? [];
		expect(seed.value).not.toContain("Emplacement vide");
		expect(slots.name).toContain("(1/2)");
		expect(slots.value.split("\n")[0]).toContain("Emplacement vide");
		expect(slots.value.split("\n")[1]).not.toContain("Emplacement vide");
		expect(link.name).toContain("Lien avec le coffre");
	});

	it("refuses the clicks of another player", async () => {
		const { interaction } = await renderInventory(inventoryData());
		const intruder = fakeClick(fakeUser("Intruder"), "viewBackup");

		await clickOn(interaction.collectors[0], intruder);

		expect(intruder.messages.map(message => message.method)).toEqual(["reply"]);
		expect(embedsOf(lastMessage(intruder))[0].color).toBe(ERROR_COLOR);
	});

	it("disables the buttons of the current view once the collector ends", async () => {
		const { interaction } = await renderInventory(inventoryData());

		interaction.collectors[0].stop();
		await new Promise(resolveEnd => setTimeout(resolveEnd, 0));

		const edition = lastMessage(interaction);
		expect(edition.method).toBe("message.edit");
		const buttons = componentsOf(edition);
		expect(buttons.map(button => button.custom_id)).toEqual(["viewBackup", "viewMaterials", "viewPlants"]);
		expect(buttons.every(button => button.disabled)).toBe(true);
	});

	it("shows an error to a player who does not exist", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandInventoryPacketRes, { foundPlayer: false }));

		expect(embedsOf(singleMessage(interaction))[0].color).toBe(ERROR_COLOR);
	});
});
