import {TopweekRecordTracker} from "@/src/gameServices/TopweekRecordTracker";
import {GameClient, GameAnswer} from "@/src/networking/GameClient";
import {TopReq} from "ws-packets/src/fromClient/RankingsReq";
import {TopEmptyRes, TopRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {TopDataType, TopTiming} from "ws-packets/src/objects/Rankings";
import {waitFor} from "@testing-library/react-native";

jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));

describe("topweek record requests", () => {
	beforeEach(() => jest.clearAllMocks());

	it("asks Core for the current player's own weekly score page", async () => {
		const record = jest.fn((): Promise<void> => Promise.resolve());
		const response = Object.assign(new TopRes(), {dataType: TopDataType.SCORE, timing: TopTiming.WEEK, elements: []});
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: response});
		const tracker = new TopweekRecordTracker(record);
		tracker.start();
		await waitFor(() => expect(record).toHaveBeenCalledWith(response));
		expect(GameClient.request).toHaveBeenCalledWith(expect.objectContaining({dataType: TopDataType.SCORE, timing: TopTiming.WEEK}), TopRes, [TopEmptyRes]);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(TopReq);
		tracker.stop();
	});

	it("discards a response from a session that has already ended", async () => {
		let respond!: (answer: GameAnswer<TopRes>) => void;
		jest.mocked(GameClient.request).mockReturnValue(new Promise<GameAnswer<TopRes>>(resolve => {respond = resolve;}));
		const record = jest.fn((): Promise<void> => Promise.resolve());
		const tracker = new TopweekRecordTracker(record);
		tracker.start();
		tracker.stop();
		respond({kind: "answer", packet: new TopRes()});
		await Promise.resolve();
		expect(record).not.toHaveBeenCalled();
	});

	it("coalesces overlapping refreshes rather than starting concurrent requests", async () => {
		let respond!: (answer: GameAnswer<TopRes>) => void;
		jest.mocked(GameClient.request).mockReturnValueOnce(new Promise<GameAnswer<TopRes>>(resolve => {respond = resolve;})).mockResolvedValue({kind: "timeout"});
		const tracker = new TopweekRecordTracker(() => Promise.resolve());
		tracker.start();
		tracker.refresh();
		tracker.refresh();
		expect(GameClient.request).toHaveBeenCalledTimes(1);
		respond({kind: "timeout"});
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(2));
		tracker.stop();
	});
});