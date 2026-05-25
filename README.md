# IRL Among Us

A web app for playing Among Us in real life using phones and Supabase realtime.

## Features

Current version:

- Create game
- Join game
- Realtime lobby
- Player list
- Start game button

Planned:

- Role assignment
- Tasks
- Kill requests
- Meetings
- Voting
- Ghost mode
- Win conditions

## Setup

1. Create a Supabase project.
2. Run the SQL schema.
3. Disable RLS on the tables for now.
4. Copy your Supabase URL and anon key into `supabase.js`.
5. Open `index.html`.

## Testing

1. Open the site in two tabs.
2. Create a game in one tab.
3. Join from the second tab.
4. Verify player lists update automatically.

## Tech Stack

- HTML
- CSS
- JavaScript
- Supabase
