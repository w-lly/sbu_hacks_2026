# Roadmap

- [x] Fit left panel to its tools and add an ordered 30-color line bank
- [x] Match upgrade names/icons to game tools
- [x] Make gift quantities free to use, with non-refundable undo warnings and tests
- [x] Verify gifts and panel presentation live

- [x] Ensure permanent panels have no collapse buttons or visible right scrollbar
- [x] Make unused-line rings and selected-line add/subtract controls clearly visible
- [x] Verify purchases and refund warnings live, endpoint rules in tests, and simple weekly/tutorial wording

- [x] Unused/selected line signals, train and carriage counts and add/subtract controls
- [x] Train purchases and confirmed 50% cash refunds on transactional undo
- [x] Connections at both line ends without branches
- [x] Permanent sidebars and simpler tutorial/weekly wording
- [x] Regression tests and live interaction verification

- [x] In-depth arrow-guided tutorial explaining every game control
- [x] Compact translucent upper-right orders, toggled from the left
- [x] Verify tutorial flow and orders presentation

- [x] Explicit terrain crossings and shortest dry-ground rail routes
- [x] Left-side orders drawer, placement validity colors and visible facility costs
- [x] Transfer station with three input and three output ports
- [x] Repeated undo and refundable tunnel/boat removal
- [x] Weekly extra train lines, regression tests and live verification

- [x] Automatic shortest drag connections for rails, boats and pneumatic links
- [x] Reliable stocked orders, unique building names and numbered map highlights
- [x] Double base speed, Escape, action undo and endpoint track deletion
- [x] Permanent inventory and combined top controls
- [x] Larger obstacles and clearer targeted tutorial
- [x] Regression tests and live gameplay verification

- [x] Curved Apple Maps-inspired world, colored resources and expanded spacing
- [x] Pan/zoom navigation and forgiving port snapping
- [x] Weekly bridge, tunnel and boat unlocks with terrain-gated freight
- [x] Test terrain/crossing rules and verify collection, routing and navigation

- [x] Restore visible tutorial and persistent company/export orders, time and inventory
- [x] Replace hex terrain with blue/green/gray color grids
- [x] Generate replaceable same-size building PNGs and verify gameplay

- [x] Replace square resource overlays with integrated terrain/resource hexes
- [x] Fill screen with map behind controls; verify drawing and production

- [x] Seeded Catan-style worlds with 5×5 resource patches and spacious factory placement
- [x] Larger icon buildings, compact colored ports, hover names and rotation
- [x] Branch routes from connected buildings and verify freight delivery
- [x] Lock later levels until previous completion; verify world and progression rules

- [x] Clear colored input/output arrows and selectable ports
- [x] Cell-by-cell track drawing with collision-safe routing and separated factory spawns
- [x] Readable event text spacing
- [x] Verify track drawing, collisions and production in tests and live UI

- [x] Replace active map loading with lightweight bundled New York geography
- [x] Fullscreen minimalist map with compact controls and larger factories
- [x] Grid-snapped drag routes, limited visible input/output ports, distinct parallel connections
- [x] Guided first-game tutorial with paused action steps
- [x] Test connection limits and routing, verify guided production and desktop/mobile layouts

- [x] Replace passenger gameplay with seeded deposits, draggable collection hubs, freight routing and pre-spawned production companies
- [x] Add continuous company demand, timed contracts and factory-focused weekly upgrades/reports
- [x] Update map presentation, charter copy and game guide for the factory direction
- [x] Test factory rules and verify collection-to-production through the live UI

- [x] Real OSM water/woods/wetland/park data + elevation for 3 maps
- [x] Terrain-aware track costs, bridges vs tunnels
- [x] Weekly resource picks, locomotives, carriages, interchanges, pneumatic tubes, loops
- [x] RNG depots: coal, crew barracks, repair yards, iron foundries
- [x] Timed scenario events, time-of-day demand waves
- [x] Harsher grading (service, coverage, resilience, efficiency, survival)
- [x] AI scenario drafting + Chief Engineer (weekly + final) with fallbacks
- [x] Blueprint Report with greedy baseline comparison
- [x] Steam puffs, sound effects, concept primer
- [x] Backend/frontend split documented in AGENTS.md

## 2026-10-25 polish
- [x] Tutorial highlights items only (no circles/arrows); basic supply-chain flow first (collector → place → route → drag → delivery)
- [x] Mountains render twice as tall
- [x] Optional GEMINI_API_KEY for the Chief Engineer report, with automatic fallback to Lovable AI (.env.example added)
