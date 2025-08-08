-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team captain can update team" ON public.teams;
DROP POLICY IF EXISTS "Team captain can delete team" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON public.teams;

DROP POLICY IF EXISTS "Anyone can view team players" ON public.team_players;
DROP POLICY IF EXISTS "Team captain can add players" ON public.team_players;
DROP POLICY IF EXISTS "Team captain can update team players" ON public.team_players;
DROP POLICY IF EXISTS "Team captain can remove players" ON public.team_players;
DROP POLICY IF EXISTS "Authenticated users can add players" ON public.team_players;
DROP POLICY IF EXISTS "Authenticated users can update team players" ON public.team_players;
DROP POLICY IF EXISTS "Authenticated users can remove players" ON public.team_players;

-- Create simple, permissive policies for testing
CREATE POLICY "Anyone can view teams" 
ON public.teams 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create teams" 
ON public.teams 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update teams" 
ON public.teams 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete teams" 
ON public.teams 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Team players policies
CREATE POLICY "Anyone can view team players" 
ON public.team_players 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can add players" 
ON public.team_players 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update team players" 
ON public.team_players 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can remove players" 
ON public.team_players 
FOR DELETE 
USING (auth.uid() IS NOT NULL); 