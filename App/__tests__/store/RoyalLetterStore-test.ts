import AsyncStorage from "@react-native-async-storage/async-storage";
import {RoyalLetterRes} from "ws-packets/src/fromServer/onboarding/RoyalLetterRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {royalLetterStore} from "@/src/store/RoyalLetterStore";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

function letter(number: number): RoyalLetterRes {
	return Object.assign(new RoyalLetterRes(), {letter: number, letters: 7, tokens: 20, money: 2000, gems: 0});
}

describe("royal letters", () => {
	it("keeps unread letters through account changes, and shows only the current account's queue", async () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(RoyalLetterRes.wireName, letter(1));
		await royalLetterStore.load("newcomer");
		expect(royalLetterStore.getSnapshot().unread.map(item => item.letter)).toEqual([1]);

		registry.dispatch(RoyalLetterRes.wireName, letter(2));
		await royalLetterStore.load("another-player");
		expect(royalLetterStore.getSnapshot().unread).toEqual([]);
		registry.dispatch(RoyalLetterRes.wireName, letter(3));
		await royalLetterStore.load("newcomer");
		expect(royalLetterStore.getSnapshot().unread.map(item => item.letter)).toEqual([1, 2]);
		royalLetterStore.read();
		expect(royalLetterStore.getSnapshot().unread.map(item => item.letter)).toEqual([2]);
		await royalLetterStore.load("another-player");
		expect(royalLetterStore.getSnapshot().unread.map(item => item.letter)).toEqual([3]);
		royalLetterStore.read();
		expect(await AsyncStorage.getItem("royal-letters:another-player")).toBeNull();
	});
});