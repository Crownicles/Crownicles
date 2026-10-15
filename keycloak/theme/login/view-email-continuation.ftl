<#import "template.ftl" as layout>
<#-- Replaces the extension's page: this one waits for the link, opened on any device, then carries on by itself. -->
<@layout.registrationLayout displayRequiredFields=false displayMessage=false; section>
    <#if section = "header">
        ${msg("crowniclesLinkTitle")}
    <#elseif section = "form">
        <#-- Keycloak shows the account above instead of the header once it is known: the title moves here. -->
        <h2 class="crownicles-lead">${msg("crowniclesLinkTitle")}</h2>
        <p class="instruction">${msg("crowniclesLinkSent")}</p>
        <p class="instruction">${msg("crowniclesLinkAutoContinue")}</p>
        <p id="crownicles-link-status" class="crownicles-status" role="status"
           data-polling="${pollingUrl!""}">
            <span class="crownicles-spinner" aria-hidden="true"></span>
            <span>${msg("crowniclesLinkWaiting")}</span>
        </p>
        <p id="crownicles-link-expired" class="crownicles-hint" role="alert" hidden>${msg("crowniclesLinkExpired")}</p>
        <p id="crownicles-link-opened" class="crownicles-status" role="status" hidden>${msg("crowniclesLinkOpened")}</p>
        <div id="kc-form-buttons">
            <a id="crownicles-link-continue" href="${url.loginAction}" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} crownicles-page-action" hidden>${msg("crowniclesLinkContinue")}</a>
            <a href="${url.loginRestartFlowUrl}" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} crownicles-page-action">${msg("crowniclesLinkOtherAddress")}</a>
        </div>
        <p class="crownicles-hint">${msg("crowniclesLinkSpam")}</p>
    </#if>
</@layout.registrationLayout>
