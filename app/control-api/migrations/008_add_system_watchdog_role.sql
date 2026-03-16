BEGIN;

INSERT INTO roles (role_id, title, domain, status)
VALUES ('system_watchdog', 'System Watchdog', 'operations', 'active')
ON CONFLICT (role_id) DO UPDATE
SET title = EXCLUDED.title,
    domain = EXCLUDED.domain,
    status = EXCLUDED.status;

COMMIT;
