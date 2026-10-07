import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {AdventureHistoryReq} from "ws-packets/src/fromClient/AdventureHistoryReq";
import {AdventureHistoryRes} from "ws-packets/src/fromServer/history/AdventureHistoryRes";
import {AdventureHistoryEvent} from "ws-packets/src/objects/AdventureHistory";
import {AdventureJournalContent} from "@/src/components/AdventureJournal";
import {GameClient} from "@/src/networking/GameClient";

jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key, language: "fr"}}));

const UNTIL = 1_900_000_000_000;

function page(entries: AdventureHistoryEvent[], nextPage?: number, available = true): AdventureHistoryRes {
	return Object.assign(new AdventureHistoryRes(), {available, entries, until: UNTIL, windowStartsAt: UNTIL - 604_800_000, ...nextPage === undefined ? {} : {nextPage}});
}

const ROYAL_TIMEOUT: AdventureHistoryEvent = {date: UNTIL - 60_000, eventId: 60, possibilityId: "end", outcomeId: "0", mapId: 29};
const VILLAGE_FIGHT: AdventureHistoryEvent = {date: UNTIL - 120_000, eventId: 47, possibilityId: "goAway", outcomeId: "4"};

describe("adventure journal", () => {
	beforeEach(() => jest.clearAllMocks());

	it("tells each memory with its choice, place, situation and outcome", async () => {
		await render(<AdventureJournalContent first={page([VILLAGE_FIGHT])} />);

		const entry = screen.getByRole("button", {name: "events:47.possibilities.goAway.text"});
		expect(screen.getByText(/app:adventure.unknownLocation/)).toBeTruthy();
		await fireEvent.press(entry);

		expect(screen.getByText("events:47.text")).toBeTruthy();
		expect(screen.getByText("events:47.possibilities.goAway.outcomes.4")).toBeTruthy();
	});

	it("names an unanswered event instead of a choice the player never made", async () => {
		await render(<AdventureJournalContent first={page([ROYAL_TIMEOUT])} />);

		expect(screen.getByRole("button", {name: "app:adventure.journal.noAnswer"})).toBeTruthy();
		expect(screen.getByText(/models:map_locations.29.name/)).toBeTruthy();
	});

	it("loads older memories within the same time fence and stops when none remain", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: page([VILLAGE_FIGHT])});
		await render(<AdventureJournalContent first={page([ROYAL_TIMEOUT], 1)} />);

		await fireEvent.press(screen.getByText("app:adventure.journal.more"));

		await screen.findByRole("button", {name: "events:47.possibilities.goAway.text"});
		const [request, expected] = jest.mocked(GameClient.request).mock.calls[0];
		expect(request).toBeInstanceOf(AdventureHistoryReq);
		expect(request).toMatchObject({page: 1, until: UNTIL});
		expect(expected).toBe(AdventureHistoryRes);
		expect(screen.getByRole("button", {name: "app:adventure.journal.noAnswer"})).toBeTruthy();
		expect(screen.queryByText("app:adventure.journal.more")).toBeNull();
	});

	it("keeps the memories already read and offers to try again when an older page fails", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await render(<AdventureJournalContent first={page([ROYAL_TIMEOUT], 1)} />);

		await fireEvent.press(screen.getByText("app:adventure.journal.more"));

		await waitFor(() => expect(screen.getByText("app:adventure.journal.unavailable")).toBeTruthy());
		expect(screen.getByRole("button", {name: "app:adventure.journal.noAnswer"})).toBeTruthy();
		expect(screen.getByText("app:adventure.journal.more")).toBeTruthy();
	});

	it("says when the logs could not be read rather than claiming there is nothing to remember", async () => {
		await render(<AdventureJournalContent first={page([], undefined, false)} />);

		expect(screen.getByText("app:adventure.journal.unavailable")).toBeTruthy();
		expect(screen.queryByText("app:adventure.journal.empty")).toBeNull();
	});

	it("says when nothing happened during the window", async () => {
		await render(<AdventureJournalContent first={page([])} />);

		expect(screen.getByText("app:adventure.journal.empty")).toBeTruthy();
	});
});
