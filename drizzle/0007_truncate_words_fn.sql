CREATE OR REPLACE FUNCTION demo.truncate_words_head_tail(
  p_text text,
  p_head integer DEFAULT 300,
  p_tail integer DEFAULT 300
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  norm text;
  words text[];
  n int;
  max_keep int;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN '';
  END IF;
  norm := trim(both from regexp_replace(p_text, '\s+', ' ', 'g'));
  IF norm = '' THEN
    RETURN '';
  END IF;
  words := string_to_array(norm, ' ');
  n := cardinality(words);
  IF n IS NULL OR n = 0 THEN
    RETURN '';
  END IF;
  max_keep := p_head + p_tail;
  IF n <= max_keep THEN
    RETURN array_to_string(words, ' ');
  END IF;
  RETURN array_to_string(words[1:p_head], ' ')
    || ' ... '
    || array_to_string(words[(n - p_tail + 1):n], ' ');
END;
$$;--> statement-breakpoint
