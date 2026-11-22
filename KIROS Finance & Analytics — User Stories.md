# KIROS — Capital, Expenses & Business Analytics User Stories

Nov 22, 2026

## Overview

KIROS was trading before the app existed: money went in, equipment was bought, rent and salaries were paid, and food was sold over the counter. The app only ever saw online orders. This feature gives the business its own books inside the admin portal, and an analytics page that puts those books and the app's sales together.

Use this document two ways:

1. **As a guide.** The stages run in the order you'd actually use the feature: switch it on, record the starting capital, back-fill the history from before the app, keep it up to date, then read the analytics.
2. **As a checklist.** Tick a box once you've seen the app do it, not just once you've read about it. The worked example near the end gives you exact numbers to check against.

Each story reads `As an owner (or manager, or staff member), I want … so that …`, followed by the steps and what you should see.

## Where it lives and who can use it

| Page | Where | Who sees it |
| --- | --- | --- |
| Capital & expenses | Admin sidebar → Business → **Capital & expenses** (`/admin/finance`) | Anyone with `finance.view` |
| Business analytics | Admin sidebar → Business → **Analytics** (`/admin/analytics`) | Anyone with `finance.view` |
| Sales reports (unchanged) | Admin sidebar → Business → **Sales reports** | Anyone with `reports.view` |

| Permission | What it allows |
| --- | --- |
| `finance.view` | Open both pages, read every entry and budget, see all the analytics |
| `finance.manage` | Record, import, edit and delete entries; set budgets |
| `reports.export` (existing) | Download the ledger as CSV |

The Owner role has everything. No other role gets `finance.view` or `finance.manage` until the Owner grants them, because the books show capital, salaries and profit.

---

## Stage 1 — Switch it on

- [ ] **As the owner, I want the feature live after the next deploy, so that I don't have to set anything up by hand.**
  - The new database tables are created automatically when the API restarts on Render (the `FinanceLedger` migration).
  - Sign in as the Owner. Under **Business** you should see **Sales reports**, **Analytics** and **Capital & expenses**.

- [ ] **As the owner, I want to choose who else can see the money, so that salaries and capital stay private by default.**
  - Go to **Staff & roles**, open a role (or create one), and tick **Finance → See capital, expenses…** and, if they should record entries too, **Finance → Record, import and edit…**.
  - Someone without `finance.view` doesn't see the two menu items, and opening `/admin/finance` directly sends them away.

- [ ] **As a branch manager limited to some branches, I want to see only my branches' money, so that I'm not shown the whole business.**
  - A person who isn't set to "all branches" sees only entries filed against their branches, and analytics only for their branches.
  - They can't record a "Whole business" entry; the app tells them to choose a branch.

---

## Stage 2 — Start your books: the capital

Capital is money put **into** the business. Record it on the date it actually came in, even if that was years ago.

| Capital category | Use it for |
| --- | --- |
| Owner's investment | Your own savings put in |
| Investor / partner | Money from a partner or angel investor |
| Loan received | A bank or personal loan paid into the business |
| Grant | Grants and support money |
| Opening balance | The cash already in the business on the day you start these books, if you don't know where it all came from |

- [ ] **As the owner, I want to record the money I put in to start KIROS, so that the app knows how much the business owes back to me.**
  1. Open **Capital & expenses**. With no entries yet you'll see a **Start your books** card.
  2. Click **Record starting capital** (or **Record** → **Capital in**).
  3. Category **Owner's investment**, the amount in naira, the date it went in, and who it came from (e.g. "Founder").
  4. Click **Record**. You should see "Entry recorded", the row in the list, and **Capital put in** at the top go up by that amount.

- [ ] **As the owner, I want to record each later injection separately, so that the funding history shows when the money came.**
  - Each top-up is its own entry with its own date. They appear in order on **Analytics → Funding history**, each with the running net capital.

- [ ] **As the owner, I want to record a loan as capital in and its repayments as money out, so that both sides show up.**
  - Loan received: **Capital in → Loan received**.
  - Each repayment: **Money out → Loan repayment**.

---

## Stage 3 — Back-fill the history from before the app

