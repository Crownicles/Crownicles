import {ReactNode, useState} from "react";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {TextField} from "@/src/design/Inputs";
import {Button, ButtonRow, KeyValue, Note, Panel} from "@/src/design/Primitives";
import {usePetActions} from "@/src/store/usePetActions";
import {petNickname} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

export function PetNickname({pet}: {pet: OwnedPet}): ReactNode {
	const [nickname, setNickname] = useState(pet.nickname || "");
	const {pending, message, care} = usePetActions();
	const clear = async (): Promise<void> => {
		if (await care({type: "rename", nickname: ""})) setNickname("");
	};
	return <>
		<Panel><KeyValue label={i18n.t("app:pet.fields.nickname")} value={petNickname(pet)} /></Panel>
		<TextField label={i18n.t("app:pet.care.newNickname")} value={nickname} onChangeText={setNickname} editable={!pending} />
		{message ? <Note>{message}</Note> : null}
		<ButtonRow>
			<Button variant="primary" disabled={pending} onPress={(): void => {care({type: "rename", nickname}).catch(console.error);}}>{i18n.t("app:pet.care.save")}</Button>
			<Button disabled={pending} onPress={clear}>{i18n.t("app:pet.care.clear")}</Button>
		</ButtonRow>
	</>;
}