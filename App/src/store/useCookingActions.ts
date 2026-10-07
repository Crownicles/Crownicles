import {useEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {CookingMenuReq, CookingIgniteReq, CookingReviveReq, CookingWoodConfirmReq, CookingCraftReq, CookingPinReq, CookingUnpinReq} from "ws-packets/src/fromClient/CookingReq";
import {CookingRes} from "ws-packets/src/fromServer/home/CookingRes";
import {CookingMenu, CookingOutcome} from "ws-packets/src/objects/Cooking";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {GameMutation, useGameMutation} from "@/src/store/useGameMutation";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

export type CookingRequest = CookingMenuReq | CookingIgniteReq | CookingReviveReq | CookingWoodConfirmReq | CookingCraftReq | CookingPinReq | CookingUnpinReq;
type CookingActions = GameMutation<CookingRequest> & {outcome: CookingOutcome | null};

export function cookingMenuFromOutcome(outcome: CookingOutcome): CookingMenu | undefined {
	if (outcome.kind === "crafted") return outcome.result.menu;
	return "menu" in outcome ? outcome.menu : undefined;
}

function cookingMessage(outcome: CookingOutcome): string | null {
	if (outcome.kind === "noWood" || outcome.kind === "unavailable") return i18n.t(`app:cooking.${outcome.kind}`);
	if (outcome.kind === "crafted" && outcome.result.error) return i18n.t(`app:cooking.errors.${outcome.result.error}`);
	return null;
}

export function useCookingActions(): CookingActions {
	const queryClient = useQueryClient();
	const [outcome, setOutcome] = useState<CookingOutcome | null>(null);
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return (): void => {active.current = false;};
	}, []);
	const mutation = useGameMutation(async (request: CookingRequest): Promise<string | null> => {
		const answer = await GameClient.request(request, CookingRes);
		if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
		if (answer.kind !== "answer") return i18n.t("app:common.connectionError");
		const nextOutcome = answer.packet.outcome;
		if (active.current) setOutcome(nextOutcome);
		if (cookingMenuFromOutcome(nextOutcome)) queryClient.setQueryData(gameKey(GAME_ENTITIES.COOKING), answer);
		await Promise.all([GAME_ENTITIES.HOME_CHEST, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.PROFILE, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.GUILD_STORAGE, GAME_ENTITIES.GUILD_DOMAIN, GAME_ENTITIES.PET].map(entity => queryClient.invalidateQueries({queryKey: gameKey(entity)})));
		return cookingMessage(nextOutcome);
	});
	return {...mutation, outcome};
}