import {useEffect} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {GameEntity, gameKey} from "@/src/store/GameEntities";

export function useGameDeadline(entity: GameEntity, deadline: number | null): void {
	const queryClient = useQueryClient();
	useEffect(() => {
		const timer = deadline === null ? null : setTimeout(() => {
			queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
		}, Math.max(0, deadline - Date.now()));
		return (): void => {if (timer !== null) clearTimeout(timer);};
	}, [deadline, entity, queryClient]);
}