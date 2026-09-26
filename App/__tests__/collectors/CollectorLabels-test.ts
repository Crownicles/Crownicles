import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS,
	ITEM_DATA_KINDS, ITEM_REACTION_KINDS,
	REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS, ReactionCollectorData
} from "ws-packets/src/fromServer/collectors";
import {
	collectorDescription, collectorTitle, isChoosable, isEventPrompt, reactionLabel
} from "@/src/collectors/CollectorLabels";

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIcon: (path: string): string => `icon:${path}`,
		getIconOrNull: (path: string): string | null => path === "events.19.butch"
			? "🦊"
			: path === "events.19.end.0" ? "🚶"
			: path === "badPetSmallEvent.intimidate" ? "🦁"
			: path === "witchSmallEvent.bat" ? "🦇"
			: path === "goblets.metal" ? "🐲"
			: path === "goblets.biggest" ? "🪣"
			: path === "goblets.sparkling" ? "✨"
			: path === "goblets.cracked" ? "💀"
			: path === "collectors.question" ? "❓"
			: path === "smallEvents.pet" ? "🐕‍🦺"
			: path === "smallEvents.doNothing" ? "🚶" : null
	}
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string, options?: Record<string, unknown>): string => {
			if (key === "app:adventure.duration.minutes") return `${options?.count} minutes`;
			if (key === "app:collector.choices.destination") return `${options?.destination} (${options?.duration})`;
			return key;
		},
		tArray: (): string[] => []
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
		expect(collectorDescription(altarData)).toBe("smallEvents:introsmallEvents:altar.intro");
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

	it("uses the Discord emoji for each goblet choice", () => {
		const data = {
			type: SMALL_EVENT_DATA_KINDS.GOBLETS_GAME,
			data: {}
		} as const;
		const goblets = [
			{id: "metal", strategy: "classic", icon: "🐲"},
			{id: "biggest", strategy: "safe", icon: "🪣"},
			{id: "sparkling", strategy: "risky", icon: "✨"},
			{id: "cracked", strategy: "gambler", icon: "💀"}
		] as const;

		for (const goblet of goblets) {
			expect(reactionLabel({
				type: SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME,
				data: {id: goblet.id, strategy: goblet.strategy}
			}, data)).toBe(`${goblet.icon} smallEvents:gobletsGame.goblets.${goblet.id}.name`);
		}
	});

	it("uses the Discord emoji for each pet food choice", () => {
		const choices = [
			{type: SMALL_EVENT_REACTION_KINDS.PET_FOOD_INVESTIGATE, label: "smallEvents:petFood.choices.investigate", icon: "❓"},
			{type: SMALL_EVENT_REACTION_KINDS.PET_FOOD_SEND_PET, label: "smallEvents:petFood.choices.sendPet", icon: "🐕‍🦺"},
			{type: SMALL_EVENT_REACTION_KINDS.PET_FOOD_CONTINUE, label: "smallEvents:petFood.choices.continue", icon: "🚶"}
		] as const;

		for (const choice of choices) {
			expect(reactionLabel({type: choice.type, data: {}}, eventData)).toBe(`${choice.icon} ${choice.label}`);
		}
	});

	it("tells the gardener's offer with the Discord story and seed price", () => {
		const data = {
			type: SMALL_EVENT_DATA_KINDS.GARDENER,
			data: {seedId: 2, cost: 30, conditionKey: "paid", isFirstEncounter: true}
		} as const;

		expect(collectorDescription(data)).toBe("smallEvents:introsmallEvents:gardener.stories.firstsmallEvents:gardener.rewards.seed.paid");
	});

	it("names the other adventurer and their rank, as Discord does", () => {
		const data = {
			type: SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS,
			data: {rank: 4, playerName: "Aventurier"}
		} as const;

		expect(collectorDescription(data)).toBe("smallEvents:interactOtherPlayers.poor");
		expect(isEventPrompt(data)).toBe(true);
	});

	it("tells a destination choice as a menu, not as a journal entry", () => {
		expect(isEventPrompt({type: REPORT_COLLECTOR_DATA_KINDS.DESTINATION, data: {}} as ReactionCollectorData)).toBe(false);
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
			data: {foundItem: {...itemDetails, id: 8}}
		} as const;
		const reaction = {
			type: ITEM_REACTION_KINDS.CHOICE_ITEM,
			data: {slot: 2, itemWithDetails: itemDetails}
		} as const;

		expect(collectorDescription(data)).toBeUndefined();
		expect(reactionLabel(reaction, data)).toBe("models:weapons.7");
	});

	it("renders and enables the destination choice which follows a report event", () => {
		const data = {
			type: REPORT_COLLECTOR_DATA_KINDS.DESTINATION,
			data: {}
		} as const;
		const reaction = {
			type: REPORT_COLLECTOR_REACTION_KINDS.DESTINATION,
			data: {mapId: 3, mapTypeId: "port", tripDurationMinutes: 15}
		} as const;

		expect(collectorTitle(data)).toBe("app:collector.titles.destination");
		expect(collectorDescription(data)).toBe("app:collector.descriptions.destination");
		expect(reactionLabel(reaction, data)).toBe("models:map_locations.3.name (15 minutes)");
		expect(isChoosable(reaction, data)).toBe(true);
	});

	it("uses explicit actions for the PVE island invitation", () => {
		const data = {
			type: SMALL_EVENT_DATA_KINDS.PVE_ISLAND,
			data: {price: 3, energy: {current: 80, max: 100}}
		} as const;

		expect(collectorTitle(data)).toBe("app:collector.pveIsland.title");
		expect(collectorDescription(data)).toBe("smallEvents:introsmallEvents:goToPVEIsland.stories\n\nsmallEvents:goToPVEIsland.confirm");
		expect(reactionLabel({type: "accept", data: {}}, data)).toContain("app:collector.pveIsland.embark");
		expect(reactionLabel({type: "refuse", data: {}}, data)).toContain("app:collector.pveIsland.continueJourney");
	});
});
