# Weather-Aware Truck Routing: 10 minute walkthrough

Target 10:00 at about 140 words a minute. White lines = say. Cyan "Show" lines = what is on screen. Times are checkpoints, not hard cuts.

## Before you hit record

- [ ] Open the hosted app in a clean window, Render already awake (open /api/health first)
- [ ] Close the welcome modal once so the page is clean, then reload and keep it ready to show
- [ ] Run Cheyenne to Casper once so the weather cache is warm. Keep Chicago to Denver for the live demo
- [ ] Editor open on: risk.py, test_risk.py, recommend.py, decision.py, advisor.py, analyze.py, MapView.tsx, vite.config.ts
- [ ] DevTools Network tab ready, filtered to Fetch/XHR
- [ ] Notifications off, browser zoom 100 percent, mic check

## 0:00 Opening and the problem (0:45)

**Show:** the landing page with the welcome modal open

> Hi, I'm Mayank, and this is my submission for the Spotter full stack assessment: a weather-aware truck routing app, built with React and Django.
>
> The problem is simple to state. A driver does not only need the fastest route. They need the safest one, and that depends on the weather at the moment the truck actually gets there, and on how heavy the load is.
>
> So the app takes an origin, a destination, a departure time and a load weight. It gets three routes, forecasts the weather at checkpoints along each one at that checkpoint's own arrival time, scores the risk with the assessment's rules, and recommends one.

## 0:45 First impression and onboarding (0:45)

**Show:** the welcome modal, then click "Read the full guide", scroll briefly, close it

> One practical detail first. The backend runs on a free Render plan, which sleeps when idle. So the first thing a visitor sees is this welcome window. It pings the server, shows whether it is awake, and gives a link to wake it. It also has a short tour.
>
> There is a full guide behind this button, covering every feature, the risk table, the heatmap and the trace. I will not read it out, but it is there for reviewers.

## 1:30 Live demo (1:30)

**Show:** close the modal. Pick Chicago and Denver from the suggestions, or click "Try an example". Set load to 45,000. Press Find safest route.

> Let me run a real trip. Chicago to Denver, about a thousand miles, departing soon, with a 45,000 pound load and a checkpoint every 25 miles.
>
> The page stays responsive while this runs, and the results arrive in a few seconds on a cold cache.

**Show:** the route cards, the Recommended badge, the map with three colored routes and checkpoints

> Here are three routes. Each card shows distance, drive time, arrival, and a bar of miles by risk level. The recommended one has a badge and a one line reason.
>
> Weather is clear on this trip, so everything is green. That is correct behavior, but it makes a poor demo. Let me show a harsh one.

**Show:** open Quick presets, click "Cheyenne to Casper"

> These presets are built from the live forecast. The server scans the next two weeks along each corridor and picks the departure with the worst weather, so a preset is never stale. Cheyenne to Casper in Wyoming has strong wind in the forecast.

**Show:** result with yellow and red; click a checkpoint dot to show the popup

> Now we see risk. Each checkpoint shows its ETA, its wind, rain and snow, and what drove the level. This one is marked by wind combined with the heavy load.

## 3:00 Risk and load rules (1:30)

**Show:** editor, risk.py

> The correctness of this part is the heart of the assessment, so let me show the code.
>
> All thresholds live in one file, risk.py. Wind, rain and snow each map to Low, Moderate, High, Severe or No Travel. A checkpoint takes the worst of the three.
>
> The load rules sit on top, and they can only raise a level, never lower it. Wind at 55 mph or more is No Travel for any load. Wind from 45 to 54 with a load over 30,000 pounds is No Travel. Wind from 35 to 44 with a load over 40,000 pounds is at least Severe.

**Show:** test_risk.py

> The assessment table shares its edge values, like 0.25 inches per hour, so I made a choice and documented it: lower bounds are inclusive, and rain and snow only become No Travel strictly above the stated limit. Every boundary on both sides has a test, including the exact load weights, because the rules say strictly over.

**Show:** weather.py, the interpolation

> One more detail that matters. The forecast is hourly, but a truck arrives at 2:40, not on the hour. So weather is interpolated between the two surrounding hours, using the checkpoint's own ETA. ETAs come from Mapbox's per segment durations, not a flat average speed.

## 4:30 The recommendation logic (1:30)

**Show:** recommend.py

