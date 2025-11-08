// Initialize on page load like we learned about lecture
document.addEventListener('DOMContentLoaded', function () {
    initSimulator();
    initHowItWorks();
});

// Simulator logic
let candidates = [];
let ballots = [];
let preferences = [];
let locked = [];
let pairs = [];

// Initialize simulator page event handlers if the simulator is present
function initSimulator() {
    const simulatorPage = document.getElementById('simulator-page');
    if (!simulatorPage) {
        return;
    }

    const startBtn = document.getElementById('start-btn');
    const addVoterBtn = document.getElementById('add-voter-btn');
    const computeBtn = document.getElementById('compute-btn');

    if (startBtn) {
        startBtn.addEventListener('click', startElection);
    }
    if (addVoterBtn) {
        addVoterBtn.addEventListener('click', addVoterRow);
    }
    if (computeBtn) {
        computeBtn.addEventListener('click', computeWinner);
    }
}

// Read candidate names and show ballot section
function startElection() {
    const nameInputs = document.querySelectorAll('.candidate-name');
    candidates = [];

    nameInputs.forEach(input => {
        const name = input.value.trim();
        if (name !== '') {
            candidates.push(name);
        }
    });

    if (candidates.length < 2) {
        alert('Please enter at least two candidate names.');
        return;
    }

    ballots = [];
    const ballotsContainer = document.getElementById('ballots-container');
    ballotsContainer.innerHTML = '';

    document.getElementById('ballot-section').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';

    addVoterRow(); // start with one voter
}

// Add a ballot row with ranking dropdowns for each candidate
function addVoterRow() {
    if (candidates.length === 0) {
        alert('Start the election first by entering candidate names.');
        return;
    }

    const container = document.getElementById('ballots-container');
    const voterIndex = container.children.length + 1;

    const row = document.createElement('div');
    row.className = 'ballot-row';

    const heading = document.createElement('h5');
    heading.textContent = 'Voter ' + voterIndex;
    row.appendChild(heading);

    const formRow = document.createElement('div');
    formRow.className = 'form-row';

    for (let i = 0; i < candidates.length; i++) {
        const col = document.createElement('div');
        col.className = 'form-group col-md-3';

        const label = document.createElement('label');
        label.textContent = 'Rank ' + (i + 1);

        const select = document.createElement('select');
        select.className = 'form-control rank-select';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select candidate';
        select.appendChild(defaultOption);

        candidates.forEach((candidateName, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = candidateName;
            select.appendChild(option);
        });

        col.appendChild(label);
        col.appendChild(select);
        formRow.appendChild(col);
    }

    row.appendChild(formRow);
    container.appendChild(row);
}

// Read all ballots, validate them, run Tideman, and display results
function computeWinner() {
    if (candidates.length === 0) {
        alert('Please start the election first.');
        return;
    }

    const ballotRows = document.querySelectorAll('.ballot-row');
    ballots = [];

    ballotRows.forEach(row => {
        const selects = row.querySelectorAll('select.rank-select');
        const ranks = [];
        let hasEmpty = false;

        selects.forEach(select => {
            if (!select.value) {
                hasEmpty = true;
            } else {
                ranks.push(parseInt(select.value, 10));
            }
        });

        if (hasEmpty) {
            return;
        }

        const unique = new Set(ranks);
        if (unique.size !== candidates.length) {
            ballots.push({ ranks, valid: false });
        } else {
            ballots.push({ ranks, valid: true });
        }
    });

    if (ballots.length === 0) {
        alert('Please add at least one complete voter ballot.');
        return;
    }

    // Check for invalid ballots
    const invalid = ballots.some(b => !b.valid);
    if (invalid) {
        alert('Every ballot must rank each candidate exactly once (no repeats and no blanks).');
        return;
    }

    // Extract ranks arrays only
    const cleanBallots = ballots.map(b => b.ranks);
    ballots = cleanBallots;

    runTideman();
    displayResults();
}

/**
 * Run the Tideman algorithm in JavaScript using global arrays
 * Mirrors the C pipeline: recordPreferences -> addPairs -> sort -> lockPairs
 */
function runTideman() {
    const n = candidates.length;

    // Initialize matrices and pairs
    preferences = Array.from({ length: n }, () => Array(n).fill(0));
    locked = Array.from({ length: n }, () => Array(n).fill(false));
    pairs = [];

    recordPreferences();
    addPairs();

    // sort_pairs
    pairs.sort((a, b) => b.strength - a.strength);

    lockPairs();
}

/**
 * record_preferences: update preferences[][] using all ballots
 * JS version of C's record_preferences
 */
function recordPreferences() {
    const n = candidates.length;

    ballots.forEach(ranks => {
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const preferred = ranks[i];
                const lessPreferred = ranks[j];
                preferences[preferred][lessPreferred]++;
            }
        }
    });
}

/**
 * add_pairs: build the global pairs[] array based on preferences[][]
 * JS version of C's add_pairs
 */
