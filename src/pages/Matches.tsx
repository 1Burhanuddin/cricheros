import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Calendar, Clock, MapPin, Users, Trophy } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain: {
    name: string;
  };
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
  created_at: string;
}

const Matches = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    team_a_id: '',
    team_b_id: '',
    overs: 20
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          logo_url,
          captain:profiles!teams_captain_id_fkey(name)
        `)
        .order('name');

      if (teamsError) throw teamsError;
      const normalizedTeams = (teamsData || []).map((t: any) => ({
        ...t,
        captain: Array.isArray(t.captain) ? t.captain[0] : t.captain
      }));
      setTeams(normalizedTeams as Team[]);

      // Fetch matches with team details
      const { data: matchesData, error: matchesError } = await supabase
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
        .order('date', { ascending: false });

      if (matchesError) throw matchesError;
      setMatches(matchesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load matches",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async () => {
    if (!user || !formData.name.trim() || !formData.team_a_id || !formData.team_b_id) return;

    setCreating(true);
    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create match
      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          name: formData.name.trim(),
          date: formData.date,
          time: formData.time,
          location: formData.location.trim() || null,
          team_a_id: formData.team_a_id,
          team_b_id: formData.team_b_id,
          overs: formData.overs,
          created_by: profile.id
        })
        .select()
        .single();

      if (error) throw error;

      setShowCreateDialog(false);
      setFormData({
        name: '',
        date: '',
        time: '',
        location: '',
        team_a_id: '',
        team_b_id: '',
        overs: 20
      });

      await fetchData();
      toast({
        title: "Success",
        description: "Match created successfully!"
      });
    } catch (error) {
      console.error('Error creating match:', error);
      toast({
        title: "Error",
        description: "Failed to create match",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
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
        <PageHeader
          title="Matches"
          subtitle="Schedule and manage cricket matches"
        />
        
        <div className="flex justify-end mb-8">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Match
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Match</DialogTitle>
                <DialogDescription>
                  Schedule a new cricket match between two teams.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="match-name">Match Name</Label>
                  <Input
                    id="match-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Team A vs Team B"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="match-date">Date</Label>
                    <Input
                      id="match-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="match-time">Time</Label>
                    <Input
                      id="match-time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="match-location">Location (Optional)</Label>
                  <Input
                    id="match-location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Central Cricket Ground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="team-a">Team A</Label>
                    <Select
                      value={formData.team_a_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, team_a_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team A" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-b">Team B</Label>
                    <Select
                      value={formData.team_b_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, team_b_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team B" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="match-overs">Number of Overs</Label>
                  <Input
                    id="match-overs"
                    type="number"
                    min="1"
                    max="999"
                    value={formData.overs}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setFormData(prev => ({ ...prev, overs: Math.min(Math.max(value, 1), 999) }));
                    }}
                    placeholder="e.g., 20"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the number of overs for each innings (1-999)
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleCreateMatch} 
                    disabled={creating || !formData.name.trim() || !formData.team_a_id || !formData.team_b_id || !formData.date || !formData.time || formData.overs < 1}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Match'
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Matches Yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to create a match or wait for others to schedule matches.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Match
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <Card key={match.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{match.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(match.date)} at {formatTime(match.time)}
                      </CardDescription>
                    </div>
                    {getStatusBadge(match.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {match.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                      <MapPin className="h-3 w-3" />
                      {match.location}
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={match.team_a.logo_url || ''} />
                          <AvatarFallback className="text-xs">
                            {match.team_a.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{match.team_a.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">vs</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{match.team_b.name}</span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={match.team_b.logo_url || ''} />
                          <AvatarFallback className="text-xs">
                            {match.team_b.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{match.overs} overs</span>
                      {match.toss_winner && (
                        <span className="text-xs">
                          Toss: {match.toss_winner.name} ({match.toss_decision})
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Link to={`/matches/${match.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Users className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches; 