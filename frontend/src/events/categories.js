// ---- Opportunity categories: one shared editor, category-specific fields ----
// Pure data (no imports) so the store, the editor and the member pages can all use it.
// A field is { k, label, type: 'text'|'textarea'|'select'|'date'|'radio', opts?, opt?, hint?, half?, showIf?(x), max?, def? }.
// Values live in `record.x[k]`. Fields are required unless `opt` is set. A field hidden by `showIf` is never required.
// Linking rules: `link` and `contact` are 'req' (required), 'opt' (optional) or 'either' (at least one of the two).

const sel = (k, label, opts, extra = {}) => ({ k, label, type: 'select', opts, ...extra })
const txt = (k, label, extra = {}) => ({ k, label, type: 'text', max: 140, ...extra })
const area = (k, label, extra = {}) => ({ k, label, type: 'textarea', rows: 3, max: 500, ...extra })
const date = (k, label, extra = {}) => ({ k, label, type: 'date', ...extra })
const pairs = a => a.map(v => [v, v])

export const CATEGORIES = {
  events: {
    id: 'events', mcat: 'events', icon: 'events', label: 'Events & workshops', noun: 'event', nouns: 'events',
    mine: 'My opportunities', add: 'Create event', lead: 'Run an event for your company or for everyone. You choose who can see it.',
    linkLabel: 'Registration link', orgLabel: 'Organiser', orgHint: 'Who runs the event. Shown as “Organised by”, never as a sponsor.', fields: [], link: 'req', contact: 'opt',
  },
  funding: {
    id: 'funding', mcat: 'funding', icon: 'funding', label: 'Funding', noun: 'funding opportunity', nouns: 'funding opportunities',
    mine: 'My opportunities', add: 'Add funding opportunity', lead: 'Share a call you run, or one from another provider that members should know about.',
    linkLabel: 'Official application or source link', linkHint: 'The provider’s own page for this call.', orgLabel: 'Organisation sharing this', orgHint: 'Optional. Shown with the listing; it does not make this organisation the funder.', link: 'req', contact: 'opt', goals: ['Find funding'],
    fields: [
      { k: 'sharedAs', label: 'Who is offering this funding?', type: 'radio', def: 'provider', opts: [['provider', 'We are the funding provider'], ['shared', 'We are sharing a call from another provider']] },
      txt('provider', 'Funding provider', { hint: 'The organisation that awards the funding.' }),
      sel('fundingType', 'Funding type', pairs(['Grant', 'Loan', 'Equity investment', 'Voucher or in-kind support', 'Prize', 'Other']), { def: 'Grant', half: true }),
      sel('amountMode', 'Amount', [['specified', 'Specified'], ['notspecified', 'Not specified']], { def: 'notspecified', half: true }),
      txt('amount', 'Amount or range', { showIf: x => x.amountMode === 'specified', placeholder: 'e.g. 100,000 to 500,000', max: 60, half: true }),
      sel('currency', 'Currency', pairs(['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK']), { def: 'SEK', showIf: x => x.amountMode === 'specified', half: true }),
      area('purpose', 'Purpose', { max: 400 }),
      area('eligibility', 'Eligibility', { hint: 'Who can apply. Members must still check this at the source.' }),
      txt('geography', 'Geographical scope', { placeholder: 'e.g. Sweden, Blekinge region, EU' }),
      sel('deadlineMode', 'Application timing', [['date', 'Fixed deadline'], ['rolling', 'Rolling applications']], { def: 'date', half: true }),
      date('deadline', 'Application deadline', { showIf: x => x.deadlineMode === 'date', half: true }),
    ],
  },
  testing: {
    id: 'testing', mcat: 'testing', icon: 'testing', label: 'Testing & pilots', noun: 'testing opportunity', nouns: 'testing opportunities',
    mine: 'My opportunities', add: 'Add testing opportunity', lead: 'Offer a lab, testbed or pilot site, or tell members how to get access.',
    titleLabel: 'Facility, testbed or pilot name', linkLabel: 'Application or enquiry link', orgLabel: 'Facility owner or provider', orgHint: 'Optional. Shown as the provider.', link: 'either', contact: 'either', goals: ['Test a product'],
    fields: [
      sel('kind', 'Type', pairs(['Testbed', 'Lab', 'Pilot site']), { def: 'Testbed', half: true }),
      sel('locMode', 'Where it is available', [['site', 'On site'], ['remote', 'Remote'], ['both', 'On site and remote']], { def: 'site', half: true }),
      txt('location', 'Location', { showIf: x => x.locMode !== 'remote', placeholder: 'Site and city' }),
      area('capabilities', 'Capabilities', { hint: 'What can be tested or validated here.' }),
      area('applications', 'Suitable applications', { opt: true }),
      area('access', 'Access requirements', { hint: 'For example safety training, an NDA or a project outline.' }),
      sel('availMode', 'Availability', [['ongoing', 'Ongoing access'], ['period', 'Limited period']], { def: 'ongoing', half: true }),
      date('availFrom', 'Available from', { opt: true, showIf: x => x.availMode === 'period', half: true }),
      date('availTo', 'Available until', { showIf: x => x.availMode === 'period', half: true }),
      txt('cost', 'Cost information', { opt: true, placeholder: 'e.g. Free for members, or SEK 2,000 per day', hint: 'Leave empty if not known. Nothing is shown as free unless you say so.' }),
    ],
  },
  knowledge: {
    id: 'knowledge', mcat: 'knowledge', icon: 'knowledge', label: 'Knowledge & trends', noun: 'contribution', nouns: 'contributions',
    mine: 'My opportunities', add: 'Share knowledge', lead: 'Share an article, report, guide or update that other members could use.',
    linkLabel: 'Original source link', linkHint: 'Where the content was originally published.', orgLabel: 'Publishing organisation', orgHint: 'Optional. Shown with the contribution.', link: 'req', contact: 'opt', goals: ['Build skills'],
    fields: [
      sel('contentType', 'Content type', pairs(['Article', 'Report', 'Research', 'Guide', 'Industry update', 'Announcement']), { def: 'Article', half: true }),
      date('pubDate', 'Publication date', { half: true }),
      txt('publisher', 'Publisher or author'),
    ],
  },
  people: {
    id: 'people', mcat: 'people', icon: 'experts', label: 'Experts & partners', noun: 'listing', nouns: 'listings',
    mine: 'My opportunities', add: 'Add listing', lead: 'Offer your expertise, or look for a collaborator on a project.',
    linkLabel: 'Website', orgLabel: 'Organisation', orgHint: 'Optional. Shown with the listing.', link: 'opt', contact: 'req', contactLabel: 'Professional contact route', goals: ['Find partners'],
    fields: [
      { k: 'listing', label: 'What would you like to do?', type: 'radio', def: 'offer', opts: [['offer', 'Offer expertise'], ['seek', 'Find a collaborator']] },
      txt('who', 'Person or organisation', { showIf: x => x.listing !== 'seek' }),
      area('expertise', 'Expertise areas', { showIf: x => x.listing !== 'seek' }),
      area('services', 'Services or support offered', { showIf: x => x.listing !== 'seek' }),
      txt('location', 'Location', { showIf: x => x.listing !== 'seek', half: true }),
      txt('availability', 'Availability', { showIf: x => x.listing !== 'seek', placeholder: 'e.g. Two days a month', half: true }),
      txt('project', 'Project or challenge', { showIf: x => x.listing === 'seek' }),
      area('sought', 'Expertise being sought', { showIf: x => x.listing === 'seek' }),
      area('canOffer', 'Contribution you can offer', { showIf: x => x.listing === 'seek' }),
      area('outcome', 'Intended outcome', { showIf: x => x.listing === 'seek' }),
      txt('timeframe', 'Timeframe', { showIf: x => x.listing === 'seek', placeholder: 'e.g. Spring 2027' }),
    ],
  },
}
export const CAT_IDS = Object.keys(CATEGORIES)
export const catOf = e => CATEGORIES[e?.category] || CATEGORIES.events
export const defaultsFor = id => Object.fromEntries((CATEGORIES[id]?.fields || []).filter(f => f.def !== undefined).map(f => [f.k, f.def]))
export const visibleFields = (id, x) => (CATEGORIES[id]?.fields || []).filter(f => !f.showIf || f.showIf(x || {}))
// Routes: members get one "My …" page per category; staff share one page with a category switch.
// One unified management view for members. The older per-category paths still open it, so saved links keep working.
export const MY_OPPS = 'my-opportunities'
export const MY_PATH = { events: MY_OPPS, funding: MY_OPPS, testing: MY_OPPS, knowledge: MY_OPPS, people: MY_OPPS }
export const LEGACY_MY = ['my-events', 'my-funding', 'my-testing', 'my-contributions', 'my-listings']
