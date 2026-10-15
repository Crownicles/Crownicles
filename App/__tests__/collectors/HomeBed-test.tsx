import {
	render, screen
} from "@testing-library/react-native";
import {
	CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {
	HOME_BED_OUTCOMES, HomeBedRes
} from "ws-packets/src/fromServer/home/HomeBedRes";
import { cityReactionAvailable } from "@/src/collectors/CityReactionAvailability";
import { cityReactionLock } from "@/src/collectors/CityReactionLocks";
import { useCitySnapshotSummary } from "@/src/collectors/CitySnapshotSummary";
import { HomeBedOutcome } from "@/src/collectors/HomeBedOutcome";

const bed = {
	type: CITY_REACTION_KINDS.HOME_BED, data: {}
} as ReactionCollectorReaction;

function bedroom(current: number, roomAvailableAt?: number): CityMobileSnapshot {
	return {
		health: {
			current, max: 66
		},
		...roomAvailableAt === undefined ? {} : { innCooldowns: { roomAvailableAt } },
		home: { owned: {
			level: 2, bedHealthRegeneration: 10, gardenPlots: 0, hasBed: true, hasChest: false, hasGarden: false, hasCooking: false, hasUpgradeStation: false, upgradeableItemCount: 0
		} }
	};
}

function Summary({ snapshot }: { snapshot: CityMobileSnapshot }): ReturnType<typeof useCitySnapshotSummary> {
	return useCitySnapshotSummary("homeBed", snapshot);
}

describe("home bed", () => {
	it("is refused beforehand when health is full, or while the last rest is too recent", () => {
		const now = Date.UTC(2026, 9, 15, 12);
		expect(cityReactionAvailable(bed, bedroom(40), now)).toBe(true);
		expect(cityReactionAvailable(bed, bedroom(66), now)).toBe(false);
		expect(cityReactionLock(bed, bedroom(66), now)?.reason).toBe("Votre vie est déjà au maximum.");
		expect(cityReactionAvailable(bed, bedroom(40, now + 60_000), now)).toBe(false);
		expect(cityReactionLock(bed, bedroom(40, now + 60_000), now)?.reason).toMatch(/^Votre dernier repos dans un lit est trop récent/u);
	});

	it("shows where health stands and where a rest would take it", async () => {
		await render(<Summary snapshot={bedroom(60)} />);

		expect(screen.getByText("60 / 66")).toBeTruthy();
		expect(screen.getByText("Après le repos")).toBeTruthy();
		expect(screen.getByText("66 / 66")).toBeTruthy();
	});

	it("tells the gain of a rest once done", async () => {
		await render(<HomeBedOutcome outcome={{ outcome: {
			type: HOME_BED_OUTCOMES.RESTED, health: 10
		} } as HomeBedRes} onContinue={jest.fn()} />);

		expect(screen.getByText("Repos dans votre lit")).toBeTruthy();
	});
});
