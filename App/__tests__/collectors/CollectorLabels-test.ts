import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS,
	ITEM_DATA_KINDS, ITEM_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {
	collectorDescription, collectorTitle, isChoosable, reactionLabel
} from "@/src/collectors/CollectorLabels";

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIcon: (path: string): string => `icon:${path}`,
		getIconOrNull: (path: string): string | null => path === "events.19.butch"
			? "🦊"
			: path === "events.19.end.0" ? "🚶"
			: path === "badPetSmallEvent.intimidate" ? "🦁"
			: path === "witchSmallEvent.bat" ? "🦇" : null
	}
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key
	}
}));

const eventData = {
	type: BIG_EVENT_DATA_KINDS.COLLECTOR,
	data: {eventId: 19}
};

describe("CollectorLabels", () => {
	it("uses the event asset and translation for the prompt description", () => {
		expect(collectorTitle(eventData)).toBe("app:collector.titles.bigEvent");
		expect(collectorDescription(eventData)).toBe("events:19.text");
	});

	it("uses the event-specific icon and possibility translation", () => {
		expect(reactionLabel({
			type: BIG_EVENT_REACTION_KINDS.POSSIBILITY,
			data: {name: "butch"}
		}, eventData)).toBe("🦊 events:19.possibilities.butch.text");
	});

	it("falls back to the end icon when the event asset stores outcomes under end", () => {
		expect(reactionLabel({
			type: BIG_EVENT_REACTION_KINDS.POSSIBILITY,
			data: {name: "end"}
		}, eventData)).toBe("🚶 events:19.possibilities.end.text");
	});

	it("uses the small-event payload to render a narrative and its action", () => {
		const altarData = {
			type: SMALL_EVENT_DATA_KINDS.ALTAR,
			data: {poolAmount: 12, poolThreshold: 100}
		} as const;
		const altarReaction = {
			type: SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE,
			data: {amount: 5}
		} as const;

		expect(collectorTitle(altarData)).toBe("app:collector.titles.altar");
		expect(collectorDescription(altarData)).toBe("smallEvents:altar.intro.0");
		expect(reactionLabel(altarReaction, altarData)).toBe("app:collector.choices.altarContribute");
	});

	it("keeps the server choice identifiable for gendered and dynamic actions", () => {
		const badPetData = {
			type: SMALL_EVENT_DATA_KINDS.BAD_PET,
			data: {petId: 2, sex: "m", petNickname: "Milo"}
		} as const;
		const badPetReaction = {
			type: SMALL_EVENT_REACTION_KINDS.BAD_PET,
			data: {id: "intimidate"}
		} as const;
		const witchData = {
			type: SMALL_EVENT_DATA_KINDS.WITCH,
			data: {}
		} as const;
		const witchReaction = {
			type: SMALL_EVENT_REACTION_KINDS.WITCH,
			data: {id: "bat"}
		} as const;

		expect(collectorDescription(badPetData)).toBe("smallEvents:badPet.intro");
		expect(reactionLabel(badPetReaction, badPetData)).toBe("🦁 smallEvents:badPet.choices.intimidate_male");
		expect(reactionLabel(witchReaction, witchData)).toBe("🦇 smallEvents:witch.witchEventNames.bat");
	});

	it("does not enable a future goblet choice in a known collector", () => {
		const data = {
			type: SMALL_EVENT_DATA_KINDS.GOBLETS_GAME,
			data: {}
		} as const;
		const reaction = {
			type: SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME,
			data: {}
		};
		Object.assign(reaction.data, {id: "futureGoblet"});

		expect(reactionLabel(reaction, data)).toBe("app:collector.unknownChoice");
		expect(isChoosable(reaction, data)).toBe(false);
	});

	it("uses the gardener seed and condition in its narrative", () => {
		const data = {
			type: SMALL_EVENT_DATA_KINDS.GARDENER,
			data: {seedId: 2, cost: 30, conditionKey: "paid", isFirstEncounter: true}
		} as const;

		expect(collectorDescription(data)).toBe("smallEvents:gardener.stories.first.0 smallEvents:gardener.rewards.seed.paid.0 app:collector.descriptions.gardenerSeed");
	});

	it("uses a safe ranked description for the other-player collector", () => {
		const data = {
			type: SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS,
			data: {keycloakId: "player", rank: 4}
		} as const;

		expect(collectorDescription(data)).toBe("app:collector.descriptions.interactOtherPlayersRanked");
	});

	it("renders the item that would be replaced", () => {
		const itemDetails = {
			id: 7,
			rarity: 1,
			itemCategory: 0,
			itemLevel: 2,
			attack: {baseValue: 1, upgradeValue: 2, maxValue: 3},
			defense: {baseValue: 1, upgradeValue: 2, maxValue: 3},
			speed: {baseValue: 1, upgradeValue: 2, maxValue: 3}
		};
		const data = {
			type: ITEM_DATA_KINDS.CHOICE,
			data: {item: {id: 8, category: 0}}
		} as const;
		const reaction = {
			type: ITEM_REACTION_KINDS.CHOICE_ITEM,
			data: {slot: 2, itemWithDetails: itemDetails}
		} as const;

		expect(collectorDescription(data)).toBe("app:collector.descriptions.itemChoice");
		expect(reactionLabel(reaction, data)).toBe("app:collector.choices.replaceItemInSlot");
	});
});