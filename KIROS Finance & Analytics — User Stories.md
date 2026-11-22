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
| Record sales | Admin sidebar → Business → **Record sales** (`/admin/sales`) | Sales-only staff (`finance.record_sales` without `finance.view`); it's their home page |
| Sales reports (unchanged) | Admin sidebar → Business → **Sales reports** | Anyone with `reports.view` |

| Permission | What it allows |
| --- | --- |
| `finance.view` | Open Capital & expenses and Analytics, read every entry and budget, see all the analytics and the vendors & customers list with totals |
| `finance.manage` | Record, import, edit and delete any entry; set budgets; add, rename, merge and remove vendors & customers |
| `finance.record_sales` | **Sales only:** record other income (walk-in, catering…), split between customers; see every sale at their branches; correct or delete only the sales they recorded themselves, until 6am the next morning. No capital, expenses, budgets, analytics, imports or downloads. |
| `reports.export` (existing) | Download the books as an Excel file |

The Owner role has everything. No other role gets any finance permission until the Owner grants it, because the books show capital, salaries and profit.

---

## Stage 1 — Switch it on

- [ ] **As the owner, I want the feature live after the next deploy, so that I don't have to set anything up by hand.**
  - The new database tables are created automatically when the API restarts on Render (the `FinanceLedger` and `FinanceParties` migrations).
  - Any vendor or customer names already typed into entries become saved vendors & customers automatically. Different spellings of the same name ("Mile 12 market", "  mile 12 MARKET ") become one.
  - Sign in as the Owner. Under **Business** you should see **Sales reports**, **Analytics** and **Capital & expenses**.

- [ ] **As the owner, I want to choose who else can see the money, so that salaries and capital stay private by default.**
  - Go to **Staff & roles**, open a role (or create one), and tick **Finance → See capital, expenses…** and, if they should record entries too, **Finance → Record, import and edit…**.
  - Someone without `finance.view` doesn't see the two menu items, and opening `/admin/finance` directly sends them away.

- [ ] **As a branch manager limited to some branches, I want to see only my branches' money, so that I'm not shown the whole business.**
  - A person who isn't set to "all branches" sees only entries filed against their branches, and analytics only for their branches.
  - They can't record a "Whole business" entry: the Branch box only lists their own branches.

- [ ] **As the owner, I want a cashier to record sales without seeing the rest of the books, so that sales get entered daily without exposing capital, salaries or profit.**
  1. In **Staff & roles**, create a role (e.g. "Cashier") and tick only **Finance → Record walk-in and other sales only**. Give it to the person and set their branch.
  2. When they sign in they land on **Record sales**, and that's the only finance link they see. Opening `/admin/finance` or `/admin/analytics` sends them away.
  3. **Record a sale** opens the form locked to sales: no capital/expense/money-out switch, the Branch box shows only their branch, and the lines are **Customers**.
  4. The page shows **Sales today** (the sales dated today, summed by the server) and **Recent sales**, **newest entered first and grouped by day** (Today, Yesterday, then dates), for their branch(es): everything sold there, including what the owner or a manager recorded, each marked "by you" or by the person's name. They can edit or delete only **their own** sales, until **6am the next morning**: the sales day rolls over at 6am, not midnight, so a sale entered at 11pm or 1am can still be fixed at closing time. After 6am it's "ask a manager" (the page says so). Managers can always correct it in Capital & expenses.
  - **Back-dated sales are flagged.** If a sale's date isn't the day it was entered, its row carries an amber **Dated 18 Jun 2026** badge, and it is not counted in "Sales today". In the form, picking a date two or more days back shows an amber warning under the date ("Dated 18 Jun 2026, not today. It counts in that period, not in today's or this month's totals.") with a **Use today** link. Analytics counts a sale in the period of its **date**, so a sale dated in June never appears in a 30-day view.
  - A sale recorded for the **whole business** (Branch = Whole business) belongs to no branch, so branch staff don't see it. When you record a sale as owner, pick the branch if that branch's staff should see it (the Branch box reminds you).
  - They see sales (income) only, never expenses or capital. They see only the names of customers already used on sales: no vendor names and no amounts. They can't import, download, set budgets, or manage the vendors & customers list.
  - Someone with both this and `finance.view` doesn't get the extra link: Capital & expenses already covers it.

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

