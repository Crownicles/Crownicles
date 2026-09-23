import {render, screen} from "@testing-library/react-native";
import {BigEventOutcome, LotteryOutcome} from "@/src/collectors/AdventureCollector";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}`, tArray: (): string[] => []}}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: (): object => ({status: "ready", data: {pseudo: "Drapht"}})}));

describe("time lost to an event", () => {
	it("reads the alteration of a big event in minutes, as the game sends it", async () => {
		await render(<BigEventOutcome
			outcome={{eventId: 19, possibilityId: "cook", outcomeId: "success", score: 0, experience: 0, effect: {name: "sick", time: 90}, health: 0, money: 0, energy: 0, gems: 0, tokens: 0, oneshot: false}}
			onContinue={jest.fn()}
		/>);
		expect(screen.getByText(/hoursMinutes.*"hours":1,"minutes":30/)).toBeTruthy();
	});

	it("reads the time a lottery cost in minutes too", async () => {
		await render(<LotteryOutcome outcome={{kind: "lose", packet: {lostTime: 45, moneyLost: 0, level: "hard"}}} onContinue={jest.fn()} />);
		expect(screen.getByText("app:adventure.duration.minutes {\"count\":45}")).toBeTruthy();
	});
});
