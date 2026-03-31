# Rankr

Rankr is a game discovery, ranking, and review website created for **ENGR-1340: Introduction to Engineering Design** a class at Texas Tech University

The goal of this project was to learn to design like engineers. We began by developing the idea for the site, then interviewed fellow students and several gamers we personally knew to better understand what users would want from a game-focused platform. The insight gathered from those interviews helped guide our design decisions and early planning process.

From there, we created a **paper wireframe** of the site, followed by a **Figma prototype**, before moving into full development. This project ultimately became Rankr: a space built for both casual and hardcore gamers to share their opinions, explore new titles, and discover what to play next.

---

## Table of Contents

- [Features](#features)
- [Planned Functionality](#planned-functionality)
- [Tech Stack](#tech-stack)
- [How to Run Locally](#how-to-run-locally)
- [IGDB API Setup](#igdb-api-setup)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Team](#team)
- [Future Improvements](#future-improvements)

---

## Features

### Home Page
- Displays a list of **top-rated games** near the top of the page
- Includes a rotating section intended to show the **most recent reviews**

### About Page
- Provides background information about the Rankr project
- Introduces the team behind the site

### Game Page
- Displays key information about an individual game, including:
  - title
  - cover image
  - description
  - genres/themes
  - platforms
  - publisher/developer
  - rating
- Includes a **Rate This Game** button
- Intended to display reviews near the bottom of the page

---

### Browse Page
- Allows users to:
  - search by **game title**
  - browse by **platform**
  - browse by **genre**
- Clicking a platform or genre leads to a browse page filtered by that category

### API Integration
- Uses the **IGDB API** to retrieve game data
- A lightweight **Java backend** is used to populate the site with game information

---

## Planned Functionality

The following features are part of the intended finished solution and/or ongoing development:

- A rotating list of the **most recent reviews** on the home page
- A fully functional **review system**
- **User accounts** for personalized ratings and reviews
- Expanded **search and browse filtering**
- More polished and complete **browse page functionality**
- Potential support for user session features (such as cookies)

---

## Tech Stack

- **HTML**
- **CSS**
- **JavaScript**
- **Java**
- **IGDB API**
- **Git / GitHub**
- **GitHub Pages** *(planned deployment)*

---

## How to Run Locally

Until GitHub Pages deployment is fully set up, Rankr can be run locally using the included Java server.

### 1. Clone the repository

```bash
git clone https://github.com/UnstableGeko/Rankr.git
```
