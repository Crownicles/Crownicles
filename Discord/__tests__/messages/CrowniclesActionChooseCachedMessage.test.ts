import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", () => ({
	crowniclesClient: {}
}));
const discordChannel = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../../src/bot/DiscordCache", () => ({
	DiscordCache: {
		getInteraction: vi.fn(() => ({
			userLanguage: "fr",
			user: { displayAvatarURL: (): string => "https://avatar" },
			channel: discordChannel
		}))
	}
}));
vi.mock("../../src/translations/i18n", () => ({
	default: { t: (key: string): string => key }
}));
vi.mock("../../src/utils/DisplayUtils", () => ({
	DisplayUtils: { getEscapedUsername: vi.fn().mockResolvedValue("Tester") }
}));
vi.mock("../../src/utils/DiscordCollectorUtils", () => ({
	DiscordCollectorUtils: { sendReaction: vi.fn() },
	disableRows: (rows: { components: { setDisabled: (disabled: boolean) => void }[] }[]): void => {
		rows.forEach(row => row.components.forEach(component => component.setDisabled(true)));
	}
}));
vi.mock("../../src/utils/ErrorUtils", () => ({
	sendInteractionNotForYou: vi.fn()
}));
vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: vi.fn() }
}));

import {
	ActionRowBuilder, APIActionRowComponent, APIButtonComponent, APIEmbed, ButtonBuilder, ComponentType, Message
} from "discord.js";
import { CrowniclesActionChooseCachedMessage } from "../../src/messages/CrowniclesActionChooseCachedMessage";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { ReactionCollectorFightChooseActionPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesEmbed } from "../../src/messages/CrowniclesEmbed";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

type CollectHandler = (interaction: unknown) => Promise<void>;

const PLAYER_ID = "player-discord-id";

const context = {
	keycloakId: "player-keycloak-id",
	discord: {
		interaction: "interaction-id",
		user: PLAYER_ID,
		channel: "channel-id",
		language: "fr"
	}
} as PacketContext;

function actionChoicePacket(collectorId: string): ReactionCollectorFightChooseActionPacket {
	return {
		id: collectorId,
		endTime: Date.now() + 60_000,
		data: { data: { fighterKeycloakId: "player-keycloak-id" } },
		reactions: [
			{
				type: "fightAction",
				data: { id: "simpleAttack" }
			},
			{
				type: "fightAction",
				data: { id: "quickAttack" }
			}
		]
	} as unknown as ReactionCollectorFightChooseActionPacket;
}

const packet = actionChoicePacket("collector-id");

async function openActionChoice(): Promise<CollectHandler> {
	let collectHandler: CollectHandler | undefined;
	const collector = {
		on: vi.fn((event: string, handler: CollectHandler) => {
			if (event === "collect") {
				collectHandler = handler;
			}
			return collector;
		})
	};
	const cachedMessage = new CrowniclesActionChooseCachedMessage("interaction-id");
	vi.spyOn(cachedMessage, "post").mockResolvedValue({
		embeds: [],
		components: [],
		createMessageComponentCollector: vi.fn(() => collector)
	} as unknown as Message);

	await cachedMessage.update(packet, context);
	return collectHandler!;
}

function click(customId: string, deferUpdate: () => Promise<void>): {
	customId: string; deferUpdate: () => Promise<void>; message: { edit: ReturnType<typeof vi.fn> };
} {
	return {
		customId,
		user: { id: PLAYER_ID },
		createdTimestamp: Date.now() - 4000,
		deferUpdate,
		message: { edit: vi.fn().mockResolvedValue(undefined) }
	} as never;
}

type DisplayedButton = {
	id: string; disabled: boolean;
};

type DisplayedActionMessage = {
	description: string | undefined;
	buttons: DisplayedButton[];
};

type MessageEdit = {
	embeds?: (CrowniclesEmbed | APIEmbed)[];
	components?: (ActionRowBuilder<ButtonBuilder> | APIActionRowComponent<APIButtonComponent>)[];
};

// Like discord.js, the message accepts builders as well as their JSON
function asJson<T>(value: T | { toJSON: () => T }): T {
	return typeof value === "object" && value !== null && "toJSON" in value ? value.toJSON() : value;
}

const AI_CHOOSE_DESCRIPTION = "commands:fight.actions.aiChoose";
const TURN_DESCRIPTION = "commands:fight.fightActionChoose.turnIndicationDescription";

/**
 * Server-side state of the action message as Discord stores it: message edits are applied when their request
 * completes, while an UPDATE_MESSAGE interaction response is acknowledged at once but applied later on
 */
class DiscordActionMessage {
	state: DisplayedActionMessage = {
		description: undefined,
		buttons: []
	};

	collectHandlers: CollectHandler[] = [];

	fetchCount = 0;

	apply(options: MessageEdit): void {
		this.state = {
			description: options.embeds ? asJson<APIEmbed>(options.embeds[0]).description : this.state.description,
			buttons: options.components
				? options.components.flatMap(row => asJson<APIActionRowComponent<APIButtonComponent>>(row).components.map(button => ({
					id: (button as { custom_id: string }).custom_id,
					disabled: button.disabled ?? false
				})))
				: this.state.buttons
		};
	}

