import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import Navigation from '@/components/Navigation';
import { User, Users, Calendar, Trophy, BarChart3, Award } from 'lucide-react';

const Index: React.FC = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Welcome to CricHeroes!</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Your ultimate cricket management platform. Create teams, organize matches, 
            track scores, and manage tournaments - all in one place.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            <Link to="/profile" className="p-6 border rounded-lg hover:border-primary transition-colors">
              <div className="flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Player Profiles</h3>
              <p className="text-muted-foreground">
                Create and manage your cricket profile with stats and achievements.
              </p>
            </Link>
            
            <Link to="/teams" className="p-6 border rounded-lg hover:border-primary transition-colors">
              <div className="flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Teams</h3>
              <p className="text-muted-foreground">
                Create teams, invite players, and manage your squad.
              </p>
            </Link>
            
            <Link to="/matches" className="p-6 border rounded-lg hover:border-primary transition-colors">
              <div className="flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Matches</h3>
              <p className="text-muted-foreground">
                Schedule matches and track live scores with detailed scorecards.
              </p>
            </Link>
            
            <div className="p-6 border rounded-lg opacity-50">
              <div className="flex items-center justify-center mb-4">
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Tournaments</h3>
              <p className="text-muted-foreground">
                Organize multi-team tournaments with league and knockout formats.
              </p>
              <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
            </div>
            
            <div className="p-6 border rounded-lg opacity-50">
              <div className="flex items-center justify-center mb-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Analytics</h3>
              <p className="text-muted-foreground">
                Track performance with detailed statistics and insights.
              </p>
              <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
            </div>
            
            <div className="p-6 border rounded-lg opacity-50">
              <div className="flex items-center justify-center mb-4">
                <Award className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Leaderboards</h3>
              <p className="text-muted-foreground">
                Compete with friends and climb the rankings.
              </p>
              <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
