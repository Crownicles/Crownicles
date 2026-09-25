import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {HappyEmblem} from "@/src/components/CureEmblem";

jest.mock("expo-haptics", () => ({impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: {Heavy: "heavy"}}));

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {getIconOrNull: (path: string): string | null => (path === "other.explosion" ? "💥" : null)}
}));

const TAP_EVERY_MS = 500;
const SPAM_MS = 10_000;

describe("HappyEmblem easter egg", () => {
	afterEach(() => jest.restoreAllMocks());

	it("blows up after ten seconds of frantic tapping, then comes back after a blank", async () => {
		let now = 1_700_000_000_000;
		const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
		await render(<HappyEmblem emoji="😃" />);

		for (let elapsed = 0; elapsed < SPAM_MS; elapsed += TAP_EVERY_MS) {
			await fireEvent.press(screen.getByTestId("happy-emblem"));
			now += TAP_EVERY_MS;
		}
		expect(screen.queryByLabelText("💥")).toBeNull();
		await fireEvent.press(screen.getByTestId("happy-emblem"));
		clock.mockRestore();

		expect(screen.getByLabelText("💥")).toBeTruthy();
		await waitFor(() => expect(screen.queryByLabelText("😃")).toBeNull(), {timeout: 2_000});
		await waitFor(() => expect(screen.getByLabelText("😃")).toBeTruthy(), {timeout: 5_000});
		expect(screen.queryByLabelText("💥")).toBeNull();
	}, 10_000);

	it("only dances when the taps come with pauses", async () => {
		let now = 1_700_000_000_000;
		jest.spyOn(Date, "now").mockImplementation(() => now);
		await render(<HappyEmblem emoji="😃" />);

		for (let elapsed = 0; elapsed <= SPAM_MS; elapsed += 2_000) {
			await act(async () => {
				await fireEvent.press(screen.getByTestId("happy-emblem"));
			});
			now += 2_000;
		}

		expect(screen.queryByLabelText("💥")).toBeNull();
		expect(screen.getByLabelText("😃")).toBeTruthy();
	});
});
