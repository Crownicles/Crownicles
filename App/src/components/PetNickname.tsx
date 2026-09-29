import {ReactNode, useState} from "react";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {TEXT_RULE_IDS} from "ws-packets/src/objects/TextRules";
import {checkText} from "@/src/rules/InputChecks";
import {TextField} from "@/src/design/Inputs";
import {FormBlock} from "@/src/design/KeyboardAvoidance";
import {Button, ButtonRow, Note} from "@/src/design/Primitives";
import {usePetActions} from "@/src/store/usePetActions";
import {petNickname} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";
import {ExpandableList, Fact} from "@/src/design/Sections";

export function PetNickname({pet}: {pet: OwnedPet}): ReactNode {
	const [nickname, setNickname] = useState(pet.nickname || "");
	const {pending, message, failed, care, clearMessage} = usePetActions();
	const checked = checkText(nickname, TEXT_RULE_IDS.PET_NICKNAME);
	const clear = async (): Promise<void> => {
		if (await care({type: "rename", nickname: ""})) setNickname("");
	};
	return <>
		<ExpandableList><Fact label={i18n.t("app:pet.fields.nickname")} value={petNickname(pet)} /></ExpandableList>
		<FormBlock>
			<TextField label={i18n.t("app:pet.care.newNickname")} value={nickname} onChangeText={(value): void => {
				setNickname(value);
				clearMessage();
			}} editable={!pending} autoCorrect={false} lock={checked.lock} refusal={failed ? message : null} />
			{message && !failed ? <Note>{message}</Note> : null}
			<ButtonRow>
				<Button variant="primary" disabled={pending || checked.lock !== null} onPress={(): void => {care({type: "rename", nickname: checked.value}).catch(console.error);}}>{i18n.t("app:pet.care.save")}</Button>
				<Button disabled={pending} onPress={clear}>{i18n.t("app:pet.care.clear")}</Button>
			</ButtonRow>
		</FormBlock>
	</>;
}