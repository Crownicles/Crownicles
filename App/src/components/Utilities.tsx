import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {RespawnReq, UnlockReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {PlayerUtilityRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {Button, ButtonRow, Confirmation, Note} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {i18n} from "@/src/translations/i18n";

const UTILITY_MENUS = {
	respawn: {request: RespawnReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [PlayerUtilityRes]},
	unlock: {request: UnlockReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [PlayerUtilityRes]}
} satisfies Record<string, CommandMenu>;

export function RespawnAction(): ReactNode {
	const [confirming, setConfirming] = useState(false);
	const {pending, message, open} = useCommandMenus();
	return <>
		<ButtonRow><Button disabled={pending} onPress={(): void => setConfirming(true)}>{i18n.t("app:utilities.respawn")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
		{confirming ? <Confirmation title={i18n.t("app:utilities.respawn")} message={i18n.t("app:utilities.respawnWarning")} onRequestClose={(): void => setConfirming(false)}>
			<ButtonRow>
				<Button variant="primary" disabled={pending} onPress={(): void => {setConfirming(false); open(UTILITY_MENUS.respawn).catch(console.error);}}>{i18n.t("app:collector.accept")}</Button>
				<Button onPress={(): void => setConfirming(false)}>{i18n.t("app:collector.refuse")}</Button>
			</ButtonRow>
		</Confirmation> : null}
	</>;
}

export function PrisonerRelease(): ReactNode {
	const [rank, setRank] = useState("");
	const {pending, message, open} = useCommandMenus();
	const rankValue = Number(rank);
	return <>
		<TextField label={i18n.t("app:utilities.prisonerRank")} value={rank} onChangeText={setRank} keyboardType="number-pad" />
		<ButtonRow><Button disabled={pending || !Number.isSafeInteger(rankValue) || rankValue < 1} onPress={(): Promise<void> => open(UTILITY_MENUS.unlock, makeFromClientPacket(UnlockReq, {rank: rankValue}))}>{i18n.t("app:utilities.unlock")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
	</>;
}
