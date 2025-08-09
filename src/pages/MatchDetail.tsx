import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Target } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Play, Users, Trophy } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import LiveScoring from '@/components/LiveScoring';
import Scorecard from '@/components/Scorecard';
import TossStep from '@/components/TossStep';
import PlayerSelection from '@/components/PlayerSelection';

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain: {
    name: string;
  };
}

interface Player {
  id: string;
  name: string;
  image_url: string | null;
  batting_style: string | null;
  bowling_style: string | null;
}

interface MatchPlayer {
  id: string;
  player_id: string;
  is_playing_xi: boolean;
  team_id: string;
  player: Player;
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
  toss_winner: Team | null;
  toss_decision: 'bat' | 'bowl' | null;
  created_by: string;
  created_at: string;
}

interface Score {
  inning: number;
  over_number: number;
  ball_number: number;
  batsman_id: string;
  bowler_id: string;
  runs: number;
  extras_type?: string;
  extras_runs?: number;
  wicket_type?: string;
  wicket_batsman_id?: string;
}

const MatchDetail = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, setMatch] = useState<Match | null>(null);
  const [teamAPlayers, setTeamAPlayers] = useState<MatchPlayer[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<MatchPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [scores, setScores] = useState<Score[]>([]);
  const [currentInning, setCurrentInning] = useState(1);
  const [currentOver, setCurrentOver] = useState(0);
  const [currentBall, setCurrentBall] = useState(1);
  const [battingTeam, setBattingTeam] = useState<Team | null>(null);
  const [bowlingTeam, setBowlingTeam] = useState<Team | null>(null);
  const [selectedBatsmen, setSelectedBatsmen] = useState<string[] | null>(null);
  const [selectedBowler, setSelectedBowler] = useState<string | null>(null);

  useEffect(() => {
    if (matchId && user) {
      fetchMatchData();
    }
  }, [matchId, user]);

  const fetchMatchData = async () => {
    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      // Fetch match details
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
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
        .eq('id', matchId)
        .single();

      if (matchError) throw matchError;
      setMatch(matchData);
      setIsCreator(matchData.created_by === profile.id);

      // Set batting/bowling teams based on toss
      if (matchData.toss_winner && matchData.toss_decision) {
        if (matchData.toss_decision === 'bat') {
          setBattingTeam(matchData.toss_winner);
          setBowlingTeam(matchData.toss_winner.id === matchData.team_a.id ? matchData.team_b : matchData.team_a);
        } else {
          setBowlingTeam(matchData.toss_winner);
          setBattingTeam(matchData.toss_winner.id === matchData.team_a.id ? matchData.team_b : matchData.team_a);
        }
      } else {
        // Default: team_a bats first
        setBattingTeam(matchData.team_a);
        setBowlingTeam(matchData.team_b);
      }

      // Fetch match players
      const { data: matchPlayers, error: playersError } = await supabase
        .from('match_players')
        .select(`
          *,
          player:profiles(name, image_url, batting_style, bowling_style)
        `)
        .eq('match_id', matchId);

      if (playersError) throw playersError;

      // Separate players by team or fallback to team rosters
      let teamA: MatchPlayer[] = [];
      let teamB: MatchPlayer[] = [];

      if (matchPlayers && matchPlayers.length > 0) {
        teamA = matchPlayers.filter((p: any) => p.team_id === matchData.team_a.id);
        teamB = matchPlayers.filter((p: any) => p.team_id === matchData.team_b.id);
      } else {
        // Fallback to team rosters if match players are not set
        const { data: rosters, error: rosterError } = await supabase
          .from('team_players')
          .select(`id, team_id, player_id, player:profiles(name, image_url, batting_style, bowling_style)`) 
          .in('team_id', [matchData.team_a.id, matchData.team_b.id]);

        if (rosterError) throw rosterError;

        const mapped: MatchPlayer[] = (rosters || []).map((r: any) => ({
          id: r.id,
          player_id: r.player_id,
          team_id: r.team_id,
          is_playing_xi: true,
          player: r.player
        }));

        teamA = mapped.filter(p => p.team_id === matchData.team_a.id);
        teamB = mapped.filter(p => p.team_id === matchData.team_b.id);
      }
      
      setTeamAPlayers(teamA);
      setTeamBPlayers(teamB);

      // Fetch scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('match_scores')
        .select('*')
        .eq('match_id', matchId)
        .order('inning', { ascending: true })
        .order('over_number', { ascending: true })
        .order('ball_number', { ascending: true });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);

      // Calculate current position
      if (scoresData && scoresData.length > 0) {
        const lastScore = scoresData[scoresData.length - 1];
        setCurrentInning(lastScore.inning);
        setCurrentOver(lastScore.over_number);
        setCurrentBall(lastScore.ball_number + 1);
        
        if (currentBall > 6) {
          setCurrentOver(currentOver + 1);
          setCurrentBall(1);
        }
      }

    } catch (error) {
      console.error('Error fetching match data:', error);
      toast({
        title: "Error",
        description: "Failed to load match data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startMatch = async () => {
    if (!match) return;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'in_progress' })
        .eq('id', match.id);

      if (error) throw error;

      setMatch(prev => prev ? { ...prev, status: 'in_progress' } : null);
      toast({
        title: "Match Started!",
        description: "The match is now in progress. You can start scoring."
      });
    } catch (error) {
      console.error('Error starting match:', error);
      toast({
        title: "Error",
        description: "Failed to start match",
        variant: "destructive"
      });
    }
  };

  const handleScoreAdded = (newScore: Score) => {
    setScores(prev => [...prev, newScore]);
  };

  const handlePositionUpdate = (inning: number, over: number, ball: number) => {
    setCurrentInning(inning);
    setCurrentOver(over);
    setCurrentBall(ball);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  const calculateTeamScore = (teamId: string, inning: number) => {
    const teamScores = scores.filter(s => {
      const isBatting = (inning === 1 && battingTeam?.id === teamId) || 
                       (inning === 2 && bowlingTeam?.id === teamId);
      return s.inning === inning && isBatting;
    });

    const totalRuns = teamScores.reduce((sum, score) => sum + score.runs + (score.extras_runs || 0), 0);
    const wickets = teamScores.filter(s => s.wicket_type).length;

    return { runs: totalRuns, wickets };
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

  if (!match) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Match Not Found</h3>
              <Button onClick={() => navigate('/matches')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Matches
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const teamAScore = calculateTeamScore(match.team_a.id, currentInning);
  const teamBScore = calculateTeamScore(match.team_b.id, currentInning);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title={match.name}
          subtitle={`${formatDate(match.date)} at ${formatTime(match.time)}`}
          showBack
          backUrl="/matches"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Match Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Match Information</CardTitle>
                  {getStatusBadge(match.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={match.team_a.logo_url || ''} />
                    <AvatarFallback className="text-lg">
                      {match.team_a.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{match.team_a.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {teamAScore.runs}/{teamAScore.wickets} ({currentInning === 1 ? `${currentOver}.${currentBall}` : 'Completed'})
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-lg font-semibold">vs</span>
                </div>

                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={match.team_b.logo_url || ''} />
                    <AvatarFallback className="text-lg">
                      {match.team_b.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{match.team_b.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {teamBScore.runs}/{teamBScore.wickets} ({currentInning === 2 ? `${currentOver}.${currentBall}` : currentInning > 1 ? 'Batting' : 'Yet to bat'})
                    </p>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Overs:</strong> {match.overs}
                  </p>
                  {match.location && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Location:</strong> {match.location}
                    </p>
                  )}
                  {match.toss_winner && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Toss:</strong> {match.toss_winner.name} chose to {match.toss_decision}
                    </p>
                  )}
                </div>

                {isCreator && match.status === 'scheduled' && match.toss_winner && (
                  <Button onClick={startMatch} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Start Match
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Match Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="scorecard" className="w-full">
              <TabsList className={`grid w-full ${isCreator ? 'grid-cols-2' : 'grid-cols-1'} rounded-full bg-muted p-1`}>
                <TabsTrigger value="scorecard" className="rounded-full">Scorecard</TabsTrigger>
                {isCreator && <TabsTrigger value="scoring" className="rounded-full">Live Scoring</TabsTrigger>}
              </TabsList>

              <TabsContent value="scorecard" className="space-y-4">
                {/* Show scorecard first */}
                {battingTeam && bowlingTeam ? (
                  <Scorecard
                    scores={scores}
                    battingTeam={battingTeam}
                    bowlingTeam={bowlingTeam}
                    currentInning={currentInning}
                    currentOver={currentOver}
                    currentBall={currentBall}
                    totalOvers={match.overs}
                    teamAPlayers={teamAPlayers}
                    teamBPlayers={teamBPlayers}
                  />
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">Loading scorecard...</p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Sub-tabs after scorecard */}
                <Tabs defaultValue="commentary" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted p-1">
                    <TabsTrigger value="commentary" className="rounded-full">Commentary</TabsTrigger>
                    <TabsTrigger value="playing-xi" className="rounded-full">Playing XI</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="commentary" className="space-y-4">
                    {/* Ball-by-Ball Commentary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Commentary
                        </CardTitle>
                        <CardDescription>
                          Live updates from the current innings
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const currentInningScores = scores.filter(score => score.inning === currentInning);
                          const getPlayerName = (playerId: string) => {
                            const teamAPlayer = teamAPlayers.find(p => p.player_id === playerId);
                            const teamBPlayer = teamBPlayers.find(p => p.player_id === playerId);
                            return teamAPlayer?.player.name || teamBPlayer?.player.name || 'Unknown';
                          };
                          
                          const formatOver = (overNum: number, ballNum: number) => {
                            return `${overNum}.${ballNum}`;
                          };
                          
                          const getScoreDescription = (score: any) => {
                            let description = '';
                            
                            if (score.wicket_type) {
                              if (score.wicket_type === 'bowled' || score.wicket_type === 'lbw' || score.wicket_type === 'hit_wicket') {
                                description = `${score.wicket_type.replace('_', ' ')} b ${getPlayerName(score.bowler_id)}`;
                              } else if (score.wicket_type === 'caught') {
                                const fielderName = score.fielder_id ? getPlayerName(score.fielder_id) : 'fielder';
                                description = `c ${fielderName} b ${getPlayerName(score.bowler_id)}`;
                              } else if (score.wicket_type === 'stumped') {
                                const fielderName = score.fielder_id ? getPlayerName(score.fielder_id) : 'keeper';
                                description = `st ${fielderName} b ${getPlayerName(score.bowler_id)}`;
                              } else if (score.wicket_type === 'run_out') {
                                const fielderName = score.fielder_id ? getPlayerName(score.fielder_id) : 'fielder';
                                description = `run out ${fielderName}`;
                              }
                              
                              if (score.runs > 0) {
                                description += ` + ${score.runs} run${score.runs > 1 ? 's' : ''}`;
                              }
                            } else {
                              if (score.extras_type) {
                                description = `${score.extras_type.replace('_', ' ')}`;
                                if (score.runs > 0) {
                                  description += ` + ${score.runs} run${score.runs > 1 ? 's' : ''}`;
                                }
                              } else if (score.runs > 0) {
                                description = `${score.runs} run${score.runs > 1 ? 's' : ''}`;
                              } else {
                                description = 'dot ball';
                              }
                            }
                            
                            return description;
                          };
                          
                          return currentInningScores.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                              No scores recorded yet in this innings.
                            </p>
                          ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {currentInningScores.map((score, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">
                                      {formatOver(score.over_number, score.ball_number)}
                                    </Badge>
                                    <div>
                                      <p className="font-medium">
                                        {getPlayerName(score.bowler_id)} to {getPlayerName(score.batsman_id)}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {getScoreDescription(score)}
                                      </p>
                                    </div>
                                  </div>
                                  {score.wicket_type && (
                                    <Badge variant="destructive">
                                      Wicket
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="playing-xi" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Playing XI</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h3 className="font-semibold mb-3">{match.team_a.name}</h3>
                            <div className="space-y-2">
                              {/* Show only current batsmen if this team is batting */}
                              {currentInning === 1 && battingTeam?.id === match.team_a.id && (
                                <>
                                  {selectedBatsmen && selectedBatsmen.length > 0 && selectedBatsmen.map((batsmanId, index) => {
                                    const player = teamAPlayers.find(p => p.player_id === batsmanId);
                                    if (!player) return null;
                                    
                                    // Calculate individual batsman stats from scores
                                    const batsmanScores = scores.filter(score => 
                                      score.batsman_id === batsmanId && score.inning === currentInning
                                    );
                                    const runs = batsmanScores.reduce((total, score) => total + (score.runs || 0), 0);
                                    const balls = batsmanScores.filter(score => 
                                      !score.extras_type || ['bye', 'leg_bye'].includes(score.extras_type)
                                    ).length;
                                    
                                    return (
                                      <div key={player.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage src={player.player.image_url || ''} />
                                            <AvatarFallback className="text-xs">
                                              {player.player.name?.charAt(0)?.toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-sm font-medium">
                                            {player.player.name} {runs}({balls}){index === 0 ? '*' : ''}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Show current bowler */}
                                  {selectedBowler && (
                                    <div className="mt-3 pt-2 border-t">
                                      <p className="text-xs text-muted-foreground mb-1">Current Bowler</p>
                                      {(() => {
                                        const bowler = teamBPlayers.find(p => p.player_id === selectedBowler);
                                        if (!bowler) return null;
                                        
                                        // Calculate bowler stats from scores
                                        const bowlerScores = scores.filter(score => 
                                          score.bowler_id === selectedBowler && score.inning === currentInning
                                        );
                                        const balls = bowlerScores.length;
                                        const wickets = bowlerScores.filter(score => score.wicket_type).length;
                                        
                                        return (
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <Avatar className="h-6 w-6">
                                                <AvatarImage src={bowler.player.image_url || ''} />
                                                <AvatarFallback className="text-xs">
                                                  {bowler.player.name?.charAt(0)?.toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <span className="text-sm">{bowler.player.name}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                              {balls} balls/{wickets} wickets
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </>
                              )}
                              {/* Show team score if not batting */}
                              {(currentInning !== 1 || battingTeam?.id !== match.team_a.id) && (
                                <div className="text-center py-4">
                                  <p className="text-sm text-muted-foreground">
                                    {currentInning === 1 ? 'Yet to bat' : 'Completed innings'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h3 className="font-semibold mb-3">{match.team_b.name}</h3>
                            <div className="space-y-2">
                              {/* Show only current batsmen if this team is batting */}
                              {currentInning === 2 && battingTeam?.id === match.team_b.id && (
                                <>
                                  {selectedBatsmen && selectedBatsmen.length > 0 && selectedBatsmen.map((batsmanId, index) => {
                                    const player = teamBPlayers.find(p => p.player_id === batsmanId);
                                    if (!player) return null;
                                    
                                    // Calculate individual batsman stats from scores
                                    const batsmanScores = scores.filter(score => 
                                      score.batsman_id === batsmanId && score.inning === currentInning
                                    );
                                    const runs = batsmanScores.reduce((total, score) => total + (score.runs || 0), 0);
                                    const balls = batsmanScores.filter(score => 
                                      !score.extras_type || ['bye', 'leg_bye'].includes(score.extras_type)
                                    ).length;
                                    
                                    return (
                                      <div key={player.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage src={player.player.image_url || ''} />
                                            <AvatarFallback className="text-xs">
                                              {player.player.name?.charAt(0)?.toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-sm font-medium">
                                            {player.player.name} {runs}({balls}){index === 0 ? '*' : ''}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Show current bowler */}
                                  {selectedBowler && (
                                    <div className="mt-3 pt-2 border-t">
                                      <p className="text-xs text-muted-foreground mb-1">Current Bowler</p>
                                      {(() => {
                                        const bowler = teamAPlayers.find(p => p.player_id === selectedBowler);
                                        if (!bowler) return null;
                                        
                                        // Calculate bowler stats from scores
                                        const bowlerScores = scores.filter(score => 
                                          score.bowler_id === selectedBowler && score.inning === currentInning
                                        );
                                        const balls = bowlerScores.length;
                                        const wickets = bowlerScores.filter(score => score.wicket_type).length;
                                        
                                        return (
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <Avatar className="h-6 w-6">
                                                <AvatarImage src={bowler.player.image_url || ''} />
                                                <AvatarFallback className="text-xs">
                                                  {bowler.player.name?.charAt(0)?.toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <span className="text-sm">{bowler.player.name}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                              {balls} balls/{wickets} wickets
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </>
                              )}
                              {/* Show team score if not batting */}
                              {(currentInning !== 2 || battingTeam?.id !== match.team_b.id) && (
                                <div className="text-center py-4">
                                  <p className="text-sm text-muted-foreground">
                                    {currentInning === 1 ? 'Yet to bat' : 'Completed innings'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {isCreator && (
              <TabsContent value="scoring" className="space-y-4">
                {!isCreator ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">Only the match creator can score.</p>
                    </CardContent>
                  </Card>
                ) : match.status === 'scheduled' && (!match.toss_winner || !match.toss_decision) ? (
                  <TossStep
                    matchId={match.id}
                    teamA={match.team_a}
                    teamB={match.team_b}
                    onSaved={(winner, decision) => {
                      setMatch(prev => prev ? { ...prev, toss_winner: winner, toss_decision: decision } : prev);
                      if (decision === 'bat') {
                        setBattingTeam(winner);
                        setBowlingTeam(winner.id === match.team_a.id ? match.team_b : match.team_a);
                      } else {
                        setBowlingTeam(winner);
                        setBattingTeam(winner.id === match.team_a.id ? match.team_b : match.team_a);
                      }
                    }}
                  />
                ) : match.status === 'scheduled' && battingTeam && bowlingTeam && !selectedBatsmen ? (
                  <PlayerSelection
                    battingTeamPlayers={battingTeam.id === match.team_a.id ? teamAPlayers : teamBPlayers}
                    bowlingTeamPlayers={bowlingTeam.id === match.team_a.id ? teamAPlayers : teamBPlayers}
                    onSelected={async (batsmen, bowler) => {
                      setSelectedBatsmen(batsmen);
                      setSelectedBowler(bowler);
                      try {
                        const { error } = await supabase
                          .from('matches')
                          .update({ status: 'in_progress' })
                          .eq('id', match.id);
                        if (error) throw error;
                        setMatch(prev => prev ? { ...prev, status: 'in_progress' } : prev);
                        toast({ title: 'Scoring started', description: 'Match is now in progress.' });
                      } catch (e) {
                        console.error(e);
                        toast({ title: 'Error', description: 'Failed to start match', variant: 'destructive' });
                      }
                    }}
                  />
                ) : match.status === 'in_progress' && battingTeam && bowlingTeam ? (
                  <LiveScoring
                    matchId={match.id}
                    currentInning={currentInning}
                    currentOver={currentOver}
                    currentBall={currentBall}
                    battingTeamPlayers={battingTeam.id === match.team_a.id ? teamAPlayers : teamBPlayers}
                    bowlingTeamPlayers={bowlingTeam.id === match.team_a.id ? teamAPlayers : teamBPlayers}
                    totalOvers={match.overs}
                    onScoreAdded={handleScoreAdded}
                    onPositionUpdate={handlePositionUpdate}
                    initialBatsmen={selectedBatsmen || undefined}
                    initialBowler={selectedBowler || undefined}
                  />
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">Preparing match data...</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchDetail; 