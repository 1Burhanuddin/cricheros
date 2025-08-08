import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Save } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';

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
        <PageHeader
          title="Player Profile"
          subtitle="Manage your cricket profile information"
        />
        
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
              
              {/* Profile Completion Hint */}
              {(!profile?.name || !profile?.batting_style || !profile?.bowling_style) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-semibold">!</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-blue-900">Complete Your Profile</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Add your full name, batting style, and bowling style to complete your cricket profile. 
                        This helps teams know your playing style when you join them.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Image Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.image_url || ''} />
                  <AvatarFallback className="text-2xl">
                    {profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Profile Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="batting-style">Batting Style</Label>
                    <Select
                      value={formData.batting_style}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, batting_style: value }))}
                      disabled={!isEditing}
                    >
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
                    <Select
                      value={formData.bowling_style}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, bowling_style: value }))}
                      disabled={!isEditing}
                    >
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

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            name: profile?.name || '',
                            batting_style: profile?.batting_style || '',
                            bowling_style: profile?.bowling_style || '',
                            image_url: profile?.image_url || ''
                          });
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile; 