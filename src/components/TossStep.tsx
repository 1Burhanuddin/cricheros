import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shuffle } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain: { name: string };
}

interface TossStepProps {
  matchId: string;
  teamA: Team;
  teamB: Team;
  onSaved: (winner: Team, decision: 'bat' | 'bowl') => void;
}

const TossStep: React.FC<TossStepProps> = ({ matchId, teamA, teamB, onSaved }) => {
  const { toast } = useToast();
  const [isTossing, setIsTossing] = useState(false);
  const [winner, setWinner] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayText, setDisplayText] = useState('Ready for toss');
  const intervalRef = useRef<number | null>(null);

  const startToss = () => {
    setIsTossing(true);
    setWinner(null);
    const words = [teamA.name, teamB.name, 'Heads', 'Tails'];
    let i = 0;
    intervalRef.current = window.setInterval(() => {
      setDisplayText(words[i % words.length]);
      i += 1;
    }, 150);

    setTimeout(() => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      const win = Math.random() < 0.5 ? teamA : teamB;
      setWinner(win);
      setIsTossing(false);
      setDisplayText(`${win.name} won the toss`);
    }, 2200);
  };

  const saveDecision = async (decision: 'bat' | 'bowl') => {
    if (!winner) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ toss_winner_id: winner.id, toss_decision: decision })
        .eq('id', matchId);

      if (error) throw error;

      toast({ title: 'Toss saved', description: `${winner.name} chose to ${decision}.` });
      onSaved(winner, decision);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to save toss', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shuffle className="h-5 w-5" /> Toss
        </CardTitle>
        <CardDescription>Start the toss animation and record the result.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg text-center">
          <div className="text-lg font-semibold">{displayText}</div>
        </div>
        {!winner ? (
          <Button onClick={startToss} disabled={isTossing} className="w-full" size="lg">
            {isTossing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Tossing...
              </>
            ) : (
              'Start Toss'
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="text-center">
              <Badge variant="default">{winner.name} won the toss</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => saveDecision('bat')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Bat
              </Button>
              <Button onClick={() => saveDecision('bowl')} variant="outline" disabled={saving}>
                Bowl
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TossStep;
