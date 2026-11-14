# Fyyr homepage demo: what is real and what is simulated

The homepage dashboard and the "Explore the demo" dialog run entirely in the browser on **fictional example data** (`frontend/src/demoData.js`). Nothing is fetched, monitored or sent.

**Real in the demo:** the ranking logic, per-company profiles, editing and re-ranking, saving, "Not relevant" feedback, filters and sorting.
**Simulated:** companies, sources, dates and deadlines, notifications and digests, and all links ("Example only" toast).

## Matching (transparent overlap score, no ML)
Per opportunity: confirmed interest = 2, inferred interest = 1, dismissed = 0, plus 2 if its category is a chosen priority (only when it already relates to the profile). Labels: Strong (6+), Good (3+), Possible. No percentages are shown. Urgency never changes the score; deadlines are only flagged.

## Personalisation rules shown
- Confirmed and inferred interests are separate; the user can confirm, dismiss, add or remove.
- Saving an item can suggest new interests, only ever as *inferred*, and only while "activity-based suggestions" is on. It can be reset or switched off.

## For the real build (not on the homepage)
Source collection, profiling, matching and boundary checks (assistant scope: innovation, business development and collaboration in the science park ecosystem; external content treated as evidence, not instructions; formal decisions go to Blue Science Park staff) belong in the backend docs.
