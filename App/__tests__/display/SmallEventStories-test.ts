import {smallEventKey, smallEventStory} from "@/src/display/SmallEventStories";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string, options?: Record<string, unknown>): string => `${key}${options && Object.keys(options).length > 0 ? JSON.stringify(options) : ""}`,
		tArray: (): string[] => [],
		tRecord: (): Record<string, string> => ({}),
		language: "fr"
	}
}));

describe("small-event stories told as on Discord", () => {
	it("names the other adventurer and picks the story of their interaction", () => {
		const story = smallEventStory(smallEventKey("SmallEventInteractOtherPlayersPacket"), {
			playerName: "Aventurier", playerInteraction: "TOP10", data: {rank: 7, level: 30, classId: 2, weaponId: 1, armorId: 1, potionId: 1, objectId: 1, effectId: "none"}
		});

		expect(story).toMatch(/^smallEvents:interactOtherPlayers\.top10/);
		expect(story).toContain("smallEvents:interactOtherPlayers.playerDisplayRanked");
		expect(story).toContain("Aventurier");
	});

	it("tells that nobody was met when the packet names no one", () => {
		expect(smallEventStory("interactOtherPlayers", {})).toBe("smallEvents:interactOtherPlayers.no_one");
	});

	it("completes the sky watching with its result, as Discord edits the same message", () => {
		const story = smallEventStory(smallEventKey("SmallEventSpaceResultPacket"), {chosenEvent: "neoWS", values: {mainValue: 3}});

		expect(story).toMatch(/^smallEvents:space\.after_search_format/);
		expect(story).toContain("smallEvents:space.before_search_format");
		expect(story).toContain("smallEvents:space.specific.neoWS");
	});

	it("chooses the time story of the alteration the small bad luck inflicted", () => {
		expect(smallEventStory("smallBad", {issue: "timeLost", effectId: "occupied", amount: 30}))
			.toContain("smallEvents:smallBad.timeLost.occupied.stories");
	});

	it("leaves an event Discord does not narrate to the caller", () => {
		expect(smallEventStory("unknownEvent", {})).toBeNull();
	});
});
