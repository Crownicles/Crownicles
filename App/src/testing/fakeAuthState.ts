import React from "react";
import { AuthContext } from "@/src/authentication/AuthContext";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";

type AuthState = React.ContextType<typeof AuthContext>;

/** A signed-in session for screens rendered without the coordinator: each intention is a mock a test can override. */
export function fakeAuthState(overrides: Partial<AuthState> = {}): AuthState {
	return {
		state: AuthStateEnum.LOGGED_IN,
		collision: null,
		enter: jest.fn(() => Promise.resolve()),
		checkpoint: jest.fn(() => Promise.resolve()),
		leave: jest.fn(() => Promise.resolve()),
		retry: jest.fn(),
		accessToken: jest.fn().mockResolvedValue("access-token"),
		changeEmail: jest.fn(),
		changePassword: jest.fn(),
		...overrides
	};
}
