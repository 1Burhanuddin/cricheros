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
import { formatOverDisplay, overToDecimal, getCurrentOverDisplay } from '@/utils/overManagement';

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
          ),
          current_batsmen,
          current_bowler_id
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

      // If match is in progress, hydrate current selections so scoring can resume
      if (matchData.status === 'in_progress') {
        if (Array.isArray(matchData.current_batsmen) && matchData.current_batsmen.length > 0) {
          setSelectedBatsmen(matchData.current_batsmen as string[]);
        }
        if (matchData.current_bowler_id) {
          setSelectedBowler(matchData.current_bowler_id as string);
        }
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
    
    // Handle team switching when innings change
    if (inning > currentInning && inning <= 2) {
      // Switch batting and bowling teams
      const newBattingTeam = battingTeam?.id === match?.team_a.id ? match?.team_b : match?.team_a;
      const newBowlingTeam = battingTeam?.id === match?.team_a.id ? match?.team_a : match?.team_b;
      
      setBattingTeam(newBattingTeam);
      setBowlingTeam(newBowlingTeam);
      
      // Clear current selections to force new selection
      setSelectedBatsmen(null);
      setSelectedBowler(null);
      
      toast({
        title: "Innings Change",
        description: `Innings ${inning} starting. ${newBattingTeam?.name} will bat, ${newBowlingTeam?.name} will bowl. Please select new batsmen and bowler.`
      });
    }
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
          {/* Match Content (expanded to include match info) */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="scorecard" className="w-full">
              <TabsList className={`grid w-full ${isCreator ? 'grid-cols-2' : 'grid-cols-1'} rounded-full bg-muted p-1`}>
                <TabsTrigger value="scorecard" className="rounded-full">Scorecard</TabsTrigger>
                {isCreator && <TabsTrigger value="scoring" className="rounded-full">Live Scoring</TabsTrigger>}
              </TabsList>

              <TabsContent value="scorecard" className="space-y-4">
                {/* Scorecard */}
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
                    meta={{
                      status: match.status,
                      location: match.location,
                      tossWinnerName: match.toss_winner?.name || null,
                      tossDecision: match.toss_decision
                    }}
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
                            return formatOverDisplay(overNum, ballNum);
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
                          {/* Team A */}
                          <div>
                            <h3 className="font-semibold mb-3">{match.team_a.name}</h3>
                            <div className="space-y-0">
                              {teamAPlayers
                                .filter(p => p.is_playing_xi)
                                .sort((a, b) => {
                                  // Sort currently playing players first
                                  const aIsPlaying = selectedBatsmen && selectedBatsmen.includes(a.player_id);
                                  const bIsPlaying = selectedBatsmen && selectedBatsmen.includes(b.player_id);
                                  if (aIsPlaying && !bIsPlaying) return -1;
                                  if (!aIsPlaying && bIsPlaying) return 1;
                                  return 0;
                                })
                                .map((player, index) => {
                                  // Check if this player is currently batting
                                  const isCurrentlyBatting = selectedBatsmen && selectedBatsmen.includes(player.player_id);
                                  const isCurrentTeamBatting = currentInning === 1 && battingTeam?.id === match.team_a.id;
                                  
                                  // Calculate player stats if they have played
                                  let runs = 0;
                                  let balls = 0;
                                  let wickets = 0;
                                  let overs = 0;
                                  
                                  if (isCurrentTeamBatting && isCurrentlyBatting) {
                                    // Calculate batting stats for current batsmen
                                    const batsmanScores = scores.filter(score => 
                                      score.batsman_id === player.player_id && score.inning === currentInning
                                    );
                                    runs = batsmanScores.reduce((total, score) => total + (score.runs || 0), 0);
                                    balls = batsmanScores.filter(score => 
                                      !score.extras_type || ['bye', 'leg_bye'].includes(score.extras_type)
                                    ).length;
                                  } else if (isCurrentTeamBatting && !isCurrentlyBatting) {
                                    // Calculate bowling stats for current bowlers
                                    const bowlerScores = scores.filter(score => 
                                      score.bowler_id === player.player_id && score.inning === currentInning
                                    );
                                    wickets = bowlerScores.filter(score => score.wicket_type).length;
                                    overs = Math.floor(bowlerScores.length / 6) + (bowlerScores.length % 6) / 10;
                                  }
                                  
                                  return (
                                    <div key={player.id} className="flex items-center justify-between py-2 relative border-b border-gray-200 last:border-b-0">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                          <AvatarImage src={player.player.image_url || ''} />
                                          <AvatarFallback className="text-xs">
                                            {player.player.name?.charAt(0)?.toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">
                                          {player.player.name}
                                          {isCurrentlyBatting && isCurrentTeamBatting && (
                                            <span className="text-green-600 ml-1">*</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        {isCurrentTeamBatting && isCurrentlyBatting ? (
                                          <span className="text-sm font-mono">
                                            {runs}({balls})
                                          </span>
                                        ) : isCurrentTeamBatting && !isCurrentlyBatting ? (
                                          <span className="text-sm text-muted-foreground">
                                            {wickets}/{overs.toFixed(1)}
                                          </span>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">
                                            {isCurrentlyBatting ? 'Yet to bat' : ''}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Team B */}
                          <div>
                            <h3 className="font-semibold mb-3">{match.team_b.name}</h3>
                            <div className="space-y-0">
                              {teamBPlayers
                                .filter(p => p.is_playing_xi)
                                .sort((a, b) => {
                                  // Sort currently playing players first
                                  const aIsPlaying = selectedBatsmen && selectedBatsmen.includes(a.player_id);
                                  const bIsPlaying = selectedBatsmen && selectedBatsmen.includes(b.player_id);
                                  if (aIsPlaying && !bIsPlaying) return -1;
                                  if (!aIsPlaying && bIsPlaying) return 1;
                                  return 0;
                                })
                                .map((player, index) => {
                                  // Check if this player is currently batting
                                  const isCurrentlyBatting = selectedBatsmen && selectedBatsmen.includes(player.player_id);
                                  const isCurrentTeamBatting = currentInning === 2 && battingTeam?.id === match.team_b.id;
                                  
                                  // Calculate player stats if they have played
                                  let runs = 0;
                                  let balls = 0;
                                  let wickets = 0;
                                  let overs = 0;
                                  
                                  if (isCurrentTeamBatting && isCurrentlyBatting) {
                                    // Calculate batting stats for current batsmen
                                    const batsmanScores = scores.filter(score => 
                                      score.batsman_id === player.player_id && score.inning === currentInning
                                    );
                                    runs = batsmanScores.reduce((total, score) => total + (score.runs || 0), 0);
                                    balls = batsmanScores.filter(score => 
                                      !score.extras_type || ['bye', 'leg_bye'].includes(score.extras_type)
                                    ).length;
                                  } else if (isCurrentTeamBatting && !isCurrentlyBatting) {
                                    // Calculate bowling stats for current bowlers
                                    const bowlerScores = scores.filter(score => 
                                      score.bowler_id === player.player_id && score.inning === currentInning
                                    );
                                    wickets = bowlerScores.filter(score => score.wicket_type).length;
                                    overs = Math.floor(bowlerScores.length / 6) + (bowlerScores.length % 6) / 10;
                                  }
                                  
                                  return (
                                    <div key={player.id} className="flex items-center justify-between py-2 relative border-b border-gray-200 last:border-b-0">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                          <AvatarImage src={player.player.image_url || ''} />
                                          <AvatarFallback className="text-xs">
                                            {player.player.name?.charAt(0)?.toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">
                                          {player.player.name}
                                          {isCurrentlyBatting && isCurrentTeamBatting && (
                                            <span className="text-green-600 ml-1">*</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        {isCurrentTeamBatting && isCurrentlyBatting ? (
                                          <span className="text-sm font-mono">
                                            {runs}({balls})
                                          </span>
                                        ) : isCurrentTeamBatting && !isCurrentlyBatting ? (
                                          <span className="text-sm text-muted-foreground">
                                            {wickets}/{overs.toFixed(1)}
                                          </span>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">
                                            {isCurrentlyBatting ? 'Yet to bat' : ''}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
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
                          .update({ 
                            status: 'in_progress',
                            current_batsmen: batsmen,
                            current_bowler_id: bowler
                          })
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
                    key={`${match.id}-${currentInning}-${battingTeam?.id}`}
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