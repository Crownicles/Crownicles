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

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: vi.fn() }
}));

import { ReactionCollector } from "discord.js";
import { DiscordCache } from "../../../src/bot/DiscordCache";
import {
	handleChangeClassReactionCollector, handleCommandClassesChangeSuccessPacket
} from "../../../src/commands/player/ClassesCommand";
import {
	ReactionCollectorChangeClassPacket, ReactionCollectorChangeClassReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandClassesChangeSuccessPacket } from "../../../../Lib/src/packets/commands/CommandClassesPacket";
import { AiPersonalityConstants } from "../../../../Lib/src/constants/AiPersonalityConstants";
import { MessagesUtils } from "../../../src/utils/MessagesUtils";
import { CrowniclesEmbed } from "../../../src/messages/CrowniclesEmbed";
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

	it("opens a single confirmation when a second selection is queued behind a slow acknowledgement (#5059)", async () => {
		const selectionCollectors: ReactionCollector[] = [];
		const confirmationCollectors: ReactionCollector[] = [];
		const commandEditReply = vi.fn()
			.mockResolvedValueOnce(fakeCollectorMessage(selectionCollectors))
			.mockResolvedValue(fakeCollectorMessage(confirmationCollectors));
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user,
			editReply: commandEditReply
		} as never);
		const [selectCollector] = (await handleChangeClassReactionCollector(context, changeClassPacket()))!;

		const expiredSelection = (): object => ({
			user,
			customId: "classSelectionMenu",
			createdTimestamp: Date.now() - 4000,
			values: [CLASS_ID.toString()],
			deferReply: (): Promise<void> => Promise.reject(new Error("Unknown interaction")),
			editReply: vi.fn()
		});
		selectCollector.emit("collect", expiredSelection(), user);
		selectCollector.emit("collect", expiredSelection(), user);
		await wait(0);

		expect(commandEditReply).toHaveBeenCalledTimes(2);
		expect(confirmationCollectors).toHaveLength(1);
		selectCollector.stop();
	});
});

describe("handleCommandClassesChangeSuccessPacket", () => {
	/**
	 * Display the confirmation of a class change and return the description shown to the player
	 * @param packet
	 */
	async function displayedDescription(packet: CommandClassesChangeSuccessPacket): Promise<string> {
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({ user } as never);
		const editClickReply = vi.spyOn(MessagesUtils, "editClickReply").mockResolvedValue();

		await handleCommandClassesChangeSuccessPacket(packet, context);

		expect(editClickReply).toHaveBeenCalledOnce();
		const [embed] = editClickReply.mock.calls[0][1].embeds as CrowniclesEmbed[];
		editClickReply.mockRestore();
		return embed.data.description!;
	}

	it("tells the player the defense personality of the former class is forgotten (#5126)", async () => {
		const description = await displayedDescription({
			classId: ClassConstants.CLASSES_ID.LUMINOUS_PALADIN,
			lostDefensePersonality: AiPersonalityConstants.PERSONALITIES.KNIGHT_STRATEGIST
		});

		const [newClass, lostPersonality] = description.split("\n\n");
		expect(newClass).toContain("Paladin lumineux");
		expect(lostPersonality).toContain("**Stratège**");
	});

	it("only shows the new class when no defense personality is forgotten", async () => {
		const description = await displayedDescription({ classId: ClassConstants.CLASSES_ID.LUMINOUS_PALADIN });

		expect(description).toContain("Paladin lumineux");
		expect(description).not.toContain("\n\n");
	});
});
