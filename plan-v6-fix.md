# V6 Bug Fix Plan

## Bug 1: Study lock persists after study complete
- Root: Dashboard reads `marketStudyComplete` from store but state may not be reactive
- Fix: Force re-render check, ensure `lastStudyRefresh` is in persist
- Add: Strategy scanning indicator ("Scanning: BOS + CHoCH + Trend")

## Bug 2: Chart not live-updating
- Root: Chart init effect only runs once, series isn't cleared on coin/interval change
- Fix: Cleanup chart on unmount, re-init on coin/interval change
- Add: Live update interval for chart candles

## Bug 3: Study S/R display wrong
- Root: `Math.round()` kills decimals for low-priced coins (DOGE→$0)
- Fix: Smart decimal formatting based on price magnitude
- Fix: Clearer labels ("Support $0.098" instead of "S: $0")
- Add: Current price to each study card for context