	asMessage(): Message {
		const edit = (options: MessageEdit): Promise<Message> => {
			this.apply(options);
			return Promise.resolve(this.asMessage());
		};
		const fetch = (): Promise<Message> => {
			this.fetchCount++;
			return Promise.resolve(this.asMessage());
		};
		return {
			id: "action-message-id",
			embeds: [{ description: this.state.description }],
			components: [
				{
					type: ComponentType.ActionRow,
					components: this.state.buttons.map(button => ({
						customId: button.id,
						disabled: button.disabled
					}))
				}
			],
			edit,
			fetch,
			createMessageComponentCollector: (): unknown => {
				const collector = {
					ended: false,
					on: (event: string, handler: CollectHandler): unknown => {
						if (event === "collect") {
							this.collectHandlers.push(handler);
						}
						return collector;
					}
				};
				return collector;
			}
		} as unknown as Message;
	}

	/**
	 * A click whose UPDATE_MESSAGE response only lands on the message after `responseDelayMs`
	 */
	clickWithLateUpdateResponse(customId: string, responseDelayMs: number): unknown {
		const message = this.asMessage();
		return {
			customId,
			user: { id: PLAYER_ID },
			createdTimestamp: Date.now(),
			message,
			update: (options: MessageEdit): Promise<void> => {
				const payload = {
					components: options.components?.map(row => ActionRowBuilder.from<ButtonBuilder>(row.toJSON()))
				};
				setTimeout(() => this.apply(payload), responseDelayMs);
				return Promise.resolve();
			},
			deferUpdate: (): Promise<void> => Promise.resolve()
		};
	}
}

describe("CrowniclesActionChooseCachedMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends the chosen action even when the click can no longer be acknowledged (#4877)", async () => {
		const collect = await openActionChoice();

		await collect(click("quickAttack", vi.fn().mockRejectedValue(new Error("Unknown interaction"))));

		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledOnce();
		expect(vi.mocked(DiscordCollectorUtils.sendReaction).mock.calls[0][4]).toBe(1);
	});

	it("only sends the first action when several clicks are queued", async () => {
		const collect = await openActionChoice();
		const secondClick = click("simpleAttack", vi.fn().mockResolvedValue(undefined));

		await collect(click("quickAttack", vi.fn().mockResolvedValue(undefined)));
		await collect(secondClick);

		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledOnce();
		expect(vi.mocked(DiscordCollectorUtils.sendReaction).mock.calls[0][4]).toBe(1);
		expect(secondClick.deferUpdate).toHaveBeenCalledOnce();
	});

	describe("when Discord applies the click response late (#5024)", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("keeps the next turn playable", async () => {
			const discordMessage = new DiscordActionMessage();
			discordChannel.send.mockImplementation((options: MessageEdit) => {
				discordMessage.apply(options);
				return Promise.resolve(discordMessage.asMessage());
			});
			const cachedMessage = new CrowniclesActionChooseCachedMessage("interaction-id");

			await cachedMessage.update(actionChoicePacket("turn-1"), context);
			await discordMessage.collectHandlers[0](discordMessage.clickWithLateUpdateResponse("quickAttack", 3000));

			// Core answers with the opponent's turn then gives the hand back to the player
			await cachedMessage.post({ embeds: [new CrowniclesEmbed().setDescription(AI_CHOOSE_DESCRIPTION)] });
			await vi.advanceTimersByTimeAsync(1500);
			await cachedMessage.update(actionChoicePacket("turn-3"), context);
			await vi.advanceTimersByTimeAsync(5000);

			expect(discordMessage.state).toEqual({
				description: TURN_DESCRIPTION,
				buttons: [
					{
						id: "simpleAttack",
						disabled: false
					},
					{
						id: "quickAttack",
						disabled: false
					}
				]
			});
			expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledOnce();
		});
	});

	describe("when Discord writes an older state of the message over the next turn (#5046)", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		async function playUntilOpponentChose(discordMessage: DiscordActionMessage, cachedMessage: CrowniclesActionChooseCachedMessage): Promise<DisplayedActionMessage> {
			discordChannel.send.mockImplementation((options: MessageEdit) => {
				discordMessage.apply(options);
				return Promise.resolve(discordMessage.asMessage());
			});
			await cachedMessage.update(actionChoicePacket("turn-1"), context);
			await discordMessage.collectHandlers[0](discordMessage.clickWithLateUpdateResponse("quickAttack", 0));
			await cachedMessage.post({ embeds: [new CrowniclesEmbed().setDescription(AI_CHOOSE_DESCRIPTION)] });
			return structuredClone(discordMessage.state);
		}

		it("displays the turn again", async () => {
			const discordMessage = new DiscordActionMessage();
			const cachedMessage = new CrowniclesActionChooseCachedMessage("interaction-id");
			const opponentChoosingState = await playUntilOpponentChose(discordMessage, cachedMessage);

			await vi.advanceTimersByTimeAsync(1500);
			await cachedMessage.update(actionChoicePacket("turn-3"), context);

			// The edit showing the opponent choosing is persisted again after the display of the next turn, as seen in production
			await vi.advanceTimersByTimeAsync(500);
			discordMessage.state = opponentChoosingState;
			await vi.advanceTimersByTimeAsync(3000);

			expect(discordMessage.state).toEqual({
				description: TURN_DESCRIPTION,
				buttons: [
					{
						id: "simpleAttack",
						disabled: false
					},
					{
						id: "quickAttack",
						disabled: false
					}
				]
			});
			expect(CrowniclesLogger.warn).toHaveBeenCalledOnce();
		});

		it("stops checking the turn once the fighter has played", async () => {
			const discordMessage = new DiscordActionMessage();
			const cachedMessage = new CrowniclesActionChooseCachedMessage("interaction-id");
			await playUntilOpponentChose(discordMessage, cachedMessage);

			await vi.advanceTimersByTimeAsync(60_000);

			expect(discordMessage.fetchCount).toBe(0);
			expect(CrowniclesLogger.warn).not.toHaveBeenCalled();
		});
	});
});
