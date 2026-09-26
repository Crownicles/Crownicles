import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {HomeChest} from "@/src/components/HomeChest";
import {HomeCooking} from "@/src/components/HomeCooking";
import {HomeGarden} from "@/src/components/HomeGarden";
import {HOME_SERVICES} from "@/src/navigation/HomeServices";
import {DetailScreen} from "@/src/design/DetailScreen";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

function HomeServiceContent({service}: {service?: string | string[]}): ReactNode {
	switch (service) {
		case HOME_SERVICES.CHEST: return <HomeChest />;
		case HOME_SERVICES.COOKING: return <HomeCooking />;
		case HOME_SERVICES.GARDEN: return <HomeGarden />;
		default: return <Note>{i18n.t("app:common.error")}</Note>;
	}
}

export default function HomeServiceScreen(): ReactNode {
	const {service} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};
	const titles = {[HOME_SERVICES.CHEST]: "app:homeChest.title", [HOME_SERVICES.COOKING]: "app:city.labels.cooking", [HOME_SERVICES.GARDEN]: "app:city.labels.garden"};
	const title = typeof service === "string" && service in titles ? titles[service as keyof typeof titles] : "app:city.labels.home";
	return <DetailScreen eyebrow={i18n.t("app:city.labels.home")} title={i18n.t(title)} onClose={close}><HomeServiceContent service={service} /></DetailScreen>;
}