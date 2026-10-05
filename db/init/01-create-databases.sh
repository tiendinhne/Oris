#!/bin/bash
# Chạy MỘT LẦN khi volume PostgreSQL còn trống.
# Tạo database riêng cho từng service, mỗi database một tài khoản riêng.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE USER auth_user WITH PASSWORD '${AUTH_DB_PASSWORD}';
    CREATE DATABASE auth_db OWNER auth_user;
    REVOKE CONNECT ON DATABASE auth_db FROM PUBLIC;

    CREATE USER post_user WITH PASSWORD '${POST_DB_PASSWORD}';
    CREATE DATABASE post_db OWNER post_user;
    REVOKE CONNECT ON DATABASE post_db FROM PUBLIC;

    CREATE USER notification_user WITH PASSWORD '${NOTIFICATION_DB_PASSWORD}';
    CREATE DATABASE notification_db OWNER notification_user;
    REVOKE CONNECT ON DATABASE notification_db FROM PUBLIC;

    CREATE USER feed_user WITH PASSWORD '${FEED_DB_PASSWORD}';
    CREATE DATABASE feed_db OWNER feed_user;
    REVOKE CONNECT ON DATABASE feed_db FROM PUBLIC;

    CREATE USER search_user WITH PASSWORD '${SEARCH_DB_PASSWORD}';
    CREATE DATABASE search_db OWNER search_user;
    REVOKE CONNECT ON DATABASE search_db FROM PUBLIC;
EOSQL
