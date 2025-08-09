import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Target, Zap, X } from 'lucide-react';

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
  player: Player;
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

interface LiveScoringProps {
  matchId: string;
  currentInning: number;
  currentOver: number;
  currentBall: number;
  battingTeamPlayers: MatchPlayer[];
  bowlingTeamPlayers: MatchPlayer[];
  totalOvers: number;
  onScoreAdded: (score: Score) => void;
  onPositionUpdate: (inning: number, over: number, ball: number) => void;
  initialBatsmen?: string[];
  initialBowler?: string;
}

const LiveScoring: React.FC<LiveScoringProps> = ({
  matchId,
  currentInning,
  currentOver,
  currentBall,
  battingTeamPlayers,
  bowlingTeamPlayers,
  totalOvers,
  onScoreAdded,
  onPositionUpdate,
  initialBatsmen,
  initialBowler
}) => {
  const { toast } = useToast();
  const [selectedBatsman, setSelectedBatsman] = useState<string>('');
  const [selectedBowler, setSelectedBowler] = useState<string>('');
  const [scoringRuns, setScoringRuns] = useState(0);
  const [scoringExtras, setScoringExtras] = useState<{ type: string; runs: number } | null>(null);
  const [scoringWicket, setScoringWicket] = useState<{ type: string; batsman_id: string } | null>(null);
  const [savingScore, setSavingScore] = useState(false);
  const [newInning, setNewInning] = useState(currentInning);
  const [newOver, setNewOver] = useState(currentOver);
  const [newBall, setNewBall] = useState(currentBall);

  const playingXIBatsmen = battingTeamPlayers.filter(p => p.is_playing_xi);
  const playingXIBowlers = bowlingTeamPlayers.filter(p => p.is_playing_xi);
  const batsmenList = playingXIBatsmen.length ? playingXIBatsmen : battingTeamPlayers;
  const bowlersList = playingXIBowlers.length ? playingXIBowlers : bowlingTeamPlayers;

useEffect(() => {
  setNewInning(currentInning);
  setNewOver(currentOver);
  setNewBall(currentBall);
}, [currentInning, currentOver, currentBall]);

useEffect(() => {
  if (!selectedBatsman && initialBatsmen?.length) {
    setSelectedBatsman(initialBatsmen[0]);
  }
  if (!selectedBowler && initialBowler) {
    setSelectedBowler(initialBowler);
  }
}, [initialBatsmen, initialBowler]);

  const addScore = async () => {
    if (!selectedBatsman || !selectedBowler) {
      toast({
        title: "Error",
        description: "Please select batsman and bowler",
        variant: "destructive"
      });
      return;
    }

    setSavingScore(true);
    try {
      const scoreData = {
        match_id: matchId,
        inning: newInning,
        over_number: newOver,
        ball_number: newBall,
        batsman_id: selectedBatsman,
        bowler_id: selectedBowler,
        runs: scoringRuns,
        extras_type: scoringExtras?.type || null,
        extras_runs: scoringExtras?.runs || 0,
        wicket_type: scoringWicket?.type || null,
        wicket_batsman_id: scoringWicket?.batsman_id || null
      };

      const { data: newScore, error } = await supabase
        .from('match_scores')
        .insert(scoreData)
        .select()
        .single();

      if (error) throw error;

      // Update position
      let nextInning = newInning;
      let nextOver = newOver;
      let nextBall = newBall + 1;

      if (nextBall > 6) {
        nextOver = nextOver + 1;
        nextBall = 1;
      }

      // Check if innings should change
      if (nextOver > totalOvers) {
        nextInning = nextInning + 1;
        nextOver = 1;
        nextBall = 1;
      }

      onScoreAdded(newScore);
      onPositionUpdate(nextInning, nextOver, nextBall);

      // Reset form
      setScoringRuns(0);
      setScoringExtras(null);
      setScoringWicket(null);

      toast({
        title: "Score Added",
        description: `${scoringRuns} run(s) added to the scorecard`
      });
    } catch (error) {
      console.error('Error adding score:', error);
      toast({
        title: "Error",
        description: "Failed to add score",
        variant: "destructive"
      });
    } finally {
      setSavingScore(false);
    }
  };

  const handleRunsClick = (runs: number) => {
    setScoringRuns(runs);
    // Clear extras and wicket when runs are selected
    setScoringExtras(null);
    setScoringWicket(null);
  };

  const handleExtrasClick = (extraType: string) => {
    setScoringExtras({ type: extraType, runs: 1 });
    // Clear runs when extras are selected
    setScoringRuns(0);
  };

  const handleWicketClick = (wicketType: string) => {
    setScoringWicket({ type: wicketType, batsman_id: selectedBatsman });
  };

  const clearSelections = () => {
    setScoringRuns(0);
    setScoringExtras(null);
    setScoringWicket(null);
  };

  const getScoreDescription = () => {
    let description = `${scoringRuns} run(s)`;
    
    if (scoringExtras) {
      description += ` + ${scoringExtras.runs} ${scoringExtras.type.replace('_', ' ')}`;
    }
    
    if (scoringWicket) {
      description += ` + Wicket (${scoringWicket.type.replace('_', ' ')})`;
    }
    
    return description;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Live Scoring
        </CardTitle>
        <CardDescription>
          Current: Inning {newInning}, Over {newOver}.{newBall} of {totalOvers}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Player Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Batsman</Label>
            <Select value={selectedBatsman} onValueChange={setSelectedBatsman}>
              <SelectTrigger>
                <SelectValue placeholder="Select batsman" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {batsmenList.map((player) => (
                  <SelectItem key={player.player_id} value={player.player_id}>
                    {player.player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bowler</Label>
            <Select value={selectedBowler} onValueChange={setSelectedBowler}>
              <SelectTrigger>
                <SelectValue placeholder="Select bowler" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {bowlersList.map((player) => (
                  <SelectItem key={player.player_id} value={player.player_id}>
                    {player.player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Runs Selection */}
        <div className="space-y-2">
          <Label>Runs</Label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
              <Button
                key={runs}
                variant={scoringRuns === runs ? "default" : "outline"}
                onClick={() => handleRunsClick(runs)}
                className="h-12 text-lg font-semibold"
              >
                {runs}
              </Button>
            ))}
          </div>
        </div>

        {/* Extras Selection */}
        <div className="space-y-2">
          <Label>Extras (Optional)</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'wide', label: 'Wide' },
              { type: 'no_ball', label: 'No Ball' },
              { type: 'bye', label: 'Bye' },
              { type: 'leg_bye', label: 'Leg Bye' }
            ].map((extra) => (
              <Button
                key={extra.type}
                variant={scoringExtras?.type === extra.type ? "default" : "outline"}
                onClick={() => handleExtrasClick(extra.type)}
                className="h-8"
              >
                {extra.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Wicket Selection */}
        <div className="space-y-2">
          <Label>Wicket (Optional)</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'bowled', label: 'Bowled' },
              { type: 'caught', label: 'Caught' },
              { type: 'lbw', label: 'LBW' },
              { type: 'run_out', label: 'Run Out' },
              { type: 'stumped', label: 'Stumped' },
              { type: 'hit_wicket', label: 'Hit Wicket' }
            ].map((wicket) => (
              <Button
                key={wicket.type}
                variant={scoringWicket?.type === wicket.type ? "default" : "outline"}
                onClick={() => handleWicketClick(wicket.type)}
                className="h-8"
                disabled={!selectedBatsman}
              >
                {wicket.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Current Selection Display */}
        {(scoringRuns > 0 || scoringExtras || scoringWicket) && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Current Selection:</Label>
                <p className="text-sm text-muted-foreground">{getScoreDescription()}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelections}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Add Score Button */}
        <Button 
          onClick={addScore} 
          disabled={savingScore || !selectedBatsman || !selectedBowler}
          className="w-full"
          size="lg"
        >
          {savingScore ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding Score...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Add Score
            </>
          )}
        </Button>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleRunsClick(4)}
            className="flex-1"
          >
            <Zap className="h-4 w-4 mr-2" />
            Four
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRunsClick(6)}
            className="flex-1"
          >
            <Zap className="h-4 w-4 mr-2" />
            Six
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveScoring; 