> Now the recommendation. The assessment gives an order: fewest Severe miles, then fewest High miles, then lowest average risk, then shortest time.
>
> The data is per checkpoint, so I turn it into miles. Each checkpoint owns the stretch of road from the midpoint before it to the midpoint after it. Those stretches add up to real miles per level.
>
> I made one addition, and I flagged it as a decision. No Travel miles come first, because a No Travel stretch is worse than Severe, and it should not hide behind it.
>
> I also use a small tolerance. Differences under one mile, or 0.05 average risk, count as a tie. Without that, a one tenth of a mile difference could beat a route that is an hour faster. With it, travel time can actually decide when the weather is equal, which is what balancing risk and time means.

**Show:** the app. Open "How the winner was chosen"

> And I wanted the choice to be explainable, so the app shows its working. Each step is one criterion, in order. Routes that lose are struck through. The step that decides is highlighted. Nothing is a black box.

**Show:** the Departure advisor card at the top of the results

> Two things on top of that. The departure advisor checks the next twelve hours and tells you if leaving later gives a materially safer window, with the before and after miles, and a one click re-run. And it checks stability: does this recommendation still hold if you leave one or two hours late? If not, it warns you. That is the question a dispatcher really asks.

## 6:00 Heatmap and map performance (1:15)

**Show:** drag the slider from 0 to 48

> The second big area is the map. This heatmap runs along all three routes, with a zero to forty eight hour slider.
>
> Watch the Network tab while I drag it.

**Show:** DevTools Network, drag the slider, nothing appears

> Nothing. No requests at all. That is by design. The first response already carries the risk for every checkpoint for all forty nine hours. The slider only updates one paint expression on the map, so the GPU does the work and React does not re-render the map.
>
> I measured it on a real GPU: the median frame while dragging is about eighteen milliseconds, the same as an idle page. It tracks the display refresh rate.

**Show:** Trace route button under the table, press play, step next and previous

> The trace button animates a truck along the route, checkpoint by checkpoint, with play, pause, step, scrub and speed controls, and the table row highlights as it goes.

## 7:15 Making it fast (1:00)

**Show:** vite.config.ts, then analyze.py

> Speed was a goal, so here is what I did.
>
> On load, the map library is about a megabyte, so it is split out and fetched in parallel with the page, not after it. The index page also carries resource hints: preconnect to the tile server and the API, and preload for the map style. The app shell is only about eighty kilobytes compressed, so the first screen is interactive quickly, and the map fills in right behind it.
>
> On the server, the slow part is routing. Mapbox returns at most two alternatives, so the third route is a detour search. I start the weather download the moment the first routes arrive, in a background thread, so weather and detour search overlap. Weather is fetched in parallel batches, deduplicated on a grid, cached for thirty minutes, over a pooled connection. And the detour search is staged: two calls first, more only if needed.
>
> The result: a thousand mile trip takes about two to three seconds cold, and a repeat search takes a fraction of a second. That staged detour search alone cut the cold time from over four seconds to about two. The response is about a hundred kilobytes.

## 8:15 Code quality (1:00)

**Show:** the folder tree

> For code quality, I kept the layers strict. The backend has a pure domain package: risk, geometry, ranking, the decision funnel and the advisor. No network, no Django, so they are easy to test. Services wrap Mapbox and Open-Meteo. The API layer only validates and maps errors.
>
> The frontend is organized by feature, with hooks for analysis and trace, and a typed API client. Risk logic exists only on the backend, so the two sides cannot disagree.

**Show:** terminal: pytest, then npm run build

> There are ninety one backend tests and twelve frontend tests, and the build runs strict TypeScript. Ruff and Biome keep the style consistent. Upstream failures return clear errors, secrets stay in environment variables, and input is validated at the boundary.

## 9:15 Trade-offs and close (0:45)

**Show:** README limits section

> To be honest about the limits. Mapbox has no truck profile, so truck restrictions and speeds are not modeled, and ETAs are driving time only, without breaks. Wind is sustained wind, not gusts. The forecast resolution is about ten kilometers. The heatmap follows the routes, not a wide band around them.
>
> The decisions and the reasoning are written down in the docs folder, including the places where the assessment was ambiguous and which interpretation I chose.
>
> Thanks for watching. The GitHub link, the hosted app and this video are in the submission form. I'd be glad to talk through any of it.

## After recording

- [ ] Trim dead air, keep it between 9:30 and 10:00
- [ ] Put the Loom link, hosted link and GitHub link in the Spotter form
- [ ] Add the Loom link to the README
