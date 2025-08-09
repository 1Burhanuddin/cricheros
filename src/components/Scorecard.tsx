import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Target, Users } from 'lucide-react';

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
  teamBPlayers
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
    const overs = Math.floor(teamScores.length / 6) + (teamScores.length % 6) / 10;

    return { runs: totalRuns, wickets, overs };
  };

  const getPlayerName = (playerId: string) => {
    // Search in both teams
    const allPlayers = [...teamAPlayers, ...teamBPlayers];
    const player = allPlayers.find(p => p.player_id === playerId);
    return player ? player.player.name : `Player ${playerId.slice(0, 8)}`;
  };

  const formatOver = (over: number, ball: number) => {
    return `${over}.${ball}`;
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
      {/* Current Score Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Current Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Batting Team */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={battingTeam.logo_url || ''} />
                  <AvatarFallback className="text-lg">
                    {battingTeam.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{battingTeam.name}</h3>
                  <p className="text-2xl font-bold text-primary">
                    {currentTeamScore.runs}/{currentTeamScore.wickets}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Overs: {formatOver(Math.floor(currentTeamScore.overs), Math.round((currentTeamScore.overs % 1) * 6))}
                  </p>
                </div>
              </div>
            </div>

            {/* Bowling Team */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={bowlingTeam.logo_url || ''} />
                  <AvatarFallback className="text-lg">
                    {bowlingTeam.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{bowlingTeam.name}</h3>
                  {previousTeamScore ? (
                    <p className="text-2xl font-bold text-primary">
                      {previousTeamScore.runs}/{previousTeamScore.wickets}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Yet to bat</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Current Position */}
          <div className="mt-4 p-3 ">
            <div className="flex items-center justify-between">
              {/* <span className="text-sm font-medium">Current Position:</span> */}
              <Badge variant="default">
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