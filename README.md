# From Warning Signs to Student Success

## Interactive Student Risk Explorer

An interactive web-based D3.js visualization exploring how academic and
socioeconomic warning signs are associated with student outcomes in a
Portuguese higher-education context.

The visualization combines two coordinated views to help users explore
warning-profile patterns and their observed relationship with Dropout,
Enrolled, and Graduate outcomes.

---

## Research Question

> **How can academic and socioeconomic warning signs help identify students
> showing profiles associated with dropout and support timely educational
> assistance in Portugal?**

---

## Project Overview

University dropout is influenced by multiple academic and socioeconomic
factors rather than necessarily being associated with a single variable.

This project transforms selected academic and socioeconomic indicators into
two interpretable dimensions:

- **Academic Stability**
- **Socioeconomic Pressure**

Students are then grouped into combined warning profiles and connected to
their observed outcomes.

The visualization is designed to help viewers explore:

1. Where different warning profiles are located.
2. How many students belong to each profile.
3. How those profiles are distributed across observed outcomes.
4. How filtering one visualization affects the other.
5. Which warning-profile areas may deserve further educational attention.

---

# Visualizations

## 1. Warning-Sign Terrain

The first visualization is an interactive two-dimensional terrain that
positions aggregated student groups according to two warning dimensions.

### Visual Encoding

- **Horizontal position:** Academic stability
- **Vertical position:** Socioeconomic pressure
- **Bubble size:** Student count
- **Bubble color:** Observed student outcome

The terrain uses the following directional interpretation:

> **Right = stronger academic stability · Up = greater socioeconomic pressure · Size = student count.**

Each bubble represents a **warning-profile zone**, rather than an individual
student.

### Academic Stability

Academic stability is an exploratory composite index based on:

- Semester approval rates
- Normalized grades

The index combines:

- **65% semester approval rate**
- **35% normalized grades**

The purpose of the index is to create a single interpretable academic
dimension that can be positioned on the horizontal axis.

### Socioeconomic Pressure

Socioeconomic pressure is an exploratory composite index constructed from
selected contextual indicators, including:

- Financial status
- Parents' higher-education context
- Displacement
- Age at enrollment

The resulting value provides an interpretable contextual dimension for
positioning student profiles on the vertical axis.

### Warning Categories

Academic stability is categorized into:

- **Fragile**
- **Developing**
- **Stable**

Socioeconomic pressure is categorized into:

- **Lower**
- **Moderate**
- **High**

Combining these dimensions creates warning profiles such as:

- Fragile · High
- Fragile · Moderate
- Fragile · Lower
- Developing · High
- Developing · Moderate
- Developing · Lower
- Stable · High
- Stable · Moderate
- Stable · Lower

---

# 2. Combined Warning Profiles → Outcomes

The second visualization is an interactive flow visualization connecting
combined warning profiles to observed student outcomes.

The three outcomes are:

- **Dropout**
- **Enrolled**
- **Graduate**

The visualization shows how many students from each warning profile are
associated with each observed outcome.

### Visual Encoding

- **Left side:** Combined warning profiles
- **Right side:** Observed outcomes
- **Ribbon width:** Number of students associated with the flow
- **Outcome color:** Dropout, Enrolled, or Graduate

For example:

> Stable academic · Moderate socioeconomic pressure → Graduate

represents the observed connection between that warning profile and the
Graduate outcome.

---

# Interaction

The website provides interactive exploration of the dataset.

Users can:

- Filter by **Outcome**
- Filter by **Course**
- Change the terrain encoding
- Explore individual bubbles
- View detailed tooltips
- Zoom and pan the terrain
- Reset the terrain view
- Click a profile or ribbon to connect the two visualizations
- Explore the corresponding warning-profile information

### Terrain Zoom

Zoom is intentionally controlled by a button.

**Default: Zoom Off**

When zoom is turned on:

- Scroll / pinch → Zoom
- Drag → Pan

When zoom is turned off:

- Zoom and pan are disabled
- The terrain returns to normal interaction

Bubble clicking remains available independently.

---

# Coordinated Interaction

The two visualizations are connected.

The second visualization contains the instruction:

> **Click a profile or ribbon to filter the terrain above**

Selecting a warning profile or outcome flow updates the terrain so that the
viewer can examine the corresponding group in the first visualization.

This coordinated interaction allows the user to move between:

**Warning dimensions → Warning profiles → Observed outcomes**

rather than viewing the two visualizations as unrelated charts.

---

# Data Processing

The original dataset contains multiple academic, demographic, socioeconomic,
and outcome variables.

This project does **not** attempt to visualize every original variable at
the same time.

Instead, variables relevant to the research question are selected and
transformed into interpretable derived measures.

The general processing workflow is:

```text
Original student dataset
        ↓
Selected relevant variables
        ↓
Data cleaning and conversion
        ↓
Academic indicators
        ↓
Academic Stability
        ↓
Socioeconomic/context indicators
        ↓
Socioeconomic Pressure
        ↓
Warning categories
        ↓
Combined warning profiles
        ↓
Observed student outcomes
        ↓
Interactive D3.js visualizations