- [ ] **As the owner, I want to import a year of records from an Excel sheet in one go, so that I don't type hundreds of rows.**
  1. Click **Import** → **Download Excel template**. You get `kiros-finance-template.xlsx`.
  2. Open it in Excel (or Google Sheets / Numbers) and fill in the **Entries** sheet, one row per entry. Save it as `.xlsx`.
  3. Back in **Import**, click **Choose Excel file** and pick it. The dialog shows the file name, the sheet it read and how many rows it found.
  4. Check the preview: a green "N ready" badge, a red "N with problems (skipped)" badge if any, and the total.
  5. Click **Import N rows**. You should see "Imported N entries", and the totals at the top update.

- [ ] **As the owner, I want the template to stop typing mistakes before they happen, so that most rows import first time.**
  - **Category**, **Paid by** and **Branch** are dropdowns. Category lists all 28 categories; Branch lists your own branches (blank = whole business).
  - **Date** only accepts a real date, not in the future. **Amount** only accepts a number above zero. Excel shows a message if something else is typed.
  - Each column heading has a comment explaining what goes in it. The header row stays frozen while you scroll.
  - The template also has an **Example** sheet with a finished month, a **Categories** sheet listing every category with its type and group, and a **How to fill** sheet. Only **Entries** is ever imported.

