# 🏏 CricHeroes-like Cricket PWA (React + Tailwind + Supabase)

## 🧱 Tech Stack
- **Frontend:** React (with Vite)
- **Styling:** TailwindCSS
- **Backend/DB:** Supabase (PostgreSQL, Auth, Storage)
- **PWA:** Vite Plugin PWA

---

## 📦 Core Modules

### 1. **Auth System**
- Supabase Auth (email/password or OTP)
- Role: `Player`, `Captain`, `Admin`

### 2. **Player Profile**
- Full Name
- Profile Image (can be hosted on GitHub/Imgur)
- Batting/Bowling Style
- Stats: Matches, Runs, Wickets, etc.
- Teams Joined

### 3. **Teams Module**
- Create/Join Team
- Team Logo, Name, Captain
- Players List with Roles
- Team Stats
- Team Selection for Matches and Tournaments

### 4. **Matches Module**
#### (Single Match)
- Any user can create a match
- Match Name
- Date, Time
- Location
- Select **2 Teams** to play
- Toss Winner, Decision
- Overs Format (T10/T20/ODI)
- Live Scoring Support (see below)

### 5. **Scoring System**
- Select Playing 11
- Over-wise scoring
- Ball-by-ball input: Runs, Wicket, Extras
- Batting Scorecard
- Bowling Scorecard
- Final Result Generation

### 6. **Tournaments Module**
- Any user can create a tournament
- Tournament Name, Start Date
- Format: League / Knockout
- Select **Multiple Teams** to participate
- Match Scheduling
- Points Table Generation
- Knockouts Handling

### 7. **Leaderboard & Stats**
- Top Batsmen, Bowlers
- Player of the Match
- MVP Rankings
- Team Rankings

### 8. **Match History & Insights**
- Player-wise match logs
- Team-wise performance
- Export scorecard to PDF (optional)

### 9. **Notifications (Optional)**
- Match Reminders
- Result Updates
- Team Invites

---

## 🗃️ Supabase Tables (Schema Draft)

### `players`
| id | name | image | batting_style | bowling_style | user_id |

### `teams`
| id | name | logo | captain_id |

### `team_players`
| id | team_id | player_id | role |

### `matches`
| id | name | date | team_a | team_b | overs | location | status |

### `match_scores`
| id | match_id | inning | ball_no | batsman | bowler | run | extra | wicket |

### `tournaments`
| id | name | start_date | format | created_by |

### `tournament_teams`
| id | tournament_id | team_id |

### `tournament_matches`
| id | tournament_id | match_id |

### `leaderboard`
| id | player_id | runs | wickets | sixes | fours |

---

## 🚀 Step-by-Step Plan (Best Starting Point)

### ✅ Phase 1: Setup & Auth
1. Set up project with Vite + React + TailwindCSS
2. Install and configure Supabase
3. Enable Supabase Auth and build:
   - Login / Signup pages
   - Auth context for global access

### ✅ Phase 2: Player Module
4. Create Player Profile UI
5. Store and fetch player data from Supabase
6. Allow editing profile and uploading image (via GitHub/Imgur or Supabase Storage later)

### ✅ Phase 3: Team Module
7. Create "Create Team" and "Join Team" features
8. Store team data and allow captains to manage players
9. Link players to teams using `team_players` table
10. Team can be selected in Matches and Tournaments

### ✅ Phase 4: Match Scheduling
11. Any user can create a match
12. Select **2 Teams** from existing teams
13. Save match data with teams, date, overs, location, toss, etc.
14. List upcoming & past matches by player/team

### ✅ Phase 5: Match Scoring
15. Select playing 11 for each team
16. Add ball-by-ball scoring UI
17. Calculate scorecard live (runs, wickets, extras)
18. Store match results and auto-generate scorecards

### ✅ Phase 6: Tournaments
19. Any user can create a tournament
20. Select **Multiple Teams** to participate
21. Add tournament matches
22. Auto-generate points table and handle knockouts

### ✅ Phase 7: Leaderboards & Stats
23. Calculate stats per player and team
24. Display top performers and MVPs

### ✅ Phase 8: Optional Features
25. Notifications for match invites & results
26. Team/match chat (can use Supabase Realtime or 3rd-party)
27. PWA features: installability, offline, caching
28. Export to PDF (scorecard, tournament stats)

---

## 🧠 Features to Add Later
- Chat for team/match
- Live streaming (YT Embed)
- Admin panel for tournament
- Referral system
- Dark mode toggle

---

## 🌐 Hosting & Deployment
- Use [Supabase Hosting](https://supabase.com/), [Netlify](https://netlify.com), or [Vercel](https://vercel.com/)
- Register as PWA using `vite-plugin-pwa`
- Add manifest & icons
- Enable offline support (optional)

---

Let me know if you want code templates for any of these modules.
