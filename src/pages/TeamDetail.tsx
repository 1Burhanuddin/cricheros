import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Loader2, ArrowLeft, Crown, UserPlus, Trash2, Shield, Users, Phone, Mail, Plus } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TeamMember {
  id: string;
  player_id: string;
  role: 'captain' | 'vice_captain' | 'player';
  joined_at: string;
  player: {
    name: string;
    image_url: string | null;
    batting_style: string | null;
    bowling_style: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain_id: string;
  description: string | null;
  created_at: string;
}

interface Player {
  id: string;
  name: string;
  image_url: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  is_temp?: boolean;
}

interface Contact {
  name: string;
  phone?: string;
  email?: string;
}

const TeamDetail = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCaptain, setIsCaptain] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('members');



  // Contact form
  const [contactData, setContactData] = useState<Contact>({
    name: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    if (teamId && user) {
      fetchTeamData();
    }
  }, [teamId, user]);

  const fetchTeamData = async () => {
    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      // Fetch team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) {
        console.error('Team error:', teamError);
        if (teamError.code === 'PGRST116') {
          toast({
            title: "Database Setup Required",
            description: "Please run the database setup script in Supabase dashboard",
            variant: "destructive"
          });
        } else {
          throw teamError;
        }
        return;
      }
      
      setTeam(teamData);

      // Check if user is captain
      setIsCaptain(teamData.captain_id === profile.id);

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_players')
        .select(`
          *,
          player:profiles(name, image_url, batting_style, bowling_style)
        `)
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

      if (membersError) {
        console.error('Members error:', membersError);
        if (membersError.code === 'PGRST116') {
          // Table doesn't exist, set empty members
          setMembers([]);
        } else {
          throw membersError;
        }
      } else {
        setMembers(membersData || []);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const searchPlayers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, image_url, batting_style, bowling_style')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (error) throw error;

      // Filter out players already in the team
      const existingPlayerIds = members.map(m => m.player_id);
      const filteredResults = data
        .filter(player => !existingPlayerIds.includes(player.id))
        .map(player => ({
          ...player,
          is_temp: false
        }));
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching players:', error);
    } finally {
      setSearching(false);
    }
  };



  const addContactPlayer = () => {
    if (!contactData.name.trim()) return;

    const contactPlayer: Player = {
      id: `contact_${Date.now()}`,
      name: contactData.name.trim(),
      batting_style: null,
      bowling_style: null,
      image_url: null,
      is_temp: true
    };

    // Add to search results
    setSearchResults(prev => [contactPlayer, ...prev]);
    setContactData({ name: '', phone: '', email: '' });
  };

  const shareTeamLink = () => {
    const teamUrl = `${window.location.origin}/teams/${teamId}`;
    const message = `Join my cricket team "${team?.name}" on CricHeroes! ${teamUrl}`;
    
    // Check if it's a mobile device
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      // Mobile - open WhatsApp with pre-filled message
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } else {
      // Desktop - copy to clipboard
      navigator.clipboard.writeText(message).then(() => {
        toast({
          title: "Link Copied",
          description: "Team link copied to clipboard! You can now share it on WhatsApp."
        });
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = message;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast({
          title: "Link Copied",
          description: "Team link copied to clipboard! You can now share it on WhatsApp."
        });
      });
    }
  };

  const addFromContacts = () => {
    // Check if the Web Contacts API is available
    if ('contacts' in navigator && 'ContactsManager' in window) {
      // Modern browsers with Contacts API
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: true };
      
      (navigator as any).contacts.select(props, opts)
        .then((contacts: any[]) => {
          if (contacts.length > 0) {
            const contact = contacts[0];
            const contactPlayer: Player = {
              id: `contact_${Date.now()}`,
              name: contact.name?.[0] || 'Unknown Contact',
              batting_style: null,
              bowling_style: null,
              image_url: null,
              is_temp: true
            };
            
            setSearchResults(prev => [contactPlayer, ...prev]);
            toast({
              title: "Contact Added",
              description: `${contactPlayer.name} added from contacts!`
            });
          }
        })
        .catch((error: any) => {
          console.error('Error accessing contacts:', error);
          toast({
            title: "Contact Access Failed",
            description: "Could not access contacts. Please add manually.",
            variant: "destructive"
          });
        });
    } else {
      // Fallback for browsers without Contacts API
      toast({
        title: "Contact Access Not Available",
        description: "Your browser doesn't support contact access. Please add manually.",
        variant: "destructive"
      });
      // Show manual contact form
      setActiveTab('contact');
    }
  };

  const addPlayerToTeam = async (playerId: string) => {
    if (!teamId) return;

    setAddingPlayer(playerId);
    try {
      // Check if it's a temporary player
      const player = searchResults.find(p => p.id === playerId);
      
      if (player?.is_temp) {
        // For temporary players, we'll just add them to the local state
        const tempMember: TeamMember = {
          id: `temp_member_${Date.now()}`,
          player_id: playerId,
          role: 'player',
          joined_at: new Date().toISOString(),
          player: {
            name: player.name,
            image_url: null,
            batting_style: player.batting_style,
            bowling_style: player.bowling_style
          }
        };
        
        setMembers(prev => [...prev, tempMember]);
        setShowAddDialog(false);
        setSearchQuery('');
        setSearchResults([]);
        
        toast({
          title: "Success",
          description: "Temporary player added to team! (Not saved to database)"
        });
      } else {
        // For real players, add to database
        const { error } = await supabase
          .from('team_players')
          .insert({
            team_id: teamId,
            player_id: playerId,
            role: 'player'
          });

        if (error) throw error;

        await fetchTeamData();
        setShowAddDialog(false);
        setSearchQuery('');
        setSearchResults([]);

        toast({
          title: "Success",
          description: "Player added to team successfully!"
        });
      }
    } catch (error) {
      console.error('Error adding player:', error);
      toast({
        title: "Error",
        description: "Failed to add player to team",
        variant: "destructive"
      });
    } finally {
      setAddingPlayer(null);
    }
  };

  const updatePlayerRole = async (memberId: string, newRole: string) => {
    setUpdatingRole(memberId);
    try {
      // If making someone captain, first demote current captain
      if (newRole === 'captain') {
        // Find current captain
        const currentCaptain = members.find(m => m.role === 'captain');
        if (currentCaptain) {
          // Demote current captain to player
          const { error: demoteError } = await supabase
            .from('team_players')
            .update({ role: 'player' })
            .eq('id', currentCaptain.id);

          if (demoteError) throw demoteError;
        }

        // Update team captain_id
        const { error: teamError } = await supabase
          .from('teams')
          .update({ captain_id: members.find(m => m.id === memberId)?.player_id })
          .eq('id', teamId);

        if (teamError) throw teamError;
      }

      // Update the player's role
      const { error } = await supabase
        .from('team_players')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      await fetchTeamData();
      toast({
        title: "Success",
        description: newRole === 'captain' 
          ? "New captain appointed successfully!" 
          : "Player role updated successfully!"
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update player role",
        variant: "destructive"
      });
    } finally {
      setUpdatingRole(null);
    }
  };

  const removePlayerFromTeam = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_players')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await fetchTeamData();
      toast({
        title: "Success",
        description: "Player removed from team successfully!"
      });
    } catch (error) {
      console.error('Error removing player:', error);
      toast({
        title: "Error",
        description: "Failed to remove player from team",
        variant: "destructive"
      });
    }
  };

  const deleteTeam = async () => {
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team deleted successfully!"
      });
      
      navigate('/teams');
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive"
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'captain':
        return <Badge variant="default" className="bg-yellow-600"><Crown className="h-3 w-3 mr-1" />Captain</Badge>;
      case 'vice_captain':
        return <Badge variant="secondary"><Shield className="h-3 w-3 mr-1" />Vice Captain</Badge>;
      default:
        return <Badge variant="outline">Player</Badge>;
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

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Team Not Found</h3>
              <Button onClick={() => navigate('/teams')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Teams
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <PageHeader
          title={team.name}
          subtitle="Team Details & Management"
          showBack
          backUrl="/teams"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Team Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Team Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={team.logo_url || ''} />
                    <AvatarFallback className="text-xl">
                      {team.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {members.length} member{members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {team.description && (
                  <p className="text-sm text-muted-foreground">{team.description}</p>
                )}
                <div className="pt-4 space-y-3">
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Player
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl w-[95vw] sm:w-auto">
                      <DialogHeader>
                        <DialogTitle>Add Player to Team</DialogTitle>
                        <DialogDescription>
                          Choose how you want to add a player to your team.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <Button 
                          onClick={() => setActiveTab('search')}
                          variant={activeTab === 'search' ? 'default' : 'outline'}
                          className="w-full justify-start"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Search Players
                        </Button>
                        <Button 
                          onClick={() => shareTeamLink()}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Share Link on WhatsApp
                        </Button>
                        <Button 
                          onClick={() => addFromContacts()}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Add from Contact
                        </Button>
                      </div>
                        
                        {activeTab === 'search' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="search">Search Existing Players</Label>
                              <Input
                                id="search"
                                value={searchQuery}
                                onChange={(e) => {
                                  setSearchQuery(e.target.value);
                                  searchPlayers(e.target.value);
                                }}
                                placeholder="Search by player name..."
                              />
                            </div>
                            
                            {searching && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            )}
                            
                            {searchResults.length > 0 && (
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {searchResults.map((player) => (
                                  <div
                                    key={player.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 sm:gap-0"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={player.image_url || ''} />
                                        <AvatarFallback>
                                          {player.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium">{player.name}</p>
                                          {player.is_temp && (
                                            <Badge variant="secondary" className="text-xs">Temp</Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          {player.batting_style || 'N/A'} • {player.bowling_style || 'N/A'}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => addPlayerToTeam(player.id)}
                                      disabled={addingPlayer === player.id}
                                      className="sm:self-end"
                                    >
                                      {addingPlayer === player.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        'Add'
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {activeTab === 'contact' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="contact-name">Contact Name</Label>
                              <Input
                                id="contact-name"
                                value={contactData.name}
                                onChange={(e) => setContactData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter contact name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="contact-phone">Phone Number (Optional)</Label>
                              <Input
                                id="contact-phone"
                                value={contactData.phone}
                                onChange={(e) => setContactData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="Enter phone number"
                                type="tel"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="contact-email">Email (Optional)</Label>
                              <Input
                                id="contact-email"
                                value={contactData.email}
                                onChange={(e) => setContactData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="Enter email address"
                                type="email"
                              />
                            </div>
                            <Button 
                              onClick={addContactPlayer} 
                              disabled={!contactData.name.trim()}
                              className="w-full"
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Add from Contact
                            </Button>
                          </div>
                        )}
                                          </DialogContent>
                    </Dialog>
                    
                    {isCaptain && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Team
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Team</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{team.name}"? This action cannot be undone and will remove all team members and data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={deleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete Team
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Members */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage team members and their roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Team Members</h3>
                      <p className="text-muted-foreground mb-4">
                        Start by adding players to your team using the "Add Player" button.
                      </p>
                    </div>
                  ) : (
                    members.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-3 sm:gap-0"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.player.image_url || ''} />
                          <AvatarFallback>
                            {member.player.name?.charAt(0)?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.player.name || 'Unknown Player'}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.player.batting_style || 'N/A'} • {member.player.bowling_style || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:flex-shrink-0">
                        {member.role !== 'captain' ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={member.role}
                              onValueChange={(value) => updatePlayerRole(member.id, value)}
                              disabled={updatingRole === member.id}
                            >
                              <SelectTrigger className="w-28 sm:w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="player">Player</SelectItem>
                                <SelectItem value="vice_captain">Vice Captain</SelectItem>
                                <SelectItem value="captain">Make Captain</SelectItem>
                              </SelectContent>
                            </Select>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Player</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove <strong>{member.player.name}</strong> from the team? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => removePlayerFromTeam(member.id)} 
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove Player
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : (
                          getRoleBadge(member.role)
                        )}
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamDetail; 