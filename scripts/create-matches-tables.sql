-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT,
  team_a_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  overs INTEGER NOT NULL CHECK (overs >= 1 AND overs <= 999),
  toss_winner_id UUID REFERENCES public.teams(id),
  toss_decision TEXT CHECK (toss_decision IN ('bat', 'bowl')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT different_teams CHECK (team_a_id != team_b_id)
);

-- Create match_players table (playing XI for each match)
CREATE TABLE public.match_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_playing_xi BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, team_id, player_id)
);

-- Create match_scores table (ball-by-ball scoring)
CREATE TABLE public.match_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  inning INTEGER NOT NULL CHECK (inning IN (1, 2)),
  over_number INTEGER NOT NULL,
  ball_number INTEGER NOT NULL CHECK (ball_number BETWEEN 1 AND 6),
  batsman_id UUID NOT NULL REFERENCES public.profiles(id),
  bowler_id UUID NOT NULL REFERENCES public.profiles(id),
  runs INTEGER NOT NULL DEFAULT 0,
  extras_type TEXT CHECK (extras_type IN ('wide', 'no_ball', 'bye', 'leg_bye')),
  extras_runs INTEGER DEFAULT 0,
  wicket_type TEXT CHECK (wicket_type IN ('bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'obstructing_field')),
  wicket_batsman_id UUID REFERENCES public.profiles(id),
  wicket_fielder_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, inning, over_number, ball_number)
);

-- Enable Row Level Security
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

-- Matches policies
CREATE POLICY "Anyone can view matches"
ON public.matches
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create matches"
ON public.matches
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Match creator can update match"
ON public.matches
FOR UPDATE
USING (
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Match creator can delete match"
ON public.matches
FOR DELETE
USING (
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Match players policies
CREATE POLICY "Anyone can view match players"
ON public.match_players
FOR SELECT
USING (true);

CREATE POLICY "Match creator or team captain can add match players"
ON public.match_players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = match_players.match_id
    AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.team_players
    WHERE team_id = match_players.team_id
    AND player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND role = 'captain'
  )
);

CREATE POLICY "Match creator or team captain can update match players"
ON public.match_players
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = match_players.match_id
    AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.team_players
    WHERE team_id = match_players.team_id
    AND player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND role = 'captain'
  )
);

-- Match scores policies
CREATE POLICY "Anyone can view match scores"
ON public.match_scores
FOR SELECT
USING (true);

CREATE POLICY "Match creator or team captain can add match scores"
ON public.match_scores
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = match_scores.match_id
    AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.match_players mp
    JOIN public.team_players tp ON mp.team_id = tp.team_id
    WHERE mp.match_id = match_scores.match_id
    AND tp.player_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND tp.role = 'captain'
  )
);

-- Create trigger for automatic timestamp updates on matches
CREATE TRIGGER update_matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column(); 