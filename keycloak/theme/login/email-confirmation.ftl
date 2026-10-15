<#import "template.ftl" as layout>
<#-- Opened from the mail: the waiting page carries on by itself, wherever it was left. -->
<#assign gameUri = (client.attributes["crownicles.returnUri"])!"">
<@layout.registrationLayout displayRequiredFields=false displayMessage=false; section>
    <#if section = "header">
        ${msg("crowniclesLinkConfirmedTitle")}
    <#elseif section = "form">
        <p class="instruction">${msg("crowniclesLinkConfirmed")}</p>
        <div id="kc-form-buttons">
            <#if magicLinkContinuation.sameBrowser>
                <a href="${magicLinkContinuation.url}" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} crownicles-page-action">${msg("doContinue")}</a>
            <#elseif gameUri?has_content>
                <a href="${gameUri}" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} crownicles-page-action">${msg("crowniclesBackToGame")}</a>
            </#if>
        </div>
    </#if>
</@layout.registrationLayout>
