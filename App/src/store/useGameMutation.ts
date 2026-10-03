import {useEffect, useRef, useState} from "react";
import {i18n} from "@/src/translations/i18n";

export type GameMutation<Action> = {pending: boolean; message: string | null; submit: (action: Action) => Promise<void>};

export function useGameMutation<Action>(run: (action: Action) => Promise<string | null>): GameMutation<Action> {
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const inFlight = useRef(false);
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return (): void => {active.current = false;};
	}, []);
	const submit = async (action: Action): Promise<void> => {
		if (inFlight.current) return;
		inFlight.current = true;
		setPending(true);
		setMessage(null);
		try {
			const result = await run(action);
			if (active.current) setMessage(result);
		}
		catch {
			if (active.current) setMessage(i18n.t("app:common.connectionError"));
		}
		finally {
			inFlight.current = false;
			if (active.current) setPending(false);
		}
	};
	return {pending, message, submit};
}