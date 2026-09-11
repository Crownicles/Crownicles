import {ReactNode} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {RequestState} from "@/src/store/useGameQuery";
import {GameEntity, gameKey} from "@/src/store/GameEntities";
import {Button, ButtonRow, EmptyState, Note} from "@/src/design/Primitives";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

export function GameQueryContent<Answer extends FromServerPacket>({state, entity, children}: {state: RequestState<Answer>; entity: GameEntity; children: (data: Answer) => ReactNode}): ReactNode {
	const queryClient = useQueryClient();
	if (state.status === "ready") return children(state.data);
	if (state.status === "loading") return <EmptyState>{i18n.t("app:common.loading")}</EmptyState>;
	if (state.status === "empty") return <EmptyState>{i18n.t("app:reference.empty")}</EmptyState>;
	return <>
		<Note>{state.rejection ? commandRejectionMessage(state.rejection) : i18n.t("app:common.error")}</Note>
		<ButtonRow><Button onPress={(): void => {queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);}}>{i18n.t("app:common.retry")}</Button></ButtonRow>
	</>;
}