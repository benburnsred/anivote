# Setting up the awards backend (about 15 minutes)

Do this once, on a computer, signed in to the Google account that will host it (your own for testing).

---

## Part 1 — Make the Sheet

1. Go to **sheets.new**. A blank Google Sheet opens.
2. Click **Untitled spreadsheet** (top left) and name it **AxA Awards 2026**.

## Part 2 — Paste the code

3. In the Sheet's menu, click **Extensions → Apps Script**. A new tab opens with a file called `Code.gs`.
4. Open this link in another tab: https://raw.githubusercontent.com/benburnsred/anivote/main/awards/apps-script/Code.gs
5. Press **Ctrl + A**, then **Ctrl + C** (copies everything).
6. Go back to the Apps Script tab. Click inside the code box, press **Ctrl + A**, then **Ctrl + V** (replaces it).
7. On the left, next to **Files**, click **+** → **HTML**. Type **Admin** (exactly, no `.html`) and press Enter.
8. Open https://raw.githubusercontent.com/benburnsred/anivote/main/awards/apps-script/Admin.html, press **Ctrl + A**, **Ctrl + C**.
9. Back in Apps Script, click inside the new `Admin` file, press **Ctrl + A**, **Ctrl + V**.
10. Click **+** → **HTML** again. Type **Committee** and press Enter.
11. Open https://raw.githubusercontent.com/benburnsred/anivote/main/awards/apps-script/Committee.html, press **Ctrl + A**, **Ctrl + C**.
12. Back in Apps Script, click inside the new `Committee` file, press **Ctrl + A**, **Ctrl + V**.
13. Press **Ctrl + S** to save.

## Part 3 — Run setup once

14. Click the `Code.gs` file on the left.
15. At the top, there's a dropdown next to **Debug**. Pick **setup**.
16. Click **▶ Run**.
17. A box says *Authorization required*. Click **Review permissions** → pick your account.
18. If you see *Google hasn't verified this app*: click **Advanced** → **Go to Untitled project (unsafe)**. (It's your own script, so this is fine.)
19. Click **Allow**.
20. Wait until the bottom says **Execution completed**.

Go back to the Sheet tab. You'll now see new tabs at the bottom (Settings, Categories, Nominees, Committee…).

## Part 4 — Add the committee

21. Click the **Committee** tab. Your email is already there as `admin`.
22. Under it, add one row per member: **email** | **name** | **member** (or **admin** for chairs).
23. Click **Share** (top right). Add the same emails as **Editor**. Click **Send**.

## Part 5 — Turn on the committee pages

24. Back in the Apps Script tab, click **Deploy** (top right) → **New deployment**.
25. Click the **⚙ gear** next to *Select type* → **Web app**.
26. Fill in:
    - Description: **committee**
    - Execute as: **User accessing the web app**
    - Who has access: **Anyone with Google account**
27. Click **Deploy** (approve permissions again if asked).
28. Copy the **Web app URL** (ends in `/exec`). Paste it somewhere safe.

Your links are that URL plus an ending:

- Committee page: `…/exec?page=committee`
- Admin dashboard: `…/exec?page=admin`

Open the admin one now to check it works.

## Part 6 — Turn on public voting

29. Click **Deploy** → **New deployment** again → ⚙ → **Web app**.
30. Fill in:
    - Description: **public**
    - Execute as: **Me**
    - Who has access: **Anyone**
31. Click **Deploy** and copy this second **Web app URL**.

## Part 7 — Let the website read the Sheet

32. Go to the Sheet tab. Click **File → Share → Publish to web**.
33. In the first dropdown pick **Site**, in the second pick **Comma-separated values (.csv)**. Click **Publish** → **OK**. Copy the link.
34. Change the first dropdown to **Settings** (keep .csv). Click **Publish** → **OK**. Copy that link too.

## Part 8 — Send the links

35. Send these 4 things to Claude (or whoever maintains the site):
    - the **committee** URL (Part 5)
    - the **public** URL (Part 6)
    - the **Site** CSV link (Part 7)
    - the **Settings** CSV link (Part 7)

They get wired into the website, and you're done.

---

## Every day after that

- **Committee:** open the committee link → propose, vote 👍/👎, comment.
- **Admin:** open the admin link:
  - **Proposals:** accept or reject.
  - **Categories:** tidy up.
  - **Publish to site:** puts it on the website.
  - **Results:** see votes, tick winners, publish again.

## If something goes wrong

| You see | Do this |
|---|---|
| "Not on the committee list" | Add that email to the Committee tab, and make sure they're signed in to that Google account |
| "Admins only" | Change their role to `admin` in the Committee tab |
| "You need permission" | Share the Sheet with them as Editor |
| Changed the code later | **Deploy → Manage deployments** → ✏️ → Version: **New version** → **Deploy** (keeps the same links). Do it for both deployments |
| Website not updating | Wait 5 minutes after **Publish to site**; Google refreshes the published sheet slowly |