Profit, payback and cash only make sense once the history is in. You don't need every receipt: monthly totals are fine.

What to bring in, in this order:

1. **Set-up costs** (one-off): equipment, renovation/fit-out, vehicles, licences.
2. **Running costs**, month by month: rent, salaries, ingredients, packaging, fuel and diesel, electricity, and the rest.
3. **Walk-in sales**: what was sold over the counter, as one total per month if that's all you have (**Other income → Walk-in / offline sales**).
4. **Money taken out**: owner's drawings, loan repayments, profit shares.

### Expense categories

| Group | Categories | Why the group matters |
| --- | --- | --- |
| Cost of sales | Ingredients & stock, Packaging | Rises and falls with sales; drives **food cost %** and **gross margin** |
| Running costs | Salaries & wages, Rent, Electricity & water, Fuel/gas & diesel, Delivery & transport, Marketing & promotion, Repairs & maintenance, Bank/POS & payment fees, Licences/permits & tax, Software & subscriptions, Cleaning & supplies, Other running cost | Fixed-ish monthly costs; drive **break-even** and **burn** |
| Assets & fit-out | Equipment & tools, Renovation & fit-out, Vehicles & bikes | One-off investment; kept **out** of operating profit, but counted in cash and payback |

- [ ] **As the owner, I want to type in a few past expenses by hand, so that I can start without preparing a spreadsheet.**
  - **Record** → **Expense** → choose the category (they're grouped as above) → amount → date in the past → optional vendor, branch, "paid by", reference and notes.
  - The date field won't let you pick a future day. The hint under it reminds you that back-dating is fine.

- [ ] **As the owner, I want to import a year of records from a spreadsheet in one go, so that I don't type hundreds of rows.**
  1. Click **Import** → **Template** to download `kiros-finance-template.csv`. Open it in Excel or Google Sheets.
  2. Fill one row per entry and save as CSV. Or copy the rows straight from your sheet, header line included.
  3. Back in **Import**, click **Choose CSV file** or paste into the box.
  4. Check the preview: a green "N ready" badge, a red "N with problems (skipped)" badge if any, and the total.
  5. Click **Import N rows**. You should see "Imported N entries", and the totals at the top update.

| Column | Needed? | Accepts |
| --- | --- | --- |
| date | Yes | `2025-02-01`, `01/02/2025` (day first), `1 Feb 2025` |
| category | Yes | The name ("Rent", "Ingredients & stock") or the key ("ingredients") |
| amount | Yes | Naira: `300000`, `300,000`, `₦300,000` |
| kind | No | Worked out from the category when blank (capital, expense, income, money out) |
| title / description | No | Defaults to the category name |
| vendor / payee / supplier | No | Free text |
| method / paid by | No | cash, transfer, POS, card, cheque, other |
| reference, notes | No | Free text |
| branch | No | The branch's name exactly as in Branches; blank = whole business |

Column names are matched loosely ("Description", "Amount (naira)", "Paid to" all work).

- [ ] **As the owner, I want bad rows explained instead of silently dropped, so that I can fix them.**
  - Each problem row says why, e.g. `Date "2024-02-30" isn't a date`, `Unknown category "Pizza"`, `No branch called "Nowhere"`, `Date is in the future`, `"Rent" is an expense category, not capital in`.
  - Only the good rows are imported. Fix the others and import just those again.

- [ ] **As the owner, I want limits that protect against mistakes, so that one bad file doesn't flood the books.**
  - Up to 1,000 rows per import and a 2 MB file. Split bigger histories by year.
  - All rows in one import are saved together or not at all.
  - The audit log records "Imported N finance entries (total)".

---

## Stage 4 — Record money as it happens

- [ ] **As the owner, I want to record today's expense in a few seconds, so that the books stay current.**
  - **Record** opens on **Expense** with today's date. Category, amount, **Record**. The description defaults to the category name if left blank.

- [ ] **As the owner, I want to record walk-in and catering sales, so that revenue isn't just the app's orders.**
  - **Record → Other income → Walk-in / offline sales** (or **Catering & events**).
  - This adds to **Revenue** in analytics and appears separately under **Revenue sources**.

- [ ] **As the owner, I want to record money I take out, so that cash and capital stay honest.**
  - **Record → Money out → Owner's drawings / Loan repayment / Dividend**.
  - Money out lowers cash and net capital. It is **not** an expense, so it doesn't reduce operating profit.

- [ ] **As the owner, I want to file a cost against one branch or the whole business, so that branch profit is fair.**
  - Branch rent → that branch. An accountant's fee or a central marketing push → **Whole business**.
  - **Analytics → By branch** shows whole-business costs on their own row, so they aren't charged to one branch.

- [ ] **As the owner, I want to fix a mistake, so that the numbers are right.**
  - Click the pencil on any row, change it, **Save changes**. You can change the kind too, but then you must pick a category of that kind.

- [ ] **As the owner, I want to delete a wrong entry and still have a trail, so that nothing disappears without a record.**
  - Click the bin → confirm. It stops counting immediately; the audit log keeps what was deleted, by whom and when.

- [ ] **As the owner, I want the app to refuse impossible entries, so that the books can't be corrupted.**
  - No future dates, no zero or negative amounts, and no category from the wrong kind (e.g. "Rent" as capital in).

---

## Stage 5 — Set monthly budgets

- [ ] **As the owner, I want to set what I plan to spend each month per category, so that overspending is flagged.**
  - **Capital & expenses → Budgets**. Enter a monthly amount next to any expense category; leave blank for none. **Total planned** shows the monthly sum. **Save budgets**.
  - People with `finance.view` only can open Budgets but can't change anything.

- [ ] **As the owner, I want budgets compared fairly against any period, so that a 90-day view isn't judged against one month.**
  - The budget is scaled to the period's length: 1–31 January counts as 1.02 months, so a ₦300,000 budget becomes ₦305,544.
  - In **Spending by category**, a tick mark on each bar shows the budget. A category is flagged **Over budget by ₦X** only when it is more than 5% over, so a bill that lands a day early isn't flagged.
  - The two worst overspends also appear in **What stands out**.

---

## Stage 6 — Find and export entries

- [ ] **As the owner, I want to filter the books, so that I can answer questions like "what did we spend on diesel at Lekki last quarter?"**
  - Tabs: **Everything, Expenses, Capital in, Other income, Money out**.
  - Filters: search (description, vendor, reference), category (only that tab's categories), branch, and a date range.
  - Under the list: the number of entries and their total. On **Everything**, the total adds money in and out together; pick a tab for a total that means something.

- [ ] **As the owner, I want to download the books, so that my accountant can work with them.**
  - **CSV** downloads exactly what the filters show (date, kind, category, title, amount in kobo, branch, method, vendor, reference, notes, recorded by). Needs `reports.export`.

- [ ] **As the owner, I want an at-a-glance summary, so that I don't have to open analytics for the basics.**
  - The top of **Capital & expenses** shows all-time **Capital put in** (and net of money out), **Spent to date** (and how much on assets), **Revenue to date** and **Estimated cash**. Choosing a branch filter narrows these to that branch.

---

## Stage 7 — Read the analytics

### Choosing what to look at

- [ ] **As the owner, I want to switch between periods quickly, so that I can see both this month and the whole history.**
  - Presets: **30 days, 90 days** (default), **6 months, 12 months, This year, All time, Custom**. Your choice is remembered on this browser.
  - **All time** starts at the first entry or order ever recorded.
  - Under the title you'll see the dates and "compared with the N days before". Every comparison uses the equally long period just before.

- [ ] **As the owner, I want to choose daily, weekly or monthly points, so that long histories aren't a blur.**
  - **Auto** picks daily up to 45 days, weekly up to about 6 months, and monthly beyond that. You can override it.

- [ ] **As the owner, I want to look at one branch, so that I can judge each location.**
  - Choose a branch. **Note:** whole-business entries (shared rent, capital) are left out of a single-branch view. Use **All branches** for the full picture.

### The headline

- [ ] **As the owner, I want six key numbers with their direction, so that I know in five seconds how we're doing.**
  - **Revenue, Costs, Operating profit, Operating margin, App orders, Average order**, each with the change against the previous period and a small trend line.
  - Green means good, red means bad: costs going **up** shows red; revenue going up shows green. Margin changes show as points (e.g. "+4.4 pts").

- [ ] **As the owner, I want the app to tell me what stands out, so that I don't have to read every chart.**
  - **What stands out** lists up to 8 findings, most urgent first (needs attention → watch → good → note). Examples:
    - "Running at a loss of ₦…" or "Profitable: ₦… operating profit"
    - "Revenue up/down X% on the previous period"
    - "Costs grew faster than sales"
    - "Food cost is X% of revenue" (warns above 38%, praises 35% and under)
    - "Prime cost is X% of revenue" (warns above 65%)
    - "<Category> is over budget"
    - "<Category> is your biggest cost" (when it's 30% or more of spending)
    - "Break-even: about ₦… a month", and how far above or below you are
    - "About N months of runway" (only when losing money)
    - "X% of capital earned back" / "Capital fully earned back"
    - "Busiest time: Fridays around 1pm"
    - "Average order up/down X%"
  - With no books recorded yet, the first finding (and a card at the top) says only app sales are counted, with a button to add your books.

### Trends and history

- [ ] **As the owner, I want revenue, costs and profit on one timeline, so that I can see the trend.**
  - **Revenue, costs and profit**: three lines on one scale. Hover (or tap on a phone) for the exact figures of that day, week or month.

- [ ] **As the owner, I want to see how much cash the business should have, and how it got there, so that I'm never surprised.**
  - **Estimated cash over time**: a running line ending at today's estimate (everything in minus everything out, from the very first record).

- [ ] **As the owner, I want to see which periods made or lost money, so that I can spot bad months.**
  - **Profit or loss by period**: bars above the line made money; bars below it lost money.

- [ ] **As the owner, I want to see what the money is spent on over time, so that I can see when costs crept up.**
  - **Where the money goes**: stacked bars per period split into cost of sales, running costs, and assets & fit-out.
  - **Spending by category**: every category with its share, its change against before, and its budget.

- [ ] **As the owner, I want every chart as a table too, so that I can read exact numbers or copy them.**
  - The small table icon on a chart switches it to a table of the same data; click again to go back.

### Restaurant health

- [ ] **As the owner, I want the standard restaurant ratios checked against common targets, so that I know where we stand.**
  - **Food cost** (target 28–35%), **Labour** (25–35%), **Prime cost** = food + labour (under 65%), **Gross margin**. Each shows Healthy / Watch / High with an icon and a coloured bar.

- [ ] **As the owner, I want to know my break-even and burn, so that I know what sales I need each month.**
  - **Break-even & burn**: average revenue a month, the revenue needed to break even (running costs ÷ gross margin) with a progress bar, monthly spending, runway, and assets bought in the period.

- [ ] **As the owner, I want the whole story since day one, so that I know if the business has paid me back.**
  - **Since the start**: capital put in, money taken out, revenue, everything spent (including assets), estimated cash, and **Capital earned back**: operating profit less assets, divided by capital, with a progress bar ("Not yet earning it back" / "On the way" / "Paid back").

### Where, when and who

- [ ] **As the owner, I want profit per branch, so that I know which location pulls its weight.**
  - **By branch**: orders, revenue, costs, profit and margin per branch, plus a separate whole-business row. Losses show in red with a down arrow.

- [ ] **As the owner, I want to see where revenue comes from, so that I can tell how much the app matters.**
  - **Revenue sources**: online orders (this app) against walk-in, catering and other income, with shares.

- [ ] **As the owner, I want to see the busiest days and hours, so that I can plan staff and prep.**
  - **Busy times**: a 7-day by 24-hour grid of app orders; darker means busier. Hover or tap a square for the orders and revenue in that hour.

- [ ] **As the owner, I want to see new against returning customers, so that I know if people come back.**
  - **Customers**: per period, first-time app customers against returning ones.

- [ ] **As the owner, I want the funding timeline and my biggest suppliers, so that I can see who I depend on.**
  - **Funding history**: every capital-in and money-out entry in date order, with the running net capital. Only the latest 8 show until you click **Show N earlier**.
  - **Top vendors this period**: the six vendors you spent most with, and their share of spending.

---

## Stage 8 — Use it on your phone

- [ ] **As the owner, I want to record an expense on my phone at the market, so that I don't wait until I'm at a computer.**
  - **Record** opens a scrolling form that fits the screen; the Record button is at the bottom.

- [ ] **As the owner, I want the books readable on a phone, so that I can check them anywhere.**
  - Entries show as cards with the amount and the edit/delete buttons always visible. Nothing scrolls sideways.

- [ ] **As the owner, I want the analytics usable on a phone, so that I can check how we're doing on the go.**
  - Tiles stack two to a row, charts fit the screen, and tapping a chart shows the numbers. **By branch** becomes a compact list with profit on the right. The period presets scroll sideways in their own strip.

---

## Your monthly routine

At the start of each month, for the month that just ended:

- [ ] Record rent, salaries, utilities, fuel and any other bills not yet entered.
- [ ] Record the month's walk-in / counter sales total.
- [ ] Record any drawings or loan repayments.
- [ ] Record payment-provider and bank charges (**Bank, POS & payment fees**); the app doesn't take these off automatically.
- [ ] Open **Analytics → Custom** for that month and read **What stands out**.
- [ ] Check **Spending by category** for anything over budget and adjust budgets if the plan has changed.
- [ ] Download the CSV for the month if your accountant wants it.

---

## Worked example: check it end to end

Use this on a test restaurant (or a staging copy), not your live books. It gives exact numbers to tick against. All amounts are naira.

**1. Set a budget:** Ingredients & stock = 300,000 a month.

**2. Record these entries (or import them as one CSV):**

| Date | Kind | Category | Description | Amount |
| --- | --- | --- | --- | --- |
| 2 Jan 2025 | Capital in | Owner's investment | Savings to start | 5,000,000 |
| 5 Jan 2025 | Expense | Equipment & tools | Fryer and freezer | 1,200,000 |
| 6 Jan 2025 | Expense | Rent | January rent | 250,000 |
| 10 Jan 2025 | Expense | Ingredients & stock | Market runs | 350,000 |
| 12 Jan 2025 | Expense | Packaging | Takeaway packs | 50,000 |
| 31 Jan 2025 | Expense | Salaries & wages | January pay | 300,000 |
| 31 Jan 2025 | Other income | Walk-in / offline sales | January counter sales | 1,200,000 |
| 31 Jan 2025 | Money out | Owner's drawings | Owner's draw | 100,000 |

```csv
date,category,title,amount
2025-01-02,Owner's investment,Savings to start,5000000
2025-01-05,Equipment & tools,Fryer and freezer,1200000
2025-01-06,Rent,January rent,250000
2025-01-10,Ingredients & stock,Market runs,350000
2025-01-12,Packaging,Takeaway packs,50000
2025-01-31,Salaries & wages,January pay,300000
2025-01-31,Walk-in / offline sales,January counter sales,1200000
2025-01-31,Owner's drawings,Owner's draw,100000
```

**3. Open Analytics → Custom → 1 Jan 2025 to 31 Jan 2025, All branches.** You should see:

| Where | Expected |
| --- | --- |
| Revenue | ₦1,200,000 (no earlier data to compare) |
| Costs (cost of sales + running) | ₦950,000 |
| Operating profit | ₦250,000 |
| Operating margin | 21% |
| Food cost | 33%, Healthy |
| Labour | 25%, Healthy |
| Prime cost | 58%, Healthy |
| Gross margin | 67%, Healthy |
| Average revenue a month | ₦1,178,226 (January counts as 1.02 months) |
| Break-even revenue a month | ₦810,030 |
| Spending a month (burn) | ₦932,762 |
| Runway | Not burning cash |
| Assets bought this period | ₦1,200,000 |
| Capital put in / Money taken out | ₦5,000,000 / ₦100,000 |
| Estimated cash | ₦3,950,000 |
| Capital earned back | 0%, "Not yet earning it back" (₦250,000 profit is less than the ₦1,200,000 spent on assets) |
| Ingredients & stock | ₦350,000, **Over budget by ₦44,456** (budget for the period ₦305,544) |
| What stands out | Ingredients & stock is over budget · Profitable: ₦250,000 operating profit (21% margin) · Food cost is healthy at 33% · Break-even: about ₦810,030 a month (₦368,196 above it) · Equipment & tools is your biggest cost (56% of all spending) |

**4. Then try:**

- [ ] Delete the drawings entry → Estimated cash becomes ₦4,050,000, and the deletion appears in the audit log.
- [ ] Edit the rent to 450,000 → Operating profit drops to ₦50,000 and break-even rises.
- [ ] Try to record anything dated tomorrow → it's refused.
- [ ] Import the CSV again with one row's date changed to `2025-02-30` → 7 ready, 1 with problems, and only 7 are added.

---

## How each number is worked out

| Number | How |
| --- | --- |
| App revenue | Paid app orders in the period, including delivery fees, after discounts. Cancelled and refunded orders are left out. |
| Revenue | App revenue + other income (walk-in, catering, other). |
| Cost of sales | Ingredients & stock + Packaging. |
| Running costs | Every other expense category except assets. |
| Costs (headline tile) | Cost of sales + running costs. |
| Gross profit / margin | Revenue − cost of sales; ÷ revenue. |
| Operating profit / margin | Revenue − cost of sales − running costs; ÷ revenue. Assets are left out: they're investment, not a monthly cost. |
| Food cost % | Cost of sales ÷ revenue. |
| Labour % | Salaries & wages ÷ revenue. |
| Prime cost % | (Cost of sales + salaries) ÷ revenue. |
| Months in a period | Days ÷ 30.44. |
| Average revenue a month | Revenue ÷ months. |
| Break-even a month | (Running costs ÷ months) ÷ gross margin. |
| Burn a month | (Cost of sales + running costs) ÷ months. |
| Runway | Estimated cash ÷ monthly operating loss. Shown only while losing money with cash left. |
| Estimated cash | Everything ever in (capital + all revenue) − everything ever out (all expenses including assets + money out), up to the period's end date. |
| Capital earned back | (All-time operating profit − all-time assets) ÷ all-time capital in. |
| Budget for a period | Monthly budget × months in the period. Flagged when spending is more than 5% over it. |
| New customers | Customers whose first-ever paid app order with KIROS falls in that day, week or month. |
| Busy times | App orders by weekday and hour, in the restaurant's time zone. |

---

## Rules the app enforces

- Amounts must be more than zero (entered in naira, stored in kobo).
- Dates can be in the past, never in the future.
- The category must belong to the kind (e.g. Rent is only ever an expense).
- Branch-limited staff can only file and see entries for their branches.
- Recording, importing, editing, deleting and budgets need `finance.manage`; CSV export needs `reports.export`.
- Every change is written to the audit log; deleted entries can be traced there.
- Imports: up to 1,000 rows and 2 MB per file; all rows are saved together or none.

---

## Known limits and open questions

These aren't covered yet. Decide them before relying on the numbers for anything formal.

1. **Payment-provider fees.** Paystack and bank charges aren't taken off app revenue automatically. For now, record them monthly as **Bank, POS & payment fees**. Should the app pull them in automatically?
2. **Loan interest.** A loan repayment is recorded as money out in full, so the interest part never counts as a cost. Ask your accountant whether to record the interest separately as an expense.
3. **Receipts.** You can't attach a photo of a receipt yet; use the Reference field for the receipt number.
4. **Recurring costs.** Rent and salaries must be entered each month; there's no "repeat monthly" yet.
5. **Budgets** are per category for the whole business, not per branch.
6. **Stock on hand** isn't tracked, so food cost is based on what was bought in the period, not what was used.
7. **Estimated cash** is only as good as what's recorded. It isn't a bank balance, so compare it with the bank statement each month.
8. **This is for running the business, not tax.** It doesn't replace statutory accounts or tax filings.
