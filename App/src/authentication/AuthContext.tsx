import React, {
	PropsWithChildren, useEffect
} from "react";
import {
	useNavigationContainerRef, useRouter
} from "expo-router";
import {
	deleteStoredToken, readFullStoredToken, readStoredToken, TOKEN_STORAGE_KEY_TEMPLATE, writeStoredToken
} from "@/src/authentication/TokenStorage";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import { AuthToken } from "@/src/authentication/AuthToken";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";
import { collectorsStore } from "@/src/collectors/CollectorsStore";
import { reportEventStore } from "@/src/collectors/ReportEventStore";
import { fightStore } from "@/src/store/FightStore";
import {
	CollisionSession, SessionConnection, SessionCoordinator, SessionStorage
} from "./SessionCoordinator";
import { AccountActionOutcome } from "./KeycloakAuth";

/** States of a session already shown to the player: logging in again from them is not a first arrival */
const SESSION_STATES: ReadonlySet<AuthStateEnum> = new Set([
	AuthStateEnum.LOGGED_IN,
	AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE,
	AuthStateEnum.RECONNECTING_PACKET_QUEUE
]);

/** The root screens on either side of the session. */
const ROOT_SCREENS = {
	GAME: "(protected)",
	LOGIN: "login"
} as const;

type RootScreen = typeof ROOT_SCREENS[keyof typeof ROOT_SCREENS];

/** States that send the player back to the login screen */
const LOGIN_STATES: ReadonlySet<AuthStateEnum> = new Set([
	AuthStateEnum.NO_TOKEN,
	AuthStateEnum.TOKEN_INVALID_OR_EXPIRED,
	AuthStateEnum.ACCOUNT_COLLISION
]);

/** Keychain values are capped in size: the token is stored in numbered parts, read until one is missing. */
const TOKEN_PART_LENGTH = 2048;

async function loadStoredToken(): Promise<AuthToken | null> {
	const token = await readFullStoredToken();
	return token ? AuthToken.fromJsonString(token) : null;
}

async function clearStoredToken(): Promise<void> {
	for (let part = 1; ; part++) {
		const tokenStorageKey = `${TOKEN_STORAGE_KEY_TEMPLATE}${part}`;
		if (!await readStoredToken(tokenStorageKey)) {
			return;
		}
		await deleteStoredToken(tokenStorageKey);
	}
}

async function writeStoredSession(token: AuthToken): Promise<void> {
	await clearStoredToken();
	const tokenString = token.toJsonString();
	const tokenParts = tokenString.match(new RegExp(`.{1,${TOKEN_PART_LENGTH}}`, "gu")) ?? [tokenString];
	for (const [index, tokenPart] of tokenParts.entries()) {
		await writeStoredToken(`${TOKEN_STORAGE_KEY_TEMPLATE}${index + 1}`, tokenPart);
	}
}

/** Keychain writes and deletes run one after the other, so a refresh never lands in the middle of a logout. */
export function createSessionStorage(): SessionStorage {
	let edits: Promise<void> = Promise.resolve();
	const run = <Result,>(edit: () => Promise<Result>): Promise<Result> => {
		const done = edits.then(edit);
		edits = done.then((): void => undefined).catch((): void => undefined);
		return done;
	};
	return {
		read: (): Promise<AuthToken | null> => run(loadStoredToken),
		save: (token: AuthToken): Promise<void> => run(() => writeStoredSession(token)),
		clear: (): Promise<void> => run(clearStoredToken)
	};
}

const GAME_SOCKET: SessionConnection = {
	open: (access, onState): Promise<void> => WebSocketClient.getInstance().init(access, onState),
	close: (): void => WebSocketClient.getInstance().disconnect()
};

/** Reopening ends in a phase rather than a rejection: only an unexpected failure is reported here. */
function reopen(session: SessionCoordinator): Promise<void> {
	return session.restore().catch((error: unknown) => console.error("The session could not be reopened", error));
}

/** What screens may ask of the session: intentions only, every transition stays the coordinator's. */
type AuthState = {
	state: AuthStateEnum;
	collision: CollisionSession | null;
	enter: (token: AuthToken) => Promise<void>;
	checkpoint: (token: AuthToken) => Promise<void>;
	leave: () => Promise<void>;
	retry: () => void;
	accessToken: () => Promise<string | null>;
	changeEmail: () => Promise<AccountActionOutcome>;
	changePassword: () => Promise<AccountActionOutcome>;
};

