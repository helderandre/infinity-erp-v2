# RECRUTAMENTO_CRM.md
> Specification document for the Recruitment module inside a Real Estate Agency CRM

---

## Overview

This module manages the full recruitment lifecycle inside a real estate agency, with a strong focus on **headhunting** (outbound recruitment is the primary motion, not inbound). The goal is to track every candidate from first contact to contract signature — and beyond, measuring their financial evolution after joining.

The system must support:
- Multi-touch pipelines (typically 2–3 meetings before a decision)
- Rich candidate profiling (origin, financials, motivations)
- KPI tracking (time-to-decision, source performance, budget spent)
- Seamless handoff to onboarding when a candidate says yes

---

## Core Entities

### Candidate
The central record. A candidate may go through multiple recruitment cycles.

| Field | Type | Notes |
|---|---|---|
| Full Name | Text | |
| Phone | Text | |
| Email | Text | |
| Source | Enum | LinkedIn, Agency Social Media, Referral, Inbound, Other |
| Source Detail | Text | e.g. specific LinkedIn campaign, referring consultant name |
| Status | Enum | Prospect, In Contact, In Process, Decision Pending, Joined, Declined, On Hold |
| Assigned Recruiter | Relation → User | e.g. Catarina |
| Date of First Contact | Date | |
| Date of Last Interaction | Date | Auto-updated |
| Date of Decision | Date | When they said yes or no |
| Decision | Enum | Joined, Declined, Ghosted, On Hold |
| Reason for Yes | Text | Free text — what closed the deal |
| Reason for No | Text | Free text — what blocked the deal |

---

### Origin Profile
Information about where the candidate comes from professionally.

| Field | Type | Notes |
|---|---|---|
| Currently Active in Real Estate | Boolean | |
| Origin Brand | Enum | RE/MAX, Century 21, ERA, Keller Williams, Realty One, Independent, Other |
| Origin Brand (Custom) | Text | If "Other" |
| Time at Origin Brand | Number (months) | |
| Reason for Leaving Origin Brand | Text | Free text — often maps to core pain |
| Billing at Origin Brand (avg/month) | Currency | Self-reported |
| Billing at Origin Brand (avg/year) | Currency | Calculated or self-reported |

---

### Pain & Pitch Record
Captured during interviews — the core of the recruitment conversation.

| Field | Type | Notes |
|---|---|---|
| Identified Pains | Text (multi-line) | What the candidate said is wrong in their current situation |
| Solutions Presented | Text (multi-line) | How the agency was positioned as the answer |
| Candidate Objections | Text | What they pushed back on |
| Fit Score (subjective) | 1–5 | Recruiter's assessment after each meeting |

---

### Interview Log
Multiple entries per candidate — no limit.

| Field | Type | Notes |
|---|---|---|
| Interview # | Auto | Sequential per candidate |
| Date | DateTime | Synced with Calendar |
| Format | Enum | In-person, Video Call, Phone |
| Conducted By | Relation → User | |
| Notes | Text (rich) | Full notes from the meeting |
| Next Step | Text | What was agreed at the end of the meeting |
| Follow-up Date | Date | |

---

### Financial Evolution (Post-Join)
Filled in after the candidate joins. Tracks whether the promise made during recruitment was kept.

| Field | Type | Notes |
|---|---|---|
| Billing Month 1 | Currency | |
| Billing Month 2 | Currency | |
| Billing Month 3 | Currency | |
| Billing Month 6 | Currency | |
| Billing Month 12 | Currency | |
| Months to Match Previous Billing | Number | KPI: time to recover previous performance |
| Notes | Text | Context for spikes or drops |

---

### Budget & Resources
Tracks what was spent to attract this candidate.

| Field | Type | Notes |
|---|---|---|
| Paid Campaign Used | Boolean | |
| Campaign Platform | Enum | LinkedIn Ads, Meta Ads, Google Ads, Other |
| Estimated Cost to Acquire | Currency | Manual or linked to campaign |
| Resources Used | Text | e.g. events attended, content created, tools used |

