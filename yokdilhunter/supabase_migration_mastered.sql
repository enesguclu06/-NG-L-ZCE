-- ================================================================
-- Migration: Add 'mastered' to words.difficulty CHECK constraint
-- Run this in Supabase SQL Editor if you have the constraint enabled.
-- ================================================================

DO 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'words_difficulty_check'
  ) THEN
    ALTER TABLE public.words DROP CONSTRAINT words_difficulty_check;
  END IF;

  ALTER TABLE public.words
    ADD CONSTRAINT words_difficulty_check 
    CHECK (difficulty IN ('unrated', 'easy', 'medium', 'hard', 'mastered'));
END ;
