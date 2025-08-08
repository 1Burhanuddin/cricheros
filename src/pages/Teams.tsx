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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Users, Crown, UserPlus } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain_id: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  captain: {
    name: string;
    image_url: string | null;
  };
  player_count: number;
  is_member: boolean;
  is_captain: boolean;
}

const Teams = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    addMyself: true
  });

  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [user]);

  const fetchTeams = async () => {
    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      // Fetch teams with captain info and player count
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select(`
          *,
          captain:profiles!teams_captain_id_fkey(name, image_url),
          team_players(count)
        `);

      if (error) throw error;

      // Check if user is a member of each team
      const teamsWithMembership = await Promise.all(
        teamsData.map(async (team) => {
          const { data: membership } = await supabase
            .from('team_players')
            .select('role')
            .eq('team_id', team.id)
            .eq('player_id', profile.id)
            .single();

          return {
            ...team,
            player_count: team.team_players?.[0]?.count || 0,
            is_member: !!membership,
            is_captain: membership?.role === 'captain'
          };
        })
      );

      setTeams(teamsWithMembership);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!user || !formData.name.trim()) return;

    setCreating(true);
    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          logo_url: formData.logo_url.trim() || null,
          captain_id: profile.id
        })
        .select()
        .single();

      if (teamError) {
        console.error('Team creation error:', teamError);
        throw teamError;
      }

      // Add captain as team player if checkbox is checked
      if (formData.addMyself) {
        const { error: playerError } = await supabase
          .from('team_players')
          .insert({
            team_id: team.id,
            player_id: profile.id,
            role: 'captain'
          });

        if (playerError) {
          console.error('Player addition error:', playerError);
          console.warn('Team created but failed to add captain as player:', playerError);
        }
      }

      setShowCreateDialog(false);
      setFormData({ name: '', description: '', logo_url: '', addMyself: true });
      
      // Refresh teams list
      await fetchTeams();

      toast({
        title: "Success",
        description: "Team created successfully! You can now add players to your team."
      });
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!user) return;

    setJoining(teamId);
    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Add player to team
      const { error } = await supabase
        .from('team_players')
        .insert({
          team_id: teamId,
          player_id: profile.id,
          role: 'player'
        });

      if (error) throw error;

      await fetchTeams();
      toast({
        title: "Success",
        description: "Joined team successfully!"
      });
    } catch (error) {
      console.error('Error joining team:', error);
      toast({
        title: "Error",
        description: "Failed to join team",
        variant: "destructive"
      });
    } finally {
      setJoining(null);
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
        <PageHeader
          title="Teams"
          subtitle="Create, join, and manage cricket teams"
        />
        
        <div className="flex justify-end mb-8">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>
                  Create a new cricket team and become its captain.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter team name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-description">Description (Optional)</Label>
                  <Textarea
                    id="team-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your team"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-logo">Logo URL (Optional)</Label>
                  <Input
                    id="team-logo"
                    value={formData.logo_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="add-myself"
                    checked={formData.addMyself}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, addMyself: checked as boolean }))
                    }
                  />
                  <Label htmlFor="add-myself" className="text-sm font-normal">
                    Add myself to the team as captain
                  </Label>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateTeam} disabled={creating || !formData.name.trim()}>
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Team'
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

        {teams.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to create a team or wait for others to create teams you can join.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.id} className="relative">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={team.logo_url || ''} />
                      <AvatarFallback className="text-lg">
                        {team.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{team.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        {team.captain.name}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {team.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {team.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {team.player_count} players
                    </div>
                    
                    <div className="flex gap-2">
                      <Link to={`/teams/${team.id}`}>
                        <Button variant="outline" size="sm">
                          <Users className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                      {!team.is_member && (
                        <Button
                          size="sm"
                          onClick={() => handleJoinTeam(team.id)}
                          disabled={joining === team.id}
                        >
                          {joining === team.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4 mr-1" />
                          )}
                          Add
                        </Button>
                      )}
                    </div>
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

export default Teams; 