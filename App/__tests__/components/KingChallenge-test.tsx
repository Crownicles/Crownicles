import {
	render, screen
} from "@testing-library/react-native";
import { KingChallengeProgress } from "ws-packets/src/objects/KingChallenge";
import { KingChallengeContent } from "@/src/components/KingChallenge";

jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (path: string): string => `icon:${path}`, getIconOrNull: (path: string): string => `icon:${path}`
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: {
	language: "en",
	t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key
} }));

const NOW = Date.parse("2026-11-04T10:00:00Z");
const HOUR = 3_600_000;

function progress(values: Partial<KingChallengeProgress> = {}): KingChallengeProgress {
	return {
		weeklyScore: 2_500,
		tier: 1,
		thresholds: [
			2_000,
			3_100,
			4_800,
			39_400
		],
		nextResetDate: NOW + (2 * 24 + 5) * HOUR,
		...values
	};
}

function tierTitles(): string[] {
	return screen.getAllByRole("button").map(row => row.props.accessibilityLabel);
}

describe("king's challenge", () => {
	it("tells the score of the week, the tiers crossed, how far the next tier is and when the king starts over", async () => {
		await render(<KingChallengeContent progress={progress()} now={NOW} />);
		expect(screen.getByText("app:kingChallenge.weeklyScore")).toBeTruthy();
		expect(screen.getByText("app:profile.formats.progress {\"value\":1,\"max\":4}")).toBeTruthy();
		expect(screen.getByText("app:kingChallenge.scoreProgress {\"value\":2500,\"max\":3100}")).toBeTruthy();
		expect(screen.getByText("app:kingChallenge.resetIn {\"duration\":\"app:adventure.duration.daysHours {\\\"days\\\":2,\\\"hours\\\":5}\"}")).toBeTruthy();
	});

	it("lists every tier with its threshold and rewards, the champion tier named last", async () => {
		await render(<KingChallengeContent progress={progress()} now={NOW} />);
		expect(tierTitles()).toEqual([
			"app:kingChallenge.tier {\"tier\":1}",
			"app:kingChallenge.tier {\"tier\":2}",
			"app:kingChallenge.tier {\"tier\":3}",
			"app:kingChallenge.championTier"
		]);
		expect(screen.getByText("750 icon:unitValues.money · 2 icon:unitValues.token")).toBeTruthy();
		expect(screen.getByText("1,750 icon:unitValues.money · 3 icon:unitValues.token · 1 icon:unitValues.gem")).toBeTruthy();
		expect(screen.getByText("39,400")).toBeTruthy();
	});

	it("sets the crossed tiers apart from the ones still ahead", async () => {
		await render(<KingChallengeContent progress={progress({ tier: 2 })} now={NOW} />);
		expect(screen.getAllByLabelText("icon:kingChallenge.tierReached")).toHaveLength(2);
		expect(screen.getAllByLabelText("icon:kingChallenge.tierPending")).toHaveLength(2);
	});

	it("says the challenge is over until the next one once the last tier is crossed", async () => {
		await render(<KingChallengeContent progress={progress({
			tier: 4, weeklyScore: 40_000, nextResetDate: NOW + 3 * HOUR
		})} now={NOW} />);
		expect(screen.getByText("commands:missions.kingChallenge.completed {\"time\":\"app:kingChallenge.resetIn {\\\"duration\\\":\\\"app:adventure.duration.hours {\\\\\\\"count\\\\\\\":3}\\\"}\"}")).toBeTruthy();
		expect(screen.queryByText(/app:kingChallenge\.scoreProgress/)).toBeNull();
	});

	it("tells the token cap of the tiers, and warns a player whose tokens already hold the next ones back", async () => {
		const view = await render(<KingChallengeContent progress={progress()} now={NOW} ownedTokens={5} />);
		expect(screen.getByText("app:kingChallenge.tokenRule {\"tokenCap\":20}")).toBeTruthy();
		expect(screen.queryByTestId("king-challenge-tokens-held")).toBeNull();

		await view.rerender(<KingChallengeContent progress={progress()} now={NOW} ownedTokens={22} />);
		expect(screen.getByText("app:kingChallenge.tokensHeld {\"tokens\":\"22\",\"tokenCap\":20}")).toBeTruthy();

		await view.rerender(<KingChallengeContent progress={progress({ tier: 4 })} now={NOW} ownedTokens={22} />);
		expect(screen.queryByTestId("king-challenge-tokens-held")).toBeNull();
	});
});
