import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	shardId: 0
}));

vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: {
		sendPacketToBackend: vi.fn()
	}
}));

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: vi.fn() }
}));

import { CommandInteraction } from "discord.js";
import { DiscordCache } from "../../../src/bot/DiscordCache";
import { PacketUtils } from "../../../src/utils/PacketUtils";
import {
	createDefensePersonalityCollector, handleCommandDefenseChangeSuccessPacket
} from "../../../src/commands/player/DefenseCommand";
import { CrowniclesInteraction } from "../../../src/messages/CrowniclesInteraction";
import {
	ReactionCollectorDefensePersonalityPacket,
	ReactionCollectorDefensePersonalityReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDefensePersonality";
import {
	ReactionCollectorReactPacket, ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { AiPersonalityConstants } from "../../../../Lib/src/constants/AiPersonalityConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	fakeCollectorMessage, wait
} from "../../bot/fakeCollectorMessage";

const user = {
	id: "defender-discord-id",
	displayName: "Defender",
	displayAvatarURL: (): string => "https://avatar/Defender"
};

const PERSONALITY = AiPersonalityConstants.PERSONALITIES.KNIGHT_STRATEGIST;

type FakeSelection = {
	id: string;
	user: typeof user;
	channel: object;
	customId: string;
	createdTimestamp: number;
	values: string[];
	deferred: boolean;
	replied: boolean;
	isButton: () => boolean;
	isStringSelectMenu: () => boolean;
	isCommand: () => boolean;
	deferReply: () => Promise<void>;
};

type FakeCommand = {
	id: string;
	userLanguage: string;
	user: typeof user;
	editReply: ReturnType<typeof vi.fn>;
};

function defensePacket(): ReactionCollectorDefensePersonalityPacket {
	return {
		id: "defense-collector",
		endTime: Date.now() + 60_000,
		reactions: [
			{
				type: ReactionCollectorDefensePersonalityReaction.name,
				data: { personality: PERSONALITY }
			},
			{
				type: ReactionCollectorDefensePersonalityReaction.name,
				data: {}
			},
			{
				type: ReactionCollectorRefuseReaction.name,
				data: {}
			}
		],
		data: {
			type: "ReactionCollectorDefensePersonalityData",
			data: {
				classId: ClassConstants.CLASSES_ID.KNIGHT,
				recentDefenses: []
			}
		}
	} as ReactionCollectorDefensePersonalityPacket;
}

/**
 * Selection of the first personality of the menu
 * @param acknowledgement - Answer of Discord to the deferral of the reply to the selection
 */
function firstPersonalitySelection(acknowledgement: () => Promise<void>): FakeSelection {
	const selection: FakeSelection = {
		id: `selection-${Math.random()}`,
		user,
		channel: {},
		customId: "defensePersonalityMenu",
		createdTimestamp: Date.now(),
		values: ["0"],
		deferred: false,
		replied: false,
		isButton: () => false,
		isStringSelectMenu: () => true,
		isCommand: () => false,
		deferReply: async () => {
			await acknowledgement();
			selection.deferred = true;
		}
	};
	return selection;
}

/**
 * Display the defense menu of a command, make the selection on it and return the context of the packets Core responds with
 * @param selection
 */
async function select(selection: FakeSelection): Promise<{
	command: FakeCommand;
	responseContext: PacketContext;
}> {
	const context = {
		keycloakId: "defender-keycloak-id",
		discord: {
			interaction: `defense-command-${Math.random()}`,
			user: user.id,
			channel: "channel-id",
			language: "fr"
		}
	} as PacketContext;
	const command: FakeCommand = {
		id: context.discord!.interaction,
		userLanguage: "fr",
		user,
		editReply: vi.fn().mockResolvedValue(fakeCollectorMessage())
	};
	DiscordCache.cacheInteraction(command as unknown as CrowniclesInteraction);

	const [menuCollector] = (await createDefensePersonalityCollector(context, defensePacket()))!;
	menuCollector.emit("collect", selection, user);
	await wait(0);

	expect(PacketUtils.sendPacketToBackend).toHaveBeenCalledOnce();
	const [responseContext, reactPacket] = vi.mocked(PacketUtils.sendPacketToBackend).mock.calls[0];
	expect((reactPacket as ReactionCollectorReactPacket).reactionIndex).toBe(0);
	return {
		command,
		responseContext
	};
}

describe("defense personality selection", () => {
	// Interactions whose reply Discord is asked to edit
	let editedReplies: unknown[];

	beforeEach(() => {
		vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
		editedReplies = [];
		vi.spyOn(CommandInteraction.prototype, "editReply").mockImplementation(function (this: unknown) {
			editedReplies.push(this);
			return Promise.resolve(undefined as never);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("displays Core's confirmation in the reply deferred on the selection", async () => {
		const selection = firstPersonalitySelection(() => Promise.resolve());
		const {
			command, responseContext
		} = await select(selection);

		await handleCommandDefenseChangeSuccessPacket(responseContext, { personality: PERSONALITY });

		expect(editedReplies).toEqual([selection]);

		// The command reply keeps the menu
		expect(command.editReply).toHaveBeenCalledOnce();
	});

	it("still forwards a selection whose acknowledgement failed and confirms it in the command reply (#5059)", async () => {
		const selection = firstPersonalitySelection(() => Promise.reject(new Error("Unknown interaction")));
		const {
			command, responseContext
		} = await select(selection);

		await handleCommandDefenseChangeSuccessPacket(responseContext, { personality: PERSONALITY });

		expect(editedReplies).toEqual([]);
		expect(command.editReply).toHaveBeenCalledTimes(2);
	});
});
