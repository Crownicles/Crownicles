<#import "template.ftl" as layout>
<#-- Keycloak's own warning repeats the instruction below in an alarming box: only the other messages (cooldown, errors) are kept. -->
<#assign showMessage = !(message?? && message.summary == msg("verifyEmailMessage"))>
<@layout.registrationLayout displayMessage=showMessage; section>
    <#if section = "header">
        ${msg("emailVerifyTitle")}
    <#elseif section = "form">
        <#if isAppInitiatedAction??>
            <p class="instruction">
                <#if verifyEmail??>
                    ${msg("emailVerifyInstruction1",verifyEmail)}
                <#else>
                    ${msg("emailVerifyInstruction4",user.email)}
                </#if>
            </p>
            <form id="kc-verify-email-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
                <div id="kc-form-buttons">
                    <#if verifyEmail??>
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("emailVerifyResend")}" />
                    <#else>
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("emailVerifySend")}" />
                    </#if>
                    <button class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
                </div>
            </form>
        <#else>
            <p class="instruction">${kcSanitize(msg("crowniclesEmailVerifySent", (verifyEmail!user.email)))?no_esc}</p>
            <p class="instruction">${msg("crowniclesEmailVerifyAutoContinue")}</p>
            <p id="crownicles-verify-email-status" class="crownicles-status" role="status">
                <span class="crownicles-spinner" aria-hidden="true"></span>
                <span>${msg("crowniclesEmailVerifyWaiting")}</span>
            </p>
            <p id="crownicles-verify-email-not-yet" class="crownicles-hint" role="alert" hidden>${msg("crowniclesEmailVerifyNotYet")}</p>
            <div id="kc-form-buttons">
                <a id="crownicles-verify-email-continue" href="${url.loginAction}" data-restart="${url.loginRestartFlowUrl}" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}">${msg("crowniclesEmailVerifyContinue")}</a>
                <form id="kc-verify-email-resend-form" action="${url.loginAction}" method="post">
                    <button type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}">${msg("crowniclesEmailVerifyResend")}</button>
                </form>
            </div>
            <p class="crownicles-hint">${msg("crowniclesEmailVerifySpam")}</p>
        </#if>
    </#if>
</@layout.registrationLayout>
