import {
	useCallback, useContext, useRef, useState
} from "react";
import {
	ACCOUNT_ACTION_OUTCOMES, AccountActionOutcome
} from "@/src/authentication/KeycloakAuth";
import { AuthContext } from "./AuthContext";

export type AccountAction = {
	running: boolean;
	failed: boolean;
	start: () => void;
};

/** One account action at a time, and its failure kept until the next attempt. */
export function useAccountAction(run: () => Promise<AccountActionOutcome>, onOutcome: (outcome: AccountActionOutcome) => void): AccountAction {
	const [running, setRunning] = useState(false);
	const [failed, setFailed] = useState(false);
	const pending = useRef(false);

	const start = useCallback((): void => {
		if (pending.current) {
			return;
		}
		pending.current = true;
		setRunning(true);
		setFailed(false);
		run()
			.then(onOutcome)
			.catch((error: unknown) => {
				console.warn("Account action failed:", error);
				setFailed(true);
			})
			.finally(() => {
				pending.current = false;
				setRunning(false);
			});
	}, [run, onOutcome]);

	return {
		running, failed, start
	};
}

export type PasswordChange = AccountAction & {

	/** The new password is saved: the next sign-in can use it instead of a link. */
	saved: boolean;
};

export function usePasswordChange(): PasswordChange {
	const auth = useContext(AuthContext);
	const [saved, setSaved] = useState(false);
	const onOutcome = useCallback((outcome: AccountActionOutcome): void => {
		setSaved(outcome === ACCOUNT_ACTION_OUTCOMES.UPDATED);
	}, []);
	return {
		...useAccountAction(auth.changePassword, onOutcome),
		saved
	};
}
