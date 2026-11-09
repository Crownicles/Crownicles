<#import "template.ftl" as layout>
<@layout.registrationLayout displayRequiredFields=false displayMessage=false; section>
    <#if section = "header">
        ${msg("crowniclesLinkFailedTitle")}
    <#elseif section = "form">
        <p class="instruction">${msg("crowniclesLinkFailed")}</p>
    </#if>
</@layout.registrationLayout>