function addPairs() {
    const n = candidates.length;

    for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
            const prefersI = preferences[i][j];
            const prefersJ = preferences[j][i];

            if (prefersI > prefersJ) {
                pairs.push({ winner: i, loser: j, strength: prefersI - prefersJ });
            } else if (prefersJ > prefersI) {
                pairs.push({ winner: j, loser: i, strength: prefersJ - prefersI });
            }
        }
    }
}

/**
 * lock_pairs: go through sorted pairs and lock edges that do not create a cycle
 * JS version of C's lock_pairs
 */
function lockPairs() {
    pairs.forEach(pair => {
        if (!createsCycle(pair.winner, pair.loser)) {
            locked[pair.winner][pair.loser] = true;
        }
    });
}

// Check whether adding winner -> loser would create a cycle
function createsCycle(winner, loser) {
    return hasPath(loser, winner, new Set());
}

// DFS to find a path from start to target using locked
function hasPath(start, target, visited) {
    if (start === target) {
        return true;
    }

    visited.add(start);

    for (let next = 0; next < candidates.length; next++) {
        if (locked[start][next] && !visited.has(next)) {
            if (hasPath(next, target, visited)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Find the index of the Tideman winner
 * Returns:
 *   - candidate index if there is exactly 1 source (no incoming edges)
 *   - null if there are zero or multiple sources (tie / i dont why else but just in case)
 */
function findWinnerIndex() {
    const n = candidates.length;
    const sources = [];

    for (let j = 0; j < n; j++) {
        let hasIncoming = false;
        for (let i = 0; i < n; i++) {
            if (locked[i][j]) {
                hasIncoming = true;
                break;
            }
        }
        if (!hasIncoming) {
            sources.push(j);
        }
    }

    if (sources.length === 1) {
        return sources[0];
    }
    // 0 or multiple sources: no unique winner
    return null;
}

// Render preferences, pairs, locked graph, and winner in DOM
function displayResults() {
    const winnerIndex = findWinnerIndex();
    const winnerOutput = document.getElementById('winner-output');

    if (winnerIndex === null) {
        winnerOutput.textContent = 'Winner: No clear winner (tie or cycle in preferences)';
    } else {
        const winnerName = candidates[winnerIndex];
        winnerOutput.textContent = 'Winner: ' + winnerName;
    }

    const prefsOutput = document.getElementById('preferences-output');
    const pairsOutput = document.getElementById('pairs-output');
    const lockedOutput = document.getElementById('locked-output');

    // Preferences matrix table
    let prefsHtml = '<h5>Preferences matrix (rows preferred over columns)</h5>';
    prefsHtml += '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th></th>';
    candidates.forEach(name => {
        prefsHtml += '<th>' + name + '</th>';
    });
    prefsHtml += '</tr></thead><tbody>';

    for (let i = 0; i < candidates.length; i++) {
        prefsHtml += '<tr><th scope="row">' + candidates[i] + '</th>';
        for (let j = 0; j < candidates.length; j++) {
            if (i === j) {
                prefsHtml += '<td>–</td>';
            } else {
                prefsHtml += '<td>' + preferences[i][j] + '</td>';
            }
        }
        prefsHtml += '</tr>';
    }
    prefsHtml += '</tbody></table></div>';
    prefsOutput.innerHTML = prefsHtml;

    // Sorted pairs list
    let pairsHtml = '<h5>Sorted pairs (winner → loser, strength)</h5>';
    if (pairs.length === 0) {
        pairsHtml += '<p>No non-tied pairs.</p>';
    } else {
        pairsHtml += '<ul>';
        pairs.forEach(pair => {
            pairsHtml += '<li>' +
                candidates[pair.winner] +
                ' → ' + candidates[pair.loser] +
                ' (+' + pair.strength + ')</li>';
        });
        pairsHtml += '</ul>';
    }
    pairsOutput.innerHTML = pairsHtml;

    // Locked edges list
    let lockedHtml = '<h5>Locked graph edges</h5>';
    const edges = [];
    for (let i = 0; i < candidates.length; i++) {
        for (let j = 0; j < candidates.length; j++) {
            if (locked[i][j]) {
                edges.push(candidates[i] + ' → ' + candidates[j]);
            }
        }
    }
    if (edges.length === 0) {
        lockedHtml += '<p>No edges locked (all pairs rejected or tied).</p>';
    } else {
        lockedHtml += '<ul>';
        edges.forEach(e => {
            lockedHtml += '<li>' + e + '</li>';
        });
        lockedHtml += '</ul>';
    }
    lockedOutput.innerHTML = lockedHtml;

    document.getElementById('results-section').style.display = 'block';
}

// How-it-works step reveal in how-it-works.html
function initHowItWorks() {
    const howPage = document.getElementById('how-page');
    if (!howPage) {
        return;
    }

    const steps = Array.from(document.querySelectorAll('.tideman-step'));
    if (steps.length === 0) {
        return;
    }

    const btn = document.getElementById('step-next-btn');
    if (!btn) {
        return;
    }

    // Step 0 is already visible (index 0), so start from Step 1
    let current = 1;

    btn.addEventListener('click', function () {
        if (current < steps.length) {
            steps[current].classList.add('visible');
            current++;

            if (current === steps.length) {
                btn.style.display = 'none';
            }
        } else {
            btn.style.display = 'none';
        }
    });
}
