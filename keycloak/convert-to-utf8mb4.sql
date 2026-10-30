-- Keycloak declares some columns as NVARCHAR, which MariaDB always creates in utf8mb3:
-- they reject 4-byte characters such as emojis in Discord names.
-- Converts every remaining utf8mb3 column of the keycloak database to utf8mb4.
-- Run it once Keycloak has created its schema, and again after each Keycloak upgrade.
DELIMITER //
BEGIN NOT ATOMIC
	FOR col IN (
		SELECT table_name, column_name, column_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_schema = 'keycloak' AND character_set_name = 'utf8mb3'
	) DO
		EXECUTE IMMEDIATE CONCAT(
			'ALTER TABLE keycloak.`', col.table_name, '` MODIFY `', col.column_name, '` ', col.column_type,
			' CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci ', IF(col.is_nullable = 'YES', 'NULL', 'NOT NULL'),
			IF(col.column_default IS NULL, '', CONCAT(' DEFAULT ', col.column_default))
		);
	END FOR;
END //
DELIMITER ;
