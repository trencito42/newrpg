ALTER TABLE player_reports
  ADD COLUMN open_reporter_account_id BIGINT UNSIGNED NULL,
  ADD UNIQUE KEY uq_one_open_report_per_account (open_reporter_account_id);

ALTER TABLE newbie_questions
  ADD COLUMN open_asker_account_id BIGINT UNSIGNED NULL,
  ADD UNIQUE KEY uq_one_open_question_per_account (open_asker_account_id);
