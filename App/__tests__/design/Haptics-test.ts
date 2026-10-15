import {
	impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType, selectionAsync
} from "expo-haptics";
import { getVolume } from "react-native-volume-manager";
import { Haptics } from "@/src/design/Haptics";
import {
	HAPTICS_MODES, hapticsPreference
} from "@/src/preferences/HapticsPreference";

jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(() => Promise.resolve()),
	notificationAsync: jest.fn(() => Promise.resolve()),
	selectionAsync: jest.fn(() => Promise.resolve()),
	ImpactFeedbackStyle: { Heavy: "heavy" },
	NotificationFeedbackType: { Success: "success" }
}));

async function settle(): Promise<void> {
	await new Promise(resolve => setImmediate(resolve));
}

function phoneVolume(volume: number): void {
	jest.mocked(getVolume).mockResolvedValue({ volume });
}

describe("vibration setting", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		phoneVolume(1);
	});

	afterAll(() => {
		hapticsPreference.set(HAPTICS_MODES.ALWAYS);
	});

	it("vibrates by default, whatever the volume", async () => {
		phoneVolume(0);

		Haptics.impact(ImpactFeedbackStyle.Heavy);
		await settle();

		expect(impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Heavy);
		expect(getVolume).not.toHaveBeenCalled();
	});

	it("never vibrates once the player turned vibrations off", async () => {
		hapticsPreference.set(HAPTICS_MODES.NEVER);

		Haptics.impact(ImpactFeedbackStyle.Heavy);
		Haptics.notification(NotificationFeedbackType.Success);
		Haptics.selection();
		await settle();

		expect(impactAsync).not.toHaveBeenCalled();
		expect(notificationAsync).not.toHaveBeenCalled();
		expect(selectionAsync).not.toHaveBeenCalled();
	});

	it("stays still on a muted phone when vibrations follow the sound", async () => {
		hapticsPreference.set(HAPTICS_MODES.WITH_SOUND);
		phoneVolume(0);

		Haptics.notification(NotificationFeedbackType.Success);
		await settle();

		expect(notificationAsync).not.toHaveBeenCalled();
	});

	it("vibrates when vibrations follow the sound and the volume is up", async () => {
		hapticsPreference.set(HAPTICS_MODES.WITH_SOUND);
		phoneVolume(0.4);

		Haptics.selection();
		await settle();

		expect(selectionAsync).toHaveBeenCalled();
	});

	it("stays still when the volume cannot be read", async () => {
		hapticsPreference.set(HAPTICS_MODES.WITH_SOUND);
		jest.mocked(getVolume).mockRejectedValue(new Error("not linked"));

		Haptics.selection();
		await settle();

		expect(selectionAsync).not.toHaveBeenCalled();
	});
});
