import {useRef, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {useSecondsLeft} from "@/src/collectors/CollectorPrompt";

type CollectorAnswer = {locked: boolean; secondsLeft: number; answer: (index: number) => void};

export function useCollectorAnswer(collector: ReactionCollectorCreation, onChoose: (index: number) => void, submitting: boolean): CollectorAnswer {
	const [answered, setAnswered] = useState(false);
	const sent = useRef(false);
	const secondsLeft = useSecondsLeft(collector.endTime);
	const locked = submitting || answered || secondsLeft === 0;
	const answer = (index: number): void => {
		if (index < 0 || Date.now() >= collector.endTime) return;
		if (sent.current || locked) return;
		sent.current = true;
		setAnswered(true);
		onChoose(index);
	};
	return {locked, secondsLeft, answer};
}