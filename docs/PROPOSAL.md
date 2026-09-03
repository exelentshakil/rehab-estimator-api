Your hardest line is the one most bids will skip: the pricing database controls the dollar, not the AI.

Built before bidding. Live: https://rehab-estimator-api.vercel.app

The model gets a JSON schema with no cost field. It picks only from a closed vocabulary, 14 components and 44 defect codes, severity 0-4, extent 0-1. It has nowhere to put a price. A deterministic engine does the quantity takeoff from your property record and prices against a versioned cost book. Same observations in, identical dollars out.

4 years leading engineering at Legiit, AI dashboards on a 2M+ user platform.

Running today:
- Photo classification, defect detection, component scores 0-5, condition 0-100
- Confidence at photo, component and estimate level. Low confidence widens the band, not the midpoint
- Missing coverage flagged with its dollar impact
- Repair items with cost_item_id and a plain English quantity basis you can check by hand
- Low/expected/high with regional multiplier and contingency
- /api/costbook publishes the full defect to price mapping, so you can audit every dollar without running the AI

Honest gap: no auth or rate limits yet, and the quantity curves are national averages needing calibration against your invoices.

This system isn't just an API; it is the core intellectual property for a highly scalable prop-tech operation. By completely decoupling the visual reasoning from the financial calculation, we guarantee that this engine will process tens of thousands of properties with institutional-grade financial accuracy. Send your schema or a CSV of items and unit costs, and I will show you this architecture running on your actual data.

Portfolio: shakilhq.com
