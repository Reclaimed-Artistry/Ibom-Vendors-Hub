-- Whogohost SMTP is the sole transactional email provider.
-- Remove the unused legacy provider credential; preserve historical email logs.
alter table platform_settings drop column if exists resend_api_key;