---

### Onboarding Trigger
When a candidate says yes, this section becomes active.

| Field | Type | Notes |
|---|---|---|
| Contract Sent | Boolean | |
| Contract Sent By | Relation → User | e.g. Luísa |
| Form Sent to Luísa | Boolean | Triggers contract + CRM/system access creation |
| Access Created | Boolean | RE/MAX or internal system access |
| Onboarding Start Date | Date | |

---

## Pipeline Stages

```
Prospect → First Contact Made → Meeting 1 → Meeting 2 → Meeting 3 (if needed) → Decision → [Joined / Declined]
                                                                                        ↓
                                                                               Onboarding Triggered
```

- Each stage transition should log a timestamp
- Recruiter should be prompted to schedule next meeting at each stage
- If no activity in X days, surface an alert (configurable per stage)

---

## KPIs to Track

| KPI | Description |
|---|---|
| Time to Decision | Days from first contact to yes/no |
| Time to Decision by Origin Brand | Same KPI segmented by brand — e.g. "KW candidates take avg 45 days" |
| Conversion Rate by Source | % of candidates from each source that join |
| Conversion Rate by Origin Brand | Which brands produce the most joiners |
| Cost per Acquisition | Budget spent ÷ candidates joined |
| Meetings per Conversion | Avg number of meetings before a yes |
| Top Pain Points | Frequency analysis of identified pains |
| Top Reasons for No | Frequency analysis of declined reasons |
| Time to Match Previous Billing | Post-join KPI — how long to recover prior performance |
| Recruiter Performance | Conversion rate per recruiter |

---

## Source Tracking Logic

Headhunting is the primary motion. Sources must be tracked carefully:

- **LinkedIn** — direct outreach by recruiter
- **Agency Social Media** — candidate reached out after seeing a post
- **Paid Campaign** — LinkedIn Ads, Meta Ads, etc. (note: currently underperforming, needs comparison data)
- **Referral** — came through a consultant or existing contact
- **Inbound / Walk-in** — candidate approached the agency directly
- **Event** — met at an industry event

Each source should be reportable so the team can identify which channels deliver the best candidates and where to invest effort.

---

## Calendar Integration

- Each interview in the Interview Log should sync with the recruiter's calendar (Google Calendar or equivalent)
- Creating a new interview entry should offer to send a calendar invite
- The candidate's full timeline (first contact → meetings → decision) should be viewable in a single chronological view

---

## Key Business Rules

1. **Headhunting first** — the pipeline should default to outbound. Inbound candidates are a secondary flow.
2. **Unlimited interviews** — there is no cap on the number of meetings per candidate.
3. **Multi-recruiter support** — a candidate can be handled by more than one recruiter across meetings.
4. **Onboarding handoff** — when status changes to "Joined", a task must be created for Luísa to send the form and trigger contract + access creation.
5. **Financial data is sensitive** — billing fields should have role-based visibility (recruiter + management only).
6. **Historical candidates** — a declined candidate should remain in the system and be re-activatable in the future.

---

## Views & Filters Needed

- **Kanban by Pipeline Stage** — default view for recruiter
- **List by Recruiter** — management view
- **List by Origin Brand** — sourcing analysis
- **List by Source** — channel performance
- **Candidates with no activity in X days** — follow-up alerts
- **Post-join financial tracker** — billing evolution dashboard
- **KPI Dashboard** — aggregated metrics for management

---

## Open Questions / To Validate

- Is there a target number of active candidates in pipeline at any time?
- Should candidates be shareable between recruiters or always owned by one?
- What triggers re-activation of a previously declined candidate?
- Should the financial evolution (post-join billing) be pulled automatically from the billing system or filled manually?
- Is there a probation period flag — e.g. if a consultant leaves in the first 6 months, should that feed back into the recruitment record?
