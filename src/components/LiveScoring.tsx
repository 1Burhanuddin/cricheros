import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, X, Zap, Target, Undo2 } from 'lucide-react';

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
  const [selectedBatsman, setSelectedBatsman] = useState<string>(''); // Current striker
  const [nonStriker, setNonStriker] = useState<string>(''); // Current non-striker
  const [selectedBowler, setSelectedBowler] = useState<string>('');
  const [scoringRuns, setScoringRuns] = useState(0);
  const [scoringExtras, setScoringExtras] = useState<{ type: string; runs: number } | null>(null);
  const [scoringWicket, setScoringWicket] = useState<{ type: string; batsman_id: string } | null>(null);
  const [savingScore, setSavingScore] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [newInning, setNewInning] = useState(currentInning);
  const [newOver, setNewOver] = useState(currentOver);
  const [newBall, setNewBall] = useState(currentBall);
  const [showNewBatsmanSelector, setShowNewBatsmanSelector] = useState(false);
  const [newBatsmanId, setNewBatsmanId] = useState<string>('');
  const [showBowlerSelector, setShowBowlerSelector] = useState(false);
  const [previousBowler, setPreviousBowler] = useState<string | null>(null);
  const [batsmanStats, setBatsmanStats] = useState<{[key: string]: {runs: number, balls: number}}>({});
  const [bowlerStats, setBowlerStats] = useState<{[key: string]: {balls: number, runs: number, wickets: number}}>({});
  
  // Fielder selection for wickets
  const [showFielderSelector, setShowFielderSelector] = useState(false);
  const [selectedFielderId, setSelectedFielderId] = useState<string>('');
  const [wicketRequiringFielder, setWicketRequiringFielder] = useState<string | null>(null);
  
  // Undo functionality
  const [undoingScore, setUndoingScore] = useState(false);
  const [lastScoreId, setLastScoreId] = useState<string | null>(null);

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
    setSelectedBatsman(initialBatsmen[0]); // First batsman is striker
    setNonStriker(initialBatsmen[1] || ''); // Second batsman is non-striker
  }
  if (!selectedBowler && initialBowler) {
    setSelectedBowler(initialBowler);
  }
}, [initialBatsmen, initialBowler]);

  // Validation function for cricket scoring rules
  const validateScoring = (): { isValid: boolean; error: string } => {
    // Check if wicket type allows runs
    if (scoringWicket && scoringRuns > 0) {
      // Only run out allows runs to be scored with a wicket
      if (scoringWicket.type !== 'run_out') {
        return {
          isValid: false,
          error: `Runs cannot be scored with ${scoringWicket.type.replace('_', ' ').toUpperCase()} dismissals. Only RUN OUT allows runs.`
        };
      }
    }

    // All other combinations are valid
    return { isValid: true, error: '' };
  };

  const addScore = async () => {
    if (!selectedBatsman || !nonStriker || !selectedBowler) {
      toast({
        title: "Error",
        description: "Please select both batsmen and bowler",
        variant: "destructive"
      });
      return;
    }

    // Validate scoring combination
    const validation = validateScoring();
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    // Clear any previous validation errors
    setValidationError('');

    setSavingScore(true);
    try {
      // Calculate total runs including extras
      const totalRuns = scoringRuns + (scoringExtras?.runs || 0);
      
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

      // Store the last score ID for undo functionality
      setLastScoreId(newScore.id);

      // Update position
      let nextInning = newInning;
      let nextOver = newOver;
      let nextBall = newBall + 1;
      let shouldSwapBatsmen = false;

      // Check if batsmen should swap due to odd runs
      if (totalRuns % 2 === 1) {
        shouldSwapBatsmen = true;
      }

      if (nextBall > 6) {
        nextOver = nextOver + 1;
        nextBall = 1;
        // Batsmen always swap at end of over (regardless of runs)
        shouldSwapBatsmen = true;
      }

      // Swap batsmen if needed
      if (shouldSwapBatsmen) {
        const currentStriker = selectedBatsman;
        const currentNonStriker = nonStriker;
        setSelectedBatsman(currentNonStriker);
        setNonStriker(currentStriker);
      }

      // Check if innings should change
      if (nextOver >= totalOvers) {
        nextInning = nextInning + 1;
        nextOver = 0;
        nextBall = 1;
      }

      onScoreAdded(newScore);
      onPositionUpdate(nextInning, nextOver, nextBall);

      // Update batsman and bowler statistics
      const batsmanId = selectedBatsman;
      const bowlerId = selectedBowler;
      
      // Update batsman stats (only if not extras like wide/no-ball)
      if (!scoringExtras || ['bye', 'leg_bye'].includes(scoringExtras.type)) {
        setBatsmanStats(prev => ({
          ...prev,
          [batsmanId]: {
            runs: (prev[batsmanId]?.runs || 0) + scoringRuns,
            balls: (prev[batsmanId]?.balls || 0) + 1
          }
        }));
      }
      
      // Update bowler stats
      const bowlerRuns = scoringRuns + (scoringExtras?.runs || 0);
      const bowlerWickets = scoringWicket ? 1 : 0;
      setBowlerStats(prev => ({
        ...prev,
        [bowlerId]: {
          balls: (prev[bowlerId]?.balls || 0) + 1,
          runs: (prev[bowlerId]?.runs || 0) + bowlerRuns,
          wickets: (prev[bowlerId]?.wickets || 0) + bowlerWickets
        }
      }));
      
      // Handle wicket - check if fielder selection is needed first
      if (scoringWicket) {
        const wicketsRequiringFielder = ['caught', 'stumped', 'run_out'];
        if (wicketsRequiringFielder.includes(scoringWicket.type)) {
          setWicketRequiringFielder(scoringWicket.type);
          setShowFielderSelector(true);
          return; // Don't proceed until fielder is selected
        }
        
        // For other wickets, show new batsman selector (except run out)
        if (scoringWicket.type !== 'run_out') {
          setShowNewBatsmanSelector(true);
          return; // Don't reset form yet, wait for new batsman selection
        }
      }
      
      // Handle end of over - show bowler selector
      if (nextBall === 1 && nextOver > newOver) {
        setShowBowlerSelector(true);
        return; // Don't reset form yet, wait for bowler selection
      }

      // Reset form
      setScoringRuns(0);
      setScoringExtras(null);
      setScoringWicket(null);
      setValidationError('');

      const description = getScoreDescription();
      toast({
        title: "Score Added",
        description: description
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

  const handleUndo = async () => {
    if (!lastScoreId) {
      toast({
        title: "Error",
        description: "No recent score to undo",
        variant: "destructive"
      });
      return;
    }

    setUndoingScore(true);
    try {
      // Get the last score details before deleting
      const { data: lastScore, error: fetchError } = await supabase
        .from('match_scores')
        .select('*')
        .eq('id', lastScoreId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the last score from database
      const { error: deleteError } = await supabase
        .from('match_scores')
        .delete()
        .eq('id', lastScoreId);

      if (deleteError) throw deleteError;

      // Don't revert position - keep current position so next score can be added
      // The position stays at the current ball, we just removed the score for it

      // Revert batsman stats
      const batsmanId = lastScore.batsman_id;
      if (!lastScore.extras_type || ['bye', 'leg_bye'].includes(lastScore.extras_type)) {
        setBatsmanStats(prev => ({
          ...prev,
          [batsmanId]: {
            runs: Math.max(0, (prev[batsmanId]?.runs || 0) - (lastScore.runs || 0)),
            balls: Math.max(0, (prev[batsmanId]?.balls || 0) - 1)
          }
        }));
      }

      // Revert bowler stats
      const bowlerId = lastScore.bowler_id;
      const bowlerRuns = (lastScore.runs || 0) + (lastScore.extras_runs || 0);
      const bowlerWickets = lastScore.wicket_type ? 1 : 0;
      setBowlerStats(prev => ({
        ...prev,
        [bowlerId]: {
          balls: Math.max(0, (prev[bowlerId]?.balls || 0) - 1),
          runs: Math.max(0, (prev[bowlerId]?.runs || 0) - bowlerRuns),
          wickets: Math.max(0, (prev[bowlerId]?.wickets || 0) - bowlerWickets)
        }
      }));

      // Close any open modals
      setShowNewBatsmanSelector(false);
      setShowBowlerSelector(false);
      setShowFielderSelector(false);

      // Reset form
      setScoringRuns(0);
      setScoringExtras(null);
      setScoringWicket(null);
      setValidationError('');
      setNewBatsmanId('');
      setSelectedFielderId('');
      setWicketRequiringFielder(null);

      // Clear the last score ID
      setLastScoreId(null);

      toast({
        title: "Score Undone",
        description: "Last ball has been reverted successfully"
      });

    } catch (error) {
      console.error('Error undoing score:', error);
      toast({
        title: "Error",
        description: "Failed to undo last score",
        variant: "destructive"
      });
    } finally {
      setUndoingScore(false);
    }
  };

  const handleRunsClick = (runs: number) => {
    setScoringRuns(runs);
    
    // If runs > 0, auto-deselect any wicket except run_out
    if (runs > 0 && scoringWicket && scoringWicket.type !== 'run_out') {
      setScoringWicket(null);
    }
    
    // Clear validation error when user makes changes
    setValidationError('');
  };

  const handleExtrasClick = (extraType: string) => {
    // Toggle extras - if same type is clicked, remove it
    if (scoringExtras?.type === extraType) {
      setScoringExtras(null);
    } else {
      setScoringExtras({ type: extraType, runs: 1 });
      
      // When extras are selected, auto-deselect any wicket except run_out
      if (scoringWicket && scoringWicket.type !== 'run_out') {
        setScoringWicket(null);
      }
    }
    // Clear validation error when user makes changes
    setValidationError('');
  };

  const handleWicketClick = (wicketType: string) => {
    // Toggle wicket - if same type is clicked, remove it
    if (scoringWicket?.type === wicketType) {
      setScoringWicket(null);
    } else {
      setScoringWicket({ type: wicketType, batsman_id: selectedBatsman });
      
      // If wicket is not run_out, auto-set runs to 0 and clear extras
      if (wicketType !== 'run_out') {
        setScoringRuns(0);
        setScoringExtras(null);
      }
    }
    // Clear validation error when user makes changes
    setValidationError('');
  };

  const clearSelections = () => {
    setScoringRuns(0);
    setScoringExtras(null);
    setScoringWicket(null);
    setValidationError('');
  };

  const handleNewBatsmanSelection = () => {
    if (!newBatsmanId) {
      toast({
        title: "Error",
        description: "Please select a new batsman",
        variant: "destructive"
      });
      return;
    }
    
    // Replace the dismissed batsman with new batsman
    if (scoringWicket?.batsman_id === selectedBatsman) {
      setSelectedBatsman(newBatsmanId);
    } else {
      setNonStriker(newBatsmanId);
    }
    
    // Reset states
    setShowNewBatsmanSelector(false);
    setNewBatsmanId('');
    setScoringRuns(0);
    setScoringExtras(null);
    setScoringWicket(null);
    setValidationError('');
  };

  const handleNewBowlerSelection = () => {
    if (!selectedBowler) {
      toast({
        title: "Error", 
        description: "Please select a bowler for the new over",
        variant: "destructive"
      });
      return;
    }
    
    // Track previous bowler to prevent consecutive overs
    setPreviousBowler(selectedBowler);
    
    // Reset states
    setShowBowlerSelector(false);
    setScoringRuns(0);
    setScoringExtras(null);
    setScoringWicket(null);
    setValidationError('');
  };

  const handleFielderSelection = () => {
    if (!selectedFielderId) {
      toast({
        title: "Error",
        description: "Please select the fielder who was involved in the wicket",
        variant: "destructive"
      });
      return;
    }

    // Add fielder info to the wicket data
    if (scoringWicket) {
      setScoringWicket({
        ...scoringWicket,
        fielder_id: selectedFielderId
      });
    }

    // Reset fielder selection states
    setShowFielderSelector(false);
    setSelectedFielderId('');
    setWicketRequiringFielder(null);

    // Now proceed with normal wicket handling
    if (scoringWicket && scoringWicket.type !== 'run_out') {
      setShowNewBatsmanSelector(true);
    } else {
      // For run out, continue normal flow
      setScoringRuns(0);
      setScoringExtras(null);
      setScoringWicket(null);
      setValidationError('');
    }
  };

  const getAvailableBatsmen = () => {
    return batsmenList.filter(player => 
      player.player_id !== selectedBatsman && 
      player.player_id !== nonStriker
    );
  };

  const getAvailableBowlers = () => {
    // Exclude previous bowler to prevent consecutive overs
    return bowlersList.filter(player => 
      player.player_id !== previousBowler
    );
  };

  const getScoreDescription = () => {
    const parts = [];
    
    if (scoringRuns > 0) {
      parts.push(`${scoringRuns} run${scoringRuns !== 1 ? 's' : ''}`);
    }
    
    if (scoringExtras) {
      parts.push(`${scoringExtras.runs} ${scoringExtras.type.replace('_', ' ')}`);
    }
    
    if (scoringWicket) {
      parts.push(`Wicket (${scoringWicket.type.replace('_', ' ')})`);
    }
    
    if (parts.length === 0) {
      return 'Dot ball';
    }
    
    return parts.join(' + ');
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
        {/* New Batsman Selector Popup Modal */}
        <Dialog open={showNewBatsmanSelector} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">🏏 Wicket!</DialogTitle>
              <DialogDescription>
                A batsman has been dismissed. Please select a new batsman to continue the match.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select New Batsman</Label>
                <Select value={newBatsmanId} onValueChange={setNewBatsmanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose replacement batsman" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableBatsmen().map((player) => (
                      <SelectItem key={player.player_id} value={player.player_id}>
                        {player.player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleNewBatsmanSelection} 
                  className="flex-1"
                  disabled={!newBatsmanId}
                >
                  Continue with New Batsman
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleUndo}
                  disabled={undoingScore || !lastScoreId}
                  className="flex-1"
                >
                  {undoingScore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Undoing...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Undo Last Ball
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Bowler Selector Popup Modal */}
        <Dialog open={showBowlerSelector} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-blue-600">🎳 End of Over!</DialogTitle>
              <DialogDescription>
                The over is complete. Please select a new bowler for the next over. 
                {previousBowler && (
                  <span className="block mt-1 text-sm text-muted-foreground">
                    Note: The previous bowler cannot bowl consecutive overs.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select New Bowler</Label>
                <Select value={selectedBowler} onValueChange={setSelectedBowler}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose bowler for new over" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableBowlers().map((player) => (
                      <SelectItem key={player.player_id} value={player.player_id}>
                        {player.player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleNewBowlerSelection} 
                  className="flex-1"
                  disabled={!selectedBowler}
                >
                  Start New Over
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleUndo}
                  disabled={undoingScore || !lastScoreId}
                  className="flex-1"
                >
                  {undoingScore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Undoing...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Undo Last Ball
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fielder Selection Popup Modal */}
        <Dialog open={showFielderSelector} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-orange-600">🥎 Select Fielder</DialogTitle>
              <DialogDescription>
                {wicketRequiringFielder === 'caught' && "Who caught the ball?"}
                {wicketRequiringFielder === 'stumped' && "Who stumped the batsman?"}
                {wicketRequiringFielder === 'run_out' && "Who ran out the batsman?"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Fielder</Label>
                <Select value={selectedFielderId} onValueChange={setSelectedFielderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose the fielder" />
                  </SelectTrigger>
                  <SelectContent>
                    {bowlersList.map((player) => (
                      <SelectItem key={player.player_id} value={player.player_id}>
                        {player.player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleFielderSelection} 
                  className="flex-1"
                  disabled={!selectedFielderId}
                >
                  Continue with Selected Fielder
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleUndo}
                  disabled={undoingScore || !lastScoreId}
                  className="flex-1"
                >
                  {undoingScore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Undoing...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Undo Last Ball
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Current Statistics Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Batsman Statistics */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Batsman Stats</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">
                  {selectedBatsman ? batsmenList.find(p => p.player_id === selectedBatsman)?.player.name : 'N/A'} *
                </span>
                <span>{batsmanStats[selectedBatsman]?.runs || 0}({batsmanStats[selectedBatsman]?.balls || 0})</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {nonStriker ? batsmenList.find(p => p.player_id === nonStriker)?.player.name : 'N/A'}
                </span>
                <span>{batsmanStats[nonStriker]?.runs || 0}({batsmanStats[nonStriker]?.balls || 0})</span>
              </div>
            </div>
          </div>

          {/* Bowler Statistics */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-800 mb-2">Bowler Stats</h4>
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="font-medium">
                  {selectedBowler ? bowlersList.find(p => p.player_id === selectedBowler)?.player.name : 'N/A'}
                </span>
                <span>
                  {Math.floor((bowlerStats[selectedBowler]?.balls || 0) / 6)}.{(bowlerStats[selectedBowler]?.balls || 0) % 6}-{bowlerStats[selectedBowler]?.runs || 0}-{bowlerStats[selectedBowler]?.wickets || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Player Selection */}
        <div className="space-y-4">
          {/* Current Batsmen Display */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  On Strike
                </Label>
                <div className="p-2 bg-background rounded border">
                  <span className="font-medium">
                    {selectedBatsman ? batsmenList.find(p => p.player_id === selectedBatsman)?.player.name : 'Select Striker'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Non-Striker</Label>
                <div className="p-2 bg-background rounded border">
                  <span className="font-medium">
                    {nonStriker ? batsmenList.find(p => p.player_id === nonStriker)?.player.name : 'Select Non-Striker'}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Batsmen will automatically rotate based on runs scored and end of overs
            </p>
          </div>

          {/* Bowler Selection - Locked during play */}
          <div className="space-y-2">
            <Label>Current Bowler</Label>
            <div className="p-2 bg-background rounded border">
              <span className="font-medium">
                {selectedBowler ? bowlersList.find(p => p.player_id === selectedBowler)?.player.name : 'Select Bowler'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Bowler can only be changed at the end of each over
            </p>
          </div>
        </div>

        {/* Runs Selection */}
        <div className="space-y-2">
          <Label>Runs</Label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((runs) => {
              // Disable runs > 0 when wicket is selected (except run_out)
              const isDisabled = runs > 0 && scoringWicket && scoringWicket.type !== 'run_out';
              // Disable all scoring when modals are open
              const isModalOpen = showNewBatsmanSelector || showBowlerSelector || showFielderSelector;
              
              return (
                <Button
                  key={runs}
                  variant={scoringRuns === runs ? "default" : "outline"}
                  onClick={() => handleRunsClick(runs)}
                  className="h-12 text-lg font-semibold"
                  disabled={isDisabled || isModalOpen}
                >
                  {runs}
                </Button>
              );
            })}
          </div>
          {scoringWicket && scoringWicket.type !== 'run_out' && (
            <p className="text-xs text-muted-foreground">
              Only 0 runs allowed with {scoringWicket.type.replace('_', ' ').toUpperCase()} dismissals
            </p>
          )}
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
            ].map((extra) => {
              // Disable extras when wicket is selected (except run_out)
              const isDisabled = scoringWicket && scoringWicket.type !== 'run_out';
              // Disable all scoring when modals are open
              const isModalOpen = showNewBatsmanSelector || showBowlerSelector || showFielderSelector;
              
              return (
                <Button
                  key={extra.type}
                  variant={scoringExtras?.type === extra.type ? "default" : "outline"}
                  onClick={() => handleExtrasClick(extra.type)}
                  className="h-8"
                  disabled={isDisabled || isModalOpen}
                >
                  {extra.label}
                </Button>
              );
            })}
          </div>
          {scoringWicket && scoringWicket.type !== 'run_out' && (
            <p className="text-xs text-muted-foreground">
              No extras allowed with {scoringWicket.type.replace('_', ' ').toUpperCase()} dismissals
            </p>
          )}
        </div>

        {/* Wickets Selection */}
        <div className="space-y-2">
          <Label>Wickets (Optional)</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'bowled', label: 'Bowled' },
              { type: 'caught', label: 'Caught' },
              { type: 'lbw', label: 'LBW' },
              { type: 'run_out', label: 'Run Out' },
              { type: 'stumped', label: 'Stumped' },
              { type: 'hit_wicket', label: 'Hit Wicket' }
            ].map((wicket) => {
              // Disable wickets when extras are selected (except run_out)
              const isDisabled = scoringExtras && wicket.type !== 'run_out';
              // Disable all scoring when modals are open
              const isModalOpen = showNewBatsmanSelector || showBowlerSelector || showFielderSelector;
              
              return (
                <Button
                  key={wicket.type}
                  variant={scoringWicket?.type === wicket.type ? "default" : "outline"}
                  onClick={() => handleWicketClick(wicket.type)}
                  className="h-8"
                  disabled={isDisabled || isModalOpen}
                >
                  {wicket.label}
                </Button>
              );
            })}
          </div>
          {(scoringRuns > 0 || scoringExtras) && (
            <p className="text-xs text-muted-foreground">
              Only Run Out is available when runs are scored or extras are selected
            </p>
          )}
        </div>

        {/* Validation Error Display */}
        {validationError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive font-medium">{validationError}</p>
            </div>
          </div>
        )}

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
          disabled={savingScore || !selectedBatsman || !selectedBowler || showNewBatsmanSelector || showBowlerSelector || showFielderSelector}
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

        {/* Undo Button */}
        <Button
          variant="destructive"
          onClick={handleUndo}
          disabled={undoingScore || !lastScoreId}
          className="w-full"
          size="lg"
        >
          {undoingScore ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Undoing...
            </>
          ) : (
            <>
              <Undo2 className="h-4 w-4 mr-2" />
              Undo Last Ball
            </>
          )}
        </Button>

        {/* Scoring Disabled Message */}
        {(showNewBatsmanSelector || showBowlerSelector || showFielderSelector) && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ Scoring is disabled until player selection is complete
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleRunsClick(4)}
            className="flex-1"
            disabled={showNewBatsmanSelector || showBowlerSelector || showFielderSelector}
          >
            <Zap className="h-4 w-4 mr-2" />
            Four
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRunsClick(6)}
            className="flex-1"
            disabled={showNewBatsmanSelector || showBowlerSelector || showFielderSelector}
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