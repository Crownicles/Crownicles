import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export function className(classId: number): string {
	return i18n.t("app:classes.name", {icon: AppIcons.getIcon(`classes.${classId}`), name: i18n.t(`models:classes.${classId}`)});
}