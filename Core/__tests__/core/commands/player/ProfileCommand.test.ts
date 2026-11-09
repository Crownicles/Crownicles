import {
	afterEach, describe, expect, it, vi
} from "vitest";
import ProfileCommand from "../../../../src/commands/player/ProfileCommand";
import {
	Player, Players
} from "../../../../src/core/database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../../src/core/database/game/models/PlayerMissionsInfo";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../../../src/core/database/game/models/PlayerActiveObjects";
import { Homes } from "../../../../src/core/database/game/models/Home";
import { PlayerBadgesManager } from "../../../../src/core/database/game/models/PlayerBadges";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { Effect } from "../../../../../Lib/src/types/Effect";
import {
	CrowniclesPacket, makePacket
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandProfilePacketReq, CommandProfilePacketRes
} from "../../../../../Lib/src/packets/commands/CommandProfilePacket";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => descriptor,
	CommandUtils: {
		DISALLOWED_EFFECTS: { NOT_STARTED: [] },
		WHERE: { EVERYWHERE: [] }
	}
}));

/**
 * A level 0 character of the starting class, whose stored health was set above its max health by the old
 * registration default (#5070).
 */
function overhealedNewcomer(): Player {
	const player = Object.create(Player.prototype) as Player;
	Object.assign(player, {
		id: 1,
		keycloakId: "newcomer",
		level: 0,
		class: 0,
		experience: 0,
		score: 0,
		money: 0,
		tokens: 0,
		mapLinkId: 0,
		guildId: null,
		petId: null,
		effectId: Effect.NO_EFFECT.id,
		effectEndDate: new Date(0),
		fightCountdown: FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE + 1
	});
	player.setHealthNoCheck(player.getMaxHealth() + 1);
	return player;
}

describe("profile health", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("never shows more health than the max health (#5070)", async () => {
		vi.spyOn(Players, "getRankById").mockResolvedValue(1);
		vi.spyOn(Players, "getNbPlayersHaveStartedTheAdventure").mockResolvedValue(1);
		vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({
			gems: 0,
			campaignProgression: 0
		} as PlayerMissionsInfo);
		vi.spyOn(InventorySlots, "getPlayerActiveObjects").mockResolvedValue({} as PlayerActiveObjects);
		vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);
		vi.spyOn(PlayerBadgesManager, "getOfPlayer").mockResolvedValue([]);
		const player = overhealedNewcomer();
		const response: CrowniclesPacket[] = [];

		await new ProfileCommand().execute(response, player, makePacket(CommandProfilePacketReq, { askedPlayer: {} }));

		const profile = response[0] as CommandProfilePacketRes;
		expect(profile.playerData.health).toEqual({
			value: player.getMaxHealth(),
			max: player.getMaxHealth()
		});
	});
});
