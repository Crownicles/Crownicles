import {nextLevelStep, openTabs, unlockedFeatures, JourneyProgress} from "@/src/journey/Journey";
import {journeyStore} from "@/src/journey/JourneyStore";

const mockStorage = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
	getItem: (key: string): string | null => mockStorage.get(key) ?? null,
	setItem: (key: string, value: string): void => {
		mockStorage.set(key, value);
	}
}));

function progress(values: Partial<JourneyProgress>): JourneyProgress {
	return {started: true, level: 1, hasPet: false, hasGuild: false, ...values};
}

describe("journey unlocks", () => {
	it("keeps a character who has not set off on the adventure alone", () => {
		expect(openTabs(unlockedFeatures(progress({started: false})))).toEqual(["index"]);
	});

	it("opens the tabs in the order of the first hours of play", () => {
		expect(openTabs(unlockedFeatures(progress({level: 1})))).toEqual(["index", "profile"]);
		expect(openTabs(unlockedFeatures(progress({level: 4})))).toEqual(["index", "profile", "arena"]);
		expect(unlockedFeatures(progress({level: 7}))).not.toContain("fights");
		expect(unlockedFeatures(progress({level: 8}))).toContain("fights");
		expect(openTabs(unlockedFeatures(progress({level: 10})))).toEqual(["index", "profile", "pet", "guild", "arena"]);
	});

	it("opens the pet and guild tabs as soon as the character has one", () => {
		expect(openTabs(unlockedFeatures(progress({level: 2, hasPet: true, hasGuild: true})))).toEqual(["index", "profile", "pet", "guild"]);
	});

	it("holds out the closest level still to reach, then nothing once all is open", () => {
		expect(nextLevelStep(progress({level: 2}))?.feature).toBe("classes");
		expect(nextLevelStep(progress({level: 5}))?.feature).toBe("fights");
		expect(nextLevelStep(progress({level: 9}))?.level).toBe(10);
		expect(nextLevelStep(progress({level: 10}))).toBeNull();
	});
});

describe("journey record", () => {
	beforeEach(() => mockStorage.clear());

	it("does not celebrate again what a returning character already unlocked", () => {
		journeyStore.load("veteran", ["profile", "classes"]);
		expect(journeyStore.getSnapshot()).toEqual({announced: ["profile", "classes"], visited: ["profile", "classes"]});
	});

	it("announces everything to a newcomer seen before their first report, and remembers it", () => {
		journeyStore.markNewcomer();
		journeyStore.load("newcomer", ["profile"]);
		expect(journeyStore.getSnapshot()?.announced).toEqual([]);
		journeyStore.announce("profile");
		journeyStore.load("veteran", []);
		journeyStore.load("newcomer", ["profile", "classes"]);
		expect(journeyStore.getSnapshot()).toEqual({announced: ["profile"], visited: []});
	});
});
