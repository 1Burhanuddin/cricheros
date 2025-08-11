import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trophy } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain: {
    name: string;
  };
}

interface Match {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string | null;
  overs: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  team_a: Team;
  team_b: Team;
  team_a_id: string;
  team_b_id: string;
  toss_winner: Team | null;
  toss_decision: 'bat' | 'bowl' | null;
  created_at: string;
  // Match scores for completed matches
  team_a_score?: {
    runs: number;
    wickets: number;
    overs: number;
  };
  team_b_score?: {
    runs: number;
    wickets: number;
    overs: number;
  };
  winner?: Team | null;
  result?: string;
}

const Matches = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    team_a_id: '',
    team_b_id: '',
    overs: 20
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          logo_url,
          captain:profiles!teams_captain_id_fkey(name)
        `)
        .order('name');

      if (teamsError) throw teamsError;
      const normalizedTeams = (teamsData || []).map((t: any) => ({
        ...t,
        captain: Array.isArray(t.captain) ? t.captain[0] : t.captain
      }));
      setTeams(normalizedTeams as Team[]);

      // Fetch matches with team details
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          name,
          date,
          time,
          location,
          overs,
          status,
          team_a_id,
          team_b_id,
          toss_decision,
          created_at,
          team_a:teams!matches_team_a_id_fkey(
            id,
            name,
            logo_url,
            captain:profiles!teams_captain_id_fkey(name)
          ),
          team_b:teams!matches_team_b_id_fkey(
            id,
            name,
            logo_url,
            captain:profiles!teams_captain_id_fkey(name)
          ),
          toss_winner:teams!matches_toss_winner_id_fkey(
            id,
            name,
            logo_url,
            captain:profiles!teams_captain_id_fkey(name)
          )
        `)
        .order('date', { ascending: false });

      if (matchesError) throw matchesError;

      // Normalize the data to ensure single objects instead of arrays
      const normalizedMatches = (matchesData || []).map((match: any) => ({
        ...match,
        team_a: Array.isArray(match.team_a) ? match.team_a[0] : match.team_a,
        team_b: Array.isArray(match.team_b) ? match.team_b[0] : match.team_b,
        toss_winner: Array.isArray(match.toss_winner) ? match.toss_winner[0] : match.toss_winner
      }));

      // Fetch match scores for completed matches
      const completedMatchIds = normalizedMatches?.filter(m => m.status === 'completed').map(m => m.id) || [];
      let matchScores: any = {};
      
      if (completedMatchIds.length > 0) {
        // First fetch team players to determine team membership
        const { data: teamPlayersData, error: teamPlayersError } = await supabase
          .from('match_players')
          .select(`
            match_id,
            player_id,
            team_id,
            teams!match_players_team_id_fkey(id, name)
          `)
          .in('match_id', completedMatchIds);

        if (teamPlayersError) {
          console.error('Error fetching team players:', teamPlayersError);
        }

        // Create a map of player_id to team_id for each match
        const playerTeamMap: { [matchId: string]: { [playerId: string]: string } } = {};
        teamPlayersData?.forEach((player: any) => {
          if (!playerTeamMap[player.match_id]) {
            playerTeamMap[player.match_id] = {};
          }
          playerTeamMap[player.match_id][player.player_id] = player.team_id;
        });

        const { data: scoresData, error: scoresError } = await supabase
          .from('match_scores')
          .select('*')
          .in('match_id', completedMatchIds);

        if (scoresError) {
          console.error('Error fetching scores:', scoresError);
        }

        // Process scores to get team totals
        if (scoresData && scoresData.length > 0) {
          scoresData.forEach((score: any) => {
            if (!matchScores[score.match_id]) {
              matchScores[score.match_id] = { team_a: { runs: 0, wickets: 0, overs: 0 }, team_b: { runs: 0, wickets: 0, overs: 0 } };
            }
            
            // Determine which team this score belongs to
            const match = normalizedMatches.find(m => m.id === score.match_id);
            if (!match) return;
            
            const playerTeamMapForMatch = playerTeamMap[score.match_id] || {};
            
            // For batting scores, add runs to the batting team
            if (score.batsman_id && score.runs) {
              const playerTeamId = playerTeamMapForMatch[score.batsman_id];
              
              if (playerTeamId === match.team_a_id) {
                matchScores[score.match_id].team_a.runs += score.runs;
              } else if (playerTeamId === match.team_b_id) {
                matchScores[score.match_id].team_b.runs += score.runs;
              }
            }
            
            // For bowling scores, add wickets to the bowling team
            if (score.bowler_id && score.wicket_type && score.wicket_type !== 'run_out') {
              const playerTeamId = playerTeamMapForMatch[score.bowler_id];
              if (playerTeamId === match.team_a_id) {
                matchScores[score.match_id].team_a.wickets += 1;
              } else if (playerTeamId === match.team_b_id) {
                matchScores[score.match_id].team_b.wickets += 1;
              }
            }
            
            // Calculate overs from ball numbers
            if (score.ball_number) {
              const currentOvers = Math.floor(score.ball_number / 6) + (score.ball_number % 6) / 10;
              
              // Determine which team was batting (based on batsman)
              if (score.batsman_id) {
                const playerTeamId = playerTeamMapForMatch[score.batsman_id];
                if (playerTeamId === match.team_a_id) {
                  matchScores[score.match_id].team_a.overs = Math.max(matchScores[score.match_id].team_a.overs, currentOvers);
                } else if (playerTeamId === match.team_b_id) {
                  matchScores[score.match_id].team_b.overs = Math.max(matchScores[score.match_id].team_b.overs, currentOvers);
                }
              }
            }
          });
        }
      }

      // Combine match data with scores
      const matchesWithScores = (normalizedMatches || []).map(match => {
        const scores = matchScores[match.id];
        
        if (!scores) return match;

        // Determine winner and result
        let winner = null;
        let result = '';
        
        if (match.status === 'completed' && scores.team_a && scores.team_b) {
          if (scores.team_a.runs > scores.team_b.runs) {
            winner = match.team_a;
            const margin = scores.team_a.runs - scores.team_b.runs;
            result = `${match.team_a.name} won by ${margin} runs`;
          } else if (scores.team_b.runs > scores.team_a.runs) {
            winner = match.team_b;
            const margin = scores.team_b.runs - scores.team_a.runs;
            result = `${match.team_b.name} won by ${margin} runs`;
          }
        }

        return {
          ...match,
          team_a_score: scores.team_a,
          team_b_score: scores.team_b,
          winner,
          result
        };
      });

      // Ensure unique matches by ID
      const uniqueMatches = matchesWithScores.filter((match, index, self) => 
        index === self.findIndex(m => m.id === match.id)
      );

      setMatches(uniqueMatches);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load matches",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async () => {
    if (!user || !formData.name.trim() || !formData.team_a_id || !formData.team_b_id) return;

    // Check if a match with the same name already exists
    const existingMatch = matches.find(m => 
      m.name.toLowerCase() === formData.name.trim().toLowerCase() ||
      (m.team_a_id === formData.team_a_id && m.team_b_id === formData.team_b_id && m.date === formData.date) ||
      (m.team_a_id === formData.team_b_id && m.team_b_id === formData.team_a_id && m.date === formData.date)
    );

    if (existingMatch) {
      toast({
        title: "Error",
        description: "A match with this name or between these teams on this date already exists",
        variant: "destructive"
      });
      return;
    }

    // Check if teams are different
    if (formData.team_a_id === formData.team_b_id) {
      toast({
        title: "Error",
        description: "Team A and Team B must be different",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create match with a more descriptive name if none provided
      const teamAName = teams.find(t => t.id === formData.team_a_id)?.name || 'Team A';
      const teamBName = teams.find(t => t.id === formData.team_b_id)?.name || 'Team B';
      const matchName = formData.name.trim() || `${teamAName} vs ${teamBName}`;
      
      // Create match
      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          name: matchName,
          date: formData.date,
          time: formData.time,
          location: formData.location.trim() || null,
          team_a_id: formData.team_a_id,
          team_b_id: formData.team_b_id,
          overs: formData.overs,
          created_by: profile.id
        })
        .select()
        .single();

      if (error) throw error;

      setShowCreateDialog(false);
      setFormData({
        name: '',
        date: '',
        time: '',
        location: '',
        team_a_id: '',
        team_b_id: '',
        overs: 20
      });

      await fetchData();
      toast({
        title: "Success",
        description: "Match created successfully!"
      });
    } catch (error) {
      console.error('Error creating match:', error);
      toast({
        title: "Error",
        description: "Failed to create match",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title="Matches"
          subtitle="View completed matches and upcoming fixtures"
        />
        
        <div className="flex justify-end mb-8">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Match
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Match</DialogTitle>
                <DialogDescription>
                  Schedule a new cricket match between two teams.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="match-name" className="text-right">
                    Match Name
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="match-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Team A vs Team B"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="match-date" className="text-right">
                    Date
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="match-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="match-time" className="text-right">
                    Time
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="match-time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="match-location" className="text-right">
                    Location
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="match-location"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g., Cricket Ground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="team-a" className="text-right">
                    Team A
                  </Label>
                  <div className="col-span-3">
                    <Select value={formData.team_a_id} onValueChange={(value) => setFormData(prev => ({ ...prev, team_a_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team A" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="team-b" className="text-right">
                    Team B
                  </Label>
                  <div className="col-span-3">
                    <Select value={formData.team_b_id} onValueChange={(value) => setFormData(prev => ({ ...prev, team_b_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team B" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="match-overs">Number of Overs</Label>
                  <Input
                    id="match-overs"
                    type="number"
                    min="1"
                    max="999"
                    value={formData.overs}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setFormData(prev => ({ ...prev, overs: Math.min(Math.max(value, 1), 999) }));
                    }}
                    placeholder="e.g., 20"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the number of overs for each innings (1-999)
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleCreateMatch} 
                    disabled={creating || !formData.name.trim() || !formData.team_a_id || !formData.team_b_id || !formData.date || !formData.time || formData.overs < 1}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Match'
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Matches Yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to create a match or wait for others to schedule matches.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Match
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match, index) => (
              <Card key={`${match.id}-${index}`} className="relative bg-gray-50">
                {/* Header with tournament info and RESULT badge */}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold text-gray-900 mb-1">
                        {match.name || `${match.team_a.name} vs ${match.team_b.name}`}
                      </CardTitle>
                      <CardTitle className="text-sm font-medium text-gray-600">
                        {match.status === 'completed' ? 'Match Ended' : 
                         match.status === 'in_progress' ? 'Match Started' : 'Upcoming Match'}
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-500 mt-1">
                        {match.location || 'Venue TBD'} | {formatDate(match.date)} | {match.overs} Ov.
                      </CardDescription>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatTime(match.time)}
                      </div>
                    </div>
                    {match.status === 'completed' && (
                      <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1">
                        RESULT
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Team scores for completed matches */}
                  {match.status === 'completed' && match.team_a_score && match.team_b_score ? (
                    <div className="space-y-3">
                      {/* Team A Score */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{match.team_a.name}</span>
                        <span className="font-mono text-sm">
                          {match.team_a_score.runs}/{match.team_a_score.wickets} ({match.team_a_score.overs.toFixed(1)} Ov)
                        </span>
                      </div>

                      {/* Team B Score */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{match.team_b.name}</span>
                        <span className="font-mono text-sm">
                          {match.team_b_score.runs}/{match.team_b_score.wickets} ({match.team_b_score.overs.toFixed(1)} Ov)
                        </span>
                      </div>

                      {/* Match Result */}
                      {match.result && (
                        <div className="text-center py-2 bg-white rounded-md">
                          <p className="text-sm font-medium text-gray-800">{match.result}</p>
                        </div>
                      )}
                    </div>
                  ) : match.status === 'completed' ? (
                    /* Fallback for completed matches without calculated scores */
                    <div className="space-y-3">
                      <div className="text-center py-2 bg-yellow-50 rounded-md">
                        <p className="text-sm text-yellow-800">Match completed but no scores calculated</p>
                      </div>
                    </div>
                  ) : (
                    /* Upcoming/Scheduled match display */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{match.team_a.name}</span>
                        <span className="font-mono text-sm text-gray-500">0/0 (0.0 Ov)</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{match.team_b.name}</span>
                        <span className="font-mono text-sm text-gray-500">0/0 (0.0 Ov)</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Navigation options at bottom */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                    <Link to={`/matches/${match.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs py-1 px-2 bg-white hover:bg-gray-50 text-teal-600 border-teal-200 hover:border-teal-300 rounded-full">
                        INSIGHTS
                      </Button>
                    </Link>
                    {match.status === 'completed' && (
                      <Button variant="outline" size="sm" className="text-xs py-1 px-2 bg-white hover:bg-gray-50 text-teal-600 border-teal-200 hover:border-teal-300 rounded-full">
                        TABLE
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches; 