export const AuthContext = React.createContext<AuthState>({
	state: AuthStateEnum.NOT_READY,
	collision: null,
	enter: (): Promise<void> => Promise.reject(new Error("Session provider unavailable")),
	checkpoint: (): Promise<void> => Promise.reject(new Error("Session provider unavailable")),
	leave: (): Promise<void> => Promise.reject(new Error("Session provider unavailable")),
	retry: (): void => {
		console.warn("retry called without AuthContext.Provider");
	},
	accessToken: (): Promise<string | null> => Promise.resolve(null),
	changeEmail: (): Promise<AccountActionOutcome> => Promise.reject(new Error("Session provider unavailable")),
	changePassword: (): Promise<AccountActionOutcome> => Promise.reject(new Error("Session provider unavailable"))
});

export function AuthProvider({ children }: PropsWithChildren): React.ReactElement {
	const [state, setState] = React.useState(AuthStateEnum.NOT_READY); // Persist state: https://youtu.be/yNaOaR2kIa0?t=649
	const [collision, setCollision] = React.useState<CollisionSession | null>(null);
	const currentState = React.useRef(state);
	const router = useRouter();
	const navigationRef = useNavigationContainerRef();
	const initialNavigationTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const cancelPendingNavigation = (): void => {
		if (initialNavigationTimer.current !== null) {
			clearTimeout(initialNavigationTimer.current);
			initialNavigationTimer.current = null;
		}
	};

	/**
	 * Leaves the given screen alone in the root stack, so going back never crosses the session
	 * boundary. A link opened from a mail can stack the game over the login screen, for instance.
	 *
	 * AuthProvider is mounted just above the root navigator, so the first websocket callback can run
	 * before Expo Router has mounted it: the reset waits for it instead of being lost.
	 */
	const resetRootTo = (screen: RootScreen): void => {
		cancelPendingNavigation();
		const attempt = (): void => {
			if (!navigationRef.isReady()) {
				initialNavigationTimer.current = setTimeout(attempt, 100);
				return;
			}
			initialNavigationTimer.current = null;
			navigationRef.reset({
				index: 0, routes: [{ name: screen }]
			});
		};
		attempt();
	};

	const returnToLogin = (): void => {
		collectorsStore.reset();
		reportEventStore.reset();
		fightStore.reset();
		resetRootTo(ROOT_SCREENS.LOGIN);
	};

	const showState = (newState: AuthStateEnum): void => {
		const previousState = currentState.current;
		currentState.current = newState;
		setState(newState);
		console.log("Auth state changed from", previousState, "to", newState);

		if (newState === AuthStateEnum.LOGGED_IN && !SESSION_STATES.has(previousState)) {
			resetRootTo(ROOT_SCREENS.GAME);
		}
		else if (LOGIN_STATES.has(newState)) {
			returnToLogin();
		}
	};

	const coordinator = React.useRef<SessionCoordinator | null>(null);
	const [storage] = React.useState(createSessionStorage);
	const [actions] = React.useState(() => {
		const withSession = <Result,>(task: (session: SessionCoordinator) => Promise<Result>): Promise<Result> => {
			const session = coordinator.current;
			return session ? task(session) : Promise.reject(new Error("The session has not started"));
		};
		return {
			enter: (token: AuthToken): Promise<void> => withSession(session => session.enter(token)),
			checkpoint: (token: AuthToken): Promise<void> => withSession(session => session.checkpoint(token)),
			leave: (): Promise<void> => withSession(session => session.leave()),
			retry: (): void => {
				router.replace("/");
				withSession(reopen).catch((error: unknown) => console.warn("No session to reopen", error));
			},
			accessToken: (): Promise<string | null> => coordinator.current?.accessToken() ?? Promise.resolve(null),
			changeEmail: (): Promise<AccountActionOutcome> => withSession(session => session.changeEmail()),
			changePassword: (): Promise<AccountActionOutcome> => withSession(session => session.changePassword())
		};
	});

	const startSession = React.useEffectEvent((): SessionCoordinator => new SessionCoordinator(storage, GAME_SOCKET, {
		state: showState, collision: setCollision
	}));

	useEffect(() => {
		const session = startSession();
		coordinator.current = session;
		reopen(session);
		return (): void => {
			session.dispose();
			coordinator.current = null;
		};
	}, []);

	useEffect(() => cancelPendingNavigation, []);

	return (
		<AuthContext.Provider value={{
			state,
			collision,
			...actions
		}}>
			{children}
		</AuthContext.Provider>
	);
}
