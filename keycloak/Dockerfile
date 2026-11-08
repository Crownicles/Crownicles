# Keycloak with the extensions the realm relies on, built once instead of copied by hand.
FROM maven:3.9.11-eclipse-temurin-21 AS account-policy
WORKDIR /build
COPY extensions/account-policy/ .
RUN mvn --batch-mode --no-transfer-progress package

FROM quay.io/keycloak/keycloak:26.7.4

COPY --from=account-policy --chown=keycloak:keycloak /build/target/account-policy-1.0.0.jar /opt/keycloak/providers/account-policy.jar

# Sign-in and sign-up by emailed link (Phase Two, Elastic License 2.0): the browser and
# registration flows of realm.json use its "magic-link-continuation-form" authenticator.
ADD --chown=keycloak:keycloak --checksum=sha256:a0f69b16de8fd5bc2d720ecddec4d5fcb3d895d890e3cfa59895d7b4fedff0d8 \
	https://repo1.maven.org/maven2/io/phasetwo/keycloak/keycloak-magic-link/0.90/keycloak-magic-link-0.90.jar \
	/opt/keycloak/providers/keycloak-magic-link.jar
