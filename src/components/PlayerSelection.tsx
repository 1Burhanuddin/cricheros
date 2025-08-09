import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

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

interface PlayerSelectionProps {
  battingTeamPlayers: MatchPlayer[];
  bowlingTeamPlayers: MatchPlayer[];
  onSelected: (batsmen: string[], bowler: string) => void;
}

const PlayerSelection: React.FC<PlayerSelectionProps> = ({ battingTeamPlayers, bowlingTeamPlayers, onSelected }) => {
  const { toast } = useToast();
  const playingBatsmen = useMemo(() => battingTeamPlayers.filter(p => p.is_playing_xi), [battingTeamPlayers]);
  const playingBowlers = useMemo(() => bowlingTeamPlayers.filter(p => p.is_playing_xi), [bowlingTeamPlayers]);

  const [batsman1, setBatsman1] = useState<string>('');
  const [batsman2, setBatsman2] = useState<string>('');
  const [bowler, setBowler] = useState<string>('');

  const canConfirm = batsman1 && batsman2 && batsman1 !== batsman2 && bowler;

  const confirm = () => {
    if (!canConfirm) {
      toast({ title: 'Select players', description: 'Choose two different batsmen and one bowler.', variant: 'destructive' });
      return;
    }
    onSelected([batsman1, batsman2], bowler);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opening Players</CardTitle>
        <CardDescription>Select two batsmen and one bowler to begin the innings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Striker</Label>
            <Select value={batsman1} onValueChange={setBatsman1}>
              <SelectTrigger>
                <SelectValue placeholder="Select striker" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {playingBatsmen.map(p => (
                  <SelectItem key={p.player_id} value={p.player_id}>{p.player.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Non-striker</Label>
            <Select value={batsman2} onValueChange={setBatsman2}>
              <SelectTrigger>
                <SelectValue placeholder="Select non-striker" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {playingBatsmen.map(p => (
                  <SelectItem key={p.player_id} value={p.player_id}>{p.player.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Bowler</Label>
          <Select value={bowler} onValueChange={setBowler}>
            <SelectTrigger>
              <SelectValue placeholder="Select bowler" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {playingBowlers.map(p => (
                <SelectItem key={p.player_id} value={p.player_id}>{p.player.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={confirm} className="w-full" disabled={!canConfirm}>
          Start Scoring
        </Button>
      </CardContent>
    </Card>
  );
};

export default PlayerSelection;
