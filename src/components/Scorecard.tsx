import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Target, Users } from 'lucide-react';
import { formatOverDisplay, overToDecimal, decimalToOver } from '@/utils/overManagement';

interface Player {
  id: string;
  name: string;
  image_url: string | null;
  batting_style: string | null;
  bowling_style: string | null;
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
  batsman?: Player;
  bowler?: Player;
}

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain: {
    name: string;
  };
}

interface MatchPlayer {
  id: string;
  player_id: string;
  is_playing_xi: boolean;
  player: Player;
}

interface ScorecardProps {
  scores: Score[];
  battingTeam: Team;
  bowlingTeam: Team;
  currentInning: number;
  currentOver: number;
  currentBall: number;
  totalOvers: number;
  teamAPlayers: MatchPlayer[];
  teamBPlayers: MatchPlayer[];
  meta?: {
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    location?: string | null;
    tossWinnerName?: string | null;
    tossDecision?: 'bat' | 'bowl' | null;
  };
}

const Scorecard: React.FC<ScorecardProps> = ({
  scores,
  battingTeam,
  bowlingTeam,
  currentInning,
  currentOver,
  currentBall,
  totalOvers,
  teamAPlayers,
  teamBPlayers,
  meta
}) => {
  const currentInningScores = scores.filter(s => s.inning === currentInning);
  const previousInningScores = scores.filter(s => s.inning < currentInning);

  const calculateTeamScore = (teamId: string, inning: number) => {
    const teamScores = scores.filter(s => {
      const isBatting = (inning === 1 && battingTeam.id === teamId) || 
                       (inning === 2 && bowlingTeam.id === teamId);
      return s.inning === inning && isBatting;
    });

    const totalRuns = teamScores.reduce((sum, score) => sum + score.runs + (score.extras_runs || 0), 0);
    const wickets = teamScores.filter(s => s.wicket_type).length;
    
    // Calculate overs properly using the utility function
    const totalBalls = teamScores.length;
    const overs = overToDecimal(Math.floor(totalBalls / 6), (totalBalls % 6) + 1);

    return { runs: totalRuns, wickets, overs };
  };

  const getPlayerName = (playerId: string) => {
    // Search in both teams
    const allPlayers = [...teamAPlayers, ...teamBPlayers];
    const player = allPlayers.find(p => p.player_id === playerId);
    return player ? player.player.name : `Player ${playerId.slice(0, 8)}`;
  };

  const formatOver = (over: number, ball: number) => {
    return formatOverDisplay(over, ball);
  };

  const getScoreDescription = (score: Score) => {
    let description = `${score.runs} run(s)`;
    
    if (score.extras_type) {
      description += ` + ${score.extras_runs} ${score.extras_type.replace('_', ' ')}`;
    }
    
    if (score.wicket_type) {
      description += ` + Wicket (${score.wicket_type.replace('_', ' ')})`;
    }
    
    return description;
  };

  const currentTeamScore = calculateTeamScore(battingTeam.id, currentInning);
  const previousTeamScore = previousInningScores.length > 0 
    ? calculateTeamScore(bowlingTeam.id, currentInning - 1) 
    : null;

  return (
    <div className="space-y-6">
      {/* Current Score Summary (includes match meta) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Current Score
          </CardTitle>
          {meta && (
            <CardDescription className="text-xs">
              <span className="inline-block mr-2">Status: {meta.status.replace('_', ' ')}</span>
              {typeof meta.location === 'string' && meta.location && (
                <span className="inline-block mr-2">• Location: {meta.location}</span>
              )}
              {meta.tossWinnerName && meta.tossDecision && (
                <span className="inline-block">• Toss: {meta.tossWinnerName} ({meta.tossDecision})</span>
              )}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Batting Team */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={battingTeam.logo_url || ''} />
                  <AvatarFallback className="text-sm">
                    {battingTeam.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm">{battingTeam.name}</h3>
                  <p className="text-xl font-bold text-primary">
                    {currentTeamScore.runs}/{currentTeamScore.wickets}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Overs: {formatOver(Math.floor(currentTeamScore.overs), Math.round((currentTeamScore.overs % 1) * 6))}
                  </p>
                </div>
              </div>
            </div>

            {/* Bowling Team */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={bowlingTeam.logo_url || ''} />
                  <AvatarFallback className="text-sm">
                    {bowlingTeam.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm">{bowlingTeam.name}</h3>
                  {previousTeamScore ? (
                    <p className="text-xl font-bold text-primary">
                      {previousTeamScore.runs}/{previousTeamScore.wickets}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Yet to bat</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Current Position */}
          <div className="mt-3 p-2">
            <div className="flex items-center justify-between">
              <Badge variant="default" className="text-xs">
                Inning {currentInning} • Over {currentOver}.{currentBall} • {totalOvers} overs match
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ball-by-Ball Commentary */}
      {/* <Card>
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
          {currentInningScores.length === 0 ? (
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
          )}
        </CardContent>
      </Card> */}

      {/* Innings Summary */}
      {previousInningScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Previous Innings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(new Set(previousInningScores.map(s => s.inning))).map(inning => {
                const inningScores = previousInningScores.filter(s => s.inning === inning);
                const teamScore = calculateTeamScore(bowlingTeam.id, inning);
                
                return (
                  <div key={inning} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Inning {inning}</h4>
                        <p className="text-sm text-muted-foreground">
                          {bowlingTeam.name}: {teamScore.runs}/{teamScore.wickets}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatOver(Math.floor(teamScore.overs), Math.round((teamScore.overs % 1) * 6))} overs
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Scorecard; 