# MasterSlides: XML Filling Rules Manager (GitHub Edition)

A professional, web-based tool designed to manage XML filling rules across multiple formats and datasets. This application uses **GitHub as a serverless backend**, providing native version control, audit trails, and secure data storage without the need for a traditional database.

---

## 🚀 Key Features

-   **Multi-Dataset Support:** Upload and switch between different XML formats (e.g., Camt.052 v15, v16) independently.
-   **Concurrency Control (Locking):** Prevents data loss by locking a tag when a user starts editing, ensuring two users cannot modify the same record at once.
-   **Native Versioning:** Every "Save" operation creates a real GitHub Commit, generating a permanent history of who changed what and when.
-   **Admin-Only Imports:** Secure Excel import functionality restricted to specific administrators.
-   **User-Friendly UI:** Responsive two-pane layout with real-time search, Bootstrap styling, and FontAwesome icons.
-   **Audit Log:** View the entire history of changes directly from the "Commits" panel.

---

## 🛠 Technical Architecture

-   **Frontend:** HTML5, CSS3 (Bootstrap 5), Vanilla JavaScript.
-   **Backend:** GitHub REST API (v3).
-   **Storage:** JSON-based files (`data.json`, `lock.json`) stored in the repository.
-   **Excel Parsing:** [SheetJS (XLSX)](https://sheetjs.com/) for client-side spreadsheet processing.
-   **Authentication:** GitHub Personal Access Tokens (PAT).

---

## 📋 Prerequisites

1.  A **GitHub Repository** (e.g., `nauni84-pixel/MasterSlides`).
2.  A **GitHub Personal Access Token (Classic)** with the `repo` scope.
3.  Web Hosting (e.g., **GitHub Pages**).

---

## ⏱ Setup Instructions (Build in Minutes)

### 1. Repository Preparation
Create a new GitHub repository and ensure it contains these two files at the root:
-   `data.json`: Initialize with `[]`
-   `lock.json`: Initialize with `{}`

### 2. File Placement
Upload the following files from this project to your repository root:
-   `index.html`: The main UI.
-   `app.js`: The application logic (ensure `githubUser` and `githubRepo` variables match your setup).
-   `.gitignore`: Configured to keep the repository lean.
-   `README.md`: This technical documentation.

### 3. Enable GitHub Pages
1.  Go to **Settings > Pages** in your GitHub repo.
2.  Set **Source** to "Deploy from a branch".
3.  Select the `main` branch and the `/(root)` folder.
4.  Click **Save**. Your site will be live at `https://[username].github.io/[repo-name]/`.

---

## 🔐 Configuration & Security

### Admin Setup
To change who has permission to import Excel files, modify the following line in `app.js`:
```javascript
const ADMIN_USER = "nauni84-pixel"; // Change this to your GitHub username
```

### Data Import
1.  Open the website and login with your PAT.
2.  Click **"Import Excel"**.
3.  The system maps columns as follows:
    -   Column 4: XML Tag
    -   Column 5: XML Path
    -   Column 9: Group B (STD IN Rules)
    -   Column 11: Group C (STD OUT Rules)

---

## 📖 How to Use

1.  **Connect:** Enter your GitHub PAT in the login modal.
2.  **Select Dataset:** Choose a version from the "Datasets" dropdown.
3.  **Edit:** Click "Start Editing" on any tag. This locks the tag for other users.
4.  **Save:** Click "Commit Changes". This saves the data, releases the lock, and creates a Git history entry.
5.  **Audit:** Use the "Commits" button to see the change log.

---

*Built with ❤️ for MasterSlides XML Management.*
