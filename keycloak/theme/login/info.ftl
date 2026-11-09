<#import "template.ftl" as layout>
<#macro pageAction href label>
    <div id="kc-form-buttons">
        <a class="crownicles-page-action ${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" href="${href}">${label}</a>
    </div>
</#macro>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        <#if messageHeader??>
            ${kcSanitize(msg("${messageHeader}"))?no_esc}
        <#else>
            ${message.summary}
        </#if>
    <#elseif section = "form">
    <div id="kc-info-message">
        <p class="instruction">${message.summary}<#if requiredActions??><#list requiredActions>: <b><#items as reqActionItem>${kcSanitize(msg("requiredAction.${reqActionItem}"))?no_esc}<#sep>, </#items></b></#list><#else></#if></p>
        <#-- Keycloak refuses a custom scheme as base URL: the game's own address is kept in a client attribute. -->
        <#assign gameUri = (client.attributes["crownicles.returnUri"])!"">
        <#if skipLink??>
        <#elseif pageRedirectUri?has_content>
            <@pageAction href=pageRedirectUri label=msg("backToApplication")/>
        <#elseif actionUri?has_content>
            <@pageAction href=actionUri label=msg("proceedWithAction")/>
        <#elseif gameUri?has_content>
            <#-- In the game's sheet, this ends the browser session; in the phone's browser, it opens the game. -->
            <@pageAction href=gameUri label=msg("crowniclesBackToGame")/>
        <#elseif (client.baseUrl)?has_content>
            <@pageAction href=client.baseUrl label=msg("backToApplication")/>
        <#else>
            <p class="instruction">${msg("crowniclesReturnToGame")}</p>
        </#if>
    </div>
    </#if>
</@layout.registrationLayout>
