# Personal Academic Website

This is the source code for your personal academic website.

## Setup

1.  Replace `assets/images/profile.jpg` with your own profile picture.
2.  Update the `index.html` file with any new information or edits.
3.  Add your CV PDF to `assets/Jiajin_CV.pdf` (it is already there, but remember to update it when you have a new version).

## Deployment on GitHub Pages

1.  Create a new repository on GitHub named `your-username.github.io` (e.g., `jiajin.github.io` or `flyhero99.github.io`).
2.  Push this code to the repository:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/your-username.github.io.git
git push -u origin main
```

3.  Go to your repository settings -> Pages.
4.  Ensure the source is set to `main` branch (root folder).
5.  Your site will be live at `https://your-username.github.io`.

## Structure

*   `index.html`: The main page content.
*   `style.css`: The styling for the website.
*   `assets/`: Contains images and documents (CV).
