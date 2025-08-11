import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Save, Trophy, Target, UserCircle2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSearchParams } from 'react-router-dom';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  image_url: string | null;
  batting_style: 'right_handed' | 'left_handed' | null;
  bowling_style: 'right_arm_fast' | 'left_arm_fast' | 'right_arm_medium' | 'left_arm_medium' | 'right_arm_spin' | 'left_arm_spin' | 'wicket_keeper' | null;
  created_at: string;
  updated_at: string;
}

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    batting_style: '',
    bowling_style: '',
    image_url: ''
  });
  // Stats tab state
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [totalWickets, setTotalWickets] = useState(0);
  const [totalBallsFaced, setTotalBallsFaced] = useState(0);
  const [battingDismissals, setBattingDismissals] = useState(0);
  const [totalBallsBowled, setTotalBallsBowled] = useState(0);
  const [totalRunsConceded, setTotalRunsConceded] = useState(0);
  const [matchRows, setMatchRows] = useState<Array<{
    id: string;
    name: string;
    date: string;
    overs: number;
    batRuns: number;
    batBalls: number;
    batSR: number;
    batOut: boolean;
    bowlBalls: number;
    bowlOvers: string;
    bowlRuns: number;
    bowlWkts: number;
    bowlEcon: number;
  }>>([]);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create one
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user?.id,
              name: user?.email?.split('@')[0] || '',
              image_url: null,
              batting_style: null,
              bowling_style: null
            })
            .select()
            .single();

          if (createError) throw createError;
          
          setProfile(newProfile);
          setFormData({
            name: newProfile.name || '',
            batting_style: newProfile.batting_style || '',
            bowling_style: newProfile.bowling_style || '',
            image_url: newProfile.image_url || ''
          });
          // Set the profile ID for stats
          const qp = searchParams.get('playerId');
          const finalProfileId = qp || newProfile.id;
          console.log('Debug - Setting profile ID after creation:', { qp, newProfileId: newProfile.id, finalProfileId });
          setSelectedProfileId(finalProfileId);
        } else {
          throw error;
        }
      } else {
        setProfile(data);
        setFormData({
          name: data.name || '',
          batting_style: data.batting_style || '',
          bowling_style: data.bowling_style || '',
          image_url: data.image_url || ''
        });
        // If a playerId is present in query, prefer that; otherwise current user's profile
        const qp = searchParams.get('playerId');
        const finalProfileId = qp || data.id;
        console.log('Debug - Setting profile ID:', { qp, dataId: data.id, finalProfileId });
        setSelectedProfileId(finalProfileId);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load stats whenever selectedProfileId changes
  useEffect(() => {
    const qp = searchParams.get('playerId');
    if (qp && qp !== selectedProfileId) {
      setSelectedProfileId(qp);
    }
    if (selectedProfileId) {
      console.log('Debug - Fetching stats for profile:', selectedProfileId);
      fetchStats(selectedProfileId);
    }
  }, [selectedProfileId, searchParams]);

  const fetchStats = async (profileId: string) => {
    console.log('Debug - fetchStats called with profileId:', profileId);
    setStatsLoading(true);
    try {
      // Test database connection first
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', profileId)
        .single();
      
      if (testError) {
        console.error('Debug - Database connection test failed:', testError);
        throw testError;
      }
      console.log('Debug - Database connection test successful:', testData);

      // Check if there are any matches in the database at all
      const { data: allMatches, error: allMatchesError } = await supabase
        .from('matches')
        .select('id, name, date')
        .limit(5);
      
      if (allMatchesError) {
        console.error('Debug - Error checking all matches:', allMatchesError);
      } else {
        console.log('Debug - All matches in database:', allMatches);
      }

      // Get all matches this player participated in
      const { data: matchPlayers, error: mpError } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('player_id', profileId);

      if (mpError) throw mpError;

      const matchIds = (matchPlayers || []).map(r => r.match_id);
      console.log('Debug - Match IDs found:', matchIds);
      setTotalMatches(matchIds.length);

      if (matchIds.length === 0) {
        // No matches played, set everything to 0
        setTotalRuns(0);
        setTotalWickets(0);
        setTotalBallsFaced(0);
        setTotalBallsBowled(0);
        setTotalRunsConceded(0);
        setBattingDismissals(0);
        setMatchRows([]);
        return;
      }

      // Get all match scores for this player (batting and bowling)
      const { data: allScores, error: scoresError } = await supabase
        .from('match_scores')
        .select('*')
        .in('match_id', matchIds);

      if (scoresError) throw scoresError;

      console.log('Debug - Profile Stats:', {
        profileId,
        matchIds,
        allScoresCount: allScores?.length || 0,
        allScores: allScores
      });

      // Calculate batting stats
      const battingScores = allScores.filter(s => s.batsman_id === profileId);
      const totalRunsScored = battingScores.reduce((sum, s) => sum + (s.runs || 0), 0);
      const totalBallsFaced = battingScores.filter(s => 
        s.extras_type !== 'wide' && s.extras_type !== 'no_ball'
      ).length;
      
      // Calculate bowling stats
      const bowlingScores = allScores.filter(s => s.bowler_id === profileId);
      const totalWicketsTaken = bowlingScores.filter(s => 
        s.wicket_type && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(s.wicket_type)
      ).length;
      const totalBallsBowled = bowlingScores.filter(s => 
        s.extras_type !== 'wide' && s.extras_type !== 'no_ball'
      ).length;
      const totalRunsConceded = bowlingScores.reduce((sum, s) => {
        let runs = s.runs || 0;
        // Add extras to bowler's conceded runs
        if (s.extras_type === 'wide' || s.extras_type === 'no_ball') {
          runs += s.extras_runs || 0;
        }
        return sum + runs;
      }, 0);

      // Calculate dismissals for batting average
      const dismissals = allScores.filter(s => 
        s.wicket_batsman_id === profileId && s.wicket_type
      ).length;

      // Set the calculated stats
      setTotalRuns(totalRunsScored);
      setTotalWickets(totalWicketsTaken);
      setTotalBallsFaced(totalBallsFaced);
      setTotalBallsBowled(totalBallsBowled);
      setTotalRunsConceded(totalRunsConceded);
      setBattingDismissals(dismissals);

      console.log('Debug - Calculated Stats:', {
        totalRunsScored,
        totalWicketsTaken,
        totalBallsFaced,
        totalBallsBowled,
        totalRunsConceded,
        dismissals
      });

      // Also log the state variables to see if they're being set
      console.log('Debug - State variables after setting:', {
        totalMatches: matchIds.length,
        totalRuns: totalRunsScored,
        totalWickets: totalWicketsTaken,
        totalBallsFaced,
        totalBallsBowled,
        totalRunsConceded,
        dismissals
      });

      // Get match details for per-match breakdown
      const { data: matches, error: matchDetailsError } = await supabase
        .from('matches')
        .select('id, name, date, overs')
        .in('id', matchIds)
        .order('date', { ascending: false });

      if (matchDetailsError) throw matchDetailsError;

      // Calculate per-match stats
      const perMatchStats = matches.map(match => {
        const matchScores = allScores.filter(s => s.match_id === match.id);
        
        // Batting stats for this match
        const matchBattingScores = matchScores.filter(s => s.batsman_id === profileId);
        const matchRuns = matchBattingScores.reduce((sum, s) => sum + (s.runs || 0), 0);
        const matchBalls = matchBattingScores.filter(s => 
          s.extras_type !== 'wide' && s.extras_type !== 'no_ball'
        ).length;
        const matchSR = matchBalls > 0 ? (matchRuns * 100) / matchBalls : 0;
        const matchOut = matchScores.some(s => s.wicket_batsman_id === profileId);

        // Bowling stats for this match
        const matchBowlingScores = matchScores.filter(s => s.bowler_id === profileId);
        const matchBallsBowled = matchBowlingScores.filter(s => 
          s.extras_type !== 'wide' && s.extras_type !== 'no_ball'
        ).length;
        const matchWickets = matchBowlingScores.filter(s => 
          s.wicket_type && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(s.wicket_type)
        ).length;
        const matchRunsConceded = matchBowlingScores.reduce((sum, s) => {
          let runs = s.runs || 0;
          if (s.extras_type === 'wide' || s.extras_type === 'no_ball') {
            runs += s.extras_runs || 0;
          }
          return sum + runs;
        }, 0);
        const matchEcon = matchBallsBowled > 0 ? (matchRunsConceded * 6) / matchBallsBowled : 0;

        return {
          id: match.id,
          name: match.name,
          date: match.date,
          overs: match.overs,
          batRuns: matchRuns,
          batBalls: matchBalls,
          batSR: matchSR,
          batOut: matchOut,
          bowlBalls: matchBallsBowled,
          bowlOvers: `${Math.floor(matchBallsBowled / 6)}.${matchBallsBowled % 6}`,
          bowlRuns: matchRunsConceded,
          bowlWkts: matchWickets,
          bowlEcon: matchEcon,
        };
      });

      setMatchRows(perMatchStats);

    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Failed to load player statistics",
        variant: "destructive"
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          batting_style: formData.batting_style || null,
          bowling_style: formData.bowling_style || null,
          image_url: formData.image_url || null
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchProfile();
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      // For now, we'll use a placeholder image URL
      // In a real app, you'd upload to Supabase Storage or a service like Imgur
      const imageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`;
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
      
      toast({
        title: "Image Updated",
        description: "Profile image updated successfully"
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
    }
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
        <PageHeader title="Player Profile" subtitle="Manage your profile and view player statistics" />

        <Tabs defaultValue="details" className="max-w-4xl w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted p-1">
            <TabsTrigger value="details" className="rounded-full flex items-center gap-2">
              <UserCircle2 className="h-4 w-4" /> Details
            </TabsTrigger>
            <TabsTrigger value="stats" className="rounded-full flex items-center gap-2">
              <Target className="h-4 w-4" /> Player Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <div className="max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={profile?.image_url || ''} />
                      <AvatarFallback>
                        {profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-semibold">Profile Information</h2>
                      <CardDescription>Your cricket profile details</CardDescription>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    {/* Hide big profile icon per request */}
                    {false && (
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profile?.image_url || ''} />
                        <AvatarFallback className="text-2xl">
                          {profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {isEditing && (
                      <div className="space-y-2">
                        <Label htmlFor="image-upload" className="cursor-pointer">
                          <Button variant="outline" size="sm" asChild>
                            <span>
                              <Camera className="h-4 w-4 mr-2" />
                              Change Photo
                            </span>
                          </Button>
                        </Label>
                        <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} disabled={!isEditing} placeholder="Enter your full name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="batting-style">Batting Style</Label>
                        <Select value={formData.batting_style} onValueChange={(value) => setFormData(prev => ({ ...prev, batting_style: value }))} disabled={!isEditing}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select batting style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="right_handed">Right Handed</SelectItem>
                            <SelectItem value="left_handed">Left Handed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bowling-style">Bowling Style</Label>
                        <Select value={formData.bowling_style} onValueChange={(value) => setFormData(prev => ({ ...prev, bowling_style: value }))} disabled={!isEditing}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select bowling style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="right_arm_fast">Right Arm Fast</SelectItem>
                            <SelectItem value="left_arm_fast">Left Arm Fast</SelectItem>
                            <SelectItem value="right_arm_medium">Right Arm Medium</SelectItem>
                            <SelectItem value="left_arm_medium">Left Arm Medium</SelectItem>
                            <SelectItem value="right_arm_spin">Right Arm Spin</SelectItem>
                            <SelectItem value="left_arm_spin">Left Arm Spin</SelectItem>
                            <SelectItem value="wicket_keeper">Wicket Keeper</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      {isEditing ? (
                        <>
                          <Button onClick={handleSave} disabled={saving}>
                            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : (<><Save className="h-4 w-4 mr-2" />Save Changes</>)}
                          </Button>
                          <Button variant="outline" onClick={() => { setIsEditing(false); setFormData({ name: profile?.name || '', batting_style: profile?.batting_style || '', bowling_style: profile?.bowling_style || '', image_url: profile?.image_url || '' }); }} disabled={saving}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Player Statistics</CardTitle>
                  <CardDescription>Career aggregates and per-match performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Career batting summary table */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Batting Summary</h3>
                    {totalMatches === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No matches played yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matches</TableHead>
                            <TableHead>Runs</TableHead>
                            <TableHead>Balls</TableHead>
                            <TableHead>SR</TableHead>
                            <TableHead>Avg</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>{totalMatches}</TableCell>
                            <TableCell>{totalRuns}</TableCell>
                            <TableCell>{totalBallsFaced}</TableCell>
                            <TableCell>{totalBallsFaced > 0 ? (Math.round((totalRuns * 10000) / totalBallsFaced) / 100).toFixed(2) : '0.00'}</TableCell>
                            <TableCell>{battingDismissals > 0 ? (Math.round((totalRuns * 100) / battingDismissals) / 100).toFixed(2) : '—'}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Career bowling summary table */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Bowling Summary</h3>
                    {totalMatches === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No matches played yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matches</TableHead>
                            <TableHead>Overs</TableHead>
                            <TableHead>Runs</TableHead>
                            <TableHead>Wickets</TableHead>
                            <TableHead>Econ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>{totalMatches}</TableCell>
                            <TableCell>{`${Math.floor(totalBallsBowled / 6)}.${totalBallsBowled % 6}`}</TableCell>
                            <TableCell>{totalRunsConceded}</TableCell>
                            <TableCell>{totalWickets}</TableCell>
                            <TableCell>{totalBallsBowled > 0 ? (Math.round((totalRunsConceded * 6 * 100) / totalBallsBowled) / 100).toFixed(2) : '0.00'}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Per-match performance table */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Per-match Performance</h3>
                    {statsLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading stats...</div>
                    ) : totalMatches === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No matches played yet</p>
                        <p className="text-sm">Join a team and participate in matches to see your statistics here.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead>Overs</TableHead>
                            <TableHead>Runs</TableHead>
                            <TableHead>Balls</TableHead>
                            <TableHead>SR</TableHead>
                            <TableHead>Wkts</TableHead>
                            <TableHead>Overs (B)</TableHead>
                            <TableHead>Runs (B)</TableHead>
                            <TableHead>Econ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchRows.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>{new Date(m.date).toLocaleDateString()}</TableCell>
                              <TableCell>{m.name}</TableCell>
                              <TableCell>{m.overs}</TableCell>
                              <TableCell>{m.batRuns}</TableCell>
                              <TableCell>{m.batBalls}</TableCell>
                              <TableCell>{m.batSR.toFixed(2)}</TableCell>
                              <TableCell>{m.bowlWkts}</TableCell>
                              <TableCell>{m.bowlOvers}</TableCell>
                              <TableCell>{m.bowlRuns}</TableCell>
                              <TableCell>{m.bowlEcon.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile; 