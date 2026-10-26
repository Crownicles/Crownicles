import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	shardId: 0
}));

vi.mock("../../../src/bot/DiscordCache");

vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: {
		sendPacketToBackend: vi.fn()
	}
}));

import { ReactionCollector } from "discord.js";
import { DiscordCache } from "../../../src/bot/DiscordCache";
import { handleChangeClassReactionCollector } from "../../../src/commands/player/ClassesCommand";
import {
	ReactionCollectorChangeClassPacket, ReactionCollectorChangeClassReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	deferredReply, fakeCollectorMessage, wait
} from "../../bot/fakeCollectorMessage";

const USER_ID = "user";

const CLASS_ID = ClassConstants.CLASSES_ID.KNIGHT;

const context = {
	discord: {
		interaction: "classes-interaction",
		language: "fr",
		user: USER_ID
	},
	keycloakId: "keycloak"
} as PacketContext;

const user = {
	id: USER_ID,
	displayName: "Tester",
	displayAvatarURL: (): string => "https://example.com/avatar.png"
};

function changeClassPacket(): ReactionCollectorChangeClassPacket {
	return {
		id: "classes-collector",
		endTime: Date.now() + 60_000,
		reactions: [
			{
				type: ReactionCollectorChangeClassReaction.name,
				data: { classId: CLASS_ID }
			},
			{
				type: ReactionCollectorRefuseReaction.name,
				data: {}
			}
		],
		data: {
			type: "ReactionCollectorChangeClassData",
			data: {
				classesDetails: [
					{
						id: CLASS_ID,
						energy: 1,
						attack: 1,
						defense: 1,
						speed: 1,
						initialBreath: 1,
						maxBreath: 1,
						breathRegen: 1,
						health: 1
					}
				],
				cooldownSeconds: 1
			}
		}
	} as ReactionCollectorChangeClassPacket;
}

describe("handleChangeClassReactionCollector", () => {
	it("stops the confirmation displayed after the selection of a class already ended", async () => {
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user,
			editReply: (): Promise<unknown> => Promise.resolve(fakeCollectorMessage())
		} as never);
		const [selectCollector] = (await handleChangeClassReactionCollector(context, changeClassPacket()))!;

		const confirmationCollectors: ReactionCollector[] = [];
		const confirmationReply = deferredReply(confirmationCollectors);
		const selectInteraction = {
			user,
			values: [CLASS_ID.toString()],
			deferReply: (): Promise<void> => Promise.resolve(),
			editReply: confirmationReply.editReply
		};
		selectCollector.emit("collect", selectInteraction, user);
		await wait(0);

		selectCollector.stop();
		await wait(0);
		confirmationReply.resolve();
		await wait(0);

		expect(confirmationCollectors).toHaveLength(1);
		expect(confirmationCollectors[0].ended).toBe(true);
	});
});
