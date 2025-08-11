import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, X, Zap, Target, Undo2 } from 'lucide-react';
import { 
  calculateNextPosition, 
  shouldSwapBatsmen, 
  formatOverDisplay,
  canAddBall,
  getMatchStateSummary,
  type OverPosition,
  type TeamSwitch 
} from '@/utils/overManagement';

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

const LiveScoring = ({
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
}: LiveScoringProps) => {
  const { toast } = useToast();
  const [selectedBatsman, setSelectedBatsman] = useState<string>(''); // Current striker
  const [nonStriker, setNonStriker] = useState<string>(''); // Current non-striker
  const [selectedBowler, setSelectedBowler] = useState<string>('');
  const [scoringRuns, setScoringRuns] = useState(0);
  const [scoringExtras, setScoringExtras] = useState<{ type: string; runs: number } | null>(null);
  const [scoringWicket, setScoringWicket] = useState<{ type: string; batsman_id: string; fielder_id?: string } | null>(null);
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
  
  // Track current teams for internal team switching
  const [currentBattingTeam, setCurrentBattingTeam] = useState(battingTeamPlayers);
  const [currentBowlingTeam, setCurrentBowlingTeam] = useState(bowlingTeamPlayers);
  
  // Use ref to track previous teams to avoid circular dependency
  const prevTeamsRef = useRef({ batting: battingTeamPlayers, bowling: bowlingTeamPlayers });
  const prevInningRef = useRef(currentInning);

  // Add state
  const [showStartSecondInning, setShowStartSecondInning] = useState(false);

  // Get available players from the correct teams
  const playingXIBatsmen = currentBattingTeam.filter(p => p.is_playing_xi);
  const playingXIBowlers = currentBowlingTeam.filter(p => p.is_playing_xi);
  const batsmenList = playingXIBatsmen.length ? playingXIBatsmen : currentBattingTeam;
  const bowlersList = playingXIBowlers.length ? playingXIBowlers : currentBowlingTeam;

  // Helper function to get player name
  const getPlayerName = (playerId: string) => {
    const player = batsmenList.find(p => p.player_id === playerId) || bowlersList.find(p => p.player_id === playerId);
    return player ? player.player.name : 'Unknown Player';
  };

  useEffect(() => {
    setNewInning(currentInning);
    setNewOver(currentOver);
    setNewBall(currentBall);
  }, [currentInning, currentOver, currentBall]);

  useEffect(() => {
    // Update team information when props change
    const prevBatting = prevTeamsRef.current.batting;
    const prevBowling = prevTeamsRef.current.bowling;
    
    const prevInning = prevInningRef.current;
    const newInningNum = currentInning;

    console.log('Team props changed:', {
      newBatting: battingTeamPlayers.map(p => p.player.name),
      newBowling: bowlingTeamPlayers.map(p => p.player.name),
      prevBatting: prevBatting.map(p => p.player.name),
      prevBowling: prevBowling.map(p => p.player.name)
    });
    
    // Check if teams have actually changed
    if (battingTeamPlayers !== prevBatting || bowlingTeamPlayers !== prevBowling) {
      console.log('Teams have changed, updating...');
      
      setCurrentBattingTeam(battingTeamPlayers);
      setCurrentBowlingTeam(bowlingTeamPlayers);
      
      // Reset selections when teams change (e.g., new innings)
      setSelectedBatsman('');
      setNonStriker('');
      setSelectedBowler('');
      setShowFielderSelector(false);
      
      // Only show selectors if showStartSecondInning is false
      if (!showStartSecondInning && newInningNum > prevInning) {
        setShowNewBatsmanSelector(true);
        setShowBowlerSelector(true);
      } else {
        setShowNewBatsmanSelector(false);
        setShowBowlerSelector(false);
      }
      
      // Update ref
      prevTeamsRef.current = { batting: battingTeamPlayers, bowling: bowlingTeamPlayers };
    }
    prevInningRef.current = currentInning;
  }, [battingTeamPlayers, bowlingTeamPlayers, currentInning, showStartSecondInning]);

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

  const handleInningsChangeSelection = () => {
    if (!selectedBatsman || !nonStriker || !selectedBowler) {
      toast({
        title: "Error",
        description: "Please select both batsmen and bowler",
        variant: "destructive"
      });
      return;
    }

    // Close both selectors
    setShowNewBatsmanSelector(false);
    setShowBowlerSelector(false);
    
    // Reset form and continue
    setScoringRuns(0);
    setScoringExtras(null);
    setScoringWicket(null);
    setValidationError('');
    
    toast({
      title: "New Innings Started",
      description: `Innings ${newInning} started with ${getPlayerName(selectedBatsman)} and ${getPlayerName(nonStriker)} batting, ${getPlayerName(selectedBowler)} bowling.`
    });
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

    // Validate that batsmen are from batting team and bowler is from bowling team
    const isBatsmanFromBattingTeam = currentBattingTeam.some(p => p.player_id === selectedBatsman);
    const isNonStrikerFromBattingTeam = currentBattingTeam.some(p => p.player_id === nonStriker);
    const isBowlerFromBowlingTeam = currentBowlingTeam.some(p => p.player_id === selectedBowler);
    
    if (!isBatsmanFromBattingTeam || !isNonStrikerFromBattingTeam) {
      toast({
        title: "Error",
        description: "Selected batsmen must be from the batting team",
        variant: "destructive"
      });
      return;
    }
    
    if (!isBowlerFromBowlingTeam) {
      toast({
        title: "Error",
        description: "Selected bowler must be from the bowling team",
        variant: "destructive"
      });
      return;
    }

    // Check if ball can be added
    const currentPosition: OverPosition = {
      inning: newInning,
      over: newOver,
      ball: newBall
    };
    
    if (!canAddBall(currentPosition, totalOvers)) {
      toast({
        title: "Error",
        description: "Cannot add more balls. Match or innings is complete.",
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

      // Call the callback to notify parent component about the new score
      onScoreAdded(newScore);

      // Use new over management system
      const currentPosition: OverPosition = {
        inning: newInning,
        over: newOver,
        ball: newBall
      };
      
      const { nextPosition, teamSwitch } = calculateNextPosition(
        currentPosition,
        totalOvers,
        totalRuns
      );

      // Update position
      onPositionUpdate(nextPosition.inning, nextPosition.over, nextPosition.ball);

      // Handle batsmen swapping
      const isEndOfOver = teamSwitch.shouldSwitchTeams;
      if (shouldSwapBatsmen(totalRuns, isEndOfOver)) {
        const currentStriker = selectedBatsman;
        const currentNonStriker = nonStriker;
        setSelectedBatsman(currentNonStriker);
        setNonStriker(currentStriker);
      }

      // Handle innings change
      if (teamSwitch.isInningComplete) {
        setShowStartSecondInning(true);
        setShowBowlerSelector(false);
        setShowNewBatsmanSelector(false);
        setPreviousBowler(selectedBowler);
        setSelectedBatsman('');
        setNonStriker('');
        setSelectedBowler('');
        toast({
          title: "Innings Complete",
          description: `Innings ${newInning} complete. Teams will switch. Click 'Start 2nd Inning' to continue.`
        });
        return;
      }

      // Handle team switching at end of over (but not end of innings)
      if (teamSwitch.shouldSwitchTeams && !teamSwitch.isInningComplete) {
        // Switch batting and bowling teams
        setShowBowlerSelector(true);
        setPreviousBowler(selectedBowler);
        
        // Clear current selections to force new selection
        setSelectedBowler('');
        
        toast({
          title: "Over Complete",
          description: `Over ${formatOverDisplay(newOver, 6)} complete. Please select new bowler.`
        });
        
        return; // Don't reset form yet, wait for bowler selection
      }

      // Handle match completion
      if (teamSwitch.isMatchComplete) {
        toast({
          title: "Match Complete",
          description: "All innings completed. Match is finished!"
        });
        
        // Reset form
        setScoringRuns(0);
        setScoringExtras(null);
        setScoringWicket(null);
        setValidationError('');
        
        return;
      }

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

  // Persist current selection to matches so session survives reloads
  useEffect(() => {
    const persist = async () => {
      try {
        if (!matchId) return;
        const batsmenToSave = selectedBatsman && nonStriker ? [selectedBatsman, nonStriker] : null;
        await supabase
          .from('matches')
          .update({
            current_batsmen: batsmenToSave,
            current_bowler_id: selectedBowler || null,
          })
          .eq('id', matchId);
      } catch (e) {
        // non-fatal
      }
    };
    // Only persist when we have any selection
    if (selectedBatsman || nonStriker || selectedBowler) {
      persist();
    }
  }, [matchId, selectedBatsman, nonStriker, selectedBowler]);

  // Recompute on resume: populate batsman/bowler panels from DB so they don't show 0 after reload
  useEffect(() => {
    const recomputePanelsFromDb = async () => {
      try {
        if (!matchId) return;
        const { data: inningScores } = await supabase
          .from('match_scores')
          .select('*')
          .eq('match_id', matchId)
          .eq('inning', newInning)
          .order('over_number', { ascending: true })
          .order('ball_number', { ascending: true });

        const isBallFaced = (extrasType?: string | null) => !extrasType || extrasType === 'bye' || extrasType === 'leg_bye';
        const isLegalDelivery = (extrasType?: string | null) => extrasType !== 'wide' && extrasType !== 'no_ball';
        const isCreditedWicket = (wicketType?: string | null) => !!wicketType && ['bowled','caught','lbw','stumped','hit_wicket'].includes(wicketType);

        // Batsman stats for striker and non-striker
        if (selectedBatsman) {
          const balls = (inningScores || []).filter(s => s.batsman_id === selectedBatsman && isBallFaced(s.extras_type)).length;
          const runs = (inningScores || []).filter(s => s.batsman_id === selectedBatsman).reduce((sum, s) => sum + (s.runs || 0), 0);
          setBatsmanStats(prev => ({
            ...prev,
            [selectedBatsman]: { runs, balls }
          }));
        }
        if (nonStriker) {
          const balls = (inningScores || []).filter(s => s.batsman_id === nonStriker && isBallFaced(s.extras_type)).length;
          const runs = (inningScores || []).filter(s => s.batsman_id === nonStriker).reduce((sum, s) => sum + (s.runs || 0), 0);
          setBatsmanStats(prev => ({
            ...prev,
            [nonStriker]: { runs, balls }
          }));
        }

        // Bowler stats for current bowler
        if (selectedBowler) {
          const bowlerBalls = (inningScores || []).filter(s => s.bowler_id === selectedBowler && isLegalDelivery(s.extras_type)).length;
          const bowlerRuns = (inningScores || []).filter(s => s.bowler_id === selectedBowler).reduce((sum, s) => {
            const extrasToBowler = s.extras_type === 'wide' || s.extras_type === 'no_ball';
            return sum + (s.runs || 0) + (extrasToBowler ? (s.extras_runs || 0) : 0);
          }, 0);
          const bowlerWkts = (inningScores || []).filter(s => s.bowler_id === selectedBowler && isCreditedWicket(s.wicket_type)).length;
          setBowlerStats(prev => ({
            ...prev,
            [selectedBowler]: { balls: bowlerBalls, runs: bowlerRuns, wickets: bowlerWkts }
          }));
        }
      } catch (e) {
        // non-fatal
      }
    };

    // Recompute when we have selections and inning context
    if (matchId && newInning) {
      recomputePanelsFromDb();
    }
  }, [matchId, newInning, selectedBatsman, nonStriker, selectedBowler]);

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

    // Replace the dismissed batsman
    if (scoringWicket && scoringWicket.batsman_id === selectedBatsman) {
      setSelectedBatsman(newBatsmanId);
    } else if (scoringWicket && scoringWicket.batsman_id === nonStriker) {
      setNonStriker(newBatsmanId);
    }

    // Close the selector
    setShowNewBatsmanSelector(false);
    setNewBatsmanId('');

    // Reset form and continue
    setScoringRuns(0);
    setScoringExtras(null);
    setScoringWicket(null);
    setValidationError('');

    toast({
      title: "New Batsman Selected",
      description: `${getPlayerName(newBatsmanId)} is the new batsman.`
    });
  };

  const handleNewBowlerSelection = () => {
    if (!selectedBowler) {
      toast({
        title: "Error",
        description: "Please select a bowler",
        variant: "destructive"
      });
      return;
    }

    // Track previous bowler to prevent consecutive overs
    setPreviousBowler(selectedBowler);

    // Close the bowler selector
    setShowBowlerSelector(false);
    
    // Reset form and continue
    setScoringRuns(0);
    setScoringExtras(null);
    setScoringWicket(null);
    setValidationError('');
    
    toast({
      title: "New Over Started",
      description: `${getPlayerName(selectedBowler)} will bowl the next over.`
    });
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
    // Batsmen should come from the batting team
    const availableBatsmen = batsmenList.filter(player => 
      player.player_id !== selectedBatsman && 
      player.player_id !== nonStriker
    );
    
    console.log('Available batsmen from batting team:', availableBatsmen.map(p => p.player.name));
    return availableBatsmen;
  };

  const getAvailableBowlers = () => {
    // Bowlers should come from the bowling team (the team that's NOT batting)
    const availableBowlers = bowlersList.filter(player => 
      player.player_id !== previousBowler
    );
    
    console.log('Available bowlers from bowling team:', availableBowlers.map(p => p.player.name));
    return availableBowlers;
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

  // Add a handler for the button
  const handleStartSecondInning = () => {
    setShowStartSecondInning(false);
    setShowNewBatsmanSelector(true);
    setShowBowlerSelector(true);
  };

  const isFirstInningComplete = currentInning === 1 && (newOver >= totalOvers || (newOver === totalOvers && newBall === 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Live Scoring
        </CardTitle>
        <CardDescription>
          {getMatchStateSummary({ inning: newInning, over: newOver, ball: newBall }, totalOvers)}
          <br />
          <span className="text-xs text-muted-foreground">
            Batting: {currentBattingTeam[0]?.player?.name || 'Unknown'} | 
            Bowling: {currentBowlingTeam[0]?.player?.name || 'Unknown'}
          </span>
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

        {/* Innings Change Selector Popup Modal */}
        <Dialog open={showNewBatsmanSelector && showBowlerSelector} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-green-600">🔄 New Innings!</DialogTitle>
              <DialogDescription>
                Innings {newInning} is starting. Teams have switched roles. Please select new batsmen and bowler.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select New Batsmen</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Striker</Label>
                    <Select value={selectedBatsman} onValueChange={setSelectedBatsman}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose striker" />
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
                  <div>
                    <Label className="text-xs">Non-Striker</Label>
                    <Select value={nonStriker} onValueChange={setNonStriker}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose non-striker" />
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
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Select New Bowler</Label>
                <Select value={selectedBowler} onValueChange={setSelectedBowler}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose bowler" />
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
                  onClick={handleInningsChangeSelection} 
                  className="flex-1"
                  disabled={!selectedBatsman || !nonStriker || !selectedBowler}
                >
                  Start New Innings
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewBatsmanSelector(false);
                    setShowBowlerSelector(false);
                  }}
                  className="flex-1"
                >
                  Cancel
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

        {/* Start Second Inning Card */}
        {isFirstInningComplete && showStartSecondInning && (
          <Card className="my-8">
            <CardHeader>
              <CardTitle>🏏 1st Innings Complete!</CardTitle>
              <CardDescription>
                Click below to start the 2nd inning. You will then select the new batsmen and bowler.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full" onClick={handleStartSecondInning}>
                Start 2nd Inning
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Current Statistics Display */}
        {!showStartSecondInning && (
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
        )}

        {/* Player Selection */}
        {!showStartSecondInning && (
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
        )}

        {/* Runs Selection */}
        {!showStartSecondInning && (
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
        )}

        {/* Extras Selection */}
        {!showStartSecondInning && (
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
        )}

        {/* Wickets Selection */}
        {!showStartSecondInning && (
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
        )}

        {/* Validation Error Display */}
        {!showStartSecondInning && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive font-medium">{validationError}</p>
            </div>
          </div>
        )}

        {/* Current Selection Display */}
        {!showStartSecondInning && (
          (scoringRuns > 0 || scoringExtras || scoringWicket) && (
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
          )
        )}

        {/* Add Score Button */}
        {!showStartSecondInning && (
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
        )}

        {/* Undo Button */}
        {!showStartSecondInning && (
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
        )}

        {/* Scoring Disabled Message */}
        {!showStartSecondInning && (
          (showNewBatsmanSelector || showBowlerSelector || showFielderSelector) && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ Scoring is disabled until player selection is complete
              </p>
            </div>
          )
        )}

        {/* Quick Actions */}
        {!showStartSecondInning && (
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
        )}
      </CardContent>
    </Card>
  );
};

export default LiveScoring; 