| Column (Entries sheet) | Needed? | Accepts |
| --- | --- | --- |
| Date | Yes | A date cell (shown as 31/01/2025). Typed text like `01/02/2025` (day first), `2025-02-01` or `1 Feb 2025` also works. |
| Category | Yes | Pick from the dropdown. The category decides the type: capital in, expense, other income or money out. |
| Description | No | Defaults to the category name |
| Amount (₦) | Yes | Naira, more than zero. Formulas are fine (their result is used). |
| Vendor / paid to | No | One name per row. It is matched to your saved vendors & customers (capitals don't matter) or added as a new one. To split a purchase between vendors in Excel, put one row per vendor. |
| Paid by | No | Dropdown: Cash, Bank transfer, POS, Card, Cheque, Other |
| Reference, Notes | No | Free text |
| Branch | No | Dropdown of your branches; blank = whole business |

- [ ] **As the owner, I want to use the spreadsheet I already keep, so that I don't retype it into the template.**
  - Any `.xlsx` works as long as the first row has headings. The **Entries** sheet is read if there is one, otherwise the first sheet.
  - Headings are matched loosely ("Description", "Narration", "Amount (naira)", "Paid to", "Supplier", "Type" all work). A **Type**/**Kind** column is optional: it's worked out from the category when missing.
  - You can also copy rows in Excel (with the heading row) and paste them into the box under the buttons.
  - Old `.xls` files are refused with a message to save them as `.xlsx` first.

- [ ] **As the owner, I want bad rows explained instead of silently dropped, so that I can fix them.**
  - Each problem row shows its **Excel row number** and why, e.g. `Date "2024-02-30" isn't a date`, `Unknown category "Pizza"`, `No branch called "Abuja"`, `Date is in the future`, `Amount "0" must be more than zero`, `"Rent" is an expense category, not capital in`.
  - Only the good rows are imported. Fix the others in Excel and import just those again.

- [ ] **As the owner, I want limits that protect against mistakes, so that one bad file doesn't flood the books.**
  - Up to 1,000 rows per import and a 5 MB file. Split bigger histories into one file per year.
  - All rows in one import are saved together or not at all.
  - The audit log records "Imported N finance entries (total)".

---

## Stage 4 — Record money as it happens

- [ ] **As the owner, I want to record today's expense in a few seconds, so that the books stay current.**
  - **Record** opens on **Expense** with today's date. Category, amount, **Record**. The description defaults to the category name if left blank.

- [ ] **As the owner, I want a half-filled form to survive me switching to another tab or app, so that I can check a receipt and come back.**
  - Open **Record**, pick a category and type an amount, switch to another browser tab (or app on your phone), come back and press **Record**. It saves, with no "Choose a category" message.

- [ ] **As the owner, I want to pick vendors I've used before instead of retyping them, so that names stay consistent and analytics adds them up properly.**
  - In **Vendor / paid to**, start typing: saved names appear underneath (names already used on this type of entry come first, with how often they've been used). Pick one with a click or arrow keys + Enter.
  - A new name is fine: "Add “…” as new" saves it to your list when you record the entry. Spelling differences in capitals are matched ("mile 12 market" = "Mile 12 market").
  - The label follows the type of entry: **Vendor / paid to** (expense), **Customer / client** (other income), **From** (capital), **Paid to** (money out).

- [ ] **As the owner, I want one purchase paid to several vendors saved in one go, so that a market run doesn't need five entries.**
  1. **Record → Expense**, pick the category, then **Split between several vendors**.
  2. Each line has a vendor and an amount; **Add another vendor** for more, and **×** removes a line.
  3. The Amount box becomes **Total** and adds up the lines by itself. Back to one line, it goes back to a normal amount.
  - Saved as one entry with each vendor's share, e.g. "Market run ₦100,000: Iya Bose ₦40,000, Mallam Sani ₦25,000, Fresh Farms ₦35,000".
  - Editing a split: change the lines and the total follows. Changing only the total of a split is refused ("change their amounts too").

- [ ] **As the owner, I want to record walk-in and catering sales, so that revenue isn't just the app's orders.**
  - **Record → Other income → Walk-in / offline sales** (or **Catering & events**).
  - One sale can be split between several customers the same way, e.g. a catering job paid by two clients.

- [ ] **As the owner or a cashier, I want to pick the menu items that were sold in a walk-in sale, so that I can see which products sell at the counter, not just online.**
  1. **Record → Other income → Walk-in / offline sales** (or **Catering & events**). A sales-only cashier's form is already on Walk-in sales.
  2. Under **What was sold**, click **Add what was sold** and start typing an item. Your menu appears underneath with each item's category and price. Pick one and its menu price is filled in.
  3. Set the **quantity**. Change the **price each** if the customer got a discount; the menu price is only the starting point. **Add another item** for more lines, and **×** removes one.
  4. The **Total** adds itself up (quantity × price, summed). You can't type over it while items are listed.
  5. **Record.** The sale shows what was in it, e.g. "3× Chicken wrap, 1× Exclusive sandwich".
  - The list offers only the menus that the branch you chose serves (no branch chosen: everything on the menu). Items that are switched off or deleted aren't offered.
  - Something sold that isn't on the menu can be typed in ("Add “…” (not on the menu)"). It's tracked by its name.
  - The item's name is kept as it was when sold, so later renaming or deleting a menu item doesn't change old sales.
  - Items are optional. Leave them out and enter a plain amount as before.
  - A sale with items and a customer split: the customers' amounts must add up to the items' total. The form shows "₦X of ₦Y assigned" as you go.
  - Editing a sale with items: change the items and the total follows. To go back to a plain amount, remove all the items. A sale's total can't be changed without its items.
  - This adds to **Revenue** in analytics and appears separately under **Revenue sources**. Customers appear under **Top customers**.

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
  - In a split, every line needs a name and an amount, the same name can't appear twice, and the lines must add up to the total.

- [ ] **As the owner, I want to tidy my vendors & customers list, so that duplicates don't split my analytics.**
  - **Capital & expenses → Vendors & customers** lists every name with its role (Vendor, Customer, Investor / lender), how many entries, the total, and when it was last used. Search at the top.
  - **Add** a name in advance. **Rename** (pencil): every entry shows the new name. Renaming onto a name that already exists is refused with a hint to merge.
  - **Merge** (branch icon): pick the name to keep. Every entry moves across, and a split that had both names ends up with one combined line. The old name disappears.
  - **Remove** (bin) works only for names on no entries; otherwise merge instead.

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

- [ ] **As the owner, I want to download the books as an Excel file, so that my accountant can work with them.**
  - **Excel** downloads `kiros-books-<date>.xlsx` with exactly what the filters show (tab, category, branch, dates, search). Needs `reports.export`.
  - **Entries** sheet: Date (real dates), Category, Description, Amount (₦, in naira), Vendor / paid to, Paid by, Reference, Notes, Branch (by name; blank = whole business), Type, Group, Recorded by. The heading row is frozen and has filter arrows.
  - An entry split between several vendors or customers comes out as **one row per person** with their own amount (same date, category and description). That way the file adds up correctly and imports back as separate entries.
  - **Summary** sheet: the filters used and when it was downloaded, totals per category grouped by type, and money in, money out and net.
  - **Items sold** sheet (only when some sales in the file list items): one row per item with date, sale, item, quantity, unit price, total and branch.
  - App orders aren't in this file. Use Sales reports for those, or Analytics for everything together.

- [ ] **As the owner, I want to fix things in Excel and bring them back, so that bulk corrections are quick.**
  - The Entries sheet uses the same columns as the import template, so a downloaded file can be imported as it is. Importing adds new entries; it doesn't replace the old ones. To correct entries in bulk: download, delete the wrong entries in the app, fix the rows in Excel, and import them.

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
  - Choose a branch. **Note:** entries filed for the whole business (shared rent, capital, a sale recorded with Branch = Whole business) belong to no branch, so they are left out of a single-branch view. When that happens a yellow notice at the top says how much is left out (income, expenses…) and has a **Show all branches** button.
  - The branch you pick is remembered across the admin pages (Dashboard, Orders, Analytics…), so check the branch box if a number looks too low. If a sale or cost "is missing" from Analytics, a remembered branch is the first thing to look at.

### The headline

- [ ] **As the owner, I want six key numbers with their direction, so that I know in five seconds how we're doing.**
  - **Revenue, Costs, Operating profit, Operating margin, App orders, Average order**, each with the change against the previous period and a small trend line.
  - Green means good, red means bad: costs going **up** shows red; revenue going up shows green. Margin changes show as points (e.g. "+4.4 pts").

- [ ] **As the owner, I want to know why a sale I recorded isn't in Analytics, so that I can fix it instead of guessing.**
  - Analytics counts each entry in the period of its **date** and only for the branch selected. If a sale is missing, check in this order: (1) its date, since a sale dated outside the period isn't counted, so try **All time**; (2) the **Branch** box, because a remembered branch hides other branches, and entries filed for the whole business are left out of a single-branch view (a yellow notice says so); (3) that the sale was recorded as **Other income**, not as another type.
  - On the Record sales page a back-dated sale shows a **Dated …** badge, which is the quickest way to spot a mistyped date. Edit the sale and set the date to today to bring it into the current period.

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
  - **Best sellers**: the items that sold most, online orders and counter sales **together**, with each item's units, revenue, and how many came from online orders against the counter (a two-colour bar). Only paid online orders count (cancelled and refunded are left out). Counter sales appear here only when you picked the items; a sale entered as a plain amount adds to revenue but not to this list. In a single-branch view, only that branch's sales count.
  - **Top vendors & customers this period**: the six vendors you spent most with and the six customers who paid you most (other income), each with their share. A split counts only each person's own part.

---

### Sales reports: online and counter sales together

Sales reports (Business → **Sales reports**, `reports.view`) used to count online orders only. It now adds counter sales (walk-in and catering sales recorded in the app) and has been redesigned.

- [ ] **As a manager, I want counter sales in my sales report, so that the report matches what the branch really sold.**
  - Counter sales are the entries recorded as **Walk-in / offline sales** or **Catering & events**, counted on the **date of the sale**. Other income (interest, refunds…) and expenses are not sales and are left out. Cancelled and refunded online orders are left out as before.
  - A manager limited to certain branches sees only those branches' counter sales. Sales filed for the whole business appear only under **All branches** (a note says so when a branch is selected).
  - Counter sales are included for anyone with `reports.view`; they don't need the finance permissions.

- [ ] **As a manager, I want to pick the period quickly and compare it with the one before, so that I can see if sales are growing.**
  - Presets: **Today, 7 days, 30 days, This month, Last month, 90 days, This year, Custom** (two dates). The page title shows the period and the equally long period it's compared with.
  - Every headline number shows the change against that earlier period (green up, red down) and a small trend line.

- [ ] **As a manager, I want to switch between all sales, online orders and counter sales, so that I can look at each on its own.**
  - **All sales** shows five tiles: Total sales, Online orders, Counter sales, Average sale and Counter share. **Online orders** and **Counter sales** show tiles for that source only (orders, average order, units sold, delivery share…). The choice is remembered on this browser.

- [ ] **As a manager, I want a chart and a few highlights, so that I don't have to read every row.**
  - **Sales over time:** columns per day (weeks for ranges over 45 days, months over about 6 months), with online orders in blue stacked on counter sales in orange. Hover or tap for exact figures; the table icon shows the same data as a table.
  - **Highlights:** the best day, the average per day, the best weekday, and how many days had sales.

- [ ] **As a manager, I want the breakdown by day, branch, menu, item or option, with both sources side by side.**
  - **All sales:** each row shows online (with the number of orders), counter (with the number of sales), the total, and a blue/orange mix bar. **Online orders** adds subtotal, delivery and discounts. **Counter sales** shows sales, units and revenue.
  - **By item:** one row per product, adding online units to counter units. **By menu:** counter sales are placed under the menu their items belong to. A counter sale that didn't list its items has no product or menu, so it shows as **Sales without items listed**, which keeps the totals honest. (Pick the items when recording a sale to get them into these rows.)
  - **By option:** online orders only; counter sales don't record options.
  - Days are listed newest first, and the table shows 15 rows a page with a total row. On a phone each row becomes a card.

- [ ] **As a manager, I want to download the report as Excel, so that I can share it or work on it.**
  - **Excel** downloads `sales-by-<grouping>.xlsx` (needs `reports.export`): a **Summary** sheet (this period against the previous one, with the change) and a sheet with the rows of the grouping you're viewing, a share-of-total column and a total row. The old CSV button is gone from the page.

- [ ] **As a manager, I want today's counter sales on the Dashboard, so that the first screen shows what the whole business sold.**
  - **Today's tiles:** Orders today (online), **Counter sales today** (walk-in and catering), **Revenue today** (online + counter, with the split underneath: "Online ₦… · Counter ₦…"), **Average sale** (per order or counter sale) and **Items sold today** (online units plus counter units where items were listed).
  - **Top items today** adds online and counter units for each product and shows where they sold ("4 online · 4 at the counter").
  - **Last 30 days** gains **Counter sales** and a combined **Revenue** with the same split.
  - Respects the same limits as the reports: a branch manager sees only their branch's counter sales (whole-business sales only appear with All branches), and today's counter sales are those dated today.
  - **Who sees what:** counter sales, revenue and the average need `reports.view` (as revenue already did). Someone who can open the Dashboard without it (for example the kitchen) still sees order counts and online items, and no money or counter figures.

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
- [ ] Download the month as Excel (Capital & expenses → pick the dates → **Excel**) if your accountant wants it.

---

## Worked example: check it end to end

Use this on a test restaurant (or a staging copy), not your live books. It gives exact numbers to tick against. All amounts are naira.

**1. Set a budget:** Ingredients & stock = 300,000 a month.

**2. Record these entries.** The quickest way: download the Excel template, copy the 8 rows from its **Example** sheet into the **Entries** sheet (they're the same rows as below), save, and import the file.

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
- [ ] In the template's Entries sheet, try typing `30/02/2025` in a Date cell → Excel itself refuses it ("Enter a date like 31/01/2025"). Same for a category that isn't in the list, or an amount of 0.
- [ ] In a plain Excel sheet of your own (no dropdowns), put the 8 rows under the headings Date, Category, Description, Amount, change one date to the text `30/02/2025`, and import it → 7 ready, 1 with problems showing its Excel row number, and only 7 are added.

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
- Recording, importing, editing, deleting, budgets and the vendors & customers list need `finance.manage`; the Excel download needs `reports.export`.
- `finance.record_sales` alone allows only: recording other income, and seeing every sale at the person's branches, and correcting / deleting only the sales that person recorded, until the sales day rolls over at 6am. Everything else is refused by the server, not just hidden.
- In a split, the lines must add up to the total, each needs a name and an amount, and a name can appear only once.
- A sale's items must add up to its total, and items can only be listed on a sale (other income), not on expenses or capital.
- Every change is written to the audit log; deleted entries can be traced there.
- Imports: Excel (.xlsx) or rows pasted from Excel; up to 1,000 rows and 5 MB per file; all rows are saved together or none.

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
8. **Splits in Excel.** An imported row has one vendor or customer. A split entry is imported as one row per person, so it becomes separate entries (the totals are the same). Splitting can be done in the app. (Decided: no multi-vendor cell in Excel; if grouping rows ever matters, an optional "Entry no." column can be added.)
9. **Items in Excel imports.** The import brings in sales as plain amounts; it doesn't read items. Use the form (or ask for item import if you have a lot of history by item). The **Sales reports** page, grouped by item, still counts online orders only: **Best sellers** in Analytics is where the two are combined.
10. **Items with options.** A build-your-own salad is one menu item with a base price. Pick it and type the final price charged; the choices (dressing, protein…) aren't recorded per sale yet.
11. **Cashier corrections** are limited to 6am the next morning (decided: the short window stops a sale being recorded, the cash taken, and the sale deleted days later). Later corrections go to a manager. The 6am is fixed for now, not a setting; if you trade through the night, say so and we'll move it.
12. **This is for running the business, not tax.** It doesn't replace statutory accounts or tax filings.
