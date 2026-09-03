import { ReactElement } from "react";
import { Text } from "react-native";
import { screen, waitFor, act } from "@testing-library/react-native";
import { useGameQuery } from "@/src/store/useGameQuery";
import { GAME_ENTITIES } from "@/src/store/GameEntities";
import { GameAnswer } from "@/src/networking/GameClient";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import {renderWithGameQuery} from "@/src/testing/testUtils";

/**
 * Screens regain focus through expo-router. Driving it by hand is what lets a test assert that
 * coming back to a screen asks the server again.
 *
 * The real hook keeps a single callback per component and drops it on unmount, so the double is
 * built on an effect rather than on a plain push, which would pile up one entry per render.
 */
let mockFocusCallbacks: (() => void)[] = [];

jest.mock("expo-router", () => ({
	useFocusEffect: (callback: () => void): void => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { useEffect } = require("react");
		useEffect(() => {
			mockFocusCallbacks.push(callback);
			return (): void => {
				mockFocusCallbacks = mockFocusCallbacks.filter(registered => registered !== callback);
			};
		}, [callback]);
	}
}));

async function regainFocus(): Promise<void> {
	await act(async () => {
		for (const callback of [...mockFocusCallbacks]) {
			callback();
		}
	});
}

function aProfile(pseudo: string): ProfileRes {
	return { pseudo } as ProfileRes;
}

function ProfileReader({readProfile}: {
	readProfile: () => Promise<GameAnswer<ProfileRes>>;
}): ReactElement {
	const state = useGameQuery<ProfileRes>(GAME_ENTITIES.PROFILE, readProfile);
	return <Text>{state.status === "ready" ? state.data.pseudo : state.status}</Text>;
}

describe("game state store", () => {
	beforeEach(() => {
		mockFocusCallbacks = [];
	});

	it("asks the server once when two components read the same entity", async () => {
		let calls = 0;
		const readProfile = (): Promise<GameAnswer<ProfileRes>> => {
			calls++;
			return Promise.resolve({ kind: "answer", packet: aProfile("Rocky") });
		};

		await renderWithGameQuery(
				<>
					<ProfileReader readProfile={readProfile} />
					<ProfileReader readProfile={readProfile} />
				</>
		);

		await waitFor(() => expect(screen.getAllByText("Rocky")).toHaveLength(2));
		expect(calls).toBe(1);
	});

	it("asks the server again when a screen regains focus after the data went stale", async () => {
		let calls = 0;
		const readProfile = (): Promise<GameAnswer<ProfileRes>> => {
			calls++;
			return Promise.resolve({ kind: "answer", packet: aProfile(`Rocky ${calls}`) });
		};

		await renderWithGameQuery(<ProfileReader readProfile={readProfile} />);
		await waitFor(() => expect(screen.getByText("Rocky 1")).toBeTruthy());

		// The cache compares timestamps rather than running timers, so the clock is what has to move
		const realNow = Date.now;
		Date.now = (): number => realNow() + 60_000;
		try {
			await regainFocus();
			await waitFor(() => expect(calls).toBe(2));
		}
		finally {
			Date.now = realNow;
		}

		// Waiting for the second answer to land leaves no request in flight for the next test
		await waitFor(() => expect(screen.getByText("Rocky 2")).toBeTruthy());
	});

	it("keeps serving the cached answer when the screen regains focus right away", async () => {
		let calls = 0;
		const readProfile = (): Promise<GameAnswer<ProfileRes>> => {
			calls++;
			return Promise.resolve({ kind: "answer", packet: aProfile("Rocky") });
		};

		await renderWithGameQuery(<ProfileReader readProfile={readProfile} />);
		await waitFor(() => expect(screen.getByText("Rocky")).toBeTruthy());

		await regainFocus();

		expect(calls).toBe(1);
	});
});
