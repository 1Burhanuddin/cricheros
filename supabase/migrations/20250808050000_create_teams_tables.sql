-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  captain_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_players table (junction table)
CREATE TABLE public.team_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('captain', 'vice_captain', 'player')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, player_id)
);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Anyone can view teams" 
ON public.teams 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create teams" 
ON public.teams 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team captain can update team" 
ON public.teams 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.team_players 
    WHERE team_id = id 
    AND player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND role = 'captain'
  )
);

CREATE POLICY "Team captain can delete team" 
ON public.teams 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.team_players 
    WHERE team_id = id 
    AND player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND role = 'captain'
  )
);

-- Team players policies
CREATE POLICY "Anyone can view team players" 
ON public.team_players 
FOR SELECT 
USING (true);

CREATE POLICY "Team captain can add players" 
ON public.team_players 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_players 
    WHERE team_id = team_players.team_id 
    AND player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND role = 'captain'
  )
);

CREATE POLICY "Team captain can update team players" 
ON public.team_players 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.team_players 
    WHERE team_id = team_players.team_id 
    AND player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND role = 'captain'
  )
);

CREATE POLICY "Team captain can remove players" 
ON public.team_players 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.team_players 
    WHERE team_id = team_players.team_id 
    AND player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND role = 'captain'
  )
);

-- Create trigger for automatic timestamp updates on teams
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column(); 