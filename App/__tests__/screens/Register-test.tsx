import {
	fireEvent, render, screen, waitFor
} from "@testing-library/react-native";
import {Alert} from "react-native";
import React from "react";
import RegisterScreen from "@/app/register";
import {AssetsManager} from "@/src/assets/AssetsManager";
import {
	MINIMUM_PASSWORD_LENGTH, REGISTRATION_FAILURES, RegistrationFailure, registerAccount
} from "@/src/authentication/Registration";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({useRouter: (): object => ({back: mockBack})}));
jest.mock("@/src/assets/AssetsManager", () => ({AssetsManager: {
	areAssetsReady: jest.fn().mockReturnValue(true),
	updateAssets: jest.fn().mockResolvedValue(undefined)
}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/authentication/Registration", () => {
	const actual = jest.requireActual("@/src/authentication/Registration");
	return {
		...actual,
		registerAccount: jest.fn()
	};
});

async function fillValidDraft(): Promise<void> {
	await fireEvent.changeText(screen.getByLabelText("app:register.fields.username"), "Aventurier");
	await fireEvent.changeText(screen.getByLabelText("app:register.fields.email"), "joueur@example.com");
	await fireEvent.changeText(screen.getByLabelText("app:register.fields.password"), "a".repeat(MINIMUM_PASSWORD_LENGTH));
}

describe("register screen", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
		// clearAllMocks wipes what the module factory set up, and the screen calls both on mount.
		jest.mocked(AssetsManager.areAssetsReady).mockReturnValue(true);
		jest.mocked(AssetsManager.updateAssets).mockResolvedValue(undefined);
		jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
	});

	it("says what the draft is missing before the button is pressed", async () => {
		await render(<RegisterScreen />);

		expect(screen.getByText("app:register.requirements.invalid")).toBeTruthy();
	});

	it("names the reserved prefix rather than refusing without a word", async () => {
		await render(<RegisterScreen />);

		await fireEvent.changeText(screen.getByLabelText("app:register.fields.username"), "discord-1234");
		await fireEvent.changeText(screen.getByLabelText("app:register.fields.email"), "joueur@example.com");
		await fireEvent.changeText(screen.getByLabelText("app:register.fields.password"), "a".repeat(MINIMUM_PASSWORD_LENGTH));

		expect(screen.getByText("app:register.requirements.taken")).toBeTruthy();
	});

	it("drops the hint once the draft holds together", async () => {
		await render(<RegisterScreen />);

		await fillValidDraft();

		expect(screen.queryByText("app:register.requirements.invalid")).toBeNull();
	});

	it("invites the player to read their mail rather than signing them in", async () => {
		jest.mocked(registerAccount).mockResolvedValue(undefined);
		await render(<RegisterScreen />);
		await fillValidDraft();

		await fireEvent.press(screen.getByText("app:register.submit"));

		await waitFor(() => expect(screen.getByText("app:register.sent.title")).toBeTruthy());
	});

	it("tells why the creation failed", async () => {
		jest.mocked(registerAccount).mockRejectedValue(new RegistrationFailure(REGISTRATION_FAILURES.TAKEN, "409"));
		await render(<RegisterScreen />);
		await fillValidDraft();

		await fireEvent.press(screen.getByText("app:register.submit"));

		await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("app:register.failed", "app:register.failures.taken"));
	});

	it("goes back to the login screen", async () => {
		await render(<RegisterScreen />);

		await fireEvent.press(screen.getByText("app:register.back"));

		expect(mockBack).toHaveBeenCalled();
	});
});
