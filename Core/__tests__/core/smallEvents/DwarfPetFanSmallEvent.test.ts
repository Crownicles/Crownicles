import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/dwarfPetFan";
import { Maps } from "../../../src/core/maps/Maps";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { DwarfPetsSeen } from "../../../src/core/database/game/models/DwarfPetsSeen";
import { PetUtils } from "../../../src/core/utils/PetUtils";
import { PlayerBadgesManager } from "../../../src/core/database/game/models/PlayerBadges";
import { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import { SmallEventDwarfPetFanPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDwarfPetFanPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	asPlayer, createTestPlayer, packetOf, runSmallEvent, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

const DWARF = SmallEventConstants.DWARF_PET_FAN;
const NAMES = DWARF.INTERACTIONS_NAMES;
const PET_TYPE = 12;
const PET_INFO = {
	petTypeId: PET_TYPE, petSex: "f", petNickname: "Rex"
};

function mockPet(isFeisty = false): void {
	vi.spyOn(PetEntities, "getById").mockResolvedValue({
		typeId: PET_TYPE,
		isFeisty: () => isFeisty,
		getBasicInfo: () => PET_INFO
	} as never);
}

function onPath(startMap: number, endMap: number, onContinent = true): TestPlayer {
	vi.spyOn(Maps, "isOnContinent").mockReturnValue(onContinent);
	return Object.assign(createTestPlayer(), {
		getPreviousMap: () => ({ id: startMap }),
		getDestination: () => ({ id: endMap })
	});
}

describe("Talvar, the dwarf pet fan small event", () => {
	useSmallEventHarness();
	let player: TestPlayer;
	let missionUpdate: ReturnType<typeof vi.spyOn>;
	let addGems: ReturnType<typeof vi.fn>;
	let missionsInfoSave: ReturnType<typeof vi.fn>;

	async function meet(): Promise<CrowniclesPacket[]> {
		return (await runSmallEvent(smallEventFuncs, player)).response;
	}

	beforeEach(() => {
		player = createTestPlayer({ petId: 5 });
		missionUpdate = vi.spyOn(MissionsController, "update").mockResolvedValue(undefined as never);
		addGems = vi.fn().mockResolvedValue(undefined);
		missionsInfoSave = vi.fn().mockResolvedValue(undefined);
		vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({
			addGems, save: missionsInfoSave
		} as never);
		vi.spyOn(DwarfPetsSeen, "isAllPetSeen").mockResolvedValue(false);
		vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(false);
		vi.spyOn(DwarfPetsSeen, "markPetAsSeen").mockResolvedValue();
		vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);
		vi.spyOn(PetUtils, "isPetClone").mockResolvedValue(false);
		mockPet();
	});

	describe("availability", () => {
		it("happens on the continent on a path from or to Mount Celestrum", () => {
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM, 2)), {} as never)).toBe(true);
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(2, MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM)), {} as never)).toBe(true);
		});

		it("does not happen elsewhere", () => {
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(1, 2)), {} as never)).toBe(false);
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM, 2, false)), {} as never)).toBe(false);
		});

		it("does not happen when the path of the player is unknown", () => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			const celestrum = { id: MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM };
			expect(smallEventFuncs.canBeExecuted(asPlayer(Object.assign(createTestPlayer(), {
				getPreviousMap: () => celestrum, getDestination: () => null
			})), {} as never)).toBe(false);
			expect(smallEventFuncs.canBeExecuted(asPlayer(Object.assign(createTestPlayer(), {
				getPreviousMap: () => null, getDestination: () => celestrum
			})), {} as never)).toBe(false);
		});
	});

	describe("new pet", () => {
		it("rewards a gem for a pet Talvar never saw and remembers it", async () => {
			const response = await meet();

			expect(missionUpdate).toHaveBeenCalledWith(player, response, { missionId: "meetTalvar" });
			expect(DwarfPetsSeen.markPetAsSeen).toHaveBeenCalledWith(player, PET_TYPE);
			expect(addGems).toHaveBeenCalledWith(DWARF.NEW_PET_SEEN_REWARD, player.keycloakId, NumberChangeReason.SMALL_EVENT);
			expect(packetOf(response, SmallEventDwarfPetFanPacket)).toEqual(expect.objectContaining({
				interactionName: NAMES.NEW_PET_SEEN, amount: DWARF.NEW_PET_SEEN_REWARD, isGemReward: true, ...PET_INFO
			}));
			expect(missionUpdate).toHaveBeenCalledWith(player, response, { missionId: "showPetsToTalvar" });
			expect(missionUpdate).not.toHaveBeenCalledWith(player, response, { missionId: "showCloneToTalvar" });
		});

		it("notices the pet is a clone", async () => {
			vi.spyOn(PetUtils, "isPetClone").mockResolvedValue(true);

			const response = await meet();

			expect(packetOf(response, SmallEventDwarfPetFanPacket).interactionName).toBe(NAMES.CLONE_PET);
			expect(DwarfPetsSeen.markPetAsSeen).toHaveBeenCalled();
			expect(missionUpdate).toHaveBeenCalledWith(player, response, { missionId: "showPetsToTalvar" });
			expect(missionUpdate).toHaveBeenCalledWith(player, response, { missionId: "showCloneToTalvar" });
		});
	});

	describe("pet that cannot be shown", () => {
		it("does not see a pet that is not available", async () => {
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(false);

			const response = await meet();

			expect(packetOf(response, SmallEventDwarfPetFanPacket).interactionName).toBe(NAMES.NO_PET);
			expect(addGems).not.toHaveBeenCalled();
		});

		it("does not approach a feisty pet", async () => {
			mockPet(true);

			const response = await meet();

			expect(packetOf(response, SmallEventDwarfPetFanPacket)).toEqual(expect.objectContaining({
				interactionName: NAMES.FEISTY_PET, ...PET_INFO
			}));
			expect(DwarfPetsSeen.markPetAsSeen).not.toHaveBeenCalled();
		});

		it("rewards nothing for a pet Talvar already saw", async () => {
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(true);

			const response = await meet();

			expect(DwarfPetsSeen.isPetSeen).toHaveBeenCalledWith(player, PET_TYPE);
			expect(packetOf(response, SmallEventDwarfPetFanPacket)).toEqual(expect.objectContaining({
				interactionName: NAMES.PET_ALREADY_SEEN, ...PET_INFO
			}));
			expect(addGems).not.toHaveBeenCalled();
			expect(missionUpdate).not.toHaveBeenCalledWith(player, response, { missionId: "showCloneToTalvar" });
		});

		it("notices the clone of a pet he already saw", async () => {
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(true);
			vi.spyOn(PetUtils, "isPetClone").mockResolvedValue(true);

			const response = await meet();

			expect(packetOf(response, SmallEventDwarfPetFanPacket)).toEqual(expect.objectContaining({
				interactionName: NAMES.CLONE_PET_ALREADY_SEEN, ...PET_INFO
			}));
			expect(missionUpdate).toHaveBeenCalledWith(player, response, { missionId: "showCloneToTalvar" });
			expect(addGems).not.toHaveBeenCalled();
		});
	});

	describe("all pets seen", () => {
		beforeEach(() => {
			vi.spyOn(DwarfPetsSeen, "isAllPetSeen").mockResolvedValue(true);
			vi.spyOn(PlayerBadgesManager, "hasBadge").mockResolvedValue(true);
			vi.spyOn(PlayerBadgesManager, "addBadge").mockResolvedValue(true);
			vi.spyOn(BlessingManager.getInstance(), "getMoneyMultiplier").mockReturnValue(1.5);
		});

		it("awards the animal lover badge the first time", async () => {
			vi.spyOn(PlayerBadgesManager, "hasBadge").mockResolvedValue(false);

			const response = await meet();

			expect(PlayerBadgesManager.hasBadge).toHaveBeenCalledWith(player.id, Badge.ANIMAL_LOVER);
			expect(PlayerBadgesManager.addBadge).toHaveBeenCalledWith(player.id, Badge.ANIMAL_LOVER);
			expect(packetOf(response, SmallEventDwarfPetFanPacket).interactionName).toBe(NAMES.BADGE);
			expect(player.save).toHaveBeenCalled();
			expect(player.money).toBe(1000);
		});

		it("rarely gives a gem afterwards", async () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);

			const response = await meet();

			expect(RandomUtils.crowniclesRandom.bool).toHaveBeenCalledWith(DWARF.ALL_PETS_SEEN.GEM_PROBABILITY);
			expect(addGems).toHaveBeenCalledWith(DWARF.ALL_PETS_SEEN.GEM_REWARD, player.keycloakId, NumberChangeReason.SMALL_EVENT);
			expect(missionsInfoSave).toHaveBeenCalled();
			expect(packetOf(response, SmallEventDwarfPetFanPacket)).toEqual(expect.objectContaining({
				interactionName: NAMES.ALL_PETS_SEEN, isGemReward: true, amount: DWARF.ALL_PETS_SEEN.GEM_REWARD
			}));
			expect(player.money).toBe(1000);
		});

		it("gives money the rest of the time and shows the blessed amount", async () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);

			const response = await meet();

			expect(player.money).toBe(1000 + DWARF.ALL_PETS_SEEN.MONEY_REWARD);
			expect(player.save).toHaveBeenCalled();
			const packet = packetOf(response, SmallEventDwarfPetFanPacket);
			expect(packet).toEqual(expect.objectContaining({
				interactionName: NAMES.ALL_PETS_SEEN, amount: Math.round(DWARF.ALL_PETS_SEEN.MONEY_REWARD * 1.5)
			}));
			expect(packet.isGemReward).toBeUndefined();
			expect(addGems).not.toHaveBeenCalled();
		});

		it("does not approach a feisty pet", async () => {
			mockPet(true);

			const response = await meet();

			expect(packetOf(response, SmallEventDwarfPetFanPacket)).toEqual(expect.objectContaining({
				interactionName: NAMES.FEISTY_PET, ...PET_INFO
			}));
			expect(PlayerBadgesManager.hasBadge).not.toHaveBeenCalled();
			expect(player.money).toBe(1000);
		});

		it("rewards a player without pet too", async () => {
			vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);

			const response = await meet();

			expect(packetOf(response, SmallEventDwarfPetFanPacket).interactionName).toBe(NAMES.ALL_PETS_SEEN);
			expect(player.money).toBe(1000 + DWARF.ALL_PETS_SEEN.MONEY_REWARD);
		});
	});
});
