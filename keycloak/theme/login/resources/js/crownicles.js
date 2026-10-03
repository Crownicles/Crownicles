"use strict";

document.addEventListener("DOMContentLoaded", () => {
	// The link is often opened in the mail app: coming back to this page resumes the sign-up.
	const resume = document.getElementById("crownicles-verify-email-continue");
	const elsewhere = document.getElementById("crownicles-verify-email-elsewhere");
	if (resume && elsewhere) {
		document.addEventListener("visibilitychange", async () => {
			if (document.visibilityState !== "visible") {
				return;
			}
			try {
				const response = await fetch(resume.href, { credentials: "same-origin" });
				if (!response.ok) {
					// Opening the link in another browser moves the sign-up there.
					elsewhere.hidden = false;
					resume.hidden = true;
					return;
				}
				window.location.replace(response.url);
			}
			catch {
				// The flow ended with the redirection to the app, which fetch cannot follow.
				window.location.replace(resume.href);
			}
		});
	}
});
