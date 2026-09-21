import {ReactNode} from "react";
import {Screen} from "@/src/design/Primitives";
import {BackButton, Standing} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {i18n} from "@/src/translations/i18n";

export function DetailScreen({title, eyebrow, onClose, overlay, children}: {title: string; eyebrow: string; onClose: () => void; overlay?: boolean; children: ReactNode}): ReactNode {
	return <SwipeBack onClose={onClose} {...overlay ? {overlay} : {}}>
		<Screen>
			<BackButton label={i18n.t("app:common.back")} onClose={onClose} />
			<Standing caption={eyebrow} title={title} />
			{children}
		</Screen>
	</SwipeBack>;
}
