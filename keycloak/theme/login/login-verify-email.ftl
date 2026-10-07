<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true; section>
    <#if section = "header">
        ${msg("emailVerifyTitle")}
    <#elseif section = "form">
        <p class="instruction">
            <#if verifyEmail??>
                ${msg("emailVerifyInstruction1",verifyEmail)}
            <#else>
                ${msg("emailVerifyInstruction4",user.email)}
            </#if>
        </p>
        <#if isAppInitiatedAction??>
            <form id="kc-verify-email-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
                <div class="${properties.kcFormGroupClass!}">
                    <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                        <#if verifyEmail??>
                            <input class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("emailVerifyResend")}" />
                        <#else>
                            <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("emailVerifySend")}" />
                        </#if>
                        <button class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonLargeClass!}" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
                    </div>
                </div>
            </form>
        <#else>
            <p class="instruction">${msg("crowniclesEmailVerifyAutoContinue")}</p>
            <p id="crownicles-verify-email-elsewhere" class="instruction" hidden>${msg("crowniclesEmailVerifyElsewhere")}</p>
            <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                <a id="crownicles-verify-email-continue" href="${url.loginAction}" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}">${msg("crowniclesEmailVerifyContinue")}</a>
            </div>
        </#if>
    <#elseif section = "info">
        <#if !isAppInitiatedAction??>
            <form id="kc-verify-email-resend-form" action="${url.loginAction}" method="post">
                <p class="instruction">
                    ${msg("emailVerifyInstruction2")}
                    <button type="submit" class="crownicles-link-button">${msg("emailVerifyResend")}</button>
                </p>
            </form>
        </#if>
    </#if>
</@layout.registrationLayout>
