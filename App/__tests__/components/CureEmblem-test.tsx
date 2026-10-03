import {act, fireEvent, render, screen} from "@testing-library/react-native";
import {HappyEmblem} from "@/src/components/CureEmblem";

jest.mock("expo-haptics", () => ({impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: {Heavy: "heavy"}}));

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {getIconOrNull: (path: string): string | null => (path === "other.explosion" ? "💥" : null)}
}));

const TAP_EVERY_MS = 500;
const SPAM_MS = 10_000;
const BLAST_MS = 650;
const GONE_MS = 3_000;
const RETURN_MS = 420;

async function elapse(ms: number): Promise<void> {
	await act(async () => {
		jest.advanceTimersByTime(ms);
	});
}

async function tap(): Promise<void> {
	await fireEvent.press(screen.getByTestId("happy-emblem"));
}

// Simulated clock: on the real one, a loaded machine lets the animations overrun the waits.
describe("HappyEmblem easter egg", () => {
	beforeEach(() => {
		jest.useFakeTimers({now: 1_700_000_000_000});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("blows up after ten seconds of frantic tapping, then comes back after a blank", async () => {
		await render(<HappyEmblem emoji="😃" />);

		for (let elapsed = 0; elapsed < SPAM_MS; elapsed += TAP_EVERY_MS) {
			await tap();
			await elapse(TAP_EVERY_MS);
		}
		expect(screen.queryByLabelText("💥")).toBeNull();
		await tap();

		expect(screen.getByLabelText("💥")).toBeTruthy();
		await elapse(BLAST_MS);
		expect(screen.queryByLabelText("😃")).toBeNull();
		expect(screen.queryByLabelText("💥")).toBeNull();
		await elapse(GONE_MS + RETURN_MS);
		expect(screen.getByLabelText("😃")).toBeTruthy();
	});

	it("only dances when the taps come with pauses", async () => {
		await render(<HappyEmblem emoji="😃" />);

		for (let elapsed = 0; elapsed <= SPAM_MS; elapsed += 2_000) {
			await tap();
			await elapse(2_000);
		}

		expect(screen.queryByLabelText("💥")).toBeNull();
		expect(screen.getByLabelText("😃")).toBeTruthy();
	});
});
