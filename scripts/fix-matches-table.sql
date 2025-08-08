-- Fix Matches Table - Remove format column and update overs constraint
-- Run this script directly in Supabase SQL Editor

-- First, let's check if the format column exists and remove it
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'format') THEN
        ALTER TABLE public.matches DROP COLUMN format;
        RAISE NOTICE 'Removed format column from matches table';
    ELSE
        RAISE NOTICE 'format column does not exist in matches table';
    END IF;
END $$;

-- Update the overs constraint to allow 1-999 overs
DO $$ 
BEGIN
    -- Drop the existing constraint if it exists
    BEGIN
        ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_overs_check;
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'No existing overs constraint to drop';
    END;
    
    -- Add the new constraint
    ALTER TABLE public.matches ADD CONSTRAINT matches_overs_check CHECK (overs >= 1 AND overs <= 999);
    RAISE NOTICE 'Updated overs constraint to allow 1-999 overs';
END $$;

-- Success message
SELECT 'Matches table fixed successfully! format column removed and overs constraint updated.' as status; 