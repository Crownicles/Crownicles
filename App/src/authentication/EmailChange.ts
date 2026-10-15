import {
	useCallback, useContext, useEffect, useState
} from "react";
import { AppState } from "react-native";
import {
	ACCOUNT_ACTION_OUTCOMES, AccountActionOutcome, KeycloakAuth
} from "@/src/authentication/KeycloakAuth";
import { useAccountAction } from "@/src/authentication/AccountAction";
import { AuthContext } from "./AuthContext";

export type EmailChange = {

	/** The address of the account, unknown until Keycloak answered. */
	email: string | null;
	changing: boolean;

	/** A confirmation link waits on the new address, so the shown one has not changed yet. */
	awaitingLink: boolean;
	failed: boolean;
	change: () => void;
};

async function readAccountEmail(access: () => Promise<string | null>): Promise<string | null> {
	const accessToken = await access();
	return accessToken ? KeycloakAuth.accountEmail(accessToken) : null;
}

/**
 * The account address and the way to change it.
 *
 * The change is confirmed from a mail, usually in the phone's browser: the address is read again
 * each time the player comes back to the game.
 */
export function useEmailChange(): EmailChange {
	const auth = useContext(AuthContext);
	const [email, setEmail] = useState<string | null>(null);
	const [linkSentFrom, setLinkSentFrom] = useState<string | null>(null);

	const refresh = useCallback((): void => {
		readAccountEmail(auth.accessToken).then(setEmail)
			.catch((error: unknown) => console.warn("Account email not read:", error));
	}, [auth.accessToken]);

	useEffect(() => {
		refresh();
		const subscription = AppState.addEventListener("change", state => {
			if (state === "active") {
				refresh();
			}
		});
		return (): void => subscription.remove();
	}, [refresh]);

	const onOutcome = useCallback((outcome: AccountActionOutcome): void => {
		if (outcome === ACCOUNT_ACTION_OUTCOMES.PENDING) {
			setLinkSentFrom(email);
		}
		refresh();
	}, [email, refresh]);
	const action = useAccountAction(auth.changeEmail, onOutcome);

	return {
		email,
		changing: action.running,
		awaitingLink: linkSentFrom !== null && linkSentFrom === email,
		failed: action.failed,
		change: action.start
	};
}
