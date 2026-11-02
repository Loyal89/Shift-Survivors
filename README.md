# Shift Survivors

A survivors-style arcade game set on 2 South: work a 12-hour shift, keep Unit Safety up, level up, and build a team of RNs, CNAs and a resource nurse. English and Spanish.

**Play:** https://loyal89.github.io/Shift-Survivors/
**Booth screen (live high scores + QR):** https://loyal89.github.io/Shift-Survivors/#board

- Move with WASD or the arrow keys. On a phone or tablet, drag anywhere.
- Stand by a patient's door to care for them. Finish tasks before their timers run out.
- Each level, pick a power. Career XP unlocks scrub colors and new nurses.
- Grab kudos cards, coffee, thank-you baskets and clipboards on the floor. Spend kudos on **Perks** between shifts: start with extra nurses, level up faster, and more.
- Collect 12 badge reels and wear one on your name tag.

Progress saves in each player's own browser. No patient data is used or collected.

## Leaderboard

After a shift, players can send their name and score. Scores go to the **Scores** tab of the "Shift Survivors Leaderboard" Google Sheet with **Show** unticked, so nothing appears until it is approved.

- Tick **Show** to put a score on the leaderboard; untick it to take it down.
- Edit the name cell to fix a name, or delete the row to remove it.
- Changes appear within about 15 seconds.

The script behind it is in `apps-script/Code.gs`. If you change it, redeploy with **Deploy → Manage deployments → Edit → New version** so the web app URL stays the same.

Fonts: Press Start 2P (CodeMan38) and VT323 (Peter Hull), both under the SIL Open Font License 1.1.
