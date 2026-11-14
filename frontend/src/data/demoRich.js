// Extra detail rows ([label, text]) for the fictional demo opportunities in ./demoOpportunities.js, keyed by record id.
// They are appended to each record's own `facts` and shown in the detail popup. Everything is invented for the demo: no real
// organisation, person, amount or commitment. Cards stay short (summary); the popup carries this fuller information.
const A = 'Agenda', O = 'Expected outcomes', S = 'Application steps', U = 'Example uses', AC = 'How to get access', K = 'Key takeaways', W = 'Why it matters'
const OFF = 'What they offer', SEEK = 'What they seek', P = 'Potential collaboration'

export const DEMO_RICH = {
  // ---- events & workshops ----
  d1: [[A, 'Six five-minute demos · Open networking hour'], [O, 'Two or three useful introductions and a list of companies to follow']],
  d2: [[A, 'Power budgets · Enclosures and weather · Over-the-air updates · What to log'], [O, 'A short deployment checklist you can reuse']],
  d3: [[A, 'Five eight-minute pitches · Panel questions · Open discussion'], [O, 'A clearer view of what hospitals need before adopting a tool']],
  d18: [[A, 'Asset list · Access control · Backups · Incident contacts · Answering a security questionnaire'], [O, 'A one-page security plan for your company']],
  d19: [[A, 'Shop-floor walk-through · Material flow tracking · Where to start on a small budget'], [O, 'Two or three changes you could try within a month']],
  // ---- funding ----
  d4: [[S, 'Check eligibility · Write a one-page pilot description · Add a simple budget · Submit before the deadline'], ['What is funded', 'Pilots that test a marine technology in a real setting (fictional)']],
  d5: [[S, 'Choose a target market · Describe the export plan · List costs · Submit before the deadline'], ['What is funded', 'Trade fairs, market studies and travel for first exports (fictional)']],
  d6: [[S, 'Describe the prototype · Explain the energy benefit · Add a budget and timeline · Submit'], ['What is funded', 'Building and testing an energy prototype (fictional)']],
  d20: [[S, 'Describe the product · Name the security gap · Pick an approved adviser · Submit'], ['What is funded', 'A security review and fixes for a digital product (fictional)']],
  d21: [[S, 'Describe the line you want to upgrade · Estimate savings · Add quotes · Submit'], ['What is funded', 'Sensors, software and training for a small production line (fictional)']],
  d31: [[S, 'Describe the product · Outline the validation plan · Name a clinical partner · Submit'], ['What is funded', 'Validation studies for a digital health product (fictional)']],
  // ---- testing & pilots ----
  d7: [[U, 'A two-week coastal sensor trial · Testing a small vehicle in real waves'], [AC, 'Send a short test description and safety information; the team replies with available slots']],
  d8: [[U, 'Penetration test of a connected device · Checking a secure update process'], [AC, 'Describe the device and what you want tested; a slot is agreed by email']],
  d9: [[U, 'Trying a vision system on a real line · Measuring cycle time with a new sensor'], [AC, 'Share the process you want to test and the data you can bring']],
  d10: [[U, 'Testing an app against anonymised data · Checking an integration with a records system'], [AC, 'Apply with a short description and a data-handling plan']],
  d22: [[U, 'Testing a recycled material for strength · Comparing two coatings'], [AC, 'Send the material description and the tests you need']],
  // ---- knowledge & trends ----
  d11: [[K, 'Offshore energy is shifting to hybrid sites · Maintenance cost is the main barrier · Small suppliers win on reliability'], [W, 'Helps you see where demand for maritime technology is heading']],
  d12: [[K, 'Start with one narrow problem · Data quality beats model choice · Plan for maintenance from day one'], [W, 'A realistic path for a small manufacturer to a first AI project']],
  d13: [[K, 'Check whether you are in scope · List critical systems · Agree who reports incidents'], [W, 'Gets a small company to a defensible position without a large budget']],
  d23: [[K, 'When software counts as a medical device · What evidence regulators ask for · How to plan documentation'], [W, 'Saves months for health-tech teams that start documentation late']],
  d24: [[K, 'Track material flows first · Sell offcuts back to suppliers · Measure savings monthly'], [W, 'Concrete examples a small manufacturer can copy']],
  // ---- experts ----
  d14: [[OFF, 'Design reviews for marine robotics and short advice sessions'], [P, 'A half-day review of your vehicle sensing setup'], ['Good fit when', 'You are building or buying a marine robot and want an outside opinion']],
  d15: [[OFF, 'Help choosing funding routes and shaping an application'], [P, 'A one-hour call to shortlist routes, then a read-through of your draft'], ['Good fit when', 'You are preparing a first application']],
  d25: [[OFF, 'Security assessments for industrial networks'], [P, 'A short assessment of one production network'], ['Good fit when', 'Customers have started asking for security evidence']],
  d26: [[OFF, 'Material selection and recycling advice for manufacturers'], [P, 'A review of one product for lower-impact materials'], ['Good fit when', 'You want to cut material waste without redesigning everything']],
  d27: [[OFF, 'Evaluation design for digital health products'], [P, 'A plan for a small evaluation with a clinical partner'], ['Good fit when', 'You need evidence for a hospital buyer']],
  d34: [[OFF, 'Machine learning for sensor data: cleaning, labelling and modelling'], [P, 'A two-day sprint on your sensor data'], ['Good fit when', 'You have sensor data but no clear way to use it']],
  // ---- partner companies ----
  d16: [[OFF, 'Low-power sensors and field deployment experience'], [SEEK, 'Software partners for data analysis'], [P, 'A joint pilot combining their sensors with your analytics']],
  d17: [[OFF, 'Analytics for energy and grid data'], [SEEK, 'Sensor suppliers and a pilot site'], [P, 'A shared pilot that feeds sensor data into their analytics']],
  d28: [[OFF, 'Small inspection robots and operating know-how'], [SEEK, 'Harbour partners for trials'], [P, 'A short inspection trial at a harbour']],
  d29: [[OFF, 'Clinical workflow knowledge and a test network'], [SEEK, 'Software teams with a mature prototype'], [P, 'A pilot with clinicians using your prototype']],
  d30: [[OFF, 'Contract manufacturing and circular production methods'], [SEEK, 'Product companies wanting lower-waste production'], [P, 'A trial batch made with recycled inputs']],
  d35: [[OFF, 'Safety engineering for harbour systems'], [SEEK, 'Technology suppliers needing a safety review'], [P, 'A joint safety argument for a harbour pilot']],
}
